import { describe, expect, it } from "vitest";
import { awardLevelForStreak, brusselsMonth, describeAward, formatAwardMonth, monthsAfter, previousMonth } from "./monthly-award";

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

  it("formats a month key as a human-readable label", () => {
    expect(formatAwardMonth("2026-07")).toBe("July 2026");
  });

  it("describes each level differently", () => {
    expect(describeAward({ level: "bronze", month: "2026-07", streak: 1 })).toBe("Bronze — top-rated player in July 2026");
    expect(describeAward({ level: "silver", month: "2026-08", streak: 2 })).toBe("Silver — top-rated player for 2 straight months, through August 2026");
    expect(describeAward({ level: "gold", month: "2026-10", streak: 4 })).toBe("Gold — top-rated player for 4 straight months, through October 2026");
  });
});
