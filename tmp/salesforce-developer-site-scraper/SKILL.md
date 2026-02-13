---
name: salesforce-developer-site-scraper
description: 'Scrape Salesforce Developer documentation into clean Markdown using headless Chromium, Readability, and the docs content API fallback. Handles Shadow DOM pages (Commerce Cloud API references), OneTrust cookie banners, and async content. Use when content is async or blocked by cookie banners.'
license: Forward Proprietary
compatibility: VS Code 1.x+, Node.js 18+
---

# Salesforce Developer Site Scraper

Use this skill to capture Salesforce Developer documentation pages as clean Markdown even when content loads asynchronously, lives inside Shadow DOM custom elements, or is blocked by OneTrust cookie banners.

## When to Use This Skill

- A Salesforce Developer doc page renders key content after async requests.
- A OneTrust cookie banner hides content until consent is accepted.
- You need a readable Markdown snapshot for Apex, LWC, or platform docs.
- You need to capture Commerce Cloud API reference pages that render inside Shadow DOM.
- NOT for: high-volume crawling or scraping behind access restrictions.

## Supported URL Types

| URL Pattern | Example | Extraction Method |
| --- | --- | --- |
| Atlas docs (`/docs/atlas.en-us.*`) | `apex_intro.htm` | Docs content API + Readability |
| Commerce Cloud guides (`/docs/commerce/.../guide/`) | `quick-start.html`, `cdn-zones-logpush.html` | Docs content API + Readability |
| Commerce Cloud API references (`/docs/commerce/.../references/`) | `shopper-customers?meta=getCustomer` | Shadow DOM extraction |

