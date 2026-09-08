import "server-only";

import { gzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { db, type Transaction } from "@/db";
import { allowedDomains, auditLog, games, monthlyAwards, ratingResets, users } from "@/db/schema";
import type {
  BackupAllowedDomainRow,
  BackupAuditLogRow,
  BackupEnvelope,
  BackupGameRow,
  BackupMonthlyAwardRow,
  BackupRatingResetRow,
  BackupUserRow,
} from "@/domain/backup-validation";
import { BACKUP_FORMAT_VERSION, currentSchemaVersion } from "@/domain/backup-validation";

type DbLike = typeof db | Transaction;

/**
 * Reads the six backed-up tables from `dbOrTx` and serializes them into a versioned envelope.
 * Accepts either the top-level db client or an open transaction, so the same function builds
 * both the on-demand export and the pre-restore safety snapshot taken inside restoreFromBackup.
 */
export async function buildBackupEnvelope(dbOrTx: DbLike): Promise<BackupEnvelope> {
  const [userRows, domainRows, gameRows, resetRows, awardRows, auditRows] = await Promise.all([
    dbOrTx.select().from(users).all(),
    dbOrTx.select().from(allowedDomains).all(),
    dbOrTx.select().from(games).all(),
    dbOrTx.select().from(ratingResets).all(),
    dbOrTx.select().from(monthlyAwards).all(),
    dbOrTx.select().from(auditLog).all(),
  ]);

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: currentSchemaVersion(),
    generatedAt: new Date().toISOString(),
    tables: {
      users: userRows.map((row): BackupUserRow => ({
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        avatar: row.avatar,
        avatarImageUrl: row.avatarImageUrl,
        initialRating: row.initialRating,
        currentRating: row.currentRating,
        isAdmin: row.isAdmin,
        retiredAt: row.retiredAt?.toISOString() ?? null,
        deletedAt: row.deletedAt?.toISOString() ?? null,
        deletedBy: row.deletedBy,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      allowedDomains: domainRows.map((row): BackupAllowedDomainRow => ({
        id: row.id,
        domain: row.domain,
        createdBy: row.createdBy,
        createdAt: row.createdAt.toISOString(),
      })),
      games: gameRows.map((row): BackupGameRow => ({
        id: row.id,
        playerOneId: row.playerOneId,
        playerTwoId: row.playerTwoId,
        result: row.result,
        playedOn: row.playedOn,
        playedAtTime: row.playedAtTime,
        sequence: row.sequence,
        registeredBy: row.registeredBy,
        playerOneDelta: row.playerOneDelta,
        playerTwoDelta: row.playerTwoDelta,
        deletedAt: row.deletedAt?.toISOString() ?? null,
        deletedBy: row.deletedBy,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      ratingResets: resetRows.map((row): BackupRatingResetRow => ({
        id: row.id,
        userId: row.userId,
        rating: row.rating,
        effectiveOn: row.effectiveOn,
        sequence: row.sequence,
        setBy: row.setBy,
        deletedAt: row.deletedAt?.toISOString() ?? null,
        deletedBy: row.deletedBy,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      monthlyAwards: awardRows.map((row): BackupMonthlyAwardRow => ({
        id: row.id,
        awardMonth: row.awardMonth,
        userId: row.userId,
        level: row.level,
        streak: row.streak,
        awardedAt: row.awardedAt.toISOString(),
        deletedAt: row.deletedAt?.toISOString() ?? null,
        deletedBy: row.deletedBy,
      })),
      auditLog: auditRows.map((row): BackupAuditLogRow => ({
        id: row.id,
        actorId: row.actorId,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        details: row.details ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    },
  };
}

export function serializeEnvelope(envelope: BackupEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

/**
 * Gzips the JSON envelope. This is a selectable content *format*, never a `Content-Encoding`
 * header — setting Content-Encoding would make browsers and most HTTP clients transparently
 * decompress the body before anyone sees the smaller size, defeating the point of offering it.
 */
export function gzipEnvelope(envelope: BackupEnvelope): Buffer {
  return gzipSync(Buffer.from(serializeEnvelope(envelope), "utf-8"));
}

export function backupFilename(envelope: BackupEnvelope, extension: "json" | "json.gz"): string {
  const stamp = envelope.generatedAt.replace(/[:.]/g, "-");
  return `rankit-backup-${stamp}.${extension}`;
}

/** Shared response shape for both the admin-gated and bearer-token backup download routes. */
export function backupDownloadResponse(envelope: BackupEnvelope, gzip: boolean): NextResponse {
  const filename = backupFilename(envelope, gzip ? "json.gz" : "json");
  const disposition = `attachment; filename="${filename}"`;
  if (gzip) {
    return new NextResponse(new Uint8Array(gzipEnvelope(envelope)), {
      headers: { "content-type": "application/gzip", "content-disposition": disposition },
    });
  }
  return new NextResponse(serializeEnvelope(envelope), {
    headers: { "content-type": "application/json", "content-disposition": disposition },
  });
}
