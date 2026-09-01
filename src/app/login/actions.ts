"use server";

import { and, count, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { magicLinks, users } from "@/db/schema";
import { isDomainAllowed } from "@/lib/allowed-domains";
import { appUrl } from "@/lib/app-url";
import { createToken, hashToken, normalizeEmail } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";

export type LoginState = { status?: "sent" | "error"; message?: string };

export async function requestMagicLink(_state: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const domain = email.split("@")[1];
  const [{ userCount }] = await db.select({ userCount: count() }).from(users).all();
  const domainAllowed = await isDomainAllowed(domain);

  // The first account bootstraps administration; all later registrations are restricted.
  // The response stays identical to a real send either way, so this domain doesn't leak
  // to whoever's asking — but that also means a legitimate blocked sign-in leaves no trace
  // anywhere else, so it's worth a log line here.
  if (userCount > 0 && !domainAllowed) {
    console.info(`[login] Rejected sign-in for ${email}: domain "${domain}" is not allowed.`);
    return { status: "sent" };
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentLink = await db.select({ id: magicLinks.id }).from(magicLinks)
    .where(and(eq(magicLinks.email, email), gt(magicLinks.createdAt, tenMinutesAgo))).get();
  if (recentLink) return { status: "sent" };

  const token = createToken();
  const tokenHash = hashToken(token);
  await db.insert(magicLinks).values({
    email,
    tokenHash,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }).run();

  try {
    await sendMagicLinkEmail({ to: email, url: `${appUrl()}/auth/callback?token=${encodeURIComponent(token)}` });
  } catch (error) {
    await db.delete(magicLinks).where(eq(magicLinks.tokenHash, tokenHash)).run();
    console.error(`[email] Failed to send a sign-in link to ${email}`, error);
    return { status: "error", message: "We couldn’t send your sign-in link. Please wait a moment and try again." };
  }
  return { status: "sent" };
}
