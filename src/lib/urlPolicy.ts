import {
  InvalidUrlError,
  UnsupportedHostError,
  UnsupportedProtocolError,
} from "../apiErrors";

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
    throw new InvalidUrlError();
  }

  if (parsed.protocol !== "https:") {
    throw new UnsupportedProtocolError();
  }

  if (!isAllowedDocHost(parsed.hostname)) {
    throw new UnsupportedHostError();
  }

  return parsed.toString();
}
