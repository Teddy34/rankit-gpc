import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { backupDownloadResponse, buildBackupEnvelope, parseBackupFormat } from "@/lib/backup";

export const dynamic = "force-dynamic";

// Hash both sides to a fixed length before comparing — timingSafeEqual throws on buffers of
// unequal length, and a raw bearer token will almost always differ in length from the expected
// secret, which would otherwise leak a fast-fail signal.
function constantTimeTokenMatch(candidate: string, expected: string): boolean {
  const candidateHash = createHash("sha256").update(candidate).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateHash, expectedHash);
}

export async function GET(request: NextRequest) {
  const expected = process.env.BACKUP_API_TOKEN;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !token || !constantTimeTokenMatch(token, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const envelope = await buildBackupEnvelope(db);
  const format = parseBackupFormat(new URL(request.url).searchParams.get("format"));
  return backupDownloadResponse(envelope, format);
}
