"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auditLog, games, users } from "@/db/schema";
import { replayRatings } from "@/domain/rating-replay";
import { requireUser } from "@/lib/auth";

export type DeleteGameState = { message?: string };

export async function deleteGame(_state: DeleteGameState, formData: FormData): Promise<DeleteGameState> {
  const actor = await requireUser();
  if (!actor.isAdmin) return { message: "Only administrators can delete games." };

  const gameId = Number(formData.get("gameId"));
  if (!Number.isInteger(gameId) || gameId < 1) return { message: "Invalid game." };
  const gameToDelete = db.select().from(games).where(eq(games.id, gameId)).get();
  if (!gameToDelete || gameToDelete.deletedAt) return { message: "That game no longer exists." };

  db.transaction((tx) => {
    const deletedAt = new Date();
    const deletion = tx.update(games).set({ deletedAt, deletedBy: actor.id })
      .where(and(eq(games.id, gameId), isNull(games.deletedAt))).run();
    if (deletion.changes !== 1) throw new Error("Game was already deleted");
    tx.insert(auditLog).values({
      actorId: actor.id,
      action: "game.deleted",
      entityType: "game",
      entityId: String(gameId),
      details: {
        playerOneId: gameToDelete.playerOneId,
        playerTwoId: gameToDelete.playerTwoId,
        result: gameToDelete.result,
        playedOn: gameToDelete.playedOn,
        playerOneDelta: gameToDelete.playerOneDelta,
        playerTwoDelta: gameToDelete.playerTwoDelta,
      },
    }).run();

    const allPlayers = tx.select().from(users).all();
    const remainingGames = tx.select().from(games).where(isNull(games.deletedAt)).all();
    const names = new Map(allPlayers.map((player) => [player.id, player.displayName]));
    const replay = replayRatings(
      allPlayers.map((player) => ({ id: player.id, initialRating: player.initialRating })),
      remainingGames.map((game) => ({
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
      tx.update(games).set({ playerOneDelta: game.playerOneDelta, playerTwoDelta: game.playerTwoDelta }).where(eq(games.id, game.id)).run();
    }
    for (const [userId, rating] of replay.ratings) {
      tx.update(users).set({ currentRating: rating }).where(eq(users.id, userId)).run();
    }
  });

  redirect("/games?deleted=1");
}
