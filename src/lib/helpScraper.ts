import { chromium } from "playwright";
import type { Page } from "playwright";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { buildCachePath, readCache, writeCache } from "./cache";

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
];

const DEFAULT_CONTENT_SELECTORS = [
  "main article",
  "article",
  "main",
  ".slds-rich-text-editor__output",
  ".article-body",
  ".help-article",
  "[data-aura-class*='article']",
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
};

export type DetailOptions = {
  url: string;
  timeoutMs?: number;
  waitMs?: number;
  headed?: boolean;
  useCache?: boolean;
};

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
  return markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

async function scrapeHelpMarkdown(url: string, timeoutMs: number, waitMs: number, headed: boolean): Promise<DetailResult> {
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await acceptOneTrust(page, timeoutMs);
    await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {});

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

    const turndown = new TurndownService({ codeBlockStyle: "fenced" });
    let { html: contentHtml, title } = extractBestContent(document);
    let markdown = "";

    if (contentHtml) {
      markdown = turndown.turndown(contentHtml);
    }

    markdown = stripGarbage(markdown);

    if (markdown.length < MIN_CONTENT_LENGTH) {
      const textFallback = stripGarbage(bodyText);
      if (textFallback.length >= MIN_CONTENT_LENGTH) {
        markdown = textFallback;
      }
    }

    if (markdown.length < MIN_CONTENT_LENGTH) {
      throw new Error("Extracted content was too short.");
    }

    return {
      url,
      title: title || null,
      markdown: normalizeMarkdown(markdown),
    };
  } finally {
    await browser.close();
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

async function scrapeDeveloperMarkdown(url: string, timeoutMs: number, waitMs: number, headed: boolean): Promise<DetailResult> {
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext();
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
    } catch {
      // Ignore non-JSON responses
    }
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await acceptOneTrust(page, timeoutMs);
    await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {});

    if (waitMs > 0) {
      await page.waitForTimeout(waitMs);
    }

    const bodyText = await page.innerText("body").catch(() => "");
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

    const turndown = new TurndownService({ codeBlockStyle: "fenced" });
    let contentHtml: string | null = null;
    let title: string | null = null;

    try {
      contentHtml = await page.locator("main, article").first().evaluate((el) => (el as HTMLElement).outerHTML);
      title = await page.title();
    } catch {
      const extracted = extractBestContent(document);
      contentHtml = extracted.html;
      title = extracted.title;
    }

    let markdown = contentHtml ? turndown.turndown(contentHtml) : "";
    markdown = stripGarbage(markdown);

    if (markdown.length < MIN_CONTENT_LENGTH && docsApiContent) {
      markdown = stripGarbage(turndown.turndown(docsApiContent));
      title = docsApiTitle || title;
    }

    if (markdown.length < MIN_CONTENT_LENGTH) {
      const shadowHtml = await extractDeveloperShadowDomHtml(page).catch(() => "");
      if (shadowHtml.length > MIN_CONTENT_LENGTH) {
        const cleanedShadow = shadowHtml
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<script[\s\S]*?<\/script>/gi, "");
        const shadowMarkdown = stripGarbage(turndown.turndown(cleanedShadow));
        if (shadowMarkdown.length > markdown.length) {
          markdown = shadowMarkdown;
          title = (await page.title().catch(() => null)) || title;
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

    return {
      url,
      title: title || docsApiTitle || null,
      markdown: normalizeMarkdown(markdown),
    };
  } finally {
    await browser.close();
  }
}

export async function getHelpDetails(options: DetailOptions): Promise<DetailResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
  const headed = options.headed ?? false;
  const useCache = options.useCache ?? true;

  const cacheKey = options.url;
  const cachePath = buildCachePath("detail", cacheKey);

  if (useCache) {
    const cached = await readCache<DetailResult>(cachePath);
    if (cached) {
      return cached;
    }
  }

  const result = getDetailSourceType(options.url) === "developer"
    ? await scrapeDeveloperMarkdown(options.url, timeoutMs, waitMs, headed)
    : await scrapeHelpMarkdown(options.url, timeoutMs, waitMs, headed);
  await writeCache(cachePath, result);
  return result;
}
