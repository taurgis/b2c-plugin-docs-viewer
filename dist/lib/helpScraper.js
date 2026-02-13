"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDetailSourceType = getDetailSourceType;
exports.formatHelpArticleMarkdown = formatHelpArticleMarkdown;
exports.convertHtmlToMarkdown = convertHtmlToMarkdown;
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
function toAbsoluteUrl(rawUrl, baseUrl) {
    if (!rawUrl)
        return rawUrl;
    if (rawUrl.startsWith("#"))
        return rawUrl;
    try {
        return new URL(rawUrl, baseUrl).toString();
    }
    catch {
        return rawUrl;
    }
}
function escapeTableCell(value) {
    return value.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}
function extractTableCellText(cell) {
    const clone = cell.cloneNode(true);
    for (const brNode of Array.from(clone.querySelectorAll("br"))) {
        brNode.replaceWith("\n");
    }
    for (const blockNode of Array.from(clone.querySelectorAll("p,li,div"))) {
        blockNode.appendChild(clone.ownerDocument.createTextNode("\n"));
    }
    return (clone.textContent || "")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]*\n[ \t]*/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
}
function tableToMarkdown(table) {
    const rowNodes = Array.from(table.querySelectorAll("tr"));
    const rows = rowNodes
        .map((row) => Array.from(row.querySelectorAll("th,td")).map(extractTableCellText))
        .filter((row) => row.length > 0);
    if (!rows.length)
        return "\n\n";
    const header = rows[0];
    const body = rows.slice(1);
    const columnCount = Math.max(header.length, ...body.map((row) => row.length));
    const padRow = (row) => {
        if (row.length >= columnCount)
            return row;
        return [...row, ...Array.from({ length: columnCount - row.length }, () => "")];
    };
    const headerLine = `| ${padRow(header).map(escapeTableCell).join(" | ")} |`;
    const separatorLine = `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`;
    const bodyLines = body.map((row) => `| ${padRow(row).map(escapeTableCell).join(" | ")} |`);
    return `\n\n${[headerLine, separatorLine, ...bodyLines].join("\n")}\n\n`;
}
function preprocessHtmlForTurndown(html, baseUrl) {
    const dom = new jsdom_1.JSDOM(`<body>${html}</body>`, { url: baseUrl });
    const { document } = dom.window;
    for (const heading of Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))) {
        for (const anchor of Array.from(heading.querySelectorAll("a"))) {
            const text = (anchor.textContent || "").trim();
            const hasChildContent = anchor.querySelector("img,svg,code,span,strong,em") !== null;
            if (text.length > 0 || hasChildContent)
                continue;
            const anchorId = anchor.getAttribute("id") || anchor.getAttribute("name");
            if (anchorId && !heading.getAttribute("id")) {
                heading.setAttribute("id", anchorId);
            }
            anchor.remove();
        }
    }
    for (const anchor of Array.from(document.querySelectorAll("a"))) {
        const nextNode = anchor.nextSibling;
        if (nextNode && nextNode.nodeType === dom.window.Node.ELEMENT_NODE && nextNode.tagName === "A") {
            anchor.after(document.createTextNode(" "));
            continue;
        }
        if (nextNode && nextNode.nodeType === dom.window.Node.TEXT_NODE) {
            const text = nextNode.textContent || "";
            if (text.length > 0 && /^\S/.test(text) && /^[A-Za-z0-9(]/.test(text)) {
                nextNode.textContent = ` ${text}`;
            }
        }
    }
    for (const node of Array.from(document.querySelectorAll("dx-code-block"))) {
        const code = (node.getAttribute("code-block") || node.textContent || "")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .trim();
        const language = (node.getAttribute("language") || "").trim();
        const pre = document.createElement("pre");
        if (language) {
            pre.setAttribute("data-language", language);
        }
        const codeNode = document.createElement("code");
        codeNode.textContent = code;
        pre.appendChild(codeNode);
        node.replaceWith(pre);
    }
    for (const emphNode of Array.from(document.querySelectorAll("emph"))) {
        const emNode = document.createElement("em");
        emNode.innerHTML = emphNode.innerHTML;
        emphNode.replaceWith(emNode);
    }
    for (const image of Array.from(document.querySelectorAll("img"))) {
        const nextNode = image.nextSibling;
        if (nextNode && nextNode.nodeType === dom.window.Node.TEXT_NODE) {
            const text = nextNode.textContent || "";
            if (text.length > 0 && /^\S/.test(text) && /^[A-Za-z0-9(]/.test(text)) {
                nextNode.textContent = ` ${text}`;
            }
        }
    }
    return document.body.innerHTML;
}
function createTurndown(baseUrl) {
    const turndown = new turndown_1.default({
        codeBlockStyle: "fenced",
        headingStyle: "atx",
        bulletListMarker: "-",
        emDelimiter: "*",
    });
    turndown.addRule("fenced-pre", {
        filter: (node) => node.nodeName === "PRE",
        replacement: (_content, node) => {
            const code = (node.textContent || "")
                .replace(/\r\n/g, "\n")
                .replace(/\r/g, "\n")
                .trim();
            if (!code)
                return "\n\n";
            const language = (node.getAttribute("data-language") || "").trim();
            return `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
        },
    });
    turndown.addRule("table", {
        filter: (node) => node.nodeName === "TABLE",
        replacement: (_content, node) => tableToMarkdown(node),
    });
    turndown.addRule("absolute-links", {
        filter: (node) => node.nodeName === "A",
        replacement: (content, node) => {
            const href = node.getAttribute("href") || "";
            const label = content.trim();
            if (!href)
                return label;
            if (!label)
                return "";
            const absoluteHref = toAbsoluteUrl(href, baseUrl);
            const title = node.getAttribute("title");
            const titlePart = title ? ` \"${title}\"` : "";
            return `[${label}](${absoluteHref}${titlePart})`;
        },
    });
    turndown.addRule("absolute-images", {
        filter: (node) => node.nodeName === "IMG",
        replacement: (_content, node) => {
            const src = node.getAttribute("src") || "";
            if (!src)
                return "";
            const alt = node.getAttribute("alt") || "";
            const absoluteSrc = toAbsoluteUrl(src, baseUrl);
            return `![${alt}](${absoluteSrc})`;
        },
    });
    return turndown;
}
function postProcessMarkdownArtifacts(markdown) {
    return markdown
        .replace(/^(#{1,6})\s+\[(https?:\/\/[^\]]+)\]\(\2\)\s*/gm, "$1 ")
        .replace(/\)\[/g, ") [")
        .replace(/(!\[[^\]]*\]\([^\)\n]+\))(?=[A-Za-z0-9])/g, "$1 ")
        .replace(/[ \t]+$/gm, "");
}
function cutAtFirstMarker(input, markers) {
    const lower = input.toLowerCase();
    let cutIndex = -1;
    for (const marker of markers) {
        const index = lower.indexOf(marker.toLowerCase());
        if (index >= 0 && (cutIndex < 0 || index < cutIndex)) {
            cutIndex = index;
        }
    }
    if (cutIndex >= 0) {
        return input.slice(0, cutIndex);
    }
    return input;
}
function ensureTitleHeading(markdown, title) {
    if (!title)
        return markdown;
    const lines = markdown.split("\n");
    const firstNonEmptyIndex = lines.findIndex((line) => line.trim().length > 0);
    if (firstNonEmptyIndex < 0)
        return markdown;
    if (lines[firstNonEmptyIndex].trim().toLowerCase() === title.trim().toLowerCase()) {
        lines[firstNonEmptyIndex] = `# ${title}`;
        return lines.join("\n");
    }
    return markdown;
}
function formatHelpArticleMarkdown(markdown, title) {
    let output = markdown.replace(/\u00a0/g, " ");
    if (title) {
        const titleIndex = output.toLowerCase().lastIndexOf(title.toLowerCase());
        if (titleIndex > 0) {
            output = output.slice(titleIndex);
        }
    }
    output = cutAtFirstMarker(output, [
        "did this article solve your issue?",
        "1-800-667-6389",
        "salesforce help | article",
        "cookie consent manager",
        "we use cookies on our website",
    ]);
    output = ensureTitleHeading(output, title);
    return output;
}
function convertHtmlToMarkdown(html, baseUrl) {
    const turndown = createTurndown(baseUrl);
    return postProcessMarkdownArtifacts(turndown.turndown(preprocessHtmlForTurndown(html, baseUrl)));
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
async function scrapeHelpMarkdown(url, timeoutMs, waitMs, headed, includeRawHtml) {
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
async function scrapeDeveloperMarkdown(url, timeoutMs, waitMs, headed, includeRawHtml) {
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
        const turndown = createTurndown(page.url());
        const extracted = extractBestContent(document);
        let title = await page.title().catch(() => null);
        if (!title) {
            title = extracted.title;
        }
        let primaryHtml = null;
        try {
            primaryHtml = await page.locator("main, article").first().evaluate((el) => el.outerHTML);
        }
        catch {
            primaryHtml = null;
        }
        const htmlCandidates = [primaryHtml, extracted.html].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);
        let markdown = "";
        let selectedHtml = null;
        for (const candidateHtml of htmlCandidates) {
            const candidateMarkdown = stripGarbage(turndown.turndown(candidateHtml));
            if (candidateMarkdown.length > markdown.length) {
                markdown = candidateMarkdown;
                selectedHtml = candidateHtml;
            }
        }
        const codeBlocks = await extractDeveloperCodeBlocks(page).catch(() => []);
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
            const shadowHtml = await extractDeveloperShadowDomHtml(page).catch(() => "");
            if (shadowHtml.length > MIN_CONTENT_LENGTH) {
                const cleanedShadow = shadowHtml
                    .replace(/<style[\s\S]*?<\/style>/gi, "")
                    .replace(/<script[\s\S]*?<\/script>/gi, "");
                const shadowMarkdown = stripGarbage(turndown.turndown(cleanedShadow));
                if (shadowMarkdown.length > markdown.length) {
                    markdown = shadowMarkdown;
                    selectedHtml = cleanedShadow;
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
        await browser.close();
    }
}
async function getHelpDetails(options) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
    const headed = options.headed ?? false;
    const useCache = options.useCache ?? true;
    const includeRawHtml = options.includeRawHtml ?? false;
    const cacheKey = JSON.stringify({ url: options.url, includeRawHtml });
    const cachePath = (0, cache_1.buildCachePath)("detail", cacheKey);
    if (useCache) {
        const cached = await (0, cache_1.readCache)(cachePath);
        if (cached) {
            return cached;
        }
    }
    const result = getDetailSourceType(options.url) === "developer"
        ? await scrapeDeveloperMarkdown(options.url, timeoutMs, waitMs, headed, includeRawHtml)
        : await scrapeHelpMarkdown(options.url, timeoutMs, waitMs, headed, includeRawHtml);
    await (0, cache_1.writeCache)(cachePath, result);
    return result;
}
