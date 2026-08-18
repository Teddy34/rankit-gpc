"use client";

import { useActionState } from "react";
import { updatePlayerAdministration, type PlayerAdminState } from "./player-admin-actions";

type AdminAction = "retire" | "unretire" | "make_admin" | "remove_admin";

function AdminActionButton({ playerId, action, label, confirmText, danger = false }: {
  playerId: number;
  action: AdminAction;
  label: string;
  confirmText: string;
  danger?: boolean;
}) {
  const [state, formAction, pending] = useActionState(updatePlayerAdministration, {} as PlayerAdminState);
  return <form action={formAction} onSubmit={(event) => { if (!window.confirm(confirmText)) event.preventDefault(); }}>
    <input type="hidden" name="playerId" value={playerId} />
    <input type="hidden" name="action" value={action} />
    <button className={danger ? "admin-action danger" : "admin-action"} disabled={pending}>{pending ? "…" : label}</button>
    {state.message && state.status === "error" && <small role="alert">{state.message}</small>}
  </form>;
}

export function PlayerAdminControls({ player }: { player: { id: number; displayName: string; isAdmin: boolean; retired: boolean } }) {
  return <div className="player-admin-controls">
    <AdminActionButton
      playerId={player.id}
      action={player.retired ? "unretire" : "retire"}
      label={player.retired ? "Unretire" : "Retire"}
      danger={!player.retired}
      confirmText={`${player.retired ? "Unretire" : "Retire"} ${player.displayName}?`}
    />
    <AdminActionButton
      playerId={player.id}
      action={player.isAdmin ? "remove_admin" : "make_admin"}
      label={player.isAdmin ? "Remove admin" : "Make admin"}
      danger={player.isAdmin}
      confirmText={`${player.isAdmin ? "Remove administrator rights from" : "Make administrator"} ${player.displayName}?`}
    />
  </div>;
}
