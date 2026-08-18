import { describe, expect, it } from "vitest";
import { isValidDomain, normalizeDomain, REQUIRED_ALLOWED_DOMAINS } from "./email-domain";

describe("email domains", () => {
  it("always includes the GeoPostcodes domain", () => {
    expect(REQUIRED_ALLOWED_DOMAINS).toContain("geopostcodes.com");
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(normalizeDomain("  GeoPostcodes.COM ")).toBe("geopostcodes.com");
  });

  it("accepts hostnames and rejects email addresses and malformed domains", () => {
    expect(isValidDomain("team.example.com")).toBe(true);
    expect(isValidDomain("person@example.com")).toBe(false);
    expect(isValidDomain("-bad.example.com")).toBe(false);
  });
});
