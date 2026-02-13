import { describe, expect, it } from "vitest";
import { extractResults, normalizeHelpDocContentUrl } from "./helpSearch";

describe("normalizeHelpDocContentUrl", () => {
  it("normalizes Help_DocContent links to articleView format", () => {
    const input =
      "https://help.salesforce.com/Help_DocContent?id=release-notes.rn_automate_flow&language=en_us&release=260.0.0";

    const result = normalizeHelpDocContentUrl(input);

    expect(result).toBe(
      "https://help.salesforce.com/s/articleView?id=release-notes.rn_automate_flow.htm&type=5&release=260.0.0&language=en_us"
    );
  });
});

describe("extractResults", () => {
  const data = {
    results: [
      {
        raw: {
          uri: "https://help.salesforce.com/s/articleView?id=cc.b2c_roles_and_permissions.htm&type=5",
        },
        title: "Help Article",
      },
      {
        raw: {
          uri: "https://developer.salesforce.com/docs/commerce/commerce-api/guide/quick-start.html",
        },
        title: "Developer Guide",
      },
      {
        raw: {
          uri: "https://example.com/other-docs",
        },
        title: "External",
      },
      {
        raw: {
          uri: "https://help.salesforce.com/s/login",
        },
        title: "Login",
      },
    ],
  };

  it("keeps Help + Developer results by default and excludes other hosts", () => {
    const results = extractResults(data, { includeNonHelp: false, limit: 10 });
    const urls = results.map((item) => item.url);

    expect(urls).toContain(
      "https://help.salesforce.com/s/articleView?id=cc.b2c_roles_and_permissions.htm&type=5"
    );
    expect(urls).toContain(
      "https://developer.salesforce.com/docs/commerce/commerce-api/guide/quick-start.html"
    );
    expect(urls).not.toContain("https://example.com/other-docs");
    expect(urls).not.toContain("https://help.salesforce.com/s/login");
  });

  it("includes external hosts when includeNonHelp is enabled", () => {
    const results = extractResults(data, { includeNonHelp: true, limit: 10 });
    const urls = results.map((item) => item.url);

    expect(urls).toContain("https://example.com/other-docs");
  });
});
