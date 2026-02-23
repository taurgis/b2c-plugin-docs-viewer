import { JSDOM } from "jsdom";
import TurndownService from "turndown";

function toAbsoluteUrl(rawUrl: string, baseUrl: string): string {
  if (!rawUrl) return rawUrl;
  if (rawUrl.startsWith("#")) return rawUrl;
  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return rawUrl;
  }
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function extractTableCellText(cell: Element): string {
  const clone = cell.cloneNode(true) as Element;

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

function tableToMarkdown(table: Element): string {
  const rowNodes = Array.from(table.querySelectorAll("tr"));
  const rows = rowNodes
    .map((row) => Array.from(row.querySelectorAll("th,td")).map(extractTableCellText))
    .filter((row) => row.length > 0);

  if (!rows.length) return "\n\n";

  const header = rows[0];
  const body = rows.slice(1);
  const columnCount = Math.max(header.length, ...body.map((row) => row.length));

  const padRow = (row: string[]) => {
    if (row.length >= columnCount) return row;
    return [...row, ...Array.from({ length: columnCount - row.length }, () => "")];
  };

  const headerLine = `| ${padRow(header).map(escapeTableCell).join(" | ")} |`;
  const separatorLine = `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`;
  const bodyLines = body.map((row) => `| ${padRow(row).map(escapeTableCell).join(" | ")} |`);

  return `\n\n${[headerLine, separatorLine, ...bodyLines].join("\n")}\n\n`;
}

function preprocessHtmlForTurndown(html: string, baseUrl: string): string {
  const dom = new JSDOM(`<body>${html}</body>`, { url: baseUrl });
  const { document } = dom.window;

  for (const heading of Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))) {
    for (const anchor of Array.from(heading.querySelectorAll("a"))) {
      const text = (anchor.textContent || "").trim();
      const hasChildContent = anchor.querySelector("img,svg,code,span,strong,em") !== null;
      if (text.length > 0 || hasChildContent) continue;

      const anchorId = anchor.getAttribute("id") || anchor.getAttribute("name");
      if (anchorId && !heading.getAttribute("id")) {
        heading.setAttribute("id", anchorId);
      }
      anchor.remove();
    }
  }

  for (const anchor of Array.from(document.querySelectorAll("a"))) {
    const nextNode = anchor.nextSibling;
    if (
      nextNode &&
      nextNode.nodeType === dom.window.Node.ELEMENT_NODE &&
      (nextNode as Element).tagName === "A"
    ) {
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

export function createTurndown(baseUrl: string): TurndownService {
  const turndown = new TurndownService({
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
      if (!code) return "\n\n";
      const language = ((node as Element).getAttribute("data-language") || "").trim();
      return `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
    },
  });

  turndown.addRule("table", {
    filter: (node) => node.nodeName === "TABLE",
    replacement: (_content, node) => tableToMarkdown(node as Element),
  });

  turndown.addRule("absolute-links", {
    filter: (node) => node.nodeName === "A",
    replacement: (content, node) => {
      const href = (node as Element).getAttribute("href") || "";
      const label = content.trim();
      if (!href) return label;
      if (!label) return "";
      const absoluteHref = toAbsoluteUrl(href, baseUrl);
      const title = (node as Element).getAttribute("title");
      const titlePart = title ? ` \"${title}\"` : "";
      return `[${label}](${absoluteHref}${titlePart})`;
    },
  });

  turndown.addRule("absolute-images", {
    filter: (node) => node.nodeName === "IMG",
    replacement: (_content, node) => {
      const src = (node as Element).getAttribute("src") || "";
      if (!src) return "";
      const alt = (node as Element).getAttribute("alt") || "";
      const absoluteSrc = toAbsoluteUrl(src, baseUrl);
      return `![${alt}](${absoluteSrc})`;
    },
  });

  return turndown;
}

function postProcessMarkdownArtifacts(markdown: string): string {
  return markdown
    .replace(/^(#{1,6})\s+\[(https?:\/\/[^\]]+)\]\(\2\)\s*/gm, "$1 ")
    .replace(/\)\[/g, ") [")
    .replace(/(!\[[^\]]*\]\([^\)\n]+\))(?=[A-Za-z0-9])/g, "$1 ")
    .replace(/[ \t]+$/gm, "");
}

function cutAtFirstMarker(input: string, markers: string[]): string {
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

function ensureTitleHeading(markdown: string, title: string | null): string {
  if (!title) return markdown;

  const lines = markdown.split("\n");
  const firstNonEmptyIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstNonEmptyIndex < 0) return markdown;

  if (lines[firstNonEmptyIndex].trim().toLowerCase() === title.trim().toLowerCase()) {
    lines[firstNonEmptyIndex] = `# ${title}`;
    return lines.join("\n");
  }

  return markdown;
}

function findTitleLineStart(markdown: string, title: string): number {
  const normalizedTitle = title.trim().toLowerCase();
  if (!normalizedTitle) return -1;

  const lines = markdown.split("\n");
  let offset = 0;

  for (const line of lines) {
    const normalizedLine = line.trim().toLowerCase();
    if (normalizedLine === normalizedTitle || normalizedLine === `# ${normalizedTitle}`) {
      return offset;
    }

    offset += line.length + 1;
  }

  return -1;
}

function removeLeadingBreadcrumbChrome(markdown: string, title: string | null): string {
  if (!title) return markdown;

  const normalizedTitle = title.trim();
  if (!normalizedTitle) return markdown;

  const headingLine = `# ${normalizedTitle}`;
  const lowerMarkdown = markdown.toLowerCase();
  const lowerHeadingLine = headingLine.toLowerCase();

  const firstHeadingIndex = lowerMarkdown.indexOf(lowerHeadingLine);
  if (firstHeadingIndex !== 0) return markdown;

  const breadcrumbsIndex = lowerMarkdown.indexOf("you are here:", lowerHeadingLine.length);
  if (breadcrumbsIndex < 0 || breadcrumbsIndex > 1500) return markdown;

  const secondTitleOffset = findTitleLineStart(markdown.slice(breadcrumbsIndex), title);
  if (secondTitleOffset < 0) return markdown;

  const secondTitleIndex = breadcrumbsIndex + secondTitleOffset;
  if (secondTitleIndex > 3500) return markdown;

  const secondTitleLineEnd = markdown.indexOf("\n", secondTitleIndex);
  const contentStart = secondTitleLineEnd >= 0 ? secondTitleLineEnd : markdown.length;

  return `${markdown.slice(0, headingLine.length)}${markdown.slice(contentStart)}`;
}

export function formatHelpArticleMarkdown(markdown: string, title: string | null): string {
  let output = markdown.replace(/\u00a0/g, " ");

  if (title) {
    const titleIndex = findTitleLineStart(output, title);

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
  output = removeLeadingBreadcrumbChrome(output, title);
  return output;
}

export function convertHtmlToMarkdown(html: string, baseUrl: string): string {
  const turndown = createTurndown(baseUrl);
  return postProcessMarkdownArtifacts(turndown.turndown(preprocessHtmlForTurndown(html, baseUrl)));
}
