# claude-plugins

A [Claude Code](https://claude.com/claude-code) plugin marketplace.

## Installation

Add the marketplace:

```
/plugin marketplace add bobtat/claude-plugins
```

Then install a plugin:

```
/plugin install refactoring@bobtat-plugins
```

## Plugins

| Plugin | Description |
| ------ | ----------- |
| [ddd](plugins/ddd) | Domain-driven design guidance for C# applications — aggregates, value objects, domain events, bounded contexts, and module structure |
| [graphql](plugins/graphql) | GraphQL API design guidance and .NET implementation patterns for HotChocolate and GraphQL.NET — schema design, operations, Relay conventions, and performance |
| [mediatr](plugins/mediatr) | MediatR guidance for in-process messaging in .NET — requests, notifications, pipeline behaviors, registration, and testing |
| [refactoring](plugins/refactoring) | Teaches Claude to spot code smells (classic, architectural, and test smells) and apply disciplined, behavior-preserving refactoring |
| [testing](plugins/testing) | Teaches Claude to write and review tests worth having — behavior-focused design, disciplined test doubles, right-sized scope, and a plan-gated pipeline that turns a ticket or PR into tests of the described behavior |

## Repository layout

- `.claude-plugin/marketplace.json` — the marketplace manifest
- `plugins/<name>/` — one directory per plugin, each with its own `.claude-plugin/plugin.json`
