#!/usr/bin/env node

'use strict';

const fs = require('fs/promises');
const path = require('path');
const { chromium } = require('playwright');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const TurndownService = require('turndown');

const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY_MS = 3000;
const MIN_CONTENT_LENGTH = 100;
const FAILURE_INDEX_FILENAME = '.scrape-failures.json';

const DEFAULT_REMOVE_SELECTORS = [
  '#onetrust-consent-sdk',
  '#onetrust-banner-sdk',
  '.onetrust-pc-sdk',
  '.ot-sdk-container',
  '.ot-sdk-row',
  '#ot-sdk-btn',
  '.ot-sdk-show-settings',
  'iframe[id*="onetrust"]',
  'iframe[src*="onetrust"]',
  '[id*="onetrust"]',
  '[class*="onetrust"]',
];

// Known patterns that indicate garbage content (footer, language picker, etc.)
const GARBAGE_PATTERNS = [
  /^©\s*Copyright\s+\d{4}\s+Salesforce/m,
  /Salesforce Tower,\s*415 Mission Street/,
  /^\*\s+(English|Français|Deutsch|Italiano|日本語)\s*$/m,
];

// Patterns that indicate an error / not-found page on developer.salesforce.com
const DEV_ERROR_PATTERNS = [
  /page\s*(not\s*found|doesn't\s*exist|can'?t\s*be\s*found)/i,
  /we\s*couldn'?t\s*find/i,
  /we looked high and low/i,
];

// ---------------------------------------------------------------------------
// Argument parsing helpers
// ---------------------------------------------------------------------------

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function parseCookie(cookieStr) {
  if (!cookieStr) return null;
  const parts = cookieStr.split(';').map((part) => part.trim());
  const [nameValue, ...attrs] = parts;
  const eqIndex = nameValue.indexOf('=');
  if (eqIndex === -1) return null;
  const cookie = {
    name: nameValue.slice(0, eqIndex),
    value: nameValue.slice(eqIndex + 1),
  };
  for (const attr of attrs) {
    const [key, value] = attr.split('=');
    if (!key) continue;
    const normalized = key.toLowerCase();
    if (normalized === 'domain') cookie.domain = value;
    if (normalized === 'path') cookie.path = value;
    if (normalized === 'secure') cookie.secure = true;
    if (normalized === 'samesite') cookie.sameSite = value;
  }
  return cookie;
}

