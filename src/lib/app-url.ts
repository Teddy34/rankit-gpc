/**
 * The absolute base URL to build links (magic links, email-change confirmations) against.
 *
 * `APP_URL` should be scoped to the Production environment only in Vercel's project settings —
 * left unset for Preview, this falls back to `VERCEL_URL` (Vercel's own deployment URL, exposed
 * automatically once "Enable access to System Environment Variables" is on for the project) so
 * every preview deployment gets working links without per-branch configuration.
 */
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
