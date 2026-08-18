"use client";

import { useActionState } from "react";
import { deleteGame, type DeleteGameState } from "./actions";

export function DeleteGameButton({ gameId, label }: { gameId: number; label: string }) {
  const [state, action, pending] = useActionState(deleteGame, {} as DeleteGameState);
  return <form
    action={action}
    className="delete-game-form"
    onSubmit={(event) => {
      if (!window.confirm(`Delete ${label}? Ratings will be recalculated.`)) event.preventDefault();
    }}
  >
    <input type="hidden" name="gameId" value={gameId} />
    <button type="submit" disabled={pending}>{pending ? "Deleting…" : "Delete"}</button>
    {state.message && <small role="alert">{state.message}</small>}
  </form>;
}
