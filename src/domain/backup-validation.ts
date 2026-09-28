// Defines the backup JSON format and everything needed to decide whether an uploaded/received
// payload is safe to restore, all pure and framework-free (no db/server-only dependency) so it's
// exercised directly by vitest. Timestamps travel as ISO-8601 strings since the backup is JSON;
// src/lib/backup.ts converts to/from Drizzle's `Date`-typed columns at the database boundary.
import { z } from "zod";
import journal from "../../drizzle/meta/_journal.json";

export const BACKUP_FORMAT_VERSION = 1;

/**
 * The latest applied Drizzle migration tag, read from the migrations journal that ships with the
 * build via a static import (not a runtime fs read), so it's resolved and bundled at build time —
 * correctly reflecting the schema shape the deployed code expects, rather than depending on
 * filesystem access at request time.
 */
export function currentSchemaVersion(): string {
  const entries = journal.entries as { tag: string }[];
  const last = entries.at(-1);
  if (!last) throw new Error("drizzle/meta/_journal.json has no migration entries.");
  return last.tag;
}

const isoDatetime = z.iso.datetime();
const nullableIsoDatetime = isoDatetime.nullable();
const nullableId = z.number().int().nullable();

const userRowSchema = z.object({
  id: z.number().int(),
  email: z.string(),
  displayName: z.string(),
  avatar: z.string(),
  avatarImageUrl: z.string().nullable(),
  initialRating: z.number().int(),
  currentRating: z.number().int(),
  isAdmin: z.boolean(),
  retiredAt: nullableIsoDatetime,
  deletedAt: nullableIsoDatetime,
  deletedBy: nullableId,
  createdAt: isoDatetime,
  updatedAt: isoDatetime,
});

const allowedDomainRowSchema = z.object({
  id: z.number().int(),
  domain: z.string(),
  createdBy: nullableId,
  createdAt: isoDatetime,
});

const gameRowSchema = z.object({
  id: z.number().int(),
  playerOneId: z.number().int(),
  playerTwoId: z.number().int(),
  result: z.enum(["player_one", "player_two", "draw"]),
  playedOn: z.string(),
  playedAtTime: z.string().nullable(),
  sequence: z.number().int(),
  registeredBy: z.number().int(),
  playerOneDelta: z.number().int(),
  playerTwoDelta: z.number().int(),
  deletedAt: nullableIsoDatetime,
  deletedBy: nullableId,
  createdAt: isoDatetime,
  updatedAt: isoDatetime,
});

const ratingResetRowSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  rating: z.number().int(),
  effectiveOn: z.string(),
  sequence: z.number().int(),
  setBy: z.number().int(),
  deletedAt: nullableIsoDatetime,
  deletedBy: nullableId,
  createdAt: isoDatetime,
  updatedAt: isoDatetime,
});

const monthlyAwardRowSchema = z.object({
  id: z.number().int(),
  awardMonth: z.string(),
  userId: z.number().int(),
  level: z.enum(["bronze", "silver", "gold"]),
  streak: z.number().int(),
  awardedAt: isoDatetime,
  deletedAt: nullableIsoDatetime,
  deletedBy: nullableId,
});

const auditLogRowSchema = z.object({
  id: z.number().int(),
  actorId: z.number().int(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  details: z.record(z.string(), z.unknown()).nullable(),
  createdAt: isoDatetime,
});

const backupTablesSchema = z.object({
  users: z.array(userRowSchema),
  allowedDomains: z.array(allowedDomainRowSchema),
  games: z.array(gameRowSchema),
  ratingResets: z.array(ratingResetRowSchema),
  monthlyAwards: z.array(monthlyAwardRowSchema),
  auditLog: z.array(auditLogRowSchema),
});

export const backupEnvelopeSchema = z.object({
  formatVersion: z.number().int(),
  schemaVersion: z.string(),
  generatedAt: isoDatetime,
  tables: backupTablesSchema,
});

export type BackupUserRow = z.infer<typeof userRowSchema>;
export type BackupAllowedDomainRow = z.infer<typeof allowedDomainRowSchema>;
export type BackupGameRow = z.infer<typeof gameRowSchema>;
export type BackupRatingResetRow = z.infer<typeof ratingResetRowSchema>;
export type BackupMonthlyAwardRow = z.infer<typeof monthlyAwardRowSchema>;
export type BackupAuditLogRow = z.infer<typeof auditLogRowSchema>;
export type BackupTables = z.infer<typeof backupTablesSchema>;
export type BackupEnvelope = z.infer<typeof backupEnvelopeSchema>;

function normalizedEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}

function normalizedName(name: string): string {
  return name.trim().toLocaleLowerCase("en-US");
}

