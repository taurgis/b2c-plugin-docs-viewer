---
name: salesforce-help-searching
description: 'Search Salesforce Help and related docs via the Help Coveo search API and return normalized URLs.'
license: Forward Proprietary
compatibility: VS Code 1.x+, Node.js 18+
---

# Salesforce Help Searching

Use this skill to run keyword searches against Salesforce Help's Coveo-backed search and return canonical URLs. It captures a short-lived token from the Help search page and calls the search API directly.

## When to Use This Skill

- You need a fast list of relevant Help or Developer doc URLs.
- You want to find the right article before scraping it with a Markdown extractor.
- You need normalized Help URLs (for example, `Help_DocContent` translated to `articleView`).
- NOT for: high-volume crawling or bypassing access controls.

## Supported Result Hosts

- `help.salesforce.com`
- `developer.salesforce.com`

Use `--include-non-help` to allow results outside these hosts.

## Prerequisites

- Node.js 18+
- npm dependencies:

```bash
npm install playwright
npx playwright install chromium
```

## How to Use

```bash
node skills/salesforce-help-searching/scripts/search-help.js \
  --query "flow" \
  --limit 10 \
  --json
```

## Storage Location

Temporary browser data is stored under `./artifacts` in the project root. The
script sets `TMPDIR` to `./artifacts/tmp` and rejects `--out` paths outside the
`artifacts` folder.

## Token Cache

The script caches the Coveo search token in `.env-ai` at the project root and
reuses it until it expires. Expiry is derived from the token's JWT `exp` claim;
if it is missing, the cache falls back to a 24-hour TTL based on Coveo's default
`validFor` value.

When a cached token is valid, the script calls the Coveo API directly and skips
Playwright, so no browser artifacts are created for that run.

References:
- Coveo Search API token lifetime: https://docs.coveo.com/en/13/cloud-v2-developers/search-api
- Salesforce LWS note on `/aura` endpoints: https://developer.salesforce.com/docs/platform/lightning-web-security/guide/lws-aura-endpoints.html

## Script Options

| Option | Required | Description |
| --- | --- | --- |
| `--query` | Yes | Search query string. |
| `--limit` | No | Max results to return (default 10, max 100). |
| `--language` | No | Help language (default `en_US`). |
| `--json` | No | Output JSON instead of line-delimited URLs. |
| `--with-titles` | No | Include titles in text output. |
| `--include-non-help` | No | Include results outside help and developer docs. |
| `--out` | No | Write output to a file under `./artifacts` instead of stdout. |
| `--timeout` | No | Navigation timeout in ms (default 45000). |
| `--headed` | No | Launch browser in visible (non-headless) mode. |
| `--debug` | No | Emit diagnostic logs (no tokens are printed). |

## URL Normalization

The search API sometimes returns Help URLs in the `Help_DocContent` format. These are normalized to `articleView` URLs so they can be scraped consistently. Example:

- Input: `https://help.salesforce.com/Help_DocContent?id=release-notes.rn_automate_flow&language=en_us&release=260.0.0`
- Output: `https://help.salesforce.com/s/articleView?id=release-notes.rn_automate_flow.htm&type=5&release=260.0.0&language=en_us`

## Running Tests

```bash
node skills/salesforce-help-searching/scripts/test-search.js
```

## Related Skills

- `salesforce-help-site-scraper` for scraping Help article content.
- `salesforce-developer-site-scraper` for scraping Developer documentation pages.
