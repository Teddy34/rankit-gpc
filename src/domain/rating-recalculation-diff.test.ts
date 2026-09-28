import { describe, expect, it } from "vitest";
import { gamesToUpdate, ratingsToUpdate } from "./rating-recalculation-diff";

describe("gamesToUpdate", () => {
  it("skips games whose delta is unchanged", () => {
    const stored = [{ id: 1, playerOneDelta: 20, playerTwoDelta: -20 }, { id: 2, playerOneDelta: -10, playerTwoDelta: 10 }];
    const replayed = [{ id: 1, playerOneDelta: 20, playerTwoDelta: -20 }, { id: 2, playerOneDelta: -10, playerTwoDelta: 10 }];
    expect(gamesToUpdate(stored, replayed)).toEqual([]);
  });

  it("includes a game whose delta changed", () => {
    const stored = [{ id: 1, playerOneDelta: 20, playerTwoDelta: -20 }, { id: 2, playerOneDelta: -10, playerTwoDelta: 10 }];
    const replayed = [{ id: 1, playerOneDelta: 20, playerTwoDelta: -20 }, { id: 2, playerOneDelta: -12, playerTwoDelta: 12 }];
    expect(gamesToUpdate(stored, replayed)).toEqual([{ id: 2, playerOneDelta: -12, playerTwoDelta: 12 }]);
  });

  it("includes a newly replayed game that has no stored row yet", () => {
    const replayed = [{ id: 1, playerOneDelta: 5, playerTwoDelta: -5 }];
    expect(gamesToUpdate([], replayed)).toEqual(replayed);
  });
});

describe("ratingsToUpdate", () => {
  it("skips players whose rating is unchanged", () => {
    const stored = [{ id: 1, currentRating: 1500 }, { id: 2, currentRating: 1480 }];
    const replayed = new Map([[1, 1500], [2, 1480]]);
    expect(ratingsToUpdate(stored, replayed)).toEqual([]);
  });

  it("includes only the players whose rating changed", () => {
    const stored = [{ id: 1, currentRating: 1500 }, { id: 2, currentRating: 1480 }];
    const replayed = new Map([[1, 1500], [2, 1499]]);
    expect(ratingsToUpdate(stored, replayed)).toEqual([{ id: 2, currentRating: 1499 }]);
  });

  it("includes a player with no stored rating yet", () => {
    const replayed = new Map([[1, 1500]]);
    expect(ratingsToUpdate([], replayed)).toEqual([{ id: 1, currentRating: 1500 }]);
  });
});
