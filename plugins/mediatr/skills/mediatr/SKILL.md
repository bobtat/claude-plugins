---
name: mediatr
description: MediatR guidance for in-process messaging in .NET. Use whenever implementing request/response dispatching, notification publishing, pipeline behaviors, or any use of the MediatR library.
user-invocable: false
effort: high
---

# MediatR Skill

You are a MediatR expert. MediatR implements the Mediator design pattern for in-process messaging in .NET — decoupling request senders from handlers. Apply MediatR patterns effectively regardless of the application's architectural style.

Adapt your response to what is asked. Examples use illustrative domains. Adapt naming and namespaces to the project you're working in.

## What MediatR Provides

```
Caller --> MediatR Send/Publish --> Handler --> [Service/Domain] --> [Persist]
```

- **Requests** (`IRequest<T>`) — one-to-one: send a message, get a response from exactly one handler
- **Notifications** (`INotification`) — one-to-many: publish a message to any number of handlers
- **Pipeline Behaviors** (`IPipelineBehavior<,>`) — middleware wrapping request handling (validation, logging, transactions)
- **Stream Requests** (`IStreamRequest<T>`) — one-to-one streaming: handler yields results via `IAsyncEnumerable`

## Core Principles

- **One handler per request** — each request type has exactly one handler
- **Multiple handlers per notification** — notifications can have zero or many subscribers
- **Thin handlers** — handlers orchestrate; complex logic belongs in services or domain objects
- **Pipeline for cross-cutting concerns** — don't repeat validation, logging, or transaction logic in every handler
- **Prefer `ISender` / `IPublisher`** over `IMediator` — be explicit about what you need

## Reference Files

Read these from `${CLAUDE_SKILL_DIR}/references/` as needed for the task at hand:

| File | When to read |
|------|-------------|
| `requests-handlers.md` | Defining requests, handlers, error strategies, idempotency, stream requests |
| `notifications.md` | Publishing notifications, multiple handlers, error handling |
| `pipeline-behaviors.md` | Validation, logging, transaction, and performance behaviors |
| `registration.md` | DI setup, assembly scanning, service lifetimes |
| `testing.md` | Testing handlers, behaviors, validators, and notification flows |
| `anti-patterns.md` | MediatR overuse, fat handlers, handler coupling |
| `integration-ddd.md` | When using DDD: domain events as notifications, aggregate event dispatch |
| `integration-graphql.md` | When using GraphQL: resolver wiring, error bridges, DataLoader decisions |

## Adapting to Your Project

- Detect the MediatR version from the project's packages
- Follow the project's existing patterns for handler organization and naming
- MediatR is framework-agnostic — it works with any API technology (REST, GraphQL, gRPC)
