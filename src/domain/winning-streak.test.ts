import { describe, expect, it } from "vitest";
import { calculateWinningStreaks, type StreakGame } from "./winning-streak";

const game = (sequence: number, playerOneId: number, playerTwoId: number, result: StreakGame["result"]): StreakGame => ({
  sequence, playerOneId, playerTwoId, result, playedOn: `2026-07-${String(sequence).padStart(2, "0")}`,
});

describe("winning streaks", () => {
  it("counts consecutive personal wins while ignoring other players' games", () => {
    const streaks = calculateWinningStreaks([
      game(1, 1, 2, "player_one"),
      game(2, 3, 4, "player_one"),
      game(3, 2, 1, "player_two"),
      game(4, 1, 3, "player_one"),
    ]);
    expect(streaks.get(1)).toBe(3);
  });

  it("resets a streak after a loss or draw", () => {
    const afterLoss = calculateWinningStreaks([game(1, 1, 2, "player_one"), game(2, 1, 2, "player_two")]);
    const afterDraw = calculateWinningStreaks([game(1, 1, 2, "player_one"), game(2, 1, 2, "draw")]);
    expect(afterLoss.get(1)).toBe(0);
    expect(afterDraw.get(1)).toBe(0);
  });

  it("uses permanent sequence for games played on the same date", () => {
    const sameDayGames: StreakGame[] = [
      { ...game(2, 1, 2, "player_one"), playedOn: "2026-07-22" },
      { ...game(3, 1, 2, "player_one"), playedOn: "2026-07-22" },
      { ...game(1, 2, 1, "player_one"), playedOn: "2026-07-22" },
      { ...game(4, 1, 2, "player_one"), playedOn: "2026-07-27" },
    ];
    expect(calculateWinningStreaks(sameDayGames).get(1)).toBe(3);
  });
});
