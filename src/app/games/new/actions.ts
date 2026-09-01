"use server";

import { and, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { games, users } from "@/db/schema";
import { todayInBrussels } from "@/lib/dates";
import { nextGlobalSequence, recalculateAllRatings } from "@/lib/rating-recalculation";
import { requireUser } from "@/lib/auth";

export type GameFormState = { message?: string };

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

  const activePlayers = await db.select().from(users).where(and(isNull(users.retiredAt), isNull(users.deletedAt))).all();
  if (!activePlayers.some((player) => player.id === playerOneId) || !activePlayers.some((player) => player.id === playerTwoId)) {
    return { message: "Both players must be active." };
  }

  await db.transaction(async (tx) => {
    const sequence = await nextGlobalSequence(tx);
    await tx.insert(games).values({
      playerOneId, playerTwoId,
      result: result as "player_one" | "player_two" | "draw",
      playedOn, sequence, registeredBy: actor.id,
      playerOneDelta: 0, playerTwoDelta: 0,
    }).run();

    await recalculateAllRatings(tx);
  });
  redirect("/games?registered=1");
}
