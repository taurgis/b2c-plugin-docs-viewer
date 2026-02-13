import { chromium } from "playwright";
import type { APIRequestContext, BrowserContext, Page, Response as PlaywrightResponse } from "playwright";
import { buildCachePath, readCache, writeCache } from "./cache";
import { storeLatestSearch } from "./latestSearch";
import {
  applyTokenExpiry,
  decodeJwtPayload,
  isTokenValid,
  loadToken,
  storeToken,
  type TokenInfo,
} from "./tokenStore";

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const SEARCH_PAGE_URL = "https://help.salesforce.com/s/search-result";
const COVEO_SEARCH_PATH = "/services/apexrest/coveo/analytics/rest/search/v2";
const AURA_TOKEN_ENDPOINT = "https://help.salesforce.com/s/sfsites/aura";
const DEFAULT_ORG_ID = "org62salesforce";
const DEFAULT_SEARCH_HUB = "HTCommunity";
const DEFAULT_ENDPOINT_BASE = "https://help.salesforce.com/services/apexrest/coveo";
const DEFAULT_CLIENT_URI = "https://platform.cloud.coveo.com";
const SKIP_URLS = new Set([
  "https://help.salesforce.com/",
  "https://help.salesforce.com/s",
  "https://help.salesforce.com/s/",
  "https://help.salesforce.com/s/login",
]);
const DEFAULT_ALLOWED_HOSTS = new Set(["help.salesforce.com"]);

export type SearchResult = {
  url: string;
  title: string | null;
};

export type SearchOptions = {
  query: string;
  language?: string;
  limit?: number;
  includeNonHelp?: boolean;
  timeoutMs?: number;
  useCache?: boolean;
  headed?: boolean;
  debug?: boolean;
};

type CoveoResponse = {
  ok: boolean;
  status: number;
  data: any | null;
};

function normalizeLimit(value: number | undefined): number {
  if (!value || !Number.isFinite(value) || value <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(value), MAX_LIMIT);
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

async function acceptOneTrust(page: Page, timeoutMs: number): Promise<void> {
  const selectors = [
    "#onetrust-accept-btn-handler",
    "button#onetrust-accept-btn-handler",
    "button:has-text(\"Accept All\")",
    "button:has-text(\"Accept all\")",
    "button:has-text(\"I Agree\")",
  ];
  for (const selector of selectors) {
    try {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
        await button.click({ timeout: 3000 });
        await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {});
        return;
      }
    } catch {
      // Ignore and continue probing
    }
  }
}

function normalizeHelpDocContentUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (url.hostname !== "help.salesforce.com") return rawUrl;
  if (!url.pathname.toLowerCase().startsWith("/help_doccontent")) return rawUrl;

  const id = url.searchParams.get("id");
  if (!id) return rawUrl;

  const normalizedId = id.endsWith(".htm") ? id : `${id}.htm`;
  const articleUrl = new URL("https://help.salesforce.com/s/articleView");
  articleUrl.searchParams.set("id", normalizedId);
  articleUrl.searchParams.set("type", "5");

  const release = url.searchParams.get("release");
  if (release) articleUrl.searchParams.set("release", release);

  const language = url.searchParams.get("language");
  if (language) articleUrl.searchParams.set("language", language);

  return articleUrl.toString();
}

function extractResults(data: any, options: { includeNonHelp: boolean; limit: number }): SearchResult[] {
  const results = Array.isArray(data?.results) ? data.results : [];
  const items: SearchResult[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    const raw = result?.raw || {};
    let url =
      result?.clickUri ||
      result?.uri ||
      raw.clickuri ||
      raw.uri ||
      raw.sourceurl ||
      raw.document_uri ||
      raw.sfurl ||
      raw.sfdcurl ||
      null;

    if (!url) continue;
    url = normalizeHelpDocContentUrl(url);

    if (!options.includeNonHelp) {
      try {
        const host = new URL(url).hostname;
        if (!DEFAULT_ALLOWED_HOSTS.has(host)) continue;
      } catch {
        continue;
      }
    }

    if (SKIP_URLS.has(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    items.push({
      url,
      title: result?.title || raw.title || null,
    });

    if (items.length >= options.limit) break;
  }

  return items;
}

function stripAuraResponsePrefix(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("for(;;);")) {
    cleaned = cleaned.replace(/^for\(;;\);/, "").trim();
  }
  if (cleaned.startsWith(")]}'")) {
    cleaned = cleaned.replace(/^\)\]\}',?/, "").trim();
  }
  return cleaned;
}

