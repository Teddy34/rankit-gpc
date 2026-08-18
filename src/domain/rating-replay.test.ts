import { describe, expect, it } from "vitest";
import { replayRatings } from "./rating-replay";

const players = [{ id: 1, initialRating: 1500 }, { id: 2, initialRating: 1500 }, { id: 3, initialRating: 1500 }];

describe("rating replay", () => {
  it("orders same-day games by player-one name before permanent sequence", () => {
    const result = replayRatings(players, [
      { id: 1, playerOneId: 1, playerTwoId: 2, playerOneName: "Zoe", playedOn: "2026-07-20", result: "player_one", sequence: 1 },
      { id: 2, playerOneId: 2, playerTwoId: 3, playerOneName: "Amy", playedOn: "2026-07-20", result: "player_one", sequence: 2 },
    ]);
    expect(result.games.map((game) => game.id)).toEqual([2, 1]);
    expect(result.ratings.get(1)).toBe(1519);
    expect(result.ratings.get(2)).toBe(1499);
    expect(result.ratings.get(3)).toBe(1482);
  });

  it("recalculates later games when a historical game is inserted", () => {
    const result = replayRatings(players.slice(0, 2), [
      { id: 2, playerOneId: 1, playerTwoId: 2, playerOneName: "A", playedOn: "2026-07-21", result: "player_one", sequence: 2 },
      { id: 1, playerOneId: 2, playerTwoId: 1, playerOneName: "B", playedOn: "2026-07-20", result: "player_one", sequence: 1 },
    ]);
    expect(result.games.map((game) => game.playerOneDelta)).toEqual([18, 20]);
    expect(result.ratings.get(1)).toBe(1502);
    expect(result.ratings.get(2)).toBe(1498);
  });

  it("restores ratings when the only game is removed before replay", () => {
    const result = replayRatings(players.slice(0, 2), []);
    expect(result.ratings).toEqual(new Map([[1, 1500], [2, 1500]]));
    expect(result.games).toEqual([]);
  });
});
