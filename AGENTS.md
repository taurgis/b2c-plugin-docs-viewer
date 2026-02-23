# AGENTS.MD

Agent guide for `b2c-plugin-help-docs-viewer`.

## Purpose

This repository provides a B2C CLI plugin that:
- Searches Salesforce Help (`b2c docs search-help-site`)
- Fetches Help/Developer article content (`b2c docs help-site-article`)
- Searches and fetches in one step (`b2c docs fetch-results-help-site`)

Tech stack:
- Node.js >= 18
- TypeScript
- oclif command framework
- Playwright + jsdom + Readability + Turndown for scraping and markdown conversion

## Key Paths

- `src/commands/docs/`: CLI command entry points
- `src/lib/`: scraping, URL policy, cache, latest-search helpers
- `testing/regression/`: regression fixtures, baselines, reports
- `artifacts/`: local/manual investigation outputs

## Mandatory Pre-Step

- Before technical edits, run the subagent `Official Docs Researcher` and incorporate relevant official references when behavior/standards are involved.
- Existing repo instruction file: `.github/instructions/repo-research.instructions.md`

## Working Rules

- Keep URL safety constraints intact: only `help.salesforce.com` and `developer.salesforce.com` are allowed unless explicitly requested.
- Preserve CLI behavior and flags unless the task asks for changes.
- Do not commit or mass-edit generated investigation outputs under `artifacts/` unless requested.
- Treat regression baselines as controlled snapshots; update with `regression:promote` only when drift is intentional.
- Favor small, focused diffs over broad refactors.

## Build, Test, Validate

- Install deps: `npm install`
- Build: `npm run build`
- Unit tests: `npm test`
- Watch tests: `npm run test:watch`
- Regression scrape + compare: `npm run regression:suite`
- Promote current regression output to baseline: `npm run regression:promote`
- Strict regression gate: `npm run regression:check`

Validation guidance:
- Command or `src/lib` changes: run `npm run build` and `npm test`
- Scraper/formatting changes: also run `npm run regression:check`
- If regression fails due to expected site drift, document why before promoting baseline

## Output Expectations

- Keep default terminal output human-readable (boxed search output / markdown article output).
- Keep `--json` output stable and machine-friendly.
- Avoid noisy terminal output for large HTML (`--raw-html` must remain guarded).

## References

- GitHub Copilot custom instruction files and `AGENTS.md` behavior:
  https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions
- Instruction precedence and customization scopes:
  https://docs.github.com/en/copilot/concepts/prompting/response-customization
- Feature support matrix for custom instruction types:
  https://docs.github.com/en/copilot/reference/custom-instructions-support
