import { redirect } from "next/navigation";
import { asc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { PlayerAdminControls } from "../player-admin-controls";
import { AdminConsole } from "../admin-console";

export default async function AdminPage() {
  const currentUser = await requireUser();
  if (!currentUser.isAdmin) redirect("/");
  const allPlayers = await db.select().from(users).where(isNull(users.deletedAt)).orderBy(asc(users.displayName)).all();

  return (
    <main>
      <section className="page-heading">
        <p className="eyebrow">Behind the scenes</p>
        <h1>Administration</h1>
        <p>Manage player accounts and run admin console commands.</p>
      </section>

      <section className="panel player-management" aria-labelledby="player-management-title">
        <div className="panel-heading"><div><p className="eyebrow">Administration</p><h2 id="player-management-title">Player management</h2></div><span>{allPlayers.length} accounts</span></div>
        <div className="management-list">
          {allPlayers.map((player) => <article key={player.id}>
            <span className="avatar" aria-hidden="true">{player.avatar}</span>
            <span className="player"><strong>{player.displayName}{player.id === currentUser.id ? " (you)" : ""}</strong><small>{player.retiredAt ? "Retired" : "Active"}{player.isAdmin ? " · Administrator" : ""}</small></span>
            {player.id === currentUser.id ? <span className="self-label">Managed by another admin</span> : <PlayerAdminControls player={{ id: player.id, displayName: player.displayName, isAdmin: player.isAdmin, retired: Boolean(player.retiredAt) }} />}
          </article>)}
        </div>
      </section>
      <AdminConsole />
    </main>
  );
}
