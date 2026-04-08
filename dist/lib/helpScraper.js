"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDeveloperArticleMarkdown = exports.replaceDeveloperResponsesSection = exports.replaceDeveloperRequestBodySection = exports.renderDeveloperResponseSections = exports.renderDeveloperRequestBodySection = exports.formatHelpArticleMarkdown = exports.convertHtmlToMarkdown = void 0;
exports.createScraperSession = createScraperSession;
exports.getDetailSourceType = getDetailSourceType;
exports.getHelpDetails = getHelpDetails;
const playwright_1 = require("playwright");
const readability_1 = require("@mozilla/readability");
const jsdom_1 = require("jsdom");
const cache_1 = require("./cache");
const urlPolicy_1 = require("./urlPolicy");
const browserConsent_1 = require("./browserConsent");
const helpScraperMarkdown_1 = require("./helpScraperMarkdown");
const errorUtils_1 = require("./errorUtils");
const promiseUtils_1 = require("./promiseUtils");
var helpScraperMarkdown_2 = require("./helpScraperMarkdown");
Object.defineProperty(exports, "convertHtmlToMarkdown", { enumerable: true, get: function () { return helpScraperMarkdown_2.convertHtmlToMarkdown; } });
Object.defineProperty(exports, "formatHelpArticleMarkdown", { enumerable: true, get: function () { return helpScraperMarkdown_2.formatHelpArticleMarkdown; } });
Object.defineProperty(exports, "renderDeveloperRequestBodySection", { enumerable: true, get: function () { return helpScraperMarkdown_2.renderDeveloperRequestBodySection; } });
Object.defineProperty(exports, "renderDeveloperResponseSections", { enumerable: true, get: function () { return helpScraperMarkdown_2.renderDeveloperResponseSections; } });
Object.defineProperty(exports, "replaceDeveloperRequestBodySection", { enumerable: true, get: function () { return helpScraperMarkdown_2.replaceDeveloperRequestBodySection; } });
Object.defineProperty(exports, "replaceDeveloperResponsesSection", { enumerable: true, get: function () { return helpScraperMarkdown_2.replaceDeveloperResponsesSection; } });
var helpScraperMarkdown_3 = require("./helpScraperMarkdown");
Object.defineProperty(exports, "formatDeveloperArticleMarkdown", { enumerable: true, get: function () { return helpScraperMarkdown_3.formatDeveloperArticleMarkdown; } });
const DEFAULT_TIMEOUT_MS = 45000;
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
async function createScraperSession(options) {
    const headed = options?.headed ?? false;
    const browser = await playwright_1.chromium.launch({ headless: !headed });
    const context = await browser.newContext();
    let closed = false;
    return {
        context,
        close: async () => {
            if (closed)
                return;
            closed = true;
            await closeScraperSession(browser, context);
        },
    };
}
async function closeScraperSession(browser, context) {
    await context.close().catch(() => { });
    await browser.close().catch(() => { });
}
function stripGarbage(text) {
    let output = text.trim();
    for (const pattern of GARBAGE_PATTERNS) {
        output = output.replace(pattern, "");
    }
    return output.trim();
}
function extractBestContent(document) {
    let best = null;
    let bestLength = 0;
    for (const selector of DEFAULT_CONTENT_SELECTORS) {
        const node = document.querySelector(selector);
        if (!node)
            continue;
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
        const reader = new readability_1.Readability(document);
        const article = reader.parse();
        if (article?.content) {
            return { html: article.content, title: article.title || null };
        }
        return { html: null, title: null };
    }
    return { html: best.innerHTML, title: document.title || null };
}
async function isAuraErrorVisible(page) {
    const results = await Promise.all(HELP_ERROR_SELECTORS.map((selector) => page.locator(selector).first().isVisible({ timeout: 1500 }).catch(() => false)));
    return results.some(Boolean);
}
async function waitForAnySelector(page, selectors, timeoutMs, debug, label) {
    if (selectors.length === 0)
        return;
    const sharedTimeout = Math.max(1200, timeoutMs);
    const matchedSelector = await (0, promiseUtils_1.firstFulfilled)(selectors.map(async (selector) => {
        await page.locator(selector).first().waitFor({ state: "visible", timeout: sharedTimeout });
        return selector;
    }));
    if (matchedSelector)
        return;
    if (debug) {
        console.error(`[debug] Timed out waiting for ${label} selectors (${selectors.join(", ")}).`);
    }
}
function looksLikeErrorPage(text) {
    return HELP_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}
