import { chromium } from "playwright";
import type { Browser, BrowserContext, Page } from "playwright";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { buildCachePath, readCache, writeCache } from "./cache";
import { normalizeAndValidateDocUrl } from "./urlPolicy";
import { acceptOneTrust } from "./browserConsent";
import {
  convertHtmlToMarkdown,
  createTurndown,
  formatHelpArticleMarkdown,
} from "./helpScraperMarkdown";
import { getErrorMessage } from "./errorUtils";

export { convertHtmlToMarkdown, formatHelpArticleMarkdown } from "./helpScraperMarkdown";

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_WAIT_MS = 2500;
const MIN_CONTENT_LENGTH = 100;

const DEFAULT_REMOVE_SELECTORS = [
  "#onetrust-consent-sdk",
  "#onetrust-banner-sdk",
  ".onetrust-pc-sdk",
  ".ot-sdk-container",
  ".ot-sdk-row",
  "#ot-sdk-btn",
  ".ot-sdk-show-settings",
  "iframe[id*='onetrust']",
  "iframe[src*='onetrust']",
  "[id*='onetrust']",
  "[class*='onetrust']",
  ".ht-foot",
  ".ht-footer",
  "[class*='ht-side']",
  "[aria-label*='Table of Contents']",
  "[id*='table-of-contents']",
  "[class*='table-of-contents']",
  "script",
  "style",
];

const DEFAULT_CONTENT_SELECTORS = [
  ".markdown-content",
  ".ht-body",
  ".siteforceDynamicLayout.siteforceContentArea",
  ".slds-rich-text-editor__output",
  ".article-body",
  ".help-article",
  "[data-aura-class*='article']",
  "main article",
  "article",
  "main",
  ".cHCPortalTheme",
];

const HELP_ERROR_SELECTORS = ["#auraErrorTitle", "#auraError", "#auraErrorMask"];
const HELP_ERROR_PATTERNS = [
  /we looked high and low/i,
  /couldn't find that page/i,
  /sorry to interrupt/i,
  /page\s*(not\s*found|doesn't\s*exist)/i,
];
const DEV_ERROR_PATTERNS = [
  /page\s*(not\s*found|doesn't\s*exist|can'?t\s*be\s*found)/i,
  /we\s*couldn'?t\s*find/i,
  /we looked high and low/i,
];
const DEV_DOC_SHADOW_HOSTS = [
  "doc-amf-reference",
  "doc-content-layout",
  "doc-xml-content",
  "doc-header",
  "doc-heading",
  "doc-sidebar",
  "doc-raml-resource",
  "doc-raml-method",
];
const DEV_SHADOW_SKIP_TAGS = [
  "hgf-c360nav",
  "hgf-c360contextnav",
  "dx-scroll-manager",
  "dx-skip-nav-link",
  "dw-instrumentation",
];

const GARBAGE_PATTERNS = [
  /^\u00a9\s*Copyright\s+\d{4}\s+Salesforce/m,
  /Salesforce Tower,\s*415 Mission Street/,
  /^\*\s+(English|Francais|Deutsch|Italiano|\u65e5\u672c\u8a9e)\s*$/m,
];

export type DetailResult = {
  url: string;
  title: string | null;
  markdown: string;
  rawHtml?: string;
};

export type DetailOptions = {
  url: string;
  timeoutMs?: number;
  waitMs?: number;
  headed?: boolean;
  useCache?: boolean;
  includeRawHtml?: boolean;
  debug?: boolean;
  session?: ScraperSession;
};

export type ScraperSession = {
  context: BrowserContext;
  close: () => Promise<void>;
};

export async function createScraperSession(options?: { headed?: boolean }): Promise<ScraperSession> {
  const headed = options?.headed ?? false;
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext();
  let closed = false;

  return {
    context,
    close: async () => {
      if (closed) return;
      closed = true;
      await closeScraperSession(browser, context);
    },
  };
}

async function closeScraperSession(browser: Browser, context: BrowserContext): Promise<void> {
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
}

function stripGarbage(text: string): string {
  let output = text.trim();
  for (const pattern of GARBAGE_PATTERNS) {
    output = output.replace(pattern, "");
  }
  return output.trim();
}

function extractBestContent(document: Document): { html: string | null; title: string | null } {
  let best: Element | null = null;
  let bestLength = 0;

  for (const selector of DEFAULT_CONTENT_SELECTORS) {
    const node = document.querySelector(selector);
    if (!node) continue;
    const textLength = (node.textContent || "").trim().length;
    if (textLength >= MIN_CONTENT_LENGTH) {
      return { html: node.innerHTML, title: document.title || null };
    }
    if (textLength > bestLength) {
      best = node;
      bestLength = textLength;
    }
  }

  if (!best) {
    const reader = new Readability(document);
    const article = reader.parse();
    if (article?.content) {
      return { html: article.content, title: article.title || null };
    }
    return { html: null, title: null };
  }

  return { html: best.innerHTML, title: document.title || null };
}

async function isAuraErrorVisible(page: Page): Promise<boolean> {
  for (const selector of HELP_ERROR_SELECTORS) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible({ timeout: 1500 }).catch(() => false)) {
      return true;
    }
  }
  return false;
}

