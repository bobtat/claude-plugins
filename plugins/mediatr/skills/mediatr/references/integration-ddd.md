# Integration: MediatR + Domain-Driven Design

Use this reference when combining MediatR with DDD patterns. MediatR is not required for DDD, but it provides convenient infrastructure for dispatching commands, queries, and domain events.

## Commands as IRequest

DDD commands map naturally to MediatR requests:

```csharp
// Plain DDD command (no MediatR dependency)
public sealed record PlaceOrderCommand(Guid CustomerId, List<OrderLineInput> Lines);

// MediatR command — same record, implements IRequest<T>
public sealed record PlaceOrderCommand(
    Guid CustomerId,
    List<OrderLineInput> Lines) : IRequest<Guid>;
```

Handlers implement `IRequestHandler<TRequest, TResponse>` instead of a custom handler interface:

```csharp
public sealed class PlaceOrderCommandHandler(
    IOrderRepository repository,
    OrderDbContext dbContext)
    : IRequestHandler<PlaceOrderCommand, Guid>
{
    public async Task<Guid> Handle(PlaceOrderCommand request, CancellationToken ct)
    {
        var order = Order.Place(new CustomerId(request.CustomerId), request.Lines);
        await repository.AddAsync(order, ct);
        await dbContext.SaveChangesAsync(ct);
        return order.Id.Value;
    }
}
```

## Domain Events as INotification

DDD defines domain events as things that happened in the domain. MediatR's `INotification` provides the dispatch mechanism.

### Bridging IDomainEvent to INotification

Keep your domain event interface standalone, then create a bridge type:

```csharp
// Domain layer — no MediatR dependency
public interface IDomainEvent
{
    DateTime OccurredAt { get; }
}

public sealed record OrderPlacedEvent(Guid OrderId, DateTime OccurredAt) : IDomainEvent;

// Infrastructure — bridges domain events to MediatR
public sealed record DomainEventNotification<TEvent>(TEvent DomainEvent) : INotification
    where TEvent : IDomainEvent;
```

Alternatively, if you're comfortable with a lightweight dependency on `MediatR.Contracts` in your domain layer:

```csharp
// Domain layer — references MediatR.Contracts (just interfaces, no DI)
public interface IDomainEvent : INotification
{
    DateTime OccurredAt { get; }
}

public sealed record OrderPlacedEvent(Guid OrderId, DateTime OccurredAt) : IDomainEvent;
```

The first approach keeps the domain completely clean. The second is simpler but couples domain to `MediatR.Contracts`. Choose based on how strictly you isolate your domain layer.

## AggregateRoot Event Collection

Aggregates collect domain events, which are dispatched after persistence:

```csharp
// Non-generic marker so infrastructure (like the interceptor below) can find
// aggregates in the EF change tracker without knowing each aggregate's TId
public interface IAggregateRoot
{
    IReadOnlyList<IDomainEvent> DomainEvents { get; }
    void ClearDomainEvents();
}

// Base class (defined in your domain layer)
public abstract class AggregateRoot<TId> : IAggregateRoot where TId : notnull
{
    public TId Id { get; protected set; } = default!;
    
    private readonly List<IDomainEvent> _domainEvents = [];
    public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents;
    
    protected void RaiseDomainEvent(IDomainEvent domainEvent)
        => _domainEvents.Add(domainEvent);
    
    public void ClearDomainEvents() => _domainEvents.Clear();
}

// Aggregate raises events
public sealed class Order : AggregateRoot<OrderId>
{
    public static Order Place(CustomerId customerId, List<OrderLineInput> lines)
    {
        var order = new Order { Id = OrderId.New(), CustomerId = customerId };
        order.AddLines(lines);
        order.RaiseDomainEvent(new OrderPlacedEvent(order.Id.Value, DateTime.UtcNow));
        return order;
    }
}
```

## Dispatching Domain Events via EF Core Interceptor

