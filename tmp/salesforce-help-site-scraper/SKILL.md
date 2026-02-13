---
name: salesforce-help-site-scraper
description: 'Scrape Salesforce Help articles into clean Markdown with auto-consent, Lightning/Aura fallback, and error page detection. Use when you need an internal, readable snapshot of Help content for research or documentation support.'
license: Forward Proprietary
compatibility: VS Code 1.x+, Node.js 18+
---

# Salesforce Help Site Scraper

Use this skill to extract Salesforce Help article content into clean Markdown when pages render dynamically via Lightning/Aura or are blocked by consent banners. OneTrust cookies are auto-accepted.

## When to Use This Skill

- You need a readable Markdown snapshot of a Help article for internal research.
- OneTrust cookie banners block access to the main content.
- You want to remove headers, footers, or navigation chrome before extraction.
- You need to capture Knowledge articles (type=1) or documentation articles (type=5).
- NOT for: high-volume crawling, bypassing access controls, or republishing Salesforce content.

## Supported URL Types

| URL Pattern | Example | Notes |
| --- | --- | --- |
| Documentation article (`type=5`) | `?id=sf.flow.htm&type=5` | Standard Help documentation |
| Knowledge article (`type=1`) | `?id=000394720&type=1` | Knowledge base articles |
| B2C Commerce help | `?id=cc.b2c_roles_and_permissions.htm&type=5` | Commerce Cloud documentation |

