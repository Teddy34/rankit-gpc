import { describe, expect, it } from "vitest";
import { buildRatingHistory } from "./rating-history";

const players = [
  { id: 1, displayName: "Amy", avatar: "🎱", initialRating: 1500, retired: false },
  { id: 2, displayName: "Zoe", avatar: "🦊", initialRating: 1500, retired: false },
  { id: 3, displayName: "No games", avatar: "👻", initialRating: 1600, retired: true },
];

describe("rating history", () => {
  it("records a baseline and the rating after each game a player participates in", () => {
    const history = buildRatingHistory(players, [
      { id: 1, playerOneId: 1, playerTwoId: 2, playerOneName: "Amy", playedOn: "2026-08-01", result: "player_one", sequence: 1 },
      { id: 2, playerOneId: 2, playerTwoId: 1, playerOneName: "Zoe", playedOn: "2026-08-02", result: "draw", sequence: 2 },
    ]);

    expect(history[0].points).toEqual([
      { gameIndex: 0, playedOn: "2026-08-01", rating: 1500 },
      { gameIndex: 1, playedOn: "2026-08-01", rating: 1518 },
      { gameIndex: 2, playedOn: "2026-08-02", rating: 1516 },
    ]);
    expect(history[1].points.map((point) => point.rating)).toEqual([1500, 1482, 1484]);
  });

  it("starts a late player's line immediately before their first game", () => {
    const history = buildRatingHistory(players, [
      { id: 1, playerOneId: 1, playerTwoId: 2, playerOneName: "Amy", playedOn: "2026-08-01", result: "player_one", sequence: 1 },
      { id: 2, playerOneId: 1, playerTwoId: 3, playerOneName: "Amy", playedOn: "2026-08-02", result: "draw", sequence: 2 },
    ]);

    expect(history[2].points[0]).toEqual({ gameIndex: 1, playedOn: "2026-08-02", rating: 1600 });
    expect(history[2].retired).toBe(true);
  });

  it("keeps players without games available to the filter", () => {
    const history = buildRatingHistory(players, []);
    expect(history.map((player) => player.points)).toEqual([[], [], []]);
  });
});
