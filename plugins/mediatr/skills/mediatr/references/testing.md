# Testing

## Testing Handlers

Handlers are plain classes — test them directly without MediatR infrastructure.

### Command Handler Test

```csharp
public class PlaceOrderCommandHandlerTests
{
    private readonly IOrderRepository _repository = Substitute.For<IOrderRepository>();
    private readonly OrderDbContext _dbContext; // use in-memory or test DB
    private readonly PlaceOrderCommandHandler _handler;

    public PlaceOrderCommandHandlerTests()
    {
        _dbContext = CreateTestDbContext();
        _handler = new PlaceOrderCommandHandler(_repository, _dbContext);
    }

    [Fact]
    public async Task Handle_ValidCommand_ReturnsNewOrderId()
    {
        // Arrange
        var command = new PlaceOrderCommand(
            CustomerId: Guid.NewGuid(),
            Lines: [new OrderLineInput("SKU-001", 2)]);

        // Act
        var orderId = await _handler.Handle(command, CancellationToken.None);

        // Assert
        orderId.Should().NotBeEmpty();
        await _repository.Received(1).AddAsync(
            Arg.Is<Order>(o => o.Id == orderId),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_EmptyLines_ThrowsValidationException()
    {
        var command = new PlaceOrderCommand(
            CustomerId: Guid.NewGuid(),
            Lines: []);

        await _handler.Invoking(h => h.Handle(command, CancellationToken.None))
            .Should().ThrowAsync<DomainException>();
    }
}
```

### Query Handler Test

```csharp
public class GetOrderByIdQueryHandlerTests
{
    [Fact]
    public async Task Handle_ExistingOrder_ReturnsDto()
    {
        // Arrange
        await using var dbContext = CreateTestDbContext();
        var order = new Order { Id = Guid.NewGuid(), Status = "Active", TotalAmount = 99.99m };
        dbContext.Orders.Add(order);
        await dbContext.SaveChangesAsync();

        var handler = new GetOrderByIdQueryHandler(dbContext);

        // Act
        var result = await handler.Handle(
            new GetOrderByIdQuery(order.Id), CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.Status.Should().Be("Active");
    }

    [Fact]
    public async Task Handle_NonExistentOrder_ReturnsNull()
    {
        await using var dbContext = CreateTestDbContext();
        var handler = new GetOrderByIdQueryHandler(dbContext);

        var result = await handler.Handle(
            new GetOrderByIdQuery(Guid.NewGuid()), CancellationToken.None);

        result.Should().BeNull();
    }
}
```

## Testing Pipeline Behaviors

### Validation Behavior

```csharp
public class ValidationBehaviorTests
{
    [Fact]
    public async Task Handle_NoValidators_CallsNext()
    {
        // Arrange
        var behavior = new ValidationBehavior<TestRequest, string>(
            Enumerable.Empty<IValidator<TestRequest>>());

        var nextCalled = false;
        RequestHandlerDelegate<string> next = () =>
        {
            nextCalled = true;
            return Task.FromResult("ok");
        };

        // Act
        var result = await behavior.Handle(new TestRequest(), next, CancellationToken.None);

        // Assert
        nextCalled.Should().BeTrue();
        result.Should().Be("ok");
    }

    [Fact]
    public async Task Handle_ValidationFails_ThrowsWithoutCallingNext()
    {
        // Arrange
        var validator = Substitute.For<IValidator<TestRequest>>();
        validator.ValidateAsync(Arg.Any<ValidationContext<TestRequest>>(), Arg.Any<CancellationToken>())
            .Returns(new ValidationResult([new ValidationFailure("Name", "Required")]));

        var behavior = new ValidationBehavior<TestRequest, string>([validator]);
        var nextCalled = false;
        RequestHandlerDelegate<string> next = () =>
        {
            nextCalled = true;
            return Task.FromResult("ok");
        };

        // Act & Assert
        await behavior.Invoking(b => b.Handle(new TestRequest(), next, CancellationToken.None))
            .Should().ThrowAsync<ValidationException>();
        nextCalled.Should().BeFalse();
    }

    private sealed record TestRequest : IRequest<string>;
}
```

### Logging Behavior

```csharp
public class LoggingBehaviorTests
{
    [Fact]
    public async Task Handle_LogsRequestNameAndDuration()
    {
        var logger = Substitute.For<ILogger<LoggingBehavior<TestRequest, string>>>();
        var behavior = new LoggingBehavior<TestRequest, string>(logger);

        RequestHandlerDelegate<string> next = () => Task.FromResult("ok");

        await behavior.Handle(new TestRequest(), next, CancellationToken.None);

        logger.ReceivedWithAnyArgs(2).Log(default, default, default, default, default!);
    }
}
```

