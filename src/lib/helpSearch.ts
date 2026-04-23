import { chromium } from "playwright";
import type { Response as PlaywrightResponse } from "playwright";
import { buildCachePath, readCache, writeCache } from "./cache";
import { buildChromiumLaunchOptions } from "./browserLaunch";
import { storeLatestSearch } from "./latestSearch";
import {
  isTokenValid,
  loadToken,
  storeToken,
} from "./tokenStore";
import { acceptOneTrust } from "./browserConsent";
import {
  extractResults,
  type SearchResult,
} from "./helpSearchResults";
import { getErrorMessage } from "./errorUtils";
import { searchCoveoViaFetch, searchCoveoViaRequest } from "./coveoSearchClient";
import { obtainAuraTokenFromPage } from "./coveoTokenResolver";

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const SEARCH_PAGE_URL = "https://help.salesforce.com/s/search-result";
const COVEO_SEARCH_PATH = "/services/apexrest/coveo/analytics/rest/search/v2";
const DEFAULT_ORG_ID = "org62salesforce";
const DEFAULT_SEARCH_HUB = "HTCommunity";
const DEFAULT_ENDPOINT_BASE = "https://help.salesforce.com/services/apexrest/coveo";
const DEFAULT_CLIENT_URI = "https://platform.cloud.coveo.com";
export type { SearchResult } from "./helpSearchResults";

export type SearchOptions = {
  query: string;
  language?: string;
  limit?: number;
  timeoutMs?: number;
  useCache?: boolean;
  headed?: boolean;
  debug?: boolean;
};

function normalizeLimit(value: number | undefined): number {
  if (!value || !Number.isFinite(value) || value <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(value), MAX_LIMIT);
}

type ExtractResultsInput = NonNullable<Parameters<typeof extractResults>[0]>;

function hasResultsArray(value: unknown): value is ExtractResultsInput {
  if (!value || typeof value !== "object") return false;
  const maybeResults = (value as { results?: unknown }).results;
  return Array.isArray(maybeResults);
}

function buildSearchUrl(query: string, language: string): string {
  const url = new URL(SEARCH_PAGE_URL);
  if (language) {
    url.searchParams.set("language", language);
  }
  if (query) {
    const hashParams = new URLSearchParams();
    hashParams.set("q", query);
    hashParams.set("t", "allResultsTab");
    hashParams.set("sort", "relevancy");
    url.hash = hashParams.toString();
  }
  return url.toString();
}

export { extractResults, normalizeHelpDocContentUrl } from "./helpSearchResults";

