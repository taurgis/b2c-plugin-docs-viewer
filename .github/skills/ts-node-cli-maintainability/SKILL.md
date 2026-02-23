---
name: ts-node-cli-maintainability
description: 'Apply maintainability guardrails for TypeScript Node CLI code: small modules, strict contracts, safe URL policy, and automation-safe errors. Use when refactoring or extending lib and command code.'
---

# TS Node CLI Maintainability

Use this skill when making structural changes across `src/lib` and `src/commands`.

## When to use

- Refactoring large files.
- Extracting shared logic to reduce duplication.
- Updating policy behavior (cache, URL validation, error semantics).
- Improving long-term readability and testability.

## Core principles

1. Single responsibility per module.
2. Shared behavior in utilities, not copy/pasted blocks.
3. Behavior contracts must be explicit and tested.
4. Keep automation-facing surfaces stable.

## Repo contracts to preserve

- URL policy is allowlist-based and `https`-only.
- `--no-cache` means no cache reads and no cache writes for search/detail paths.
- Batch fetch reports per-item failures and still exits non-zero on all-fail.

## Refactor playbook

1. Identify repeated blocks across commands/libs.
2. Extract into focused utility module under `src/lib/`.
3. Keep exported API narrow and typed.
4. Add/update tests before broadening scope.
5. Validate with build, unit tests, and regression suite when scraper logic changes.

## Checklist

- [ ] New utility improves reuse in at least two call sites.
- [ ] Refactor does not change documented command contract unexpectedly.
- [ ] Tests cover behavior not just code paths.
- [ ] Debug logging is opt-in and meaningful.

## References

- https://www.typescriptlang.org/tsconfig/strict
- https://nodejs.org/api/errors.html#systemerror
- https://nodejs.org/api/url.html
- https://oclif.io/docs/introduction
- https://docs.github.com/en/copilot/concepts/prompting/response-customization
