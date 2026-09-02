import Link from "next/link";
import { and, asc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { todayInBrussels } from "@/lib/dates";
import { requireUser } from "@/lib/auth";
import { GameForm } from "./game-form";

export default async function NewGamePage() {
  const actor = await requireUser();
  const players = await db.select({ id: users.id, displayName: users.displayName, avatar: users.avatar, avatarImageUrl: users.avatarImageUrl, currentRating: users.currentRating })
    .from(users).where(and(isNull(users.retiredAt), isNull(users.deletedAt))).orderBy(asc(users.displayName)).all();
  return <main><Link className="back-link" href="/games">← Game history</Link><section className="page-heading"><p className="eyebrow">Rack ’em up</p><h1>Register a game</h1><p>Choose the players, result, and date. Ratings update immediately.</p></section>
    {players.length < 2 ? <div className="notice">At least two active players are needed to register a game.</div> : <GameForm players={players} today={todayInBrussels()} defaultPlayerOneId={actor.id} />}
  </main>;
}
