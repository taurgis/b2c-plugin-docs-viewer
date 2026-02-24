import type { APIRequestContext } from "playwright";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchCoveoViaFetch, searchCoveoViaRequest } from "./coveoSearchClient";

const tokenInfo = {
  accessToken: "header.token.value",
  organizationId: "org1",
  searchHub: "HTCommunity",
  endpointBase: "https://help.salesforce.com/services/apexrest/coveo",
  clientUri: "https://platform.cloud.coveo.com",
  filterer: null,
  expiresAtMs: Date.now() + 60_000,
};

function buildParams() {
  return {
    tokenInfo,
    query: "roles",
    language: "en_US",
    limit: 5,
    timeoutMs: 10_000,
    debug: false,
  };
}

describe("coveoSearchClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses Authorization header first, then falls back to query token on auth errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ results: [] }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await searchCoveoViaFetch(buildParams());

    expect(result?.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstCall = fetchMock.mock.calls[0] as [string, { headers?: Record<string, string> }];
    const secondCall = fetchMock.mock.calls[1] as [string, { headers?: Record<string, string> }];

    expect(firstCall[0]).not.toContain("access_token=");
    expect(firstCall[1].headers?.authorization).toBe("Bearer header.token.value");
    expect(secondCall[0]).toContain("access_token=header.token.value");
  });

  it("does not fall back to query token on non-auth HTTP failures", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchCoveoViaFetch(buildParams());

    expect(result?.ok).toBe(false);
    expect(result?.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("applies the same header-first then query-token fallback behavior for APIRequestContext", async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce({ ok: () => false, status: () => 403 })
      .mockResolvedValueOnce({
        ok: () => true,
        status: () => 200,
        json: vi.fn().mockResolvedValue({ results: [] }),
      });

    const request = { post } as unknown as APIRequestContext;
    const result = await searchCoveoViaRequest(request, buildParams());

    expect(result?.ok).toBe(true);
    expect(post).toHaveBeenCalledTimes(2);

    const firstCall = post.mock.calls[0] as [string, { headers?: Record<string, string> }];
    const secondCall = post.mock.calls[1] as [string, { headers?: Record<string, string> }];

    expect(firstCall[0]).not.toContain("access_token=");
    expect(firstCall[1].headers?.authorization).toBe("Bearer header.token.value");
    expect(secondCall[0]).toContain("access_token=header.token.value");
  });
});
