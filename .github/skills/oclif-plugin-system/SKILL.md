---
name: oclif-plugin-system
description: Build, configure, and troubleshoot oclif CLI plugins (commands, hooks, plugin bundles). Use when creating new oclif plugins, wiring package.json, or linking plugins for local development.
---

# Oclif Plugin System

Use this skill when you need to create or extend oclif plugins, register commands or hooks, or debug plugin loading. Plugins are useful for experimental features, modularization, or sharing functionality across CLIs.

## Quick Triage

- Need new behavior in a CLI? Decide: command, hook, or plugin bundle.
- Command: new CLI command under src/commands.
- Hook: lifecycle integration under src/hooks.
- Plugin bundle: meta plugin that includes other plugins via package.json.

## Workflow

1) Choose the plugin type
- Commands: add new CLI commands.
- Hooks: tap into lifecycle events (init, prerun, postrun, etc.).
- Plugin bundle: groups plugins for distribution.

2) Scaffold or structure
If starting fresh, use the generator:

```bash
npx oclif generate mynewplugin
```

Minimal structure:

```
my-plugin/
  package.json
  tsconfig.json
  src/
    commands/
      hello.ts
    hooks/
      init.ts
  dist/
```

3) Wire package.json (required)

- Ensure build output is in dist/.
- Register commands and hooks using oclif config.

Example:

```json
{
  "name": "my-plugin",
  "version": "0.1.0",
  "main": "dist/index.js",
  "files": ["dist"],
  "oclif": {
    "commands": "./dist/commands",
    "hooks": {
      "init": "./dist/hooks/init.js"
    }
  }
}
```

4) Build

```bash
npm run build
```

5) Link for local development

```bash
mycli plugins link /path/to/my-plugin
# or, for B2C CLI
b2c plugins link /path/to/my-plugin
```

6) Verify

```bash
mycli plugins
mycli help
```

## Add Plugins to a CLI

To add a plugin to a CLI, install it and register it in package.json:

```json
{
  "dependencies": {
    "@oclif/core": "^4",
    "@oclif/plugin-help": "^6",
    "@oclif/plugin-not-found": "^3"
  },
  "oclif": {
    "plugins": [
      "@oclif/plugin-help",
      "@oclif/plugin-not-found"
    ]
  }
}
```

You can also use minimatch patterns:

```json
{
  "oclif": {
    "plugins": ["@oclif/plugin-*"]
  }
}
```

If you want users to install their own plugins, include @oclif/plugin-plugins in your CLI.

## Command Authoring Notes

- Use static `description`, `examples`, and well-named flags for good help output.
- Keep flags explicit and defaults clear.
- Prefer short flag names for frequent options.

## Hook Authoring Notes

- Keep hooks fast and resilient; avoid blocking CLI startup.
- Guard optional behaviors with feature flags or env vars.
- Log sparingly to avoid noisy output.

## Useful Built-In Plugins

- @oclif/plugin-help
- @oclif/plugin-not-found
- @oclif/plugin-update
- @oclif/plugin-plugins (lets users install third-party plugins)
- @oclif/plugin-warn-if-update-available
- @oclif/plugin-which
- @oclif/plugin-commands (adds a commands list)
- @oclif/plugin-autocomplete (bash/zsh autocomplete)
- @oclif/plugin-search (adds a search command)
- @oclif/plugin-version (adds a version command)

## Common Pitfalls

- Dist paths missing or wrong in package.json.
- ESM/CJS mismatch between tsconfig and runtime.
- Files not included in published package (missing "files": ["dist"]).
- Forgetting to link or reinstall plugin after rebuild.

## Example: Add a Command

```ts
import { Command, Flags } from "@oclif/core";

export default class Hello extends Command {
  static description = "Say hello";
  static flags = {
    name: Flags.string({ char: "n", description: "Name to greet" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Hello);
    this.log(`Hello ${flags.name ?? "world"}`);
  }
}
```

## Example: Add a Hook

```ts
import type { Hook } from "@oclif/core";

const hook: Hook<"init"> = async function () {
  this.log("plugin init");
};

export default hook;
```
