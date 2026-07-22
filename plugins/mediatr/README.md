# mediatr

A Claude Code plugin that gives Claude MediatR expertise for in-process messaging in .NET.

## What It Does

Adds one auto-triggering skill that activates whenever Claude is implementing request/response dispatching, notification publishing, pipeline behaviors, or any other use of MediatR. It provides:

- **The building blocks** — requests (`IRequest<T>`), notifications (`INotification`), pipeline behaviors (`IPipelineBehavior<,>`), and stream requests (`IStreamRequest<T>`)
- **Core principles** — one handler per request, thin handlers that orchestrate rather than compute, cross-cutting concerns in the pipeline, `ISender`/`IPublisher` over `IMediator`
- **Implementation references** — request and handler design (including error strategies, idempotency, streaming), notification publishing with multiple handlers, validation/logging/transaction/performance behaviors, DI registration and service lifetimes, and testing handlers, behaviors, and notification flows
- **An anti-pattern catalog** — MediatR overuse, fat handlers, handler-to-handler coupling
- **Integration notes** — domain events as notifications and aggregate event dispatch (DDD), and resolver wiring with error bridges (GraphQL)

## Installation

```
/plugin marketplace add bobtat/claude-plugins
/plugin install mediatr@bobtat-plugins
```

Or test locally:

```bash
claude --plugin-dir plugins/mediatr
```

## Usage

No commands to run — the skill triggers automatically on requests like:

- "Add a command handler for cancelling an order"
- "How do I add validation to every request?"
- "Should this be a notification or a request?"
- "Wire up domain event dispatch through MediatR"
- "Test this pipeline behavior"

Claude loads the lean core skill on trigger and pulls in the detailed references only when the task needs them.

## Structure

```
mediatr/
├── .claude-plugin/plugin.json
└── skills/mediatr/
    ├── SKILL.md                      # Building blocks, core principles, reference index
    └── references/
        ├── requests-handlers.md      # Requests, handlers, errors, idempotency, streams
        ├── notifications.md          # Publishing, multiple handlers, error handling
        ├── pipeline-behaviors.md     # Validation, logging, transaction, performance
        ├── registration.md           # DI setup, assembly scanning, lifetimes
        ├── testing.md                # Handlers, behaviors, validators, notification flows
        ├── anti-patterns.md          # Overuse, fat handlers, handler coupling
        ├── integration-ddd.md        # Domain events as notifications
        └── integration-graphql.md    # Resolver wiring, error bridges
```

## License

MIT
