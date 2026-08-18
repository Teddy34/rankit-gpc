import Link from "next/link";
import { asc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { GameForm } from "./game-form";

function todayInBrussels() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default async function NewGamePage() {
  await requireUser();
  const players = db.select({ id: users.id, displayName: users.displayName, avatar: users.avatar, currentRating: users.currentRating })
    .from(users).where(isNull(users.retiredAt)).orderBy(asc(users.displayName)).all();
  return <main><Link className="back-link" href="/games">← Game history</Link><section className="page-heading"><p className="eyebrow">Rack ’em up</p><h1>Register a game</h1><p>Choose the players, result, and date. Ratings update immediately.</p></section>
    {players.length < 2 ? <div className="notice">At least two active players are needed to register a game.</div> : <GameForm players={players} today={todayInBrussels()} />}
  </main>;
}
