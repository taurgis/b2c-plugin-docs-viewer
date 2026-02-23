import type { SearchResult } from "./helpSearch";

const MAX_URL_WIDTH = 65;

function padRight(value: string, width: number): string {
  return value.padEnd(width, " ");
}

function wrap(value: string, width: number): string[] {
  if (width <= 0) return [value];
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += width) {
    parts.push(value.slice(i, i + width));
  }
  return parts.length ? parts : [""];
}

export function renderSearchResultsTable(results: SearchResult[]): string {
  const rows = results.map((item, index) => ({
    number: String(index + 1).padStart(2, "0"),
    title: item.title || "(untitled)",
    url: item.url,
  }));

  const maxTitleWidth = Math.min(60, Math.max("Title".length, ...rows.map((row) => row.title.length)));
  const maxUrlWidth = Math.max("URL".length, MAX_URL_WIDTH);
  const numberWidth = Math.max("#".length, ...rows.map((row) => row.number.length));

  const border =
    "+" +
    "-".repeat(numberWidth + 2) +
    "+" +
    "-".repeat(maxTitleWidth + 2) +
    "+" +
    "-".repeat(maxUrlWidth + 2) +
    "+";

  const header =
    `| ${padRight("#", numberWidth)} ` +
    `| ${padRight("Title", maxTitleWidth)} ` +
    `| ${padRight("URL", maxUrlWidth)} |`;

  const body = rows.flatMap((row, rowIndex) => {
    const titleLine = padRight(row.title.slice(0, maxTitleWidth), maxTitleWidth);
    const urlLines = wrap(row.url, maxUrlWidth).map((line) => padRight(line, maxUrlWidth));
    const lineCount = Math.max(1, urlLines.length);
    const output: string[] = [];

    for (let i = 0; i < lineCount; i += 1) {
      const numberCell = i === 0 ? padRight(row.number, numberWidth) : padRight("", numberWidth);
      const titleCell = i === 0 ? titleLine : padRight("", maxTitleWidth);
      const urlCell = urlLines[i] || padRight("", maxUrlWidth);
      output.push(`| ${numberCell} | ${titleCell} | ${urlCell} |`);
    }

    if (rowIndex < rows.length - 1) {
      output.push(border);
    }

    return output;
  });

  return [border, header, border, ...body, border].join("\n");
}
