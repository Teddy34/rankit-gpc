import { eq, gt, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { magicLinks, users } from "@/db/schema";
import { createSession, hashToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/login?error=invalid", request.url));
  const link = await db.select().from(magicLinks)
    .where(and(eq(magicLinks.tokenHash, hashToken(token)), gt(magicLinks.expiresAt, new Date()))).get();
  if (!link) return NextResponse.redirect(new URL("/login?error=expired", request.url));

  const user = await db.select().from(users).where(eq(users.email, link.email)).get();
  if (!user) {
    const response = NextResponse.redirect(new URL(`/register?token=${encodeURIComponent(token)}`, request.url));
    return response;
  }
  await createSession(user.id);
  return NextResponse.redirect(new URL("/", request.url));
}
