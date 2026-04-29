# B2C Plugin: Salesforce Help Search

Search Salesforce Help and fetch Help/Developer docs details with caching and secure token storage.

Highlights:

- Search Salesforce Help with boxed, column-aligned results.
- Fetch a single Help or Developer docs page by URL or by ID from the latest search.
- Fetch search results + content in one command (supports Help and Developer docs URLs).
- Direct URL fetching is restricted to `https://help.salesforce.com` and `https://developer.salesforce.com`.
- Batch fetch uses bounded concurrency and reports per-URL failures instead of failing fast.
- Cached results are reused for up to 5 days (opt out with `--no-cache`).

## Install (npm)

```bash
b2c plugins install b2c-plugin-help-docs-viewer
```

For Node.js consumers that want to call the library directly:

```bash
npm install b2c-plugin-help-docs-viewer
```

If the Playwright headless browser is not installed yet:

```bash
# Lightweight install (no X11/Wayland/D-Bus deps; works on minimal Linux servers)
npx playwright install --only-shell chromium
```

This downloads only the `chrome-headless-shell` binary, which is the dependency-light variant Chrome ships specifically for automation/scraping. It is what this plugin uses by default.

If you also want to run the CLI with the `--headed` debug flag, install the full Chromium build instead:

```bash
npx playwright install chromium
```

On Linux, you may additionally need the shared system libraries:

```bash
sudo npx playwright install-deps chromium
```

## Install (local development)

```bash
npm install
npx playwright install --only-shell chromium
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
b2c docs fetch-results-help-site "b2c commerce roles" --limit 6 --concurrency 3
```

## Programmatic API

Supported imports:

```js
import {
	readHelpDoc,
	searchHelpDocs,
} from "b2c-plugin-help-docs-viewer";
```

```js
import {
	readHelpDoc,
	searchHelpDocs,
} from "b2c-plugin-help-docs-viewer/api";
```

Search Salesforce Help and Developer docs:

```js
import { searchHelpDocs } from "b2c-plugin-help-docs-viewer";

const searchResult = await searchHelpDocs({
	query: "b2c commerce roles",
	limit: 5,
	language: "en_US",
	cache: true,
	timeoutMs: 45_000,
	headed: false,
});

console.log(searchResult.results.map((item) => ({
	id: item.id,
	title: item.title,
	source: item.source,
	url: item.url,
})));
```

Read an article as markdown:

```js
import { readHelpDoc } from "b2c-plugin-help-docs-viewer/api";

const article = await readHelpDoc(
	"https://help.salesforce.com/s/articleView?id=cc.b2c_roles_and_permissions.htm&type=5",
	{
		cache: true,
		timeoutMs: 45_000,
		waitMs: 2500,
		includeRawHtml: true,
	}
);

console.log(article.title);
console.log(article.markdown);
console.log(article.rawHtml);
```

Error handling with stable codes:

```js
import {
	HelpDocsApiError,
	HELP_DOCS_ERROR_CODES,
	readHelpDoc,
} from "b2c-plugin-help-docs-viewer";

try {
	await readHelpDoc("https://example.com/not-allowed");
} catch (error) {
	if (error instanceof HelpDocsApiError) {
		switch (error.code) {
			case HELP_DOCS_ERROR_CODES.INVALID_URL:
			case HELP_DOCS_ERROR_CODES.UNSUPPORTED_PROTOCOL:
			case HELP_DOCS_ERROR_CODES.UNSUPPORTED_HOST:
			case HELP_DOCS_ERROR_CODES.ARTICLE_NOT_FOUND:
			case HELP_DOCS_ERROR_CODES.SEARCH_FAILED:
			case HELP_DOCS_ERROR_CODES.EXTRACTED_CONTENT_TOO_SHORT:
			case HELP_DOCS_ERROR_CODES.BROWSER_LAUNCH_FAILED:
				console.error(error.code, error.message);
				break;
			default:
				throw error;
		}
	}

	throw error;
}
```

The public API is intended for MCP-style consumers and other automation. Search results always include a normalized URL plus source metadata (`help` or `developer`), and article reads always return markdown.

Advanced helper:

```js
import { resolveHelpDoc } from "b2c-plugin-help-docs-viewer";

const resolved = resolveHelpDoc("https://developer.salesforce.com/docs/commerce/example");
console.log(resolved);
```

Playwright/browser requirements:

- The library depends on Playwright at runtime.
- Install a browser binary before first use: `npx playwright install --only-shell chromium` for headless automation or `npx playwright install chromium` for headed debugging.
- On Linux, you may also need `sudo npx playwright install-deps chromium`.
- A `BROWSER_LAUNCH_FAILED` error usually means the browser binaries or system libraries are missing.

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
- Use `--no-cache` to force a fresh network fetch and parsing pass. In this mode cache files are neither read nor written.

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

- If Playwright is missing a browser, run `npx playwright install --only-shell chromium` (headless-only) or `npx playwright install chromium` (full, required for `--headed`).
- On Linux, if the browser fails to start due to missing shared libraries, run `sudo npx playwright install-deps chromium`. The headless shell does **not** require X11, Wayland, or D-Bus.
- If keychain access is blocked, allow your terminal to access the keychain and retry.

## Notes

- Tokens are stored in the OS keychain (via keytar).
- The CLI uses Playwright's `chrome-headless-shell` for Help site rendering by default, so it runs on headless Linux servers without an X11/Wayland display.
- The `--headed` flag is intended for local debugging and requires the full Chromium build (`npx playwright install chromium`).

## Unlink

```bash
b2c plugins unlink b2c-plugin-help-docs-viewer
```
