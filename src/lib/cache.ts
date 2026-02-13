import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";

const CACHE_ROOT_DIR = path.join(os.tmpdir(), "b2c-help-docs-cache");
const CACHE_TTL_MS = 5 * 24 * 60 * 60 * 1000;

type CacheRecord<T> = {
  fetchedAtMs: number;
  payload: T;
};

function hashKey(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function getCacheRoot(): string {
  return CACHE_ROOT_DIR;
}

export function buildCachePath(namespace: "search" | "detail", key: string): string {
  return path.join(CACHE_ROOT_DIR, namespace, `${hashKey(key)}.json`);
}

export async function readCache<T>(filePath: string, ttlMs = CACHE_TTL_MS): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as CacheRecord<T> | null;
    if (!parsed || typeof parsed.fetchedAtMs !== "number") {
      return null;
    }
    const ageMs = Date.now() - parsed.fetchedAtMs;
    if (ageMs < 0 || ageMs > ttlMs) {
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

export async function writeCache<T>(filePath: string, payload: T): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const record: CacheRecord<T> = {
    fetchedAtMs: Date.now(),
    payload,
  };
  const output = JSON.stringify(record, null, 2) + "\n";
  await fs.writeFile(filePath, output, "utf8");
}

export function getCacheTtlMs(): number {
  return CACHE_TTL_MS;
}
