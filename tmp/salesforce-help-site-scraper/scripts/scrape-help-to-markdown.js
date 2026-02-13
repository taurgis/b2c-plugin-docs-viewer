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
const ARTIFACTS_DIRNAME = 'artifacts';
const ARTIFACTS_TMP_DIRNAME = 'tmp';

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

function resolveOutPath(projectRoot, outPath) {
  const artifactsDir = path.resolve(projectRoot, ARTIFACTS_DIRNAME);
  const resolved = path.resolve(projectRoot, outPath);
  if (resolved === artifactsDir || resolved.startsWith(`${artifactsDir}${path.sep}`)) {
    return resolved;
  }
  throw new Error(`Output path must live under ${artifactsDir}`);
}

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

const DEFAULT_CONTENT_SELECTORS = [
  'main article',
  'article',
  'main',
  '.slds-rich-text-editor__output',
  '.article-body',
  '.help-article',
  '[data-aura-class*="article"]',
];

// Known patterns that indicate garbage content (footer, language picker, etc.)
const GARBAGE_PATTERNS = [
  /^©\s*Copyright\s+\d{4}\s+Salesforce/m,
  /Salesforce Tower,\s*415 Mission Street/,
  /^\*\s+(English|Français|Deutsch|Italiano|日本語)\s*$/m,
];

