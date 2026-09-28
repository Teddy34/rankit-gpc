"use server";

import { gunzipSync } from "node:zlib";
import JSZip from "jszip";
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
// "PK" — every zip local-file-header, empty-archive, and spanned-archive signature starts with it.
const ZIP_MAGIC = [0x50, 0x4b];

function isGzip(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === GZIP_MAGIC[0] && buffer[1] === GZIP_MAGIC[1];
}

function isZip(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === ZIP_MAGIC[0] && buffer[1] === ZIP_MAGIC[1];
}

/** Accepts plain JSON, a gzip of JSON, or a .zip archive containing one JSON file. */
async function extractJsonText(buffer: Buffer): Promise<string> {
  if (isGzip(buffer)) return gunzipSync(buffer).toString("utf-8");
  if (isZip(buffer)) {
    const zip = await JSZip.loadAsync(buffer);
    const entry = Object.values(zip.files).find((file) => !file.dir);
    if (!entry) throw new Error("The zip archive has no files in it.");
    return entry.async("text");
  }
  return buffer.toString("utf-8");
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
    raw = JSON.parse(await extractJsonText(buffer));
  } catch {
    return { status: "error", message: "That file isn't valid JSON (or a gzip or zip of valid JSON)." };
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
