"use server";

import { asc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { allowedDomains, auditLog, magicLinks, monthlyAwards, ratingResets, sessions, users } from "@/db/schema";
import { parseAdminCommand } from "@/domain/admin-command";
import { isValidDomain } from "@/domain/email-domain";
import { brusselsMonth, type AwardLevel } from "@/domain/monthly-award";
import { todayInBrussels } from "@/lib/dates";
import { configuredAllowedDomains } from "@/lib/allowed-domains";
import { nextGlobalSequence, recalculateAllRatings } from "@/lib/rating-recalculation";
import { requireUser } from "@/lib/auth";

export type AdminConsoleResult = { status: "success" | "error" | "confirm"; message: string };

const STREAK_FOR_LEVEL: Record<AwardLevel, number> = { bronze: 1, silver: 2, gold: 3 };

const helpMessage = [
  "Commands:",
  "  players                                    List player IDs, names, and emails",
  "  retire <player>                            Retire a player",
  "  unretire <player>                           Restore a retired player",
  "  delete <player>                             Deactivate an account for good",
  "  elo reset <player> [to <elo>]               Set current Elo; default 1500",
  "  award set <player> <bronze|silver|gold> <yyyy-mm>   Set a monthly award",
  "  award remove <player> <yyyy-mm>             Remove a monthly award",
  "  domain add <domain>                         Allow an email domain",
  "  help | helper | ?                           Show this help",
  "Player may be an ID, email, or exact display name. Quote names with spaces.",
  "Each month has one award. Setting one for a month replaces whoever held it.",
].join("\n");

async function findPlayer(selector: string) {
  const players = await db.select().from(users).where(isNull(users.deletedAt)).all();
  const normalized = selector.trim().toLocaleLowerCase("en-US");
  const numericId = /^\d+$/.test(normalized) ? Number(normalized) : null;
  return players.find((player) =>
    (numericId !== null && player.id === numericId) ||
    player.email.toLocaleLowerCase("en-US") === normalized ||
    player.displayName.toLocaleLowerCase("en-US") === normalized,
  );
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
      .where(isNull(users.deletedAt))
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
  const selfAllowed = new Set(["reset_elo", "set_award", "remove_award"]);
  if (target.id === actor.id && !selfAllowed.has(command.type)) {
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
    const effectiveOn = todayInBrussels();
    await db.transaction(async (tx) => {
      const sequence = await nextGlobalSequence(tx);
      await tx.insert(ratingResets).values({
        userId: target.id,
        rating: command.rating,
        effectiveOn,
        sequence,
        setBy: actor.id,
      }).run();
      await recalculateAllRatings(tx);
      await tx.insert(auditLog).values({
        actorId: actor.id,
        action: "player.elo_reset",
        entityType: "user",
        entityId: String(target.id),
        details: {
          displayName: target.displayName,
          previousCurrentRating: target.currentRating,
          rating: command.rating,
          effectiveOn,
          source: "admin_console",
        },
      }).run();
    });
    revalidatePath("/");
    revalidatePath("/games");
    revalidatePath("/history");
    return { status: "success", message: `Set ${target.displayName}'s Elo to ${command.rating}.` };
  }

  if (command.type === "set_award") {
    const { month } = command;
    if (month > brusselsMonth()) return { status: "error", message: "Cannot set an award for a future month." };
    const streak = STREAK_FOR_LEVEL[command.level];
    const previous = await db.select().from(monthlyAwards).where(eq(monthlyAwards.awardMonth, month)).get();
    await db.transaction(async (tx) => {
      await tx.insert(monthlyAwards).values({ awardMonth: month, userId: target.id, level: command.level, streak })
        .onConflictDoUpdate({
          target: monthlyAwards.awardMonth,
          set: { userId: target.id, level: command.level, streak, awardedAt: new Date() },
        }).run();
      await tx.insert(auditLog).values({
        actorId: actor.id,
        action: "award.set",
        entityType: "monthly_award",
        entityId: month,
        details: {
          displayName: target.displayName,
          level: command.level,
          month,
          previousUserId: previous?.userId ?? null,
          previousLevel: previous?.level ?? null,
          source: "admin_console",
        },
      }).run();
    });
    revalidatePath("/");
    return { status: "success", message: `Set the ${month} award to ${command.level} for ${target.displayName}.` };
  }

  if (command.type === "remove_award") {
    const { month } = command;
    const existing = await db.select().from(monthlyAwards).where(eq(monthlyAwards.awardMonth, month)).get();
    if (!existing) return { status: "error", message: `No award recorded for ${month}.` };
    if (existing.userId !== target.id) return { status: "error", message: `${target.displayName} does not hold the ${month} award.` };
    await db.transaction(async (tx) => {
      await tx.delete(monthlyAwards).where(eq(monthlyAwards.awardMonth, month)).run();
      await tx.insert(auditLog).values({
        actorId: actor.id,
        action: "award.removed",
        entityType: "monthly_award",
        entityId: month,
        details: { displayName: target.displayName, level: existing.level, month, source: "admin_console" },
      }).run();
    });
    revalidatePath("/");
    return { status: "success", message: `Removed the ${month} award from ${target.displayName}.` };
  }

  if (!command.confirmed) {
    return {
      status: "confirm",
      message: `This deactivates ${target.displayName}'s account and frees up their email for reuse. Their games, rating resets, and awards stay on record — other players' Elo is unaffected. Run: delete ${target.id} --confirm`,
    };
  }

  const anonymizedEmail = `deleted-${target.id}@removed.invalid`;
  await db.transaction(async (tx) => {
    await tx.update(users).set({
      deletedAt: new Date(),
      deletedBy: actor.id,
      email: anonymizedEmail,
      isAdmin: false,
    }).where(eq(users.id, target.id)).run();
    // Sessions and pending magic links are revoked outright; nothing else references them.
    await tx.delete(sessions).where(eq(sessions.userId, target.id)).run();
    await tx.delete(magicLinks).where(eq(magicLinks.email, target.email)).run();
    await tx.insert(auditLog).values({
      actorId: actor.id,
      action: "player.deleted",
      entityType: "user",
      entityId: String(target.id),
      details: { displayName: target.displayName, previousEmail: target.email, source: "admin_console" },
    }).run();
  });
  revalidatePath("/");
  revalidatePath("/games");
  revalidatePath("/settings");
  revalidatePath("/history");
  return { status: "success", message: `Deactivated ${target.displayName}. Their game history and other players' Elo are unaffected.` };
}
