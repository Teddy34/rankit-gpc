import { describe, expect, it } from "vitest";
import { awardLevelForStreak, brusselsMonth, monthsAfter, previousMonth } from "./monthly-award";

describe("monthly awards", () => {
  it("promotes consecutive wins from bronze to silver to gold", () => {
    expect(awardLevelForStreak(1)).toBe("bronze");
    expect(awardLevelForStreak(2)).toBe("silver");
    expect(awardLevelForStreak(3)).toBe("gold");
    expect(awardLevelForStreak(7)).toBe("gold");
  });

  it("uses the Brussels month around a UTC boundary", () => {
    expect(brusselsMonth(new Date("2026-07-31T22:30:00Z"))).toBe("2026-08");
  });

  it("handles year boundaries and catch-up months", () => {
    expect(previousMonth("2027-01")).toBe("2026-12");
    expect(monthsAfter("2026-11", "2027-02")).toEqual(["2026-12", "2027-01", "2027-02"]);
  });
});
