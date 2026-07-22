# Persistence Patterns

Examples use EF Core, the most common .NET ORM. Adapt to your persistence framework.

## Repository Pattern

One repository per aggregate root. Interface in Domain, implementation in Infrastructure.

```csharp
// Domain/Repositories/IOrderRepository.cs
public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(OrderId id, CancellationToken ct = default);
    Task<IReadOnlyList<Order>> GetByCustomerAsync(CustomerId customerId, CancellationToken ct = default);
    Task AddAsync(Order order, CancellationToken ct = default);
    void Remove(Order order);
}

// Infrastructure/Persistence/OrderRepository.cs
internal sealed class OrderRepository(OrderDbContext db) : IOrderRepository
{
    public async Task<Order?> GetByIdAsync(OrderId id, CancellationToken ct)
        => await db.Orders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id, ct);

    public async Task<IReadOnlyList<Order>> GetByCustomerAsync(CustomerId customerId, CancellationToken ct)
        => await db.Orders.Where(o => o.CustomerId == customerId).ToListAsync(ct);

    public async Task AddAsync(Order order, CancellationToken ct)
        => await db.Orders.AddAsync(order, ct);

    public void Remove(Order order)
        => db.Orders.Remove(order);
}
```

## DbContext Per Module

Each module has its own DbContext — modules don't share database contexts:

```csharp
public sealed class OrderDbContext(DbContextOptions<OrderDbContext> options)
    : DbContext(options)
{
    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(OrderDbContext).Assembly);
    }
}
```

## EF Core Entity Configuration

Use `IEntityTypeConfiguration<T>` for mapping — keep configuration separate from domain entities:

```csharp
internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("orders");

        // Strongly-typed ID conversion
        builder.HasKey(o => o.Id);
        builder.Property(o => o.Id)
            .HasConversion(
                id => id.Value,
                value => new OrderId(value));

        // Foreign key as strongly-typed ID
        builder.Property(o => o.CustomerId)
            .HasConversion(
                id => id.Value,
                value => new CustomerId(value));

        // Owned collection for child entities
        builder.OwnsMany(o => o.Lines, line =>
        {
            line.ToTable("order_lines");
            line.Property(l => l.ProductId)
                .HasConversion(id => id.Value, value => new ProductId(value));
            line.Property(l => l.Quantity);
            line.ComplexProperty(l => l.UnitPrice, price =>
            {
                price.Property(p => p.Amount).HasColumnName("unit_price");
                price.Property(p => p.Currency).HasColumnName("currency");
            });
        });
    }
}
```

## Strongly-Typed ID Conversions

Register value converters for strongly-typed IDs:

```csharp
// Single property conversion
builder.Property(o => o.Id)
    .HasConversion(
        id => id.Value,
        value => new OrderId(value));

// For foreign key references to other aggregates
builder.Property(o => o.CustomerId)
    .HasConversion(
        id => id.Value,
        value => new CustomerId(value));
```

## Value Object Mapping Strategies

### ComplexProperty (EF Core 8+, preferred for single-instance value objects)
```csharp
builder.ComplexProperty(o => o.ShippingAddress, address =>
{
    address.Property(a => a.Street).HasColumnName("shipping_street");
    address.Property(a => a.City).HasColumnName("shipping_city");
    address.Property(a => a.PostalCode).HasColumnName("shipping_postal_code");
});
```

### OwnsOne (for optional value objects or when you need a separate table)
```csharp
builder.OwnsOne(o => o.BillingAddress, address =>
{
    address.Property(a => a.Street).HasColumnName("billing_street");
    address.Property(a => a.City).HasColumnName("billing_city");
});
```

### Value Conversion (for simple single-value objects)
```csharp
builder.Property(o => o.Email)
    .HasConversion(
        email => email.Value,
        value => new Email(value))
    .HasMaxLength(254);
```

## Unit of Work

EF Core's `DbContext` already implements Unit of Work. Use `SaveChangesAsync` to commit:

```csharp
public sealed class PlaceOrderHandler(
    IOrderRepository repository,
    OrderDbContext dbContext)
{
    public async Task<OrderId> HandleAsync(
        PlaceOrderCommand command,
        CancellationToken ct)
    {
        var order = Order.Place(/* ... */);
        await repository.AddAsync(order, ct);
        await dbContext.SaveChangesAsync(ct);  // commits the unit of work
        return order.Id;
    }
}
```

## Migrations

Each module manages its own migrations:

```bash
dotnet ef migrations add <Name> --project {ProjectName}.{ModuleName}.Module
dotnet ef database update --project {ProjectName}.{ModuleName}.Module
```

Follow your database's naming conventions for tables and columns (e.g., snake_case for PostgreSQL, PascalCase for SQL Server).

## Optimistic Concurrency

For aggregates that may be modified concurrently, add a concurrency token:

```csharp
// SQL Server — rowversion maps to byte[]
public sealed class Order : AggregateRoot
{
    public byte[] Version { get; private set; } = [];
    // ... other properties
}

builder.Property(o => o.Version)
    .IsRowVersion();

// PostgreSQL — use the system xmin column via a uint property
public sealed class Order : AggregateRoot
{
    public uint Version { get; private set; }
}

builder.Property(o => o.Version)
    .IsRowVersion();  // Npgsql maps uint row versions to xmin
```

Handle concurrency conflicts in the application layer:

```csharp
try
{
    await dbContext.SaveChangesAsync(ct);
}
catch (DbUpdateConcurrencyException)
{
    throw new ConcurrencyConflictException("Order was modified by another user");
}
```
