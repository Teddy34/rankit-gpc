import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const remoteUrlPattern = /^(?:libsql|https|wss):\/\//;

export function databaseConfig(): { url: string; authToken?: string } {
  const configuredUrl = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "./data/rankit.sqlite";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (remoteUrlPattern.test(configuredUrl)) {
    return { url: configuredUrl, ...(authToken ? { authToken } : {}) };
  }

  if (configuredUrl === ":memory:" || configuredUrl === "file::memory:") {
    return { url: "file::memory:" };
  }

  const databasePath = configuredUrl.startsWith("file:") ? configuredUrl.slice("file:".length) : configuredUrl;
  mkdirSync(dirname(databasePath), { recursive: true });
  return { url: configuredUrl.startsWith("file:") ? configuredUrl : `file:${configuredUrl}` };
}