async function waitForAnySelector(
  page: Page,
  selectors: string[],
  timeoutMs: number,
  debug: boolean,
  label: string
): Promise<void> {
  if (selectors.length === 0) return;

  const perSelectorTimeout = Math.max(1200, Math.floor(timeoutMs / selectors.length));

  for (const selector of selectors) {
    const matched = await page
      .locator(selector)
      .first()
      .waitFor({ state: "visible", timeout: perSelectorTimeout })
      .then(() => true)
      .catch(() => false);

    if (matched) {
      return;
    }
  }

  if (debug) {
    console.error(
      `[debug] Timed out waiting for ${label} selectors (${selectors.join(", ")}).`
    );
  }
}

function looksLikeErrorPage(text: string): boolean {
  return HELP_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

function looksLikeDeveloperErrorPage(text: string): boolean {
  return DEV_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

function isDeveloperDocsUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.hostname === "developer.salesforce.com" && url.pathname.startsWith("/docs/");
  } catch {
    return false;
  }
}

export function getDetailSourceType(rawUrl: string): "developer" | "help" {
  return isDeveloperDocsUrl(rawUrl) ? "developer" : "help";
}

function normalizeMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractMarkdownTitle(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || null;
}

async function scrapeHelpMarkdown(
  context: BrowserContext,
  url: string,
  timeoutMs: number,
  waitMs: number,
  includeRawHtml: boolean,
  debug: boolean
): Promise<DetailResult> {
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await acceptOneTrust(page, timeoutMs);
    await waitForAnySelector(
      page,
      [".markdown-content", ".ht-body", "main article", "article", "main", ".cHCPortalTheme"],
      Math.min(timeoutMs, 12_000),
      debug,
      "help content"
    );

    if (waitMs > 0) {
      await page.waitForTimeout(waitMs);
    }

    const bodyText = await page.innerText("body");
    if (await isAuraErrorVisible(page) || looksLikeErrorPage(bodyText)) {
      throw new Error("Help article error page detected.");
    }

    const html = await page.content();
    const dom = new JSDOM(html, { url });
    const { document } = dom.window;

    for (const selector of DEFAULT_REMOVE_SELECTORS) {
      for (const node of Array.from(document.querySelectorAll(selector))) {
        if (node && typeof (node as Element).remove === "function") {
          (node as Element).remove();
        }
      }
    }

    let { html: contentHtml, title } = extractBestContent(document);
    let markdown = "";

    if (contentHtml) {
      markdown = convertHtmlToMarkdown(contentHtml, url);
    }

    markdown = stripGarbage(markdown);
    markdown = formatHelpArticleMarkdown(markdown, title || null);

    if (markdown.length < MIN_CONTENT_LENGTH) {
      const textFallback = formatHelpArticleMarkdown(stripGarbage(bodyText), title || null);
      if (textFallback.length >= MIN_CONTENT_LENGTH) {
        markdown = textFallback;
      }
    }

    if (markdown.length < MIN_CONTENT_LENGTH) {
      throw new Error("Extracted content was too short.");
    }

    const normalizedMarkdown = normalizeMarkdown(markdown);
    const markdownTitle = extractMarkdownTitle(normalizedMarkdown);

    const result: DetailResult = {
      url,
      title: markdownTitle || title || null,
      markdown: normalizedMarkdown,
    };

    if (includeRawHtml && contentHtml) {
      result.rawHtml = contentHtml.trim();
    }

    return result;
  } finally {
    await page.close().catch(() => {});
  }
}