An EF Core `SaveChangesInterceptor` collects events from aggregates and publishes them through MediatR after the save succeeds:

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

    private async Task DispatchDomainEventsAsync(
        DbContext context, CancellationToken ct)
    {
        // Entries<AggregateRoot<object>>() would match nothing — generic classes
        // are not covariant — so filter on the non-generic marker interface
        var aggregates = context.ChangeTracker
            .Entries<IAggregateRoot>()
            .Where(e => e.Entity.DomainEvents.Count > 0)
            .Select(e => e.Entity)
            .ToList();

        var events = aggregates.SelectMany(a => a.DomainEvents).ToList();
        aggregates.ForEach(a => a.ClearDomainEvents());

        foreach (var domainEvent in events)
        {
            // If using the wrapper approach:
            var notification = (INotification)Activator.CreateInstance(
                typeof(DomainEventNotification<>).MakeGenericType(domainEvent.GetType()),
                domainEvent)!;
            await publisher.Publish(notification, ct);

            // If IDomainEvent extends INotification directly:
            // await publisher.Publish(domainEvent, ct);
        }
    }
}
```

Register the interceptor:

```csharp
services.AddDbContext<OrderDbContext>((sp, options) =>
{
    options.UseYourProvider(connectionString);
    options.AddInterceptors(sp.GetRequiredService<DomainEventDispatcherInterceptor>());
});

services.AddScoped<DomainEventDispatcherInterceptor>();
```

### Event Dispatch Timing

- **After SaveChanges** (shown above): Events dispatch only after persistence succeeds. Handlers see committed state. This is the safest default.
- **Before SaveChanges**: Events dispatch within the same transaction. Handlers can modify state that gets saved. Riskier — a handler failure rolls back the primary operation.

Choose after-save unless you have a specific reason for before-save.

## Cross-Module Communication

In a modular monolith, MediatR enables modules to communicate without direct references:

```csharp
// Module A publishes a notification
public sealed record OrderPlacedEvent(Guid OrderId, DateTime OccurredAt) : IDomainEvent;

// Module B handles it (no reference to Module A's internals)
public sealed class UpdateInventoryOnOrderPlaced
    : INotificationHandler<DomainEventNotification<OrderPlacedEvent>>
{
    public async Task Handle(
        DomainEventNotification<OrderPlacedEvent> notification,
        CancellationToken ct)
    {
        var orderId = notification.DomainEvent.OrderId;
        // Update inventory...
    }
}
```

For this to work, the shared event type (`OrderPlacedEvent`) should live in a contracts/shared project that both modules reference.

## Validation in the Pipeline

MediatR's `ValidationBehavior` replaces manual validation in handlers:

```csharp
// Without MediatR: validation in handler
public async Task<Guid> Handle(PlaceOrderCommand command)
{
    if (command.Lines.Count == 0)
        throw new ValidationException("Order must have lines");
    // ...
}

// With MediatR: validation in pipeline
public sealed class PlaceOrderCommandValidator : AbstractValidator<PlaceOrderCommand>
{
    public PlaceOrderCommandValidator()
    {
        RuleFor(x => x.Lines).NotEmpty();
    }
}
// ValidationBehavior runs this automatically before the handler
```

## When to Use MediatR vs. Standalone DDD

| Concern | Standalone DDD | DDD + MediatR |
|---|---|---|
| Command dispatch | Custom dispatcher or direct calls | `ISender.Send()` with auto-routing |
| Domain event dispatch | Manual dispatch or custom event bus | `IPublisher.Publish()` via interceptor |
| Cross-cutting concerns | Decorators or manual | Pipeline behaviors |
| Validation | Manual or custom pipeline | `ValidationBehavior` + FluentValidation |
| Handler discovery | Manual registration | Assembly scanning |
| Complexity | Lower — you own everything | Higher — but less boilerplate |

**Use MediatR when**: You want automatic handler discovery, pipeline behaviors for cross-cutting concerns, or you're in a modular monolith where decoupled dispatch matters.

**Stay standalone when**: Your project is small, you want full control over dispatch, or you want zero infrastructure dependencies in your domain.
