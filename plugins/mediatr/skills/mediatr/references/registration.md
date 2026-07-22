# Registration & Configuration

## Basic Setup

```bash
# In the host project (composition root)
dotnet add package MediatR

# In libraries that define requests/handlers (lightweight, no DI)
dotnet add package MediatR.Contracts

# If using FluentValidation
dotnet add package FluentValidation
dotnet add package FluentValidation.DependencyInjectionExtensions
```

## Registering MediatR

```csharp
// In Program.cs
builder.Services.AddMediatR(cfg =>
{
    // Scan assemblies for handlers
    cfg.RegisterServicesFromAssemblies(
        typeof(Program).Assembly,
        typeof(OrderCommandHandler).Assembly,
        typeof(ShippingCommandHandler).Assembly);

    // Pipeline behaviors (order matters — first registered = outermost)
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(PerformanceBehavior<,>));
});

// FluentValidation — scan for validators
builder.Services.AddValidatorsFromAssemblies([
    typeof(OrderCommandHandler).Assembly,
    typeof(ShippingCommandHandler).Assembly
]);
```

## Assembly Scanning

MediatR automatically discovers:
- `IRequestHandler<TRequest, TResponse>` implementations
- `INotificationHandler<TNotification>` implementations
- `IStreamRequestHandler<TRequest, TResponse>` implementations

It does **not** auto-discover:
- `IPipelineBehavior<,>` — register explicitly
- `IValidator<T>` — needs FluentValidation's `AddValidatorsFromAssembly()`
- Custom `INotificationPublisher` — configure explicitly

## Package Split for Libraries

```
YourProject.Contracts              (shared types)
  └── MediatR.Contracts            (IRequest, INotification — lightweight)

YourProject.Orders.Module          (defines handlers)
  ├── MediatR.Contracts
  ├── FluentValidation             (for validators)
  └── Microsoft.EntityFrameworkCore

YourProject.Api                    (composition root)
  ├── MediatR                      (full package — includes DI)
  ├── FluentValidation.DependencyInjectionExtensions
  └── YourProject.Orders.Module
```

**Why**: Libraries reference `MediatR.Contracts` (lightweight — just interfaces). The host project references `MediatR` (full package) and wires everything together.

## ISender vs. IMediator vs. IPublisher

```csharp
// ISender — send requests (commands/queries). Use in most cases.
public interface ISender
{
    Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken ct);
}

// IPublisher — publish notifications. Use for event dispatch.
public interface IPublisher
{
    Task Publish(object notification, CancellationToken ct);
}

// IMediator — combines ISender + IPublisher. Avoid — prefer the specific interface.
public interface IMediator : ISender, IPublisher { }
```

**Prefer `ISender` or `IPublisher`** over `IMediator`:

```csharp
// Good — clear intent
public sealed class OrderController(ISender sender) { }
public sealed class EventDispatcher(IPublisher publisher) { }

// Avoid — unclear
public sealed class OrderController(IMediator mediator) { }
```

## Service Lifetimes

MediatR registers handlers as **transient** by default. This is correct because handlers may depend on scoped services (DbContext). Don't change the default lifetime.

## Adding a New Module Checklist

1. Add `MediatR.Contracts` package to the module
2. Add `FluentValidation` if the module has validators
3. Define requests, handlers, and validators
4. Add the module's assembly to `RegisterServicesFromAssemblies()` in the host
5. Add the module's assembly to `AddValidatorsFromAssemblies()` if needed