function extractBalancedJson(text: string, startIndex: number): string | null {
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let objStart = -1;

  for (let i = startIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (ch === "\\") {
        escapeNext = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0 && objStart >= 0) {
        return text.slice(objStart, i + 1);
      }
    }
  }
  return null;
}

function extractAuraContextFromHtml(html: string): Record<string, unknown> | null {
  const marker = '"context":';
  const index = html.indexOf(marker);
  if (index === -1) return null;
  const start = index + marker.length;
  const jsonText = extractBalancedJson(html, start);
  if (!jsonText) return null;
  try {
    return JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function getAuraContext(page: Page, timeoutMs: number): Promise<{ auraContext: string; pageUri: string }> {
  let auraContext: string | null = null;
  try {
    await page.waitForFunction(() => (window as any).$A && (window as any).$A.getContext, {
      timeout: timeoutMs,
    });
    auraContext = await page.evaluate(() => {
      const ctx = (window as any).$A.getContext();
      if (ctx && typeof ctx.serialize === "function") return ctx.serialize();
      if (ctx && typeof ctx.getSerialized === "function") return ctx.getSerialized();
      return null;
    });
  } catch {
    auraContext = null;
  }

  if (!auraContext) {
    const html = await page.content();
    const contextObj = extractAuraContextFromHtml(html);
    if (contextObj) {
      auraContext = JSON.stringify(contextObj);
    }
  }

  if (!auraContext) {
    throw new Error("Aura context not available for token request.");
  }

  const pageUri = await page.evaluate(() => `${location.pathname}${location.search}${location.hash}`);
  return { auraContext, pageUri };
}

function buildAuraMessage(): Record<string, unknown> {
  return {
    actions: [
      {
        id: "1;a",
        descriptor: "apex://Search_CoveoTokenGenerator/ACTION$getToken",
        callingDescriptor: "markup://c:Search_CoveoEndPointHandler",
        params: {
          clientParams: {
            componentIdentifier: DEFAULT_SEARCH_HUB,
            searchHub: DEFAULT_SEARCH_HUB,
            name: "Search_CDSSearch",
            customEndpointUrl: `${DEFAULT_ENDPOINT_BASE}/platform`,
          },
        },
      },
    ],
  };
}

async function fetchCoveoToken(
  context: BrowserContext,
  page: Page,
  timeoutMs: number,
  debug: boolean
): Promise<TokenInfo | null> {
  const { auraContext, pageUri } = await getAuraContext(page, timeoutMs);
  const endpoint = new URL(AURA_TOKEN_ENDPOINT);
  endpoint.searchParams.set("r", String(Math.floor(Math.random() * 100)));
  endpoint.searchParams.set("other.Search_CoveoTokenGenerator.getToken", "1");

  const message = JSON.stringify(buildAuraMessage());

  const response = await context.request.post(endpoint.toString(), {
    form: {
      message,
      "aura.context": auraContext,
      "aura.pageURI": pageUri,
      "aura.token": "null",
    },
    headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
    timeout: timeoutMs,
  });

  if (!response.ok()) {
    if (debug) {
      console.error(`[debug] Aura token request failed: HTTP ${response.status()}`);
    }
    return null;
  }

  const rawText = await response.text();
  const cleaned = stripAuraResponsePrefix(rawText);
  let payload: any | null = null;
  try {
    payload = JSON.parse(cleaned);
  } catch {
    if (debug) {
      console.error("[debug] Aura token response JSON parse failed.");
    }
    return null;
  }

  return extractTokenFromAuraPayload(payload, debug);
}

function extractTokenFromAuraPayload(payload: any, debug: boolean): TokenInfo | null {
  const action = Array.isArray(payload?.actions) ? payload.actions[0] : null;
  if (!action) {
    if (debug) console.error("[debug] Aura token payload missing actions.");
    return null;
  }

  if (action.state && action.state !== "SUCCESS") {
    if (debug) {
      console.error(`[debug] Aura token action state: ${action.state}`);
    }
    return null;
  }

  let returnValue = action.returnValue ?? null;
  if (returnValue && typeof returnValue === "object" && typeof returnValue.returnValue === "string") {
    returnValue = returnValue.returnValue;
  }

  let accessToken: string | null = null;
  let organizationId = DEFAULT_ORG_ID;
  let searchHub = DEFAULT_SEARCH_HUB;
  let endpointBase = DEFAULT_ENDPOINT_BASE;
  let clientUri = DEFAULT_CLIENT_URI;
  let filterer: string | null = null;

  if (typeof returnValue === "string") {
    const trimmed = returnValue.trim();
    if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(trimmed)) {
      accessToken = trimmed;
    } else if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        accessToken =
          parsed.accessToken || parsed.token || parsed.authToken || parsed.access_token || null;
        organizationId = parsed.organizationId || parsed.organization || parsed.sfOrganizationId || organizationId;
        searchHub = parsed.searchHub || searchHub;
        endpointBase = parsed.platformUri || parsed.clientUri || endpointBase;
        clientUri = parsed.clientUri || clientUri;
        filterer = parsed.filterer || parsed.filter || filterer;
      } catch {
        accessToken = null;
      }
    }
  } else if (returnValue && typeof returnValue === "object") {
    accessToken =
      returnValue.accessToken ||
      returnValue.token ||
      returnValue.authToken ||
      returnValue.access_token ||
      null;
    organizationId = returnValue.organizationId || returnValue.organization || returnValue.sfOrganizationId || organizationId;
    searchHub = returnValue.searchHub || searchHub;
    endpointBase = returnValue.platformUri || returnValue.clientUri || endpointBase;
    clientUri = returnValue.clientUri || clientUri;
    filterer = returnValue.filterer || returnValue.filter || filterer;
  }

  if (!accessToken) {
    if (debug) {
      console.error("[debug] Aura token payload missing access token.");
    }
    return null;
  }

  const jwtPayload = decodeJwtPayload(accessToken);
  if (jwtPayload) {
    const jwtFilterer = jwtPayload.filterer || jwtPayload.filter;
    if (!filterer && typeof jwtFilterer === "string") {
      filterer = jwtFilterer;
    }
  }

  return applyTokenExpiry({
    accessToken,
    organizationId,
    searchHub,
    endpointBase,
    clientUri,
    filterer,
    expiresAtMs: 0,
  });
}