## Testing Validators

Test FluentValidation validators directly:

```csharp
public class PlaceOrderCommandValidatorTests
{
    private readonly PlaceOrderCommandValidator _validator = new();

    [Fact]
    public async Task Validate_ValidCommand_Passes()
    {
        var command = new PlaceOrderCommand(
            CustomerId: Guid.NewGuid(),
            Lines: [new OrderLineInput("SKU-001", 2)]);

        var result = await _validator.ValidateAsync(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Validate_EmptyCustomerId_Fails()
    {
        var command = new PlaceOrderCommand(
            CustomerId: Guid.Empty,
            Lines: [new OrderLineInput("SKU-001", 2)]);

        var result = await _validator.ValidateAsync(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == "CustomerId");
    }

    [Fact]
    public async Task Validate_NoLines_Fails()
    {
        var command = new PlaceOrderCommand(
            CustomerId: Guid.NewGuid(),
            Lines: []);

        var result = await _validator.ValidateAsync(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.PropertyName == "Lines");
    }
}
```

## Testing Notification Handlers

```csharp
public class SendOrderConfirmationEmailTests
{
    [Fact]
    public async Task Handle_SendsEmailForOrder()
    {
        var emailService = Substitute.For<IEmailService>();
        var handler = new SendOrderConfirmationEmail(emailService);
        var notification = new OrderPlacedNotification(Guid.NewGuid(), DateTime.UtcNow);

        await handler.Handle(notification, CancellationToken.None);

        await emailService.Received(1)
            .SendOrderConfirmationAsync(notification.OrderId, Arg.Any<CancellationToken>());
    }
}
```

## Integration Tests with the Full Pipeline

When you need to verify the full MediatR pipeline (behaviors + handler):

```csharp
public class PlaceOrderIntegrationTests : IAsyncLifetime
{
    private ServiceProvider _provider = null!;

    public async Task InitializeAsync()
    {
        var services = new ServiceCollection();

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblyContaining<PlaceOrderCommandHandler>();
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });

        services.AddValidatorsFromAssemblyContaining<PlaceOrderCommandValidator>();

        // Add test dependencies (in-memory DB, mocked services, etc.)
        services.AddDbContext<OrderDbContext>(opt => opt.UseInMemoryDatabase("test"));
        services.AddScoped<IOrderRepository, OrderRepository>();

        _provider = services.BuildServiceProvider();
    }

    [Fact]
    public async Task Send_ValidCommand_CreatesOrder()
    {
        using var scope = _provider.CreateScope();
        var sender = scope.ServiceProvider.GetRequiredService<ISender>();

        var command = new PlaceOrderCommand(
            CustomerId: Guid.NewGuid(),
            Lines: [new OrderLineInput("SKU-001", 2)]);

        var orderId = await sender.Send(command);

        orderId.Should().NotBeEmpty();
    }

    [Fact]
    public async Task Send_InvalidCommand_ThrowsValidationException()
    {
        using var scope = _provider.CreateScope();
        var sender = scope.ServiceProvider.GetRequiredService<ISender>();

        var command = new PlaceOrderCommand(
            CustomerId: Guid.Empty,
            Lines: []);

        await sender.Invoking(s => s.Send(command))
            .Should().ThrowAsync<ValidationException>();
    }

    public async Task DisposeAsync() => await _provider.DisposeAsync();
}
```

## Testing Guidelines

- **Test handlers directly** — don't route through MediatR for unit tests. MediatR's routing is already tested by the library.
- **Test behaviors in isolation** — mock the `next` delegate to verify before/after logic.
- **Test validators as standalone units** — FluentValidation validators are pure logic, easy to test.
- **Use integration tests sparingly** — only when you need to verify the full pipeline (behaviors + handler + DI wiring).
- **Don't mock ISender in handler tests** — handlers don't use ISender. Test the handler class directly.
- **Mock ISender in consumer tests** — when testing controllers, resolvers, or other code that sends requests, mock ISender to verify the right request was sent.

```csharp
// Testing code that uses ISender
public class OrderControllerTests
{
    [Fact]
    public async Task PlaceOrder_SendsCommandViaMediatR()
    {
        var sender = Substitute.For<ISender>();
        var expectedId = Guid.NewGuid();
        sender.Send(Arg.Any<PlaceOrderCommand>(), Arg.Any<CancellationToken>())
            .Returns(expectedId);

        var controller = new OrderController(sender);

        var result = await controller.PlaceOrder(new PlaceOrderRequest(/* ... */));

        result.Should().Be(expectedId);
        await sender.Received(1).Send(
            Arg.Is<PlaceOrderCommand>(c => c.CustomerId == expectedCustomerId),
            Arg.Any<CancellationToken>());
    }
}
```
