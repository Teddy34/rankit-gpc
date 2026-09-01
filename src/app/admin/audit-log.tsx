import Link from "next/link";

export type AuditLogEntry = {
  id: number;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown> | null;
  createdAt: Date;
};

const actionLabels: Record<string, string> = {
  "game.deleted": "Deleted a game",
  "player.retired": "Retired a player",
  "player.unretired": "Unretired a player",
  "player.deleted": "Deleted a player",
  "player.elo_reset": "Reset a player's Elo",
  "administrator.granted": "Granted administrator rights",
  "administrator.revoked": "Revoked administrator rights",
  "domain.allowed": "Allowed an email domain",
  "domain.removed": "Removed an email domain",
};

function displayDetails(details: Record<string, unknown> | null): string[] {
  if (!details) return [];
  return Object.entries(details).map(([key, value]) => {
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase());
    return `${label}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`;
  });
}

export function AuditLog({ entries, page, totalPages }: { entries: AuditLogEntry[]; page: number; totalPages: number }) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return <section className="panel audit-log" id="audit-log">
    <div className="panel-heading"><div><p className="eyebrow">Administration</p><h2>Action log</h2></div><span>Page {page} of {totalPages}</span></div>
    {entries.length === 0 ? <p className="empty-state">No administrative actions recorded yet.</p> : <div className="audit-list">
      {entries.map((entry) => {
        const details = displayDetails(entry.details);
        return <article key={entry.id}>
          <span className="audit-icon" aria-hidden="true">⚙</span>
          <div><strong>{entry.actorName}</strong> <span>{actionLabels[entry.action] ?? entry.action}</span>
            <small>{entry.entityType} #{entry.entityId} · <time dateTime={entry.createdAt.toISOString()}>{formatter.format(entry.createdAt)}</time></small>
            {details.length > 0 && <details><summary>Details</summary><ul>{details.map((detail) => <li key={detail}>{detail}</li>)}</ul></details>}
          </div>
        </article>;
      })}
    </div>}
    {totalPages > 1 && <nav className="audit-pagination" aria-label="Audit log pagination">
      {page > 1 ? <Link href={`/admin?auditPage=${page - 1}#audit-log`}>← Newer</Link> : <span />}
      {page < totalPages && <Link href={`/admin?auditPage=${page + 1}#audit-log`}>Older →</Link>}
    </nav>}
  </section>;
}
