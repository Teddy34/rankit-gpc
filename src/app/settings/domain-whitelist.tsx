"use client";

import { useActionState } from "react";
import { addAllowedDomain, removeAllowedDomain, type SettingsState } from "./actions";

type Domain = { id: number; domain: string };
const initialState: SettingsState = {};

function RemoveDomainButton({ domain }: { domain: Domain }) {
  const [state, action, pending] = useActionState(removeAllowedDomain, initialState);
  return <form action={action} onSubmit={(event) => { if (!window.confirm(`Stop allowing registrations from ${domain.domain}?`)) event.preventDefault(); }}>
    <input type="hidden" name="domainId" value={domain.id} />
    <button className="domain-remove" disabled={pending}>{pending ? "Removing…" : "Remove"}</button>
    {state.message && state.status === "error" && <small className="form-error" role="alert">{state.message}</small>}
  </form>;
}

export function DomainWhitelist({ domains, lockedDomains }: { domains: Domain[]; lockedDomains: string[] }) {
  const [state, action, pending] = useActionState(addAllowedDomain, initialState);
  return <section className="panel domain-settings">
    <div className="panel-heading"><div><p className="eyebrow">Administration</p><h2>Allowed email domains</h2></div><span>{domains.length + lockedDomains.length} domains</span></div>
    <div className="domain-list">
      {lockedDomains.map((domain) => <div key={domain}><strong>{domain}</strong><span className="locked-domain">{domain === "geopostcodes.com" ? "Required" : "Configured"}</span></div>)}
      {domains.map((domain) => <div key={domain.id}><strong>{domain.domain}</strong><RemoveDomainButton domain={domain} /></div>)}
    </div>
    <form action={action} className="domain-add-form">
      <label htmlFor="domain">Add a domain</label>
      <div><input id="domain" name="domain" placeholder="example.com" required /><button className="button" disabled={pending}>{pending ? "Adding…" : "Add domain"}</button></div>
      {state.message && <p className={state.status === "error" ? "form-error" : "form-success"} role="status">{state.message}</p>}
    </form>
  </section>;
}
