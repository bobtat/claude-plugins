# Performance & Security

## N+1 Prevention with DataLoaders

DataLoaders batch and cache individual lookups within a single request. Use them for **every** field that resolves related data.

### Batch DataLoader

For loading a single item by key:

```csharp
// Batches all customer-by-ID lookups in a single request cycle into one query
public sealed class CustomerByIdDataLoader(
    IBatchScheduler batchScheduler,
    AppDbContext dbContext)
    : BatchDataLoader<Guid, Customer>(batchScheduler)
{
    protected override async Task<IReadOnlyDictionary<Guid, Customer>> LoadBatchAsync(
        IReadOnlyList<Guid> keys,
        CancellationToken ct)
    {
        return await dbContext.Customers
            .Where(c => keys.Contains(c.Id.Value))
            .ToDictionaryAsync(c => c.Id.Value, ct);
    }
}

// Usage in a type extension
[ObjectType<Order>]
public static partial class OrderType
{
    public static async Task<Customer> GetCustomerAsync(
        [Parent] Order order,
        CustomerByIdDataLoader loader,
        CancellationToken ct)
        => await loader.LoadAsync(order.CustomerId.Value, ct);
}
```

### Group DataLoader

For loading collections by a parent key:

```csharp
// Loads all order lines grouped by order ID
public sealed class OrderLinesByOrderIdDataLoader(
    IBatchScheduler batchScheduler,
    AppDbContext dbContext)
    : GroupedDataLoader<Guid, OrderLine>(batchScheduler)
{
    protected override async Task<ILookup<Guid, OrderLine>> LoadGroupedBatchAsync(
        IReadOnlyList<Guid> keys,
        CancellationToken ct)
    {
        var lines = await dbContext.OrderLines
            .Where(l => keys.Contains(l.OrderId.Value))
            .OrderBy(l => l.Position)
            .ToListAsync(ct);

        return lines.ToLookup(l => l.OrderId.Value);
    }
}
```

### When to Use DataLoaders
- **Always** when a field resolves data from a different aggregate or module
- **Always** when a field appears in a list context (edges in a connection)
- **Not needed** for root query resolvers that directly hit the database once

## Projections

Use `[UseProjections]` to only select columns the client actually requested:

```csharp
[QueryType]
public static class OrderQueries
{
    [UsePaging]
    [UseProjections]
    [UseFiltering]
    [UseSorting]
    public static IQueryable<Order> GetOrders(AppDbContext dbContext)
        => dbContext.Orders;
}
```

Order of middleware matters: `Paging → Projections → Filtering → Sorting`

## Filtering

HotChocolate generates filter types automatically. Configure what's filterable:

```csharp
public sealed class OrderFilterType : FilterInputType<Order>
{
    protected override void Configure(IFilterInputTypeDescriptor<Order> descriptor)
    {
        // Only expose specific fields for filtering
        descriptor.BindFieldsExplicitly();
        descriptor.Field(o => o.Status);
        descriptor.Field(o => o.CreatedAt);
        descriptor.Field(o => o.TotalAmount);
    }
}
```

## Query Depth & Complexity Limits

Prevent abuse by limiting query depth and complexity:

```csharp
builder.Services
    .AddGraphQLServer()
    .AddMaxExecutionDepthRule(10)     // prevent deeply nested queries
    .ModifyCostOptions(options =>     // cost analysis (HotChocolate 14+)
    {
        options.MaxFieldCost = 1_000;
        options.MaxTypeCost = 1_000;
        options.EnforceCostLimits = true;
    });
```

### Assigning Costs to Fields
```csharp
[ObjectType<Order>]
public static partial class OrderType
{
    [UsePaging]
    [Cost(10)]  // pagination fields are more expensive
    public static IQueryable<OrderLine> GetLines(
        [Parent] Order order,
        AppDbContext dbContext)
        => dbContext.OrderLines
            .Where(l => l.OrderId == order.Id)
            .OrderBy(l => l.Position);
}
```

## Pagination Limits

Always set maximum page sizes to prevent clients from requesting too much data:

```csharp
[UsePaging(MaxPageSize = 50, DefaultPageSize = 20, IncludeTotalCount = true)]
public static IQueryable<Order> GetOrders(AppDbContext dbContext)
    => dbContext.Orders;
```

## Authorization

Use your framework's authorization directives:

```csharp
[Authorize]  // requires authenticated user
[QueryType]
public static class OrderQueries
{
    [Authorize(Policy = "CanViewOrders")]
    public static async Task<Order?> GetOrderAsync(
        [ID] Guid id,
        IOrderRepository repository,
        CancellationToken ct)
        => await repository.GetByIdAsync(new OrderId(id), ct);
}
```

## Caching

Use `@cacheControl` to hint caching for clients and CDNs:

```csharp
[ObjectType<Product>]
public static partial class ProductType
{
    static partial void Configure(IObjectTypeDescriptor<Product> descriptor)
    {
        descriptor.CacheControl(maxAge: 300);  // 5 minutes
    }

    // Override for frequently changing fields
    [CacheControl(MaxAge = 0)]
    public static async Task<int> GetStockCount(...)
    { }
}
```

## Query Plan Visibility (Development)

Enable query plan inspection during development to spot N+1 issues:

```csharp
#if DEBUG
builder.Services
    .AddGraphQLServer()
    .ModifyRequestOptions(o => o.IncludeExceptionDetails = true);
#endif
```
