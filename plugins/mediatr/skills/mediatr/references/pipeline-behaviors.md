# Pipeline Behaviors

## What are Pipeline Behaviors?

Pipeline behaviors are middleware for MediatR requests. They wrap every `Send()` call, executing logic before and/or after the handler.

```
Request -> Behavior 1 -> Behavior 2 -> Behavior 3 -> Handler -> Response
              |              |              |
          Logging      Validation     Transaction
```

## Logging Behavior

```csharp
public sealed class LoggingBehavior<TRequest, TResponse>(
    ILogger<LoggingBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var requestName = typeof(TRequest).Name;
        logger.LogInformation("Handling {RequestName}", requestName);

        var stopwatch = Stopwatch.StartNew();
        try
        {
            var response = await next();
            stopwatch.Stop();
            logger.LogInformation("Handled {RequestName} in {ElapsedMs}ms",
                requestName, stopwatch.ElapsedMilliseconds);
            return response;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            logger.LogError(ex, "Error handling {RequestName} after {ElapsedMs}ms",
                requestName, stopwatch.ElapsedMilliseconds);
            throw;
        }
    }
}
```

## Validation Behavior (with FluentValidation)

```csharp
public sealed class ValidationBehavior<TRequest, TResponse>(
    IEnumerable<IValidator<TRequest>> validators)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (!validators.Any())
            return await next();

        var context = new ValidationContext<TRequest>(request);
        var validationResults = await Task.WhenAll(
            validators.Select(v => v.ValidateAsync(context, cancellationToken)));

        var failures = validationResults
            .SelectMany(r => r.Errors)
            .Where(f => f is not null)
            .ToList();

        if (failures.Count > 0)
            throw new ValidationException(failures);

        return await next();
    }
}
```

### Defining Validators

```csharp
public sealed class PlaceOrderCommandValidator : AbstractValidator<PlaceOrderCommand>
{
    public PlaceOrderCommandValidator()
    {
        RuleFor(x => x.CustomerId)
            .NotEmpty().WithMessage("Customer ID is required");

        RuleFor(x => x.Lines)
            .NotEmpty().WithMessage("Order must have at least one line item");
    }
}
```

## Transaction Behavior

Wraps handlers in a database transaction. Use a marker interface so commands opt in:

```csharp
// Marker interface
public interface ITransactionalRequest;

// For projects with multiple DbContexts (e.g., modular monolith),
// specify which DbContext owns the transaction:
public interface ITransactionalRequest<TDbContext> where TDbContext : DbContext;

public sealed class TransactionBehavior<TRequest, TResponse, TDbContext>(
    TDbContext dbContext,
    ILogger<TransactionBehavior<TRequest, TResponse, TDbContext>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : ITransactionalRequest<TDbContext>
    where TDbContext : DbContext
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (dbContext.Database.CurrentTransaction is not null)
            return await next();

        var strategy = dbContext.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await dbContext.Database
                .BeginTransactionAsync(cancellationToken);

            logger.LogDebug("Begin transaction for {RequestName}", typeof(TRequest).Name);

            try
            {
                var response = await next();
                await transaction.CommitAsync(cancellationToken);
                return response;
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        });
    }
}

// Usage — command opts in and specifies its DbContext
public sealed record PlaceOrderCommand(...)
    : IRequest<Guid>, ITransactionalRequest<OrderDbContext>;
```

For projects with a single DbContext, simplify by removing the generic parameter.

### Registering the transaction behavior

The three-parameter open generic cannot be registered against `IPipelineBehavior<,>` — the container has no way to infer `TDbContext` from a two-parameter service type and resolution fails. Close the third parameter with a per-module subclass and register that:

```csharp
public sealed class OrderTransactionBehavior<TRequest, TResponse>(
    OrderDbContext dbContext,
    ILogger<TransactionBehavior<TRequest, TResponse, OrderDbContext>> logger)
    : TransactionBehavior<TRequest, TResponse, OrderDbContext>(dbContext, logger)
    where TRequest : ITransactionalRequest<OrderDbContext>;

services.AddTransient(typeof(IPipelineBehavior<,>), typeof(OrderTransactionBehavior<,>));
```

The container honors the generic constraint: requests that don't implement `ITransactionalRequest<OrderDbContext>` simply skip this behavior.

## Performance Behavior

Warns on slow requests:

```csharp
public sealed class PerformanceBehavior<TRequest, TResponse>(
    ILogger<PerformanceBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private const int SlowThresholdMs = 500;

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        var response = await next();
        stopwatch.Stop();

        if (stopwatch.ElapsedMilliseconds > SlowThresholdMs)
        {
            logger.LogWarning("Slow request: {RequestName} took {ElapsedMs}ms",
                typeof(TRequest).Name, stopwatch.ElapsedMilliseconds);
        }

        return response;
    }
}
```

## Behavior Execution Order

Behaviors execute in registration order. Register from outermost to innermost:

```csharp
services.AddTransient(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));       // 1st
services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));     // 2nd
services.AddTransient(typeof(IPipelineBehavior<,>), typeof(PerformanceBehavior<,>));    // 3rd
services.AddTransient(typeof(IPipelineBehavior<,>), typeof(OrderTransactionBehavior<,>)); // 4th
// -> Handler executes last
```

## Selective Behaviors with Constraints

Apply behaviors only to certain request types:

```csharp
// Only applies to commands that opt in
public sealed class TransactionBehavior<TRequest, TResponse, TDbContext>
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : ITransactionalRequest<TDbContext>
    where TDbContext : DbContext
{ }

// Applies to all requests, but skips if no validators registered
public sealed class ValidationBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{ }
```

## Anti-Patterns

- **Don't modify the request in a behavior** — behaviors should observe or reject, not transform
- **Don't put business logic in behaviors** — validation is OK, but domain rules belong elsewhere
- **Don't create behaviors for one-off concerns** — if only one handler needs it, put it in that handler
- **Don't over-pipeline** — each behavior adds overhead; only add for truly cross-cutting concerns
- **Don't use behaviors for authorization** — use your API framework's auth middleware instead