> **Legacy domain**: `documentation.b2c.commercecloud.salesforce.com` was retired on July 15, 2023. URLs from that domain now redirect to `developer.salesforce.com` (API/developer docs) or `help.salesforce.com` (admin/merchandiser docs). Always use the `developer.salesforce.com/docs/commerce/…` URLs directly. See [B2C Commerce Infocenter Retirement](https://help.salesforce.com/s/articleView?language=en_US&id=commerce.rn_infocenter_retirement.htm&type=5).

## Prerequisites

- Node.js 18+
- npm dependencies:

```bash
npm install playwright @mozilla/readability jsdom turndown
npx playwright install chromium
```

### 2) Run the script

```bash
node skills/salesforce-developer-site-scraper/scripts/scrape-to-markdown.js \
  --url "https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_intro.htm" \
  --out "./artifacts/online-research/apex_intro.md" \
  --consent-selector "#onetrust-accept-btn-handler" \
  --wait 2000
```

## Script Options

| Option | Required | Description |
| --- | --- | --- |
| `--url` | Yes | Target URL to fetch and extract. |
| `--out` | Yes | Output Markdown file path. |
| `--consent-selector` | No | CSS or text selector for a cookie banner accept button. |
| `--wait` | No | Milliseconds to wait after navigation or consent click. |
| `--content-selector` | No | Extract only this element instead of Readability parsing. |
| `--remove-selectors` | No | Comma-separated selectors to remove before extraction. |
| `--cookie` | No | Consent/session cookie, e.g. `name=value;domain=example.com;path=/`. |
| `--storage-state` | No | Playwright storage state JSON file to reuse consent/session. |
| `--timeout` | No | Navigation timeout in ms (default 45000). |
| `--no-default-removals` | No | Disable default cookie/consent element removals. |
| `--retries` | No | Number of retry attempts after a failure (default 2). |
| `--ignore-cache` | No | Skip the failure index and force a fresh attempt. |
| `--headed` | No | Launch browser in visible (non-headless) mode, useful for debugging. |

## Related Skill: Salesforce Help Searching

Use the `salesforce-help-searching` skill to discover relevant Help or
Developer doc URLs before scraping:

```bash
node skills/salesforce-help-searching/scripts/search-help.js \
  --query "b2c commerce ocapi jobs" \
  --limit 10 \
  --json
```

## Exit Codes

| Code | Meaning |
| --- | --- |
| `0` | Success — content extracted and saved. |
| `1` | Failure — all retry attempts exhausted, URL recorded in failure index. |
| `2` | Skipped — URL found in failure index from a previous run. Use `--ignore-cache` to retry. |

## Content Extraction Pipeline

The script tries multiple extraction strategies in order, using the first that produces sufficient content (>100 characters):

1. **`--content-selector`** — if provided, extract only that element.
2. **`main, article`** — default DOM element extraction.
3. **Readability** — Mozilla's Readability algorithm on full page HTML.
4. **Docs content API** — intercepts `/docs/get_document_content/` XHR responses for atlas and commerce guide pages.
5. **Shadow DOM extraction** — for Commerce Cloud API reference pages that render inside nested shadow roots (`doc-amf-reference`, `doc-content-layout`, etc.), recursively walks shadow DOM trees in-browser to collect HTML.

After extraction, the HTML is converted to Markdown via Turndown.

## Compliance Notes

- Respect robots.txt and site terms before scraping.
- Use consent cookies or storage state only when you have permission.
- Avoid collecting personal data unless you have a legal basis.

## Examples

### Example: Reuse a consent state

```bash
node skills/salesforce-developer-site-scraper/scripts/scrape-to-markdown.js \
  --url "https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_intro.htm" \
  --out "./artifacts/online-research/apex_intro.md" \
  --storage-state "./artifacts/online-research/consent-state.json"
```

### Example: Commerce Cloud guide page

```bash
node skills/salesforce-developer-site-scraper/scripts/scrape-to-markdown.js \
  --url "https://developer.salesforce.com/docs/commerce/commerce-api/guide/cdn-zones-logpush.html" \
  --out "./artifacts/online-research/cdn_logpush.md" \
  --wait 3000
```

### Example: Commerce Cloud API reference (Shadow DOM)

```bash
node skills/salesforce-developer-site-scraper/scripts/scrape-to-markdown.js \
  --url "https://developer.salesforce.com/docs/commerce/commerce-api/references/shopper-customers?meta=getCustomer" \
  --out "./artifacts/online-research/scapi_shopper_customers.md" \
  --wait 5000
```

### Example: Extract a specific content container

```bash
node skills/salesforce-developer-site-scraper/scripts/scrape-to-markdown.js \
  --url "https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_intro.htm" \
  --out "./artifacts/online-research/apex_intro.md" \
  --content-selector "main article"
```

## Failure Index

When a scrape fails after all retries, the URL is recorded in a `.scrape-failures.json` file in the output directory. On subsequent runs, the script checks this index and skips known-bad URLs (exit code 2). This prevents wasting time and browser resources on URLs that are confirmed broken.

The failure index tracks: URL, failure reason, HTTP status, attempt count, timestamp, and scraper name. Both scraper scripts share the same index file format, so failures from either scraper are visible to both.

To force a retry on a previously-failed URL, use `--ignore-cache`. To clear all failures, delete the `.scrape-failures.json` file.

## Content Quality Validation

The script validates extracted content before writing the output file:

- **Minimum length** — content shorter than 100 characters is rejected.
- **Garbage detection** — footer-only content, language picker lists, and copyright-only pages are detected and rejected.
- **Error page detection** — pages containing "page not found" or similar patterns are rejected.
- **Redirect detection** — developer.salesforce.com silently redirects invalid doc paths to guide landing pages; the script detects this by comparing the requested URL path with the final URL path.
- **Docs API validation** — empty responses from the `/docs/get_document_content/` API (observed for non-existent docs) are treated as missing content.

## Troubleshooting

### Issue: Output is empty or too short

**Solution**: Add `--wait` or provide a `--content-selector` for the primary content node.

### Issue: Cookie banner blocks content

**Solution**: Provide `--consent-selector` (OneTrust) or reuse a `--storage-state` with consent already saved.

### Issue: Script exits with code 2 (SKIPPED)

**Solution**: The URL is in the failure index from a previous run. Use `--ignore-cache` to force a fresh attempt, or delete `.scrape-failures.json` to clear all recorded failures.

### Issue: "Garbage content" or "Error page detected"

**Solution**: The page likely doesn't contain the expected article. Verify the URL is correct and the article exists at that path. For developer docs, check if the URL slug matches the actual document path in the Salesforce docs navigation.

### Issue: Commerce Cloud API reference returns 0 chars

**Solution**: API reference pages render content inside Shadow DOM. Ensure you pass `--wait 5000` or higher to give the page time to fully render before shadow DOM extraction runs.

## Running Tests

```bash
node skills/salesforce-developer-site-scraper/scripts/test-scraper.js
```

The test suite covers: valid atlas pages, invalid pages, failure index behavior, Commerce Cloud guides, and SCAPI reference pages (Shadow DOM).

## References

- Playwright Docs: https://playwright.dev/docs/intro
- Playwright Cookies: https://playwright.dev/docs/api/class-browsercontext#browser-context-add-cookies
- Playwright Storage State: https://playwright.dev/docs/auth#reuse-authentication-state
- Readability (Mozilla): https://github.com/mozilla/readability
- DOMParser (MDN): https://developer.mozilla.org/en-US/docs/Web/API/DOMParser
- Robots Exclusion Protocol (RFC 9309): https://www.rfc-editor.org/rfc/rfc9309
- GDPR: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- ePrivacy Directive: https://eur-lex.europa.eu/eli/dir/2002/58/oj
