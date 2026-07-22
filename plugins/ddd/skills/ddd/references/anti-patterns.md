# DDD Anti-Patterns

## 1. Anemic Domain Model

Domain objects are just data bags with getters/setters, and all logic lives in services.

```csharp
// ANTI-PATTERN
public class Order
{
    public Guid Id { get; set; }
    public string Status { get; set; } = "";
    public List<OrderLine> Lines { get; set; } = [];
}

public class OrderService
{
    public void Cancel(Order order)
    {
        if (order.Status == "Shipped")
            throw new Exception("Cannot cancel");
        order.Status = "Cancelled";
    }
}

// CORRECT — rich domain model
public sealed class Order : AggregateRoot
{
    public OrderId Id { get; private init; }
    public OrderStatus Status { get; private set; }

    public void Cancel()
    {
        if (Status == OrderStatus.Shipped)
            throw new DomainException("Cannot cancel a shipped order");
        Status = OrderStatus.Cancelled;
        AddDomainEvent(new OrderCancelledEvent(Id));
    }
}
```

**Why it's harmful**: Business rules scatter across services, become duplicated, and are easy to bypass. The domain model can be put into invalid states.

**How to fix**: Move behavior onto entities and aggregates. Use value objects for validation. Make constructors private, expose factory methods.

## 2. Primitive Obsession

Using raw primitives instead of value objects for domain concepts.

```csharp
// ANTI-PATTERN
public void Transfer(Guid fromAccountId, Guid toAccountId, decimal amount)
{
    // Did we swap the arguments? The compiler can't tell.
}

// CORRECT — strongly-typed
public void Transfer(AccountId from, AccountId to, Money amount) { }
```

**Why it's harmful**: No validation at the type level, easy to mix up parameters, domain concepts are implicit.

**How to fix**: Create value objects for any primitive that has validation rules, units, or domain meaning. Use strongly-typed IDs.

## 3. God Aggregate

An aggregate that encompasses too much, becoming massive with many responsibilities.

```csharp
// ANTI-PATTERN — Customer knows about everything
public class Customer
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public List<Order> Orders { get; set; } = [];
    public List<Invoice> Invoices { get; set; } = [];
    public List<SupportTicket> Tickets { get; set; } = [];
    public List<Review> Reviews { get; set; } = [];
    public ShoppingCart Cart { get; set; }
    // ... grows forever
}

// CORRECT — small aggregates, referenced by ID
public sealed class Customer : AggregateRoot
{
    public CustomerId Id { get; private init; }
    public CustomerName Name { get; private set; }
}

public sealed class Order : AggregateRoot
{
    public OrderId Id { get; private init; }
    public CustomerId CustomerId { get; private init; }  // reference by ID
}
```

**Why it's harmful**: Loading the aggregate loads everything. Concurrent modifications conflict. Transaction scope is too wide.

**How to fix**: Ask "must these things change together in a single transaction?" If not, they're separate aggregates.

## 4. Logic in Handlers Instead of Domain

Business rules living in command handlers instead of the domain model.

```csharp
// ANTI-PATTERN — handler contains business logic
public async Task Handle(CancelOrderCommand command, CancellationToken ct)
{
    var order = await _repo.GetByIdAsync(command.OrderId, ct);

    // Business rule in the handler — should be in the domain
    if (order.Status == "Shipped")
        throw new Exception("Cannot cancel");

    order.Status = "Cancelled";
    await _db.SaveChangesAsync(ct);
}

// CORRECT — domain owns the logic
public async Task Handle(CancelOrderCommand command, CancellationToken ct)
{
    var order = await _repo.GetByIdAsync(command.OrderId, ct);
    order.Cancel();  // validation and state change inside the aggregate
    await _db.SaveChangesAsync(ct);
}
```

**Why it's harmful**: Logic is duplicated if multiple handlers need the same rules. Rules are easy to bypass.

**How to fix**: If logic answers "is this valid in our domain?" or "what happens when X?", it belongs on an aggregate or domain service.

## 5. DDD as Folder Structure

Treating DDD as a file organization scheme without actually modeling the domain.

```csharp
// ANTI-PATTERN — DDD folders, CRUD behavior
// Domain/Aggregates/Order.cs
public class Order { public Guid Id { get; set; } }

// Application/Commands/UpdateOrderHandler.cs
public class UpdateOrderHandler
{
    public async Task Handle(UpdateOrderCommand cmd)
    {
        var order = await _repo.GetAsync(cmd.Id);
        order.Status = cmd.Status;  // direct mutation, no validation
        await _repo.SaveAsync(order);
    }
}
```

**Why it's harmful**: You get the complexity of DDD without the benefits. It's CRUD with extra steps.

**How to fix**: Start from domain behavior, not folder structure. Ask "what are the business rules?" If there are no meaningful rules, simple CRUD might be the right approach — DDD isn't always necessary.

## 6. Aggregate References Instead of IDs

Navigating directly to other aggregates instead of referencing by ID.

```csharp
// ANTI-PATTERN — direct object references
public class Order
{
    public Customer Customer { get; set; }      // direct reference
    public Warehouse Warehouse { get; set; }    // direct reference
}

// CORRECT — ID references
public sealed class Order : AggregateRoot
{
    public CustomerId CustomerId { get; private init; }
}
```

**Why it's harmful**: Creates hidden coupling. Loading one aggregate loads an entire object graph. Transaction boundaries become unclear.

**How to fix**: Always reference other aggregates by their strongly-typed ID.

## 7. Over-Engineering Simple Domains

Applying full DDD tactical patterns to a domain that doesn't need them.

```csharp
// ANTI-PATTERN — full DDD for a settings table
public sealed class UserPreference : AggregateRoot
{
    public UserPreferenceId Id { get; private init; }
    public PreferenceKey Key { get; private init; }
    public PreferenceValue Value { get; private set; }

    private UserPreference() { }

    public static UserPreference Create(PreferenceKey key, PreferenceValue value)
    {
        var pref = new UserPreference { Id = UserPreferenceId.New(), Key = key, Value = value };
        pref.AddDomainEvent(new UserPreferenceCreatedEvent(pref.Id));
        return pref;
    }
}
// That's a lot of ceremony for key-value storage
```

**Why it's harmful**: Adds complexity without proportional value. Slows development.

**How to fix**: Apply DDD where there are real business rules. Use simple CRUD for simple domains.

## 8. Event Storming in Code

Raising events for everything, including trivial state changes.

```csharp
// ANTI-PATTERN — event for every setter
public void SetNickname(string? nickname)
{
    Nickname = nickname;
    AddDomainEvent(new NicknameChangedEvent(Id, nickname));  // does anyone care?
}

public void SetThemeColor(string color)
{
    ThemeColor = color;
    AddDomainEvent(new ThemeColorChangedEvent(Id, color));  // really?
}
```

**Why it's harmful**: Event handlers proliferate. Important events are drowned in noise.

**How to fix**: Only raise events for **meaningful domain occurrences** — things another part of the system needs to react to.

## Summary Checklist

- [ ] Do aggregates have behavior, or are they just data bags?
- [ ] Are business rules in the domain, not in handlers?
- [ ] Are aggregates small and focused?
- [ ] Do you reference other aggregates by ID, not by object?
- [ ] Do value objects replace primitives where there's domain meaning?
- [ ] Are domain events meaningful, not just setter notifications?
- [ ] Is the DDD complexity proportional to the domain complexity?
