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
| [refactoring](plugins/refactoring) | Teaches Claude to spot code smells (classic, architectural, and test smells) and apply disciplined, behavior-preserving refactoring |

## Repository layout

- `.claude-plugin/marketplace.json` — the marketplace manifest
- `plugins/<name>/` — one directory per plugin, each with its own `.claude-plugin/plugin.json`
