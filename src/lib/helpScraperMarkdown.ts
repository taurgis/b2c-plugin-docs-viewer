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

export type DeveloperResponseRow = {
  name: string;
  type: string;
  flags: string[];
  descriptions: string[];
  constraints: string[];
};

export type DeveloperResponseBodyVariant = {
  mediaTypes: string[];
  rows: DeveloperResponseRow[];
};

export type DeveloperResponseSection = {
  statusLabel: string;
  summary: string;
  example: string;
  bodies: DeveloperResponseBodyVariant[];
};

export type DeveloperRequestBodySection = {
  example: string;
  bodies: DeveloperResponseBodyVariant[];
};

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

function tokenizeMarkdownBlocks(markdown: string): string[] {
  const lines = markdown.split("\n");
  const blocks: string[] = [];

  for (let index = 0; index < lines.length; ) {
    if (lines[index].trim().length === 0) {
      index += 1;
      continue;
    }

    if (lines[index].startsWith("```")) {
      const codeBlockLines = [lines[index]];
      index += 1;

      while (index < lines.length) {
        codeBlockLines.push(lines[index]);
        if (lines[index].startsWith("```")) {
          index += 1;
          break;
        }
        index += 1;
      }

      blocks.push(codeBlockLines.join("\n"));
      continue;
    }

    if (lines[index].trim().startsWith("|")) {
      const tableLines = [lines[index].trimEnd()];
      index += 1;

      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableLines.push(lines[index].trimEnd());
        index += 1;
      }

      blocks.push(tableLines.join("\n"));
      continue;
    }

    blocks.push(lines[index].trim());
    index += 1;
  }

  return blocks;
}

function untokenizeMarkdownBlocks(blocks: string[]): string {
  return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

function isDeveloperNoiseToken(token: string): boolean {
  return /^(false|hide|show)$/i.test(token.trim());
}

function isDeveloperIdentifierToken(token: string): boolean {
  const normalized = token.replace(/\\_/g, "_").trim();
  return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(normalized);
}

function isDeveloperTypeToken(token: string): boolean {
  const normalized = token.replace(/\\_/g, "_").trim();
  if (normalized.length === 0 || normalized.length > 60) return false;
  if (/[,:]/.test(normalized)) return false;

  return /^(?:string|object|number|integer|boolean|array|null|enum|date(?:-time)?|datetime|time|uri|url|file|binary|any|map<[^>]+>|array<[^>]+>|\[[^\]]+\])$/i.test(
    normalized
  );
}

function isDeveloperConstraintToken(token: string): boolean {
  return /^[A-Z][A-Za-z ]+:\s*.+$/.test(token.trim());
}

function isDeveloperStatusToken(token: string): boolean {
  return /^\d{3}(?:default|\s+default)$/i.test(token.trim());
}

function normalizeDeveloperStatusToken(token: string): string {
  const match = token.trim().match(/^(\d{3})(default)$/i);
  return match ? `${match[1]} default` : token;
}

function splitConcatenatedMediaTypes(token: string): string {
  const prefixes = [
    "application/",
    "audio/",
    "font/",
    "example/",
    "image/",
    "message/",
    "model/",
    "multipart/",
    "text/",
    "video/",
  ];

  let normalized = token.trim();
  for (const prefix of prefixes) {
    normalized = normalized.replace(new RegExp(`(?!^)${prefix}`, "g"), `, ${prefix}`);
  }

  return normalized.replace(/,\s+,/g, ", ").trim();
}

function isDeveloperMethodToken(token: string): boolean {
  return /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/i.test(token.trim());
}

function isDeveloperUrlToken(token: string): boolean {
  return /^https?:\/\//i.test(token.trim());
}

function isDeveloperSnippetLanguageToken(token: string): boolean {
  return /^(cURL|HTTP|JavaScript-Fetch|JavaScript-Async|JavaScript-Node|JavaScript-XHR|Python-Requests|Python-2\.7|Python-3\.1|C|Java-HTTP|Java-Spring)$/i.test(
    token.trim()
  );
}

function isDeveloperSectionToken(token: string): boolean {
  return /^(Request|Request Example|Security|Responses|Body|Example|URI parameters|Query parameters|Headers)$/i.test(
    token.trim()
  );
}

function isDeveloperPropertyStart(blocks: string[], index: number): boolean {
  if (index + 1 >= blocks.length) return false;
  return isDeveloperIdentifierToken(blocks[index]) && isDeveloperTypeToken(blocks[index + 1]);
}

