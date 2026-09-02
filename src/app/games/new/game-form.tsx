"use client";

import { useActionState, useState } from "react";
import { registerGame, type GameFormState } from "./actions";
import { PlayerIcon } from "../../player-icon";

type Player = { id: number; displayName: string; avatar: string; avatarImageUrl: string | null; currentRating: number };

export function GameForm({ players, today, defaultPlayerOneId }: { players: Player[]; today: string; defaultPlayerOneId?: number }) {
  const [state, action, pending] = useActionState(registerGame, {} as GameFormState);
  const initialPlayerOneId = players.some((player) => player.id === defaultPlayerOneId) ? defaultPlayerOneId : players[0]?.id;
  const [playerOneId, setPlayerOneId] = useState(String(initialPlayerOneId ?? ""));
  const availableOpponents = players.filter((player) => String(player.id) !== playerOneId);
  return (
    <form action={action} className="game-form">
      <div className="form-grid">
        <fieldset><legend>Player one</legend><div className="player-picker">
          {players.map((player) => <label key={player.id}>
            <input
              type="radio"
              name="playerOneId"
              value={player.id}
              checked={String(player.id) === playerOneId}
              onChange={(event) => setPlayerOneId(event.target.value)}
              required
            />
            <span><PlayerIcon player={player} className="avatar-inline" /> {player.displayName} · {player.currentRating}</span>
          </label>)}
        </div></fieldset>
        <span className="versus">VS</span>
        <fieldset key={playerOneId}><legend>Player two</legend><div className="player-picker">
          {availableOpponents.map((player, index) => <label key={player.id}>
            <input type="radio" name="playerTwoId" value={player.id} defaultChecked={index === 0} required />
            <span><PlayerIcon player={player} className="avatar-inline" /> {player.displayName} · {player.currentRating}</span>
          </label>)}
        </div></fieldset>
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
