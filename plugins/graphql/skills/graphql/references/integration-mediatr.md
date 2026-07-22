# Integration: GraphQL + MediatR

Use this reference when connecting a GraphQL API layer to MediatR for command/query dispatch. The key benefit: resolvers become thin dispatchers, and cross-cutting concerns (validation, logging, transactions) are handled by MediatR's pipeline.

## Resolvers as Thin Dispatchers

Instead of putting business logic in resolvers, dispatch through MediatR:

```csharp
// Without MediatR — resolver contains logic
[MutationType]
public static class OrderMutations
{
    [Error<ValidationException>]
    public static async Task<Order> PlaceOrder(
        PlaceOrderInput input,
        IOrderRepository repository,
        AppDbContext dbContext,
        CancellationToken ct)
    {
        // Business logic in the resolver
        var order = Order.Place(input.CustomerId, input.Lines);
        await repository.AddAsync(order, ct);
        await dbContext.SaveChangesAsync(ct);
        return order;
    }
}

// With MediatR — resolver dispatches
[MutationType]
public static class OrderMutations
{
    [Error<ValidationException>]
    public static async Task<Guid> PlaceOrder(
        PlaceOrderInput input,
        ISender sender,
        CancellationToken ct)
    {
        return await sender.Send(
            new PlaceOrderCommand(input.CustomerId, input.Lines), ct);
    }
}
```

### When to use MediatR dispatch:
- Mutations with business logic, validation, or transactions
- Queries with complex logic beyond simple data retrieval
- When you want pipeline behaviors (validation, logging) applied consistently

### When direct resolution is fine:
- Simple queries that just read from the database
- Computed fields on type extensions
- Fields resolved via DataLoaders

## Error Bridging

MediatR handlers throw exceptions or return result types. GraphQL needs structured errors. Bridge them at the resolver or framework level.

### Exception-Based Handlers

```csharp
// MediatR handler throws domain exceptions
public async Task<Guid> Handle(PlaceOrderCommand request, CancellationToken ct)
{
    var customer = await _repo.GetByIdAsync(request.CustomerId, ct)
        ?? throw new NotFoundException("Customer", request.CustomerId.ToString());
    // ...
}

// Option A: HotChocolate mutation conventions (per-mutation error types)
[MutationType]
public static class OrderMutations
{
    [Error<NotFoundException>]
    [Error<ValidationException>]
    public static async Task<Guid> PlaceOrder(
        PlaceOrderInput input, ISender sender, CancellationToken ct)
        => await sender.Send(new PlaceOrderCommand(input.CustomerId, input.Lines), ct);
}

// Option B: Global error filter (catches all unhandled exceptions)
public class GraphQLErrorFilter : IErrorFilter
{
    public IError OnError(IError error)
    {
        return error.Exception switch
        {
            NotFoundException ex => error.WithMessage(ex.Message).WithCode("NOT_FOUND"),
            ValidationException ex => error.WithMessage("Validation failed")
                .WithCode("VALIDATION_ERROR")
                .SetExtension("errors",
                    ex.Errors.Select(e => new { e.PropertyName, e.ErrorMessage })),
            _ => error
        };
    }
}
```

### FluentValidation → GraphQL Error Mapping

When using MediatR's `ValidationBehavior` with FluentValidation, validation exceptions need mapping:

```csharp
public class GraphQLErrorFilter : IErrorFilter
{
    public IError OnError(IError error)
    {
        if (error.Exception is FluentValidation.ValidationException validationEx)
        {
            return ErrorBuilder.New()
                .SetMessage("One or more validation errors occurred.")
                .SetCode("VALIDATION_ERROR")
                .SetExtension("errors", validationEx.Errors.Select(e => new
                {
                    field = e.PropertyName,
                    message = e.ErrorMessage
                }))
                .Build();
        }

        return error;
    }
}
```

## DataLoader vs. MediatR for Data Fetching

Both DataLoaders and MediatR queries fetch data, but they solve different problems:

| Concern | DataLoader | MediatR Query |
|---|---|---|
| Purpose | Batch + cache within a single GraphQL request | Dispatch a query to its handler |
| N+1 prevention | Yes — batches by key | No — each `Send()` is independent |
| Scope | Single request | Application-wide |
| Use for | Resolving related entities (order → customer) | Top-level queries, complex operations |

**Guidelines**:
- Use **DataLoaders** for resolving associations in nested GraphQL fields (prevents N+1)
- Use **MediatR queries** for top-level query resolvers and operations with business logic
- Don't replace DataLoaders with MediatR — they serve complementary purposes

```csharp
// Top-level query — use MediatR
[QueryType]
public static class OrderQueries
{
    public static async Task<OrderDto?> GetOrderById(
        Guid id, ISender sender, CancellationToken ct)
        => await sender.Send(new GetOrderByIdQuery(id), ct);
}

// Nested field resolution — use DataLoader
[ObjectType<OrderDto>]
public static partial class OrderType
{
    public static async Task<CustomerDto> GetCustomer(
        [Parent] OrderDto order,
        ICustomerByIdDataLoader loader,
        CancellationToken ct)
        => await loader.LoadAsync(order.CustomerId, ct);
}
```

## Subscription Publishing via Notifications

MediatR notifications can trigger GraphQL subscriptions:

```csharp
// MediatR notification handler publishes to subscription topic
public sealed class OrderPlacedSubscriptionHandler(
    ITopicEventSender eventSender)
    : INotificationHandler<OrderPlacedNotification>
{
    public async Task Handle(OrderPlacedNotification notification, CancellationToken ct)
    {
        await eventSender.SendAsync(
            $"OrderPlaced:{notification.CustomerId}",
            new OrderPlacedPayload(notification.OrderId, notification.OccurredAt),
            ct);
    }
}
```

Flow: Handler → `IPublisher.Publish()` → notification handler → `ITopicEventSender` → subscription

## Registration

```csharp
// MediatR
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssemblies(/* module assemblies */);
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
});

builder.Services.AddValidatorsFromAssemblies(/* module assemblies */);

// GraphQL
builder.Services
    .AddGraphQLServer()
    .AddQueryType()
    .AddMutationType()
    .AddMutationConventions()  // enables [Error<T>] typed payload errors
    .AddTypes()
    .AddFiltering()
    .AddSorting();

// Error filter bridges MediatR exceptions → GraphQL errors
builder.Services.AddErrorFilter<GraphQLErrorFilter>();
```

## Anti-Patterns

- **Don't send MediatR requests inside DataLoaders** — DataLoaders batch by key; MediatR doesn't. Use a repository or batch query directly.
- **Don't put GraphQL types in MediatR handlers** — handlers return DTOs or domain types, not GraphQL-specific types.
- **Don't skip MediatR for mutations** — if queries go through MediatR, mutations should too. Consistency matters.
- **Don't use MediatR notifications for subscription-only events** — if the only consumer is a GraphQL subscription, publish directly to `ITopicEventSender` from the handler instead of adding a notification indirection layer.
