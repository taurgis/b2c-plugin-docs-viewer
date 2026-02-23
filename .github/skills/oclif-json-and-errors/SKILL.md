---
name: oclif-json-and-errors
description: 'Design stable oclif command output contracts with clean --json stdout, stderr diagnostics, and structured error codes. Use when adding or refactoring command output, exit behavior, or automation-facing error handling.'
---

# Oclif JSON and Errors

Use this skill when changing command UX or output contracts in this plugin.

## When to use

- Adding a new command under `src/commands/`.
- Changing `--json` output shape.
- Handling partial failures where automation still needs machine-readable details.
- Standardizing exit codes and error messages.

## Core rules

1. Keep `--json` output machine-safe.
2. Keep human status logs out of JSON payloads.
3. Prefer stable error codes for scriptability.
4. Use one predictable schema per command mode.

## Recommended pattern

1. Build a typed response object first.
2. Print JSON exactly once in `--json` mode.
3. Emit human-friendly logs only in non-JSON mode.
4. On failure, include actionable context and a stable `code` in `this.error()`.

## Repo guidance

- Keep JSON payloads shaped like current command contracts in `src/commands/docs/`.
- For all-failed batch operations, still emit error details before non-zero exit.
- Continue using reusable helpers for consistency:
: `src/lib/errorUtils.ts`
: `src/lib/fileOutput.ts`

## Checklist

- [ ] `--json` emits parseable JSON only on stdout.
- [ ] Non-JSON mode remains readable for humans.
- [ ] Error path sets a deterministic code (`this.error(..., {code: ...})`).
- [ ] Partial failure data is retained (not discarded).
- [ ] Tests cover success, partial failure, and total failure modes.

## References

- https://oclif.io/docs/commands#json-flag
- https://oclif.io/docs/commands#error
- https://oclif.io/docs/error_handling
- https://oclif.io/docs/configuring_your_cli#exit-codes
- https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-skills
