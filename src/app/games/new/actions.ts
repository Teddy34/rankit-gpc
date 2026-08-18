"use server";

import { eq, isNull, max } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { games, users } from "@/db/schema";
import { replayRatings } from "@/domain/rating-replay";
import { requireUser } from "@/lib/auth";

export type GameFormState = { message?: string };

function todayInBrussels(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export async function registerGame(_state: GameFormState, formData: FormData): Promise<GameFormState> {
  const actor = await requireUser();
  const playerOneId = Number(formData.get("playerOneId"));
  const playerTwoId = Number(formData.get("playerTwoId"));
  const result = String(formData.get("result"));
  const playedOn = String(formData.get("playedOn") ?? "");

  if (!Number.isInteger(playerOneId) || !Number.isInteger(playerTwoId) || playerOneId === playerTwoId) {
    return { message: "Choose two different players." };
  }
  if (!new Set(["player_one", "player_two", "draw"]).has(result)) return { message: "Choose a valid result." };
  const parsedDate = new Date(`${playedOn}T00:00:00Z`);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(playedOn) &&
    !Number.isNaN(parsedDate.valueOf()) && parsedDate.toISOString().slice(0, 10) === playedOn;
  if (!validDate || playedOn > todayInBrussels()) {
    return { message: "Enter a valid game date that is not in the future." };
  }

  const activePlayers = db.select().from(users).where(isNull(users.retiredAt)).all();
  if (!activePlayers.some((player) => player.id === playerOneId) || !activePlayers.some((player) => player.id === playerTwoId)) {
    return { message: "Both players must be active." };
  }

  db.transaction((tx) => {
    const row = tx.select({ value: max(games.sequence) }).from(games).get();
    tx.insert(games).values({
      playerOneId, playerTwoId,
      result: result as "player_one" | "player_two" | "draw",
      playedOn, sequence: (row?.value ?? 0) + 1, registeredBy: actor.id,
      playerOneDelta: 0, playerTwoDelta: 0,
    }).run();

    const allPlayers = tx.select().from(users).all();
    const allGames = tx.select().from(games).where(isNull(games.deletedAt)).all();
    const names = new Map(allPlayers.map((player) => [player.id, player.displayName]));
    const replay = replayRatings(
      allPlayers.map((player) => ({ id: player.id, initialRating: player.initialRating })),
      allGames.map((game) => ({
        id: game.id, playerOneId: game.playerOneId, playerTwoId: game.playerTwoId,
        result: game.result, playedOn: game.playedOn, sequence: game.sequence,
        playerOneName: names.get(game.playerOneId) ?? "",
      })),
    );
    for (const game of replay.games) {
      tx.update(games).set({ playerOneDelta: game.playerOneDelta, playerTwoDelta: game.playerTwoDelta }).where(eq(games.id, game.id)).run();
    }
    for (const [userId, rating] of replay.ratings) {
      tx.update(users).set({ currentRating: rating }).where(eq(users.id, userId)).run();
    }
  });
  redirect("/games?registered=1");
}
