import { asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { games, users } from "@/db/schema";
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
  const history = buildRatingHistory(allPlayers.map((player) => ({
    id: player.id,
    displayName: player.displayName,
    avatar: player.avatar,
    initialRating: player.initialRating,
    retired: Boolean(player.retiredAt),
  })), activeGames);
  const orderedGames = [...activeGames].sort((a, b) =>
    a.playedOn.localeCompare(b.playedOn) ||
    a.playerOneName.localeCompare(b.playerOneName, "en", { sensitivity: "base" }) ||
    a.sequence - b.sequence,
  );

  return <main>
    <section className="page-heading"><p className="eyebrow">Ladder over time</p><h1>Ranking history</h1><p>Follow every player’s Elo journey, game by game.</p></section>
    <RatingHistoryChart players={history} gameDates={orderedGames.map((game) => game.playedOn)} />
  </main>;
}
