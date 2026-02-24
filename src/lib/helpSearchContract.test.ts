import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./cache", () => ({
  buildCachePath: vi.fn(() => "/tmp/search-cache.json"),
  readCache: vi.fn().mockResolvedValue(null),
  writeCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./latestSearch", () => ({
  storeLatestSearch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./browserConsent", () => ({
  acceptOneTrust: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./tokenStore", () => ({
  loadToken: vi.fn(),
  isTokenValid: vi.fn(),
  storeToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./coveoSearchClient", () => ({
  searchCoveoViaFetch: vi.fn(),
  searchCoveoViaRequest: vi.fn(),
}));

vi.mock("./coveoTokenResolver", () => ({
  obtainAuraTokenFromPage: vi.fn(),
}));

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

import { searchHelp } from "./helpSearch";
import { loadToken, isTokenValid } from "./tokenStore";
import { searchCoveoViaFetch, searchCoveoViaRequest } from "./coveoSearchClient";
import { obtainAuraTokenFromPage } from "./coveoTokenResolver";
import { chromium } from "playwright";

const baseToken = {
  accessToken: "token.value",
  organizationId: "org",
  searchHub: "hub",
  endpointBase: "https://help.salesforce.com/services/apexrest/coveo",
  clientUri: "https://platform.cloud.coveo.com",
  filterer: null,
  expiresAtMs: Date.now() + 60_000,
};

describe("searchHelp contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses token fetch path and skips browser launch when token search succeeds", async () => {
    vi.mocked(loadToken).mockResolvedValue(baseToken);
    vi.mocked(isTokenValid).mockReturnValue(true);
    vi.mocked(searchCoveoViaFetch).mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        results: [
          {
            raw: {
              uri: "https://help.salesforce.com/s/articleView?id=doc_a&type=5",
            },
            title: "Doc A",
          },
        ],
      },
    });

    const results = await searchHelp({
      query: "roles",
      useCache: false,
      debug: false,
    });

    expect(results).toHaveLength(1);
    expect(results[0].url).toContain("help.salesforce.com");
    expect(searchCoveoViaFetch).toHaveBeenCalledTimes(1);
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  it("falls back to browser path when token fetch path does not return usable results", async () => {
    vi.mocked(loadToken).mockResolvedValue(baseToken);
    vi.mocked(isTokenValid).mockReturnValue(true);
    vi.mocked(searchCoveoViaFetch).mockResolvedValue({
      ok: false,
      status: 401,
      data: null,
    });

    vi.mocked(obtainAuraTokenFromPage).mockResolvedValue(baseToken);
    vi.mocked(searchCoveoViaRequest).mockResolvedValue({
      ok: false,
      status: 500,
      data: null,
    });

    const coveoResponse = {
      request: () => ({
        url: () => "https://platform.cloud.coveo.com/rest/search/v2",
        postData: () => JSON.stringify({ numberOfResults: 10 }),
      }),
      json: vi.fn().mockResolvedValue({
        results: [
          {
            raw: {
              uri: "https://developer.salesforce.com/docs/commerce/guide/example.html",
            },
            title: "Dev Doc",
          },
        ],
      }),
    };

    const page = {
      on: vi.fn(),
      waitForResponse: vi
        .fn()
        .mockResolvedValueOnce(coveoResponse)
        .mockResolvedValueOnce(null),
      goto: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn(() => ({
        first: () => ({
          waitFor: vi.fn().mockResolvedValue(undefined),
        }),
      })),
    };

    const context = {
      newPage: vi.fn().mockResolvedValue(page),
      request: {
        post: vi.fn().mockResolvedValue({
          ok: () => false,
          status: () => 500,
        }),
      },
    };

    const browser = {
      newContext: vi.fn().mockResolvedValue(context),
      close: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(chromium.launch).mockResolvedValue(browser as never);

    const results = await searchHelp({
      query: "roles",
      useCache: false,
      debug: false,
      limit: 10,
    });

    expect(chromium.launch).toHaveBeenCalledTimes(1);
    expect(searchCoveoViaFetch).toHaveBeenCalledTimes(1);
    expect(searchCoveoViaRequest).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0].url).toContain("developer.salesforce.com");
  });
});
