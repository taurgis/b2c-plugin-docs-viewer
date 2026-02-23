"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeHelpDocContentUrl = exports.extractResults = void 0;
exports.searchHelp = searchHelp;
const playwright_1 = require("playwright");
const cache_1 = require("./cache");
const latestSearch_1 = require("./latestSearch");
const tokenStore_1 = require("./tokenStore");
const browserConsent_1 = require("./browserConsent");
const helpSearchResults_1 = require("./helpSearchResults");
const errorUtils_1 = require("./errorUtils");
const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const SEARCH_PAGE_URL = "https://help.salesforce.com/s/search-result";
const COVEO_SEARCH_PATH = "/services/apexrest/coveo/analytics/rest/search/v2";
const AURA_TOKEN_ENDPOINT = "https://help.salesforce.com/s/sfsites/aura";
const DEFAULT_ORG_ID = "org62salesforce";
const DEFAULT_SEARCH_HUB = "HTCommunity";
const DEFAULT_ENDPOINT_BASE = "https://help.salesforce.com/services/apexrest/coveo";
const DEFAULT_CLIENT_URI = "https://platform.cloud.coveo.com";
function normalizeLimit(value) {
    if (!value || !Number.isFinite(value) || value <= 0)
        return DEFAULT_LIMIT;
    return Math.min(Math.floor(value), MAX_LIMIT);
}
function buildSearchUrl(query, language) {
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
var helpSearchResults_2 = require("./helpSearchResults");
Object.defineProperty(exports, "extractResults", { enumerable: true, get: function () { return helpSearchResults_2.extractResults; } });
Object.defineProperty(exports, "normalizeHelpDocContentUrl", { enumerable: true, get: function () { return helpSearchResults_2.normalizeHelpDocContentUrl; } });
function stripAuraResponsePrefix(text) {
    let cleaned = text.trim();
    if (cleaned.startsWith("for(;;);")) {
        cleaned = cleaned.replace(/^for\(;;\);/, "").trim();
    }
    if (cleaned.startsWith(")]}'")) {
        cleaned = cleaned.replace(/^\)\]\}',?/, "").trim();
    }
    return cleaned;
}
function extractBalancedJson(text, startIndex) {
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
            if (depth === 0)
                objStart = i;
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
function extractAuraContextFromHtml(html) {
    const marker = '"context":';
    const index = html.indexOf(marker);
    if (index === -1)
        return null;
    const start = index + marker.length;
    const jsonText = extractBalancedJson(html, start);
    if (!jsonText)
        return null;
    try {
        return JSON.parse(jsonText);
    }
    catch {
        return null;
    }
}
async function getAuraContext(page, timeoutMs, debug) {
    let auraContext = null;
    try {
        await page.waitForFunction(() => window.$A && window.$A.getContext, {
            timeout: timeoutMs,
        });
        auraContext = await page.evaluate(() => {
            const ctx = window.$A.getContext();
            if (ctx && typeof ctx.serialize === "function")
                return ctx.serialize();
            if (ctx && typeof ctx.getSerialized === "function")
                return ctx.getSerialized();
            return null;
        });
    }
    catch (error) {
        if (debug) {
            console.error(`[debug] Aura context unavailable in window context: ${(0, errorUtils_1.getErrorMessage)(error)}`);
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
function buildAuraMessage() {
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
async function fetchCoveoToken(context, page, timeoutMs, debug) {
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
    let payload = null;
    try {
        payload = JSON.parse(cleaned);
    }
    catch {
        if (debug) {
            console.error("[debug] Aura token response JSON parse failed.");
        }
        return null;
    }
    return extractTokenFromAuraPayload(payload, debug);
}
function extractTokenFromAuraPayload(payload, debug) {
    const action = Array.isArray(payload?.actions) ? payload.actions[0] : null;
    if (!action) {
        if (debug)
            console.error("[debug] Aura token payload missing actions.");
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
    let accessToken = null;
    let organizationId = DEFAULT_ORG_ID;
    let searchHub = DEFAULT_SEARCH_HUB;
    let endpointBase = DEFAULT_ENDPOINT_BASE;
    let clientUri = DEFAULT_CLIENT_URI;
    let filterer = null;
    if (typeof returnValue === "string") {
        const trimmed = returnValue.trim();
        if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(trimmed)) {
            accessToken = trimmed;
        }
        else if (trimmed.startsWith("{")) {
            try {
                const parsed = JSON.parse(trimmed);
                accessToken =
                    parsed.accessToken || parsed.token || parsed.authToken || parsed.access_token || null;
                organizationId = parsed.organizationId || parsed.organization || parsed.sfOrganizationId || organizationId;
                searchHub = parsed.searchHub || searchHub;
                endpointBase = parsed.platformUri || parsed.clientUri || endpointBase;
                clientUri = parsed.clientUri || clientUri;
                filterer = parsed.filterer || parsed.filter || filterer;
            }
            catch (error) {
                if (debug) {
                    console.error(`[debug] Failed parsing token JSON payload: ${(0, errorUtils_1.getErrorMessage)(error)}`);
                }
                accessToken = null;
            }
        }
    }
    else if (returnValue && typeof returnValue === "object") {
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
    const jwtPayload = (0, tokenStore_1.decodeJwtPayload)(accessToken);
    if (jwtPayload) {
        const jwtFilterer = jwtPayload.filterer || jwtPayload.filter;
        if (!filterer && typeof jwtFilterer === "string") {
            filterer = jwtFilterer;
        }
    }
    return (0, tokenStore_1.applyTokenExpiry)({
        accessToken,
        organizationId,
        searchHub,
        endpointBase,
        clientUri,
        filterer,
        expiresAtMs: 0,
    });
}
async function parseAuraTokenResponse(response, debug) {
    if (!response)
        return null;
    if (!response.ok()) {
        if (debug)
            console.error(`[debug] Aura token response failed: HTTP ${response.status()}`);
        return null;
    }
    const rawText = await response.text();
    const cleaned = stripAuraResponsePrefix(rawText);
    let payload = null;
    try {
        payload = JSON.parse(cleaned);
    }
    catch {
        if (debug)
            console.error("[debug] Aura token response JSON parse failed.");
        return null;
    }
    return extractTokenFromAuraPayload(payload, debug);
}
function buildCoveoSearchUrl(tokenInfo) {
    const clientBase = tokenInfo.clientUri || DEFAULT_CLIENT_URI;
    const searchUrl = new URL(`${clientBase.replace(/\/$/, "")}/rest/search/v2`);
    searchUrl.searchParams.set("access_token", tokenInfo.accessToken);
    return searchUrl;
}
function buildCoveoPayload(tokenInfo, query, language, limit) {
    const payload = {
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
async function searchViaCoveoFetch(tokenInfo, query, language, limit, timeoutMs, debug) {
    const searchUrl = buildCoveoSearchUrl(tokenInfo);
    const payload = buildCoveoPayload(tokenInfo, query, language, limit);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response = null;
    try {
        response = (await fetch(searchUrl.toString(), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
        }));
    }
    catch (error) {
        if (debug)
            console.error(`[debug] Coveo fetch failed: ${error.message}`);
        return null;
    }
    finally {
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
            console.error(`[debug] Coveo fetch response JSON parse failed: ${(0, errorUtils_1.getErrorMessage)(error)}`);
        }
        return null;
    });
    return { ok: Boolean(data), status: response.status, data };
}
async function searchViaCoveo(request, tokenInfo, query, language, limit, timeoutMs, debug) {
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
    const data = await response.json().catch((error) => {
        if (debug) {
            console.error(`[debug] Coveo request response JSON parse failed: ${(0, errorUtils_1.getErrorMessage)(error)}`);
        }
        return null;
    });
    return { ok: Boolean(data), status: response.status(), data };
}
async function obtainAuraToken(auraTokenPromise, context, page, timeoutMs, debug) {
    let tokenInfo = await parseAuraTokenResponse(await auraTokenPromise, debug);
    if (!tokenInfo) {
        tokenInfo = await fetchCoveoToken(context, page, timeoutMs, debug).catch((error) => {
            if (debug)
                console.error(`[debug] Aura token fetch error: ${(0, errorUtils_1.getErrorMessage)(error)}`);
            return null;
        });
    }
    return tokenInfo ? (0, tokenStore_1.applyTokenExpiry)(tokenInfo) : null;
}
async function searchViaBrowser(query, language, limit, timeoutMs, headed, debug) {
    const browser = await playwright_1.chromium.launch({ headless: !headed });
    const context = await browser.newContext();
    const page = await context.newPage();
    let captured = null;
    page.on("response", async (resp) => {
        if (!resp.url().includes(COVEO_SEARCH_PATH))
            return;
        if (resp.request().method() !== "POST")
            return;
        try {
            const data = await resp.json();
            let requestPayload = {};
            try {
                requestPayload = JSON.parse(resp.request().postData() || "{}");
            }
            catch {
                requestPayload = {};
            }
            captured = { data, requestPayload };
        }
        catch (error) {
            if (debug) {
                console.error(`[debug] Failed to capture search response: ${(0, errorUtils_1.getErrorMessage)(error)}`);
            }
        }
    });
    try {
        const searchUrl = buildSearchUrl(query, language);
        const responsePromise = page
            .waitForResponse((resp) => resp.url().includes(COVEO_SEARCH_PATH) && resp.request().method() === "POST", { timeout: timeoutMs })
            .catch((error) => {
            if (debug) {
                console.error(`[debug] Timed out waiting for Coveo response: ${(0, errorUtils_1.getErrorMessage)(error)}`);
            }
            return null;
        });
        const auraTokenPromise = page
            .waitForResponse((resp) => {
            if (!resp.url().includes("/s/sfsites/aura"))
                return false;
            if (resp.request().method() !== "POST")
                return false;
            const postData = resp.request().postData() || "";
            return postData.includes("Search_CoveoTokenGenerator") && postData.includes("getToken");
        }, { timeout: timeoutMs })
            .catch((error) => {
            if (debug) {
                console.error(`[debug] Timed out waiting for Aura token response: ${(0, errorUtils_1.getErrorMessage)(error)}`);
            }
            return null;
        });
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
        await (0, browserConsent_1.acceptOneTrust)(page, timeoutMs);
        await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => { });
        let results = [];
        const tokenInfo = await obtainAuraToken(auraTokenPromise, context, page, timeoutMs, debug);
        if (tokenInfo) {
            await (0, tokenStore_1.storeToken)(tokenInfo);
            const searchResult = await searchViaCoveo(context.request, tokenInfo, query, language, limit, timeoutMs, debug).catch((error) => {
                if (debug) {
                    console.error(`[debug] Direct Coveo request failed: ${(0, errorUtils_1.getErrorMessage)(error)}`);
                }
                return null;
            });
            if (searchResult?.data && Array.isArray(searchResult.data.results)) {
                results = (0, helpSearchResults_1.extractResults)(searchResult.data, { limit });
            }
        }
        if (results.length === 0) {
            const response = await responsePromise;
            let data = null;
            let requestPayload = {};
            const requestUrl = response?.request().url() ?? null;
            if (response) {
                const request = response.request();
                try {
                    requestPayload = JSON.parse(request.postData() || "{}");
                }
                catch {
                    requestPayload = {};
                }
                data = await response.json().catch((error) => {
                    if (debug) {
                        console.error(`[debug] Browser search response JSON parse failed: ${(0, errorUtils_1.getErrorMessage)(error)}`);
                    }
                    return null;
                });
            }
            else {
                const capturedSnapshot = captured;
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
                                console.error(`[debug] Retry API response JSON parse failed: ${(0, errorUtils_1.getErrorMessage)(error)}`);
                            }
                            return null;
                        });
                        if (apiData && Array.isArray(apiData.results)) {
                            data = apiData;
                        }
                    }
                }
                results = (0, helpSearchResults_1.extractResults)(data, { limit });
            }
        }
        return results;
    }
    finally {
        await browser.close();
    }
}
async function searchHelp(options) {
    const query = options.query;
    const language = options.language || "en_US";
    const limit = normalizeLimit(options.limit);
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const useCache = options.useCache ?? true;
    const headed = options.headed ?? false;
    const debug = options.debug ?? false;
    const cacheKey = JSON.stringify({ query, language, limit });
    const cachePath = (0, cache_1.buildCachePath)("search", cacheKey);
    if (useCache) {
        const cached = await (0, cache_1.readCache)(cachePath);
        if (cached) {
            await (0, latestSearch_1.storeLatestSearch)(query, cached);
            return cached;
        }
    }
    let tokenInfo = await (0, tokenStore_1.loadToken)();
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
    if (tokenInfo && (0, tokenStore_1.isTokenValid)(tokenInfo.expiresAtMs)) {
        const searchResult = await searchViaCoveoFetch(tokenInfo, query, language, limit, timeoutMs, debug).catch((error) => {
            if (debug) {
                console.error(`[debug] Token-based Coveo fetch failed: ${(0, errorUtils_1.getErrorMessage)(error)}`);
            }
            return null;
        });
        if (searchResult?.ok && Array.isArray(searchResult.data?.results)) {
            const results = (0, helpSearchResults_1.extractResults)(searchResult.data, { limit });
            if (useCache) {
                await (0, cache_1.writeCache)(cachePath, results);
            }
            await (0, latestSearch_1.storeLatestSearch)(query, results);
            return results;
        }
        tokenInfo = null;
    }
    const results = await searchViaBrowser(query, language, limit, timeoutMs, headed, debug);
    if (useCache) {
        await (0, cache_1.writeCache)(cachePath, results);
    }
    await (0, latestSearch_1.storeLatestSearch)(query, results);
    return results;
}
