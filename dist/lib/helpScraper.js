"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDetailSourceType = getDetailSourceType;
exports.getHelpDetails = getHelpDetails;
const playwright_1 = require("playwright");
const readability_1 = require("@mozilla/readability");
const jsdom_1 = require("jsdom");
const turndown_1 = __importDefault(require("turndown"));
const cache_1 = require("./cache");
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
async function acceptOneTrust(page, timeoutMs) {
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
                await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => { });
                return;
            }
        }
        catch {
            // Ignore and continue probing
        }
    }
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
    for (const selector of HELP_ERROR_SELECTORS) {
        const locator = page.locator(selector).first();
        if (await locator.isVisible({ timeout: 1500 }).catch(() => false)) {
            return true;
        }
    }
    return false;
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
    return markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}
async function scrapeHelpMarkdown(url, timeoutMs, waitMs, headed) {
    const browser = await playwright_1.chromium.launch({ headless: !headed });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
        await acceptOneTrust(page, timeoutMs);
        await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => { });
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
        const turndown = new turndown_1.default({ codeBlockStyle: "fenced" });
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
    }
    finally {
        await browser.close();
    }
}
async function extractDeveloperShadowDomHtml(page) {
    return page.evaluate((params) => {
        const skipTags = new Set(params.skipTags);
        function collectShadowHtml(node, depth) {
            if (depth > 15)
                return "";
            let html = "";
            const host = node;
            if (host.shadowRoot) {
                const fragment = document.createElement("div");
                for (const child of Array.from(host.shadowRoot.children)) {
                    const tag = child.tagName.toLowerCase();
                    if (tag === "style" || tag === "script" || tag === "link")
                        continue;
                    fragment.appendChild(child.cloneNode(true));
                }
                html += fragment.innerHTML;
                for (const el of Array.from(host.shadowRoot.querySelectorAll("*"))) {
                    const nested = el;
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
                const node = el;
                if (node.shadowRoot) {
                    all += collectShadowHtml(el, 0);
                }
            }
        }
        return all;
    }, { hosts: DEV_DOC_SHADOW_HOSTS, skipTags: DEV_SHADOW_SKIP_TAGS });
}
async function scrapeDeveloperMarkdown(url, timeoutMs, waitMs, headed) {
    const browser = await playwright_1.chromium.launch({ headless: !headed });
    const context = await browser.newContext();
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
        catch {
            // Ignore non-JSON responses
        }
    });
    try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
        await acceptOneTrust(page, timeoutMs);
        await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => { });
        if (waitMs > 0) {
            await page.waitForTimeout(waitMs);
        }
        const bodyText = await page.innerText("body").catch(() => "");
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
        const turndown = new turndown_1.default({ codeBlockStyle: "fenced" });
        let contentHtml = null;
        let title = null;
        try {
            contentHtml = await page.locator("main, article").first().evaluate((el) => el.outerHTML);
            title = await page.title();
        }
        catch {
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
    }
    finally {
        await browser.close();
    }
}
async function getHelpDetails(options) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
    const headed = options.headed ?? false;
    const useCache = options.useCache ?? true;
    const cacheKey = options.url;
    const cachePath = (0, cache_1.buildCachePath)("detail", cacheKey);
    if (useCache) {
        const cached = await (0, cache_1.readCache)(cachePath);
        if (cached) {
            return cached;
        }
    }
    const result = getDetailSourceType(options.url) === "developer"
        ? await scrapeDeveloperMarkdown(options.url, timeoutMs, waitMs, headed)
        : await scrapeHelpMarkdown(options.url, timeoutMs, waitMs, headed);
    await (0, cache_1.writeCache)(cachePath, result);
    return result;
}