async function parseAuraTokenResponse(response: PlaywrightResponse | null, debug: boolean): Promise<TokenInfo | null> {
  if (!response) return null;
  if (!response.ok()) {
    if (debug) console.error(`[debug] Aura token response failed: HTTP ${response.status()}`);
    return null;
  }

  const rawText = await response.text();
  const cleaned = stripAuraResponsePrefix(rawText);
  let payload: any | null = null;
  try {
    payload = JSON.parse(cleaned);
  } catch {
    if (debug) console.error("[debug] Aura token response JSON parse failed.");
    return null;
  }

  return extractTokenFromAuraPayload(payload, debug);
}

function buildCoveoSearchUrl(tokenInfo: TokenInfo): URL {
  const clientBase = tokenInfo.clientUri || DEFAULT_CLIENT_URI;
  const searchUrl = new URL(`${clientBase.replace(/\/$/, "")}/rest/search/v2`);
  searchUrl.searchParams.set("access_token", tokenInfo.accessToken);
  return searchUrl;
}

function buildCoveoPayload(tokenInfo: TokenInfo, query: string, language: string, limit: number): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    q: query,
    numberOfResults: limit,
    firstResult: 0,
    searchHub: tokenInfo.searchHub,
    locale: language,
    tab: "allResultsTab",
    sortCriteria: "relevancy",
  };

  if (tokenInfo.filterer) {
    payload.aq = tokenInfo.filterer;
  }

  return payload;
}

