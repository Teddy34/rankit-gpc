import { describe, expect, it } from "vitest";
import { brusselsWeekStart, calculateWeeklyTrends } from "./weekly-trend";

describe("weekly trend", () => {
  it("uses Monday in Brussels even while it is still Sunday in UTC", () => {
    expect(brusselsWeekStart(new Date("2026-07-19T22:30:00Z"))).toBe("2026-07-20");
  });

  it("returns the previous Monday on a Brussels Sunday", () => {
    expect(brusselsWeekStart(new Date("2026-07-19T12:00:00Z"))).toBe("2026-07-13");
  });

  it("sums only rating changes from the current week", () => {
    const trends = calculateWeeklyTrends([
      { playedOn: "2026-07-19", playerOneId: 1, playerTwoId: 2, playerOneDelta: 18, playerTwoDelta: -18 },
      { playedOn: "2026-07-20", playerOneId: 1, playerTwoId: 2, playerOneDelta: -20, playerTwoDelta: 20 },
      { playedOn: "2026-07-22", playerOneId: 1, playerTwoId: 3, playerOneDelta: 9, playerTwoDelta: -9 },
    ], "2026-07-20");
    expect(trends).toEqual(new Map([[1, -11], [2, 20], [3, -9]]));
  });
});
