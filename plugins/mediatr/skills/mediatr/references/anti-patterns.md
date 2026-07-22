# Anti-Patterns

## 1. MediatR for Everything

**Problem**: Using MediatR to call code within the same class or module where a direct method call would suffice.

```csharp
// Bad — MediatR adds indirection with no benefit here
public class OrderService(ISender sender)
{
    public async Task ProcessOrder(Guid orderId)
    {
        var order = await sender.Send(new GetOrderQuery(orderId));
        var total = await sender.Send(new CalculateTotalQuery(order));
        await sender.Send(new ApplyDiscountCommand(order, total));
        await sender.Send(new SaveOrderCommand(order));
    }
}

// Good — direct calls when everything is in the same module
public class OrderService(IOrderRepository repository, IPricingCalculator pricing)
{
    public async Task ProcessOrder(Guid orderId)
    {
        var order = await repository.GetByIdAsync(orderId);
        var total = pricing.CalculateTotal(order);
        order.ApplyDiscount(total);
        await repository.SaveAsync(order);
    }
}
```

**When MediatR helps**: Crossing module boundaries, decoupling API layer from business logic, applying cross-cutting concerns via pipeline.

## 2. Fat Handlers

**Problem**: Handlers that contain too much logic — mixing orchestration, domain logic, persistence, and side effects.

```csharp
// Bad — handler is doing everything
public sealed class PlaceOrderCommandHandler : IRequestHandler<PlaceOrderCommand, Guid>
{
    public async Task<Guid> Handle(PlaceOrderCommand request, CancellationToken ct)
    {
        // Validation (should be in a validator or behavior)
        if (request.Lines.Count == 0) throw new Exception("No lines");

        // Domain logic (should be in domain objects)
        var total = request.Lines.Sum(l => l.Price * l.Quantity);
        if (total > 10000) total *= 0.95m; // discount logic buried here

        // Persistence
        var order = new Order { Total = total };
        _dbContext.Orders.Add(order);
        await _dbContext.SaveChangesAsync(ct);

        // Side effects
        await _emailService.SendConfirmationAsync(order.Id, ct);
        await _analyticsService.TrackAsync("order_placed", ct);

        return order.Id;
    }
}

// Good — handler orchestrates, delegates details
public sealed class PlaceOrderCommandHandler(
    IOrderRepository repository,
    OrderDbContext dbContext,
    IPublisher publisher)
    : IRequestHandler<PlaceOrderCommand, Guid>
{
    public async Task<Guid> Handle(PlaceOrderCommand request, CancellationToken ct)
    {
        // Validation handled by ValidationBehavior in pipeline
        var order = Order.Place(request.CustomerId, request.Lines);
        await repository.AddAsync(order, ct);
        await dbContext.SaveChangesAsync(ct);

        await publisher.Publish(new OrderPlacedNotification(order.Id, DateTime.UtcNow), ct);
        return order.Id;
    }
}
```

**Rule**: Handlers should be thin orchestrators — 10-20 lines. If a handler grows beyond that, logic is leaking in.

## 3. Handler-to-Handler Calls

**Problem**: One handler sending requests to other handlers, creating hidden coupling and fragile chains.

```csharp
// Bad — handler calls another handler via MediatR
public sealed class PlaceOrderCommandHandler(ISender sender)
    : IRequestHandler<PlaceOrderCommand, Guid>
{
    public async Task<Guid> Handle(PlaceOrderCommand request, CancellationToken ct)
    {
        // This creates a hidden dependency chain
        var inventory = await sender.Send(new CheckInventoryQuery(request.Lines), ct);
        var pricing = await sender.Send(new CalculatePricingQuery(request.Lines), ct);
        await sender.Send(new ReserveInventoryCommand(request.Lines), ct);
        // ...
    }
}

// Good — inject services directly
public sealed class PlaceOrderCommandHandler(
    IInventoryService inventory,
    IPricingCalculator pricing,
    IOrderRepository repository)
    : IRequestHandler<PlaceOrderCommand, Guid>
{
    public async Task<Guid> Handle(PlaceOrderCommand request, CancellationToken ct)
    {
        var available = await inventory.CheckAvailabilityAsync(request.Lines, ct);
        var total = pricing.CalculateTotal(request.Lines);
        // ...
    }
}
```

**Exception**: Cross-module communication in a modular monolith may legitimately use `ISender` to maintain module boundaries. But within a module, use direct dependencies.

## 4. Notifications as Commands

