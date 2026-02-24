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
const coveoSearchClient_1 = require("./coveoSearchClient");
const coveoTokenResolver_1 = require("./coveoTokenResolver");
const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const SEARCH_PAGE_URL = "https://help.salesforce.com/s/search-result";
const COVEO_SEARCH_PATH = "/services/apexrest/coveo/analytics/rest/search/v2";
const DEFAULT_ORG_ID = "org62salesforce";
const DEFAULT_SEARCH_HUB = "HTCommunity";
const DEFAULT_ENDPOINT_BASE = "https://help.salesforce.com/services/apexrest/coveo";
const DEFAULT_CLIENT_URI = "https://platform.cloud.coveo.com";
function normalizeLimit(value) {
    if (!value || !Number.isFinite(value) || value <= 0)
        return DEFAULT_LIMIT;
    return Math.min(Math.floor(value), MAX_LIMIT);
}
function hasResultsArray(value) {
    if (!value || typeof value !== "object")
        return false;
    const maybeResults = value.results;
    return Array.isArray(maybeResults);
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
        await page.locator("body").first().waitFor({ state: "visible", timeout: Math.min(timeoutMs, 6000) }).catch((error) => {
            if (debug) {
                console.error(`[debug] Search page body wait failed: ${(0, errorUtils_1.getErrorMessage)(error)}`);
            }
        });
        let results = [];
        const tokenInfo = await (0, coveoTokenResolver_1.obtainAuraTokenFromPage)(auraTokenPromise, context, page, timeoutMs, debug);
        if (tokenInfo) {
            await (0, tokenStore_1.storeToken)(tokenInfo);
            const searchResult = await (0, coveoSearchClient_1.searchCoveoViaRequest)(context.request, {
                tokenInfo,
                query,
                language,
                limit,
                timeoutMs,
                debug,
            }).catch((error) => {
                if (debug) {
                    console.error(`[debug] Direct Coveo request failed: ${(0, errorUtils_1.getErrorMessage)(error)}`);
                }
                return null;
            });
            if (hasResultsArray(searchResult?.data)) {
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
        const searchResult = await (0, coveoSearchClient_1.searchCoveoViaFetch)({
            tokenInfo,
            query,
            language,
            limit,
            timeoutMs,
            debug,
        }).catch((error) => {
            if (debug) {
                console.error(`[debug] Token-based Coveo fetch failed: ${(0, errorUtils_1.getErrorMessage)(error)}`);
            }
            return null;
        });
        if (searchResult?.ok && hasResultsArray(searchResult.data)) {
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
