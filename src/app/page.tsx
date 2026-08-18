import Link from "next/link";
import { asc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { games, users } from "@/db/schema";
import { brusselsWeekStart, calculateWeeklyTrends } from "@/domain/weekly-trend";
import { calculateWinningStreaks } from "@/domain/winning-streak";
import { requireUser } from "@/lib/auth";
import { awardsByPlayer, ensureMonthlyAwards } from "@/lib/monthly-awards";
import { PlayerAdminControls } from "./player-admin-controls";

export default async function RankingPage() {
  const currentUser = await requireUser();
  ensureMonthlyAwards();
  const playerAwards = awardsByPlayer();
  const allPlayers = db.select().from(users).orderBy(asc(users.displayName)).all();
  const rankedPlayers = allPlayers.filter((player) => !player.retiredAt)
    .sort((a, b) => b.currentRating - a.currentRating || a.displayName.localeCompare(b.displayName));
  const activeGames = db.select({
    playedOn: games.playedOn,
    playerOneId: games.playerOneId,
    playerTwoId: games.playerTwoId,
    result: games.result,
    sequence: games.sequence,
    playerOneDelta: games.playerOneDelta,
    playerTwoDelta: games.playerTwoDelta,
  }).from(games).where(isNull(games.deletedAt)).all();
  const weekStart = brusselsWeekStart();
  const weeklyTrends = calculateWeeklyTrends(activeGames, weekStart);
  const winningStreaks = calculateWinningStreaks(activeGames);
  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">Current ladder</p>
          <h1>Who owns the table?</h1>
          <p>Every game counts. Register a result and watch the ladder move.</p>
        </div>
        <Link className="button" href="/games/new">+ Register a game</Link>
      </section>

      <section className="panel" aria-labelledby="ranking-title">
        <div className="panel-heading">
          <h2 id="ranking-title">Ranking</h2>
          <span>This week</span>
        </div>
        <ol className="ranking-list">
          {rankedPlayers.map((player, index) => {
            const trend = weeklyTrends.get(player.id) ?? 0;
            const winningStreak = winningStreaks.get(player.id) ?? 0;
            return (
            <li key={player.id}>
              <strong className="rank">{index + 1}</strong>
              <span className="avatar" aria-hidden="true">{player.avatar}</span>
              <span className="player"><strong>{player.displayName}{player.isAdmin && <span className="admin-badge" role="img" aria-label="Administrator" title="Administrator">👮</span>}{winningStreak >= 3 && <span className="fire-badge" role="img" aria-label={`${winningStreak}-game winning streak`} title={`${winningStreak}-game winning streak`}>🔥</span>}</strong><small>{player.retiredAt ? "Retired" : "Active player"}</small>{(playerAwards.get(player.id)?.length ?? 0) > 0 && <span className="award-badges" aria-label={`Monthly awards: ${playerAwards.get(player.id)!.join(", ")}`}>{playerAwards.get(player.id)!.map((award, awardIndex) => <span aria-hidden="true" title={`${award[0].toUpperCase()}${award.slice(1)} monthly award`} key={`${award}-${awardIndex}`}>{award === "bronze" ? "🥉" : award === "silver" ? "🥈" : "🥇"}</span>)}</span>}</span>
              <strong className="rating">{player.currentRating}</strong>
              <span className="trend">{trend > 0 ? "+" : ""}{trend}</span>
            </li>
          );})}
        </ol>
      </section>

      {currentUser.isAdmin && <section className="panel player-management" aria-labelledby="player-management-title">
        <div className="panel-heading"><div><p className="eyebrow">Administration</p><h2 id="player-management-title">Player management</h2></div><span>{allPlayers.length} accounts</span></div>
        <div className="management-list">
          {allPlayers.map((player) => <article key={player.id}>
            <span className="avatar" aria-hidden="true">{player.avatar}</span>
            <span className="player"><strong>{player.displayName}{player.id === currentUser.id ? " (you)" : ""}</strong><small>{player.retiredAt ? "Retired" : "Active"}{player.isAdmin ? " · Administrator" : ""}</small></span>
            {player.id === currentUser.id ? <span className="self-label">Managed by another admin</span> : <PlayerAdminControls player={{ id: player.id, displayName: player.displayName, isAdmin: player.isAdmin, retired: Boolean(player.retiredAt) }} />}
          </article>)}
        </div>
      </section>}
    </main>
  );
}
