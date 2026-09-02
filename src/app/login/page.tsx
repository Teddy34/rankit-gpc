import { redirect } from "next/navigation";
import { getCurrentUser, getRememberedLoginEmail } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const defaultEmail = await getRememberedLoginEmail();
  return <main className="auth-shell"><section className="auth-card"><span className="avatar auth-avatar">🎱</span><p className="eyebrow">Welcome to the ladder</p><h1>Sign in</h1><p>No password required. We’ll send a secure link to your work email.</p><LoginForm defaultEmail={defaultEmail} /></section></main>;
}
