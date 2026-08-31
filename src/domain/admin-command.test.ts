import { describe, expect, it } from "vitest";
import { parseAdminCommand } from "./admin-command";

describe("parseAdminCommand", () => {
  it.each(["help", "helper", "?"])("accepts the %s help alias", (input) => {
    expect(parseAdminCommand(input)).toEqual({ ok: true, command: { type: "help" } });
  });

  it.each(["players", "players list", "list players"])("accepts the %s player-list alias", (input) => {
    expect(parseAdminCommand(input)).toEqual({ ok: true, command: { type: "list_players" } });
  });

  it("accepts a quoted player name", () => {
    expect(parseAdminCommand('retire "Ada Lovelace"')).toEqual({
      ok: true,
      command: { type: "retire", player: "Ada Lovelace" },
    });
  });

  it("requires explicit delete confirmation", () => {
    expect(parseAdminCommand("delete 42 --confirm")).toEqual({
      ok: true,
      command: { type: "delete", player: "42", confirmed: true },
    });
  });

  it("defaults Elo resets to 1500", () => {
    expect(parseAdminCommand("elo reset player@example.com")).toEqual({
      ok: true,
      command: { type: "reset_elo", player: "player@example.com", rating: 1500 },
    });
  });

  it("accepts a custom Elo baseline", () => {
    expect(parseAdminCommand('elo reset "Ada Lovelace" to 1400')).toEqual({
      ok: true,
      command: { type: "reset_elo", player: "Ada Lovelace", rating: 1400 },
    });
  });

  it("accepts a domain", () => {
    expect(parseAdminCommand("domain add Example.COM")).toEqual({
      ok: true,
      command: { type: "add_domain", domain: "example.com" },
    });
  });
});