**Problem**: Using notifications (one-to-many) when you need request/response (one-to-one), or relying on notification handler execution for correctness.

```csharp
// Bad — using notification when you need a response or guaranteed single handler
await publisher.Publish(new ProcessPaymentNotification(orderId, amount), ct);
// Did it succeed? Who handled it? No way to know.

// Good — use a request when you need a response
var result = await sender.Send(new ProcessPaymentCommand(orderId, amount), ct);
// Clear: one handler, one result
```

**Rule**: If you need a return value, guaranteed execution, or exactly-one-handler semantics, use a request.

## 5. Behaviors with Business Logic

**Problem**: Putting domain-specific rules in pipeline behaviors that should apply only cross-cutting concerns.

```csharp
// Bad — business rule in a behavior
public sealed class OrderLimitBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : PlaceOrderCommand
{
    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        var orderCount = await _repo.CountTodaysOrdersAsync(request.CustomerId, ct);
        if (orderCount >= 10)
            throw new BusinessException("Daily order limit reached");
        return await next();
    }
}

// Good — business rule in the handler or domain object
public async Task<Guid> Handle(PlaceOrderCommand request, CancellationToken ct)
{
    var customer = await _customerRepo.GetByIdAsync(request.CustomerId, ct);
    customer.ValidateCanPlaceOrder(); // domain logic where it belongs
    // ...
}
```

**Rule**: Behaviors are for cross-cutting concerns (logging, validation, transactions, performance). Domain rules belong in handlers or domain objects.

## 6. Over-Pipelining

**Problem**: Creating a behavior for every concern, adding overhead and complexity.

```csharp
// Bad — too many behaviors for marginal benefit
cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(MetricsBehavior<,>));
cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(TracingBehavior<,>));
cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(CachingBehavior<,>));
cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(RetryBehavior<,>));
cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(TimeoutBehavior<,>));
cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(AuthorizationBehavior<,>));
cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(TransactionBehavior<,>));
cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(AuditBehavior<,>));
```

A typical project needs 2-4 behaviors. If you have more, several probably belong elsewhere:
- **Authorization** → use your framework's auth middleware
- **Caching** → use a caching layer or decorator
- **Retry/Timeout** → use Polly at the HTTP client level
- **Metrics/Tracing** → use OpenTelemetry middleware

## 7. Leaking MediatR into Domain

**Problem**: Domain objects depending on MediatR types.

```csharp
// Bad — domain entity depends on MediatR
public class Order
{
    private readonly List<INotification> _events = [];
    public IReadOnlyList<INotification> DomainEvents => _events;
    // Domain now depends on MediatR.Contracts
}

// Good — domain uses its own event abstraction
public class Order
{
    private readonly List<IDomainEvent> _events = [];
    public IReadOnlyList<IDomainEvent> DomainEvents => _events;
    // Infrastructure maps IDomainEvent → INotification
}
```

**Rule**: Domain objects should not reference MediatR types. If you're using domain events, define your own `IDomainEvent` interface and bridge to MediatR in infrastructure. See `integration-ddd.md` for the bridging pattern.

## 8. Testing Through MediatR

**Problem**: Routing every test through `ISender.Send()` instead of testing handlers directly.

```csharp
// Bad — unnecessary MediatR setup in every test
[Fact]
public async Task PlaceOrder_Works()
{
    var services = new ServiceCollection();
    services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(/*...*/));
    // ... lots of DI setup ...
    var sender = provider.GetRequiredService<ISender>();
    var result = await sender.Send(new PlaceOrderCommand(/*...*/));
}

// Good — test the handler directly
[Fact]
public async Task PlaceOrder_Works()
{
    var handler = new PlaceOrderCommandHandler(mockRepo, testDbContext);
    var result = await handler.Handle(new PlaceOrderCommand(/*...*/), CancellationToken.None);
}
```

Save integration tests (through the full pipeline) for verifying behavior wiring, not individual handler logic.

## Quick Reference

| Anti-Pattern | Fix |
|---|---|
| MediatR for everything | Direct calls within a module |
| Fat handlers | Delegate to services and domain objects |
| Handler-to-handler calls | Inject services directly |
| Notifications as commands | Use `IRequest<T>` when you need a response |
| Business logic in behaviors | Move to handlers or domain |
| Over-pipelining | 2-4 behaviors; use framework middleware for the rest |
| MediatR types in domain | Own abstractions, bridge in infrastructure |
| Testing through MediatR | Test handlers directly |
