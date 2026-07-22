# Notifications

## What are Notifications?

Notifications are fire-and-forget messages published to **zero or more** handlers. Unlike requests, there's no return value — handlers react to something that happened.

## Defining Notifications

```csharp
// Simple notification
public sealed record OrderPlacedNotification(Guid OrderId, DateTime OccurredAt) : INotification;

// Notification with rich data
public sealed record PaymentProcessedNotification(
    Guid OrderId,
    Guid PaymentId,
    decimal Amount,
    DateTime ProcessedAt) : INotification;
```

## Notification Handlers

```csharp
// Handler 1: Send confirmation email
public sealed class SendOrderConfirmationEmail(IEmailService emailService)
    : INotificationHandler<OrderPlacedNotification>
{
    public async Task Handle(OrderPlacedNotification notification, CancellationToken ct)
    {
        await emailService.SendOrderConfirmationAsync(notification.OrderId, ct);
    }
}

// Handler 2: Update analytics
public sealed class UpdateOrderAnalytics(IAnalyticsService analytics)
    : INotificationHandler<OrderPlacedNotification>
{
    public async Task Handle(OrderPlacedNotification notification, CancellationToken ct)
    {
        await analytics.TrackOrderPlacedAsync(notification.OrderId, ct);
    }
}

// Handler 3: Log it
public sealed class LogOrderPlaced(ILogger<LogOrderPlaced> logger)
    : INotificationHandler<OrderPlacedNotification>
{
    public Task Handle(OrderPlacedNotification notification, CancellationToken ct)
    {
        logger.LogInformation("Order placed: {OrderId}", notification.OrderId);
        return Task.CompletedTask;
    }
}
```

All registered handlers run when `IPublisher.Publish()` is called. **Order is not guaranteed.**

## Publishing Notifications

```csharp
public sealed class PlaceOrderCommandHandler(
    IOrderRepository repository,
    OrderDbContext dbContext,
    IPublisher publisher)
    : IRequestHandler<PlaceOrderCommand, Guid>
{
    public async Task<Guid> Handle(PlaceOrderCommand request, CancellationToken ct)
    {
        var order = CreateOrder(request);
        await repository.AddAsync(order, ct);
        await dbContext.SaveChangesAsync(ct);

        // Publish after persistence succeeds
        await publisher.Publish(
            new OrderPlacedNotification(order.Id, DateTime.UtcNow), ct);

        return order.Id;
    }
}
```

## Handler Ordering

MediatR does not guarantee handler execution order. If ordering matters, consolidate into a single orchestrating handler:

```csharp
// If step 1 must complete before step 2, don't rely on handler order
public sealed class OnOrderPlacedOrchestrator(
    IEmailService email,
    IAnalyticsService analytics,
    ILogger<OnOrderPlacedOrchestrator> logger)
    : INotificationHandler<OrderPlacedNotification>
{
    public async Task Handle(OrderPlacedNotification notification, CancellationToken ct)
    {
        // Step 1: Must succeed
        await email.SendOrderConfirmationAsync(notification.OrderId, ct);

        // Step 2: Runs after email succeeds
        await analytics.TrackOrderPlacedAsync(notification.OrderId, ct);

        logger.LogInformation("Processed order placed: {OrderId}", notification.OrderId);
    }
}
```

**Rule**: If you need ordering, you need a single handler. Independent handlers should be truly independent.

## Error Handling

By default, MediatR **stops publishing** if a handler throws. To publish to all handlers regardless of failures:

```csharp
// Custom publisher that continues on failure
public sealed class ResilientPublisher : INotificationPublisher
{
    public async Task Publish(
        IEnumerable<NotificationHandlerExecutor> handlerExecutors,
        INotification notification,
        CancellationToken cancellationToken)
    {
        var exceptions = new List<Exception>();

        foreach (var handler in handlerExecutors)
        {
            try
            {
                await handler.HandlerCallback(notification, cancellationToken);
            }
            catch (Exception ex)
            {
                exceptions.Add(ex);
            }
        }

        if (exceptions.Count > 0)
            throw new AggregateException(exceptions);
    }
}

// Register it
services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(Program).Assembly);
    cfg.NotificationPublisherType = typeof(ResilientPublisher);
});
```

MediatR also ships `TaskWhenAllPublisher`, which runs all handlers concurrently and surfaces every failure — consider it before writing a custom publisher.

Or handle errors per-handler with try-catch:

```csharp
public async Task Handle(OrderPlacedNotification notification, CancellationToken ct)
{
    try
    {
        await _emailService.SendAsync(notification.OrderId, ct);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to send confirmation for {OrderId}", notification.OrderId);
        // Don't rethrow — other handlers should still run
    }
}
```

## Handler Guidelines

- **Idempotent** — safe to run multiple times for the same notification
- **Independent** — don't depend on other handlers running first
- **Fast** — for slow work (sending emails, calling APIs), queue a background job instead
- **No return values** — notifications are fire-and-forget; use requests for request/response

## Cancellation and Timeout

If notification handlers run during a critical path (e.g., inside a database transaction), slow handlers hold resources open. Mitigate this:

```csharp
// Add a timeout to handlers that might be slow
public async Task Handle(OrderPlacedNotification notification, CancellationToken ct)
{
    using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
    timeoutCts.CancelAfter(TimeSpan.FromSeconds(2));

    try
    {
        await _externalService.NotifyAsync(notification.OrderId, timeoutCts.Token);
    }
    catch (OperationCanceledException)
    {
        _logger.LogWarning("Timed out notifying external service for {OrderId}", notification.OrderId);
    }
}
```

**Rule**: Notification handlers should complete quickly. Anything slow should be queued as a background job.