function parseList(listStr) {
  if (!listStr) return [];
  return listStr
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireArg(flag, value) {
  if (!value) {
    console.error(`Missing required argument: ${flag}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Failure index — tracks URLs that failed so repeat mistakes are avoided.
// Stored as JSON in the output directory.
// ---------------------------------------------------------------------------

async function readFailureIndex(outDir) {
  const indexPath = path.join(outDir, FAILURE_INDEX_FILENAME);
  try {
    const raw = await fs.readFile(indexPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeFailureIndex(outDir, index) {
  const indexPath = path.join(outDir, FAILURE_INDEX_FILENAME);
  const tmpPath = indexPath + '.tmp';
  const data = JSON.stringify(index, null, 2) + '\n';
  await fs.writeFile(tmpPath, data, { encoding: 'utf8' });
  await fs.rename(tmpPath, indexPath);
}

async function recordFailure(outDir, url, reason, httpStatus) {
  const index = await readFailureIndex(outDir);
  index[url] = {
    reason,
    httpStatus: httpStatus || null,
    lastAttempt: new Date().toISOString(),
    attempts: ((index[url] && index[url].attempts) || 0) + 1,
    scraper: 'salesforce-developer-site-scraper',
  };
  await writeFailureIndex(outDir, index);
}

function isKnownFailure(index, url) {
  return Boolean(index[url]);
}

// ---------------------------------------------------------------------------
// Content quality validation
// ---------------------------------------------------------------------------

function isGarbageContent(markdownBody) {
  if (!markdownBody || markdownBody.trim().length < MIN_CONTENT_LENGTH) return true;

  const trimmed = markdownBody.trim();
  const lines = trimmed.split('\n').filter((l) => l.trim().length > 0);

  // If there's a lot of content, it's not garbage even if footer patterns match
  if (trimmed.length > 2000) return false;

  // Check if content is mostly copyright/language picker
  const garbageMatches = GARBAGE_PATTERNS.filter((p) => p.test(trimmed));
  if (garbageMatches.length >= 2) return true;

  // If the only substantial content is a list of languages, it's garbage
  const languagePattern =
    /^\*\s+(English|Français|Deutsch|Italiano|日本語|Español|中文|한국어|Русский|Português|Suomi|Dansk|Svenska|Nederlands|Norsk)/;
  const langLines = lines.filter((l) => languagePattern.test(l.trim()));
  if (langLines.length >= 5) {
    const nonLangContent = lines
      .filter((l) => !languagePattern.test(l.trim()) && !/^©/.test(l.trim()) && !/Salesforce Tower/.test(l))
      .join('')
      .trim();
    if (nonLangContent.length < MIN_CONTENT_LENGTH) return true;
  }

  return false;
}

function looksLikeErrorPage(text) {
  return DEV_ERROR_PATTERNS.some((p) => p.test(text));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const url = getArg('--url');
  const outPath = getArg('--out');
  const consentSelector = getArg('--consent-selector');
  const waitMs = Number(getArg('--wait') || 0);
  const contentSelector = getArg('--content-selector');
  const removeSelectorsArg = getArg('--remove-selectors');
  const cookieStr = getArg('--cookie');
  const storageState = getArg('--storage-state');
  const timeoutMs = Number(getArg('--timeout') || DEFAULT_TIMEOUT_MS);
  const disableDefaultRemovals = hasFlag('--no-default-removals');
  const ignoreCache = hasFlag('--ignore-cache');
  const retries = Number(getArg('--retries') || DEFAULT_RETRY_COUNT);

  requireArg('--url', url);
  requireArg('--out', outPath);

  const outDir = path.dirname(outPath);
  await fs.mkdir(outDir, { recursive: true });

  // --- Check failure index before doing any work ---
  if (!ignoreCache) {
    const failureIndex = await readFailureIndex(outDir);
    if (isKnownFailure(failureIndex, url)) {
      const entry = failureIndex[url];
      console.error(
        `SKIPPED: URL previously failed (${entry.reason}, attempts: ${entry.attempts}, last: ${entry.lastAttempt}).`
      );
      console.error('Use --ignore-cache to force a retry.');
      process.exit(2);
    }
  }

  // --- Launch browser --------------------------------------------------------
  const browser = await chromium.launch({ headless: !hasFlag('--headed') });
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = DEFAULT_RETRY_DELAY_MS * attempt;
      console.warn(`Retry ${attempt}/${retries} after ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const result = await scrape(browser, {
        url,
        outPath,
        consentSelector,
        waitMs: waitMs || (attempt > 0 ? 3000 : 0),
        contentSelector,
        removeSelectorsArg,
        cookieStr,
        storageState,
        timeoutMs,
        disableDefaultRemovals,
      });

      if (result.success) {
        await browser.close();
        console.log(`OK: Saved ${result.contentLength} chars to ${outPath}`);
        return;
      }

      lastError = result.reason;
      console.warn(`Attempt ${attempt + 1} failed: ${result.reason}`);
    } catch (err) {
      lastError = err.message;
      console.warn(`Attempt ${attempt + 1} error: ${err.message}`);
    }
  }

  // --- All attempts exhausted ------------------------------------------------
  await browser.close();
  await recordFailure(outDir, url, lastError || 'unknown', null);
  console.error(`FAILED after ${retries + 1} attempts: ${lastError}`);
  console.error(`URL recorded in failure index: ${path.join(outDir, FAILURE_INDEX_FILENAME)}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Core scraping logic (single attempt)
// ---------------------------------------------------------------------------

async function scrape(browser, opts) {
  const {
    url,
    outPath,
    consentSelector,
    waitMs,
    contentSelector,
    removeSelectorsArg,
    cookieStr,
    storageState,
    timeoutMs,
    disableDefaultRemovals,
  } = opts;

  const contextOptions = storageState ? { storageState } : {};
  const context = await browser.newContext(contextOptions);

  let docsApiContent = null;
  let docsApiTitle = null;

  const cookie = parseCookie(cookieStr);
  if (cookie && cookie.domain) {
    await context.addCookies([cookie]);
  }

  const page = await context.newPage();

  // Intercept the docs content API to capture content and detect empty responses
  page.on('response', async (response) => {
    const responseUrl = response.url();
    if (!responseUrl.includes('/docs/get_document_content/')) return;
    try {
      const text = await response.text();
      if (!text || text.trim().length === 0) {
        // Empty body = missing doc (observed behavior for invalid paths)
        docsApiContent = null;
        docsApiTitle = null;
        return;
      }
      const payload = JSON.parse(text);
      if (payload && payload.content) {
        docsApiContent = payload.content;
        docsApiTitle = payload.title || payload.id || docsApiTitle;
      }
    } catch {
      // Non-JSON response — leave as null
    }
  });

  // --- Navigate --------------------------------------------------------------
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });

  if (!response) {
    await context.close();
    return { success: false, reason: 'No response received (about:blank or same-hash navigation)' };
  }

  const httpStatus = response.status();
  if (httpStatus >= 400) {
    await context.close();
    const outDir = path.dirname(outPath);
    await recordFailure(outDir, url, `HTTP ${httpStatus}`, httpStatus);
    return { success: false, reason: `HTTP ${httpStatus}` };
  }

  // Detect redirect (developer.salesforce.com silently redirects invalid doc
  // paths to the guide landing page instead of returning 404).
  // Only flag as "not found" when the redirect stays inside the same doc-set
  // base path (e.g. /docs/atlas.en-us.apexcode.meta/) but the page slug
  // changed.  Cross-doc-set redirects (atlas → new platform URL, einstein →
  // agentforce, etc.) are legitimate URL migrations and should be followed —
  // BUT only when the final URL preserves the requested article slug.  If the
  // final URL is a generic landing page, it's a not-found redirect regardless
  // of whether the doc set changed.
  const finalUrl = page.url();
  const requestedPath = new URL(url).pathname;
  const finalPath = new URL(finalUrl).pathname;
  if (requestedPath !== finalPath && !finalPath.startsWith(requestedPath)) {
    console.warn(`Redirect detected: ${url} → ${finalUrl}`);

    // Extract doc-set base: the first 3 segments of the path that identify
    // the documentation product (e.g. ["docs", "atlas.en-us.apexcode.meta", "apexcode"])
    const reqSegments = requestedPath.split('/').filter(Boolean);
    const finSegments = finalPath.split('/').filter(Boolean);
    const reqBase = reqSegments.slice(0, 3).join('/');
    const finBase = finSegments.slice(0, 3).join('/');
    const sameDocSet = reqBase === finBase;

    // Check if the requested page slug is preserved in the final URL.
    // For atlas URLs: the last segment is the article (e.g. "apex_triggers.htm")
    // For platform URLs: the last path component is the article.
    const reqSlug = reqSegments[reqSegments.length - 1]?.replace(/\.[^.]+$/, '') || '';
    const finSlug = finSegments[finSegments.length - 1]?.replace(/\.[^.]+$/, '') || '';
    const slugPreserved = reqSlug && finSlug && reqSlug === finSlug;

    // Known landing page slug patterns (generic guide root pages)
    const landingPatterns = /^(apex_dev_guide|apex_ref_guide|sforce_api_objects|get[-_]started|guide|quick[-_]start|overview|intro|index|reference)$/i;
    const isLanding = landingPatterns.test(finSlug);

    if (sameDocSet && !docsApiContent) {
      // Same doc set but different page → not-found redirect to landing
      await context.close();
      return { success: false, reason: `Redirected to ${finalUrl} (page not found)` };
    }

    if (!sameDocSet && !slugPreserved && (isLanding || !docsApiContent)) {
      // Cross-doc-set redirect to a generic landing page → not-found
      await context.close();
      return { success: false, reason: `Redirected to ${finalUrl} (page not found)` };
    }
    // Cross-doc-set redirect that preserves slug → legitimate migration
  }

  // --- Consent handling ------------------------------------------------------
  // Always try to dismiss OneTrust on developer.salesforce.com, even without
  // an explicit --consent-selector.  The cookie banner blocks content rendering
  // on many pages.
  const effectiveConsentSelector = consentSelector || '#onetrust-accept-btn-handler';
  try {
    const consentBtn = page.locator(effectiveConsentSelector).first();
    if (await consentBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await consentBtn.click({ timeout: 3000 });
      await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {});
    }
  } catch {
    // Consent selector not found or not visible — continue
  }

  if (waitMs > 0) {
    await page.waitForTimeout(waitMs);
  }

  // --- Remove unwanted elements ----------------------------------------------
  const removeSelectors = [
    ...(disableDefaultRemovals ? [] : DEFAULT_REMOVE_SELECTORS),
    ...parseList(removeSelectorsArg),
  ];
  if (removeSelectors.length > 0) {
    await page.evaluate((selectors) => {
      selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((node) => node.remove());
      });
    }, removeSelectors);
  }

  // --- Extract content -------------------------------------------------------
  let html = null;
  let title = null;

  if (contentSelector) {
    try {
      html = await page.locator(contentSelector).first().evaluate((el) => el.outerHTML);
      title = await page.title();
    } catch {
      console.warn('Content selector not found. Falling back to Readability.');
    }
  }

  if (!html && !contentSelector) {
    try {
      html = await page.locator('main, article').first().evaluate((el) => el.outerHTML);
      title = await page.title();
    } catch {
      // Fall through to Readability.
    }
  }

  if (!html) {
    const pageContent = await page.content();
    const dom = new JSDOM(pageContent, { url: finalUrl });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (article && article.content) {
      html = article.content;
      title = article.title || (await page.title());
    } else {
      html = dom.window.document.body ? dom.window.document.body.innerHTML : pageContent;
      title = await page.title();
    }
  }

  const turndown = new TurndownService({ headingStyle: 'atx' });
  let markdownBody = turndown.turndown(html || '');

  // Fall back to docs content API if page content is insufficient
  if (markdownBody.trim().length < MIN_CONTENT_LENGTH && docsApiContent) {
    markdownBody = turndown.turndown(docsApiContent);
    title = docsApiTitle || title;
  }

  // --- Shadow DOM fallback ---------------------------------------------------
  // New-style developer docs (e.g. Commerce Cloud API references) render
  // content inside deeply-nested Shadow DOM custom elements such as
  // <doc-amf-reference>. Normal extraction yields 0 chars because the light
  // DOM is empty. We recursively walk shadow roots inside the browser to
  // collect their innerHTML, focusing only on doc-related custom elements
  // (skipping global nav, cookie banners, etc.).
  if (markdownBody.trim().length < MIN_CONTENT_LENGTH) {
    try {
      const shadowHtml = await page.evaluate(() => {
        // Tags whose shadow roots contain documentation content
        const DOC_SHADOW_HOSTS = [
          'doc-amf-reference',
          'doc-content-layout',
          'doc-xml-content',
          'doc-header',
          'doc-heading',
          'doc-sidebar',
          'doc-raml-resource',
          'doc-raml-method',
        ];
        // Tags to skip — global nav, instrumentation, etc.
        const SKIP_TAGS = new Set([
          'hgf-c360nav',
          'hgf-c360contextnav',
          'dx-scroll-manager',
          'dx-skip-nav-link',
          'dw-instrumentation',
        ]);

        function collectShadowHtml(node, depth) {
          if (depth > 15) return '';
          let html = '';
          if (node.shadowRoot) {
            const frag = document.createElement('div');
            for (const child of node.shadowRoot.children) {
              const tag = child.tagName.toLowerCase();
              if (tag === 'style' || tag === 'script' || tag === 'link') continue;
              frag.appendChild(child.cloneNode(true));
            }
            html += frag.innerHTML;
            for (const el of node.shadowRoot.querySelectorAll('*')) {
              if (el.shadowRoot && !SKIP_TAGS.has(el.tagName.toLowerCase())) {
                html += collectShadowHtml(el, depth + 1);
              }
            }
          }
          return html;
        }

        let all = '';
        // Start from known doc shadow hosts rather than all elements
        for (const tag of DOC_SHADOW_HOSTS) {
          const els = document.querySelectorAll(tag);
          for (const el of els) {
            if (el.shadowRoot) {
              all += collectShadowHtml(el, 0);
            }
          }
        }
        return all;
      });

      if (shadowHtml && shadowHtml.length > MIN_CONTENT_LENGTH) {
        const cleanedShadow = shadowHtml
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<script[\s\S]*?<\/script>/gi, '');

        const shadowMd = turndown.turndown(cleanedShadow);
        if (shadowMd.trim().length > markdownBody.trim().length) {
          markdownBody = shadowMd;
          title = (await page.title()) || title;
        }
      }
    } catch (shadowError) {
      console.warn('Shadow DOM extraction failed:', shadowError.message);
    }
  }

  // No content from any source
  if (markdownBody.trim().length < MIN_CONTENT_LENGTH && !docsApiContent) {
    await context.close();
    return {
      success: false,
      reason: `Content too short (${markdownBody.trim().length} chars), no docs API fallback`,
    };
  }

  // --- Quality gates ---------------------------------------------------------
  if (isGarbageContent(markdownBody)) {
    await context.close();
    return { success: false, reason: 'Garbage content (footer/language picker only)' };
  }

  if (looksLikeErrorPage(markdownBody)) {
    await context.close();
    return { success: false, reason: 'Error/not-found page detected in content' };
  }

  // --- Write output ----------------------------------------------------------
  const isoStamp = new Date().toISOString();
  const markdown = [
    `# ${title || 'Documentation Snapshot'}`,
    '',
    `Source: ${url}`,
    `Fetched: ${isoStamp}`,
    '',
    markdownBody.trim(),
    '',
  ].join('\n');

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, markdown, 'utf8');

  await context.close();
  return { success: true, contentLength: markdownBody.trim().length };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