function looksLikeDeveloperErrorPage(text) {
    return DEV_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}
function isDeveloperDocsUrl(rawUrl) {
    try {
        const url = new URL(rawUrl);
        return url.hostname === "developer.salesforce.com" && url.pathname.startsWith("/docs/");
    }
    catch {
        return false;
    }
}
function getDetailSourceType(rawUrl) {
    return isDeveloperDocsUrl(rawUrl) ? "developer" : "help";
}
function normalizeMarkdown(markdown) {
    return markdown
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
function extractMarkdownTitle(markdown) {
    const match = markdown.match(/^#\s+(.+)$/m);
    return match?.[1]?.trim() || null;
}
async function scrapeHelpMarkdown(context, url, timeoutMs, waitMs, includeRawHtml, debug) {
    const page = await context.newPage();
    try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
        await (0, browserConsent_1.acceptOneTrust)(page, timeoutMs);
        await waitForAnySelector(page, [".markdown-content", ".ht-body", "main article", "article", "main", ".cHCPortalTheme"], Math.min(timeoutMs, 12000), debug, "help content");
        if (waitMs > 0) {
            await page.waitForTimeout(waitMs);
        }
        const bodyText = await page.innerText("body");
        if (await isAuraErrorVisible(page) || looksLikeErrorPage(bodyText)) {
            throw new Error("Help article error page detected.");
        }
        const html = await page.content();
        const dom = new jsdom_1.JSDOM(html, { url });
        const { document } = dom.window;
        for (const selector of DEFAULT_REMOVE_SELECTORS) {
            for (const node of Array.from(document.querySelectorAll(selector))) {
                if (node && typeof node.remove === "function") {
                    node.remove();
                }
            }
        }
        let { html: contentHtml, title } = extractBestContent(document);
        let markdown = "";
        if (contentHtml) {
            markdown = (0, helpScraperMarkdown_1.convertHtmlToMarkdown)(contentHtml, url);
        }
        markdown = stripGarbage(markdown);
        markdown = (0, helpScraperMarkdown_1.formatHelpArticleMarkdown)(markdown, title || null);
        if (markdown.length < MIN_CONTENT_LENGTH) {
            const textFallback = (0, helpScraperMarkdown_1.formatHelpArticleMarkdown)(stripGarbage(bodyText), title || null);
            if (textFallback.length >= MIN_CONTENT_LENGTH) {
                markdown = textFallback;
            }
        }
        if (markdown.length < MIN_CONTENT_LENGTH) {
            throw new Error("Extracted content was too short.");
        }
        const normalizedMarkdown = normalizeMarkdown(markdown);
        const markdownTitle = extractMarkdownTitle(normalizedMarkdown);
        const result = {
            url,
            title: markdownTitle || title || null,
            markdown: normalizedMarkdown,
        };
        if (includeRawHtml && contentHtml) {
            result.rawHtml = contentHtml.trim();
        }
        return result;
    }
    finally {
        await page.close().catch(() => { });
    }
}
async function extractDeveloperShadowDomHtml(page) {
    return page.evaluate((params) => {
        const skipTags = new Set(params.skipTags);
        function appendExpandedNode(sourceNode, targetParent, depth) {
            if (depth > 15)
                return;
            if (sourceNode.nodeType === Node.TEXT_NODE) {
                targetParent.appendChild(document.createTextNode(sourceNode.textContent || ""));
                return;
            }
            if (sourceNode.nodeType !== Node.ELEMENT_NODE) {
                return;
            }
            const element = sourceNode;
            const tag = element.tagName.toLowerCase();
            if (tag === "style" || tag === "script" || tag === "link")
                return;
            if (element.getAttribute("data-copilot-skip") === "true")
                return;
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
            const clone = element.cloneNode(false);
            targetParent.appendChild(clone);
            for (const child of Array.from(element.childNodes)) {
                appendExpandedNode(child, clone, depth + 1);
            }
        }
        function collectShadowHtml(node, depth) {
            if (depth > 15)
                return "";
            const host = node;
            if (!host.shadowRoot)
                return "";
            const fragment = document.createElement("div");
            for (const child of Array.from(host.shadowRoot.childNodes)) {
                appendExpandedNode(child, fragment, depth + 1);
            }
            return fragment.innerHTML;
        }
        let all = "";
        for (const tag of params.hosts) {
            for (const el of Array.from(document.querySelectorAll(tag))) {
                const node = el;
                if (node.shadowRoot) {
                    all += collectShadowHtml(el, 0);
                }
            }
        }
        return all;
    }, { hosts: DEV_DOC_SHADOW_HOSTS, skipTags: DEV_SHADOW_SKIP_TAGS });
}
async function extractFocusedDeveloperShadowDomHtml(page) {
    return page.evaluate((params) => {
        const skipTags = new Set(params.skipTags);
        function appendExpandedNode(sourceNode, targetParent, depth) {
            if (depth > 15)
                return;
            if (sourceNode.nodeType === Node.TEXT_NODE) {
                targetParent.appendChild(document.createTextNode(sourceNode.textContent || ""));
                return;
            }
            if (sourceNode.nodeType !== Node.ELEMENT_NODE) {
                return;
            }
            const element = sourceNode;
            const tag = element.tagName.toLowerCase();
            if (tag === "style" || tag === "script" || tag === "link")
                return;
            if (element.getAttribute("data-copilot-skip") === "true")
                return;
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
            const clone = element.cloneNode(false);
            targetParent.appendChild(clone);
            for (const child of Array.from(element.childNodes)) {
                appendExpandedNode(child, clone, depth + 1);
            }
        }
        function collectShadowHtml(node, depth) {
            if (depth > 15)
                return "";
            const host = node;
            if (!host.shadowRoot)
                return "";
            const fragment = document.createElement("div");
            for (const child of Array.from(host.shadowRoot.childNodes)) {
                appendExpandedNode(child, fragment, depth + 1);
            }
            return fragment.innerHTML;
        }
        function findTarget(chain) {
            let currentRoot = document;
            let current = null;
            for (const selector of chain) {
                current = currentRoot.querySelector(selector);
                if (!current)
                    return null;
                const currentShadowRoot = current.shadowRoot;
                if (currentShadowRoot) {
                    currentRoot = currentShadowRoot;
                }
            }
            return current;
        }
        for (const chain of params.chains) {
            const target = findTarget(chain);
            if (!target)
                continue;
            const html = collectShadowHtml(target, 0).trim();
            if (html.length > 0) {
                return html;
            }
        }
        return "";
    }, {
        chains: [
            ["doc-amf-reference", "doc-amf-topic", "api-method-documentation"],
            ["doc-amf-reference", "doc-amf-topic", "api-resource-documentation"],
            ["doc-amf-reference", "doc-amf-topic", "api-type-documentation"],
            ["doc-amf-reference", "doc-amf-topic"],
        ],
        skipTags: DEV_SHADOW_SKIP_TAGS,
    });
}
async function prepareDeveloperMethodForExtraction(page, debug) {
    await page
        .evaluate(async () => {
        const methodRoot = document
            .querySelector("doc-amf-reference")
            ?.shadowRoot?.querySelector("doc-amf-topic")
            ?.shadowRoot?.querySelector("api-method-documentation")
            ?.shadowRoot;
        if (!methodRoot)
            return;
        const waitForUpdate = async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
        };
        const getText = (element) => (element?.textContent || "").replace(/\s+/g, " ").trim();
        const deepElements = (root) => {
            const results = [];
            const visit = (currentRoot) => {
                const children = Array.from(currentRoot.children || []);
                for (const child of children) {
                    results.push(child);
                    const childWithShadow = child;
                    if (childWithShadow.shadowRoot) {
                        visit(childWithShadow.shadowRoot);
                    }
                    visit(child);
                }
            };
            visit(root);
            return results;
        };
        const clickButton = async (element) => {
            if (!(element instanceof HTMLElement))
                return;
            element.click();
            await waitForUpdate();
        };
        const clickShowButtons = async (root) => {
            const candidates = deepElements(root).filter((element) => {
                if (!(element instanceof HTMLElement))
                    return false;
                const text = getText(element);
                if (!/^show$/i.test(text))
                    return false;
                return (element.tagName.toLowerCase() === "anypoint-button" ||
                    element.classList.contains("complex-toggle"));
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
            console.error(`[debug] Failed preparing developer method sections: ${(0, errorUtils_1.getErrorMessage)(error)}`);
        }
    });
}
async function extractDeveloperCodeBlocks(page) {
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
function normalizeLocatorText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
}
function normalizeCodeBlock(value) {
    return (value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}
async function extractStructuredDeveloperResponseRows(responseBody) {
    const rowLocator = responseBody.locator("property-shape-document");
    const rowCount = await rowLocator.count();
    if (rowCount === 0) {
        return [];
    }
    return rowLocator.evaluateAll((elements) => {
        const normalize = (value) => (value || "").replace(/\s+/g, " ").trim();
        return elements
            .map((element) => {
            const shadowRoot = element.shadowRoot;
            if (!shadowRoot)
                return null;
            const name = normalize(shadowRoot.querySelector(".property-title")?.textContent);
            const type = normalize(Array.from(shadowRoot.querySelectorAll(".data-type"))
                .map((node) => node.textContent || "")
                .join(" "));
            const flags = Array.from(shadowRoot.querySelectorAll(".badge"))
                .map((node) => normalize(node.textContent))
                .filter((value) => value.length > 0);
            const descriptions = Array.from(shadowRoot.querySelectorAll(".markdown-body"))
                .map((node) => normalize(node.textContent))
                .filter((value) => value.length > 0);
            const constraints = Array.from(shadowRoot.querySelectorAll(".property-attribute"))
                .map((node) => normalize(node.textContent))
                .filter((value) => value.length > 0);
            if (name.length === 0 &&
                type.length === 0 &&
                flags.length === 0 &&
                descriptions.length === 0 &&
                constraints.length === 0) {
                return null;
            }
            return { name, type, flags, descriptions, constraints };
        })
            .filter((row) => row !== null);
    });
}
async function extractStructuredDeveloperRequestBody(page, debug) {
    return page
        .evaluate(async () => {
        const waitForUpdate = async () => {
            await new Promise((resolve) => setTimeout(resolve, 120));
        };
        const normalizeText = (value) => (value || "").replace(/\s+/g, " ").trim();
        const normalizeCode = (value) => (value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
        const deepElements = (root) => {
            const results = [];
            const visit = (currentRoot) => {
                const children = Array.from(currentRoot.children || []);
                for (const child of children) {
                    results.push(child);
                    const childWithShadow = child;
                    if (childWithShadow.shadowRoot) {
                        visit(childWithShadow.shadowRoot);
                    }
                    visit(child);
                }
            };
            visit(root);
            return results;
        };
        const getRowName = (host) => {
            const hostShadowRoot = host.shadowRoot;
            return normalizeText(hostShadowRoot?.querySelector(".property-title")?.textContent);
        };
        const getParentRowHost = (host) => {
            let current = host;
            while (current) {
                if (current.parentNode) {
                    current = current.parentNode;
                }
                else {
                    const rootNode = current.getRootNode();
                    current = rootNode instanceof ShadowRoot ? rootNode.host : null;
                }
                if (current instanceof Element &&
                    current !== host &&
                    current.tagName.toLowerCase() === "property-shape-document") {
                    return current;
                }
            }
            return null;
        };
        const buildFieldPath = (host) => {
            const segments = [];
            let current = host;
            while (current) {
                const segment = getRowName(current);
                if (segment.length > 0) {
                    segments.unshift(segment);
                }
                current = getParentRowHost(current);
            }
            return segments;
        };
        const methodRoot = document
            .querySelector("doc-amf-reference")
            ?.shadowRoot?.querySelector("doc-amf-topic")
            ?.shadowRoot?.querySelector("api-method-documentation")
            ?.shadowRoot;
        const requestBody = methodRoot?.querySelector("api-body-document[isrequestsection]");
        const bodyRoot = requestBody?.shadowRoot;
        if (!bodyRoot) {
            return null;
        }
        const exampleGroups = new Map();
        const mediaButtons = deepElements(bodyRoot)
            .filter((element) => element.tagName.toLowerCase() === "anypoint-button" &&
            element.classList.contains("media-toggle"))
            .map((element) => ({ element: element, label: normalizeText(element.textContent) }));
        const uniqueMediaButtons = mediaButtons.length > 0 ? mediaButtons : [{ element: null, label: "" }];
        const grouped = new Map();
        for (const mediaButton of uniqueMediaButtons) {
            if (mediaButton.element) {
                mediaButton.element.click();
                await waitForUpdate();
            }
            const refreshedBodyRoot = requestBody?.shadowRoot;
            if (!refreshedBodyRoot) {
                continue;
            }
            const exampleHost = deepElements(refreshedBodyRoot).find((element) => element.tagName.toLowerCase() === "code" &&
                (element.id === "output" || element.closest("pre.parsed-content") !== null));
            const example = normalizeCode(exampleHost?.textContent);
            if (example.length > 0) {
                const existingExample = exampleGroups.get(example);
                if (existingExample) {
                    if (mediaButton.label.length > 0 && !existingExample.mediaTypes.includes(mediaButton.label)) {
                        existingExample.mediaTypes.push(mediaButton.label);
                    }
                }
                else {
                    exampleGroups.set(example, {
                        mediaTypes: mediaButton.label.length > 0 ? [mediaButton.label] : [],
                        example,
                    });
                }
            }
            const rowHosts = deepElements(refreshedBodyRoot).filter((element) => element.tagName.toLowerCase() === "property-shape-document");
            const rows = rowHosts
                .map((rowHost) => {
                const shadowRoot = rowHost.shadowRoot;
                if (!shadowRoot)
                    return null;
                const pathSegments = buildFieldPath(rowHost);
                const name = pathSegments.join(".");
                const type = normalizeText(Array.from(shadowRoot.querySelectorAll(".data-type"))
                    .map((node) => node.textContent || "")
                    .join(" "));
                const flags = Array.from(shadowRoot.querySelectorAll(".badge"))
                    .map((node) => normalizeText(node.textContent))
                    .filter((value) => value.length > 0);
                const descriptions = Array.from(shadowRoot.querySelectorAll(".markdown-body"))
                    .map((node) => normalizeText(node.textContent))
                    .filter((value) => value.length > 0);
                const rangeHosts = Array.from(shadowRoot.children).filter((node) => node instanceof Element && node.tagName.toLowerCase() === "property-range-document");
                const constraints = rangeHosts
                    .flatMap((rangeHost) => {
                    const rangeShadowRoot = rangeHost.shadowRoot;
                    return Array.from(rangeShadowRoot?.querySelectorAll(".property-attribute") || []);
                })
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
                if (type.length === 0 &&
                    flags.length === 0 &&
                    descriptions.length === 0 &&
                    constraints.length === 0) {
                    return null;
                }
                return { name, type, flags, descriptions, constraints };
            })
                .filter((row) => row !== null);
            const key = JSON.stringify(rows);
            const existing = grouped.get(key);
            if (existing) {
                if (mediaButton.label.length > 0 && !existing.mediaTypes.includes(mediaButton.label)) {
                    existing.mediaTypes.push(mediaButton.label);
                }
            }
            else {
                grouped.set(key, {
                    mediaTypes: mediaButton.label.length > 0 ? [mediaButton.label] : [],
                    rows,
                });
            }
        }
        return {
            examples: Array.from(exampleGroups.values()),
            bodies: Array.from(grouped.values()).filter((variant) => variant.rows.length > 0 || variant.mediaTypes.length > 0),
        };
    })
        .catch((error) => {
        if (debug) {
            console.error(`[debug] Failed extracting structured developer request body: ${(0, errorUtils_1.getErrorMessage)(error)}`);
        }
        return null;
    });
}
async function extractStructuredDeveloperResponses(page, debug) {
    return page
        .evaluate(async () => {
        const waitForUpdate = async () => {
            await new Promise((resolve) => setTimeout(resolve, 120));
        };
        const normalizeText = (value) => (value || "").replace(/\s+/g, " ").trim();
        const normalizeCode = (value) => (value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
        const deepElements = (root) => {
            const results = [];
            const visit = (currentRoot) => {
                const children = Array.from(currentRoot.children || []);
                for (const child of children) {
                    results.push(child);
                    const childWithShadow = child;
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
            .map((tab) => ({ element: tab, label: normalizeText(tab.textContent) }))
            .filter((tab) => tab.label.length > 0);
        const sections = [];
        for (const tab of tabs) {
            tab.element.click();
            await waitForUpdate();
            const methodResponse = responsesRoot.querySelector(".method-response");
            const summaryHost = methodResponse
                ? Array.from(methodResponse.children).find((child) => child.tagName.toLowerCase() === "arc-marked")
                : null;
            const summary = normalizeText(summaryHost?.querySelector("div[slot='markdown-html'], .markdown-body")?.textContent);
            const responseBodies = methodResponse
                ? Array.from(methodResponse.querySelectorAll("api-body-document"))
                : [];
            const exampleBody = responseBodies.find((body) => body.hasAttribute("isexample")) || null;
            const schemaBody = responseBodies.find((body) => !body.hasAttribute("isexample")) || null;
            const exampleRoot = exampleBody?.shadowRoot || null;
            const exampleCodeHost = exampleRoot
                ? deepElements(exampleRoot).find((element) => element.tagName.toLowerCase() === "code" &&
                    (element.id === "output" || element.closest("pre.parsed-content") !== null))
                : null;
            const example = normalizeCode(exampleCodeHost?.textContent);
            const bodyRoot = schemaBody?.shadowRoot || null;
            const variants = [];
            if (bodyRoot) {
                const mediaButtons = deepElements(bodyRoot)
                    .filter((element) => element.tagName.toLowerCase() === "anypoint-button" &&
                    element.classList.contains("media-toggle"))
                    .map((element) => ({ element: element, label: normalizeText(element.textContent) }));
                const uniqueMediaButtons = mediaButtons.length > 0 ? mediaButtons : [{ element: null, label: "" }];
                const grouped = new Map();
                for (const mediaButton of uniqueMediaButtons) {
                    if (mediaButton.element) {
                        mediaButton.element.click();
                        await waitForUpdate();
                    }
                    const refreshedBodyRoot = schemaBody?.shadowRoot || null;
                    if (!refreshedBodyRoot) {
                        continue;
                    }
                    const rowHosts = deepElements(refreshedBodyRoot).filter((element) => element.tagName.toLowerCase() === "property-shape-document");
                    const rows = rowHosts
                        .map((rowHost) => {
                        const shadowRoot = rowHost.shadowRoot;
                        if (!shadowRoot)
                            return null;
                        const getRowName = (host) => {
                            const hostShadowRoot = host.shadowRoot;
                            return normalizeText(hostShadowRoot?.querySelector(".property-title")?.textContent);
                        };
                        const getParentRowHost = (host) => {
                            let current = host;
                            while (current) {
                                if (current.parentNode) {
                                    current = current.parentNode;
                                }
                                else {
                                    const rootNode = current.getRootNode();
                                    current = rootNode instanceof ShadowRoot ? rootNode.host : null;
                                }
                                if (current instanceof Element &&
                                    current !== host &&
                                    current.tagName.toLowerCase() === "property-shape-document") {
                                    return current;
                                }
                            }
                            return null;
                        };
                        const buildFieldPath = (host) => {
                            const segments = [];
                            let current = host;
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
                        const type = normalizeText(Array.from(shadowRoot.querySelectorAll(".data-type"))
                            .map((node) => node.textContent || "")
                            .join(" "));
                        const flags = Array.from(shadowRoot.querySelectorAll(".badge"))
                            .map((node) => normalizeText(node.textContent))
                            .filter((value) => value.length > 0);
                        const descriptions = Array.from(shadowRoot.querySelectorAll(".markdown-body"))
                            .map((node) => normalizeText(node.textContent))
                            .filter((value) => value.length > 0);
                        const rangeHosts = Array.from(shadowRoot.children).filter((node) => node instanceof Element && node.tagName.toLowerCase() === "property-range-document");
                        const constraints = rangeHosts
                            .flatMap((rangeHost) => {
                            const rangeShadowRoot = rangeHost.shadowRoot;
                            return Array.from(rangeShadowRoot?.querySelectorAll(".property-attribute") || []);
                        })
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
                        if (type.length === 0 &&
                            flags.length === 0 &&
                            descriptions.length === 0 &&
                            constraints.length === 0) {
                            return null;
                        }
                        return { name, type, flags, descriptions, constraints };
                    })
                        .filter((row) => row !== null);
                    const key = JSON.stringify(rows);
                    const existing = grouped.get(key);
                    if (existing) {
                        if (mediaButton.label.length > 0 && !existing.mediaTypes.includes(mediaButton.label)) {
                            existing.mediaTypes.push(mediaButton.label);
                        }
                    }
                    else {
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
            console.error(`[debug] Failed extracting structured developer responses: ${(0, errorUtils_1.getErrorMessage)(error)}`);
        }
        return [];
    });
}
async function scrapeDeveloperMarkdown(context, url, timeoutMs, waitMs, includeRawHtml, debug) {
    const page = await context.newPage();
    let docsApiContent = null;
    let docsApiTitle = null;
    page.on("response", async (response) => {
        const responseUrl = response.url();
        if (!responseUrl.includes("/docs/get_document_content/"))
            return;
        try {
            const raw = await response.text();
            if (!raw || raw.trim().length === 0) {
                docsApiContent = null;
                docsApiTitle = null;
                return;
            }
            const payload = JSON.parse(raw);
            if (payload.content) {
                docsApiContent = payload.content;
                docsApiTitle = payload.title || payload.id || docsApiTitle;
            }
        }
        catch (error) {
            if (debug) {
                console.error(`[debug] Developer docs API response parse failed: ${(0, errorUtils_1.getErrorMessage)(error)}`);
            }
        }
    });
    try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
        await (0, browserConsent_1.acceptOneTrust)(page, timeoutMs);
        await waitForAnySelector(page, ["main", "article", ".markdown-content", "doc-content-layout", "doc-amf-reference"], Math.min(timeoutMs, 12000), debug, "developer content");
        if (waitMs > 0) {
            await page.waitForTimeout(waitMs);
        }
        const bodyText = await page.innerText("body").catch((error) => {
            if (debug) {
                console.error(`[debug] Failed reading developer page text content: ${(0, errorUtils_1.getErrorMessage)(error)}`);
            }
            return "";
        });
        if (looksLikeDeveloperErrorPage(bodyText)) {
            throw new Error("Developer documentation error page detected.");
        }
        const html = await page.content();
        const dom = new jsdom_1.JSDOM(html, { url: page.url() });
        const { document } = dom.window;
        for (const selector of DEFAULT_REMOVE_SELECTORS) {
            for (const node of Array.from(document.querySelectorAll(selector))) {
                if (node && typeof node.remove === "function") {
                    node.remove();
                }
            }
        }
        const turndown = (0, helpScraperMarkdown_1.createTurndown)(page.url());
        const extracted = extractBestContent(document);
        let title = await page.title().catch(() => null);
        if (!title) {
            title = extracted.title;
        }
        await prepareDeveloperMethodForExtraction(page, debug);
        const focusedShadowHtml = await extractFocusedDeveloperShadowDomHtml(page).catch((error) => {
            if (debug) {
                console.error(`[debug] Failed extracting focused developer shadow DOM HTML: ${(0, errorUtils_1.getErrorMessage)(error)}`);
            }
            return "";
        });
        let primaryHtml = null;
        try {
            primaryHtml = await page.locator("main, article").first().evaluate((el) => el.outerHTML);
        }
        catch (error) {
            if (debug) {
                console.error(`[debug] Failed reading primary developer HTML container: ${(0, errorUtils_1.getErrorMessage)(error)}`);
            }
            primaryHtml = null;
        }
        const htmlCandidates = [focusedShadowHtml, primaryHtml, extracted.html].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);
        let markdown = "";
        let selectedHtml = null;
        for (const candidateHtml of htmlCandidates) {
            const candidateMarkdown = (0, helpScraperMarkdown_1.formatDeveloperArticleMarkdown)(stripGarbage(turndown.turndown(candidateHtml)), page.url(), title);
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
                console.error(`[debug] Failed extracting developer code blocks: ${(0, errorUtils_1.getErrorMessage)(error)}`);
            }
            return [];
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
            markdown = (0, helpScraperMarkdown_1.formatDeveloperArticleMarkdown)(stripGarbage(turndown.turndown(docsApiContent)), page.url(), docsApiTitle || title);
            title = docsApiTitle || title;
            selectedHtml = docsApiContent;
        }
        if (markdown.length < MIN_CONTENT_LENGTH) {
            const shadowHtml = await extractDeveloperShadowDomHtml(page).catch((error) => {
                if (debug) {
                    console.error(`[debug] Failed extracting developer shadow DOM HTML: ${(0, errorUtils_1.getErrorMessage)(error)}`);
                }
                return "";
            });
            if (shadowHtml.length > MIN_CONTENT_LENGTH) {
                const cleanedShadow = shadowHtml
                    .replace(/<style[\s\S]*?<\/style>/gi, "")
                    .replace(/<script[\s\S]*?<\/script>/gi, "");
                const shadowMarkdown = (0, helpScraperMarkdown_1.formatDeveloperArticleMarkdown)(stripGarbage(turndown.turndown(cleanedShadow)), page.url(), title);
                if (shadowMarkdown.length > markdown.length) {
                    markdown = shadowMarkdown;
                    selectedHtml = cleanedShadow;
                    title = (await page.title().catch((error) => {
                        if (debug) {
                            console.error(`[debug] Failed reading developer page title: ${(0, errorUtils_1.getErrorMessage)(error)}`);
                        }
                        return null;
                    })) || title;
                }
            }
        }
        if (markdown.length < MIN_CONTENT_LENGTH) {
            const textFallback = (0, helpScraperMarkdown_1.formatDeveloperArticleMarkdown)(stripGarbage(bodyText), page.url(), title);
            if (textFallback.length >= MIN_CONTENT_LENGTH) {
                markdown = textFallback;
            }
        }
        const structuredRequestBody = await extractStructuredDeveloperRequestBody(page, debug);
        if (structuredRequestBody) {
            const renderedRequestBody = (0, helpScraperMarkdown_1.renderDeveloperRequestBodySection)(structuredRequestBody);
            markdown = (0, helpScraperMarkdown_1.replaceDeveloperRequestBodySection)(markdown, renderedRequestBody);
        }
        const structuredResponses = await extractStructuredDeveloperResponses(page, debug);
        if (structuredResponses.length > 0) {
            const renderedResponses = (0, helpScraperMarkdown_1.renderDeveloperResponseSections)(structuredResponses);
            markdown = (0, helpScraperMarkdown_1.replaceDeveloperResponsesSection)(markdown, renderedResponses);
        }
        if (markdown.length < MIN_CONTENT_LENGTH) {
            throw new Error("Extracted content was too short.");
        }
        if (looksLikeDeveloperErrorPage(markdown)) {
            throw new Error("Developer documentation error page detected.");
        }
        const normalizedMarkdown = normalizeMarkdown(markdown);
        const markdownTitle = extractMarkdownTitle(normalizedMarkdown);
        const result = {
            url,
            title: markdownTitle || title || docsApiTitle || null,
            markdown: normalizedMarkdown,
        };
        if (includeRawHtml && selectedHtml) {
            result.rawHtml = selectedHtml.trim();
        }
        return result;
    }
    finally {
        await page.close().catch(() => { });
    }
}
async function getHelpDetails(options) {
    const url = (0, urlPolicy_1.normalizeAndValidateDocUrl)(options.url);
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
    const headed = options.headed ?? false;
    const useCache = options.useCache ?? true;
    const includeRawHtml = options.includeRawHtml ?? false;
    const debug = options.debug ?? false;
    const providedSession = options.session ?? null;
    const cacheKey = JSON.stringify({ url, includeRawHtml });
    const cachePath = (0, cache_1.buildCachePath)("detail", cacheKey);
    if (useCache) {
        const cached = await (0, cache_1.readCache)(cachePath);
        if (cached) {
            return cached;
        }
    }
    const session = providedSession || (await createScraperSession({ headed }));
    const shouldCloseSession = !providedSession;
    let result;
    try {
        result =
            getDetailSourceType(url) === "developer"
                ? await scrapeDeveloperMarkdown(session.context, url, timeoutMs, waitMs, includeRawHtml, debug)
                : await scrapeHelpMarkdown(session.context, url, timeoutMs, waitMs, includeRawHtml, debug);
    }
    finally {
        if (shouldCloseSession) {
            await session.close();
        }
    }
    if (useCache) {
        await (0, cache_1.writeCache)(cachePath, result);
    }
    return result;
}
