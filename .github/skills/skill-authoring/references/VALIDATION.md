# Skill Validation Rules

Detailed validation requirements for Agent Skills.

## Frontmatter Validation

### `name` Field

| Rule | Requirement |
|------|-------------|
| Required | Yes |
| Length | 1-64 characters |
| Format | Lowercase letters, numbers, hyphens only |
| Pattern | `/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/` |
| Constraint | Must exactly match folder name |

**Valid names:**
- `my-skill`
- `sfra-cartridge-builder`
- `apex-trigger-generator`

**Invalid names:**
- `My-Skill` (uppercase)
- `my_skill` (underscore)
- `-my-skill` (leading hyphen)
- `my--skill` (consecutive hyphens)
- `my-skill-` (trailing hyphen)

### `description` Field

| Rule | Requirement |
|------|-------------|
| Required | Yes |
| Length | 1-1024 characters |
| Format | Single-quoted string in YAML |
| Content | Must include WHAT + WHEN |

**Validation regex for content:**
```regex
# Should contain action words
(create|build|generate|analyze|test|help|guide|manage|configure)

# Should contain trigger phrases
(use when|use for|use to|helps with|assists with)
```

### Optional Fields

| Field | Max Length | Format |
|-------|------------|--------|
| `license` | 100 chars | License identifier or "See LICENSE.txt" |
| `compatibility` | 500 chars | Free text describing requirements |
| `metadata` | - | Key-value pairs (strings only) |
| `allowed-tools` | - | Space-delimited tool patterns |

## File Structure Validation

### Required Files

```
skill-name/
└── SKILL.md    ← Required
```

### Optional Directories

| Directory | Purpose | Validation |
|-----------|---------|------------|
| `scripts/` | Executable code | Must be executable |
| `references/` | Documentation | Must be .md files |
| `assets/` | Static resources | < 5MB per file |
| `templates/` | Starter code | Any format |

### File Size Limits

| File Type | Recommended | Maximum |
|-----------|-------------|---------|
| SKILL.md | < 500 lines | 1000 lines |
| Reference files | < 500 lines | 2000 lines |
| Asset files | < 1MB | 5MB |
| Script files | < 500 lines | 1000 lines |

## Content Validation

### SKILL.md Body

| Check | Requirement |
|-------|-------------|
| Line count | < 500 lines recommended |
| Token estimate | < 5000 tokens |
| Heading structure | Must have at least one H1 |
| Internal links | Must be valid relative paths |
| External links | Should use HTTPS |

### Reference Files

| Check | Requirement |
|-------|-------------|
| Depth | One level from SKILL.md only |
| Format | Markdown (.md) files |
| Links | No broken internal links |

## Automated Validation

### Using npm scripts

```bash
# Validate all skills
npm run skill:validate

# Validate specific skill
npm run skill:validate -- skills/my-skill
```

### Validation Output

```
✅ skill-authoring
   ├── name: valid (matches folder)
   ├── description: valid (142 chars)
   ├── SKILL.md: valid (287 lines)
   └── references: valid (2 files)

❌ my-broken-skill
   ├── name: INVALID (contains uppercase)
   ├── description: INVALID (missing "when to use")
   └── references/DEEP.md: WARNING (links to another reference)
```

## Pre-Commit Checklist

Run through this checklist before committing:

```markdown
## Frontmatter
- [ ] `name` matches folder name exactly
- [ ] `name` is lowercase with hyphens only
- [ ] `description` is 10-1024 characters
- [ ] `description` is wrapped in single quotes
- [ ] `description` includes what the skill does
- [ ] `description` includes when to use it

## Content
- [ ] SKILL.md has meaningful H1 title
- [ ] Key information appears in first 100 lines
- [ ] Examples are concrete and runnable
- [ ] Tables are properly formatted
- [ ] Code blocks have language specifiers

## Structure
- [ ] No files outside allowed directories
- [ ] All internal links resolve
- [ ] Reference files are one level deep
- [ ] No circular references

## Testing
- [ ] Tested with GitHub Copilot
- [ ] Skill activates on expected prompts
- [ ] References load correctly
- [ ] Scripts execute successfully (if any)
```

## Common Validation Errors

### Error: Name mismatch

```
Error: Skill name 'my-skill' does not match folder 'myskill'
Fix: Rename folder to 'my-skill' or update name field
```

### Error: Description too short

```
Error: Description must be at least 10 characters
Fix: Expand description to include what + when
```

### Error: Invalid name format

```
Error: Name 'My_Skill' contains invalid characters
Fix: Use lowercase letters, numbers, and hyphens only
```

### Warning: Deep reference chain

```
Warning: references/A.md links to references/B.md
Recommendation: Move content to single reference or SKILL.md
```
