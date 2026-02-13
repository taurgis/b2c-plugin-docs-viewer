#!/usr/bin/env node

'use strict';

const fs = require('fs/promises');
const path = require('path');
const { chromium } = require('playwright');

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const SEARCH_PAGE_URL = 'https://help.salesforce.com/s/search-result';
const COVEO_SEARCH_PATH = '/services/apexrest/coveo/analytics/rest/search/v2';
const AURA_TOKEN_ENDPOINT = 'https://help.salesforce.com/s/sfsites/aura';
const DEFAULT_ORG_ID = 'org62salesforce';
const DEFAULT_SEARCH_HUB = 'HTCommunity';
const DEFAULT_ENDPOINT_BASE = 'https://help.salesforce.com/services/apexrest/coveo';
const DEFAULT_CLIENT_URI = 'https://platform.cloud.coveo.com';
const SKIP_URLS = new Set([
  'https://help.salesforce.com/',
  'https://help.salesforce.com/s',
  'https://help.salesforce.com/s/',
  'https://help.salesforce.com/s/login',
]);
const DEFAULT_ALLOWED_HOSTS = new Set([
  'help.salesforce.com',
  'developer.salesforce.com',
]);
const ARTIFACTS_DIRNAME = 'artifacts';
const ARTIFACTS_TMP_DIRNAME = 'tmp';
const ENV_AI_FILENAME = '.env-ai';
const ENV_TOKEN_KEY = 'SALESFORCE_HELP_COVEO_TOKEN';
const ENV_TOKEN_EXPIRES_KEY = 'SALESFORCE_HELP_COVEO_TOKEN_EXPIRES_AT';
const ENV_TOKEN_ORG_KEY = 'SALESFORCE_HELP_COVEO_ORG_ID';
const ENV_TOKEN_SEARCH_HUB_KEY = 'SALESFORCE_HELP_COVEO_SEARCH_HUB';
const ENV_TOKEN_ENDPOINT_BASE_KEY = 'SALESFORCE_HELP_COVEO_ENDPOINT_BASE';
const ENV_TOKEN_CLIENT_URI_KEY = 'SALESFORCE_HELP_COVEO_CLIENT_URI';
const ENV_TOKEN_FILTERER_KEY = 'SALESFORCE_HELP_COVEO_FILTERER';
const TOKEN_EXPIRY_SKEW_MS = 2 * 60 * 1000;
const DEFAULT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function findProjectRoot(startDir) {
  let current = path.resolve(startDir);
  for (let i = 0; i < 12; i++) {
    if (await pathExists(path.join(current, ARTIFACTS_DIRNAME))) {
      return current;
    }
    if (await pathExists(path.join(current, 'package.json'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(startDir);
}

function setTempEnv(tmpDir) {
  process.env.TMPDIR = tmpDir;
  process.env.TMP = tmpDir;
  process.env.TEMP = tmpDir;
}

async function ensureArtifactsTmpDir() {
  const projectRoot = await findProjectRoot(process.cwd());
  const artifactsDir = path.join(projectRoot, ARTIFACTS_DIRNAME);
  const tmpDir = path.join(artifactsDir, ARTIFACTS_TMP_DIRNAME);
  await fs.mkdir(tmpDir, { recursive: true });
  setTempEnv(tmpDir);
  return { projectRoot, artifactsDir, tmpDir };
}

function stripEnvQuotes(value) {
  if (!value) return value;
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnvLine(line) {
  const trimmed = (line || '').trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const index = trimmed.indexOf('=');
  if (index === -1) return null;
  const key = trimmed.slice(0, index).trim();
  if (!key) return null;
  const rawValue = trimmed.slice(index + 1);
  return { key, value: stripEnvQuotes(rawValue) };
}

function parseEnvContent(raw) {
  const lines = raw.split(/\r?\n/);
  const entries = new Map();
  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    entries.set(parsed.key, parsed.value);
  }
  return { lines, entries };
}

function parseExpiryMs(value) {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsedDate = Date.parse(value);
  if (!Number.isNaN(parsedDate)) return parsedDate;
  return null;
}

function getTokenExpiryMs(accessToken) {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return null;
  const rawExp = payload.exp ?? payload.expires_at ?? payload.expiresAt ?? null;
  if (rawExp === null || rawExp === undefined) return null;
  const expNumber = Number(rawExp);
  if (!Number.isFinite(expNumber)) return null;
  return expNumber > 1_000_000_000_000 ? expNumber : expNumber * 1000;
}

function isTokenValid(expiresAtMs) {
  if (!Number.isFinite(expiresAtMs)) return false;
  return Date.now() + TOKEN_EXPIRY_SKEW_MS < expiresAtMs;
}

async function readEnvAi(projectRoot) {
  const envPath = path.join(projectRoot, ENV_AI_FILENAME);
  if (!(await pathExists(envPath))) {
    return { envPath, lines: [], entries: new Map() };
  }
  const raw = await fs.readFile(envPath, 'utf8');
  const { lines, entries } = parseEnvContent(raw);
  return { envPath, lines, entries };
}

async function loadCachedToken(projectRoot, debug) {
  const { envPath, entries } = await readEnvAi(projectRoot);
  const accessToken = entries.get(ENV_TOKEN_KEY) || null;
  if (!accessToken) return null;
  const rawExpiry = entries.get(ENV_TOKEN_EXPIRES_KEY) || null;
  const expiresAtMs = parseExpiryMs(rawExpiry) || getTokenExpiryMs(accessToken);
  if (!isTokenValid(expiresAtMs)) {
    if (debug) console.error('[debug] Cached Coveo token expired or missing expiry.');
    return null;
  }
  const filtererValue = entries.get(ENV_TOKEN_FILTERER_KEY);
  const tokenInfo = {
    accessToken,
    organizationId: entries.get(ENV_TOKEN_ORG_KEY) || DEFAULT_ORG_ID,
    searchHub: entries.get(ENV_TOKEN_SEARCH_HUB_KEY) || DEFAULT_SEARCH_HUB,
    endpointBase: entries.get(ENV_TOKEN_ENDPOINT_BASE_KEY) || DEFAULT_ENDPOINT_BASE,
    clientUri: entries.get(ENV_TOKEN_CLIENT_URI_KEY) || DEFAULT_CLIENT_URI,
    filterer: filtererValue ? filtererValue : null,
    expiresAtMs,
    envPath,
  };
  if (debug) console.error(`[debug] Using cached Coveo token from ${envPath}`);
  return tokenInfo;
}

function applyTokenExpiry(tokenInfo, debug) {
  if (!tokenInfo || !tokenInfo.accessToken) return tokenInfo;
  let expiresAtMs = tokenInfo.expiresAtMs || getTokenExpiryMs(tokenInfo.accessToken);
  if (!expiresAtMs) {
    expiresAtMs = Date.now() + DEFAULT_TOKEN_TTL_MS;
    if (debug) console.error('[debug] Token missing exp; using fallback TTL.');
  }
  return { ...tokenInfo, expiresAtMs };
}

function buildEnvUpdates(tokenInfo) {
  const updates = new Map();
  const add = (key, value) => {
    if (value === undefined || value === null) return;
    updates.set(key, String(value));
  };
  add(ENV_TOKEN_KEY, tokenInfo.accessToken);
  add(ENV_TOKEN_EXPIRES_KEY, tokenInfo.expiresAtMs);
  add(ENV_TOKEN_ORG_KEY, tokenInfo.organizationId || DEFAULT_ORG_ID);
  add(ENV_TOKEN_SEARCH_HUB_KEY, tokenInfo.searchHub || DEFAULT_SEARCH_HUB);
  add(ENV_TOKEN_ENDPOINT_BASE_KEY, tokenInfo.endpointBase || DEFAULT_ENDPOINT_BASE);
  add(ENV_TOKEN_CLIENT_URI_KEY, tokenInfo.clientUri || DEFAULT_CLIENT_URI);
  add(ENV_TOKEN_FILTERER_KEY, tokenInfo.filterer || '');
  return updates;
}

async function writeEnvAi(projectRoot, tokenInfo, debug) {
  const { envPath, lines } = await readEnvAi(projectRoot);
  const updates = buildEnvUpdates(tokenInfo);
  const updatedLines = lines.map((line) => {
    const parsed = parseEnvLine(line);
    if (!parsed) return line;
    if (!updates.has(parsed.key)) return line;
    const value = updates.get(parsed.key);
    updates.delete(parsed.key);
    return `${parsed.key}=${value}`;
  });

  if (updates.size > 0 && updatedLines.length > 0 && updatedLines[updatedLines.length - 1].trim() !== '') {
    updatedLines.push('');
  }

  for (const [key, value] of updates.entries()) {
    updatedLines.push(`${key}=${value}`);
  }

  let output = updatedLines.join('\n');
  if (!output.endsWith('\n')) output += '\n';
  await fs.writeFile(envPath, output, 'utf8');
  if (debug) console.error(`[debug] Cached Coveo token in ${envPath}`);
}

function resolveOutPath(projectRoot, outPath) {
  const artifactsDir = path.resolve(projectRoot, ARTIFACTS_DIRNAME);
  const resolved = path.resolve(projectRoot, outPath);
  if (resolved === artifactsDir || resolved.startsWith(`${artifactsDir}${path.sep}`)) {
    return resolved;
  }
  throw new Error(`Output path must live under ${artifactsDir}`);
}

function normalizeHelpDocContentUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (url.hostname !== 'help.salesforce.com') return rawUrl;
  if (!url.pathname.toLowerCase().startsWith('/help_doccontent')) return rawUrl;

  const id = url.searchParams.get('id');
  if (!id) return rawUrl;

  const normalizedId = id.endsWith('.htm') ? id : `${id}.htm`;
  const articleUrl = new URL('https://help.salesforce.com/s/articleView');
  articleUrl.searchParams.set('id', normalizedId);
  articleUrl.searchParams.set('type', '5');

  const release = url.searchParams.get('release');
  if (release) articleUrl.searchParams.set('release', release);

  const language = url.searchParams.get('language');
  if (language) articleUrl.searchParams.set('language', language);

  return articleUrl.toString();
}

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function requireArg(flag, value) {
  if (!value) {
    console.error(`Missing required argument: ${flag}`);
    process.exit(1);
  }
}

function normalizeLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function buildSearchUrl(query, language) {
  const url = new URL(SEARCH_PAGE_URL);
  if (language) {
    url.searchParams.set('language', language);
  }
  if (query) {
    const hashParams = new URLSearchParams();
    hashParams.set('q', query);
    hashParams.set('t', 'allResultsTab');
    hashParams.set('sort', 'relevancy');
    url.hash = hashParams.toString();
  }
  return url.toString();
}

async function acceptOneTrust(page, timeoutMs) {
  const selectors = [
    '#onetrust-accept-btn-handler',
    'button#onetrust-accept-btn-handler',
    'button:has-text("Accept All")',
    'button:has-text("Accept all")',
    'button:has-text("I Agree")',
  ];
  for (const selector of selectors) {
    try {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
        await button.click({ timeout: 3000 });
        await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {});
        return;
      }
    } catch {
      // Ignore and continue probing
    }
  }
}


function extractResults(data, { includeNonHelp, limit }) {
  const results = Array.isArray(data?.results) ? data.results : [];
  const items = [];
  const seen = new Set();

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
    if (!includeNonHelp) {
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

    if (items.length >= limit) break;
  }

  return items;
}

function stripAuraResponsePrefix(text) {
  if (!text) return '';
  let cleaned = text.trim();
  if (cleaned.startsWith('for(;;);')) {
    cleaned = cleaned.replace(/^for\(;;\);/, '').trim();
  }
  if (cleaned.startsWith(")]}',")) {
    cleaned = cleaned.replace(/^\)\]\}',?/, '').trim();
  }
  return cleaned;
}