async function searchViaBrowser(
  query: string,
  language: string,
  limit: number,
  timeoutMs: number,
  headed: boolean,
  debug: boolean
): Promise<SearchResult[]> {
  const browser = await chromium.launch(buildChromiumLaunchOptions({ headed }));
  const context = await browser.newContext();
  const page = await context.newPage();
  let captured: { data: any | null; requestPayload: any | null } | null = null;

  page.on("response", async (resp: PlaywrightResponse) => {
    if (!resp.url().includes(COVEO_SEARCH_PATH)) return;
    if (resp.request().method() !== "POST") return;
    try {
      const data = await resp.json();
      let requestPayload: any = {};
      try {
        requestPayload = JSON.parse(resp.request().postData() || "{}");
      } catch {
        requestPayload = {};
      }
      captured = { data, requestPayload };
    } catch (error) {
      if (debug) {
        console.error(`[debug] Failed to capture search response: ${getErrorMessage(error)}`);
      }
    }
  });

  try {
    const searchUrl = buildSearchUrl(query, language);
    const responsePromise = page
      .waitForResponse(
        (resp: PlaywrightResponse) =>
          resp.url().includes(COVEO_SEARCH_PATH) && resp.request().method() === "POST",
        { timeout: timeoutMs }
      )
      .catch((error) => {
        if (debug) {
          console.error(`[debug] Timed out waiting for Coveo response: ${getErrorMessage(error)}`);
        }
        return null;
      });
    const auraTokenPromise = page
      .waitForResponse((resp: PlaywrightResponse) => {
        if (!resp.url().includes("/s/sfsites/aura")) return false;
        if (resp.request().method() !== "POST") return false;
        const postData = resp.request().postData() || "";
        return postData.includes("Search_CoveoTokenGenerator") && postData.includes("getToken");
      }, { timeout: timeoutMs })
      .catch((error) => {
        if (debug) {
          console.error(`[debug] Timed out waiting for Aura token response: ${getErrorMessage(error)}`);
        }
        return null;
      });

    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await acceptOneTrust(page, timeoutMs);
    await page.locator("body").first().waitFor({ state: "visible", timeout: Math.min(timeoutMs, 6000) }).catch((error) => {
      if (debug) {
        console.error(`[debug] Search page body wait failed: ${getErrorMessage(error)}`);
      }
    });

    let results: SearchResult[] = [];

    const tokenInfo = await obtainAuraTokenFromPage(auraTokenPromise, context, page, timeoutMs, debug);
    if (tokenInfo) {
      await storeToken(tokenInfo);
      const searchResult = await searchCoveoViaRequest(context.request, {
        tokenInfo,
        query,
        language,
        limit,
        timeoutMs,
        debug,
      }).catch((error) => {
        if (debug) {
          console.error(`[debug] Direct Coveo request failed: ${getErrorMessage(error)}`);
        }
        return null;
      });

      if (hasResultsArray(searchResult?.data)) {
        results = extractResults(searchResult.data, { limit });
      }
    }

    if (results.length === 0) {
      const response = await responsePromise;
      let data: any | null = null;
      let requestPayload: any = {};
      const requestUrl = response?.request().url() ?? null;

      if (response) {
        const request = response.request();
        try {
          requestPayload = JSON.parse(request.postData() || "{}");
        } catch {
          requestPayload = {};
        }
        data = await response.json().catch((error) => {
          if (debug) {
            console.error(`[debug] Browser search response JSON parse failed: ${getErrorMessage(error)}`);
          }
          return null;
        });
      } else {
        const capturedSnapshot = captured as { data: any | null; requestPayload: any | null } | null;
        if (capturedSnapshot) {
          data = capturedSnapshot.data || null;
          requestPayload = capturedSnapshot.requestPayload || {};
        }
      }

      if (data && Array.isArray(data.results)) {
        const payloadLimit = Number(requestPayload?.numberOfResults);
        if (requestUrl && Number.isFinite(payloadLimit) && payloadLimit !== limit) {
          const updatedPayload = {
            ...requestPayload,
            q: query,
            numberOfResults: limit,
            firstResult: 0,
          };
          const apiResponse = await context.request.post(requestUrl, {
            data: updatedPayload,
            headers: { "content-type": "application/json" },
            timeout: timeoutMs,
          });
          if (apiResponse.ok()) {
            const apiData = await apiResponse.json().catch((error) => {
              if (debug) {
                console.error(`[debug] Retry API response JSON parse failed: ${getErrorMessage(error)}`);
              }
              return null;
            });
            if (apiData && Array.isArray(apiData.results)) {
              data = apiData;
            }
          }
        }

        results = extractResults(data, { limit });
      }
    }

    return results;
  } finally {
    await browser.close();
  }
}

export async function searchHelp(options: SearchOptions): Promise<SearchResult[]> {
  const query = options.query;
  const language = options.language || "en_US";
  const limit = normalizeLimit(options.limit);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const useCache = options.useCache ?? true;
  const headed = options.headed ?? false;
  const debug = options.debug ?? false;

  const cacheKey = JSON.stringify({ query, language, limit });
  const cachePath = buildCachePath("search", cacheKey);

  if (useCache) {
    const cached = await readCache<SearchResult[]>(cachePath);
    if (cached) {
      await storeLatestSearch(query, cached);
      return cached;
    }
  }

  let tokenInfo = await loadToken();
  if (tokenInfo) {
    tokenInfo = {
      ...tokenInfo,
      organizationId: tokenInfo.organizationId || DEFAULT_ORG_ID,
      searchHub: tokenInfo.searchHub || DEFAULT_SEARCH_HUB,
      endpointBase: tokenInfo.endpointBase || DEFAULT_ENDPOINT_BASE,
      clientUri: tokenInfo.clientUri || DEFAULT_CLIENT_URI,
      filterer: tokenInfo.filterer ?? null,
    };
  }
  if (tokenInfo && isTokenValid(tokenInfo.expiresAtMs)) {
    const searchResult = await searchCoveoViaFetch({
      tokenInfo,
      query,
      language,
      limit,
      timeoutMs,
      debug,
    }).catch((error) => {
      if (debug) {
        console.error(`[debug] Token-based Coveo fetch failed: ${getErrorMessage(error)}`);
      }
      return null;
    });

    if (searchResult?.ok && hasResultsArray(searchResult.data)) {
      const results = extractResults(searchResult.data, { limit });

      if (useCache) {
        await writeCache(cachePath, results);
      }

      await storeLatestSearch(query, results);
      return results;
    }

    tokenInfo = null;
  }

  const results = await searchViaBrowser(
    query,
    language,
    limit,
    timeoutMs,
    headed,
    debug
  );

  if (useCache) {
    await writeCache(cachePath, results);
  }
  await storeLatestSearch(query, results);
  return results;
}
