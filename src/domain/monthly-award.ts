export type AwardLevel = "bronze" | "silver" | "gold";

export type MonthlyAward = { level: AwardLevel; month: string; streak: number };

export function awardLevelForStreak(streak: number): AwardLevel {
  if (streak < 1 || !Number.isInteger(streak)) throw new Error("Award streak must be a positive integer");
  if (streak === 1) return "bronze";
  if (streak === 2) return "silver";
  return "gold";
}

export function formatAwardMonth(month: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

/** A one-line explanation of why an award was won, distinct per level, for use as a tooltip. */
export function describeAward(award: MonthlyAward): string {
  const monthLabel = formatAwardMonth(previousMonth(award.month));
  if (award.level === "bronze") return `Bronze — top-rated player in ${monthLabel}`;
  return `${award.level === "silver" ? "Silver" : "Gold"} — top-rated player for ${award.streak} straight months, through ${monthLabel}`;
}

export function brusselsMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("Could not determine the Brussels month");
  return `${year}-${month}`;
}

export function previousMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) throw new Error("Invalid month");
  return new Date(Date.UTC(year, monthNumber - 2, 1)).toISOString().slice(0, 7);
}

export function monthsAfter(lastMonth: string | null, currentMonth: string): string[] {
  if (!lastMonth) return [currentMonth];
  const months: string[] = [];
  let cursor = lastMonth;
  while (cursor < currentMonth) {
    const [year, month] = cursor.split("-").map(Number);
    cursor = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
    if (cursor <= currentMonth) months.push(cursor);
  }
  return months;
}
