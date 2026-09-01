import { asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { games, ratingResets, users } from "@/db/schema";
import { buildRatingHistory } from "@/domain/rating-history";
import { requireUser } from "@/lib/auth";
import { RatingHistoryChart } from "./rating-history-chart";

export default async function HistoryPage() {
  await requireUser();
  const allPlayers = await db.select().from(users).orderBy(asc(users.displayName)).all();
  const activeGames = await db.select({
    id: games.id,
    playerOneId: games.playerOneId,
    playerTwoId: games.playerTwoId,
    result: games.result,
    playedOn: games.playedOn,
    playerOneName: users.displayName,
    sequence: games.sequence,
  }).from(games).innerJoin(users, eq(games.playerOneId, users.id)).where(isNull(games.deletedAt)).all();
  const activeResets = await db.select({
    id: ratingResets.id,
    userId: ratingResets.userId,
    rating: ratingResets.rating,
    effectiveOn: ratingResets.effectiveOn,
    sequence: ratingResets.sequence,
  }).from(ratingResets).where(isNull(ratingResets.deletedAt)).all();
  const history = buildRatingHistory(allPlayers.map((player) => ({
    id: player.id,
    displayName: player.displayName,
    avatar: player.avatar,
    initialRating: player.initialRating,
    retired: Boolean(player.retiredAt),
  })), activeGames, activeResets);
  const orderedEvents = [
    ...activeGames.map((game) => ({ date: game.playedOn, sortKey: game.playedOn, name: game.playerOneName, sequence: game.sequence })),
    ...activeResets.map((reset) => ({ date: reset.effectiveOn, sortKey: reset.effectiveOn, name: "", sequence: reset.sequence })),
  ].sort((a, b) =>
    a.sortKey.localeCompare(b.sortKey) ||
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
    a.sequence - b.sequence,
  );

  return <main>
    <section className="page-heading"><p className="eyebrow">Ladder over time</p><h1>Ranking history</h1><p>Follow every player’s Elo journey, game by game.</p></section>
    <RatingHistoryChart players={history} eventDates={orderedEvents.map((event) => event.date)} />
  </main>;
}