// Salesforce Help error page indicators (Aura error overlay)
const HELP_ERROR_SELECTORS = [
  '#auraErrorTitle',
  '#auraError',
  '#auraErrorMask',
];
const HELP_ERROR_PATTERNS = [
  /we looked high and low/i,
  /couldn'?t find that page/i,
  /sorry to interrupt/i,
  /page\s*(not\s*found|doesn't\s*exist)/i,
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
// Shared format with the developer site scraper.
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
    scraper: 'salesforce-help-site-scraper',
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
  return HELP_ERROR_PATTERNS.some((p) => p.test(text));
}

// ---------------------------------------------------------------------------
// Content extraction helper — picks the best content node from a list of
// candidate selectors, filtering by minimum text length.
// ---------------------------------------------------------------------------

async function pickBestContentHtml(page, selectors, minLength) {
  return page.evaluate(
    ({ selectors, minLength }) => {
      let best = null;
      let bestScore = 0;
      selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((el) => {
          const text = (el.innerText || '').trim();
          const score = text.length;
          if (score >= minLength && score > bestScore) {
            bestScore = score;
            best = el;
          }
        });
      });
      return best ? best.outerHTML : null;
    },
    { selectors, minLength }
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const url = getArg('--url');
  let outPath = getArg('--out');
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

  const { projectRoot } = await ensureArtifactsTmpDir();
  outPath = resolveOutPath(projectRoot, outPath);

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

  const cookie = parseCookie(cookieStr);
  if (cookie && cookie.domain) {
    await context.addCookies([cookie]);
  }

  const page = await context.newPage();

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

  // --- Detect Salesforce Help error pages (Aura error overlay) ---------------
  // help.salesforce.com returns HTTP 200 even for missing articles, but renders
  // an Aura error overlay with #auraErrorTitle "Sorry to interrupt".
  // IMPORTANT: These elements exist in the DOM on ALL help pages (including
  // valid ones) but are hidden. We must check actual visibility:
  //   - Valid page:   #auraErrorMask has display:none, offsetWidth/Height = 0
  //   - Error page:   #auraErrorMask is visible with non-zero dimensions
  const hasAuraError = await page.evaluate((selectors) => {
    return selectors.some((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      // Check if the element is actually rendered and visible
      const style = window.getComputedStyle(el);
      if (style.display === 'none') return false;
      return el.offsetWidth > 0 || el.offsetHeight > 0;
    });
  }, HELP_ERROR_SELECTORS);

  if (hasAuraError) {
    await context.close();
    const outDir = path.dirname(outPath);
    await recordFailure(outDir, url, 'Aura error page (article not found)', httpStatus);
    return { success: false, reason: 'Aura error page detected (article not found)' };
  }

  // --- Consent handling ------------------------------------------------------
  // Always try to dismiss OneTrust on help.salesforce.com, even without an
  // explicit --consent-selector.  The cookie banner can interfere with content
  // extraction.
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

  // --- Early error page detection via visible text ----------------------------
  // Some help.salesforce.com error pages don't use the Aura error overlay but
  // still show "We looked high and low" or similar text.  Detect these before
  // spending time on content extraction.
  try {
    const visibleBodyText = await page.innerText('body').catch(() => '');
    if (visibleBodyText && looksLikeErrorPage(visibleBodyText)) {
      await context.close();
      const outDir = path.dirname(outPath);
      await recordFailure(outDir, url, 'Error page detected (article not found)', httpStatus);
      return { success: false, reason: 'Error page detected (article not found)' };
    }
  } catch {
    // Can't read visible text — continue with extraction
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
  const turndown = new TurndownService({ headingStyle: 'atx' });

  if (contentSelector) {
    try {
      html = await page.locator(contentSelector).first().evaluate((el) => el.outerHTML);
      title = await page.title();
    } catch {
      console.warn('Content selector not found. Falling back to automatic selection.');
    }
  }

  if (!html) {
    html = await pickBestContentHtml(page, DEFAULT_CONTENT_SELECTORS, 200);
    if (html) {
      title = await page.title();
    }
  }

  // If selector-based extraction returned very little text, discard it and
  // fall through to Readability which does a better job on full-page HTML.
  if (html) {
    const quickCheck = html.replace(/<[^>]+>/g, '').trim();
    if (quickCheck.length < MIN_CONTENT_LENGTH) {
      html = null;
    }
  }

  if (!html) {
    // Salesforce Help pages render content dynamically via Lightning/Aura.
    // page.content() returns the server-rendered HTML that often lacks the
    // article body. Instead, get the rendered DOM via Playwright's evaluate
    // which sees the fully-rendered Lightning component output.
    const renderedBodyHtml = await page.evaluate(() => {
      // Remove known noise elements from the rendered DOM before extracting
      const noiseSelectors = [
        '#onetrust-consent-sdk', '#onetrust-banner-sdk',
        '.onetrust-pc-sdk', 'iframe[src*="onetrust"]',
        'footer', 'nav', 'header',
      ];
      noiseSelectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => el.remove());
      });
      return document.body ? document.body.innerHTML : '';
    });

    if (renderedBodyHtml && renderedBodyHtml.length > MIN_CONTENT_LENGTH) {
      // Try Readability on the rendered DOM
      const dom = new JSDOM(renderedBodyHtml, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      if (article && article.content) {
        // Quick-check: is the Readability result real content or just footer?
        const testMd = turndown.turndown(article.content);
        if (testMd.trim().length >= MIN_CONTENT_LENGTH && !isGarbageContent(testMd)) {
          html = article.content;
          title = article.title || (await page.title());
        }
      }
    }
  }

  if (!html) {
    // Last resort for Lightning/Aura pages: use Playwright's innerText to
    // get visible rendered text. This captures dynamically-rendered article
    // content that is invisible to Readability and raw page source.
    const visibleText = await page.innerText('body').catch(() => '');
    if (visibleText.trim().length >= MIN_CONTENT_LENGTH) {
      // Convert plain text to basic HTML for Turndown
      const escapedText = visibleText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const paragraphs = escapedText.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`);
      html = paragraphs.join('\n');
      title = await page.title();
    }
  }

  if (!html) {
    // Final fallback: raw page source (works for static pages)
    const pageContent = await page.content();
    const dom = new JSDOM(pageContent, { url });
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

  const markdownBody = turndown.turndown(html || '');

  // No meaningful content extracted
  if (markdownBody.trim().length < MIN_CONTENT_LENGTH) {
    await context.close();
    return {
      success: false,
      reason: `Content too short (${markdownBody.trim().length} chars)`,
    };
  }

  // --- Quality gates ---------------------------------------------------------
  if (looksLikeErrorPage(markdownBody)) {
    await context.close();
    return { success: false, reason: 'Error/not-found page detected in content' };
  }

  if (isGarbageContent(markdownBody)) {
    await context.close();
    return { success: false, reason: 'Garbage content (footer/language picker only)' };
  }

  // --- Write output ----------------------------------------------------------
  const isoStamp = new Date().toISOString();
  const markdown = [
    `# ${title || 'Help Article Snapshot'}`,
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
