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
| [editing](plugins/editing) | Teaches Claude to edit prose — its own replies and the documents it writes — by deleting what carries no information and rebuilding what does, with a catalog of the tells that mark machine-written text, Williams-style clarity moves, and never-invent gates that keep an edit from becoming a fabrication |
| [git-workflow](plugins/git-workflow) | Teaches Claude to treat version control as a deliverable — atomic conventional commits split from a working tree, branch history made legible without interactive rebase, and pull requests that describe the change rather than the diff, with hooks that route version-control requests to it and block the irreversible mistakes |
| [graphql](plugins/graphql) | GraphQL API design guidance and .NET implementation patterns for HotChocolate and GraphQL.NET — schema design, operations, Relay conventions, and performance |
| [mediatr](plugins/mediatr) | MediatR guidance for in-process messaging in .NET — requests, notifications, pipeline behaviors, registration, and testing |
| [refactoring](plugins/refactoring) | Teaches Claude to spot code smells (classic, architectural, and test smells) and apply disciplined, behavior-preserving refactoring |
| [testing](plugins/testing) | Teaches Claude to write, review, and audit tests worth having — behavior-focused design, disciplined test doubles, browser and component testing, a plan-gated pipeline that turns a ticket or PR into tests of the described behavior, a check on whether pushed code still matches the description that specified it, and a repo-scale map of where test protection is weakest |

## Repository layout

- `.claude-plugin/marketplace.json` — the marketplace manifest
- `plugins/<name>/` — one directory per plugin, each with its own `.claude-plugin/plugin.json`
