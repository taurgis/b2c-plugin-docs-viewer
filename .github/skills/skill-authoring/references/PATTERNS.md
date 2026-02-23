# Content Organization Patterns

Effective patterns for structuring skill content.

## Table Formats

### Command Reference Table

```markdown
| Command | Description | Example |
|---------|-------------|---------|
| `cmd --flag` | Does X | `cmd --flag value` |
```

### Parameter Table

```markdown
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `--input` | string | Yes | - | Input file path |
| `--verbose` | boolean | No | false | Enable verbose output |
```

### Feature Matrix

```markdown
| Feature | Basic | Pro | Enterprise |
|---------|:-----:|:---:|:----------:|
| Feature A | ✅ | ✅ | ✅ |
| Feature B | ❌ | ✅ | ✅ |
| Feature C | ❌ | ❌ | ✅ |
```

## Code Example Patterns

### Inline Code

Use for short snippets: `const x = 1`

### Code Blocks with Context

Always explain what the code does:

```javascript
// Good: Context provided
// This controller handles product display with caching
server.get('Show', cache.applyDefaultCache, function (req, res, next) {
    // ...
});
```

### Multi-File Examples

When showing related files, use headers:

**Controller (Product.js)**
```javascript
server.get('Show', function (req, res, next) {
    var ProductModel = require('*/cartridge/models/product');
    // ...
});
```

**Model (product.js)**
```javascript
function Product(apiProduct) {
    this.id = apiProduct.ID;
    // ...
}
```

## Skill Templates by Type

### CLI Command Skill

```markdown
# {Tool Name} Skill

Quick reference for {tool} commands.

## Installation

\`\`\`bash
npm install -g {tool}
\`\`\`

## Common Commands

| Command | Description |
|---------|-------------|
| `tool init` | Initialize project |
| `tool build` | Build project |

## Examples

### Initialize a new project
\`\`\`bash
tool init my-project
cd my-project
\`\`\`
```

### API/Framework Skill

```markdown
# {Framework} Skill

Guide for working with {framework}.

## Core Concepts

- Concept 1: Brief explanation
- Concept 2: Brief explanation

## Quick Start

1. Step one
2. Step two

## API Reference

### `functionName(param1, param2)`

Description of what it does.

**Parameters:**
- `param1` (type): Description
- `param2` (type): Description

**Returns:** Description of return value

**Example:**
\`\`\`javascript
const result = functionName('value1', 'value2');
\`\`\`
```

### Configuration Skill

```markdown
# {Config Type} Skill

Guide for configuring {system}.

## File Location

\`path/to/config.json\`

## Schema

\`\`\`json
{
  "property1": "string",
  "property2": {
    "nested": "value"
  }
}
\`\`\`

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| property1 | string | Yes | Does X |
| property2 | object | No | Contains Y |

## Examples

### Minimal Configuration
\`\`\`json
{
  "property1": "value"
}
\`\`\`

### Full Configuration
\`\`\`json
{
  "property1": "value",
  "property2": {
    "nested": "value"
  }
}
\`\`\`
```

## Salesforce-Specific Patterns

### Apex Skill Pattern

```markdown
## Governor Limits Consideration

| Limit | Value | Impact |
|-------|-------|--------|
| SOQL queries | 100 | Use bulkification |
| DML statements | 150 | Batch operations |

## Code Pattern

\`\`\`apex
// Always use handler pattern
public class MyTriggerHandler {
    public void beforeInsert(List<SObject> records) {
        // Bulkified logic
    }
}
\`\`\`
```

### SFRA Skill Pattern

```markdown
## Cartridge Path

Ensure your cartridge is in the path:
\`app_custom:app_storefront_base\`

## Extending Controllers

\`\`\`javascript
'use strict';
var server = require('server');
server.extend(module.superModule);

server.append('Show', function (req, res, next) {
    // Extension logic
    next();
});

module.exports = server.exports();
\`\`\`
```

## Reference Organization

### When to Create References

| Content Type | In SKILL.md | In Reference |
|--------------|:-----------:|:------------:|
| Quick start | ✅ | ❌ |
| Common patterns | ✅ | ❌ |
| API reference | Summary | ✅ Full |
| Advanced topics | Link only | ✅ |
| Troubleshooting | Common issues | ✅ Full |

### Reference Naming

- `PATTERNS.md` - Common patterns and examples
- `API-REFERENCE.md` - Full API documentation
- `TROUBLESHOOTING.md` - Issue resolution
- `MIGRATION.md` - Version migration guides
- `{TOPIC}.md` - Specific topic deep-dives
