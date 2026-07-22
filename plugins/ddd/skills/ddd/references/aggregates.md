# Aggregates & Entities

## AggregateRoot Base Class

All aggregates inherit from a base class that supports domain event collection:

```csharp
public abstract class AggregateRoot
{
    private readonly List<IDomainEvent> _domainEvents = [];

    public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    protected void AddDomainEvent(IDomainEvent domainEvent)
        => _domainEvents.Add(domainEvent);

    public void ClearDomainEvents()
        => _domainEvents.Clear();
}
```

Place this in your shared kernel or contracts project so all modules can use it. The `IDomainEvent` interface is defined in `domain-events.md`.

## Aggregate Design Principles

- Design aggregates around **consistency boundaries**, not data grouping
- Keep aggregates **small** — prefer references by ID over object graphs
- One **aggregate root** per aggregate — external access only through the root
- Aggregates enforce **invariants** — all state changes go through methods that validate rules
- Use **private constructors** with factory methods for creation
- Prefer **domain methods** over property setters for state changes

## Aggregate Root Example

```csharp
// Example from an e-commerce domain
public sealed class Order : AggregateRoot
{
    public OrderId Id { get; private init; }
    public CustomerId CustomerId { get; private init; }
    public OrderStatus Status { get; private set; }
    private readonly List<OrderLine> _lines = [];
    public IReadOnlyList<OrderLine> Lines => _lines.AsReadOnly();

    private Order() { }

    public static Order Place(CustomerId customerId, IReadOnlyList<OrderLine> lines)
    {
        if (lines.Count == 0)
            throw new DomainException("Order must have at least one line item");

        var order = new Order
        {
            Id = OrderId.New(),
            CustomerId = customerId,
            Status = OrderStatus.Placed
        };
        order._lines.AddRange(lines);
        order.AddDomainEvent(new OrderPlacedEvent(order.Id));
        return order;
    }

    public void Cancel()
    {
        if (Status == OrderStatus.Shipped)
            throw new DomainException("Cannot cancel a shipped order");

        Status = OrderStatus.Cancelled;
        AddDomainEvent(new OrderCancelledEvent(Id));
    }
}
```

## Entity Design

- Have **identity** that persists across state changes
- Use **strongly-typed IDs** (not raw Guid/int) — see `value-objects.md`
- Encapsulate state — no public setters
- Child entities within an aggregate are accessed only through the aggregate root

## Aggregate Sizing Guidelines

Ask these questions to determine boundaries:

1. **Must these objects change together in a single transaction?** — same aggregate
2. **Can they change independently?** — separate aggregates, reference by ID
3. **Is the aggregate growing large?** — consider splitting; large aggregates cause concurrency issues
4. **Are there performance concerns loading the full aggregate?** — it's too big

## Cross-Aggregate References

Always reference other aggregates by ID, never by direct object reference:

```csharp
// Correct — reference by ID
public sealed class Shipment : AggregateRoot
{
    public ShipmentId Id { get; private init; }
    public OrderId OrderId { get; private init; }  // reference by ID
}

// Wrong — direct reference creates coupling
public sealed class Shipment : AggregateRoot
{
    public Order Order { get; private init; }  // don't do this
}
```

## Collections Within Aggregates

Real aggregates often contain child entity collections. Expose them as read-only and modify through aggregate root methods:

```csharp
public sealed class Order : AggregateRoot
{
    private readonly List<OrderLine> _lines = [];
    public IReadOnlyList<OrderLine> Lines => _lines.AsReadOnly();

    public void AddLine(ProductId productId, int quantity, Money unitPrice)
    {
        if (Status != OrderStatus.Draft)
            throw new DomainException("Cannot modify a placed order");

        var existing = _lines.FirstOrDefault(l => l.ProductId == productId);
        if (existing is not null)
            existing.IncreaseQuantity(quantity);
        else
            _lines.Add(new OrderLine(productId, quantity, unitPrice));

        AddDomainEvent(new OrderLineAddedEvent(Id, productId, quantity));
    }

    public void RemoveLine(ProductId productId)
    {
        var line = _lines.FirstOrDefault(l => l.ProductId == productId)
            ?? throw new DomainException($"Order line for product {productId} not found");

        _lines.Remove(line);
    }
}

// Child entity — no public constructor, identity within the aggregate
public sealed class OrderLine
{
    public ProductId ProductId { get; private init; }
    public int Quantity { get; private set; }
    public Money UnitPrice { get; private init; }

    internal OrderLine(ProductId productId, int quantity, Money unitPrice)
    {
        ProductId = productId;
        Quantity = quantity;
        UnitPrice = unitPrice;
    }

    internal void IncreaseQuantity(int amount) => Quantity += amount;
}
```