function extractBalancedJson(text, startIndex) {
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let objStart = -1;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (ch === '\\') {
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
    if (ch === '{') {
      if (depth === 0) objStart = i;
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0 && objStart >= 0) {
        return text.slice(objStart, i + 1);
      }
    }
  }
  return null;
}

function extractAuraContextFromHtml(html) {
  if (!html) return null;
  const marker = '"context":';
  const index = html.indexOf(marker);
  if (index === -1) return null;
  const start = index + marker.length;
  const jsonText = extractBalancedJson(html, start);
  if (!jsonText) return null;
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

async function getAuraContext(page, timeoutMs) {
  let auraContext = null;
  try {
    await page.waitForFunction(() => window.$A && window.$A.getContext, { timeout: timeoutMs });
    auraContext = await page.evaluate(() => {
      const ctx = window.$A.getContext();
      if (ctx && typeof ctx.serialize === 'function') return ctx.serialize();
      if (ctx && typeof ctx.getSerialized === 'function') return ctx.getSerialized();
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
    throw new Error('Aura context not available for token request.');
  }

  const pageUri = await page.evaluate(() => `${location.pathname}${location.search}${location.hash}`);
  return { auraContext, pageUri };
}

function buildAuraMessage() {
  return {
    actions: [
      {
        id: '1;a',
        descriptor: 'apex://Search_CoveoTokenGenerator/ACTION$getToken',
        callingDescriptor: 'markup://c:Search_CoveoEndPointHandler',
        params: {
          clientParams: {
            componentIdentifier: DEFAULT_SEARCH_HUB,
            searchHub: DEFAULT_SEARCH_HUB,
            name: 'Search_CDSSearch',
            customEndpointUrl: `${DEFAULT_ENDPOINT_BASE}/platform`,
          },
        },
      },
    ],
  };
}

async function fetchCoveoToken(context, page, timeoutMs, debug) {
  const { auraContext, pageUri } = await getAuraContext(page, timeoutMs);
  const endpoint = new URL(AURA_TOKEN_ENDPOINT);
  endpoint.searchParams.set('r', String(Math.floor(Math.random() * 100)));
  endpoint.searchParams.set('other.Search_CoveoTokenGenerator.getToken', '1');

  const message = JSON.stringify(buildAuraMessage());

  const response = await context.request.post(endpoint.toString(), {
    form: {
      message,
      'aura.context': auraContext,
      'aura.pageURI': pageUri,
      'aura.token': 'null',
    },
    headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' },
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
  let payload;
  try {
    payload = JSON.parse(cleaned);
  } catch {
    if (debug) {
      console.error('[debug] Aura token response JSON parse failed.');
    }
    return null;
  }

  const action = Array.isArray(payload?.actions) ? payload.actions[0] : null;
  if (!action) {
    if (debug) {
      console.error('[debug] Aura token response missing actions.');
    }
    return null;
  }

  if (action.state && action.state !== 'SUCCESS') {
    if (debug) {
      console.error(`[debug] Aura token action state: ${action.state}`);
      if (action.error) console.error('[debug] Aura error:', JSON.stringify(action.error));
      if (action.errors) console.error('[debug] Aura errors:', JSON.stringify(action.errors));
    }
    return null;
  }

  const returnValue = action?.returnValue || {};
  const accessToken =
    returnValue.accessToken ||
    returnValue.token ||
    returnValue.authToken ||
    returnValue.access_token ||
    null;
  const organizationId = returnValue.organizationId || returnValue.organization || DEFAULT_ORG_ID;
  const searchHub = returnValue.searchHub || DEFAULT_SEARCH_HUB;

  if (!accessToken) {
    if (debug) {
      console.error('[debug] Aura token response missing access token.');
    }
    return null;
  }

  return {
    accessToken,
    organizationId,
    searchHub,
  };
}

function extractTokenFromAuraPayload(payload, debug) {
  const action = Array.isArray(payload?.actions) ? payload.actions[0] : null;
  if (!action) {
    if (debug) console.error('[debug] Aura token payload missing actions.');
    return null;
  }

  if (action.state && action.state !== 'SUCCESS') {
    if (debug) {
      console.error(`[debug] Aura token action state: ${action.state}`);
      if (action.error) console.error('[debug] Aura error:', JSON.stringify(action.error));
      if (action.errors) console.error('[debug] Aura errors:', JSON.stringify(action.errors));
    }
    return null;
  }

  let returnValue = action.returnValue ?? null;
  if (returnValue && typeof returnValue === 'object' && typeof returnValue.returnValue === 'string') {
    returnValue = returnValue.returnValue;
  }
  let accessToken = null;
  let organizationId = DEFAULT_ORG_ID;
  let searchHub = DEFAULT_SEARCH_HUB;
  let endpointBase = DEFAULT_ENDPOINT_BASE;
  let clientUri = DEFAULT_CLIENT_URI;
  let filterer = null;

  if (typeof returnValue === 'string') {
    const trimmed = returnValue.trim();
    if (debug) {
      const jwtLike = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(trimmed);
      console.error(
        `[debug] Aura returnValue string: len=${trimmed.length}, startsWithCurly=${trimmed.startsWith('{')}, jwtLike=${jwtLike}`
      );
    }
    if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(trimmed)) {
      accessToken = trimmed;
    } else if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (debug) {
          console.error('[debug] Aura returnValue parsed keys:', JSON.stringify(Object.keys(parsed)));
        }
        accessToken =
          parsed.accessToken ||
          parsed.token ||
          parsed.authToken ||
          parsed.access_token ||
          null;
        organizationId = parsed.organizationId || parsed.organization || parsed.sfOrganizationId || organizationId;
        searchHub = parsed.searchHub || searchHub;
        endpointBase = parsed.platformUri || parsed.clientUri || endpointBase;
        clientUri = parsed.clientUri || clientUri;
        filterer = parsed.filterer || parsed.filter || filterer;
      } catch {
        accessToken = null;
      }
    }
  } else if (returnValue && typeof returnValue === 'object') {
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
      console.error('[debug] Aura token payload missing access token.');
      const keys = returnValue && typeof returnValue === 'object'
        ? Object.keys(returnValue)
        : ['<string>'];
      console.error('[debug] Aura returnValue keys:', JSON.stringify(keys));
    }
    return null;
  }

  const jwtPayload = decodeJwtPayload(accessToken);
  if (debug && jwtPayload) {
    console.error('[debug] JWT payload keys:', JSON.stringify(Object.keys(jwtPayload)));
  }
  if (jwtPayload) {
    if (!filterer && jwtPayload.filterer) filterer = jwtPayload.filterer;
    if (!filterer && jwtPayload.filter) filterer = jwtPayload.filter;
  }

  return { accessToken, organizationId, searchHub, endpointBase, clientUri, filterer };
}

function decodeJwtPayload(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

async function parseAuraTokenResponse(response, debug) {
  if (!response) return null;
  if (!response.ok()) {
    if (debug) console.error(`[debug] Aura token response failed: HTTP ${response.status()}`);
    return null;
  }

  const rawText = await response.text();
  const cleaned = stripAuraResponsePrefix(rawText);
  let payload;
  try {
    payload = JSON.parse(cleaned);
  } catch {
    if (debug) console.error('[debug] Aura token response JSON parse failed.');
    return null;
  }

  return extractTokenFromAuraPayload(payload, debug);
}

function buildCoveoSearchUrl(tokenInfo) {
  const clientBase = tokenInfo.clientUri || DEFAULT_CLIENT_URI;
  const searchUrl = new URL(`${clientBase.replace(/\/$/, '')}/rest/search/v2`);
  searchUrl.searchParams.set('access_token', tokenInfo.accessToken);
  return searchUrl;
}

function buildCoveoPayload(tokenInfo, query, language, limit) {
  const payload = {
    q: query,
    numberOfResults: limit,
    firstResult: 0,
    searchHub: tokenInfo.searchHub,
    locale: language,
    tab: 'allResultsTab',
    sortCriteria: 'relevancy',
  };

  if (tokenInfo.filterer) {
    payload.aq = tokenInfo.filterer;
  }

  return payload;
}

function logCoveoRequestDebug(tokenInfo, searchUrl, debug) {
  if (!debug) return;
  console.error(`[debug] Coveo endpoint: ${searchUrl.origin}${searchUrl.pathname}`);
  console.error(`[debug] Coveo org: ${tokenInfo.organizationId}, hub: ${tokenInfo.searchHub}`);
  console.error(`[debug] Coveo filterer: ${tokenInfo.filterer ? 'yes' : 'no'}`);
}

function logCoveoResponseDebug(data, debug) {
  if (!debug || !data) return;
  const totalCount = data.totalCount ?? data.totalCountFiltered ?? data.totalCountFilteredByPolicy;
  const resultCount = Array.isArray(data.results) ? data.results.length : 0;
  const hasError = Boolean(data.error || data.errors || data.exception);
  console.error(`[debug] Coveo response: results=${resultCount}, total=${totalCount ?? 'n/a'}, error=${hasError}`);
  if (Array.isArray(data.results) && data.results.length > 0) {
    const preview = data.results.slice(0, 3).map((result) => {
      const raw = result.raw || {};
      return {
        clickUri: result.clickUri || null,
        uri: result.uri || null,
        rawClickUri: raw.clickuri || null,
        rawUri: raw.uri || null,
        rawSourceUrl: raw.sourceurl || null,
        rawDocumentUri: raw.document_uri || null,
        rawSfUrl: raw.sfurl || null,
        rawSfdcUrl: raw.sfdcurl || null,
      };
    });
    console.error('[debug] Coveo result URL preview:', JSON.stringify(preview));
  }
}

async function searchViaCoveoFetch(tokenInfo, query, language, limit, timeoutMs, debug) {
  const searchUrl = buildCoveoSearchUrl(tokenInfo);
  const payload = buildCoveoPayload(tokenInfo, query, language, limit);
  logCoveoRequestDebug(tokenInfo, searchUrl, debug);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response = null;

  try {
    response = await fetch(searchUrl.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (debug) console.error(`[debug] Coveo fetch failed: ${error.message}`);
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
  logCoveoResponseDebug(data, debug);

  return { ok: Boolean(data), status: response.status, data };
}

async function obtainAuraToken(auraTokenPromise, context, page, timeoutMs, debug) {
  let tokenInfo = await parseAuraTokenResponse(await auraTokenPromise, debug);
  if (!tokenInfo) {
    tokenInfo = await fetchCoveoToken(context, page, timeoutMs, debug).catch((err) => {
      if (debug) console.error(`[debug] Aura token fetch error: ${err.message}`);
      return null;
    });
  }
  return applyTokenExpiry(tokenInfo, debug);
}

async function searchViaCoveo(context, tokenInfo, query, language, limit, timeoutMs, debug) {
  const searchUrl = buildCoveoSearchUrl(tokenInfo);
  const payload = buildCoveoPayload(tokenInfo, query, language, limit);
  logCoveoRequestDebug(tokenInfo, searchUrl, debug);

  const response = await context.request.post(searchUrl.toString(), {
    data: payload,
    headers: { 'content-type': 'application/json' },
    timeout: timeoutMs,
  });

  if (!response.ok()) {
    if (debug) {
      console.error(`[debug] Coveo search failed: HTTP ${response.status()}`);
    }
    return { ok: false, status: response.status(), data: null };
  }

  const data = await response.json().catch(() => null);
  logCoveoResponseDebug(data, debug);

  return { ok: Boolean(data), status: response.status(), data };
}

function formatOutput(results, { jsonOutput, withTitles, query }) {
  if (jsonOutput) {
    return JSON.stringify(
      {
        query,
        count: results.length,
        results,
      },
      null,
      2
    ) + '\n';
  }

  const lines = results.map((item) => {
    if (!withTitles || !item.title) return item.url;
    return `${item.url} - ${item.title}`;
  });

  return lines.join('\n') + (lines.length ? '\n' : '');
}

async function writeOutputResults(results, outputOptions, outPath) {
  const output = formatOutput(results, outputOptions);
  if (outPath) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, output, 'utf8');
  } else {
    process.stdout.write(output);
  }
}

async function main() {
  const query = getArg('--query') || getArg('-q');
  const language = getArg('--language') || 'en_US';
  const limit = normalizeLimit(getArg('--limit'));
  let outPath = getArg('--out');
  const timeoutMs = Number(getArg('--timeout') || DEFAULT_TIMEOUT_MS);
  const includeNonHelp = hasFlag('--include-non-help');
  const jsonOutput = hasFlag('--json');
  const withTitles = hasFlag('--with-titles');
  const debug = hasFlag('--debug');

  requireArg('--query', query);

  let projectRoot = await findProjectRoot(process.cwd());
  if (outPath) {
    outPath = resolveOutPath(projectRoot, outPath);
  }
  let cachedTokenInfo = await loadCachedToken(projectRoot, debug);

  if (cachedTokenInfo) {
    const searchResult = await searchViaCoveoFetch(
      cachedTokenInfo,
      query,
      language,
      limit,
      timeoutMs,
      debug
    ).catch(() => null);

    if (searchResult?.ok && Array.isArray(searchResult.data?.results)) {
      const results = extractResults(searchResult.data, { includeNonHelp, limit });
      if (results.length === 0) {
        throw new Error('Search returned no results.');
      }
      await writeOutputResults(results, { jsonOutput, withTitles, query }, outPath);
      return;
    }

    if (debug) console.error('[debug] Cached token fetch failed; falling back to browser.');
    cachedTokenInfo = null;
  }

  ({ projectRoot } = await ensureArtifactsTmpDir());

  const browser = await chromium.launch({ headless: !hasFlag('--headed') });
  const context = await browser.newContext();
  const page = await context.newPage();
  let captured = null;

  page.on('response', async (resp) => {
    if (!resp.url().includes(COVEO_SEARCH_PATH)) return;
    if (resp.request().method() !== 'POST') return;
    try {
      const data = await resp.json();
      let requestPayload = {};
      try {
        requestPayload = JSON.parse(resp.request().postData() || '{}');
      } catch {
        requestPayload = {};
      }
      captured = {
        data,
        requestUrl: resp.request().url(),
        requestPayload,
      };
    } catch {
      // Ignore response parsing failures
    }
  });

  try {
    const searchUrl = buildSearchUrl(query, language);
    const responsePromise = page
      .waitForResponse(
        (resp) => resp.url().includes(COVEO_SEARCH_PATH) && resp.request().method() === 'POST',
        { timeout: timeoutMs }
      )
      .catch(() => null);
    const auraTokenPromise = page
      .waitForResponse((resp) => {
        if (!resp.url().includes('/s/sfsites/aura')) return false;
        if (resp.request().method() !== 'POST') return false;
        const postData = resp.request().postData() || '';
        return postData.includes('Search_CoveoTokenGenerator') && postData.includes('getToken');
      }, { timeout: timeoutMs })
      .catch(() => null);

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await acceptOneTrust(page, timeoutMs);

    await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {});

    let results = [];
    let directResults = 0;

    let tokenInfo = cachedTokenInfo;
    let usedCachedToken = Boolean(tokenInfo);

    if (!tokenInfo) {
      tokenInfo = await obtainAuraToken(auraTokenPromise, context, page, timeoutMs, debug);
      if (tokenInfo) {
        await writeEnvAi(projectRoot, tokenInfo, debug);
      }
    }

    if (tokenInfo) {
      let searchResult = await searchViaCoveo(
        context,
        tokenInfo,
        query,
        language,
        limit,
        timeoutMs,
        debug
      ).catch(() => null);

      if ((!searchResult || !searchResult.ok) && usedCachedToken) {
        if (debug) console.error('[debug] Cached Coveo token rejected; refreshing.');
        tokenInfo = await obtainAuraToken(auraTokenPromise, context, page, timeoutMs, debug);
        usedCachedToken = false;
        if (tokenInfo) {
          await writeEnvAi(projectRoot, tokenInfo, debug);
          searchResult = await searchViaCoveo(
            context,
            tokenInfo,
            query,
            language,
            limit,
            timeoutMs,
            debug
          ).catch(() => null);
        }
      }

      if (searchResult?.data && Array.isArray(searchResult.data.results)) {
        results = extractResults(searchResult.data, { includeNonHelp, limit });
        directResults = results.length;
      }
    }

    if (debug) {
      console.error(`[debug] Direct API results: ${directResults}`);
    }

    if (results.length === 0) {
      const response = await responsePromise;

      let requestUrl = null;
      let requestPayload = {};
      let data = null;

      if (response) {
        const request = response.request();
        requestUrl = request.url();
        try {
          requestPayload = JSON.parse(request.postData() || '{}');
        } catch {
          requestPayload = {};
        }
        data = await response.json().catch(() => null);
      } else if (captured) {
        requestUrl = captured.requestUrl;
        requestPayload = captured.requestPayload || {};
        data = captured.data || null;
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
            headers: { 'content-type': 'application/json' },
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

    if (results.length === 0) {
      throw new Error('Search returned no results.');
    }
    await writeOutputResults(results, { jsonOutput, withTitles, query }, outPath);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
