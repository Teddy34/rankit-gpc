import "server-only";

import { and, asc, desc, eq, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { games, monthlyAwards, users } from "@/db/schema";
import { awardLevelForStreak, brusselsMonth, monthsAfter, previousMonth } from "@/domain/monthly-award";
import { replayRatings } from "@/domain/rating-replay";

async function awardLeaderForMonth(awardMonth: string) {
  const eligiblePlayers = (await db.select().from(users).all()).filter((player) =>
    brusselsMonth(player.createdAt) < awardMonth &&
    (!player.retiredAt || brusselsMonth(player.retiredAt) >= awardMonth),
  );
  if (eligiblePlayers.length === 0) return null;

  const eligibleIds = new Set(eligiblePlayers.map((player) => player.id));
  const historicalGames = (await db.select().from(games)
    .where(and(lt(games.playedOn, `${awardMonth}-01`), isNull(games.deletedAt)))
    .all())
    .filter((game) => eligibleIds.has(game.playerOneId) && eligibleIds.has(game.playerTwoId));
  const names = new Map(eligiblePlayers.map((player) => [player.id, player.displayName]));
  const replay = replayRatings(
    eligiblePlayers.map((player) => ({ id: player.id, initialRating: player.initialRating })),
    historicalGames.map((game) => ({
      id: game.id,
      playerOneId: game.playerOneId,
      playerTwoId: game.playerTwoId,
      result: game.result,
      playedOn: game.playedOn,
      sequence: game.sequence,
      playerOneName: names.get(game.playerOneId) ?? "",
    })),
  );
  return [...eligiblePlayers].sort((a, b) =>
    (replay.ratings.get(b.id) ?? b.initialRating) - (replay.ratings.get(a.id) ?? a.initialRating) ||
    a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" }),
  )[0];
}

export async function ensureMonthlyAwards(now = new Date()): Promise<void> {
  const currentMonth = brusselsMonth(now);
  const latest = await db.select().from(monthlyAwards).orderBy(desc(monthlyAwards.awardMonth)).limit(1).get();
  for (const awardMonth of monthsAfter(latest?.awardMonth ?? null, currentMonth)) {
    if (await db.select({ id: monthlyAwards.id }).from(monthlyAwards).where(eq(monthlyAwards.awardMonth, awardMonth)).get()) continue;
    const winner = await awardLeaderForMonth(awardMonth);
    if (!winner) continue;
    const previous = await db.select().from(monthlyAwards).where(eq(monthlyAwards.awardMonth, previousMonth(awardMonth))).get();
    const streak = previous?.userId === winner.id ? previous.streak + 1 : 1;
    await db.insert(monthlyAwards).values({
      awardMonth,
      userId: winner.id,
      streak,
      level: awardLevelForStreak(streak),
    }).onConflictDoNothing().run();
  }
}

export async function awardsByPlayer(): Promise<Map<number, Array<"bronze" | "silver" | "gold">>> {
  const awards = await db.select().from(monthlyAwards).orderBy(asc(monthlyAwards.awardMonth)).all();
  const grouped = new Map<number, Array<"bronze" | "silver" | "gold">>();
  for (const award of awards) grouped.set(award.userId, [...(grouped.get(award.userId) ?? []), award.level]);
  return grouped;
}
