import { resolve } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./index";

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
}
