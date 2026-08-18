"use client";

import { useActionState } from "react";
import { requestMagicLink, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(requestMagicLink, initialState);
  if (state.status === "sent") {
    return <div className="notice success"><strong>Check your inbox</strong><span>If the address is allowed, your sign-in link is on its way.</span></div>;
  }
  return (
    <form action={action} className="auth-form">
      <label htmlFor="email">Work email</label>
      <input id="email" name="email" type="email" autoComplete="email" required autoFocus placeholder="you@company.com" />
      {state.message && <p className="form-error" role="alert">{state.message}</p>}
      <button className="button" disabled={pending}>{pending ? "Sending…" : "Email me a sign-in link"}</button>
    </form>
  );
}
