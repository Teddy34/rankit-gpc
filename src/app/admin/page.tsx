import { redirect } from "next/navigation";
import { asc, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { allowedDomains, auditLog, users } from "@/db/schema";
import { configuredAllowedDomains } from "@/lib/allowed-domains";
import { requireUser } from "@/lib/auth";
import { PlayerAdminControls } from "../player-admin-controls";
import { AdminConsole } from "../admin-console";
import { PlayerIcon } from "../player-icon";
import { DomainWhitelist } from "./domain-whitelist";
import { AuditLog } from "./audit-log";

const AUDIT_PAGE_SIZE = 25;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ auditPage?: string }> }) {
  const currentUser = await requireUser();
  if (!currentUser.isAdmin) redirect("/");
  const allPlayers = await db.select().from(users).where(isNull(users.deletedAt)).orderBy(asc(users.displayName)).all();

  const lockedDomains = [...configuredAllowedDomains()].sort();
  const removableDomains = (await db.select({ id: allowedDomains.id, domain: allowedDomains.domain }).from(allowedDomains).orderBy(asc(allowedDomains.domain)).all())
    .filter((domain) => !lockedDomains.includes(domain.domain));

  const { auditPage } = await searchParams;
  const requestedPage = Number(auditPage ?? "1");
  const [{ auditCount }] = await db.select({ auditCount: count() }).from(auditLog).all();
  const totalAuditPages = Math.max(1, Math.ceil(auditCount / AUDIT_PAGE_SIZE));
  const currentAuditPage = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalAuditPages) : 1;
  const auditEntries = await db.select({
    id: auditLog.id,
    actorName: users.displayName,
    action: auditLog.action,
    entityType: auditLog.entityType,
    entityId: auditLog.entityId,
    details: auditLog.details,
    createdAt: auditLog.createdAt,
  }).from(auditLog).innerJoin(users, eq(auditLog.actorId, users.id))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(AUDIT_PAGE_SIZE).offset((currentAuditPage - 1) * AUDIT_PAGE_SIZE).all();

  return (
    <main>
      <section className="page-heading">
        <p className="eyebrow">Behind the scenes</p>
        <h1>Administration</h1>
        <p>Manage player accounts and run admin console commands.</p>
      </section>

      <AdminConsole />

      <section className="panel player-management" aria-labelledby="player-management-title">
        <div className="panel-heading"><div><p className="eyebrow">Administration</p><h2 id="player-management-title">Player management</h2></div><span>{allPlayers.length} accounts</span></div>
        <div className="management-list">
          {allPlayers.map((player) => <article key={player.id}>
            <PlayerIcon player={player} className="avatar" />
            <span className="player"><strong>{player.displayName}{player.id === currentUser.id ? " (you)" : ""}</strong><small>{player.retiredAt ? "Retired" : "Active"}{player.isAdmin ? " · Administrator" : ""}</small></span>
            {player.id === currentUser.id ? <span className="self-label">Managed by another admin</span> : <PlayerAdminControls player={{ id: player.id, displayName: player.displayName, isAdmin: player.isAdmin, retired: Boolean(player.retiredAt) }} />}
          </article>)}
        </div>
      </section>

      <DomainWhitelist domains={removableDomains} lockedDomains={lockedDomains} />
      <AuditLog entries={auditEntries} page={currentAuditPage} totalPages={totalAuditPages} />
    </main>
  );
}
