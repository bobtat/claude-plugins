# DDD + GraphQL Integration

This reference covers how to expose domain models through a GraphQL API while keeping domain internals hidden. For GraphQL-specific patterns, see the GraphQL skill.

## Hiding Domain Internals Behind GraphQL Types

GraphQL types are a **separate layer** from your domain model. Don't expose aggregates directly — shape the schema for consumers:

```csharp
// Domain aggregate (internal)
public sealed class Order : AggregateRoot
{
    public OrderId Id { get; private init; }
    public CustomerId CustomerId { get; private init; }
    public OrderStatus Status { get; private set; }
    private readonly List<OrderLine> _lines = [];
    public IReadOnlyList<OrderLine> Lines => _lines.AsReadOnly();
    // ... domain methods, events, etc.
}

// GraphQL type (consumer-facing) — hides domain internals
// The implementation depends on your GraphQL framework (HotChocolate, etc.)
// but the principle is the same: expose what consumers need, hide implementation
```

The GraphQL schema should feel like a clean API, not a window into your aggregates.

## Modules Contributing to a Unified Schema

In a modular monolith, each module contributes its own types, queries, and mutations to a **unified GraphQL schema**:

```
Orders Module    → OrderType, OrderQueries, OrderMutations
Shipping Module  → ShipmentType, ShipmentQueries, ShipmentMutations
Customers Module → CustomerType, CustomerQueries
```

The schema appears as one cohesive API to consumers — module boundaries are invisible.

### Cross-Module Type Extensions

Module B can extend a type owned by Module A without creating a direct dependency. For example, the Shipping module adds a `shipments` field to the `Order` type:

- The Orders module defines the `Order` type with order-specific fields
- The Shipping module adds a `shipments` field that resolves shipping data for an order
- Both modules reference the shared contracts project for the `OrderId` type

The specific mechanism depends on your GraphQL framework (e.g., HotChocolate type extensions, schema stitching).

## Domain Events Driving Subscriptions

GraphQL subscriptions pair naturally with domain events:

```
Domain Event (OrderPlaced) → Event Handler → Subscription Topic → Client
```

When an aggregate raises a domain event, a notification handler can publish to the GraphQL subscription system. This keeps the domain layer unaware of GraphQL while providing real-time updates.

## Mutations Map to Commands

GraphQL mutations should map to **domain actions**, not CRUD operations:

```graphql
# Good — domain actions
type Mutation {
  placeOrder(input: PlaceOrderInput!): PlaceOrderPayload!
  cancelOrder(input: CancelOrderInput!): CancelOrderPayload!
  shipOrder(input: ShipOrderInput!): ShipOrderPayload!
}

# Bad — generic CRUD
type Mutation {
  createOrder(input: OrderInput!): Order!
  updateOrder(id: ID!, input: OrderInput!): Order!
  deleteOrder(id: ID!): Boolean!
}
```

Each mutation corresponds to a command in the application layer.

## Module Registration for GraphQL

Each module registers its GraphQL types alongside its services:

```csharp
public static class OrderModuleRegistration
{
    public static IServiceCollection AddOrderModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Domain infrastructure (repositories, DbContext, etc.)
        // ...
        return services;
    }

    // Separate method for GraphQL type registration
    // Called from the host project's GraphQL setup
    public static IRequestExecutorBuilder AddOrderGraphQLTypes(
        this IRequestExecutorBuilder builder)
    {
        return builder
            .AddType<OrderType>()
            .AddTypeExtension<OrderQueries>()
            .AddTypeExtension<OrderMutations>();
    }
}
```
