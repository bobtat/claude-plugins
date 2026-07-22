# DDD + MediatR Integration

This reference covers how DDD concepts map to MediatR's request/notification model. For MediatR-specific patterns, see the MediatR skill.

## Domain Events as MediatR Notifications

In standalone DDD, `IDomainEvent` is a plain interface. When using MediatR for dispatch, extend it with `INotification`:

```csharp
// Standalone DDD (see domain-events.md)
public interface IDomainEvent
{
    DateTime OccurredAt { get; }
}

// With MediatR — add INotification so MediatR can publish it
public interface IDomainEvent : INotification
{
    DateTime OccurredAt { get; }
}
```

This single change lets you use `IPublisher.Publish()` to dispatch domain events and `INotificationHandler<T>` to handle them — replacing the custom `IDomainEventHandler<T>` with MediatR's built-in mechanism.

## Commands as MediatR Requests

In standalone DDD, commands are plain records and handlers are plain classes. With MediatR, commands implement `IRequest<T>` and handlers implement `IRequestHandler<,>`:

```csharp
// Standalone DDD (see application-layer.md)
public sealed record PlaceOrderCommand(Guid CustomerId, List<OrderLineInput> Lines);

public sealed class OrderCommandHandler
{
    public async Task<OrderId> HandleAsync(PlaceOrderCommand command, CancellationToken ct)
    { /* ... */ }
}

// With MediatR
public sealed record PlaceOrderCommand(Guid CustomerId, List<OrderLineInput> Lines)
    : IRequest<OrderId>;

public sealed class PlaceOrderCommandHandler
    : IRequestHandler<PlaceOrderCommand, OrderId>
{
    public async Task<OrderId> Handle(PlaceOrderCommand request, CancellationToken ct)
    { /* ... same logic ... */ }
}
```

The handler logic is identical — MediatR just provides the dispatch infrastructure and pipeline behaviors (validation, logging, transactions).

## Event Dispatching via EF Core Interceptor

MediatR provides the mechanism for the "infrastructure publishes events" step described in `domain-events.md`. The recommended approach is an EF Core `SaveChangesInterceptor`:

```csharp
public sealed class DomainEventDispatcherInterceptor(IPublisher publisher)
    : SaveChangesInterceptor
{
    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        if (eventData.Context is not null)
            await DispatchDomainEventsAsync(eventData.Context, cancellationToken);

        return result;
    }

    private async Task DispatchDomainEventsAsync(DbContext context, CancellationToken ct)
    {
        var aggregates = context.ChangeTracker
            .Entries<AggregateRoot>()
            .Where(e => e.Entity.DomainEvents.Count > 0)
            .Select(e => e.Entity)
            .ToList();

        var domainEvents = aggregates
            .SelectMany(a => a.DomainEvents)
            .ToList();

        // Clear before publishing to avoid re-entrancy
        aggregates.ForEach(a => a.ClearDomainEvents());

        foreach (var domainEvent in domainEvents)
            await publisher.Publish(domainEvent, ct);
    }
}
```

Register the interceptor on each module's DbContext:

```csharp
services.AddDbContext<OrderDbContext>((sp, options) =>
{
    options.UseYourProvider(connectionString);
    options.AddInterceptors(sp.GetRequiredService<DomainEventDispatcherInterceptor>());
});
```

## Cross-Module Event Contracts with MediatR

Cross-module event interfaces (see `domain-events.md`) should also extend `INotification` so handlers in other modules can subscribe:

```csharp
// In shared contracts project
public interface IOrderPlacedEvent : INotification
{
    Guid OrderId { get; }
    Guid CustomerId { get; }
    DateTime OccurredAt { get; }
}
```

## Consistency and Dispatch Timing

The interceptor above dispatches in `SavedChangesAsync` — after the transaction has committed. Every handler therefore runs post-commit and is eventually consistent, same-module or not, and a handler failure cannot roll back the original save. All notification handlers must be **idempotent** and **resilient**.

To make handler changes commit atomically with the aggregate, dispatch from `SavingChangesAsync` (before save) instead: same-module handlers then share the DbContext and transaction. The trade-off is that a handler failure rolls back the primary operation. See the MediatR skill's DDD integration reference ("Event Dispatch Timing") for choosing between the two.

## When to Use MediatR vs. Standalone

| Scenario | Recommendation |
|----------|---------------|
| Small project, few modules | Standalone handlers may be simpler |
| Need pipeline behaviors (validation, logging, transactions) | MediatR adds value |
| Cross-module event dispatch | MediatR's notification model fits well |
| Simple CRUD with no cross-cutting concerns | MediatR is overhead |
