# Domain Events

## Principles

- **Past-tense names** describing what happened (`OrderPlaced`, `WeightRecorded`, `UserRegistered`)
- **Immutable records** — events are facts that already occurred
- **Raised by aggregates** — only aggregate roots publish events via `AddDomainEvent()`
- **Handled asynchronously** for cross-module communication, synchronously within a module when needed

## IDomainEvent Interface

```csharp
// Base interface — place in your shared kernel or contracts project
public interface IDomainEvent
{
    DateTime OccurredAt { get; }
}
```

## Event Design

```csharp
// Module-internal event — uses strongly-typed IDs
public sealed record OrderPlacedEvent(OrderId OrderId) : IDomainEvent
{
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
}

public sealed record OrderCancelledEvent(OrderId OrderId) : IDomainEvent
{
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
}

// Event with rich data (from a health tracking domain)
public sealed record WeightRecordedEvent(
    PersonId PersonId,
    Weight Weight,
    DateTime RecordedAt) : IDomainEvent
{
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
}
```

## Cross-Module Events

When an event needs to cross bounded context boundaries, define a contract interface in your shared contracts project using **primitive types** (not module-specific value objects):

```csharp
// In shared contracts — uses primitives, not domain types
namespace YourProject.Contracts.Events;

public interface IOrderPlacedEvent
{
    Guid OrderId { get; }
    Guid CustomerId { get; }
    decimal TotalAmount { get; }
    DateTime OccurredAt { get; }
}

// In the Orders module — implements the contract
public sealed record OrderPlacedEvent(OrderId OrderId, CustomerId CustomerId, Money Total)
    : IDomainEvent, IOrderPlacedEvent
{
    public DateTime OccurredAt { get; } = DateTime.UtcNow;

    // Contract implementation — translate to primitives
    Guid IOrderPlacedEvent.OrderId => OrderId.Value;
    Guid IOrderPlacedEvent.CustomerId => CustomerId.Value;
    decimal IOrderPlacedEvent.TotalAmount => Total.Amount;
}
```

## Event Handling

```csharp
// Handler interface
public interface IDomainEventHandler<in TEvent> where TEvent : IDomainEvent
{
    Task HandleAsync(TEvent domainEvent, CancellationToken ct = default);
}

// Handler in a consuming module
public sealed class OnOrderPlaced(ILogger<OnOrderPlaced> logger)
    : IDomainEventHandler<IOrderPlacedEvent>
{
    public Task HandleAsync(IOrderPlacedEvent e, CancellationToken ct)
    {
        logger.LogInformation("Order placed: {OrderId}", e.OrderId);
        return Task.CompletedTask;
    }
}
```

## Event Dispatching

The DDD skill defines the **concept** of domain events — aggregates collect events, infrastructure publishes them. The actual dispatch mechanism depends on your infrastructure choice:

- **Manual dispatch** — iterate `aggregate.DomainEvents` after saving and call handlers
- **EF Core interceptor** — intercept `SaveChangesAsync` to publish events automatically
- **MediatR** — use `INotification` for event dispatch (see `integration-mediatr.md`)
- **Custom event bus** — for more complex pub/sub scenarios

## Guidelines

- **Don't put business logic in event handlers** — handlers trigger side effects or update read models
- **Events are contracts** — once published and consumed, changing an event's shape is a breaking change
- **Idempotent handlers** — handlers should be safe to run multiple times for the same event
- **Don't chain events deeply** — if event A triggers handler that raises event B that triggers C, the flow becomes hard to trace
