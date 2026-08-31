export function databaseErrorIncludes(error: unknown, fragment: string): boolean {
  const seen = new Set<unknown>();
  let current = error;

  for (let depth = 0; depth < 10 && current && !seen.has(current); depth += 1) {
    seen.add(current);
    if (current instanceof Error && current.message.includes(fragment)) return true;
    if (typeof current !== "object") return false;
    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}
