import type { Page } from "playwright";

export async function acceptOneTrust(page: Page, timeoutMs: number): Promise<void> {
  const selectors = [
    "#onetrust-accept-btn-handler",
    "button#onetrust-accept-btn-handler",
    'button:has-text("Accept All")',
    'button:has-text("Accept all")',
    'button:has-text("I Agree")',
  ];

  for (const selector of selectors) {
    try {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
        await button.click({ timeout: 3000 });
        await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {});
        return;
      }
    } catch {
      // Ignore and keep probing other selector variants.
    }
  }
}