async function extractDeveloperShadowDomHtml(page: Page): Promise<string> {
  return page.evaluate(
    (params: { hosts: string[]; skipTags: string[] }) => {
      const skipTags = new Set(params.skipTags);

      function collectShadowHtml(node: Element, depth: number): string {
        if (depth > 15) return "";
        let html = "";

        const host = node as Element & { shadowRoot?: ShadowRoot | null };
        if (host.shadowRoot) {
          const fragment = document.createElement("div");
          for (const child of Array.from(host.shadowRoot.children)) {
            const tag = child.tagName.toLowerCase();
            if (tag === "style" || tag === "script" || tag === "link") continue;
            fragment.appendChild(child.cloneNode(true));
          }
          html += fragment.innerHTML;

          for (const el of Array.from(host.shadowRoot.querySelectorAll("*"))) {
            const nested = el as Element & { shadowRoot?: ShadowRoot | null };
            if (nested.shadowRoot && !skipTags.has(el.tagName.toLowerCase())) {
              html += collectShadowHtml(el, depth + 1);
            }
          }
        }

        return html;
      }

      let all = "";
      for (const tag of params.hosts) {
        for (const el of Array.from(document.querySelectorAll(tag))) {
          const node = el as Element & { shadowRoot?: ShadowRoot | null };
          if (node.shadowRoot) {
            all += collectShadowHtml(el, 0);
          }
        }
      }

      return all;
    },
    { hosts: DEV_DOC_SHADOW_HOSTS, skipTags: DEV_SHADOW_SKIP_TAGS }
  );
}

async function extractDeveloperCodeBlocks(page: Page): Promise<Array<{ language: string; code: string }>> {
  return page.evaluate(() => {
    const blocks = Array.from(document.querySelectorAll("dx-code-block"));
    return blocks
      .map((node) => {
        const code = (node.getAttribute("code-block") || node.textContent || "")
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n")
          .trim();
        const language = (node.getAttribute("language") || "").trim();
        return { language, code };
      })
      .filter((item) => item.code.length > 0);
  });
}