function renderDeveloperPropertyTable(
  heading: string,
  rows: Array<{
    name: string;
    type: string;
    flags: string[];
    descriptions: string[];
    constraints: string[];
  }>
): string {
  const nameHeader = heading.toLowerCase() === "uri parameters" ? "Name" : "Field";
  const flagHeader = heading.toLowerCase() === "uri parameters" ? "Required" : "Flags";
  const header = `| ${nameHeader} | Type | ${flagHeader} | Description | Constraints |`;
  const separator = "| --- | --- | --- | --- | --- |";
  const body = rows.map((row) => {
    const flagValue =
      heading.toLowerCase() === "uri parameters"
        ? row.flags.includes("Required")
          ? "Yes"
          : ""
        : row.flags.join(", ");

    return `| ${escapeTableCell(row.name)} | ${escapeTableCell(row.type)} | ${escapeTableCell(
      flagValue
    )} | ${escapeTableCell(row.descriptions.join(" "))} | ${escapeTableCell(
      row.constraints.join("; ")
    )} |`;
  });

  return [header, separator, ...body].join("\n");
}

function normalizeDeveloperPropertySections(markdown: string): string {
  const blocks = tokenizeMarkdownBlocks(markdown);
  const normalizedBlocks: string[] = [];

  for (let index = 0; index < blocks.length; ) {
    const block = blocks[index];
    const normalizedBlock = normalizeDeveloperStatusToken(block);

    if (block === "URI parameters" || block === "Query parameters" || block === "Headers" || block === "Body") {
      const sectionBlocks = [block];
      let cursor = index + 1;

      while (cursor < blocks.length && isDeveloperNoiseToken(blocks[cursor])) {
        cursor += 1;
      }

      if (blocks[cursor]?.trim().toLowerCase() === "media type:") {
        const mediaLabel = blocks[cursor].trim().endsWith(":") ? "Media types:" : blocks[cursor];
        cursor += 1;
        while (cursor < blocks.length && isDeveloperNoiseToken(blocks[cursor])) {
          cursor += 1;
        }

        if (cursor < blocks.length) {
          sectionBlocks.push(`${mediaLabel} ${splitConcatenatedMediaTypes(blocks[cursor])}`);
          cursor += 1;
        }

        while (cursor < blocks.length && isDeveloperNoiseToken(blocks[cursor])) {
          cursor += 1;
        }
      }

      const rows: Array<{
        name: string;
        type: string;
        flags: string[];
        descriptions: string[];
        constraints: string[];
      }> = [];

      while (cursor < blocks.length) {
        if (isDeveloperNoiseToken(blocks[cursor])) {
          cursor += 1;
          continue;
        }

        if (!isDeveloperPropertyStart(blocks, cursor)) {
          break;
        }

        const row = {
          name: blocks[cursor].replace(/\\_/g, "_"),
          type: blocks[cursor + 1].replace(/\\_/g, "_"),
          flags: [] as string[],
          descriptions: [] as string[],
          constraints: [] as string[],
        };
        cursor += 2;

        while (cursor < blocks.length) {
          const token = blocks[cursor];

          if (isDeveloperNoiseToken(token)) {
            cursor += 1;
            continue;
          }

          if (isDeveloperPropertyStart(blocks, cursor)) {
            break;
          }

          if (
            token.startsWith("#") ||
            token.startsWith("```") ||
            token === "Example" ||
            isDeveloperStatusToken(token) ||
            isDeveloperSectionToken(token)
          ) {
            break;
          }

          if (token === "Required") {
            row.flags.push("Required");
            cursor += 1;
            continue;
          }

          if (isDeveloperConstraintToken(token)) {
            row.constraints.push(token);
            cursor += 1;
            continue;
          }

          row.descriptions.push(token);
          cursor += 1;
        }

        rows.push(row);
      }

      if (rows.length > 0) {
        sectionBlocks.push(renderDeveloperPropertyTable(block, rows));
        normalizedBlocks.push(...sectionBlocks);
        index = cursor;
        continue;
      }
    }

    if (!isDeveloperNoiseToken(normalizedBlock)) {
      if (normalizedBlock.trim().toLowerCase() === "media type:" && index + 1 < blocks.length) {
        const nextBlock = blocks[index + 1];
        if (!isDeveloperNoiseToken(nextBlock)) {
          normalizedBlocks.push(`Media types: ${splitConcatenatedMediaTypes(nextBlock)}`);
          index += 2;
          continue;
        }
      }

      normalizedBlocks.push(normalizedBlock);
    }

    index += 1;
  }

  return untokenizeMarkdownBlocks(normalizedBlocks);
}

