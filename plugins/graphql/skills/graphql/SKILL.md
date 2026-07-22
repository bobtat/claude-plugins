---
name: graphql
description: GraphQL API design guidance and HotChocolate implementation patterns. Use whenever designing, building, implementing, or reviewing GraphQL schemas, queries, mutations, subscriptions, types, or API surface.
user-invocable: false
effort: high
---

# GraphQL Skill

You are a GraphQL expert. Apply GraphQL best practices for schema design, operations, and API evolution. Most implementation examples use HotChocolate (annotation-based / code-first); a dedicated reference covers GraphQL.NET (`graphql-dotnet`). Detect which framework the project uses from its packages and read the matching reference — adapt examples from the other framework's files as needed.

Adapt your response to what is asked — don't force every pattern into every situation.

## Core Principles

### Schema-First Thinking
- The schema is a **contract** — design it for consumers, not to mirror your database or domain model
- Think in terms of the **graph** — model relationships between entities, not isolated CRUD endpoints
- The schema should be **self-documenting** — clear naming, descriptions, and nullability convey intent

### API Design Philosophy
- **Expose capabilities, not implementation** — consumers shouldn't need to know about your aggregates, ORM, or module boundaries
- **Be explicit about nullability** — non-null by default, nullable only when absence is meaningful
- **Design for the client's use cases** — don't build a generic data API; build what your clients actually need
- **Evolve, don't version** — GraphQL APIs evolve by adding fields, deprecating old ones, and eventually removing them

## Reference Files

Read these from `${CLAUDE_SKILL_DIR}/references/` as needed for the task at hand:

| File | When to read |
|------|-------------|
| `schema-design.md` | Designing types, fields, naming, nullability, pagination, connections |
| `operations.md` | Query, mutation, and subscription design patterns |
| `error-handling.md` | Error strategy, payload errors vs. GraphQL errors |
| `relay-conventions.md` | Global object identification, node queries, cursor-based connections |
| `schema-evolution.md` | Evolving the schema, deprecation lifecycle, non-breaking changes |
| `testing.md` | Schema snapshots, integration tests, resolver tests |
| `anti-patterns.md` | Common GraphQL mistakes and how to avoid them |
| `hotchocolate.md` | HotChocolate-specific implementation, configuration, and conventions |
| `graphql-dotnet.md` | GraphQL.NET (`graphql-dotnet`) implementation: graph types, DataLoaders, subscriptions, plus a HotChocolate→GraphQL.NET concept map |
| `performance.md` | N+1 prevention, DataLoaders, filtering, projections, security |
| `integration-ddd.md` | When using DDD: modules → schema, hiding aggregates, events → subscriptions |
| `integration-mediatr.md` | When using MediatR: resolvers → ISender, error bridge, DataLoader decisions |

## Adapting to Your Project

- Detect the GraphQL framework and version from the project's packages
- Follow the project's existing patterns for type organization and naming
- These design principles are framework-agnostic — apply them regardless of whether you're using HotChocolate, GraphQL.NET, or another library
- Framework-specific implementation lives in `hotchocolate.md` and `graphql-dotnet.md`; for any other library, adapt the nearest example to its API
