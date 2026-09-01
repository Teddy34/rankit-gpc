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

  it("applies a reset directly, leaving earlier games and other players untouched", () => {
    const result = replayRatings(players, [
      { id: 1, playerOneId: 1, playerTwoId: 2, playerOneName: "A", playedOn: "2026-07-20", result: "player_one", sequence: 1 },
      { id: 2, playerOneId: 1, playerTwoId: 3, playerOneName: "A", playedOn: "2026-07-22", result: "player_one", sequence: 3 },
    ], [
      { id: 1, userId: 1, rating: 1600, effectiveOn: "2026-07-21", sequence: 2 },
    ]);

    expect(result.games[0].playerOneDelta).toBe(18); // unaffected by the later reset
    expect(result.ratings.get(2)).toBe(1482); // never plays player 1 again; untouched by the reset
    expect(result.resets[0]).toMatchObject({ userId: 1, rating: 1600, previousRating: 1518 });
    expect(result.games[1].playerOneDelta).toBe(13); // computed from the post-reset 1600, not 1518
    expect(result.ratings.get(1)).toBe(1613);
    expect(result.ratings.get(3)).toBe(1487);
    expect(result.timeline.map((event) => event.kind)).toEqual(["game", "reset", "game"]);
  });

  it("breaks a same-day tie between a game and a reset by sequence", () => {
    const result = replayRatings(players.slice(0, 2), [
      { id: 1, playerOneId: 1, playerTwoId: 2, playerOneName: "A", playedOn: "2026-07-20", result: "player_one", sequence: 2 },
    ], [
      { id: 1, userId: 1, rating: 1700, effectiveOn: "2026-07-20", sequence: 1 },
    ]);
    // reset (sequence 1) applies before the game (sequence 2) despite sharing a date
    expect(result.games[0].playerOneDelta).not.toBe(18); // computed from 1700, not the 1500 baseline
    expect(result.ratings.get(1)).toBeGreaterThan(1700);
  });
});
