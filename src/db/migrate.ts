import { runMigrations } from "./run-migrations";

runMigrations().catch((error: unknown) => {
  console.error(error instanceof Error ? `Migration failed: ${error.message}` : error);
  process.exit(1);
});
