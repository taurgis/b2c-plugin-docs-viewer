"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTokenValid = isTokenValid;
exports.decodeJwtPayload = decodeJwtPayload;
exports.getTokenExpiryMs = getTokenExpiryMs;
exports.applyTokenExpiry = applyTokenExpiry;
exports.loadToken = loadToken;
exports.storeToken = storeToken;
const keytar_1 = __importDefault(require("keytar"));
const SERVICE_NAME = "b2c-help-search";
const ACCOUNT_NAME = "coveo-token";
const DEFAULT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_EXPIRY_SKEW_MS = 2 * 60 * 1000;
function isTokenValid(expiresAtMs) {
    if (!Number.isFinite(expiresAtMs))
        return false;
    return Date.now() + TOKEN_EXPIRY_SKEW_MS < expiresAtMs;
}
function decodeJwtPayload(token) {
    const parts = token.split(".");
    if (parts.length < 2)
        return null;
    try {
        const payload = Buffer.from(parts[1], "base64url").toString("utf8");
        return JSON.parse(payload);
    }
    catch {
        return null;
    }
}
function getTokenExpiryMs(accessToken) {
    const payload = decodeJwtPayload(accessToken);
    if (!payload)
        return null;
    const rawExp = payload.exp ??
        payload.expires_at ??
        payload.expiresAt ??
        null;
    if (rawExp === null || rawExp === undefined)
        return null;
    const expNumber = Number(rawExp);
    if (!Number.isFinite(expNumber))
        return null;
    return expNumber > 1000000000000 ? expNumber : expNumber * 1000;
}
function applyTokenExpiry(tokenInfo) {
    if (!tokenInfo || !tokenInfo.accessToken)
        return tokenInfo;
    let expiresAtMs = tokenInfo.expiresAtMs || getTokenExpiryMs(tokenInfo.accessToken);
    if (!expiresAtMs) {
        expiresAtMs = Date.now() + DEFAULT_TOKEN_TTL_MS;
    }
    return { ...tokenInfo, expiresAtMs };
}
async function loadToken() {
    const raw = await keytar_1.default.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed.accessToken)
            return null;
        const normalized = {
            accessToken: parsed.accessToken,
            organizationId: parsed.organizationId || "",
            searchHub: parsed.searchHub || "",
            endpointBase: parsed.endpointBase || "",
            clientUri: parsed.clientUri || "",
            filterer: parsed.filterer ?? null,
            expiresAtMs: parsed.expiresAtMs || 0,
        };
        return applyTokenExpiry(normalized);
    }
    catch {
        return null;
    }
}
async function storeToken(tokenInfo) {
    const normalized = applyTokenExpiry(tokenInfo);
    await keytar_1.default.setPassword(SERVICE_NAME, ACCOUNT_NAME, JSON.stringify(normalized));
}
