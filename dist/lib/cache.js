"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCacheRoot = getCacheRoot;
exports.buildCachePath = buildCachePath;
exports.readCache = readCache;
exports.writeCache = writeCache;
exports.getCacheTtlMs = getCacheTtlMs;
const crypto_1 = __importDefault(require("crypto"));
const promises_1 = __importDefault(require("fs/promises"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const CACHE_ROOT_DIR = path_1.default.join(os_1.default.tmpdir(), "b2c-help-docs-cache");
const CACHE_TTL_MS = 5 * 24 * 60 * 60 * 1000;
function hashKey(value) {
    return crypto_1.default.createHash("sha256").update(value).digest("hex");
}
function getCacheRoot() {
    return CACHE_ROOT_DIR;
}
function buildCachePath(namespace, key) {
    return path_1.default.join(CACHE_ROOT_DIR, namespace, `${hashKey(key)}.json`);
}
async function readCache(filePath, ttlMs = CACHE_TTL_MS) {
    try {
        const raw = await promises_1.default.readFile(filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.fetchedAtMs !== "number") {
            return null;
        }
        const ageMs = Date.now() - parsed.fetchedAtMs;
        if (ageMs < 0 || ageMs > ttlMs) {
            return null;
        }
        return parsed.payload;
    }
    catch {
        return null;
    }
}
async function writeCache(filePath, payload) {
    const dir = path_1.default.dirname(filePath);
    await promises_1.default.mkdir(dir, { recursive: true });
    const record = {
        fetchedAtMs: Date.now(),
        payload,
    };
    const output = JSON.stringify(record, null, 2) + "\n";
    await promises_1.default.writeFile(filePath, output, "utf8");
}
function getCacheTtlMs() {
    return CACHE_TTL_MS;
}
