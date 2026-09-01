"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auditLog, games } from "@/db/schema";
import { recalculateAllRatings } from "@/lib/rating-recalculation";
import { requireUser } from "@/lib/auth";

export type DeleteGameState = { message?: string };

export async function deleteGame(_state: DeleteGameState, formData: FormData): Promise<DeleteGameState> {
  const actor = await requireUser();
  if (!actor.isAdmin) return { message: "Only administrators can delete games." };

  const gameId = Number(formData.get("gameId"));
  if (!Number.isInteger(gameId) || gameId < 1) return { message: "Invalid game." };
  const gameToDelete = await db.select().from(games).where(eq(games.id, gameId)).get();
  if (!gameToDelete || gameToDelete.deletedAt) return { message: "That game no longer exists." };

  await db.transaction(async (tx) => {
    const deletedAt = new Date();
    const deletion = await tx.update(games).set({ deletedAt, deletedBy: actor.id })
      .where(and(eq(games.id, gameId), isNull(games.deletedAt))).run();
    if (deletion.rowsAffected !== 1) throw new Error("Game was already deleted");
    await tx.insert(auditLog).values({
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

    await recalculateAllRatings(tx);
  });

  redirect("/games?deleted=1");
}
