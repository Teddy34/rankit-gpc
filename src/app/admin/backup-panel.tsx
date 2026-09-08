"use client";

import { useActionState, useEffect, useRef } from "react";
import { restoreBackupAction, type RestoreState } from "./backup-actions";

const initialState: RestoreState = {};

function downloadSafetyBackup(safetyBackup: NonNullable<RestoreState["safetyBackup"]>) {
  const binary = atob(safetyBackup.gzipBase64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/gzip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safetyBackup.filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function BackupPanel() {
  const [state, action, pending] = useActionState(restoreBackupAction, initialState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const downloadedFor = useRef<RestoreState["safetyBackup"]>(undefined);

  useEffect(() => {
    if (state.safetyBackup && state.safetyBackup !== downloadedFor.current) {
      downloadSafetyBackup(state.safetyBackup);
      downloadedFor.current = state.safetyBackup;
    }
    if (state.status === "success" && fileInputRef.current) fileInputRef.current.value = "";
  }, [state]);

  return <section className="panel backup-settings" aria-labelledby="backup-title">
    <div className="panel-heading"><div><p className="eyebrow">Administration</p><h2 id="backup-title">Backups</h2></div></div>
    <div className="backup-downloads">
      <a className="button secondary" href="/api/admin/backup">Download backup (JSON)</a>
      <a className="button secondary" href="/api/admin/backup?format=gzip">Download backup (gzip)</a>
    </div>
    <form action={action} className="backup-restore-form">
      <label htmlFor="backupFile">Restore from a backup file (JSON or gzip)</label>
      <input ref={fileInputRef} id="backupFile" name="backupFile" type="file" accept="application/json,.json,.gz" required />
      <label htmlFor="confirmationPhrase">Type RESTORE to confirm — this replaces all players, games, rating resets, awards, allowed domains, and the audit log, and signs everyone out</label>
      <input id="confirmationPhrase" name="confirmationPhrase" placeholder="RESTORE" autoComplete="off" required />
      <button className="button danger" disabled={pending}>{pending ? "Restoring…" : "Restore"}</button>
      {state.message && <p className={state.status === "error" ? "form-error" : "form-success"} role="status" style={{ whiteSpace: "pre-line" }}>{state.message}</p>}
      {state.safetyBackup && <p className="form-success">A safety copy of the data just replaced was downloaded automatically ({state.safetyBackup.filename}).</p>}
    </form>
  </section>;
}
