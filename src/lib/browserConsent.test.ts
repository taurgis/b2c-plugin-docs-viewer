import type { Page } from "playwright";
import { describe, expect, it, vi } from "vitest";
import { acceptOneTrust } from "./browserConsent";

type MockLocator = {
  waitFor: ReturnType<typeof vi.fn>;
  click: ReturnType<typeof vi.fn>;
};

function buildPageWithLocators(locators: Record<string, MockLocator>): Page {
  return {
    locator: vi.fn((selector: string) => ({
      first: () => {
        const locator = locators[selector];
        if (!locator) {
          throw new Error(`No mock locator for selector: ${selector}`);
        }
        return locator;
      },
    })),
  } as unknown as Page;
}

describe("acceptOneTrust", () => {
  it("clicks the first selector that becomes visible and waits briefly for dismissal", async () => {
    const primary: MockLocator = {
      waitFor: vi
        .fn()
        .mockImplementation(({ state }: { state: "visible" | "hidden" }) =>
          state === "visible" ? Promise.resolve() : Promise.resolve()
        ),
      click: vi.fn().mockResolvedValue(undefined),
    };

    const hiddenOther: MockLocator = {
      waitFor: vi.fn().mockRejectedValue(new Error("not visible")),
      click: vi.fn().mockResolvedValue(undefined),
    };

    const page = buildPageWithLocators({
      "#onetrust-accept-btn-handler": primary,
      "button#onetrust-accept-btn-handler": hiddenOther,
      'button:has-text("Accept All")': hiddenOther,
      'button:has-text("Accept all")': hiddenOther,
      'button:has-text("I Agree")': hiddenOther,
    });

    await acceptOneTrust(page, 2_000);

    expect(primary.click).toHaveBeenCalledTimes(1);
    expect(primary.waitFor).toHaveBeenCalledWith({ state: "visible", timeout: 2000 });
    expect(primary.waitFor).toHaveBeenCalledWith({ state: "hidden", timeout: 1500 });
  });

  it("returns quietly when no consent selector appears", async () => {
    const neverVisible = (): MockLocator => ({
      waitFor: vi.fn().mockRejectedValue(new Error("missing")),
      click: vi.fn().mockResolvedValue(undefined),
    });

    const one = neverVisible();
    const two = neverVisible();
    const three = neverVisible();
    const four = neverVisible();
    const five = neverVisible();

    const page = buildPageWithLocators({
      "#onetrust-accept-btn-handler": one,
      "button#onetrust-accept-btn-handler": two,
      'button:has-text("Accept All")': three,
      'button:has-text("Accept all")': four,
      'button:has-text("I Agree")': five,
    });

    await expect(acceptOneTrust(page, 900)).resolves.toBeUndefined();

    expect(one.click).not.toHaveBeenCalled();
    expect(two.click).not.toHaveBeenCalled();
    expect(three.click).not.toHaveBeenCalled();
    expect(four.click).not.toHaveBeenCalled();
    expect(five.click).not.toHaveBeenCalled();
  });
});
