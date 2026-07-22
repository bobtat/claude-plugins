# Integration: GraphQL + Domain-Driven Design

Use this reference when building a GraphQL API on top of a DDD-structured application. The key principle: **the schema exposes capabilities to consumers; the domain model enforces business rules internally**. These are different concerns with different shapes.

## Hiding Domain Internals Behind GraphQL Types

Domain aggregates, value objects, and events are implementation details. The GraphQL schema should not expose them directly.

```csharp
// Domain model (internal structure)
public sealed class Order : AggregateRoot<OrderId>
{
    public CustomerId CustomerId { get; }
    public Money TotalAmount { get; }
    public IReadOnlyList<OrderLine> Lines => _lines;
    public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents;
}

// GraphQL type (consumer-facing shape)
[ObjectType<Order>]
public static partial class OrderType
{
    static partial void Configure(IObjectTypeDescriptor<Order> descriptor)
    {
        // Hide domain internals
        descriptor.Ignore(o => o.DomainEvents);
        descriptor.Ignore(o => o.CustomerId); // expose via navigation instead
    }

    // Expose as graph navigation instead of raw IDs
    public static async Task<Customer> GetCustomer(
        [Parent] Order order,
        CustomerByIdDataLoader loader,
        CancellationToken ct)
        => await loader.LoadAsync(order.CustomerId.Value, ct);

    // Flatten value objects for consumer convenience
    public static decimal GetTotalAmount([Parent] Order order)
        => order.TotalAmount.Amount;

    public static string GetCurrency([Parent] Order order)
        => order.TotalAmount.Currency.Code;
}
```

### What to hide:
- `DomainEvents` collection
- Internal IDs (expose via graph navigation)
- Version/concurrency tokens
- Internal state machine details

### What to expose:
- Computed fields (`fullName`, `totalAmount`)
- Graph navigation (`order.customer`, `person.weightHistory`)
- Domain-meaningful enums (`OrderStatus`, `WeightUnit`)

## Modules Contributing to a Unified Schema

In a modular monolith with DDD bounded contexts, each module contributes types to one cohesive GraphQL schema:

```
Module A (Orders)     → OrderQueries, OrderMutations, OrderType
Module B (Shipping)   → ShipmentQueries, ShipmentType
Module C (Inventory)  → StockQueries, ProductType

                      ↓ unified at the API layer ↓

                    Single GraphQL Schema
```

### Module Registration Pattern

```csharp
// Each module exposes a registration extension
public static class OrderModuleGraphQLExtensions
{
    public static IRequestExecutorBuilder AddOrderGraphQLTypes(
        this IRequestExecutorBuilder builder)
    {
        return builder
            .AddType<OrderType>()
            .AddTypeExtension<OrderQueries>()
            .AddTypeExtension<OrderMutations>()
            .AddDataLoader<OrderByIdDataLoader>()
            .AddDataLoader<OrderLinesByOrderIdDataLoader>();
    }
}

// Composition root wires them together
builder.Services
    .AddGraphQLServer()
    .AddQueryType()
    .AddMutationType()
    .AddMutationConventions()  // enables [Error<T>] typed payload errors
    .AddOrderGraphQLTypes()
    .AddShippingGraphQLTypes()
    .AddInventoryGraphQLTypes();
```

### Cross-Module Type Extensions

One module can extend another module's types through the graph:

```csharp
// Shipping module extends Order with shipment data
// No direct reference to Order module internals needed
[ObjectType<Order>]
public static partial class OrderShippingExtensions
{
    [UsePaging]
    public static async Task<IEnumerable<Shipment>> GetShipments(
        [Parent] Order order,
        ShipmentsByOrderIdDataLoader loader,
        CancellationToken ct)
        => await loader.LoadAsync(order.Id.Value, ct);
}
```

This keeps modules decoupled while the schema feels unified.

## Mutations Map to Domain Commands

GraphQL mutations should map to domain actions, not CRUD operations:

```csharp
[MutationType]
public static class OrderMutations
{
    // Maps to the PlaceOrder domain command
    [Error<ValidationException>]
    [Error<InsufficientStockException>]
    public static async Task<Order> PlaceOrder(
        PlaceOrderInput input,
        IOrderRepository repository,
        OrderDbContext dbContext,
        CancellationToken ct)
    {
        // Delegate to domain — the aggregate enforces business rules
        var order = Order.Place(
            new CustomerId(input.CustomerId),
            input.Lines.Select(l => new OrderLineInput(
                new ProductId(l.ProductId), l.Quantity)).ToList());

        await repository.AddAsync(order, ct);
        await dbContext.SaveChangesAsync(ct);
        return order;
    }
}
```

**Key principle**: The mutation resolver is a thin adapter — it maps GraphQL inputs to domain operations and returns the result. Business logic stays in the domain.

## Domain Events Driving Subscriptions

Domain events can trigger GraphQL subscriptions for real-time updates:

```
Order.Place() → OrderPlacedEvent → Event Handler → ITopicEventSender → GraphQL Subscription
```

```csharp
// Domain event handler publishes to GraphQL subscription
public sealed class OrderPlacedSubscriptionHandler(ITopicEventSender eventSender)
{
    public async Task Handle(OrderPlacedEvent domainEvent, CancellationToken ct)
    {
        await eventSender.SendAsync(
            $"OrderPlaced:{domainEvent.CustomerId}",
            new OrderPlacedPayload(domainEvent.OrderId, domainEvent.OccurredAt),
            ct);
    }
}

// GraphQL subscription
[SubscriptionType]
public static class OrderSubscriptions
{
    [Subscribe]
    [Topic("OrderPlaced:{customerId}")]
    public static OrderPlacedPayload OnOrderPlaced(
        Guid customerId,
        [EventMessage] OrderPlacedPayload payload)
        => payload;
}
```

## Anti-Patterns

- **Don't expose aggregates directly** — use type extensions to shape the GraphQL representation
- **Don't let GraphQL drive domain design** — the domain model serves business rules, not API consumers
- **Don't put domain logic in resolvers** — resolvers are adapters, not business logic
- **Don't expose repository interfaces in the schema** — the schema is a consumer contract, not an internal API
- **Don't model GraphQL types 1:1 with aggregates** — the graph may combine or reshape data from multiple aggregates