async function searchViaCoveoFetch(
  tokenInfo: TokenInfo,
  query: string,
  language: string,
  limit: number,
  timeoutMs: number,
  debug: boolean
): Promise<CoveoResponse | null> {
  const searchUrl = buildCoveoSearchUrl(tokenInfo);
  const payload = buildCoveoPayload(tokenInfo, query, language, limit);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: globalThis.Response | null = null;

  try {
    response = (await fetch(searchUrl.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })) as unknown as Response;
  } catch (error) {
    if (debug) console.error(`[debug] Coveo fetch failed: ${(error as Error).message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    if (debug) {
      console.error(`[debug] Coveo search failed: HTTP ${response.status}`);
    }
    return { ok: false, status: response.status, data: null };
  }

  const data = await response.json().catch(() => null);
  return { ok: Boolean(data), status: response.status, data };
}

async function searchViaCoveo(
  request: APIRequestContext,
  tokenInfo: TokenInfo,
  query: string,
  language: string,
  limit: number,
  timeoutMs: number,
  debug: boolean
): Promise<CoveoResponse | null> {
  const searchUrl = buildCoveoSearchUrl(tokenInfo);
  const payload = buildCoveoPayload(tokenInfo, query, language, limit);

  const response = await request.post(searchUrl.toString(), {
    data: payload,
    headers: { "content-type": "application/json" },
    timeout: timeoutMs,
  });

  if (!response.ok()) {
    if (debug) {
      console.error(`[debug] Coveo search failed: HTTP ${response.status()}`);
    }
    return { ok: false, status: response.status(), data: null };
  }

  const data = await response.json().catch(() => null);
  return { ok: Boolean(data), status: response.status(), data };
}

async function obtainAuraToken(
  auraTokenPromise: Promise<PlaywrightResponse | null>,
  context: BrowserContext,
  page: Page,
  timeoutMs: number,
  debug: boolean
): Promise<TokenInfo | null> {
  let tokenInfo = await parseAuraTokenResponse(await auraTokenPromise, debug);
  if (!tokenInfo) {
    tokenInfo = await fetchCoveoToken(context, page, timeoutMs, debug).catch((err) => {
      if (debug) console.error(`[debug] Aura token fetch error: ${err.message}`);
      return null;
    });
  }
  return tokenInfo ? applyTokenExpiry(tokenInfo) : null;
}

async function searchViaBrowser(
  query: string,
  language: string,
  limit: number,
  includeNonHelp: boolean,
  timeoutMs: number,
  headed: boolean,
  debug: boolean
): Promise<SearchResult[]> {
  const browser = await chromium.launch({ headless: !headed });
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
    } catch {
      // Ignore response parsing failures
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
      .catch(() => null);
    const auraTokenPromise = page
      .waitForResponse((resp: PlaywrightResponse) => {
        if (!resp.url().includes("/s/sfsites/aura")) return false;
        if (resp.request().method() !== "POST") return false;
        const postData = resp.request().postData() || "";
        return postData.includes("Search_CoveoTokenGenerator") && postData.includes("getToken");
      }, { timeout: timeoutMs })
      .catch(() => null);

    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await acceptOneTrust(page, timeoutMs);
    await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {});

    let results: SearchResult[] = [];

    const tokenInfo = await obtainAuraToken(auraTokenPromise, context, page, timeoutMs, debug);
    if (tokenInfo) {
      await storeToken(tokenInfo);
      const searchResult = await searchViaCoveo(
        context.request,
        tokenInfo,
        query,
        language,
        limit,
        timeoutMs,
        debug
      ).catch(() => null);

      if (searchResult?.data && Array.isArray(searchResult.data.results)) {
        results = extractResults(searchResult.data, { includeNonHelp, limit });
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
        data = await response.json().catch(() => null);
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
            const apiData = await apiResponse.json().catch(() => null);
            if (apiData && Array.isArray(apiData.results)) {
              data = apiData;
            }
          }
        }

        results = extractResults(data, { includeNonHelp, limit });
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
  const includeNonHelp = options.includeNonHelp ?? false;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const useCache = options.useCache ?? true;
  const headed = options.headed ?? false;
  const debug = options.debug ?? false;

  const cacheKey = JSON.stringify({ query, language, limit, includeNonHelp });
  const cachePath = buildCachePath("search", cacheKey);

  if (useCache) {
    const cached = await readCache<SearchResult[]>(cachePath);
    if (cached && cached.length > 0) {
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
    const searchResult = await searchViaCoveoFetch(
      tokenInfo,
      query,
      language,
      limit,
      timeoutMs,
      debug
    ).catch(() => null);

    if (searchResult?.ok && Array.isArray(searchResult.data?.results)) {
      const results = extractResults(searchResult.data, { includeNonHelp, limit });
      if (results.length > 0) {
        await writeCache(cachePath, results);
        await storeLatestSearch(query, results);
        return results;
      }
    }

    tokenInfo = null;
  }

  const results = await searchViaBrowser(
    query,
    language,
    limit,
    includeNonHelp,
    timeoutMs,
    headed,
    debug
  );

  if (!results.length) {
    throw new Error("Search returned no results.");
  }

  await writeCache(cachePath, results);
  await storeLatestSearch(query, results);
  return results;
}
