import Database from "better-sqlite3";
import { mkdir, readdir, realpath, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

const configuredDatabaseUrl = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "./data/rankit.sqlite";
const localDatabaseUrl = configuredDatabaseUrl.startsWith("file:")
  ? configuredDatabaseUrl.slice("file:".length)
  : configuredDatabaseUrl;
const databasePath = resolve(localDatabaseUrl);
const backupDirectory = resolve(process.env.BACKUP_DIR ?? "./backups");
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? "7");
const backupPattern = /^rankit-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z(?:-pre-restore)?\.sqlite$/;

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function timestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z").replaceAll(":", "-");
}

function assertConfiguration(): void {
  if (/^(?:libsql|https|wss):\/\//.test(configuredDatabaseUrl)) {
    fail("file backup operations apply only to a local SQLite database; use Turso backups for a remote database.");
  }
  if (configuredDatabaseUrl === ":memory:" || configuredDatabaseUrl === "file::memory:") {
    fail("database operations are unavailable for an in-memory database.");
  }
  if (!Number.isFinite(retentionDays) || retentionDays < 1) fail("BACKUP_RETENTION_DAYS must be a positive number.");
  if (dirname(databasePath) === backupDirectory) fail("BACKUP_DIR must be outside the live database directory.");
}

async function verifyDatabase(path: string): Promise<void> {
  const database = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const result = database.pragma("quick_check", { simple: true });
    if (result !== "ok") throw new Error(`SQLite quick_check returned: ${String(result)}`);
  } finally {
    database.close();
  }
}

async function createBackup(suffix = ""): Promise<string> {
  await mkdir(backupDirectory, { recursive: true });
  const destination = join(backupDirectory, `rankit-${timestamp()}${suffix}.sqlite`);
  const source = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(destination);
  } finally {
    source.close();
  }
  await verifyDatabase(destination);
  return destination;
}

async function pruneExpiredBackups(): Promise<number> {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = await readdir(backupDirectory, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !backupPattern.test(entry.name)) continue;
    const path = join(backupDirectory, entry.name);
    if ((await stat(path)).mtimeMs < cutoff) {
      await rm(path);
      removed += 1;
    }
  }
  return removed;
}

async function listBackups(): Promise<void> {
  await mkdir(backupDirectory, { recursive: true });
  const entries = (await readdir(backupDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && backupPattern.test(entry.name))
    .sort((a, b) => b.name.localeCompare(a.name));
  if (entries.length === 0) {
    console.log(`No backups in ${backupDirectory}`);
    return;
  }
  console.log(`Backups in ${backupDirectory}:`);
  for (const entry of entries) {
    const metadata = await stat(join(backupDirectory, entry.name));
    console.log(`${entry.name}\t${(metadata.size / 1024).toFixed(1)} KiB`);
  }
}

async function resolveRestoreSource(value: string): Promise<string> {
  if (!value) fail('provide BACKUP="filename.sqlite".');
  const requested = resolve(isAbsolute(value) ? value : join(backupDirectory, value));
  const root = await realpath(backupDirectory);
  const source = await realpath(requested).catch(() => fail(`backup not found: ${value}`));
  if (dirname(source) !== root || !backupPattern.test(basename(source))) {
    fail("the restore source must be a managed backup in BACKUP_DIR.");
  }
  return source;
}

async function restoreBackup(value: string): Promise<void> {
  if (process.env.CONFIRM_RESTORE !== "restore") {
    fail('restore requires CONFIRM=restore. Stop the application before trying again.');
  }
  const sourcePath = await resolveRestoreSource(value);
  await verifyDatabase(sourcePath);
  const safetyBackup = await createBackup("-pre-restore");
  const temporaryPath = join(dirname(databasePath), `.rankit-restore-${process.pid}.sqlite`);
  const displacedPath = join(dirname(databasePath), `.rankit-displaced-${process.pid}.sqlite`);
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(temporaryPath);
  } finally {
    source.close();
  }
  await verifyDatabase(temporaryPath);

  try {
    await rm(`${databasePath}-wal`, { force: true });
    await rm(`${databasePath}-shm`, { force: true });
    await rename(databasePath, displacedPath);
    try {
      await rename(temporaryPath, databasePath);
    } catch (error) {
      await rename(displacedPath, databasePath);
      throw error;
    }
    await rm(displacedPath, { force: true });
  } finally {
    await rm(temporaryPath, { force: true });
  }
  console.log(`Restored ${basename(sourcePath)} to ${databasePath}`);
  console.log(`Pre-restore safety backup: ${safetyBackup}`);
}

async function main(): Promise<void> {
  assertConfiguration();
  const operation = process.argv[2];
  if (operation === "backup") {
    const destination = await createBackup();
    const removed = await pruneExpiredBackups();
    console.log(`Backup created: ${destination}`);
    if (removed > 0) console.log(`Removed ${removed} backup(s) older than ${retentionDays} days.`);
  } else if (operation === "list") {
    await listBackups();
  } else if (operation === "restore") {
    await restoreBackup(process.env.RESTORE_BACKUP ?? process.argv[3] ?? "");
  } else {
    fail("expected 'backup', 'list', or 'restore'.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? `Error: ${error.message}` : error);
  process.exit(1);
});
