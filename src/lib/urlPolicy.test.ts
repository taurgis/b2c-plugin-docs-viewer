import { describe, expect, it } from "vitest";
import { isAllowedDocHost, normalizeAndValidateDocUrl } from "./urlPolicy";

describe("urlPolicy", () => {
  it("accepts the two supported documentation hosts", () => {
    expect(isAllowedDocHost("help.salesforce.com")).toBe(true);
    expect(isAllowedDocHost("developer.salesforce.com")).toBe(true);
  });

  it("rejects unsupported hosts", () => {
    expect(isAllowedDocHost("example.com")).toBe(false);
  });

  it("normalizes and validates a supported URL", () => {
    const value = normalizeAndValidateDocUrl(
      "https://help.salesforce.com/s/articleView?id=cc.b2c_roles_and_permissions.htm&type=5"
    );

    expect(value).toContain("help.salesforce.com");
  });

  it("throws for unsupported hosts", () => {
    expect(() => normalizeAndValidateDocUrl("https://example.com/page")).toThrow(
      /Only help\.salesforce\.com and developer\.salesforce\.com/
    );
  });
});
