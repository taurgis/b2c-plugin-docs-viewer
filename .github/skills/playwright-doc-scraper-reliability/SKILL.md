---
name: playwright-doc-scraper-reliability
description: 'Improve Playwright scraping robustness for docs extraction with resilient waits, fallback strategy, and traceable debugging. Use when scraper behavior is flaky, slow, or failing on site structure changes.'
---

# Playwright Doc Scraper Reliability

Use this skill for changes in `src/lib/helpScraper.ts` and `src/lib/helpSearch.ts` that rely on Playwright page behavior.

## When to use

- Timeout or flaky extraction issues.
- Selector drift from Help or Developer docs pages.
- Need to add fallback extraction without masking root causes.
- Need better debug instrumentation for transient failures.

## Reliability rules

1. Wait for meaningful readiness signals, not arbitrary sleeps.
2. Prefer resilient selection strategies and avoid brittle chains.
3. Keep fallback logic explicit and bounded.
4. Log recoverable failures in debug mode.
5. Preserve deterministic final error conditions.

## Practical strategy

1. Start with `domcontentloaded`, then conditionally wait for the specific content path.
2. Keep cookie/consent handling reusable and isolated.
3. Layer extraction attempts in descending quality.
4. Validate extracted content length/shape before accepting output.
5. If all extraction paths fail, return explicit failures with context.

## Repo guidance

- Share browser interaction helpers in small modules (example: `src/lib/browserConsent.ts`).
- Keep markdown conversion pure and separately testable (example: `src/lib/helpScraperMarkdown.ts`).
- Preserve regression stability with `npm run regression:check` before finalizing scraper changes.

## Debug workflow

1. Reproduce with command `--debug` and `--no-cache`.
2. Capture what failed and which fallback path was used.
3. Add/adjust targeted tests for the specific break mode.
4. Run unit tests and strict regression suite.

## Checklist

- [ ] New waits are purposeful and bounded.
- [ ] Debug logs are informative but not noisy.
- [ ] Extraction fallback order is clear in code.
- [ ] Regression baseline remains stable unless change is intentional.

## References

- https://playwright.dev/docs/locators
- https://playwright.dev/docs/actionability
- https://playwright.dev/docs/network
- https://playwright.dev/docs/debug
- https://playwright.dev/docs/trace-viewer
