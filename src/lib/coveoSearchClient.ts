import type { APIRequestContext } from "playwright";
import type { TokenInfo } from "./tokenStore";
import { getErrorMessage } from "./errorUtils";

const DEFAULT_CLIENT_URI = "https://platform.cloud.coveo.com";

type CoveoAuthMode = "authorization-header" | "query-token";

export type CoveoResponse = {
  ok: boolean;
  status: number;
  data: unknown | null;
};

type CoveoSearchParams = {
  tokenInfo: TokenInfo;
  query: string;
  language: string;
  limit: number;
  timeoutMs: number;
  debug: boolean;
};

function buildCoveoSearchUrl(tokenInfo: TokenInfo, mode: CoveoAuthMode): URL {
  const clientBase = tokenInfo.clientUri || DEFAULT_CLIENT_URI;
  const searchUrl = new URL(`${clientBase.replace(/\/$/, "")}/rest/search/v2`);
  if (mode === "query-token") {
    searchUrl.searchParams.set("access_token", tokenInfo.accessToken);
  }
  return searchUrl;
}

function buildCoveoHeaders(tokenInfo: TokenInfo, mode: CoveoAuthMode): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (mode === "authorization-header") {
    headers.authorization = `Bearer ${tokenInfo.accessToken}`;
  }

  return headers;
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

function shouldRetryWithQueryTokenFallback(response: CoveoResponse | null): boolean {
  if (!response) return true;
  return response.status === 400 || response.status === 401 || response.status === 403;
}

export async function searchCoveoViaFetch(params: CoveoSearchParams): Promise<CoveoResponse | null> {
  const { tokenInfo, query, language, limit, timeoutMs, debug } = params;
  const payload = buildCoveoPayload(tokenInfo, query, language, limit);

  const runFetch = async (mode: CoveoAuthMode): Promise<CoveoResponse | null> => {
    const searchUrl = buildCoveoSearchUrl(tokenInfo, mode);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: globalThis.Response | null = null;

    try {
      response = (await fetch(searchUrl.toString(), {
        method: "POST",
        headers: buildCoveoHeaders(tokenInfo, mode),
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

    const data = await response.json().catch((error) => {
      if (debug) {
        console.error(`[debug] Coveo fetch response JSON parse failed: ${getErrorMessage(error)}`);
      }
      return null;
    });
    return { ok: Boolean(data), status: response.status, data };
  };

  const primary = await runFetch("authorization-header");
  if (primary?.ok || !shouldRetryWithQueryTokenFallback(primary)) {
    return primary;
  }

  if (debug) {
    console.error("[debug] Retrying Coveo search with query-token fallback.");
  }
  return runFetch("query-token");
}

export async function searchCoveoViaRequest(
  request: APIRequestContext,
  params: CoveoSearchParams
): Promise<CoveoResponse | null> {
  const { tokenInfo, query, language, limit, timeoutMs, debug } = params;
  const payload = buildCoveoPayload(tokenInfo, query, language, limit);

  const runRequest = async (mode: CoveoAuthMode): Promise<CoveoResponse | null> => {
    const searchUrl = buildCoveoSearchUrl(tokenInfo, mode);
    const response = await request.post(searchUrl.toString(), {
      data: payload,
      headers: buildCoveoHeaders(tokenInfo, mode),
      timeout: timeoutMs,
    });

    if (!response.ok()) {
      if (debug) {
        console.error(`[debug] Coveo search failed: HTTP ${response.status()}`);
      }
      return { ok: false, status: response.status(), data: null };
    }

    const data = await response.json().catch((error) => {
      if (debug) {
        console.error(`[debug] Coveo request response JSON parse failed: ${getErrorMessage(error)}`);
      }
      return null;
    });
    return { ok: Boolean(data), status: response.status(), data };
  };

  const primary = await runRequest("authorization-header");
  if (primary?.ok || !shouldRetryWithQueryTokenFallback(primary)) {
    return primary;
  }

  if (debug) {
    console.error("[debug] Retrying Coveo request with query-token fallback.");
  }
  return runRequest("query-token");
}
