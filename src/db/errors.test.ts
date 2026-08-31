import { describe, expect, it } from "vitest";
import { databaseErrorIncludes } from "./errors";

describe("databaseErrorIncludes", () => {
  it("matches a direct database error", () => {
    expect(databaseErrorIncludes(new Error("UNIQUE constraint failed: users.email"), "UNIQUE constraint failed")).toBe(true);
  });

  it("matches an error wrapped by Drizzle and libSQL", () => {
    const constraint = new Error("SQLite error: UNIQUE constraint failed: index 'users_display_name_ci_unique'");
    const libsql = new Error("SQLITE_CONSTRAINT", { cause: constraint });
    const drizzle = new Error("Failed query: insert into users", { cause: libsql });

    expect(databaseErrorIncludes(drizzle, "users_display_name_ci_unique")).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(databaseErrorIncludes(new Error("fetch failed"), "users_display_name_ci_unique")).toBe(false);
  });

  it("stops when causes form a cycle", () => {
    const error = new Error("outer") as Error & { cause?: unknown };
    error.cause = error;
    expect(databaseErrorIncludes(error, "missing")).toBe(false);
  });
});
