import "server-only";

import { eq, isNull, max } from "drizzle-orm";
import type { Transaction } from "@/db";
import { games, ratingResets, users } from "@/db/schema";
import { replayRatings } from "@/domain/rating-replay";

/**
 * Replays every active game and rating reset in the system and writes back each player's
 * currentRating (and every game's stored deltas). Call this inside a transaction after inserting,
 * editing, or deleting a game, or after inserting a rating reset — anything that can change the
 * replayed timeline.
 */
export async function recalculateAllRatings(tx: Transaction): Promise<void> {
  const allPlayers = await tx.select().from(users).all();
  const activeGames = await tx.select().from(games).where(isNull(games.deletedAt)).all();
  const activeResets = await tx.select().from(ratingResets).where(isNull(ratingResets.deletedAt)).all();
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
    activeResets.map((reset) => ({
      id: reset.id,
      userId: reset.userId,
      rating: reset.rating,
      effectiveOn: reset.effectiveOn,
      sequence: reset.sequence,
    })),
  );

  for (const game of replay.games) {
    await tx.update(games).set({ playerOneDelta: game.playerOneDelta, playerTwoDelta: game.playerTwoDelta }).where(eq(games.id, game.id)).run();
  }
  for (const [userId, rating] of replay.ratings) {
    await tx.update(users).set({ currentRating: rating }).where(eq(users.id, userId)).run();
  }
}

/**
 * Games and rating resets share one sequence counter so they interleave deterministically in the
 * replay timeline when they land on the same date (see rating-replay.ts).
 */
export async function nextGlobalSequence(tx: Transaction): Promise<number> {
  const [gameMax, resetMax] = await Promise.all([
    tx.select({ value: max(games.sequence) }).from(games).get(),
    tx.select({ value: max(ratingResets.sequence) }).from(ratingResets).get(),
  ]);
  return Math.max(gameMax?.value ?? 0, resetMax?.value ?? 0) + 1;
}
