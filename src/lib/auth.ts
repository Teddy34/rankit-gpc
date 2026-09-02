import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

const SESSION_COOKIE = "rankit_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const LAST_EMAIL_COOKIE = "rankit_last_email";
const LAST_EMAIL_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(userId: number): Promise<void> {
  const token = createToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt }).run();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token))).run();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .get();
  return row?.user ?? null;
}

// Remembers the last email a visitor typed on the login form, purely as a
// time-saving default for their next sign-in — it's never treated as proof
// of identity, so there's no harm in it surviving unverified.
export async function rememberLoginEmail(email: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LAST_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + LAST_EMAIL_DURATION_MS),
  });
}

export async function getRememberedLoginEmail(): Promise<string | null> {
  return (await cookies()).get(LAST_EMAIL_COOKIE)?.value ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
