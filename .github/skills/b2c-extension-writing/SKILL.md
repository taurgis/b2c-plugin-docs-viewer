---
name: b2c-extension-writing
description: Create and extend Salesforce B2C Developer Tooling CLI plugins (commands, hooks, middleware, scaffolds). Use when adding B2C CLI extensions, registering hooks, or troubleshooting plugin loading.
---

# B2C CLI Extending

Use this skill when building B2C CLI plugins or integrating with the B2C Developer Tooling SDK.

## When to Use

- Add new CLI commands using B2C base command classes.
- Register B2C-specific hooks (config sources, middleware, lifecycle, cartridges, scaffolds).
- Bundle plugins for distribution or local development.
- Diagnose why hooks or plugins are not loading.

## Plugin Architecture (B2C CLI)

B2C CLI plugins are standard oclif plugins. They can export:
- Commands
- Hooks
- Other plugins

Scaffold a new plugin:

```bash
npx oclif generate mynewplugin
```

## Install and Link

```bash
# Install from npm
b2c plugins install @your-org/b2c-plugin-example

# Link locally for development
b2c plugins link /path/to/your/plugin

# List installed plugins
b2c plugins

# Uninstall
b2c plugins uninstall @your-org/b2c-plugin-example
```

## Available B2C Hooks

| Hook | Purpose | SDK Support |
| --- | --- | --- |
| b2c:config-sources | Custom config resolution | CLI only |
| b2c:http-middleware | HTTP request/response middleware | Yes |
| b2c:operation-lifecycle | Before/after callbacks | CLI only |
| b2c:cartridge-providers | Custom cartridge discovery | CLI only |
| b2c:scaffold-providers | Custom scaffold providers | Yes |

Only HTTP middleware can be registered directly in the SDK via `globalMiddlewareRegistry`.

## Hook Registration (package.json)

Register only the hooks you implement:

```json
{
  "name": "@your-org/b2c-plugin-custom",
  "oclif": {
    "hooks": {
      "b2c:config-sources": "./dist/hooks/config-sources.js",
      "b2c:http-middleware": "./dist/hooks/http-middleware.js",
      "b2c:operation-lifecycle": "./dist/hooks/operation-lifecycle.js",
      "b2c:cartridge-providers": "./dist/hooks/cartridge-providers.js",
      "b2c:scaffold-providers": "./dist/hooks/scaffold-providers.js"
    }
  },
  "dependencies": {
    "@salesforce/b2c-tooling-sdk": "^0.0.1-preview"
  },
  "peerDependencies": {
    "@oclif/core": "^4"
  }
}
```

## Custom Configuration Sources

Hook: `b2c:config-sources`
- Runs after flags are parsed and before config resolution.
- Return one or more `ConfigSource` instances.
- Priority: `before` (higher), `after` (lower), or numeric.

Notes:
- Sources fill missing values; they do not override higher-priority values.
- Credential pairs are atomic (clientId+clientSecret, username+password).
- Plugins cannot add flags to commands they do not own. Use env vars instead.

## HTTP Middleware

Hook: `b2c:http-middleware`
- Runs before any API clients are created.
- Register providers that can intercept requests and responses.

SDK usage (no CLI):

```ts
import { globalMiddlewareRegistry } from "@salesforce/b2c-tooling-sdk/clients";

globalMiddlewareRegistry.register({
  name: "my-sdk-middleware",
  getMiddleware() {
    return {
      onRequest({ request }) {
        return request;
      },
    };
  },
});
```

## Operation Lifecycle

Hook: `b2c:operation-lifecycle`
- Runs before and after supported operations.
- Supported: job:run, job:import, job:export, code:deploy.
- Providers can skip operations by returning `{ skip: true }`.

## Cartridge Providers

Hook: `b2c:cartridge-providers`
- Provide cartridges from custom sources.
- Providers can run before or after default discovery.
- Transformers can modify the final cartridge list.

## Scaffold Providers

Hook: `b2c:scaffold-providers`
- Provide scaffolds or transform the scaffold list.
- Use for custom templates and generators.

## Adding Commands

Extend B2C base command classes for built-in config/auth handling:
- BaseCommand
- OAuthCommand
- InstanceCommand
- CartridgeCommand
- JobCommand
- WebDavCommand
- MrtCommand
- OdsCommand

Example:

```ts
import { InstanceCommand } from "@salesforce/b2c-tooling-sdk/cli";
import { Flags } from "@oclif/core";

export default class MyCommand extends InstanceCommand<typeof MyCommand> {
  static description = "My custom command";
  static flags = {
    site: Flags.string({ description: "Site ID", required: true }),
  };

  async run(): Promise<void> {
    const instance = this.instance;
    const { data } = await instance.ocapi.GET("/sites/{site_id}", {
      params: { path: { site_id: this.flags.site } },
    });

    this.log(`Site: ${data.id}`);
  }
}
```

## Local Testing

```bash
# Build your plugin
pnpm build

# Link to CLI
b2c plugins link /path/to/your/plugin

# Verify installation
b2c plugins

# Test with debug logs
DEBUG='oclif:*' b2c your-command

# Unlink when done
b2c plugins unlink @your-org/your-plugin
```

## Common Pitfalls

- Hook file paths not in dist/ or missing in package.json.
- Using flags for commands you do not own (use env vars instead).
- Not rebuilding after changes before re-linking.
- Mixing ESM/CJS output without matching tsconfig and runtime.

## References

- https://salesforcecommercecloud.github.io/b2c-developer-tooling/guide/extending.html
