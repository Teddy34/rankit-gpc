export type TrendGame = {
  playedOn: string;
  playerOneId: number;
  playerTwoId: number;
  playerOneDelta: number;
  playerTwoDelta: number;
};

const weekdayIndex: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export function brusselsWeekStart(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = Number(value("year"));
  const month = Number(value("month"));
  const day = Number(value("day"));
  const weekday = weekdayIndex[value("weekday") ?? ""];
  if (!year || !month || !day || weekday === undefined) throw new Error("Could not determine the Brussels calendar date");

  const daysSinceMonday = (weekday + 6) % 7;
  const monday = new Date(Date.UTC(year, month - 1, day - daysSinceMonday));
  return monday.toISOString().slice(0, 10);
}

export function calculateWeeklyTrends(games: TrendGame[], weekStart: string): Map<number, number> {
  const trends = new Map<number, number>();
  for (const game of games) {
    if (game.playedOn < weekStart) continue;
    trends.set(game.playerOneId, (trends.get(game.playerOneId) ?? 0) + game.playerOneDelta);
    trends.set(game.playerTwoId, (trends.get(game.playerTwoId) ?? 0) + game.playerTwoDelta);
  }
  return trends;
}
