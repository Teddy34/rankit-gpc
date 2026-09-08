import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT_VERSION,
  checkReferentialIntegrity,
  checkRowConstraints,
  checkUniqueness,
  validateBackupPayload,
  validateBackupTables,
  type BackupEnvelope,
  type BackupTables,
} from "./backup-validation";

const TEST_SCHEMA_VERSION = "0008_lucky_cardiac";

function baseEnvelope(): BackupEnvelope {
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: TEST_SCHEMA_VERSION,
    generatedAt: "2026-01-04T00:00:00.000Z",
    tables: baseTables(),
  };
}

function baseTables(): BackupTables {
  return {
    users: [
      { id: 1, email: "a@example.com", displayName: "Ada", avatar: "🎱", avatarImageUrl: null, initialRating: 1500, currentRating: 1500, isAdmin: true, retiredAt: null, deletedAt: null, deletedBy: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: 2, email: "b@example.com", displayName: "Bob", avatar: "🎯", avatarImageUrl: null, initialRating: 1500, currentRating: 1508, isAdmin: false, retiredAt: null, deletedAt: null, deletedBy: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
    allowedDomains: [{ id: 1, domain: "example.com", createdBy: 1, createdAt: "2026-01-01T00:00:00.000Z" }],
    games: [{ id: 1, playerOneId: 1, playerTwoId: 2, result: "player_one", playedOn: "2026-01-02", playedAtTime: null, sequence: 1, registeredBy: 1, playerOneDelta: 8, playerTwoDelta: -8, deletedAt: null, deletedBy: null, createdAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" }],
    ratingResets: [],
    monthlyAwards: [{ id: 1, awardMonth: "2026-01", userId: 1, level: "gold", streak: 3, awardedAt: "2026-02-01T00:00:00.000Z", deletedAt: null, deletedBy: null }],
    auditLog: [{ id: 1, actorId: 1, action: "player.retired", entityType: "user", entityId: "2", details: null, createdAt: "2026-01-03T00:00:00.000Z" }],
  };
}

describe("checkReferentialIntegrity", () => {
  it("accepts a self-consistent payload", () => {
    expect(checkReferentialIntegrity(baseTables())).toEqual([]);
  });

  it.each([
    ["games.playerOneId", (t: BackupTables) => { t.games[0].playerOneId = 99; }],
    ["games.playerTwoId", (t: BackupTables) => { t.games[0].playerTwoId = 99; }],
    ["games.registeredBy", (t: BackupTables) => { t.games[0].registeredBy = 99; }],
    ["ratingResets.userId", (t: BackupTables) => { t.ratingResets.push({ id: 1, userId: 99, rating: 1500, effectiveOn: "2026-01-01", sequence: 2, setBy: 1, deletedAt: null, deletedBy: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }); }],
    ["monthlyAwards.userId", (t: BackupTables) => { t.monthlyAwards[0].userId = 99; }],
    ["auditLog.actorId", (t: BackupTables) => { t.auditLog[0].actorId = 99; }],
    ["allowedDomains.createdBy", (t: BackupTables) => { t.allowedDomains[0].createdBy = 99; }],
    ["users.deletedBy", (t: BackupTables) => { t.users[0].deletedBy = 99; }],
  ])("flags a dangling %s reference", (_label, mutate) => {
    const tables = baseTables();
    mutate(tables);
    expect(checkReferentialIntegrity(tables).length).toBeGreaterThan(0);
  });

  it("allows null FK fields", () => {
    const tables = baseTables();
    tables.games[0].deletedBy = null;
    expect(checkReferentialIntegrity(tables)).toEqual([]);
  });
});

describe("checkRowConstraints", () => {
  it("accepts a valid payload", () => {
    expect(checkRowConstraints(baseTables())).toEqual([]);
  });

  it("flags a game with the same player on both sides", () => {
    const tables = baseTables();
    tables.games[0].playerTwoId = tables.games[0].playerOneId;
    expect(checkRowConstraints(tables)).toEqual([expect.stringContaining("same player")]);
  });

  it("flags a non-zero-sum game", () => {
    const tables = baseTables();
    tables.games[0].playerTwoDelta = -7;
    expect(checkRowConstraints(tables)).toEqual([expect.stringContaining("zero-sum")]);
  });

  it("flags an out-of-range initial rating", () => {
    const tables = baseTables();
    tables.users[0].initialRating = 999;
    expect(checkRowConstraints(tables)).toEqual([expect.stringContaining("initialRating")]);
  });

  it("flags an out-of-range rating reset", () => {
    const tables = baseTables();
    tables.ratingResets.push({ id: 1, userId: 1, rating: 2001, effectiveOn: "2026-01-01", sequence: 2, setBy: 1, deletedAt: null, deletedBy: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
    expect(checkRowConstraints(tables)).toEqual([expect.stringContaining("rating")]);
  });

  it("flags a non-positive award streak", () => {
    const tables = baseTables();
    tables.monthlyAwards[0].streak = 0;
    expect(checkRowConstraints(tables)).toEqual([expect.stringContaining("streak")]);
  });
});

describe("checkUniqueness", () => {
  it("accepts a valid payload", () => {
    expect(checkUniqueness(baseTables())).toEqual([]);
  });

  it("flags case-insensitive duplicate emails", () => {
    const tables = baseTables();
    tables.users[1].email = "  A@EXAMPLE.com ";
    expect(checkUniqueness(tables)).toEqual([expect.stringContaining("email")]);
  });

  it("flags case-insensitive duplicate display names", () => {
    const tables = baseTables();
    tables.users[1].displayName = "ada";
    expect(checkUniqueness(tables)).toEqual([expect.stringContaining("display name")]);
  });

  it("flags duplicate game sequences", () => {
    const tables = baseTables();
    tables.games.push({ ...tables.games[0], id: 2 });
    expect(checkUniqueness(tables)).toEqual([expect.stringContaining("game sequence")]);
  });

  it("flags duplicate monthly award months", () => {
    const tables = baseTables();
    tables.monthlyAwards.push({ ...tables.monthlyAwards[0], id: 2, userId: 2 });
    expect(checkUniqueness(tables)).toEqual([expect.stringContaining("monthly award month")]);
  });
});

describe("validateBackupTables", () => {
  it("accumulates every violation instead of stopping at the first", () => {
    const tables = baseTables();
    tables.games[0].playerTwoId = tables.games[0].playerOneId; // constraint violation
    tables.users[1].email = tables.users[0].email; // uniqueness violation
    tables.auditLog[0].actorId = 99; // referential violation

    const errors = validateBackupTables(tables);
    expect(errors.length).toBe(3);
  });

  it("returns no errors for a clean payload", () => {
    expect(validateBackupTables(baseTables())).toEqual([]);
  });
});

describe("validateBackupPayload", () => {
  it("accepts a valid envelope", () => {
    const result = validateBackupPayload(baseEnvelope(), TEST_SCHEMA_VERSION);
    expect(result).toEqual({ ok: true, envelope: baseEnvelope() });
  });

  it("rejects structurally invalid JSON with a readable error", () => {
    const result = validateBackupPayload({ not: "a backup" }, TEST_SCHEMA_VERSION);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects a mismatched format version", () => {
    const envelope = { ...baseEnvelope(), formatVersion: 99 };
    const result = validateBackupPayload(envelope, TEST_SCHEMA_VERSION);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual([expect.stringContaining("format version")]);
  });

  it("rejects a mismatched schema version", () => {
    const result = validateBackupPayload(baseEnvelope(), "0009_some_future_migration");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual([expect.stringContaining("migration")]);
  });

  it("surfaces table-level violations alongside version mismatches", () => {
    const envelope = baseEnvelope();
    envelope.tables.games[0].playerTwoId = envelope.tables.games[0].playerOneId;
    const result = validateBackupPayload(envelope, "0009_some_future_migration");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.includes("migration"))).toBe(true);
      expect(result.errors.some((error) => error.includes("same player"))).toBe(true);
    }
  });

  it("defaults expectedSchemaVersion to the real current migration tag", () => {
    // baseEnvelope's schemaVersion is deliberately kept equal to the repo's actual latest
    // migration tag, so calling with no override proves the default resolves to that same value.
    const result = validateBackupPayload(baseEnvelope());
    expect(result).toEqual({ ok: true, envelope: baseEnvelope() });
  });
});
