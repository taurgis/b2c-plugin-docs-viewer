import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/helpSearch", async () => {
  const actual = await vi.importActual<typeof import("./lib/helpSearch")>("./lib/helpSearch");
  return {
    ...actual,
    searchHelp: vi.fn(),
  };
});

vi.mock("./lib/helpScraper", () => ({
  createScraperSession: vi.fn(),
  getDetailSourceType: vi.fn((value: string) =>
    value.includes("developer.salesforce.com") ? "developer" : "help"
  ),
  getHelpDetails: vi.fn(),
}));

import { readHelpDoc, resolveHelpDoc, searchHelpDocs } from "./api";
import { HELP_DOCS_ERROR_CODES, HelpDocsApiError } from "./apiErrors";
import { getHelpDetails } from "./lib/helpScraper";
import { searchHelp } from "./lib/helpSearch";

describe("programmatic API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns normalized search results with source metadata", async () => {
    vi.mocked(searchHelp).mockResolvedValue([
      {
        title: "Roles",
        url: "https://help.salesforce.com/help_doccontent?language=en_US&id=cc.roles&type=5",
      },
      {
        title: "Developer Guide",
        url: "https://developer.salesforce.com/docs/commerce/example",
      },
    ]);

    const result = await searchHelpDocs({
      query: "roles",
      language: "en_US",
      limit: 2,
      cache: false,
    });

    expect(result.query).toBe("roles");
    expect(result.count).toBe(2);
    expect(result.results[0]).toMatchObject({
      id: 1,
      rank: 1,
      title: "Roles",
      source: "help",
      hostname: "help.salesforce.com",
    });
    expect(result.results[0].url).toBe(
      "https://help.salesforce.com/s/articleView?id=cc.roles.htm&type=5&language=en_US"
    );
    expect(result.results[1]).toMatchObject({
      id: 2,
      rank: 2,
      title: "Developer Guide",
      source: "developer",
      hostname: "developer.salesforce.com",
      url: "https://developer.salesforce.com/docs/commerce/example",
    });
  });

  it("returns markdown for a resolved article and includes raw HTML when requested", async () => {
    vi.mocked(getHelpDetails).mockResolvedValue({
      url: "https://help.salesforce.com/s/articleView?id=cc.roles.htm&type=5",
      title: "Roles",
      markdown: "# Roles\n\nBody",
      rawHtml: "<article>Body</article>",
    });

    const result = await readHelpDoc(
      "https://help.salesforce.com/s/articleView?id=cc.roles.htm&type=5",
      {
        cache: false,
        includeRawHtml: true,
      }
    );

    expect(getHelpDetails).toHaveBeenCalledWith({
      url: "https://help.salesforce.com/s/articleView?id=cc.roles.htm&type=5",
      timeoutMs: undefined,
      waitMs: undefined,
      headed: undefined,
      useCache: false,
      includeRawHtml: true,
      debug: undefined,
      session: undefined,
    });
    expect(result).toMatchObject({
      title: "Roles",
      source: "help",
      hostname: "help.salesforce.com",
      markdown: "# Roles\n\nBody",
      rawHtml: "<article>Body</article>",
    });
  });

  it("returns stable invalid URL errors", async () => {
    await expect(readHelpDoc("not a url")).rejects.toMatchObject({
      code: HELP_DOCS_ERROR_CODES.INVALID_URL,
    });
  });

  it("returns stable unsupported host errors", async () => {
    await expect(readHelpDoc("https://example.com/article")).rejects.toMatchObject({
      code: HELP_DOCS_ERROR_CODES.UNSUPPORTED_HOST,
    });
  });

  it("resolves metadata from a supported article reference", () => {
    expect(resolveHelpDoc("https://developer.salesforce.com/docs/commerce/example")).toEqual({
      url: "https://developer.salesforce.com/docs/commerce/example",
      source: "developer",
      hostname: "developer.salesforce.com",
    });
  });

  it("uses stable custom error classes", async () => {
    await expect(readHelpDoc("http://help.salesforce.com/s/articleView?id=test&type=5")).rejects.toBeInstanceOf(
      HelpDocsApiError
    );
  });
});