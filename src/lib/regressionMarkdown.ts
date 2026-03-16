const SALESFORCE_DOCS_IMAGE_HOST = "sf-zdocs-cdn-prod.zoominsoftware.com";
const SALESFORCE_DOCS_IMAGE_VERSION = "__asset_version__";
const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hasImagePathSegment(segments: string[]): boolean {
  return segments.includes("images");
}

export function normalizeRegressionAssetUrl(rawUrl: string): string {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (url.hostname !== SALESFORCE_DOCS_IMAGE_HOST) return rawUrl;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 3) return rawUrl;
  if (!hasImagePathSegment(segments)) return rawUrl;
  if (!UUID_SEGMENT.test(segments[1])) return rawUrl;

  const normalizedSegments = [...segments];
  normalizedSegments[1] = SALESFORCE_DOCS_IMAGE_VERSION;

  return `${url.protocol}//${url.host}/${normalizedSegments.join("/")}${url.search}${url.hash}`;
}

export function normalizeRegressionMarkdown(markdown: string): string {
  return markdown.replace(
    /https:\/\/sf-zdocs-cdn-prod\.zoominsoftware\.com\/[^\s)]+/g,
    (rawUrl) => normalizeRegressionAssetUrl(rawUrl)
  );
}