async function scrapeDeveloperMarkdown(
  context: BrowserContext,
  url: string,
  timeoutMs: number,
  waitMs: number,
  includeRawHtml: boolean,
  debug: boolean
): Promise<DetailResult> {
  const page = await context.newPage();
  let docsApiContent: string | null = null;
  let docsApiTitle: string | null = null;

  page.on("response", async (response) => {
    const responseUrl = response.url();
    if (!responseUrl.includes("/docs/get_document_content/")) return;

    try {
      const raw = await response.text();
      if (!raw || raw.trim().length === 0) {
        docsApiContent = null;
        docsApiTitle = null;
        return;
      }

      const payload = JSON.parse(raw) as { content?: string; title?: string; id?: string };
      if (payload.content) {
        docsApiContent = payload.content;
        docsApiTitle = payload.title || payload.id || docsApiTitle;
      }
    } catch (error) {
      if (debug) {
        console.error(`[debug] Developer docs API response parse failed: ${getErrorMessage(error)}`);
      }
    }
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await acceptOneTrust(page, timeoutMs);
    await waitForAnySelector(
      page,
      ["main", "article", ".markdown-content", "doc-content-layout", "doc-amf-reference"],
      Math.min(timeoutMs, 12_000),
      debug,
      "developer content"
    );

    if (waitMs > 0) {
      await page.waitForTimeout(waitMs);
    }

    const bodyText = await page.innerText("body").catch((error) => {
      if (debug) {
        console.error(`[debug] Failed reading developer page text content: ${getErrorMessage(error)}`);
      }
      return "";
    });
    if (looksLikeDeveloperErrorPage(bodyText)) {
      throw new Error("Developer documentation error page detected.");
    }

    const html = await page.content();
    const dom = new JSDOM(html, { url: page.url() });
    const { document } = dom.window;

    for (const selector of DEFAULT_REMOVE_SELECTORS) {
      for (const node of Array.from(document.querySelectorAll(selector))) {
        if (node && typeof (node as Element).remove === "function") {
          (node as Element).remove();
        }
      }
    }

    const turndown = createTurndown(page.url());
    const extracted = extractBestContent(document);
    let title: string | null = await page.title().catch(() => null);
    if (!title) {
      title = extracted.title;
    }

    let primaryHtml: string | null = null;
    try {
      primaryHtml = await page.locator("main, article").first().evaluate((el) => (el as HTMLElement).outerHTML);
    } catch (error) {
      if (debug) {
        console.error(`[debug] Failed reading primary developer HTML container: ${getErrorMessage(error)}`);
      }
      primaryHtml = null;
    }

    const htmlCandidates = [primaryHtml, extracted.html].filter(
      (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index
    );

    let markdown = "";
    let selectedHtml: string | null = null;
    for (const candidateHtml of htmlCandidates) {
      const candidateMarkdown = stripGarbage(turndown.turndown(candidateHtml));
      if (candidateMarkdown.length > markdown.length) {
        markdown = candidateMarkdown;
        selectedHtml = candidateHtml;
      }
    }

    const codeBlocks = await extractDeveloperCodeBlocks(page).catch((error) => {
      if (debug) {
        console.error(`[debug] Failed extracting developer code blocks: ${getErrorMessage(error)}`);
      }
      return [] as Array<{ language: string; code: string }>;
    });
    if (codeBlocks.length > 0) {
      const missingBlocks = codeBlocks.filter((block) => {
        const snippet = block.code.slice(0, 48);
        return snippet.length > 0 && !markdown.includes(snippet);
      });

      if (missingBlocks.length > 0) {
        const renderedBlocks = missingBlocks
          .map((block) => `\`\`\`${block.language}\n${block.code}\n\`\`\``)
          .join("\n\n");
        markdown = `${markdown}\n\n${renderedBlocks}`.trim();
      }
    }

    if (markdown.length < MIN_CONTENT_LENGTH && docsApiContent) {
      markdown = stripGarbage(turndown.turndown(docsApiContent));
      title = docsApiTitle || title;
      selectedHtml = docsApiContent;
    }

    if (markdown.length < MIN_CONTENT_LENGTH) {
      const shadowHtml = await extractDeveloperShadowDomHtml(page).catch((error) => {
        if (debug) {
          console.error(`[debug] Failed extracting developer shadow DOM HTML: ${getErrorMessage(error)}`);
        }
        return "";
      });
      if (shadowHtml.length > MIN_CONTENT_LENGTH) {
        const cleanedShadow = shadowHtml
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<script[\s\S]*?<\/script>/gi, "");
        const shadowMarkdown = stripGarbage(turndown.turndown(cleanedShadow));
        if (shadowMarkdown.length > markdown.length) {
          markdown = shadowMarkdown;
          selectedHtml = cleanedShadow;
          title = (await page.title().catch((error) => {
            if (debug) {
              console.error(`[debug] Failed reading developer page title: ${getErrorMessage(error)}`);
            }
            return null;
          })) || title;
        }
      }
    }

    if (markdown.length < MIN_CONTENT_LENGTH) {
      const textFallback = stripGarbage(bodyText);
      if (textFallback.length >= MIN_CONTENT_LENGTH) {
        markdown = textFallback;
      }
    }

    if (markdown.length < MIN_CONTENT_LENGTH) {
      throw new Error("Extracted content was too short.");
    }

    if (looksLikeDeveloperErrorPage(markdown)) {
      throw new Error("Developer documentation error page detected.");
    }

    const normalizedMarkdown = normalizeMarkdown(markdown);
    const markdownTitle = extractMarkdownTitle(normalizedMarkdown);

    const result: DetailResult = {
      url,
      title: markdownTitle || title || docsApiTitle || null,
      markdown: normalizedMarkdown,
    };

    if (includeRawHtml && selectedHtml) {
      result.rawHtml = selectedHtml.trim();
    }

    return result;
  } finally {
    await page.close().catch(() => {});
  }
}

export async function getHelpDetails(options: DetailOptions): Promise<DetailResult> {
  const url = normalizeAndValidateDocUrl(options.url);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
  const headed = options.headed ?? false;
  const useCache = options.useCache ?? true;
  const includeRawHtml = options.includeRawHtml ?? false;
  const debug = options.debug ?? false;
  const providedSession = options.session ?? null;

  const cacheKey = JSON.stringify({ url, includeRawHtml });
  const cachePath = buildCachePath("detail", cacheKey);

  if (useCache) {
    const cached = await readCache<DetailResult>(cachePath);
    if (cached) {
      return cached;
    }
  }

  const session = providedSession || (await createScraperSession({ headed }));
  const shouldCloseSession = !providedSession;
  let result: DetailResult;

  try {
    result =
      getDetailSourceType(url) === "developer"
        ? await scrapeDeveloperMarkdown(session.context, url, timeoutMs, waitMs, includeRawHtml, debug)
        : await scrapeHelpMarkdown(session.context, url, timeoutMs, waitMs, includeRawHtml, debug);
  } finally {
    if (shouldCloseSession) {
      await session.close();
    }
  }

  if (useCache) {
    await writeCache(cachePath, result);
  }

  return result;
}
