# Skill Template

Copy this template to create a new skill. Replace all `{placeholders}`.

---

## 1. Create Folder Structure

```bash
mkdir -p skills/{skill-name}/{references,assets,scripts}
```

## 2. Copy This SKILL.md Template

```markdown
---
name: {skill-name}
description: '{What this skill does}. Use when {scenarios where this skill applies}. {Keywords users might mention}.'
license: Forward Proprietary
compatibility: {requirements, e.g., "VS Code 1.x+, SFCC B2C Commerce"}
---

# {Skill Title}

{One or two sentence overview of what this skill helps accomplish.}

## When to Use This Skill

- {Scenario 1}
- {Scenario 2}
- {Scenario 3}
- **Not for:** {Alternative scenarios - guide to other skills}

## Prerequisites

- {Required tool or environment 1}
- {Required tool or environment 2}

## Quick Start

1. {First step}
2. {Second step}
3. {Third step}

## How to Use

### Basic Usage

{Step-by-step instructions for the most common use case.}

```{language}
{Concrete, runnable code example}
```

### Advanced Usage

{Instructions for more complex scenarios.}

```{language}
{Advanced code example}
```

## Quick Reference

| {Column 1} | {Column 2} | {Column 3} |
|------------|------------|------------|
| {Value}    | {Value}    | {Value}    |

## Examples

### Example 1: {Basic Scenario}

{Context and explanation}

```{language}
{Complete, runnable example}
```

### Example 2: {Advanced Scenario}

{Context and explanation}

```{language}
{Complete, runnable example}
```

## Troubleshooting

### Issue: {Common problem}

**Cause:** {Why it happens}

**Solution:** {How to fix it}

```{language}
{Fix example if applicable}
```

## References

- [{Reference name}](references/{REFERENCE}.md) - {Description}
- [{External docs}]({url}) - Official documentation
```

---

## 3. Validation Checklist

Before committing, verify:

- [ ] Folder name matches `name` field exactly
- [ ] Folder name is lowercase with hyphens only
- [ ] Description is 10-1024 characters
- [ ] Description includes WHAT + WHEN
- [ ] SKILL.md is under 500 lines
- [ ] All placeholders replaced
- [ ] Examples are runnable
- [ ] Links are valid
- [ ] Tested with GitHub Copilot

---

## 4. Example: Completed Template

```yaml
---
name: apex-batch-generator
description: 'Generates Apex batch classes with proper structure, state management, and error handling. Use when creating scheduled jobs, data cleanup tasks, or bulk processing operations. Includes Schedulable wrapper and test class generation.'
license: Forward Proprietary
compatibility: Salesforce API v55.0+, VS Code with Salesforce Extension Pack
---
```

---

## 5. Quick Commands

```bash
# Create new skill
npm run skill:create {skill-name}

# Validate skill
npm run skill:validate skills/{skill-name}

# Validate all skills
npm run validate
```
