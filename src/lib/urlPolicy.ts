const ALLOWED_DOC_HOSTS = new Set(["help.salesforce.com", "developer.salesforce.com"]);

export function getAllowedDocHosts(): string[] {
  return Array.from(ALLOWED_DOC_HOSTS);
}

export function isAllowedDocHost(hostname: string): boolean {
  return ALLOWED_DOC_HOSTS.has(hostname.toLowerCase());
}

export function normalizeAndValidateDocUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL. Provide a valid Help or Developer docs URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Unsupported URL protocol. Use https URLs only.");
  }

  if (!isAllowedDocHost(parsed.hostname)) {
    throw new Error("Unsupported host. Only help.salesforce.com and developer.salesforce.com are allowed.");
  }

  return parsed.toString();
}
