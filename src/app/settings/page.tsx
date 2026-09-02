import { requireUser } from "@/lib/auth";
import { EmailForm, ProfileForm } from "./settings-forms";

const emailErrors: Record<string, string> = {
  invalid: "That email confirmation link is invalid.",
  expired: "That email confirmation link has expired. Request another one below.",
  unavailable: "That email address is no longer available or allowed.",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ emailChanged?: string; emailError?: string }> }) {
  const user = await requireUser();
  const { emailChanged, emailError } = await searchParams;
  return <main><section className="page-heading"><p className="eyebrow">Your player</p><h1>Settings</h1><p>Keep your profile recognizable around the table.</p></section>
    {emailChanged && <div className="notice success"><strong>Email updated</strong><span>Use the new address the next time you sign in.</span></div>}
    {emailError && <div className="notice error"><strong>Email not updated</strong><span>{emailErrors[emailError] ?? "The confirmation could not be completed."}</span></div>}
    <div className="settings-grid"><section className="panel settings-card"><div className="panel-heading"><h2>Profile</h2></div><ProfileForm user={user} /></section>
      <section className="panel settings-card"><div className="panel-heading"><h2>Email</h2></div><EmailForm email={user.email} /></section></div>
  </main>;
}
