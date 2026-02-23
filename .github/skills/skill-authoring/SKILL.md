---
name: skill-authoring
description: 'Create new Agent Skills for GitHub Copilot with proper structure, frontmatter, and bundled resources. Use when asked to "create a skill", "make a new skill", "scaffold a skill", or when building specialized AI capabilities. Generates SKILL.md files following the agentskills.io specification with Forward best practices for Salesforce development.'
license: Forward Proprietary
compatibility: VS Code 1.x+, GitHub Copilot
---

# Skill Authoring Guide

This skill helps you create well-structured Agent Skills for GitHub Copilot that follow the [agentskills.io](https://agentskills.io) specification and Forward's conventions.

## When to Use This Skill

- Creating a new skill from scratch
- Converting documentation into a skill
- Scaffolding skill structure for a new Salesforce feature
- Understanding skill best practices and patterns

## Quick Start

1. **Create folder**: `skills/{skill-name}/` (lowercase, hyphens only)
2. **Add SKILL.md** with required frontmatter
3. **Write instructions** in the body
4. **Add references** for detailed documentation
5. **Validate** with `npm run skill:validate`

## Skill Directory Structure

```
my-skill/
├── SKILL.md           # Required: instructions + metadata
├── scripts/           # Optional: executable code (Python, Bash, JS)
├── references/        # Optional: detailed documentation
├── assets/            # Optional: static resources, images
└── templates/         # Optional: starter code for agent to modify
```

## Required Frontmatter

```yaml
---
name: skill-name                    # Must match folder name
description: 'What it does AND when to use it'
license: Forward Proprietary        # Optional
compatibility: VS Code 1.x+         # Optional
allowed-tools: fetch search         # Optional, experimental
---
```

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | **Yes** | 1-64 chars, lowercase letters/numbers/hyphens, matches folder |
| `description` | **Yes** | 1-1024 chars, describes WHAT + WHEN |
| `license` | No | License identifier (e.g., Forward Proprietary) |
| `compatibility` | No | Max 500 chars, environment requirements |
| `metadata` | No | Key-value pairs for custom properties |
| `allowed-tools` | No | Space-delimited pre-approved tools (experimental) |
| `metadata` | No | Key-value pairs for custom properties |

## Writing Effective Descriptions

The `description` field is **critical** for skill discovery. Include:

1. **WHAT** the skill does (capabilities)
2. **WHEN** to use it (triggers, scenarios)
3. **Keywords** users might mention

### Good Examples

```yaml
# Salesforce-focused
description: 'Creates SFRA cartridges with proper structure, webpack config, and ESLint setup. Use when starting a new B2C Commerce project, adding a custom cartridge, or setting up a plugin cartridge.'

# General development
description: 'Toolkit for testing web applications using Playwright. Use when asked to verify frontend functionality, debug UI behavior, or capture screenshots.'
```

### Bad Examples

```yaml
# Too vague
description: 'Helps with cartridges'

# Missing "when to use"
description: 'Creates SFRA cartridge structures'
```

## Recommended Body Sections

```markdown
# Skill Title

Brief overview (1-2 sentences).

## When to Use This Skill

- Scenario 1
- Scenario 2
- NOT for: alternative scenarios

## Prerequisites

- Required tool 1
- Required tool 2

## How to Use

### Basic Usage
Step-by-step instructions...

### Advanced Usage
More complex scenarios...

## Quick Reference

| Command | Description |
|---------|-------------|
| cmd1    | Does X      |
| cmd2    | Does Y      |

## Examples

### Example 1: Basic
[concrete, runnable example]

### Example 2: Advanced
[more complex example]

## Troubleshooting

### Issue: X happens
**Solution**: Do Y

## References

- [PATTERNS.md](references/PATTERNS.md) - Detailed patterns
- [External docs](https://example.com) - Official documentation
```

## Progressive Disclosure Model

Keep your SKILL.md focused. Use references for details.

| Layer | Token Budget | When Loaded |
|-------|--------------|-------------|
| Metadata | ~100 tokens | At startup (all skills) |
| SKILL.md body | < 5000 tokens | When skill activated |
| References | As needed | On demand |

### Guidelines

- **SKILL.md**: Under 400-500 lines
- **References**: One level deep only (SKILL.md → ref.md)
- **Front-load**: Put most important info first
- **Tables**: Easy to scan, low token usage

## Validation Checklist

Before publishing, verify:

- [ ] Folder name is lowercase with hyphens only
- [ ] `name` field exactly matches folder name
- [ ] `description` is 10-1024 characters
- [ ] Description wrapped in single quotes
- [ ] Description includes WHAT + WHEN
- [ ] SKILL.md body under 500 lines
- [ ] Key information appears early
- [ ] Examples are concrete and runnable
- [ ] Reference links are valid
- [ ] No deeply nested reference chains
- [ ] Tested with GitHub Copilot

## Anti-Patterns to Avoid

| ❌ Bad | ✅ Good |
|--------|---------|
| 2000+ line SKILL.md | < 500 lines with references |
| Missing context in examples | Full context with explanations |
| Vague description | Specific WHAT + WHEN + keywords |
| Deeply nested references | One level deep only |
| Duplicating official docs | Link to authoritative sources |

## Salesforce-Specific Tips

When creating skills for Salesforce platforms:

1. **Include platform context**: SFCC, Marketing Cloud, Core, etc.
2. **Reference governor limits**: For Apex skills
3. **Note SFRA version compatibility**: For Commerce Cloud
4. **Include BM setup steps**: If configuration required
5. **Link to Salesforce docs**: Don't duplicate official content

## Templates

See [assets/skill-template.md](assets/skill-template.md) for a copy-paste starter.

## References

- [PATTERNS.md](references/PATTERNS.md) - Content organization patterns
- [VALIDATION.md](references/VALIDATION.md) - Detailed validation rules
- [agentskills.io](https://agentskills.io/specification) - Official specification
