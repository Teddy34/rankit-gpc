"use server";

import { gunzipSync } from "node:zlib";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { validateBackupPayload } from "@/domain/backup-validation";
import { requireUser } from "@/lib/auth";
import { restoreFromBackup } from "@/lib/restore";

export type RestoreState = {
  status?: "success" | "error";
  message?: string;
  safetyBackup?: { filename: string; gzipBase64: string };
};

const CONFIRMATION_PHRASE = "RESTORE";
const GZIP_MAGIC = [0x1f, 0x8b];

function isGzip(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === GZIP_MAGIC[0] && buffer[1] === GZIP_MAGIC[1];
}

export async function restoreBackupAction(_state: RestoreState, formData: FormData): Promise<RestoreState> {
  const actor = await requireUser();
  if (!actor.isAdmin) return { status: "error", message: "Administrator access required." };

  const confirmation = String(formData.get("confirmationPhrase") ?? "").trim();
  if (confirmation !== CONFIRMATION_PHRASE) return { status: "error", message: `Type "${CONFIRMATION_PHRASE}" to confirm.` };

  const file = formData.get("backupFile");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Choose a backup file." };

  const buffer = Buffer.from(await file.arrayBuffer());
  let raw: unknown;
  try {
    const text = (isGzip(buffer) ? gunzipSync(buffer) : buffer).toString("utf-8");
    raw = JSON.parse(text);
  } catch {
    return { status: "error", message: "That file isn't valid JSON (or a gzip of valid JSON)." };
  }

  const validation = validateBackupPayload(raw);
  if (!validation.ok) return { status: "error", message: validation.errors.join("\n") };

  const outcome = await restoreFromBackup(db, validation.envelope, actor.id);
  if (outcome.status === "success") {
    revalidatePath("/", "layout");
    revalidatePath("/admin");
    revalidatePath("/games");
    revalidatePath("/history");
  }
  return outcome;
}