> **Legacy domain**: `documentation.b2c.commercecloud.salesforce.com` was retired on July 15, 2023. URLs from that domain now redirect to `help.salesforce.com` (admin/merchandiser docs) or `developer.salesforce.com` (API/developer docs). Always use `help.salesforce.com/s/articleView?id=cc.…` URLs directly. See [B2C Commerce Infocenter Retirement](https://help.salesforce.com/s/articleView?language=en_US&id=commerce.rn_infocenter_retirement.htm&type=5).

## Prerequisites

- Node.js 18+
- npm dependencies:

```bash
npm install playwright @mozilla/readability jsdom turndown
npx playwright install chromium
```

## How to Use

### Basic Usage

OneTrust cookies are auto-accepted; `--consent-selector` is optional.

```bash
node skills/salesforce-help-site-scraper/scripts/scrape-help-to-markdown.js \
  --url "https://help.salesforce.com/s/articleView?id=sf.flow.htm&type=5" \
  --out "./artifacts/online-research/help_flow_overview.md" \
  --remove-selectors "header,footer,nav,aside" \
  --wait 2500
```

### Search Help Content

For keyword search across Help and Developer docs, use the dedicated
`salesforce-help-searching` skill. It returns normalized URLs you can then
scrape with this skill.

### Storage Location

All outputs and temporary browser data are stored under `./artifacts` in the
project root. The script sets `TMPDIR` to `./artifacts/tmp` and rejects `--out`
paths outside the `artifacts` folder.

### Script Options

| Option | Required | Description |
| --- | --- | --- |
| `--url` | Yes | Target Help article URL. |
| `--out` | Yes | Output Markdown file path under `./artifacts`. |
| `--consent-selector` | No | Selector for cookie/consent accept button (OneTrust). |
| `--remove-selectors` | No | Comma-separated selectors to remove before extraction. |
| `--wait` | No | Milliseconds to wait after navigation or consent click. |
| `--content-selector` | No | Extract only this element instead of automatic selection. |
| `--cookie` | No | Consent/session cookie, e.g. `name=value;domain=example.com;path=/`. |
| `--storage-state` | No | Playwright storage state JSON file to reuse consent/session. |
| `--timeout` | No | Navigation timeout in ms (default 45000). |
| `--no-default-removals` | No | Disable default cookie/consent element removals. |
| `--retries` | No | Number of retry attempts after a failure (default 2). |
| `--ignore-cache` | No | Skip the failure index and force a fresh attempt. |
| `--headed` | No | Launch browser in visible (non-headless) mode, useful for debugging. |


### Exit Codes

| Code | Meaning |
| --- | --- |
| `0` | Success — content extracted and saved. |
| `1` | Failure — all retry attempts exhausted, URL recorded in failure index. |
| `2` | Skipped — URL found in failure index from a previous run. Use `--ignore-cache` to retry. |

## Content Extraction Pipeline

The script tries multiple extraction strategies in order:

1. **`--content-selector`** — if provided, extract only that element.
2. **Candidate selectors** — `main article`, `article`, `main`, `.slds-rich-text-editor__output`, `.article-body`, `.help-article` — picks the one with the most text.
3. **Readability on rendered DOM** — strips noise elements, then runs Mozilla Readability on the fully-rendered Lightning page.
4. **Playwright `innerText('body')`** — last resort for Lightning/Aura pages that render content client-side but not into extractable HTML elements.
5. **Raw page source** — static fallback using `page.content()` + Readability.

Before extraction, the script checks for error pages:
- **Aura error overlay** (`#auraErrorTitle`) with visibility check (valid pages have hidden error elements)
- **Visible body text** matching patterns like "We looked high and low" or "couldn't find that page"

## Compliance Notes

- Prefer the Salesforce Knowledge APIs for structured, supported access where possible.
- Check and respect `robots.txt` before scraping.
- Do not republish or redistribute Salesforce Help content.
- Attribute content to Salesforce when used internally.

## Examples

### Example: Capture a Flow Help article

```bash
node skills/salesforce-help-site-scraper/scripts/scrape-help-to-markdown.js \
  --url "https://help.salesforce.com/s/articleView?id=sf.flow_build.htm&type=5" \
  --out "./artifacts/online-research/help_flow_build.md" \
  --remove-selectors "header,footer,nav,aside" \
  --wait 2500
```

### Example: Knowledge article

```bash
node skills/salesforce-help-site-scraper/scripts/scrape-help-to-markdown.js \
  --url "https://help.salesforce.com/s/articleView?id=000394720&type=1" \
  --out "./artifacts/online-research/help_kb_394720.md" \
  --wait 3000
```

### Example: B2C Commerce help article

```bash
node skills/salesforce-help-site-scraper/scripts/scrape-help-to-markdown.js \
  --url "https://help.salesforce.com/s/articleView?id=cc.b2c_roles_and_permissions.htm&type=5" \
  --out "./artifacts/online-research/help_b2c_roles.md" \
  --wait 3000
```

## Failure Index

When a scrape fails after all retries, the URL is recorded in a `.scrape-failures.json` file in the output directory. On subsequent runs, the script checks this index and skips known-bad URLs (exit code 2). This prevents wasting time and browser resources on URLs that are confirmed broken.

The failure index tracks: URL, failure reason, HTTP status, attempt count, timestamp, and scraper name. Both scraper scripts share the same index file format, so failures from either scraper are visible to both.

To force a retry on a previously-failed URL, use `--ignore-cache`. To clear all failures, delete the `.scrape-failures.json` file.

## Content Quality Validation

The script validates extracted content before writing the output file:

- **Minimum length** — content shorter than 100 characters is rejected.
- **Garbage detection** — footer-only content, language picker lists, and copyright-only pages are detected and rejected.
- **Error page detection** — pages containing "we looked high and low", "page not found", "sorry to interrupt", or similar Salesforce error patterns are rejected. This check runs on visible body text immediately after navigation, before extraction begins.
- **Aura error overlay** — help.salesforce.com returns HTTP 200 even for missing articles but renders an Aura error overlay (`#auraErrorTitle`, `#auraError`). The script checks actual element visibility (valid pages have hidden error elements in the DOM).

## Troubleshooting

### Issue: Output is empty or too short

**Solution**: Increase `--wait` or refine `--remove-selectors` to avoid removing the main content container.

### Issue: Consent banner blocks content

**Solution**: OneTrust cookies are auto-accepted. If you need a custom selector, use `--consent-selector`.

### Issue: Script exits with code 2 (SKIPPED)

**Solution**: The URL is in the failure index from a previous run. Use `--ignore-cache` to force a fresh attempt, or delete `.scrape-failures.json` to clear all recorded failures.

### Issue: "Aura error page detected"

**Solution**: The Help article doesn't exist at that URL. Verify the article ID is correct. Salesforce Help returns HTTP 200 with an Aura error overlay for missing articles — the script detects this automatically.

### Issue: "Garbage content" detected

**Solution**: The page returned only footer/language picker content without the actual article body. This typically means the article content didn't load in time. Try increasing `--wait` or check if the article ID has changed.

## Running Tests

```bash
node skills/salesforce-help-site-scraper/scripts/test-scraper.js
```

The test suite covers: valid help articles, non-existent articles, failure index behavior, Knowledge articles (type=1), Lightning-rendered articles, and B2C Commerce help.

## References

- Salesforce Help: https://help.salesforce.com/
- Salesforce Help robots.txt: https://help.salesforce.com/robots.txt
- Salesforce Help sitemaps: https://help.salesforce.com/apex/Help_SiteMapIndexExternalKB
- Coveo Search API: https://docs.coveo.com/en/13/cloud-v2-developers/search-api
- Salesforce Knowledge Developer Guide: https://developer.salesforce.com/docs/atlas.en-us.knowledge_dev.meta/knowledge_dev/
- Salesforce REST API - Search (SOSL): https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_search.htm
- Salesforce REST API - Knowledge Support: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_knowledge_support.htm
- Salesforce REST API - Knowledge Resources: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_knowledge.htm
- Salesforce Master Subscription Agreement: https://www.salesforce.com/company/legal/agreements/
- Salesforce Intellectual Property and Trademarks: https://www.salesforce.com/company/legal/intellectual/
- Robots Exclusion Protocol (RFC 9309): https://www.rfc-editor.org/rfc/rfc9309
