# Testing Domain Models

## Testing Philosophy

Domain tests verify that **business rules work correctly**. They should be fast, isolated, and read like specifications of the domain behavior.

## What to Test at Each Layer

| Layer | What to test | How |
|-------|-------------|-----|
| **Value objects** | Validation, equality, conversion | Unit tests |
| **Aggregates** | Invariants, state transitions, events | Unit tests |
| **Domain services** | Cross-aggregate logic, calculations | Unit tests |
| **Command handlers** | Orchestration flow, persistence | Integration tests |
| **Query handlers** | Correct data retrieval, projections | Integration tests |

## Testing Value Objects

Value objects are the easiest to test — pure input/output with no dependencies.

```csharp
public sealed class MoneyTests
{
    [Fact]
    public void Create_With_Valid_Amount_Succeeds()
    {
        var money = new Money(99.99m, Currency.USD);
        Assert.Equal(99.99m, money.Amount);
        Assert.Equal(Currency.USD, money.Currency);
    }

    [Fact]
    public void Addition_Of_Same_Currency_Succeeds()
    {
        var a = new Money(10m, Currency.USD);
        var b = new Money(20m, Currency.USD);
        var result = a + b;
        Assert.Equal(30m, result.Amount);
    }

    [Fact]
    public void Addition_Of_Different_Currencies_Throws()
    {
        var usd = new Money(10m, Currency.USD);
        var eur = new Money(10m, Currency.EUR);
        Assert.Throws<InvalidOperationException>(() => usd + eur);
    }

    [Fact]
    public void Equality_By_Value()
    {
        var a = new Money(10m, Currency.USD);
        var b = new Money(10m, Currency.USD);
        var c = new Money(20m, Currency.USD);
        Assert.Equal(a, b);
        Assert.NotEqual(a, c);
    }
}
```

### Testing Strongly-Typed IDs

```csharp
public sealed class OrderIdTests
{
    [Fact]
    public void New_Generates_Unique_Ids()
    {
        var id1 = OrderId.New();
        var id2 = OrderId.New();
        Assert.NotEqual(id1, id2);
    }

    [Fact]
    public void Equality_By_Underlying_Value()
    {
        var guid = Guid.NewGuid();
        Assert.Equal(new OrderId(guid), new OrderId(guid));
    }
}
```

## Testing Aggregates

Aggregate tests verify **invariants** and **state transitions**. Focus on:
1. Valid creation produces correct initial state
2. Operations enforce business rules
3. Invalid operations are rejected
4. Domain events are raised for meaningful changes

### Testing Aggregate Creation

```csharp
public sealed class OrderTests
{
    [Fact]
    public void Place_Sets_Initial_State()
    {
        var customerId = CustomerId.New();
        var lines = new List<OrderLine> { TestOrderLine() };

        var order = Order.Place(customerId, lines);

        Assert.NotEqual(default, order.Id);
        Assert.Equal(customerId, order.CustomerId);
        Assert.Equal(OrderStatus.Placed, order.Status);
        Assert.Single(order.Lines);
    }

    [Fact]
    public void Place_Raises_OrderPlaced_Event()
    {
        var order = Order.Place(CustomerId.New(), [TestOrderLine()]);

        var domainEvent = Assert.Single(order.DomainEvents);
        var placedEvent = Assert.IsType<OrderPlacedEvent>(domainEvent);
        Assert.Equal(order.Id, placedEvent.OrderId);
    }

    [Fact]
    public void Place_With_No_Lines_Throws()
    {
        Assert.Throws<DomainException>(() =>
            Order.Place(CustomerId.New(), []));
    }

    private static OrderLine TestOrderLine() =>
        new(ProductId.New(), quantity: 1, new Money(10m, Currency.USD));
}
```

### Testing State Transitions

```csharp
public sealed class OrderCancellationTests
{
    private readonly Order _order;

    public OrderCancellationTests()
    {
        _order = Order.Place(CustomerId.New(), [TestOrderLine()]);
        _order.ClearDomainEvents(); // clear creation event
    }

    [Fact]
    public void Cancel_Updates_Status()
    {
        _order.Cancel();
        Assert.Equal(OrderStatus.Cancelled, _order.Status);
    }

    [Fact]
    public void Cancel_Raises_OrderCancelled_Event()
    {
        _order.Cancel();

        var domainEvent = Assert.Single(_order.DomainEvents);
        Assert.IsType<OrderCancelledEvent>(domainEvent);
    }

    [Fact]
    public void Cancel_Shipped_Order_Throws()
    {
        _order.MarkAsShipped(); // transition to shipped

        Assert.Throws<DomainException>(() => _order.Cancel());
    }
}
```

## Testing Domain Services

Domain services are stateless — test them like functions with clear inputs and outputs.

```csharp
public sealed class PricingCalculatorTests
{
    [Fact]
    public void Calculates_Subtotal_Without_Discount()
    {
        var lines = new List<OrderLine>
        {
            new(ProductId.New(), 2, new Money(10m, Currency.USD)),
            new(ProductId.New(), 1, new Money(25m, Currency.USD))
        };

        var total = PricingCalculator.CalculateTotal(lines);

        Assert.Equal(45m, total.Amount);
    }

    [Fact]
    public void Applies_Percentage_Discount()
    {
        var lines = new List<OrderLine>
        {
            new(ProductId.New(), 1, new Money(100m, Currency.USD))
        };
        var discount = new PercentageDiscount(10); // 10% off

        var total = PricingCalculator.CalculateTotal(lines, discount);

        Assert.Equal(90m, total.Amount);
    }
}
```

## Test Organization

```
{ProjectName}.{ModuleName}.Module.Tests/
  Domain/
    OrderTests.cs                   # Aggregate creation, state transitions
    OrderCancellationTests.cs       # Focused on cancellation behavior
    ValueObjects/
      MoneyTests.cs
      OrderIdTests.cs
  Application/
    Commands/
      PlaceOrderHandlerTests.cs     # Integration tests
    Queries/
      OrderQueryHandlerTests.cs     # Integration tests
```

## Testing Patterns

### Builder Pattern for Test Aggregates

When aggregates need complex setup, use a builder:

```csharp
public sealed class OrderBuilder
{
    private CustomerId _customerId = CustomerId.New();
    private readonly List<OrderLine> _lines = [new(ProductId.New(), 1, new Money(10m, Currency.USD))];

    public OrderBuilder WithCustomer(CustomerId id) { _customerId = id; return this; }
    public OrderBuilder WithLine(ProductId product, int qty, Money price)
    {
        _lines.Add(new OrderLine(product, qty, price));
        return this;
    }

    public Order Build()
    {
        var order = Order.Place(_customerId, _lines);
        order.ClearDomainEvents(); // clean slate for test assertions
        return order;
    }
}
```

### Asserting Domain Events

```csharp
public static class DomainEventAssertions
{
    public static T AssertRaisedEvent<T>(AggregateRoot aggregate) where T : IDomainEvent
    {
        var domainEvent = aggregate.DomainEvents.OfType<T>().SingleOrDefault();
        Assert.NotNull(domainEvent);
        return domainEvent;
    }

    public static void AssertNoEventsRaised(AggregateRoot aggregate)
    {
        Assert.Empty(aggregate.DomainEvents);
    }
}
```

## What NOT to Test

- **Private constructor details** — test through factory methods
- **EF Core mappings** — those are integration/persistence tests (see `persistence.md` for that layer)
- **Getter/setter behavior** — unless the setter has validation logic
- **Framework behavior** — don't test that `record` equality works
