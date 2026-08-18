import { describe, expect, it } from "vitest";
import { calculateRatingChange, expectedScore } from "./elo";

describe("Elo calculation", () => {
  it("is zero-sum and rounds once per game", () => {
    expect(calculateRatingChange(1500, 1500, 1)).toEqual({
      playerOneDelta: 18,
      playerTwoDelta: -18,
      playerOneRating: 1518,
      playerTwoRating: 1482,
    });
  });

  it("supports draws", () => {
    expect(calculateRatingChange(1600, 1400, 0.5)).toEqual({
      playerOneDelta: -9,
      playerTwoDelta: 9,
      playerOneRating: 1591,
      playerTwoRating: 1409,
    });
  });

  it("matches the documented K-factor compatibility calculation", () => {
    const result = calculateRatingChange(1646, 1661, 1);
    expect(result.playerOneDelta).toBe(19);
    expect(result.playerTwoDelta).toBe(-19);
  });

  it("gives complementary expected scores", () => {
    expect(expectedScore(1700, 1500) + expectedScore(1500, 1700)).toBeCloseTo(1);
  });
});
