import type { LaunchOptions } from "playwright";

const BROWSER_EXECUTABLE_PATH_ENV = "B2C_DOCS_BROWSER_EXECUTABLE_PATH";
const BROWSER_CHANNEL_ENV = "B2C_DOCS_BROWSER_CHANNEL";
const BROWSER_ARGS_ENV = "B2C_DOCS_BROWSER_ARGS";

export const browserLaunchEnv = {
  executablePath: BROWSER_EXECUTABLE_PATH_ENV,
  channel: BROWSER_CHANNEL_ENV,
  args: BROWSER_ARGS_ENV,
} as const;

function parseBrowserArgs(rawValue: string | undefined): string[] | undefined {
  const value = rawValue?.trim();
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      const args = (parsed as string[]).map((item) => item.trim()).filter(Boolean);
      return args.length > 0 ? args : undefined;
    }
  } catch {
    // Fall through to whitespace-delimited parsing for shell-friendly overrides.
  }
  const args = value.split(/\s+/).map((item) => item.trim()).filter(Boolean);
  return args.length > 0 ? args : undefined;
}

export function buildChromiumLaunchOptions(options?: { headed?: boolean }): LaunchOptions {
  const headed = options?.headed ?? false;
  const launchOptions: LaunchOptions = {
    headless: !headed,
  };

  const executablePath = process.env[BROWSER_EXECUTABLE_PATH_ENV]?.trim();
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  } else {
    const channel = process.env[BROWSER_CHANNEL_ENV]?.trim();
    if (channel) {
      launchOptions.channel = channel;
    }
  }

  const args = parseBrowserArgs(process.env[BROWSER_ARGS_ENV]);
  if (args) {
    launchOptions.args = args;
  }

  return launchOptions;
}
