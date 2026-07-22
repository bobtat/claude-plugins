# Module Structure & Scaffolding

## Folder Layout

Every module follows this standard structure:

```
{ProjectName}.{ModuleName}.Module/
  Domain/
    Aggregates/        # Aggregate roots and their child entities
    ValueObjects/      # Value objects for this bounded context
    Events/            # Domain events
    Repositories/      # Repository interfaces (not implementations)
    Services/          # Domain services (stateless domain logic spanning aggregates)
  Infrastructure/
    Persistence/       # DbContext, EF configurations, repository implementations
    Services/          # Infrastructure service implementations
  Application/
    Commands/          # Command handlers (write operations)
    Queries/           # Query handlers (read operations)
    DTOs/              # Data transfer objects for the application layer
  Registration.cs      # Module service registration (called from the host)
```

## Layer Rules

### Domain Layer (`Domain/`)
- **No dependencies** on infrastructure, application, or external packages
- Contains aggregates, entities, value objects, domain events, repository interfaces, domain services
- This is the heart of the module — pure business logic

### Application Layer (`Application/`)
- Depends on the Domain layer only
- Orchestrates use cases via commands and queries
- Maps between domain objects and DTOs
- No direct infrastructure access — uses repository interfaces from Domain

### Infrastructure Layer (`Infrastructure/`)
- Depends on Domain layer (implements its interfaces)
- Contains EF Core DbContext, entity configurations, repository implementations
- External service integrations

## Module Registration

Each module exposes a single registration method called from the host project:

```csharp
public static class OrderModuleRegistration
{
    public static IServiceCollection AddOrderModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Persistence
        services.AddDbContext<OrderDbContext>(options =>
            options.UseYourProvider(configuration.GetConnectionString("OrderDb")));

        // Repositories
        services.AddScoped<IOrderRepository, OrderRepository>();

        // Application services
        services.AddScoped<OrderCommandHandler>();
        services.AddScoped<OrderQueryHandler>();

        return services;
    }
}

// In the host project's Program.cs
builder.Services.AddOrderModule(builder.Configuration);
```

## Creating a New Module

When scaffolding a new module:

1. Create the class library project: `{ProjectName}.{ModuleName}.Module`
2. Add reference to your shared contracts/kernel project
3. Add NuGet packages for your persistence layer (e.g., EF Core + your database provider)
4. Create the folder structure above
5. Create `Registration.cs` with the extension method
6. Add project reference in your host project and call registration in `Program.cs`
7. Add to the solution: `dotnet sln add {ProjectName}.{ModuleName}.Module`
