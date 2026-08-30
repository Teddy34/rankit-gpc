export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.AUTO_MIGRATE_DATABASE === "true") {
    const { runMigrations } = await import("./db/run-migrations");
    await runMigrations();
  }
}