function normalizeDeveloperSectionStructure(markdown: string): string {
  const blocks = tokenizeMarkdownBlocks(markdown);
  const normalizedBlocks: string[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];

    if (isDeveloperMethodToken(block) && index + 1 < blocks.length && isDeveloperUrlToken(blocks[index + 1])) {
      normalizedBlocks.push(`**${block.trim().toUpperCase()}** \`${blocks[index + 1].trim()}\``);
      index += 1;
      continue;
    }

    if (isDeveloperSnippetLanguageToken(block)) {
      continue;
    }

    if (block === "Request") {
      normalizedBlocks.push("## Request");
      continue;
    }

    if (block === "Request Example") {
      normalizedBlocks.push("### Request Example");
      continue;
    }

    if (block === "Security") {
      normalizedBlocks.push("## Security");
      continue;
    }

    if (block === "Responses") {
      normalizedBlocks.push("## Responses");
      continue;
    }

    if (block === "Body") {
      normalizedBlocks.push("### Body");
      continue;
    }

    if (block === "Example") {
      normalizedBlocks.push("### Example");
      continue;
    }

    if (block === "URI parameters") {
      normalizedBlocks.push("#### URI Parameters");
      continue;
    }

    if (block === "Query parameters") {
      normalizedBlocks.push("#### Query Parameters");
      continue;
    }

    if (block === "Headers") {
      normalizedBlocks.push("#### Headers");
      continue;
    }

    if (isDeveloperStatusToken(block)) {
      normalizedBlocks.push(`### ${normalizeDeveloperStatusToken(block).toUpperCase()}`);
      continue;
    }

    normalizedBlocks.push(block);
  }

  return untokenizeMarkdownBlocks(normalizedBlocks)
    .replace(/^## OAuth 2\.0$/m, "### OAuth 2.0")
    .replace(/^### Settings$/m, "#### Settings");
}

function renderDeveloperResponseTable(rows: DeveloperResponseRow[]): string {
  const header = "| Field | Type | Flags | Description | Constraints |";
  const separator = "| --- | --- | --- | --- | --- |";
  const body = rows.map((row) => {
    const flags = row.flags.join(", ");
    const descriptions = row.descriptions.join(" ");
    const constraints = row.constraints.join("; ");

    return `| ${escapeTableCell(row.name)} | ${escapeTableCell(row.type)} | ${escapeTableCell(
      flags
    )} | ${escapeTableCell(descriptions)} | ${escapeTableCell(constraints)} |`;
  });

  return [header, separator, ...body].join("\n");
}

export function renderDeveloperResponseSections(sections: DeveloperResponseSection[]): string {
  const normalizedSections = sections.filter(
    (section) =>
      section.statusLabel.trim().length > 0 ||
      section.summary.trim().length > 0 ||
      section.example.trim().length > 0 ||
      section.bodies.some((body) => body.rows.length > 0 || body.mediaTypes.length > 0)
  );

  if (normalizedSections.length === 0) {
    return "";
  }

  const blocks: string[] = ["## Responses"];

  for (const section of normalizedSections) {
    blocks.push(`### ${section.statusLabel}`);

    if (section.summary.trim().length > 0) {
      blocks.push(section.summary.trim());
    }

    if (section.example.trim().length > 0) {
      blocks.push("#### Example");
      blocks.push(`\`\`\`\n${section.example.trim()}\n\`\`\``);
    }

    for (const body of section.bodies) {
      if (body.rows.length === 0 && body.mediaTypes.length === 0) {
        continue;
      }

      blocks.push("#### Body");

      if (body.mediaTypes.length > 0) {
        blocks.push(`Media types: ${body.mediaTypes.join(", ")}`);
      }

      if (body.rows.length > 0) {
        blocks.push(renderDeveloperResponseTable(body.rows));
      }
    }
  }

  return blocks.join("\n\n");
}

export function renderDeveloperRequestBodySection(section: DeveloperRequestBodySection): string {
  const hasContent =
    section.example.trim().length > 0 ||
    section.bodies.some((body) => body.rows.length > 0 || body.mediaTypes.length > 0);

  if (!hasContent) {
    return "";
  }

  const blocks: string[] = ["### Body"];

  if (section.bodies.length > 0) {
    const mergedMediaTypes = Array.from(
      new Set(section.bodies.flatMap((body) => body.mediaTypes).filter((value) => value.trim().length > 0))
    );

    if (mergedMediaTypes.length > 0) {
      blocks.push(`Media types: ${mergedMediaTypes.join(", ")}`);
    }
  }

  if (section.example.trim().length > 0) {
    blocks.push("### Example");
    blocks.push(`\`\`\`\n${section.example.trim()}\n\`\`\``);
  }

  for (const body of section.bodies) {
    if (body.rows.length > 0) {
      blocks.push(renderDeveloperResponseTable(body.rows));
    }
  }

  return blocks.join("\n\n");
}

export function replaceDeveloperResponsesSection(
  markdown: string,
  renderedResponses: string
): string {
  const replacement = renderedResponses.trim();
  if (replacement.length === 0) {
    return markdown;
  }

  const marker = "\n## Responses";
  const markerIndex = markdown.indexOf(marker);
  if (markerIndex >= 0) {
    return `${markdown.slice(0, markerIndex).trimEnd()}\n\n${replacement}`;
  }

  return `${markdown.trimEnd()}\n\n${replacement}`;
}

export function replaceDeveloperRequestBodySection(
  markdown: string,
  renderedRequestBody: string
): string {
  const replacement = renderedRequestBody.trim();
  if (replacement.length === 0) {
    return markdown;
  }

  const requestMarker = "\n## Request";
  const requestIndex = markdown.indexOf(requestMarker);
  if (requestIndex < 0) {
    return markdown;
  }

  const nextSecurityIndex = markdown.indexOf("\n## Security", requestIndex + requestMarker.length);
  const nextResponsesIndex = markdown.indexOf("\n## Responses", requestIndex + requestMarker.length);
  const sectionEndCandidates = [nextSecurityIndex, nextResponsesIndex].filter((index) => index >= 0);
  const sectionEnd = sectionEndCandidates.length > 0 ? Math.min(...sectionEndCandidates) : markdown.length;
  const bodyIndex = markdown.indexOf("\n### Body", requestIndex + requestMarker.length);

  if (bodyIndex >= 0 && bodyIndex < sectionEnd) {
    return `${markdown.slice(0, bodyIndex).trimEnd()}\n\n${replacement}\n\n${markdown.slice(sectionEnd).trimStart()}`;
  }

  return `${markdown.slice(0, sectionEnd).trimEnd()}\n\n${replacement}\n\n${markdown.slice(sectionEnd).trimStart()}`;
}

function getDeveloperMetaTitle(pageUrl: string): string | null {
  try {
    const meta = new URL(pageUrl).searchParams.get("meta");
    if (!meta) return null;

    const normalized = meta.replace(/\+/g, " ").replace(/\s+/g, " ").trim();
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

function getDeveloperPreferredTitle(pageUrl: string, title: string | null): string | null {
  const metaTitle = getDeveloperMetaTitle(pageUrl);
  if (metaTitle) {
    return metaTitle;
  }

  const trimmedTitle = title?.split("|")[0]?.trim() || null;
  return trimmedTitle && trimmedTitle.length > 0 ? trimmedTitle : null;
}

function findDeveloperSectionStart(markdown: string, sectionTitle: string): number {
  const normalizedTitle = sectionTitle.trim().toLowerCase();
  if (!normalizedTitle) return -1;

  const lines = markdown.split("\n");
  let offset = 0;
  let operationIdOffset = -1;

  for (const line of lines) {
    const normalizedLine = line.trim().toLowerCase();

    if (normalizedLine === normalizedTitle || normalizedLine === `# ${normalizedTitle}`) {
      return offset;
    }

    if (normalizedLine === `operation id: ${normalizedTitle}` && operationIdOffset < 0) {
      operationIdOffset = offset;
    }

    offset += line.length + 1;
  }

  return operationIdOffset;
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

export function formatDeveloperArticleMarkdown(
  markdown: string,
  pageUrl: string,
  title: string | null
): string {
  let output = markdown.replace(/\u00a0/g, " ");
  const metaTitle = getDeveloperMetaTitle(pageUrl);
  if (!metaTitle) {
    return output;
  }

  const preferredTitle = getDeveloperPreferredTitle(pageUrl, title);

  if (preferredTitle) {
    const sectionStart = findDeveloperSectionStart(output, preferredTitle);
    if (sectionStart > 0) {
      output = output.slice(sectionStart);
    }
  }

  output = cutAtFirstMarker(output, [
    "\n## developer centers",
    "\n## popular resources",
    "\n## community",
    "\n[commerce cloud](https://developer.salesforce.com/developer-centers/commerce-cloud)",
    "\n[![salesforce logo]",
  ]);

  output = normalizeDeveloperPropertySections(output);
  output = normalizeDeveloperSectionStructure(output);
  output = ensureTitleHeading(output, preferredTitle);

  return output;
}

export function convertHtmlToMarkdown(html: string, baseUrl: string): string {
  const turndown = createTurndown(baseUrl);
  return postProcessMarkdownArtifacts(turndown.turndown(preprocessHtmlForTurndown(html, baseUrl)));
}
