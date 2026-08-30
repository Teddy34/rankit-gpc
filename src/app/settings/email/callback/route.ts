import { and, eq, gt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailChanges, users } from "@/db/schema";
import { hashToken } from "@/lib/auth";
import { isDomainAllowed } from "@/lib/allowed-domains";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/settings?emailError=invalid", request.url));
  const change = await db.select().from(emailChanges).where(and(eq(emailChanges.tokenHash, hashToken(token)), gt(emailChanges.expiresAt, new Date()))).get();
  if (!change) return NextResponse.redirect(new URL("/settings?emailError=expired", request.url));
  const domain = change.newEmail.split("@")[1];
  if (!await isDomainAllowed(domain) || await db.select({ id: users.id }).from(users).where(eq(users.email, change.newEmail)).get()) {
    return NextResponse.redirect(new URL("/settings?emailError=unavailable", request.url));
  }
  await db.transaction(async (tx) => {
    await tx.update(users).set({ email: change.newEmail }).where(eq(users.id, change.userId)).run();
    await tx.delete(emailChanges).where(eq(emailChanges.id, change.id)).run();
  });
  return NextResponse.redirect(new URL("/settings?emailChanged=1", request.url));
}
