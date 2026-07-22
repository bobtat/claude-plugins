# graphql

A Claude Code plugin that gives Claude GraphQL API design expertise and .NET implementation patterns.

## What It Does

Adds one auto-triggering skill that activates whenever Claude is designing, implementing, or reviewing a GraphQL schema, operation, or API surface. It provides:

- **Design principles** — the schema as a consumer-facing contract, graph thinking over CRUD endpoints, explicit nullability, evolve-don't-version
- **Schema and operation references** — types, fields, naming, pagination and connections, query/mutation/subscription patterns, error strategy (payload errors vs. GraphQL errors), Relay global object identification
- **Framework implementations** — HotChocolate (annotation-based / code-first) as the primary path, plus a GraphQL.NET reference with a HotChocolate→GraphQL.NET concept map
- **Performance guidance** — N+1 prevention, DataLoaders, filtering, projections, security
- **Schema evolution** — deprecation lifecycle and non-breaking change rules
- **An anti-pattern catalog**, plus integration notes for DDD (modules → schema, hiding aggregates, events → subscriptions) and MediatR (resolvers → `ISender`, error bridge, DataLoader decisions)

The design guidance is framework-agnostic; Claude detects the project's GraphQL library and reads the matching implementation reference.

## Installation

```
/plugin marketplace add bobtat/claude-plugins
/plugin install graphql@bobtat-plugins
```

Or test locally:

```bash
claude --plugin-dir plugins/graphql
```

## Usage

No commands to run — the skill triggers automatically on requests like:

- "Design a schema for our orders API"
- "Should this mutation return a payload type?"
- "Review my GraphQL schema"
- "Why is this resolver making so many queries?"
- "How do I deprecate this field without breaking clients?"

Claude loads the lean core skill on trigger and pulls in the detailed references only when the task needs them.

## Structure

```
graphql/
├── .claude-plugin/plugin.json
└── skills/graphql/
    ├── SKILL.md                      # Core principles, reference index
    └── references/
        ├── schema-design.md          # Types, fields, naming, nullability, pagination
        ├── operations.md             # Query, mutation, subscription patterns
        ├── error-handling.md         # Payload errors vs. GraphQL errors
        ├── relay-conventions.md      # Global IDs, node queries, cursor connections
        ├── schema-evolution.md       # Deprecation lifecycle, non-breaking changes
        ├── testing.md                # Schema snapshots, integration and resolver tests
        ├── anti-patterns.md          # Common GraphQL mistakes
        ├── hotchocolate.md           # HotChocolate implementation and conventions
        ├── graphql-dotnet.md         # GraphQL.NET implementation + concept map
        ├── performance.md            # N+1, DataLoaders, projections, security
        ├── integration-ddd.md        # Exposing a DDD model through the schema
        └── integration-mediatr.md    # Wiring resolvers to MediatR
```

## License

MIT
