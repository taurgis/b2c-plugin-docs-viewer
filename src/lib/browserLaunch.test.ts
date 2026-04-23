import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { browserLaunchEnv, buildChromiumLaunchOptions } from "./browserLaunch";

const ENV_KEYS = [
  browserLaunchEnv.executablePath,
  browserLaunchEnv.channel,
  browserLaunchEnv.args,
] as const;

function snapshotEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) snap[key] = process.env[key];
  return snap;
}

function restoreEnv(snap: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    const val = snap[key];
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
}

describe("buildChromiumLaunchOptions", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = snapshotEnv();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    restoreEnv(saved);
  });

  it("defaults to headless and no overrides", () => {
    expect(buildChromiumLaunchOptions()).toEqual({ headless: true });
  });

  it("respects headed option", () => {
    expect(buildChromiumLaunchOptions({ headed: true })).toEqual({ headless: false });
  });

  it("applies executablePath when env var is set", () => {
    process.env[browserLaunchEnv.executablePath] = "/usr/bin/chromium";
    expect(buildChromiumLaunchOptions()).toEqual({
      headless: true,
      executablePath: "/usr/bin/chromium",
    });
  });

  it("applies channel when env var is set and executablePath is not", () => {
    process.env[browserLaunchEnv.channel] = "chrome";
    expect(buildChromiumLaunchOptions()).toEqual({
      headless: true,
      channel: "chrome",
    });
  });

  it("ignores channel when executablePath is also set", () => {
    process.env[browserLaunchEnv.executablePath] = "/opt/chrome";
    process.env[browserLaunchEnv.channel] = "chrome";
    expect(buildChromiumLaunchOptions()).toEqual({
      headless: true,
      executablePath: "/opt/chrome",
    });
  });

  it("parses JSON array args", () => {
    process.env[browserLaunchEnv.args] = '["--no-sandbox", "--disable-dev-shm-usage"]';
    expect(buildChromiumLaunchOptions()).toEqual({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  });

  it("parses whitespace-delimited args as fallback", () => {
    process.env[browserLaunchEnv.args] = "--no-sandbox  --disable-gpu";
    expect(buildChromiumLaunchOptions()).toEqual({
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });
  });

  it("ignores empty args env var", () => {
    process.env[browserLaunchEnv.args] = "   ";
    expect(buildChromiumLaunchOptions()).toEqual({ headless: true });
  });

  it("ignores non-string-array JSON and falls back to whitespace split", () => {
    process.env[browserLaunchEnv.args] = '{"foo":"bar"}';
    // JSON.parse succeeds but isn't a string[]; falls through to whitespace split of the raw value.
    const opts = buildChromiumLaunchOptions();
    expect(opts.headless).toBe(true);
    expect(Array.isArray(opts.args)).toBe(true);
  });
});
