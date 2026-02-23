import { isAllowedDocHost } from "./urlPolicy";

const SKIP_URLS = new Set([
  "https://help.salesforce.com/",
  "https://help.salesforce.com/s",
  "https://help.salesforce.com/s/",
  "https://help.salesforce.com/s/login",
]);

type CoveoResultRaw = {
  clickuri?: string;
  uri?: string;
  sourceurl?: string;
  document_uri?: string;
  sfurl?: string;
  sfdcurl?: string;
  title?: string;
};

type CoveoResult = {
  clickUri?: string;
  uri?: string;
  title?: string;
  raw?: CoveoResultRaw;
};

type CoveoResponseData = {
  results?: CoveoResult[];
};

export type SearchResult = {
  url: string;
  title: string | null;
};

export function normalizeHelpDocContentUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (url.hostname !== "help.salesforce.com") return rawUrl;
  if (!url.pathname.toLowerCase().startsWith("/help_doccontent")) return rawUrl;

  const id = url.searchParams.get("id");
  if (!id) return rawUrl;

  const normalizedId = id.endsWith(".htm") ? id : `${id}.htm`;
  const articleUrl = new URL("https://help.salesforce.com/s/articleView");
  articleUrl.searchParams.set("id", normalizedId);
  articleUrl.searchParams.set("type", "5");

  const release = url.searchParams.get("release");
  if (release) articleUrl.searchParams.set("release", release);

  const language = url.searchParams.get("language");
  if (language) articleUrl.searchParams.set("language", language);

  return articleUrl.toString();
}

export function extractResults(data: CoveoResponseData | null | undefined, options: { limit: number }): SearchResult[] {
  const results = Array.isArray(data?.results) ? data.results : [];
  const items: SearchResult[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    const raw = result?.raw || {};
    let url =
      result?.clickUri ||
      result?.uri ||
      raw.clickuri ||
      raw.uri ||
      raw.sourceurl ||
      raw.document_uri ||
      raw.sfurl ||
      raw.sfdcurl ||
      null;

    if (!url) continue;
    url = normalizeHelpDocContentUrl(url);

    try {
      const host = new URL(url).hostname;
      if (!isAllowedDocHost(host)) continue;
    } catch {
      continue;
    }

    if (SKIP_URLS.has(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    items.push({
      url,
      title: result?.title || raw.title || null,
    });

    if (items.length >= options.limit) break;
  }

  return items;
}
