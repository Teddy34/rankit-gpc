import Link from "next/link";
import { desc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import { games, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { DeleteGameButton } from "./delete-game-button";

export default async function GamesPage({ searchParams }: { searchParams: Promise<{ registered?: string; deleted?: string }> }) {
  const currentUser = await requireUser();
  const one = alias(users, "player_one");
  const two = alias(users, "player_two");
  const history = db.select({ game: games, one, two }).from(games)
    .innerJoin(one, eq(games.playerOneId, one.id)).innerJoin(two, eq(games.playerTwoId, two.id))
    .where(isNull(games.deletedAt)).orderBy(desc(games.playedOn), desc(games.sequence)).all();
  const { registered, deleted } = await searchParams;
  return <main>
    <section className="hero"><div><p className="eyebrow">Match archive</p><h1>Game history</h1><p>Every break, comeback, and rating swing.</p></div><Link className="button" href="/games/new">+ Register a game</Link></section>
    {registered && <div className="notice success"><strong>Game registered</strong><span>The ranking has been recalculated.</span></div>}
    {deleted && <div className="notice success"><strong>Game deleted</strong><span>The ranking and weekly trends have been recalculated.</span></div>}
    <section className="panel game-list"><div className="panel-heading"><h2>Results</h2><span>{history.length} games</span></div>
      {history.length === 0 ? <p className="empty-state">No games yet. Time to claim the table.</p> : history.map(({ game, one, two }) => <article className={currentUser.isAdmin ? "has-actions" : undefined} key={game.id}>
        <time dateTime={game.playedOn}>{game.playedOn}</time>
        <span className={game.result === "player_one" ? "winner" : ""}>{one.avatar} <strong>{one.displayName}</strong> <em>{game.playerOneDelta > 0 ? "+" : ""}{game.playerOneDelta}</em></span>
        <b>{game.result === "draw" ? "DRAW" : "VS"}</b>
        <span className={game.result === "player_two" ? "winner" : ""}>{two.avatar} <strong>{two.displayName}</strong> <em>{game.playerTwoDelta > 0 ? "+" : ""}{game.playerTwoDelta}</em></span>
        {currentUser.isAdmin && <DeleteGameButton gameId={game.id} label={`${one.displayName} vs ${two.displayName} on ${game.playedOn}`} />}
      </article>)}
    </section>
  </main>;
}
