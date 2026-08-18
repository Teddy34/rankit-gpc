import { asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { allowedDomains, auditLog, users } from "@/db/schema";
import { configuredAllowedDomains } from "@/lib/allowed-domains";
import { requireUser } from "@/lib/auth";
import { DomainWhitelist } from "./domain-whitelist";
import { AuditLog } from "./audit-log";
import { EmailForm, ProfileForm } from "./settings-forms";

const emailErrors: Record<string, string> = {
  invalid: "That email confirmation link is invalid.",
  expired: "That email confirmation link has expired. Request another one below.",
  unavailable: "That email address is no longer available or allowed.",
};

const AUDIT_PAGE_SIZE = 25;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ emailChanged?: string; emailError?: string; auditPage?: string }> }) {
  const user = await requireUser();
  const lockedDomains = [...configuredAllowedDomains()].sort();
  const removableDomains = user.isAdmin
    ? db.select({ id: allowedDomains.id, domain: allowedDomains.domain }).from(allowedDomains).orderBy(asc(allowedDomains.domain)).all()
      .filter((domain) => !lockedDomains.includes(domain.domain))
    : [];
  const { emailChanged, emailError, auditPage } = await searchParams;
  const requestedPage = Number(auditPage ?? "1");
  const [{ auditCount }] = user.isAdmin ? db.select({ auditCount: count() }).from(auditLog).all() : [{ auditCount: 0 }];
  const totalAuditPages = Math.max(1, Math.ceil(auditCount / AUDIT_PAGE_SIZE));
  const currentAuditPage = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalAuditPages) : 1;
  const auditEntries = user.isAdmin ? db.select({
    id: auditLog.id,
    actorName: users.displayName,
    action: auditLog.action,
    entityType: auditLog.entityType,
    entityId: auditLog.entityId,
    details: auditLog.details,
    createdAt: auditLog.createdAt,
  }).from(auditLog).innerJoin(users, eq(auditLog.actorId, users.id))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(AUDIT_PAGE_SIZE).offset((currentAuditPage - 1) * AUDIT_PAGE_SIZE).all() : [];
  return <main><section className="page-heading"><p className="eyebrow">Your player</p><h1>Settings</h1><p>Keep your profile recognizable around the table.</p></section>
    {emailChanged && <div className="notice success"><strong>Email updated</strong><span>Use the new address the next time you sign in.</span></div>}
    {emailError && <div className="notice error"><strong>Email not updated</strong><span>{emailErrors[emailError] ?? "The confirmation could not be completed."}</span></div>}
    <div className="settings-grid"><section className="panel settings-card"><div className="panel-heading"><h2>Profile</h2></div><ProfileForm user={user} /></section>
      <section className="panel settings-card"><div className="panel-heading"><h2>Email</h2></div><EmailForm email={user.email} /></section></div>
    {user.isAdmin && <DomainWhitelist domains={removableDomains} lockedDomains={lockedDomains} />}
    {user.isAdmin && <AuditLog entries={auditEntries} page={currentAuditPage} totalPages={totalAuditPages} />}
  </main>;
}
