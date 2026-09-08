import "server-only";

import { db } from "@/db";
import { allowedDomains, auditLog, emailChanges, games, magicLinks, monthlyAwards, ratingResets, sessions, users } from "@/db/schema";
import type { BackupEnvelope } from "@/domain/backup-validation";
import { recalculateAllRatings } from "@/lib/rating-recalculation";
import { backupFilename, buildBackupEnvelope, gzipEnvelope } from "@/lib/backup";

export type RestoreOutcome =
  | { status: "success"; message: string; safetyBackup: { filename: string; gzipBase64: string } }
  | { status: "error"; message: string };

/**
 * Wipes and reinserts the six backed-up tables from `envelope`, inside one transaction:
 *  1. Snapshots the current live data first (the safety copy returned to the caller).
 *  2. Deletes dependents before parents, explicitly (no FK cascade is configured on this client).
 *  3. Reinserts with original ids preserved, so cross-table references in the payload stay valid.
 *  4. Regenerates ratings/deltas via the existing replay pipeline rather than trusting the
 *     backup's stored values.
 *  5. Clears sessions/magicLinks/emailChanges — none of them are restored, and any surviving rows
 *     would either be stale security state or dangle a FK at a just-replaced user.
 *  6. Records the restore in the (now-current) audit log.
 *
 * Assumes `envelope` already passed validateBackupPayload — this function trusts its shape.
 */
export async function restoreFromBackup(dbClient: typeof db, envelope: BackupEnvelope, actorId: number): Promise<RestoreOutcome> {
  const { tables } = envelope;

  const safetyEnvelope = await dbClient.transaction(async (tx) => {
    const snapshot = await buildBackupEnvelope(tx);

    await tx.delete(auditLog).run();
    await tx.delete(monthlyAwards).run();
    await tx.delete(ratingResets).run();
    await tx.delete(games).run();
    await tx.delete(allowedDomains).run();
    await tx.delete(sessions).run();
    await tx.delete(emailChanges).run();
    await tx.delete(magicLinks).run();
    await tx.delete(users).run();

    if (tables.users.length > 0) {
      await tx.insert(users).values(tables.users.map((row) => ({
        ...row,
        retiredAt: row.retiredAt ? new Date(row.retiredAt) : null,
        deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }))).run();
    }
    if (tables.allowedDomains.length > 0) {
      await tx.insert(allowedDomains).values(tables.allowedDomains.map((row) => ({
        ...row,
        createdAt: new Date(row.createdAt),
      }))).run();
    }
    if (tables.games.length > 0) {
      await tx.insert(games).values(tables.games.map((row) => ({
        ...row,
        deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }))).run();
    }
    if (tables.ratingResets.length > 0) {
      await tx.insert(ratingResets).values(tables.ratingResets.map((row) => ({
        ...row,
        deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }))).run();
    }

    await recalculateAllRatings(tx);

    if (tables.monthlyAwards.length > 0) {
      await tx.insert(monthlyAwards).values(tables.monthlyAwards.map((row) => ({
        ...row,
        awardedAt: new Date(row.awardedAt),
        deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
      }))).run();
    }
    if (tables.auditLog.length > 0) {
      await tx.insert(auditLog).values(tables.auditLog.map((row) => ({
        ...row,
        createdAt: new Date(row.createdAt),
      }))).run();
    }

    await tx.insert(auditLog).values({
      actorId,
      action: "database.restored",
      entityType: "system",
      entityId: "database",
      details: {
        restoredSchemaVersion: envelope.schemaVersion,
        generatedAt: envelope.generatedAt,
        tableCounts: {
          users: tables.users.length,
          allowedDomains: tables.allowedDomains.length,
          games: tables.games.length,
          ratingResets: tables.ratingResets.length,
          monthlyAwards: tables.monthlyAwards.length,
          auditLog: tables.auditLog.length,
        },
      },
    }).run();

    return snapshot;
  });

  await dbClient.insert(auditLog).values({
    actorId,
    action: "backup.taken",
    entityType: "system",
    entityId: "database",
    details: { trigger: "pre_restore_safety", generatedAt: safetyEnvelope.generatedAt },
  }).run();

  return {
    status: "success",
    message: `Restored ${tables.users.length} players, ${tables.games.length} games, ${tables.ratingResets.length} rating resets, ${tables.monthlyAwards.length} awards, ${tables.allowedDomains.length} allowed domains, and ${tables.auditLog.length} audit entries. Everyone has been signed out.`,
    safetyBackup: {
      filename: backupFilename(safetyEnvelope, "json.gz"),
      gzipBase64: gzipEnvelope(safetyEnvelope).toString("base64"),
    },
  };
}
