# Application Layer & CQRS

## What is the Application Layer?

The application layer **orchestrates use cases**. It doesn't contain business rules — those live in the domain. Instead, it coordinates the flow: load aggregates, call domain methods, save changes, publish events, return results.

Think of it as the **stage director** — it tells the actors (domain objects) when to enter and what scene to play, but the actors have their own lines.

## Layer Boundaries

```
API Layer (REST/GraphQL/gRPC)   -> Receives requests, calls application layer
Application Layer               -> Orchestrates use cases, coordinates domain + infrastructure
Domain Layer                    -> Business rules, invariants, domain logic
Infrastructure Layer            -> Database, external services, messaging
```

### What goes WHERE:

| Concern | Layer |
|---------|-------|
| "Is this order valid?" | Domain (aggregate invariants) |
| "Can two bookings overlap?" | Domain (domain service) |
| "Load order, cancel it, save" | Application (command handler) |
| "Get order by ID for display" | Application (query handler) |
| "Map Order to OrderDto" | Application (handler or mapper) |
| "Execute SQL query" | Infrastructure (repository) |
| "Decode an API request" | API (controller/resolver) |

## Commands (Write Operations)

Commands represent **intent to change state**. Each command maps to a single use case.

### Command Definition

```csharp
// Commands are simple data carriers — no behavior
public sealed record PlaceOrderCommand(
    Guid CustomerId,
    List<OrderLineInput> Lines);

public sealed record CancelOrderCommand(Guid OrderId);

// Health domain example
public sealed record RecordWeightCommand(
    Guid PersonId,
    decimal Value,
    string Unit,
    DateTime? RecordedAt = null);
```

### Command Handler

```csharp
public sealed class OrderCommandHandler(
    IOrderRepository orderRepository,
    OrderDbContext dbContext)
{
    public async Task<OrderId> HandleAsync(
        PlaceOrderCommand command,
        CancellationToken ct)
    {
        // 1. Create domain object (validation happens inside)
        var lines = command.Lines.Select(l =>
            new OrderLine(new ProductId(l.ProductId), l.Quantity, new Money(l.Price, Currency.USD)))
            .ToList();
        var order = Order.Place(new CustomerId(command.CustomerId), lines);

        // 2. Persist
        await orderRepository.AddAsync(order, ct);
        await dbContext.SaveChangesAsync(ct);

        // 3. Return result
        return order.Id;
    }

    public async Task HandleAsync(
        CancelOrderCommand command,
        CancellationToken ct)
    {
        // 1. Load aggregate
        var order = await orderRepository.GetByIdAsync(
            new OrderId(command.OrderId), ct)
            ?? throw new NotFoundException("Order", command.OrderId.ToString());

        // 2. Execute domain logic (validation happens inside Cancel)
        order.Cancel();

        // 3. Persist
        await dbContext.SaveChangesAsync(ct);
    }
}
```

### Command Handler Rules

- **One handler per aggregate** (or per bounded area) — not one class per command
- **Load -> Execute -> Save** — that's the pattern, keep it mechanical
- **No business logic in handlers** — if you're writing `if` statements about domain rules, push that into the aggregate or a domain service
- **No direct infrastructure calls** — use repository interfaces, not DbContext directly for reads
- **Return minimal data** — return the ID or void, not the full aggregate. The query side handles reads

## Queries (Read Operations)

Queries retrieve data **without side effects**. They can bypass the domain model entirely and read straight from the database for performance.

### Query Handler

```csharp
public sealed class OrderQueryHandler(OrderDbContext dbContext)
{
    public async Task<OrderDto?> HandleAsync(
        Guid orderId,
        CancellationToken ct)
    {
        // Queries can use DbContext directly — project to DTOs
        return await dbContext.Orders
            .Where(o => o.Id == new OrderId(orderId))
            .Select(o => new OrderDto(
                o.Id.Value,
                o.CustomerId.Value,
                o.Status.ToString(),
                o.Lines.Select(l => new OrderLineDto(
                    l.ProductId.Value, l.Quantity, l.UnitPrice.Amount)).ToList()))
            .FirstOrDefaultAsync(ct);
    }
}
```

### Query Handler Rules

- **No state changes** — queries are read-only
- **Can bypass domain model** — project directly to DTOs from the database for performance
- **Can use DbContext directly** — no need for repositories (repositories are for aggregate loading)
- **Return DTOs, not domain objects** — prevents callers from accidentally mutating aggregates

## DTOs (Data Transfer Objects)

DTOs carry data between the application layer and the API layer. They are **not** domain objects.

```csharp
// Simple records — no behavior, no validation
public sealed record OrderDto(
    Guid Id,
    Guid CustomerId,
    string Status,
    List<OrderLineDto> Lines);

public sealed record OrderLineDto(
    Guid ProductId,
    int Quantity,
    decimal UnitPrice);
```

### DTO Guidelines

- **One DTO per use case** when data shapes differ — don't force one DTO to serve all queries
- **Flat structure** — avoid nesting DTOs deeply
- **Use primitives** — DTOs use `Guid`, `string`, `decimal`, not `OrderId`, `Money`
- **No domain logic** — computed display properties (like `TotalPrice`) are fine, business rules are not

## CQRS: How Deep to Go

CQRS exists on a spectrum. Start at Level 1:

```
Level 0: No CQRS           -> Same model for reads and writes (not recommended)
Level 1: Separate handlers  -> Different command/query handlers, same database  <- START HERE
Level 2: Separate models    -> Write model (aggregates) and read model (projections)
Level 3: Separate stores    -> Write database and read database with event sync
```

**Level 1** is the right starting point:
- Commands go through aggregates (consistency, validation)
- Queries project directly from the database (performance)
- Same database for both
- No event sourcing, no separate read store

Upgrade to Level 2 or 3 only when you have a concrete performance or scaling problem.

## When to Skip the Application Layer

For very simple modules with no business logic, the application layer may be unnecessary overhead. Signs you can simplify:

- The "command handler" just saves an entity with no validation
- The "query handler" just reads by ID
- There are no domain events to publish
- There are no cross-aggregate operations

In this case, the API layer can call the repository directly. But once business logic appears, introduce the application layer.
