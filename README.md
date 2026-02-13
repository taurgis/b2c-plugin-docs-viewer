# B2C Plugin: Salesforce Help Search

Search Salesforce Help and fetch Help/Developer docs details with caching and secure token storage.

Highlights:

- Search Salesforce Help with boxed, column-aligned results.
- Fetch a single Help or Developer docs page by URL or by ID from the latest search.
- Fetch search results + content in one command (supports Help and Developer docs URLs).
- Cached results are reused for up to 5 days (opt out with `--no-cache`).

## Install (local development)

```bash
npm install
npx playwright install chromium
npm run build
b2c plugins link /path/to/b2c-plugin-help-docs-viewer
```

## Usage

Command overview:

- `b2c docs search-help-site <query>`: Search Help and return a boxed table.
- `b2c docs help-site-article <url|id>`: Fetch a Help or Developer docs page by URL or by ID.
- `b2c docs fetch-results-help-site <query>`: Search and immediately fetch content.

Search for articles:

```bash
b2c docs search-help-site "b2c commerce roles" --limit 5
```

Fetch article details (use a URL or a result ID from the latest search):

```bash
b2c docs help-site-article "https://help.salesforce.com/s/articleView?id=cc.b2c_roles_and_permissions.htm&type=5"
b2c docs help-site-article 2
b2c docs help-site-article 2 --json --raw-html
```

Search and immediately fetch details:

```bash
b2c docs fetch-results-help-site "b2c commerce roles" --limit 3
```

## Examples

Search with JSON output:

```bash
b2c docs search-help-site "pipelines" --limit 3 --json
```

Search and fetch in one step (save to a file):

```bash
b2c docs fetch-results-help-site "pipelines" --limit 3 --out ./artifacts/pipelines.md
```

Fetch by ID from the latest search:

```bash
b2c docs search-help-site "pipelines" --limit 5
b2c docs help-site-article 2
```

Fetch markdown plus raw extracted HTML (writes sidecar file):

```bash
b2c docs help-site-article 2 --out ./artifacts/article.md --raw-html
# writes:
# - ./artifacts/article.md
# - ./artifacts/article.md.raw.html
```

Boxed search output (example):

```
+----+------------------------------------------------------------+------------------------------------------------------------------+
| #  | Title                                                      | URL                                                              |
+----+------------------------------------------------------------+------------------------------------------------------------------+
| 01 | Pipeline overview                                          | https://help.salesforce.com/s/articleView?id=example.htm&type=5  |
+----+------------------------------------------------------------+------------------------------------------------------------------+
| 02 | Configure pipeline steps                                   | https://help.salesforce.com/s/articleView?id=example2.htm&type=5 |
+----+------------------------------------------------------------+------------------------------------------------------------------+
```

Use the ID shortcut with a leading `#`:

```bash
b2c docs help-site-article #3
```

## Caching

- Search and detail results are cached under the system temp directory.
- Cached items are reused for up to 5 days.
- Use `--no-cache` to bypass cached items and refresh results.

## Testing

- Run unit tests once: `npm test`
- Run tests in watch mode: `npm run test:watch`

### Regression suite (real pages)

- Fixture list: `testing/regression/fixtures.json`
- Scrape + compare against baseline: `npm run regression:suite`
- Refresh baseline from latest scrape: `npm run regression:promote`
- Fail on drift (CI mode): `npm run regression:check`

Notes:

- The regression scripts use `dist/lib/helpScraper.js`, so run `npm run build` first.
- The regression suite config/scripts are tracked in git under `testing/regression/`.
- Current run outputs are written to `testing/regression/current/`.
- Baseline snapshots are stored in `testing/regression/baseline/`.
- Comparison report: `testing/regression/current/report.json`.

## Output formats

- Default output is a boxed table for search results and markdown for article content.
- Use `--json` to emit structured JSON for automation and AI workflows.
- Use `--raw-html` with `docs help-site-article` to include raw extracted HTML in `--json` output or to write a `.raw.html` sidecar when using `--out`.

## Troubleshooting

- If Playwright is missing a browser, run `npx playwright install chromium`.
- If keychain access is blocked, allow your terminal to access the keychain and retry.

## Notes

- Tokens are stored in the OS keychain (via keytar).
- The CLI uses Playwright for Help site rendering; install the Chromium browser if needed.

## Unlink

```bash
b2c plugins unlink b2c-plugin-help-docs-viewer
```
