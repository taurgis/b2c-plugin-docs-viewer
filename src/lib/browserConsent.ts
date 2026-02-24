import type { Page } from "playwright";
import { firstFulfilled } from "./promiseUtils";

const CONSENT_SELECTORS = [
  "#onetrust-accept-btn-handler",
  "button#onetrust-accept-btn-handler",
  'button:has-text("Accept All")',
  'button:has-text("Accept all")',
  'button:has-text("I Agree")',
];

const CONSENT_PROBE_TIMEOUT_MS = 2500;
const CONSENT_CLICK_TIMEOUT_MS = 3000;
const CONSENT_POST_CLICK_TIMEOUT_MS = 1500;

export async function acceptOneTrust(page: Page, timeoutMs: number): Promise<void> {
  const probeTimeout = Math.max(500, Math.min(timeoutMs, CONSENT_PROBE_TIMEOUT_MS));
  const clickTimeout = Math.max(500, Math.min(timeoutMs, CONSENT_CLICK_TIMEOUT_MS));
  const postClickTimeout = Math.max(500, Math.min(timeoutMs, CONSENT_POST_CLICK_TIMEOUT_MS));

  const button = await firstFulfilled(
    CONSENT_SELECTORS.map(async (selector) => {
      const candidate = page.locator(selector).first();
      await candidate.waitFor({ state: "visible", timeout: probeTimeout });
      return candidate;
    })
  );

  if (!button) return;

  await button.click({ timeout: clickTimeout }).catch(() => {});

  // Keep consent handling bounded; content readiness is validated by scraper selectors.
  await button.waitFor({ state: "hidden", timeout: postClickTimeout }).catch(() => {});
}
