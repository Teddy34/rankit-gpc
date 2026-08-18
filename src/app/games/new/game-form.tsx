"use client";

import { useActionState, useState } from "react";
import { registerGame, type GameFormState } from "./actions";

type Player = { id: number; displayName: string; avatar: string; currentRating: number };

export function GameForm({ players, today }: { players: Player[]; today: string }) {
  const [state, action, pending] = useActionState(registerGame, {} as GameFormState);
  const [playerOneId, setPlayerOneId] = useState(String(players[0]?.id ?? ""));
  const availableOpponents = players.filter((player) => String(player.id) !== playerOneId);
  return (
    <form action={action} className="game-form">
      <div className="form-grid">
        <label>Player one<select name="playerOneId" value={playerOneId} onChange={(event) => setPlayerOneId(event.target.value)} required>
          {players.map((player) => <option key={player.id} value={player.id}>{player.avatar} {player.displayName} · {player.currentRating}</option>)}
        </select></label>
        <span className="versus">VS</span>
        <label>Player two<select name="playerTwoId" key={playerOneId} defaultValue={availableOpponents[0]?.id} required>
          {availableOpponents.map((player) => <option key={player.id} value={player.id}>{player.avatar} {player.displayName} · {player.currentRating}</option>)}
        </select></label>
      </div>
      <fieldset><legend>Result</legend><div className="result-picker">
        <label><input type="radio" name="result" value="player_one" defaultChecked /><span>Player one wins</span></label>
        <label><input type="radio" name="result" value="draw" /><span>Draw</span></label>
        <label><input type="radio" name="result" value="player_two" /><span>Player two wins</span></label>
      </div></fieldset>
      <label>Game date<input name="playedOn" type="date" max={today} defaultValue={today} required /></label>
      {state.message && <p className="form-error" role="alert">{state.message}</p>}
      <button className="button" disabled={pending || players.length < 2}>{pending ? "Registering…" : "Register game"}</button>
    </form>
  );
}
