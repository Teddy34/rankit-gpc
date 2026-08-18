export type StreakGame = {
  playerOneId: number;
  playerTwoId: number;
  result: "player_one" | "player_two" | "draw";
  playedOn: string;
  sequence: number;
};

export function calculateWinningStreaks(games: StreakGame[]): Map<number, number> {
  const streaks = new Map<number, number>();
  const orderedGames = [...games].sort((a, b) =>
    a.playedOn.localeCompare(b.playedOn) ||
    a.sequence - b.sequence,
  );

  for (const game of orderedGames) {
    if (game.result === "draw") {
      streaks.set(game.playerOneId, 0);
      streaks.set(game.playerTwoId, 0);
      continue;
    }
    const winnerId = game.result === "player_one" ? game.playerOneId : game.playerTwoId;
    const loserId = game.result === "player_one" ? game.playerTwoId : game.playerOneId;
    streaks.set(winnerId, (streaks.get(winnerId) ?? 0) + 1);
    streaks.set(loserId, 0);
  }
  return streaks;
}
