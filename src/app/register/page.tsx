import { redirect } from "next/navigation";
import { RegistrationForm } from "./registration-form";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) redirect("/login");
  return <main className="auth-shell"><section className="auth-card wide"><p className="eyebrow">One last thing</p><h1>Create your player</h1><p>Your starting ELO is recorded once and becomes the baseline for future games.</p><RegistrationForm token={token} /></section></main>;
}
