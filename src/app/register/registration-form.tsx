"use client";

import { useActionState } from "react";
import { profileAvatars } from "@/domain/profile";
import { register, type RegistrationState } from "./actions";

export function RegistrationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(register, {} as RegistrationState);
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="token" value={token} />
      <label htmlFor="displayName">Display name</label>
      <input id="displayName" name="displayName" minLength={2} maxLength={40} required autoFocus />
      <fieldset><legend>Pick your player</legend><div className="avatar-picker">
        {profileAvatars.map((avatar, index) => <label key={avatar}><input type="radio" name="avatar" value={avatar} defaultChecked={index === 0} /><span>{avatar}</span></label>)}
      </div></fieldset>
      <label htmlFor="initialRating">What is your current ELO on rankit.io?</label>
      <input id="initialRating" name="initialRating" type="number" min={1000} max={2000} step={1} defaultValue={1500} required />
      <small>Use 1500 if you don’t know your current rating.</small>
      {state.message && <p className="form-error" role="alert">{state.message}</p>}
      <button className="button" disabled={pending}>{pending ? "Joining…" : "Join the ladder"}</button>
    </form>
  );
}
