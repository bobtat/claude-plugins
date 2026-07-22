# Requests & Handlers

## Requests (Commands & Queries)

A request is a message that expects exactly one handler and one response.

### Defining Requests

```csharp
// Command — changes state, returns a result
public sealed record PlaceOrderCommand(
    Guid CustomerId,
    List<OrderLineInput> Lines) : IRequest<Guid>;  // returns the new order ID

// Command — changes state, no meaningful return
public sealed record CancelOrderCommand(Guid OrderId) : IRequest;

// Query — reads data, no side effects
public sealed record GetOrderByIdQuery(Guid OrderId) : IRequest<OrderDto?>;

public sealed record GetOrdersQuery(
    int PageSize = 20,
    string? AfterCursor = null) : IRequest<PagedResult<OrderDto>>;
```

### Command Handler

```csharp
public sealed class PlaceOrderCommandHandler(
    IOrderRepository orderRepository,
    OrderDbContext dbContext)
    : IRequestHandler<PlaceOrderCommand, Guid>
{
    public async Task<Guid> Handle(
        PlaceOrderCommand request,
        CancellationToken cancellationToken)
    {
        // 1. Execute logic
        var order = CreateOrder(request);

        // 2. Persist
        await orderRepository.AddAsync(order, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        // 3. Return result
        return order.Id;
    }
}
```

### Query Handler

```csharp
public sealed class GetOrderByIdQueryHandler(OrderDbContext dbContext)
    : IRequestHandler<GetOrderByIdQuery, OrderDto?>
{
    public async Task<OrderDto?> Handle(
        GetOrderByIdQuery request,
        CancellationToken cancellationToken)
    {
        return await dbContext.Orders
            .Where(o => o.Id == request.OrderId)
            .Select(o => new OrderDto(o.Id, o.Status, o.TotalAmount))
            .FirstOrDefaultAsync(cancellationToken);
    }
}
```

## Error Strategy: Exceptions vs. Result Types

Pick one approach and use it consistently across the project.

### Option A: Exceptions (simpler, common)

Handlers throw exceptions. The API layer catches and maps them.

```csharp
public async Task<Guid> Handle(PlaceOrderCommand request, CancellationToken ct)
{
    var customer = await _customerRepo.GetByIdAsync(request.CustomerId, ct)
        ?? throw new NotFoundException("Customer", request.CustomerId.ToString());

    // Domain validation happens inside the aggregate — may throw DomainException
    var order = Order.Place(new CustomerId(request.CustomerId), /* ... */);

    await _repository.AddAsync(order, ct);
    await _dbContext.SaveChangesAsync(ct);
    return order.Id.Value;
}
```

**Pros**: Clean handler code, natural flow control, simple
**Cons**: Stack trace overhead, caller can't pattern-match on error types without catching

### Option B: Result types (explicit)

Handlers return a discriminated union or result object.

```csharp
public async Task<Result<Guid, OrderError>> Handle(PlaceOrderCommand request, CancellationToken ct)
{
    var customer = await _customerRepo.GetByIdAsync(request.CustomerId, ct);
    if (customer is null)
        return new OrderError.CustomerNotFound(request.CustomerId);

    var order = Order.Place(/* ... */);
    await _repository.AddAsync(order, ct);
    await _dbContext.SaveChangesAsync(ct);
    return order.Id.Value;
}
```

**Pros**: Explicit, compiler-enforced error handling, no exceptions for control flow
**Cons**: Verbose, every caller must unwrap, more boilerplate

### Recommendation

Start with **exceptions** unless you have a specific reason for result types. Exceptions integrate naturally with most API frameworks and pipeline behaviors (validation behavior throws, API layer catches).

## Command Idempotency

For commands where duplicates cause problems (e.g., recording financial transactions, creating duplicate entries), use idempotency keys:

```csharp
public sealed record PlaceOrderCommand(
    Guid CustomerId,
    List<OrderLineInput> Lines,
    Guid? IdempotencyKey = null) : IRequest<Guid>;

public sealed class PlaceOrderCommandHandler(/* ... */)
    : IRequestHandler<PlaceOrderCommand, Guid>
{
    public async Task<Guid> Handle(PlaceOrderCommand request, CancellationToken ct)
    {
        if (request.IdempotencyKey.HasValue)
        {
            var existing = await _repo.GetByIdempotencyKeyAsync(
                request.IdempotencyKey.Value, ct);
            if (existing is not null)
                return existing.Id;  // return existing, don't create duplicate
        }

        // ... normal creation logic
    }
}
```

## Stream Requests

For large result sets or real-time data, MediatR supports streaming via `IStreamRequest<T>`:

```csharp
public sealed record StreamOrdersQuery(
    Guid CustomerId,
    DateTime? Since = null) : IStreamRequest<OrderDto>;

public sealed class StreamOrdersQueryHandler(OrderDbContext dbContext)
    : IStreamRequestHandler<StreamOrdersQuery, OrderDto>
{
    public async IAsyncEnumerable<OrderDto> Handle(
        StreamOrdersQuery request,
        [EnumeratorCancellation] CancellationToken ct)
    {
        var query = dbContext.Orders
            .Where(o => o.CustomerId == request.CustomerId);

        if (request.Since.HasValue)
            query = query.Where(o => o.CreatedAt >= request.Since.Value);

        await foreach (var order in query
            .OrderByDescending(o => o.CreatedAt)
            .AsAsyncEnumerable()
            .WithCancellation(ct))
        {
            yield return new OrderDto(order.Id, order.Status, order.TotalAmount);
        }
    }
}
```

Use stream requests when the result set is large and you want to avoid loading everything into memory.

## Request Results — When to Use What

```csharp
// Return an ID — most common for creation commands
public sealed record PlaceOrderCommand(...) : IRequest<Guid>;

// Return void — plain IRequest for commands with no meaningful result
public sealed record CancelOrderCommand(Guid OrderId) : IRequest;

// Return a result object — when the caller needs computed info
public sealed record ProcessPaymentCommand(...) : IRequest<PaymentResult>;

// Return nullable DTO — for queries that may not find data
public sealed record GetOrderByIdQuery(Guid Id) : IRequest<OrderDto?>;

// Return a collection — for list queries
public sealed record GetOrdersQuery(...) : IRequest<PagedResult<OrderDto>>;
```

## Naming Conventions

- **Commands**: verb + noun + `Command` — `PlaceOrderCommand`, `CancelOrderCommand`
- **Queries**: `Get` + noun + `Query` — `GetOrderByIdQuery`, `GetOrdersQuery`
- **Handlers**: request name + `Handler` — `PlaceOrderCommandHandler`

## Grouping Handlers

For small modules, you can implement multiple handlers in one class:

```csharp
public sealed class OrderCommandHandlers(
    IOrderRepository repository,
    OrderDbContext dbContext)
    : IRequestHandler<PlaceOrderCommand, Guid>,
      IRequestHandler<CancelOrderCommand>
{
    public async Task<Guid> Handle(PlaceOrderCommand request, CancellationToken ct)
    { /* ... */ }

    public async Task Handle(CancelOrderCommand request, CancellationToken ct)
    { /* ... */ }
}
```

Split into separate classes when handlers have different dependencies or grow complex.
