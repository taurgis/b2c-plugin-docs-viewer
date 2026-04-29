import { type ScraperSession, createScraperSession, getDetailSourceType, getHelpDetails } from "./lib/helpScraper";
import { normalizeHelpDocContentUrl, searchHelp } from "./lib/helpSearch";
import { normalizeAndValidateDocUrl } from "./lib/urlPolicy";
import { toReadHelpDocError, toSearchHelpDocsError } from "./apiErrors";

export type HelpDocSource = "help" | "developer";

export type SearchHelpDocsOptions = {
  query: string;
  language?: string;
  limit?: number;
  timeoutMs?: number;
  cache?: boolean;
  headed?: boolean;
  debug?: boolean;
};

export type SearchHelpDocsResult = {
  id: number;
  rank: number;
  title: string | null;
  url: string;
  source: HelpDocSource;
  hostname: string;
  label: string;
};

export type SearchHelpDocsResponse = {
  query: string;
  language: string;
  count: number;
  results: SearchHelpDocsResult[];
};

export type HelpDocReference = string | { url: string };

export type ResolveHelpDocResult = {
  url: string;
  source: HelpDocSource;
  hostname: string;
};

export type ReadHelpDocOptions = {
  timeoutMs?: number;
  waitMs?: number;
  cache?: boolean;
  headed?: boolean;
  debug?: boolean;
  includeRawHtml?: boolean;
  session?: ScraperSession;
};

export type ReadHelpDocResult = ResolveHelpDocResult & {
  title: string | null;
  markdown: string;
  rawHtml?: string;
};

export type HelpDocsSession = ScraperSession;

function normalizeReference(reference: HelpDocReference): string {
  if (typeof reference === "string") {
    return reference.trim();
  }

  return typeof reference?.url === "string" ? reference.url.trim() : "";
}

function getSourceMetadata(url: string): ResolveHelpDocResult {
  const parsed = new URL(url);
  return {
    url,
    source: getDetailSourceType(url),
    hostname: parsed.hostname,
  };
}

export async function createHelpDocsSession(options?: { headed?: boolean }): Promise<HelpDocsSession> {
  return createScraperSession(options);
}

export function resolveHelpDoc(reference: HelpDocReference): ResolveHelpDocResult {
  try {
    const normalizedUrl = normalizeAndValidateDocUrl(normalizeReference(reference));
    return getSourceMetadata(normalizedUrl);
  } catch (error) {
    throw toReadHelpDocError(error);
  }
}

export async function searchHelpDocs(
  options: SearchHelpDocsOptions
): Promise<SearchHelpDocsResponse> {
  const language = options.language || "en_US";

  try {
    const results = await searchHelp({
      query: options.query,
      language,
      limit: options.limit,
      timeoutMs: options.timeoutMs,
      useCache: options.cache,
      headed: options.headed,
      debug: options.debug,
    });

    const normalizedResults = results.map((result, index) => {
      const normalizedUrl = normalizeHelpDocContentUrl(result.url);
      const metadata = getSourceMetadata(normalizedUrl);
      return {
        id: index + 1,
        rank: index + 1,
        title: result.title,
        url: metadata.url,
        source: metadata.source,
        hostname: metadata.hostname,
        label: result.title || metadata.url,
      };
    });

    return {
      query: options.query,
      language,
      count: normalizedResults.length,
      results: normalizedResults,
    };
  } catch (error) {
    throw toSearchHelpDocsError(error);
  }
}

export async function readHelpDoc(
  reference: HelpDocReference,
  options?: ReadHelpDocOptions
): Promise<ReadHelpDocResult> {
  const resolved = resolveHelpDoc(reference);

  try {
    const detail = await getHelpDetails({
      url: resolved.url,
      timeoutMs: options?.timeoutMs,
      waitMs: options?.waitMs,
      headed: options?.headed,
      useCache: options?.cache,
      includeRawHtml: options?.includeRawHtml,
      debug: options?.debug,
      session: options?.session,
    });

    return {
      ...resolved,
      title: detail.title,
      markdown: detail.markdown,
      rawHtml: detail.rawHtml,
    };
  } catch (error) {
    throw toReadHelpDocError(error);
  }
}