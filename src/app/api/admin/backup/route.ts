import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { backupDownloadResponse, buildBackupEnvelope } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");

  const envelope = await buildBackupEnvelope(db);
  await db.insert(auditLog).values({
    actorId: user.id,
    action: "backup.taken",
    entityType: "system",
    entityId: "database",
    details: { trigger: "admin_download" },
  }).run();

  const gzip = new URL(request.url).searchParams.get("format") === "gzip";
  return backupDownloadResponse(envelope, gzip);
}