/** Every foreign-key-shaped field must resolve to a row present in this same payload. */
export function checkReferentialIntegrity(tables: BackupTables): string[] {
  const errors: string[] = [];
  const userIds = new Set(tables.users.map((user) => user.id));
  const referencesUser = (label: string, id: number | null) => {
    if (id !== null && !userIds.has(id)) errors.push(`${label} references user ${id}, which is not in the backup.`);
  };

  for (const user of tables.users) referencesUser(`users[${user.id}].deletedBy`, user.deletedBy);
  for (const domain of tables.allowedDomains) referencesUser(`allowedDomains[${domain.id}].createdBy`, domain.createdBy);
  for (const game of tables.games) {
    referencesUser(`games[${game.id}].playerOneId`, game.playerOneId);
    referencesUser(`games[${game.id}].playerTwoId`, game.playerTwoId);
    referencesUser(`games[${game.id}].registeredBy`, game.registeredBy);
    referencesUser(`games[${game.id}].deletedBy`, game.deletedBy);
  }
  for (const reset of tables.ratingResets) {
    referencesUser(`ratingResets[${reset.id}].userId`, reset.userId);
    referencesUser(`ratingResets[${reset.id}].setBy`, reset.setBy);
    referencesUser(`ratingResets[${reset.id}].deletedBy`, reset.deletedBy);
  }
  for (const award of tables.monthlyAwards) {
    referencesUser(`monthlyAwards[${award.id}].userId`, award.userId);
    referencesUser(`monthlyAwards[${award.id}].deletedBy`, award.deletedBy);
  }
  for (const entry of tables.auditLog) referencesUser(`auditLog[${entry.id}].actorId`, entry.actorId);

  return errors;
}

/** Mirrors the CHECK constraints declared in src/db/schema.ts. */
export function checkRowConstraints(tables: BackupTables): string[] {
  const errors: string[] = [];

  for (const user of tables.users) {
    if (user.initialRating < 1000 || user.initialRating > 2000) {
      errors.push(`users[${user.id}].initialRating (${user.initialRating}) is outside 1000-2000.`);
    }
  }
  for (const game of tables.games) {
    if (game.playerOneId === game.playerTwoId) errors.push(`games[${game.id}] has the same player on both sides.`);
    if (game.playerOneDelta + game.playerTwoDelta !== 0) errors.push(`games[${game.id}] deltas are not zero-sum.`);
  }
  for (const reset of tables.ratingResets) {
    if (reset.rating < 1000 || reset.rating > 2000) errors.push(`ratingResets[${reset.id}].rating (${reset.rating}) is outside 1000-2000.`);
  }
  for (const award of tables.monthlyAwards) {
    if (award.streak <= 0) errors.push(`monthlyAwards[${award.id}].streak (${award.streak}) must be positive.`);
  }

  return errors;
}

/** Mirrors the unique indexes declared in src/db/schema.ts. */
export function checkUniqueness(tables: BackupTables): string[] {
  const errors: string[] = [];
  const seen = <T>(rows: T[], key: (row: T) => string | number, label: string) => {
    const values = new Set<string | number>();
    for (const row of rows) {
      const value = key(row);
      if (values.has(value)) errors.push(`Duplicate ${label}: ${value}`);
      values.add(value);
    }
  };

  seen(tables.users, (user) => normalizedEmail(user.email), "user email");
  seen(tables.users, (user) => normalizedName(user.displayName), "user display name");
  seen(tables.games, (game) => game.sequence, "game sequence");
  seen(tables.ratingResets, (reset) => reset.sequence, "rating reset sequence");
  seen(tables.monthlyAwards, (award) => award.awardMonth, "monthly award month");

  return errors;
}

/** Runs every structural check and returns every violation found, not just the first. */
export function validateBackupTables(tables: BackupTables): string[] {
  return [...checkReferentialIntegrity(tables), ...checkRowConstraints(tables), ...checkUniqueness(tables)];
}

export type RestoreValidationResult =
  | { ok: true; envelope: BackupEnvelope }
  | { ok: false; errors: string[] };

/**
 * Full validation of an uploaded/received backup payload: structural shape, format/schema
 * version, then every check in validateBackupTables — accumulating every error found rather than
 * stopping at the first. `expectedSchemaVersion` defaults to the real current migration tag but
 * is injectable purely for testability.
 */
export function validateBackupPayload(raw: unknown, expectedSchemaVersion = currentSchemaVersion()): RestoreValidationResult {
  const parsed = backupEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`) };
  }

  const envelope = parsed.data;
  const errors: string[] = [];
  if (envelope.formatVersion !== BACKUP_FORMAT_VERSION) {
    errors.push(`Backup format version ${envelope.formatVersion} is not supported by this build (expects ${BACKUP_FORMAT_VERSION}).`);
  }
  if (envelope.schemaVersion !== expectedSchemaVersion) {
    errors.push(`Backup was taken against migration "${envelope.schemaVersion}"; this deployment expects "${expectedSchemaVersion}". Refusing to restore.`);
  }
  errors.push(...validateBackupTables(envelope.tables));

  return errors.length > 0 ? { ok: false, errors } : { ok: true, envelope };
}
