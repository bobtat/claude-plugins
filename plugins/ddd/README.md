# ddd

A Claude Code plugin that gives Claude domain-driven design expertise for C# applications.

## What It Does

Adds one auto-triggering skill that activates whenever Claude is designing, implementing, refactoring, or reviewing a domain model. It provides:

- **Strategic design guidance** — bounded contexts in a modular monolith, context mapping relationships (shared kernel, customer/supplier, conformist, anti-corruption layer)
- **A design checklist** — ubiquitous language, aggregate boundaries, invariant protection, encapsulation, value objects, event completeness, module independence
- **Tactical pattern references** — aggregates, value objects and strongly-typed IDs, domain events, domain services, application-layer/CQRS handlers, module scaffolding, EF Core persistence, and testing
- **An anti-pattern catalog** — anemic models, god aggregates, logic leaking out of the domain, over-engineering
- **Integration notes** — mapping DDD concepts onto MediatR's request/notification model, and exposing domain models through a GraphQL API

Examples use illustrative domains and are adapted to the target project's framework, naming conventions, and persistence layer.

## Installation

```
/plugin marketplace add bobtat/claude-plugins
/plugin install ddd@bobtat-plugins
```

Or test locally:

```bash
claude --plugin-dir plugins/ddd
```

## Usage

No commands to run — the skill triggers automatically on requests like:

- "Design an aggregate for order fulfillment"
- "Should this be a value object?"
- "Review my domain model"
- "Where do I put this business rule?"
- "Scaffold a new module for billing"

Claude loads the lean core skill on trigger and pulls in the detailed references only when the task needs them.

## Structure

```
ddd/
├── .claude-plugin/plugin.json
└── skills/ddd/
    ├── SKILL.md                      # Strategic design, design checklist, reference index
    └── references/
        ├── aggregates.md             # Aggregate roots, entities, consistency boundaries
        ├── value-objects.md          # Value objects, strongly-typed IDs
        ├── domain-events.md          # Domain events, cross-module event contracts
        ├── domain-services.md        # Stateless logic spanning aggregates
        ├── application-layer.md      # Command/query handlers, CQRS, DTOs
        ├── module-structure.md       # Module scaffolding, folder layout, registration
        ├── persistence.md            # EF Core mappings, repositories, DbContext
        ├── testing.md                # Testing aggregates, value objects, invariants
        ├── anti-patterns.md          # Anemic models, god aggregates, over-engineering
        ├── integration-mediatr.md    # DDD concepts on MediatR
        └── integration-graphql.md    # Exposing domain models via GraphQL
```

## License

MIT
