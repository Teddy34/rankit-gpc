"use server";

import { asc, eq, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { allowedDomains, auditLog, games, magicLinks, monthlyAwards, users } from "@/db/schema";
import { parseAdminCommand } from "@/domain/admin-command";
import { isValidDomain } from "@/domain/email-domain";
import { replayRatings } from "@/domain/rating-replay";
import { configuredAllowedDomains } from "@/lib/allowed-domains";
import { requireUser } from "@/lib/auth";

export type AdminConsoleResult = { status: "success" | "error" | "confirm"; message: string };

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const helpMessage = [
  "Commands:",
  "  players                         List player IDs, names, and emails",
  "  retire <player>                 Retire a player",
  "  unretire <player>               Restore a retired player",
  "  delete <player>                 Prepare permanent deletion",
  "  elo reset <player> [to <elo>]   Rebase Elo; default 1500",
  "  domain add <domain>              Allow an email domain",
  "  help | helper | ?                Show this help",
  "Player may be an ID, email, or exact display name. Quote names with spaces.",
].join("\n");

async function findPlayer(selector: string) {
  const players = await db.select().from(users).all();
  const normalized = selector.trim().toLocaleLowerCase("en-US");
  const numericId = /^\d+$/.test(normalized) ? Number(normalized) : null;
  return players.find((player) =>
    (numericId !== null && player.id === numericId) ||
    player.email.toLocaleLowerCase("en-US") === normalized ||
    player.displayName.toLocaleLowerCase("en-US") === normalized,
  );
}

async function recalculateRatings(tx: Transaction): Promise<void> {
  const allPlayers = await tx.select().from(users).all();
  const activeGames = await tx.select().from(games).where(isNull(games.deletedAt)).all();
  const names = new Map(allPlayers.map((player) => [player.id, player.displayName]));
  const replay = replayRatings(
    allPlayers.map((player) => ({ id: player.id, initialRating: player.initialRating })),
    activeGames.map((game) => ({
      id: game.id,
      playerOneId: game.playerOneId,
      playerTwoId: game.playerTwoId,
      result: game.result,
      playedOn: game.playedOn,
      sequence: game.sequence,
      playerOneName: names.get(game.playerOneId) ?? "",
    })),
  );
  for (const game of replay.games) {
    await tx.update(games).set({
      playerOneDelta: game.playerOneDelta,
      playerTwoDelta: game.playerTwoDelta,
    }).where(eq(games.id, game.id)).run();
  }
  for (const [userId, rating] of replay.ratings) {
    await tx.update(users).set({ currentRating: rating }).where(eq(users.id, userId)).run();
  }
}

export async function runAdminCommand(rawCommand: string): Promise<AdminConsoleResult> {
  const actor = await requireUser();
  if (!actor.isAdmin) return { status: "error", message: "Administrator access required." };
  if (rawCommand.length > 300) return { status: "error", message: "Command exceeds 300 characters." };

  const parsed = parseAdminCommand(rawCommand);
  if (!parsed.ok) return { status: "error", message: parsed.message };
  const command = parsed.command;
  if (command.type === "help") return { status: "success", message: helpMessage };

  if (command.type === "list_players") {
    const players = await db.select({ id: users.id, displayName: users.displayName, email: users.email })
      .from(users)
      .orderBy(asc(users.displayName));
    if (players.length === 0) return { status: "success", message: "No players found." };

    const idWidth = Math.max(2, ...players.map((player) => String(player.id).length));
    const nameWidth = Math.max("DISPLAY NAME".length, ...players.map((player) => player.displayName.length));
    const lines = [
      `${"ID".padEnd(idWidth)}  ${"DISPLAY NAME".padEnd(nameWidth)}  EMAIL`,
      `${"-".repeat(idWidth)}  ${"-".repeat(nameWidth)}  ${"-".repeat(5)}`,
      ...players.map((player) => `${String(player.id).padEnd(idWidth)}  ${player.displayName.padEnd(nameWidth)}  ${player.email}`),
    ];
    return { status: "success", message: lines.join("\n") };
  }

  if (command.type === "add_domain") {
    if (!isValidDomain(command.domain)) return { status: "error", message: "Enter a valid domain, such as example.com." };
    if (configuredAllowedDomains().has(command.domain) || await db.select({ id: allowedDomains.id }).from(allowedDomains).where(eq(allowedDomains.domain, command.domain)).get()) {
      return { status: "error", message: `${command.domain} is already allowed.` };
    }
    await db.transaction(async (tx) => {
      const created = await tx.insert(allowedDomains).values({ domain: command.domain, createdBy: actor.id }).returning({ id: allowedDomains.id }).get();
      await tx.insert(auditLog).values({
        actorId: actor.id,
        action: "domain.allowed",
        entityType: "allowed_domain",
        entityId: String(created.id),
        details: { domain: command.domain, source: "admin_console" },
      }).run();
    });
    revalidatePath("/settings");
    return { status: "success", message: `Allowed ${command.domain}.` };
  }

  const target = await findPlayer(command.player);
  if (!target) return { status: "error", message: `Player not found: ${command.player}` };
  if (target.id === actor.id && command.type !== "reset_elo") {
    return { status: "error", message: "You cannot retire or delete your own account." };
  }

  if (command.type === "retire" || command.type === "unretire") {
    const retiredAt = command.type === "retire" ? new Date() : null;
    if (Boolean(target.retiredAt) === Boolean(retiredAt)) {
      return { status: "error", message: `${target.displayName} is already ${retiredAt ? "retired" : "active"}.` };
    }
    await db.transaction(async (tx) => {
      await tx.update(users).set({ retiredAt }).where(eq(users.id, target.id)).run();
      await tx.insert(auditLog).values({
        actorId: actor.id,
        action: retiredAt ? "player.retired" : "player.unretired",
        entityType: "user",
        entityId: String(target.id),
        details: { displayName: target.displayName, source: "admin_console" },
      }).run();
    });
    revalidatePath("/");
    return { status: "success", message: `${retiredAt ? "Retired" : "Restored"} ${target.displayName}.` };
  }

  if (command.type === "reset_elo") {
    let currentRating = command.rating;
    await db.transaction(async (tx) => {
      await tx.update(users).set({ initialRating: command.rating }).where(eq(users.id, target.id)).run();
      await recalculateRatings(tx);
      const updated = await tx.select({ currentRating: users.currentRating }).from(users).where(eq(users.id, target.id)).get();
      currentRating = updated?.currentRating ?? command.rating;
      await tx.insert(auditLog).values({
        actorId: actor.id,
        action: "player.elo_reset",
        entityType: "user",
        entityId: String(target.id),
        details: {
          displayName: target.displayName,
          previousInitialRating: target.initialRating,
          previousCurrentRating: target.currentRating,
          initialRating: command.rating,
          currentRating,
          source: "admin_console",
        },
      }).run();
    });
    revalidatePath("/");
    revalidatePath("/games");
    return { status: "success", message: `Rebased ${target.displayName} at ${command.rating}; current Elo is ${currentRating} after game history.` };
  }

  if (!command.confirmed) {
    return {
      status: "confirm",
      message: `This permanently deletes ${target.displayName}, their awards, sessions, and every game involving them. Run: delete ${target.id} --confirm`,
    };
  }

  let deletedGames = 0;
  await db.transaction(async (tx) => {
    await tx.delete(auditLog).where(eq(auditLog.actorId, target.id)).run();
    await tx.update(allowedDomains).set({ createdBy: null }).where(eq(allowedDomains.createdBy, target.id)).run();
    await tx.update(games).set({ registeredBy: actor.id }).where(eq(games.registeredBy, target.id)).run();
    await tx.update(games).set({ deletedBy: actor.id }).where(eq(games.deletedBy, target.id)).run();
    const gameDeletion = await tx.delete(games).where(or(eq(games.playerOneId, target.id), eq(games.playerTwoId, target.id))).run();
    deletedGames = gameDeletion.rowsAffected;
    await tx.delete(monthlyAwards).where(eq(monthlyAwards.userId, target.id)).run();
    await tx.delete(magicLinks).where(eq(magicLinks.email, target.email)).run();
    await tx.delete(users).where(eq(users.id, target.id)).run();
    await recalculateRatings(tx);
    await tx.insert(auditLog).values({
      actorId: actor.id,
      action: "player.deleted",
      entityType: "user",
      entityId: String(target.id),
      details: { displayName: target.displayName, email: target.email, deletedGames, source: "admin_console" },
    }).run();
  });
  revalidatePath("/");
  revalidatePath("/games");
  revalidatePath("/settings");
  return { status: "success", message: `Deleted ${target.displayName} and ${deletedGames} game${deletedGames === 1 ? "" : "s"}.` };
}
