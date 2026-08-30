"use server";

import { and, count, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { allowedDomains, magicLinks, users } from "@/db/schema";
import { profileAvatars } from "@/domain/profile";
import { createSession, hashToken } from "@/lib/auth";

export type RegistrationState = { message?: string };
const avatars = new Set<string>(profileAvatars);

export async function register(_state: RegistrationState, formData: FormData): Promise<RegistrationState> {
  const token = String(formData.get("token") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const avatar = String(formData.get("avatar") ?? "");
  const initialRating = Number(formData.get("initialRating"));
  const link = await db.select().from(magicLinks)
    .where(and(eq(magicLinks.tokenHash, hashToken(token)), gt(magicLinks.expiresAt, new Date()))).get();

  if (!link) return { message: "This registration link is invalid or has expired." };
  if (displayName.length < 2 || displayName.length > 40) return { message: "Display name must be between 2 and 40 characters." };
  if (!avatars.has(avatar)) return { message: "Choose one of the available avatars." };
  if (!Number.isInteger(initialRating) || initialRating < 1000 || initialRating > 2000) return { message: "ELO must be a whole number from 1000 to 2000." };
  if (await db.select({ id: users.id }).from(users).where(eq(users.email, link.email)).get()) redirect("/login");

  try {
    const user = await db.transaction(async (tx) => {
      const [{ userCount }] = await tx.select({ userCount: count() }).from(users).all();
      const created = await tx.insert(users).values({
        email: link.email,
        displayName,
        avatar,
        initialRating,
        currentRating: initialRating,
        isAdmin: userCount === 0,
      }).returning().get();

      if (userCount === 0) {
        const domain = link.email.split("@")[1];
        await tx.insert(allowedDomains).values({ domain, createdBy: created.id }).onConflictDoNothing().run();
      }
      return created;
    });
    await createSession(user.id);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return { message: "That display name is already taken." };
    }
    throw error;
  }
  redirect("/");
}
