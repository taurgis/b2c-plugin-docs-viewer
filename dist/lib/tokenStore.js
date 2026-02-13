"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTokenValid = isTokenValid;
exports.decodeJwtPayload = decodeJwtPayload;
exports.getTokenExpiryMs = getTokenExpiryMs;
exports.applyTokenExpiry = applyTokenExpiry;
exports.loadToken = loadToken;
exports.storeToken = storeToken;
const SERVICE_NAME = "b2c-help-search";
const ACCOUNT_NAME = "coveo-token";
const DEFAULT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_EXPIRY_SKEW_MS = 2 * 60 * 1000;
let cachedKeytar;
async function getKeytar() {
    if (cachedKeytar !== undefined) {
        return cachedKeytar;
    }
    try {
        const module = await Promise.resolve().then(() => __importStar(require("keytar")));
        const resolved = (module.default ?? module);
        if (typeof resolved.getPassword === "function" &&
            typeof resolved.setPassword === "function") {
            cachedKeytar = resolved;
        }
        else {
            cachedKeytar = null;
        }
    }
    catch {
        cachedKeytar = null;
    }
    return cachedKeytar;
}
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
    const keytar = await getKeytar();
    if (!keytar)
        return null;
    const raw = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
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
    const keytar = await getKeytar();
    if (!keytar)
        return;
    const normalized = applyTokenExpiry(tokenInfo);
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, JSON.stringify(normalized));
}
