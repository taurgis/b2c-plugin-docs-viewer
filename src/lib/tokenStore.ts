const SERVICE_NAME = "b2c-help-search";
const ACCOUNT_NAME = "coveo-token";
const DEFAULT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_EXPIRY_SKEW_MS = 2 * 60 * 1000;

type KeytarLike = {
  getPassword: (service: string, account: string) => Promise<string | null>;
  setPassword: (service: string, account: string, password: string) => Promise<void>;
};

let cachedKeytar: KeytarLike | null | undefined;

async function getKeytar(): Promise<KeytarLike | null> {
  if (cachedKeytar !== undefined) {
    return cachedKeytar;
  }

  try {
    const module = await import("keytar");
    const resolved = (module.default ?? module) as unknown as Partial<KeytarLike>;
    if (
      typeof resolved.getPassword === "function" &&
      typeof resolved.setPassword === "function"
    ) {
      cachedKeytar = resolved as KeytarLike;
    } else {
      cachedKeytar = null;
    }
  } catch {
    cachedKeytar = null;
  }

  return cachedKeytar;
}

export type TokenInfo = {
  accessToken: string;
  organizationId: string;
  searchHub: string;
  endpointBase: string;
  clientUri: string;
  filterer: string | null;
  expiresAtMs: number;
};

export function isTokenValid(expiresAtMs: number | null | undefined): boolean {
  if (!Number.isFinite(expiresAtMs)) return false;
  return Date.now() + TOKEN_EXPIRY_SKEW_MS < (expiresAtMs as number);
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getTokenExpiryMs(accessToken: string): number | null {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return null;
  const rawExp =
    (payload.exp as number | undefined) ??
    (payload.expires_at as number | undefined) ??
    (payload.expiresAt as number | undefined) ??
    null;
  if (rawExp === null || rawExp === undefined) return null;
  const expNumber = Number(rawExp);
  if (!Number.isFinite(expNumber)) return null;
  return expNumber > 1_000_000_000_000 ? expNumber : expNumber * 1000;
}

export function applyTokenExpiry(tokenInfo: TokenInfo): TokenInfo {
  if (!tokenInfo || !tokenInfo.accessToken) return tokenInfo;
  let expiresAtMs = tokenInfo.expiresAtMs || getTokenExpiryMs(tokenInfo.accessToken);
  if (!expiresAtMs) {
    expiresAtMs = Date.now() + DEFAULT_TOKEN_TTL_MS;
  }
  return { ...tokenInfo, expiresAtMs };
}

export async function loadToken(): Promise<TokenInfo | null> {
  const keytar = await getKeytar();
  if (!keytar) return null;

  const raw = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TokenInfo>;
    if (!parsed.accessToken) return null;
    const normalized: TokenInfo = {
      accessToken: parsed.accessToken,
      organizationId: parsed.organizationId || "",
      searchHub: parsed.searchHub || "",
      endpointBase: parsed.endpointBase || "",
      clientUri: parsed.clientUri || "",
      filterer: parsed.filterer ?? null,
      expiresAtMs: parsed.expiresAtMs || 0,
    };
    return applyTokenExpiry(normalized);
  } catch {
    return null;
  }
}

export async function storeToken(tokenInfo: TokenInfo): Promise<void> {
  const keytar = await getKeytar();
  if (!keytar) return;

  const normalized = applyTokenExpiry(tokenInfo);
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, JSON.stringify(normalized));
}
