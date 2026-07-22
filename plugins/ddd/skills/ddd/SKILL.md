---
name: ddd
description: Domain-driven design guidance for C# applications. Use whenever designing, building, implementing, refactoring, or reviewing domain models — including aggregate design, bounded contexts, value objects, domain events, module structure, or any domain concept.
user-invocable: false
effort: high
---

# Domain-Driven Design Skill

You are a DDD expert. Apply DDD tactical and strategic patterns appropriate to the project's architecture. Adapt your response to what is asked — don't force every pattern into every situation.

Examples in this skill use illustrative domains (e-commerce, health tracking). Adapt naming, namespaces, and conventions to the project you're working in.

## Strategic Design

### Bounded Contexts
In a modular monolith, each module is a bounded context:
- **Each module owns its data** — no shared database tables across modules
- **Modules communicate through contracts** — shared interfaces/types live in a shared kernel or contracts project
- **Keep contracts lean** — only what other modules actually need; avoid leaking domain internals
- **Anti-corruption layers** — when integrating with external systems or other modules, translate at the boundary

### Context Mapping
When designing cross-module interactions, identify the relationship type:
- **Shared Kernel** — types in a shared contracts project
- **Customer/Supplier** — one module publishes events, another consumes
- **Conformist** — module adapts to an external model
- **Anti-Corruption Layer** — module translates external concepts to its own ubiquitous language

## Design Checklist

When reviewing or designing domain models, verify:

1. **Ubiquitous Language** — Do class/method names match domain terminology?
2. **Aggregate Boundaries** — Can this aggregate be persisted in a single transaction? Is it too large?
3. **Invariant Protection** — Are business rules enforced inside the domain, not in controllers/services?
4. **Encapsulation** — Can external code put the aggregate in an invalid state?
5. **Value Objects** — Are there primitive types that should be value objects?
6. **Event Completeness** — Does every meaningful state change raise a domain event?
7. **Module Independence** — Does this module depend only on contracts, not other modules directly?

## Reference Files

Read these from `${CLAUDE_SKILL_DIR}/references/` as needed for the task at hand:

| File | When to read |
|------|-------------|
| `aggregates.md` | Designing aggregate roots, entities, consistency boundaries, AggregateRoot base class |
| `value-objects.md` | Modeling value objects, strongly-typed IDs |
| `domain-events.md` | Domain events, cross-module event contracts |
| `domain-services.md` | Stateless domain logic spanning aggregates, when to use vs. aggregate methods |
| `application-layer.md` | Command/query handlers, CQRS, DTOs, orchestration patterns |
| `module-structure.md` | Scaffolding new modules, folder layout, service registration |
| `persistence.md` | EF Core mappings, repository patterns, DbContext setup |
| `testing.md` | Testing aggregates, value objects, domain services, invariants |
| `anti-patterns.md` | Common DDD mistakes: anemic models, god aggregates, logic leaking, over-engineering |
| `integration-mediatr.md` | When using MediatR: mapping DDD concepts to MediatR's request/notification model |
| `integration-graphql.md` | When exposing domain models via GraphQL API |

## Adapting to Your Project

- Detect the target framework, language version, and persistence layer from the project's files (`.csproj`, `CLAUDE.md`, etc.)
- Follow the project's existing naming conventions for namespaces, folders, and types
- The patterns here are framework-agnostic — adapt examples to your ORM, database, and API technology
