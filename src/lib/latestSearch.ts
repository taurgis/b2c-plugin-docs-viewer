import { buildCachePath, readCache, writeCache } from "./cache";

type LatestSearchResult = {
  url: string;
  title: string | null;
};

type LatestSearchPayload = {
  query: string;
  results: LatestSearchResult[];
};

const LATEST_SEARCH_KEY = "__latest__";

export async function storeLatestSearch(
  query: string,
  results: LatestSearchResult[]
): Promise<void> {
  const cachePath = buildCachePath("search", LATEST_SEARCH_KEY);
  await writeCache<LatestSearchPayload>(cachePath, { query, results });
}

export async function loadLatestSearch(): Promise<LatestSearchPayload | null> {
  const cachePath = buildCachePath("search", LATEST_SEARCH_KEY);
  return readCache<LatestSearchPayload>(cachePath);
}
