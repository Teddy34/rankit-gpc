import "server-only";

interface MagicLinkEmail {
  to: string;
  url: string;
}

interface EmailChangeEmail {
  to: string;
  url: string;
}

async function sendEmail(to: string, subject: string, text: string, developmentLabel: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(`\n[dev email] ${developmentLabel} for ${to}:\n${text}\n`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const providerMessage = await response.text().catch(() => "");
    throw new Error(`Email provider returned ${response.status}${providerMessage ? `: ${providerMessage}` : ""}`);
  }
}

export async function sendMagicLinkEmail({ to, url }: MagicLinkEmail): Promise<void> {
  await sendEmail(to, "Your GeoPostcodes Ranking sign-in link", `Sign in to GeoPostcodes Ranking:\n\n${url}\n\nThis link expires in 24 hours.`, "Magic link");
}

export async function sendEmailChangeEmail({ to, url }: EmailChangeEmail): Promise<void> {
  await sendEmail(to, "Confirm your new email address", `Confirm this email address for GeoPostcodes Ranking:\n\n${url}\n\nThis link expires in 24 hours. If you did not request this change, ignore this email.`, "Email-change link");
}
