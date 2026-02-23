---
description: 'Require Official Docs Researcher before repo changes'
applyTo: '**'
---

# Repository Research Requirement

## Mandatory Pre-Step
- Always run the subagent **Official Docs Researcher** before creating, updating, refactoring, scaffolding, or deleting any content.
- Use its findings to incorporate the most current official documentation and online references in the change.

## When not to Use
- When no technical content is being modified in the specified directories (e.g., purely editorial changes).
- When working outside of the specified directories.
- When no deep research is really needed (use judgment on timing and relevance, but when in doubt, run the subagent).
- When you have already recently run the subagent and are making a closely related change (use judgment on timing and relevance).
- When the user mentions no research is needed or explicitly says to skip research (use judgment on trust and context). Always follow the user’s instructions if they explicitly say to skip research - it is their prerogative to decide when research is needed. If they say to skip, do not run the subagent, but you can still use your existing knowledge and any relevant information from the user’s prompt to make the change.

## Examples
- ✅ Run **Official Docs Researcher** before editing
- ✅ Include relevant official doc links when the change references platform behavior or standards.
- ❌ Do not modify content in those directories without running the subagent first.
