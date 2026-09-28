import "server-only";

import { eq, isNull, max } from "drizzle-orm";
import type { Transaction } from "@/db";
import { games, ratingResets, users } from "@/db/schema";
import { gamesToUpdate, ratingsToUpdate } from "@/domain/rating-recalculation-diff";
import { replayRatings } from "@/domain/rating-replay";

/**
 * Replays every active game and rating reset in the system and writes back each player's
 * currentRating (and every game's stored deltas). Call this inside a transaction after inserting,
 * editing, or deleting a game, or after inserting a rating reset — anything that can change the
 * replayed timeline.
 *
 * The replay itself is cheap (an in-memory sort and scan), but writing every row back on every
 * registration is not: most of the timeline is untouched by a given change, so only the games and
 * players whose values actually came out different are written, and those writes are fired
 * concurrently rather than one sequential round trip at a time.
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

  const changedGames = gamesToUpdate(activeGames, replay.games);
  const changedRatings = ratingsToUpdate(allPlayers, replay.ratings);

  await Promise.all([
    ...changedGames.map((game) =>
      tx.update(games).set({ playerOneDelta: game.playerOneDelta, playerTwoDelta: game.playerTwoDelta }).where(eq(games.id, game.id)).run()),
    ...changedRatings.map((player) =>
      tx.update(users).set({ currentRating: player.currentRating }).where(eq(users.id, player.id)).run()),
  ]);
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
