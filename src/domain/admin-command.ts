export type AdminCommand =
  | { type: "help" }
  | { type: "retire"; player: string }
  | { type: "unretire"; player: string }
  | { type: "delete"; player: string; confirmed: boolean }
  | { type: "reset_elo"; player: string; rating: number }
  | { type: "add_domain"; domain: string };

export type ParsedAdminCommand =
  | { ok: true; command: AdminCommand }
  | { ok: false; message: string };

function cleanArgument(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function parseAdminCommand(input: string): ParsedAdminCommand {
  const command = input.trim().replace(/\s+/g, " ");
  const lower = command.toLocaleLowerCase("en-US");

  if (lower === "help" || lower === "helper" || lower === "?") return { ok: true, command: { type: "help" } };

  for (const [prefix, type] of [["retire ", "retire"], ["unretire ", "unretire"]] as const) {
    if (lower.startsWith(prefix)) {
      const player = cleanArgument(command.slice(prefix.length));
      return player ? { ok: true, command: { type, player } } : { ok: false, message: `Usage: ${prefix.trim()} <player>` };
    }
  }

  if (lower.startsWith("delete ")) {
    const confirmed = lower.endsWith(" --confirm");
    const end = confirmed ? command.length - " --confirm".length : command.length;
    const player = cleanArgument(command.slice("delete ".length, end));
    return player
      ? { ok: true, command: { type: "delete", player, confirmed } }
      : { ok: false, message: "Usage: delete <player>" };
  }

  if (lower.startsWith("elo reset ")) {
    const argument = command.slice("elo reset ".length);
    const ratingMatch = argument.match(/\s+to\s+(\d+)$/i);
    const rating = ratingMatch ? Number(ratingMatch[1]) : 1500;
    const player = cleanArgument(ratingMatch ? argument.slice(0, ratingMatch.index) : argument);
    if (!player) return { ok: false, message: "Usage: elo reset <player> [to <rating>]" };
    if (!Number.isInteger(rating) || rating < 1000 || rating > 2000) {
      return { ok: false, message: "Elo must be a whole number from 1000 to 2000." };
    }
    return { ok: true, command: { type: "reset_elo", player, rating } };
  }

  if (lower.startsWith("domain add ")) {
    const domain = cleanArgument(command.slice("domain add ".length)).toLocaleLowerCase("en-US");
    return domain
      ? { ok: true, command: { type: "add_domain", domain } }
      : { ok: false, message: "Usage: domain add <domain>" };
  }

  return { ok: false, message: "Unknown command. Run `help` for available commands." };
}
