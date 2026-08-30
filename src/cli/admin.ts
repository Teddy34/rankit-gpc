import { count, eq, sql } from "drizzle-orm";
import { db } from "../db/index";
import { users } from "../db/schema";

type Operation = "grant" | "revoke";

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const operation = process.argv[2] as Operation | undefined;
  const email = (process.argv[3] ?? process.env.ADMIN_EMAIL ?? "").trim().toLocaleLowerCase("en-US");

  if (operation !== "grant" && operation !== "revoke") {
    fail("expected 'grant' or 'revoke'.");
  }
  if (!email) fail("provide an email address.");

  const player = await db.select().from(users)
    .where(sql`lower(trim(${users.email})) = ${email}`)
    .get();
  if (!player) fail(`no player found with email ${email}.`);

  const shouldBeAdmin = operation === "grant";
  if (player.isAdmin === shouldBeAdmin) {
    console.log(`${player.displayName} <${player.email}> is already ${shouldBeAdmin ? "an administrator" : "a regular player"}.`);
    return;
  }

  if (!shouldBeAdmin) {
    const [{ adminCount }] = await db.select({ adminCount: count() }).from(users).where(eq(users.isAdmin, true)).all();
    if (adminCount <= 1) fail("cannot revoke the final administrator.");
  }

  await db.update(users).set({ isAdmin: shouldBeAdmin }).where(eq(users.id, player.id)).run();
  console.log(`${shouldBeAdmin ? "Granted" : "Revoked"} administrator rights ${shouldBeAdmin ? "to" : "from"} ${player.displayName} <${player.email}>.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? `Error: ${error.message}` : error);
  process.exit(1);
});
