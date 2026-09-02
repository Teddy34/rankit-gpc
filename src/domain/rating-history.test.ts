import { describe, expect, it } from "vitest";
import { buildRatingHistory } from "./rating-history";

const players = [
  { id: 1, displayName: "Amy", avatar: "🎱", avatarImageUrl: null, initialRating: 1500, retired: false },
  { id: 2, displayName: "Zoe", avatar: "🦊", avatarImageUrl: null, initialRating: 1500, retired: false },
  { id: 3, displayName: "No games", avatar: "👻", avatarImageUrl: null, initialRating: 1600, retired: true },
];

describe("rating history", () => {
  it("records a baseline and the rating after each game a player participates in", () => {
    const history = buildRatingHistory(players, [
      { id: 1, playerOneId: 1, playerTwoId: 2, playerOneName: "Amy", playedOn: "2026-08-01", result: "player_one", sequence: 1 },
      { id: 2, playerOneId: 2, playerTwoId: 1, playerOneName: "Zoe", playedOn: "2026-08-02", result: "draw", sequence: 2 },
    ]);

    expect(history[0].points).toEqual([
      { eventIndex: 0, date: "2026-08-01", rating: 1500, kind: "baseline" },
      { eventIndex: 1, date: "2026-08-01", rating: 1518, kind: "game" },
      { eventIndex: 2, date: "2026-08-02", rating: 1516, kind: "game" },
    ]);
    expect(history[1].points.map((point) => point.rating)).toEqual([1500, 1482, 1484]);
  });

  it("starts a late player's line immediately before their first game", () => {
    const history = buildRatingHistory(players, [
      { id: 1, playerOneId: 1, playerTwoId: 2, playerOneName: "Amy", playedOn: "2026-08-01", result: "player_one", sequence: 1 },
      { id: 2, playerOneId: 1, playerTwoId: 3, playerOneName: "Amy", playedOn: "2026-08-02", result: "draw", sequence: 2 },
    ]);

    expect(history[2].points[0]).toEqual({ eventIndex: 1, date: "2026-08-02", rating: 1600, kind: "baseline" });
    expect(history[2].retired).toBe(true);
  });

  it("keeps players without games available to the filter", () => {
    const history = buildRatingHistory(players, []);
    expect(history.map((player) => player.points)).toEqual([[], [], []]);
  });

  it("records a reset as its own point, without disturbing games recorded before it", () => {
    const history = buildRatingHistory(players.slice(0, 2), [
      { id: 1, playerOneId: 1, playerTwoId: 2, playerOneName: "Amy", playedOn: "2026-08-01", result: "player_one", sequence: 1 },
      { id: 2, playerOneId: 1, playerTwoId: 2, playerOneName: "Amy", playedOn: "2026-08-03", result: "player_one", sequence: 3 },
    ], [
      { id: 1, userId: 1, rating: 1627, effectiveOn: "2026-08-02", sequence: 2 },
    ]);

    expect(history[0].points).toEqual([
      { eventIndex: 0, date: "2026-08-01", rating: 1500, kind: "baseline" },
      { eventIndex: 1, date: "2026-08-01", rating: 1518, kind: "game" }, // unaffected by the later reset
      { eventIndex: 2, date: "2026-08-02", rating: 1627, kind: "reset" },
      { eventIndex: 3, date: "2026-08-03", rating: 1638, kind: "game" }, // computed from 1627, not 1518
    ]);
  });
});
