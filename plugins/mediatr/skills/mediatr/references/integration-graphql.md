# Integration: MediatR + GraphQL

Use this reference when connecting a GraphQL API layer to MediatR handlers. The patterns here are framework-agnostic in concept, with HotChocolate examples where implementation-specific.

## Resolver → ISender Wiring

GraphQL resolvers become thin dispatchers — they build a MediatR request and send it:

```csharp
[QueryType]
public static class OrderQueries
{
    public static async Task<OrderDto?> GetOrderById(
        Guid id,
        ISender sender,
        CancellationToken ct)
    {
        return await sender.Send(new GetOrderByIdQuery(id), ct);
    }

    public static async Task<PagedResult<OrderDto>> GetOrders(
        int? first,
        string? after,
        ISender sender,
        CancellationToken ct)
    {
        return await sender.Send(new GetOrdersQuery(first ?? 20, after), ct);
    }
}

[MutationType]
public static class OrderMutations
{
    public static async Task<Guid> PlaceOrder(
        PlaceOrderInput input,
        ISender sender,
        CancellationToken ct)
    {
        return await sender.Send(new PlaceOrderCommand(input.CustomerId, input.Lines), ct);
    }
}
```

**Key principle**: Resolvers should contain no business logic — just map GraphQL inputs to MediatR requests and return the result.

## Error Bridging

MediatR handlers typically throw exceptions or return result types. GraphQL needs structured errors. The bridge depends on your error strategy.

### Exception-Based Handlers → GraphQL Errors

If handlers throw exceptions, catch and translate at the GraphQL layer:

```csharp
// MediatR handler throws
public async Task<Guid> Handle(PlaceOrderCommand request, CancellationToken ct)
{
    var customer = await _repo.GetByIdAsync(request.CustomerId, ct)
        ?? throw new NotFoundException("Customer", request.CustomerId.ToString());
    // ...
}

// Option A: GraphQL error filter (framework-level, catches all)
public class GraphQLErrorFilter : IErrorFilter
{
    public IError OnError(IError error)
    {
        return error.Exception switch
        {
            NotFoundException ex => error.WithMessage(ex.Message).WithCode("NOT_FOUND"),
            ValidationException ex => error.WithMessage("Validation failed")
                .WithCode("VALIDATION_ERROR")
                .SetExtension("errors", ex.Errors.Select(e => new { e.PropertyName, e.ErrorMessage })),
            DomainException ex => error.WithMessage(ex.Message).WithCode("DOMAIN_ERROR"),
            _ => error
        };
    }
}

// Option B: Mutation conventions (HotChocolate — per-mutation error types)
[MutationType]
public static class OrderMutations
{
    [Error<CustomerNotFoundException>]
    [Error<ValidationException>]
    public static async Task<Guid> PlaceOrder(
        PlaceOrderInput input, ISender sender, CancellationToken ct)
    {
        return await sender.Send(new PlaceOrderCommand(input.CustomerId, input.Lines), ct);
    }
}
```

### FluentValidation → GraphQL Error Mapping

When using MediatR's `ValidationBehavior` with FluentValidation, validation exceptions need mapping to GraphQL's error format:

```csharp
public class GraphQLErrorFilter : IErrorFilter
{
    public IError OnError(IError error)
    {
        if (error.Exception is ValidationException validationEx)
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

GraphQL DataLoaders and MediatR queries both fetch data, but they solve different problems:

| Concern | DataLoader | MediatR Query |
|---|---|---|
| Purpose | Batch + cache within a single GraphQL request | Dispatch a query to its handler |
| N+1 prevention | Yes — batches by key | No — each Send() is independent |
| Scope | Single request | Application-wide |
| Use for | Resolving related entities (e.g., order → customer) | Top-level queries, complex operations |

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

## Subscriptions via Notifications

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

Flow: Handler → `IPublisher.Publish()` → notification handler → `ITopicEventSender` → GraphQL subscription

## Registration

When using MediatR with GraphQL, register both in the composition root:

```csharp
// MediatR
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssemblies(/* module assemblies */);
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
});

builder.Services.AddValidatorsFromAssemblies(/* module assemblies */);

// GraphQL (framework-specific — HotChocolate example)
builder.Services
    .AddGraphQLServer()
    .AddMutationConventions()  // enables [Error<T>] typed payload errors
    .AddTypes()  // or add query/mutation types explicitly
    .AddFiltering()
    .AddSorting();

// Error filter bridges MediatR exceptions → GraphQL errors
builder.Services.AddErrorFilter<GraphQLErrorFilter>();
```

## Anti-Patterns

- **Don't send MediatR requests inside DataLoaders** — DataLoaders batch by key; MediatR doesn't batch. Use a repository or batch query directly.
- **Don't put GraphQL types in MediatR handlers** — handlers return DTOs or domain types, not GraphQL-specific types.
- **Don't skip MediatR for mutations** — if queries go through MediatR, mutations should too. Consistency matters.
- **Don't use MediatR notifications for subscription-only events** — if the only consumer is a GraphQL subscription, publish directly to `ITopicEventSender` from the handler instead of adding a notification indirection layer.
