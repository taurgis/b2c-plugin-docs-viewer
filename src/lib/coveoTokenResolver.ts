import type { BrowserContext, Page, Response as PlaywrightResponse } from "playwright";
import { applyTokenExpiry, decodeJwtPayload, type TokenInfo } from "./tokenStore";
import { getErrorMessage } from "./errorUtils";

const AURA_TOKEN_ENDPOINT = "https://help.salesforce.com/s/sfsites/aura";
const DEFAULT_ORG_ID = "org62salesforce";
const DEFAULT_SEARCH_HUB = "HTCommunity";
const DEFAULT_ENDPOINT_BASE = "https://help.salesforce.com/services/apexrest/coveo";
const DEFAULT_CLIENT_URI = "https://platform.cloud.coveo.com";

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

async function getAuraContext(
  page: Page,
  timeoutMs: number,
  debug: boolean
): Promise<{ auraContext: string; pageUri: string }> {
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
  } catch (error) {
    if (debug) {
      console.error(`[debug] Aura context unavailable in window context: ${getErrorMessage(error)}`);
    }
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
  const { auraContext, pageUri } = await getAuraContext(page, timeoutMs, debug);
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
      } catch (error) {
        if (debug) {
          console.error(`[debug] Failed parsing token JSON payload: ${getErrorMessage(error)}`);
        }
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

export async function obtainAuraTokenFromPage(
  auraTokenPromise: Promise<PlaywrightResponse | null>,
  context: BrowserContext,
  page: Page,
  timeoutMs: number,
  debug: boolean
): Promise<TokenInfo | null> {
  let tokenInfo = await parseAuraTokenResponse(await auraTokenPromise, debug);
  if (!tokenInfo) {
    tokenInfo = await fetchCoveoToken(context, page, timeoutMs, debug).catch((error) => {
      if (debug) console.error(`[debug] Aura token fetch error: ${getErrorMessage(error)}`);
      return null;
    });
  }
  return tokenInfo ? applyTokenExpiry(tokenInfo) : null;
}
