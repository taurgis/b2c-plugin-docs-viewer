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
  type DeveloperResponseBodyVariant,
  type DeveloperResponseRow,
  type DeveloperResponseSection,
  formatDeveloperArticleMarkdown,
  formatHelpArticleMarkdown,
  renderDeveloperResponseSections,
  replaceDeveloperResponsesSection,
} from "./helpScraperMarkdown";
import { getErrorMessage } from "./errorUtils";
import { firstFulfilled } from "./promiseUtils";

export {
  convertHtmlToMarkdown,
  formatHelpArticleMarkdown,
  renderDeveloperResponseSections,
  replaceDeveloperResponsesSection,
} from "./helpScraperMarkdown";

export { formatDeveloperArticleMarkdown } from "./helpScraperMarkdown";

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
  const results = await Promise.all(
    HELP_ERROR_SELECTORS.map((selector) =>
      page.locator(selector).first().isVisible({ timeout: 1500 }).catch(() => false)
    )
  );
  return results.some(Boolean);
}

async function waitForAnySelector(
  page: Page,
  selectors: string[],
  timeoutMs: number,
  debug: boolean,
  label: string
): Promise<void> {
  if (selectors.length === 0) return;

  const sharedTimeout = Math.max(1200, timeoutMs);

  const matchedSelector = await firstFulfilled(
    selectors.map(async (selector) => {
      await page.locator(selector).first().waitFor({ state: "visible", timeout: sharedTimeout });
      return selector;
    })
  );

  if (matchedSelector) return;

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

      function appendExpandedNode(
        sourceNode: Node,
        targetParent: Element,
        depth: number
      ): void {
        if (depth > 15) return;

        if (sourceNode.nodeType === Node.TEXT_NODE) {
          targetParent.appendChild(document.createTextNode(sourceNode.textContent || ""));
          return;
        }

        if (sourceNode.nodeType !== Node.ELEMENT_NODE) {
          return;
        }

        const element = sourceNode as Element & { shadowRoot?: ShadowRoot | null };
        const tag = element.tagName.toLowerCase();
        if (tag === "style" || tag === "script" || tag === "link") return;
  if (element.getAttribute("data-copilot-skip") === "true") return;

        const hasMeaningfulLightDom = Array.from(element.childNodes).some((childNode) => {
          if (childNode.nodeType === Node.TEXT_NODE) {
            return (childNode.textContent || "").trim().length > 0;
          }

          return childNode.nodeType === Node.ELEMENT_NODE;
        });

        if (element.shadowRoot && !skipTags.has(tag) && !hasMeaningfulLightDom) {
          for (const child of Array.from(element.shadowRoot.childNodes)) {
            appendExpandedNode(child, targetParent, depth + 1);
          }
          return;
        }

        const clone = element.cloneNode(false) as Element;
        targetParent.appendChild(clone);

        for (const child of Array.from(element.childNodes)) {
          appendExpandedNode(child, clone, depth + 1);
        }
      }

      function collectShadowHtml(node: Element, depth: number): string {
        if (depth > 15) return "";

        const host = node as Element & { shadowRoot?: ShadowRoot | null };
        if (!host.shadowRoot) return "";

        const fragment = document.createElement("div");
        for (const child of Array.from(host.shadowRoot.childNodes)) {
          appendExpandedNode(child, fragment, depth + 1);
        }

        return fragment.innerHTML;
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

async function extractFocusedDeveloperShadowDomHtml(page: Page): Promise<string> {
  return page.evaluate(
    (params: { chains: string[][]; skipTags: string[] }) => {
      const skipTags = new Set(params.skipTags);

      function appendExpandedNode(
        sourceNode: Node,
        targetParent: Element,
        depth: number
      ): void {
        if (depth > 15) return;

        if (sourceNode.nodeType === Node.TEXT_NODE) {
          targetParent.appendChild(document.createTextNode(sourceNode.textContent || ""));
          return;
        }

        if (sourceNode.nodeType !== Node.ELEMENT_NODE) {
          return;
        }

        const element = sourceNode as Element & { shadowRoot?: ShadowRoot | null };
        const tag = element.tagName.toLowerCase();
        if (tag === "style" || tag === "script" || tag === "link") return;
  if (element.getAttribute("data-copilot-skip") === "true") return;

        const hasMeaningfulLightDom = Array.from(element.childNodes).some((childNode) => {
          if (childNode.nodeType === Node.TEXT_NODE) {
            return (childNode.textContent || "").trim().length > 0;
          }

          return childNode.nodeType === Node.ELEMENT_NODE;
        });

        if (element.shadowRoot && !skipTags.has(tag) && !hasMeaningfulLightDom) {
          for (const child of Array.from(element.shadowRoot.childNodes)) {
            appendExpandedNode(child, targetParent, depth + 1);
          }
          return;
        }

        const clone = element.cloneNode(false) as Element;
        targetParent.appendChild(clone);

        for (const child of Array.from(element.childNodes)) {
          appendExpandedNode(child, clone, depth + 1);
        }
      }

      function collectShadowHtml(node: Element, depth: number): string {
        if (depth > 15) return "";

        const host = node as Element & { shadowRoot?: ShadowRoot | null };
        if (!host.shadowRoot) return "";

        const fragment = document.createElement("div");
        for (const child of Array.from(host.shadowRoot.childNodes)) {
          appendExpandedNode(child, fragment, depth + 1);
        }

        return fragment.innerHTML;
      }

      function findTarget(chain: string[]): Element | null {
        let currentRoot: Document | ShadowRoot = document;
        let current: Element | null = null;

        for (const selector of chain) {
          current = currentRoot.querySelector(selector);
          if (!current) return null;

          const currentShadowRoot: ShadowRoot | null | undefined = (
            current as Element & { shadowRoot?: ShadowRoot | null }
          ).shadowRoot;
          if (currentShadowRoot) {
            currentRoot = currentShadowRoot;
          }
        }

        return current;
      }

      for (const chain of params.chains) {
        const target = findTarget(chain);
        if (!target) continue;

        const html = collectShadowHtml(target, 0).trim();
        if (html.length > 0) {
          return html;
        }
      }

      return "";
    },
    {
      chains: [
        ["doc-amf-reference", "doc-amf-topic", "api-method-documentation"],
        ["doc-amf-reference", "doc-amf-topic", "api-resource-documentation"],
        ["doc-amf-reference", "doc-amf-topic", "api-type-documentation"],
        ["doc-amf-reference", "doc-amf-topic"],
      ],
      skipTags: DEV_SHADOW_SKIP_TAGS,
    }
  );
}

async function prepareDeveloperMethodForExtraction(page: Page, debug: boolean): Promise<void> {
  await page
    .evaluate(async () => {
      const methodRoot = document
        .querySelector("doc-amf-reference")
        ?.shadowRoot?.querySelector("doc-amf-topic")
        ?.shadowRoot?.querySelector("api-method-documentation")
        ?.shadowRoot;

      if (!methodRoot) return;

      const waitForUpdate = async (): Promise<void> => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      };

      const getText = (element: Element | null | undefined): string =>
        (element?.textContent || "").replace(/\s+/g, " ").trim();

      const deepElements = (root: Document | ShadowRoot | Element): Element[] => {
        const results: Element[] = [];
        const visit = (currentRoot: Document | ShadowRoot | Element): void => {
          const children = Array.from(currentRoot.children || []);
          for (const child of children) {
            results.push(child);
            const childWithShadow = child as Element & { shadowRoot?: ShadowRoot | null };
            if (childWithShadow.shadowRoot) {
              visit(childWithShadow.shadowRoot);
            }
            visit(child);
          }
        };

        visit(root);
        return results;
      };

      const clickButton = async (element: Element | null | undefined): Promise<void> => {
        if (!(element instanceof HTMLElement)) return;
        element.click();
        await waitForUpdate();
      };

      const clickShowButtons = async (root: Document | ShadowRoot | Element): Promise<void> => {
        const candidates = deepElements(root).filter((element) => {
          if (!(element instanceof HTMLElement)) return false;
          const text = getText(element);
          if (!/^show$/i.test(text)) return false;
          return (
            element.tagName.toLowerCase() === "anypoint-button" ||
            element.classList.contains("complex-toggle")
          );
        });

        for (const candidate of candidates) {
          if (/^show$/i.test(getText(candidate))) {
            await clickButton(candidate);
          }
        }
      };

      await clickShowButtons(methodRoot);
    })
    .catch((error) => {
      if (debug) {
        console.error(`[debug] Failed preparing developer method sections: ${getErrorMessage(error)}`);
      }
    });
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

function normalizeLocatorText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function normalizeCodeBlock(value: string | null | undefined): string {
  return (value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

async function extractStructuredDeveloperResponseRows(responseBody: ReturnType<Page["locator"]>): Promise<DeveloperResponseRow[]> {
  const rowLocator = responseBody.locator("property-shape-document");
  const rowCount = await rowLocator.count();
  if (rowCount === 0) {
    return [];
  }

  return rowLocator.evaluateAll((elements) => {
    const normalize = (value: string | null | undefined): string =>
      (value || "").replace(/\s+/g, " ").trim();

    return elements
      .map((element) => {
        const shadowRoot = (element as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (!shadowRoot) return null;

        const name = normalize(shadowRoot.querySelector(".property-title")?.textContent);
        const type = normalize(
          Array.from(shadowRoot.querySelectorAll(".data-type"))
            .map((node) => node.textContent || "")
            .join(" ")
        );
        const flags = Array.from(shadowRoot.querySelectorAll(".badge"))
          .map((node) => normalize(node.textContent))
          .filter((value) => value.length > 0);
        const descriptions = Array.from(shadowRoot.querySelectorAll(".markdown-body"))
          .map((node) => normalize(node.textContent))
          .filter((value) => value.length > 0);
        const constraints = Array.from(shadowRoot.querySelectorAll(".property-attribute"))
          .map((node) => normalize(node.textContent))
          .filter((value) => value.length > 0);

        if (
          name.length === 0 &&
          type.length === 0 &&
          flags.length === 0 &&
          descriptions.length === 0 &&
          constraints.length === 0
        ) {
          return null;
        }

        return { name, type, flags, descriptions, constraints };
      })
      .filter((row): row is DeveloperResponseRow => row !== null);
  });
}

async function extractStructuredDeveloperResponses(
  page: Page,
  debug: boolean
): Promise<DeveloperResponseSection[]> {
  return page
    .evaluate(async () => {
      const waitForUpdate = async (): Promise<void> => {
        await new Promise((resolve) => setTimeout(resolve, 120));
      };

      const normalizeText = (value: string | null | undefined): string =>
        (value || "").replace(/\s+/g, " ").trim();

      const normalizeCode = (value: string | null | undefined): string =>
        (value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

      const deepElements = (root: Document | ShadowRoot | Element): Element[] => {
        const results: Element[] = [];
        const visit = (currentRoot: Document | ShadowRoot | Element): void => {
          const children = Array.from(currentRoot.children || []);
          for (const child of children) {
            results.push(child);
            const childWithShadow = child as Element & { shadowRoot?: ShadowRoot | null };
            if (childWithShadow.shadowRoot) {
              visit(childWithShadow.shadowRoot);
            }
            visit(child);
          }
        };

        visit(root);
        return results;
      };

      const methodRoot = document
        .querySelector("doc-amf-reference")
        ?.shadowRoot?.querySelector("doc-amf-topic")
        ?.shadowRoot?.querySelector("api-method-documentation")
        ?.shadowRoot;
      const responsesRoot = methodRoot?.querySelector("api-responses-document")?.shadowRoot;

      if (!responsesRoot) {
        return [];
      }

      const tabs = Array.from(responsesRoot.querySelectorAll("anypoint-tab"))
        .map((tab) => ({ element: tab as HTMLElement, label: normalizeText(tab.textContent) }))
        .filter((tab) => tab.label.length > 0);

      const sections: DeveloperResponseSection[] = [];

      for (const tab of tabs) {
        tab.element.click();
        await waitForUpdate();

        const methodResponse = responsesRoot.querySelector(".method-response") as Element | null;
        const summaryHost = methodResponse
          ? Array.from(methodResponse.children).find((child) => child.tagName.toLowerCase() === "arc-marked")
          : null;
        const summary = normalizeText(
          summaryHost?.querySelector("div[slot='markdown-html'], .markdown-body")?.textContent
        );
        const responseBodies = methodResponse
          ? Array.from(methodResponse.querySelectorAll("api-body-document")) as Array<
              Element & { shadowRoot?: ShadowRoot | null }
            >
          : [];
        const exampleBody = responseBodies.find((body) => body.hasAttribute("isexample")) || null;
        const schemaBody = responseBodies.find((body) => !body.hasAttribute("isexample")) || null;

        const exampleRoot = exampleBody?.shadowRoot || null;
        const exampleCodeHost = exampleRoot
          ? deepElements(exampleRoot).find(
              (element) =>
                element.tagName.toLowerCase() === "code" &&
                (element.id === "output" || element.closest("pre.parsed-content") !== null)
            )
          : null;
        const example = normalizeCode(exampleCodeHost?.textContent);

        const bodyRoot = schemaBody?.shadowRoot || null;

        const variants: DeveloperResponseBodyVariant[] = [];
        if (bodyRoot) {
          const mediaButtons = deepElements(bodyRoot)
            .filter(
              (element) =>
                element.tagName.toLowerCase() === "anypoint-button" &&
                element.classList.contains("media-toggle")
            )
            .map((element) => ({ element: element as HTMLElement, label: normalizeText(element.textContent) }));

          const uniqueMediaButtons = mediaButtons.length > 0 ? mediaButtons : [{ element: null, label: "" }];
          const grouped = new Map<string, DeveloperResponseBodyVariant>();

          for (const mediaButton of uniqueMediaButtons) {
            if (mediaButton.element) {
              mediaButton.element.click();
              await waitForUpdate();
            }

            const refreshedBodyRoot = schemaBody?.shadowRoot || null;
            if (!refreshedBodyRoot) {
              continue;
            }

            const rowHosts = deepElements(refreshedBodyRoot).filter(
              (element) => element.tagName.toLowerCase() === "property-shape-document"
            );

            const rows = rowHosts
              .map((rowHost) => {
                const shadowRoot = (rowHost as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
                if (!shadowRoot) return null;

                const getRowName = (host: Element): string => {
                  const hostShadowRoot = (host as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
                  return normalizeText(hostShadowRoot?.querySelector(".property-title")?.textContent);
                };

                const getParentRowHost = (host: Element): Element | null => {
                  let current: Node | null = host;
                  while (current) {
                    if (current.parentNode) {
                      current = current.parentNode;
                    } else {
                      const rootNode = current.getRootNode();
                      current = rootNode instanceof ShadowRoot ? rootNode.host : null;
                    }

                    if (
                      current instanceof Element &&
                      current !== host &&
                      current.tagName.toLowerCase() === "property-shape-document"
                    ) {
                      return current;
                    }
                  }

                  return null;
                };

                const buildFieldPath = (host: Element): string[] => {
                  const segments: string[] = [];
                  let current: Element | null = host;
                  while (current) {
                    const segment = getRowName(current);
                    if (segment.length > 0) {
                      segments.unshift(segment);
                    }
                    current = getParentRowHost(current);
                  }
                  return segments;
                };

                const pathSegments = buildFieldPath(rowHost);
                const name = pathSegments.join(".");
                const type = normalizeText(
                  Array.from(shadowRoot.querySelectorAll(".data-type"))
                    .map((node) => node.textContent || "")
                    .join(" ")
                );
                const flags = Array.from(shadowRoot.querySelectorAll(".badge"))
                  .map((node) => normalizeText(node.textContent))
                  .filter((value) => value.length > 0);
                const descriptions = Array.from(shadowRoot.querySelectorAll(".markdown-body"))
                  .map((node) => normalizeText(node.textContent))
                  .filter((value) => value.length > 0);
                const constraints = Array.from(shadowRoot.querySelectorAll(".property-attribute"))
                  .map((node) => normalizeText(node.textContent))
                  .filter((value) => value.length > 0);

                if (name.length === 0) {
                  return null;
                }

                if (type === "unknown type" || type === "recursive") {
                  return null;
                }

                if (pathSegments[pathSegments.length - 1] === "additionalProperties") {
                  return null;
                }

                if (
                  type.length === 0 &&
                  flags.length === 0 &&
                  descriptions.length === 0 &&
                  constraints.length === 0
                ) {
                  return null;
                }

                return { name, type, flags, descriptions, constraints };
              })
              .filter((row): row is DeveloperResponseRow => row !== null);

            const key = JSON.stringify(rows);
            const existing = grouped.get(key);
            if (existing) {
              if (mediaButton.label.length > 0 && !existing.mediaTypes.includes(mediaButton.label)) {
                existing.mediaTypes.push(mediaButton.label);
              }
            } else {
              grouped.set(key, {
                mediaTypes: mediaButton.label.length > 0 ? [mediaButton.label] : [],
                rows,
              });
            }
          }

          variants.push(...grouped.values());
        }

        sections.push({
          statusLabel: tab.label,
          summary,
          example,
          bodies: variants.filter((variant) => variant.rows.length > 0 || variant.mediaTypes.length > 0),
        });
      }

      return sections;
    })
    .catch((error) => {
      if (debug) {
        console.error(
          `[debug] Failed extracting structured developer responses: ${getErrorMessage(error)}`
        );
      }
      return [] as DeveloperResponseSection[];
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

    await prepareDeveloperMethodForExtraction(page, debug);

    const focusedShadowHtml = await extractFocusedDeveloperShadowDomHtml(page).catch((error) => {
      if (debug) {
        console.error(
          `[debug] Failed extracting focused developer shadow DOM HTML: ${getErrorMessage(error)}`
        );
      }
      return "";
    });

    let primaryHtml: string | null = null;
    try {
      primaryHtml = await page.locator("main, article").first().evaluate((el) => (el as HTMLElement).outerHTML);
    } catch (error) {
      if (debug) {
        console.error(`[debug] Failed reading primary developer HTML container: ${getErrorMessage(error)}`);
      }
      primaryHtml = null;
    }

    const htmlCandidates = [focusedShadowHtml, primaryHtml, extracted.html].filter(
      (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index
    );

    let markdown = "";
    let selectedHtml: string | null = null;
    for (const candidateHtml of htmlCandidates) {
      const candidateMarkdown = formatDeveloperArticleMarkdown(
        stripGarbage(turndown.turndown(candidateHtml)),
        page.url(),
        title
      );
      if (candidateMarkdown.length >= MIN_CONTENT_LENGTH) {
        markdown = candidateMarkdown;
        selectedHtml = candidateHtml;
        break;
      }
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
      markdown = formatDeveloperArticleMarkdown(
        stripGarbage(turndown.turndown(docsApiContent)),
        page.url(),
        docsApiTitle || title
      );
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
        const shadowMarkdown = formatDeveloperArticleMarkdown(
          stripGarbage(turndown.turndown(cleanedShadow)),
          page.url(),
          title
        );
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
      const textFallback = formatDeveloperArticleMarkdown(stripGarbage(bodyText), page.url(), title);
      if (textFallback.length >= MIN_CONTENT_LENGTH) {
        markdown = textFallback;
      }
    }

    const structuredResponses = await extractStructuredDeveloperResponses(page, debug);
    if (structuredResponses.length > 0) {
      const renderedResponses = renderDeveloperResponseSections(structuredResponses);
      markdown = replaceDeveloperResponsesSection(markdown, renderedResponses);
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
