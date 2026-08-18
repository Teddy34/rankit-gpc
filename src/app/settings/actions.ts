"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { allowedDomains, auditLog, emailChanges, users } from "@/db/schema";
import { isValidDomain, normalizeDomain } from "@/domain/email-domain";
import { profileAvatars } from "@/domain/profile";
import { configuredAllowedDomains, isDomainAllowed } from "@/lib/allowed-domains";
import { createToken, hashToken, normalizeEmail, requireUser } from "@/lib/auth";
import { sendEmailChangeEmail } from "@/lib/email";

export type SettingsState = { status?: "success" | "error"; message?: string };

export async function updateProfile(_state: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const avatar = String(formData.get("avatar") ?? "");
  if (displayName.length < 2 || displayName.length > 40) return { status: "error", message: "Display name must be between 2 and 40 characters." };
  if (!(profileAvatars as readonly string[]).includes(avatar)) return { status: "error", message: "Choose one of the available avatars." };

  try {
    db.update(users).set({ displayName, avatar }).where(eq(users.id, user.id)).run();
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) return { status: "error", message: "That display name is already taken." };
    throw error;
  }
  revalidatePath("/", "layout");
  return { status: "success", message: "Profile updated." };
}

export async function requestEmailChange(_state: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const newEmail = normalizeEmail(String(formData.get("email") ?? ""));
  if (!/^\S+@\S+\.\S+$/.test(newEmail) || newEmail.length > 254) return { status: "error", message: "Enter a valid email address." };
  if (newEmail === user.email) return { status: "error", message: "That is already your email address." };
  const domain = newEmail.split("@")[1];
  if (!isDomainAllowed(domain)) return { status: "error", message: "That email domain is not allowed." };
  if (db.select({ id: users.id }).from(users).where(eq(users.email, newEmail)).get()) return { status: "error", message: "That email address is already in use." };

  const token = createToken();
  db.delete(emailChanges).where(eq(emailChanges.userId, user.id)).run();
  const pendingChange = db.insert(emailChanges).values({ userId: user.id, newEmail, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }).returning({ id: emailChanges.id }).get();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  try {
    await sendEmailChangeEmail({ to: newEmail, url: `${appUrl}/settings/email/callback?token=${encodeURIComponent(token)}` });
  } catch (error) {
    db.delete(emailChanges).where(eq(emailChanges.id, pendingChange.id)).run();
    console.error(`[email] Failed to send an email-change confirmation to ${newEmail}`, error);
    return { status: "error", message: "We couldn’t send the confirmation email. Your address was not changed; please try again." };
  }
  return { status: "success", message: `Confirmation sent to ${newEmail}.` };
}

export async function addAllowedDomain(_state: SettingsState, formData: FormData): Promise<SettingsState> {
  const actor = await requireUser();
  if (!actor.isAdmin) return { status: "error", message: "Only administrators can manage domains." };
  const domain = normalizeDomain(String(formData.get("domain") ?? ""));
  if (!isValidDomain(domain)) return { status: "error", message: "Enter a valid domain, such as example.com." };
  if (isDomainAllowed(domain)) return { status: "error", message: "That domain is already allowed." };

  db.transaction((tx) => {
    const created = tx.insert(allowedDomains).values({ domain, createdBy: actor.id }).returning().get();
    tx.insert(auditLog).values({
      actorId: actor.id,
      action: "domain.allowed",
      entityType: "allowed_domain",
      entityId: String(created.id),
      details: { domain },
    }).run();
  });
  revalidatePath("/settings");
  return { status: "success", message: `${domain} is now allowed.` };
}

export async function removeAllowedDomain(_state: SettingsState, formData: FormData): Promise<SettingsState> {
  const actor = await requireUser();
  if (!actor.isAdmin) return { status: "error", message: "Only administrators can manage domains." };
  const domainId = Number(formData.get("domainId"));
  if (!Number.isInteger(domainId)) return { status: "error", message: "Invalid domain." };
  const domain = db.select().from(allowedDomains).where(eq(allowedDomains.id, domainId)).get();
  if (!domain) return { status: "error", message: "That domain no longer exists." };
  if (configuredAllowedDomains().has(domain.domain)) return { status: "error", message: "Configured domains cannot be removed here." };

  db.transaction((tx) => {
    tx.delete(allowedDomains).where(eq(allowedDomains.id, domainId)).run();
    tx.insert(auditLog).values({
      actorId: actor.id,
      action: "domain.removed",
      entityType: "allowed_domain",
      entityId: String(domainId),
      details: { domain: domain.domain },
    }).run();
  });
  revalidatePath("/settings");
  return { status: "success", message: `${domain.domain} was removed.` };
}
