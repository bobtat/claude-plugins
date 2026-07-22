# HotChocolate Patterns

HotChocolate is a .NET GraphQL server framework. These patterns use the annotation-based (code-first) approach and target HotChocolate 14 APIs. Adapt to the project's HotChocolate version.

## Object Types

```csharp
// Queries — the type class defines the GraphQL shape
[QueryType]
public static class PersonQueries
{
    /// <summary>Fetch a person by their unique ID.</summary>
    public static async Task<Person?> GetPersonAsync(
        [ID] Guid id,
        IPersonRepository repository,
        CancellationToken ct)
        => await repository.GetByIdAsync(new PersonId(id), ct);

    /// <summary>Paginated list of all persons.</summary>
    [UsePaging]
    [UseFiltering]
    [UseSorting]
    public static IQueryable<Person> GetPersons(
        AppDbContext dbContext)
        => dbContext.Persons;
}
```

## GraphQL Type Classes

Use type extensions to shape how domain objects appear in GraphQL without polluting the domain:

```csharp
[ObjectType<Person>]
public static partial class PersonType
{
    static partial void Configure(IObjectTypeDescriptor<Person> descriptor)
    {
        // Hide internal fields from the schema
        descriptor.Ignore(p => p.DomainEvents);

        // Hide the raw value object; exposed as flat fields below
        descriptor.Ignore(p => p.Name);
    }

    // Flatten nested value objects with resolvers — chained selectors like
    // Field(p => p.Name.First) are not valid field expressions
    public static string GetFirstName([Parent] Person person) => person.Name.First;
    public static string GetLastName([Parent] Person person) => person.Name.Last;

    // Computed field — not on the domain model
    public static string GetFullName([Parent] Person person)
        => $"{person.Name.First} {person.Name.Last}";

    // Graph navigation — resolve related data
    [UsePaging]
    public static async Task<IEnumerable<WeightReading>> GetWeightHistory(
        [Parent] Person person,
        IWeightReadingRepository weightRepo,
        CancellationToken ct)
        => await weightRepo.GetByPersonIdAsync(person.Id, ct);
}
```

## Mutations with Typed Errors

HotChocolate's mutation conventions automatically map exceptions to payload errors. They must be enabled with `.AddMutationConventions()` at registration (see the Registration section) — without it, `[Error<T>]` attributes have no effect:

```csharp
[MutationType]
public static class PersonMutations
{
    // Declare which exceptions this mutation can produce
    [Error<ValidationException>]
    [Error<DuplicateEmailException>]
    public static async Task<Person> CreatePersonAsync(
        CreatePersonInput input,
        IPersonRepository repository,
        AppDbContext dbContext,
        CancellationToken ct)
    {
        // Throwing these exceptions produces typed payload errors
        // NOT GraphQL-level errors
        if (string.IsNullOrWhiteSpace(input.FirstName))
            throw new ValidationException("First name is required", "firstName");

        var existing = await repository.GetByEmailAsync(input.Email, ct);
        if (existing is not null)
            throw new DuplicateEmailException(input.Email);

        var person = Person.Create(
            new PersonName(input.FirstName, input.LastName));

        await repository.AddAsync(person, ct);
        await dbContext.SaveChangesAsync(ct);
        return person;
    }
}

// Input record — maps to CreatePersonInput in the schema
public sealed record CreatePersonInput(
    string FirstName,
    string LastName,
    string? Email = null,
    DateOnly? DateOfBirth = null);
```

### Exception Classes with GraphQL Mapping

```csharp
// The exception properties map to fields on the GraphQL error type
public sealed class ValidationException(string message, string field) : Exception(message)
{
    public string Field { get; } = field;
}

public sealed class DuplicateEmailException(string email)
    : Exception($"A person with email '{email}' already exists")
{
    public string Email { get; } = email;
}

public sealed class NotFoundException(string entityName, string id)
    : Exception($"{entityName} with ID '{id}' was not found")
{
    public string EntityName { get; } = entityName;
    public string Id { get; } = id;
}
```

### Generated Schema

HotChocolate generates this from the above:

```graphql
type Mutation {
  createPerson(input: CreatePersonInput!): CreatePersonPayload!
}

type CreatePersonPayload {
  person: Person
  errors: [CreatePersonError!]
}

union CreatePersonError = ValidationError | DuplicateEmailError

type ValidationError implements Error {
  message: String!
  field: String!
}

type DuplicateEmailError implements Error {
  message: String!
  email: String!
}
```

## Subscriptions

```csharp
[SubscriptionType]
public static class OrderSubscriptions
{
    [Subscribe]
    // {customerId} is a literal template HotChocolate fills from the argument —
    // attribute arguments must be constants, so string interpolation can't be used here
    [Topic("OnOrderPlaced_{customerId}")]
    public static Order OnOrderPlaced(
        [ID] Guid customerId,
        [EventMessage] Order order)
        => order;
}

// Publishing from a mutation or event handler
public static async Task PublishOrderPlaced(
    Order order,
    ITopicEventSender sender,
    CancellationToken ct)
{
    await sender.SendAsync(
        $"{nameof(OrderSubscriptions.OnOrderPlaced)}_{order.CustomerId.Value}",
        order,
        ct);
}
```

## Registration

```csharp
var builder = WebApplication.CreateBuilder(args);

// Register application services
builder.Services.AddApplicationModule(builder.Configuration);

// GraphQL
builder.Services
    .AddGraphQLServer()
    .AddQueryType()
    .AddMutationType()
    .AddSubscriptionType()
    .AddMutationConventions() // enables [Error<T>] typed payload errors
    .AddTypes()               // or register types explicitly per module
    .AddFiltering()
    .AddSorting()
    .AddProjections()
    .AddGlobalObjectIdentification()
    .AddInMemorySubscriptions();  // or Redis for production

var app = builder.Build();
app.MapGraphQL();
app.Run();
```

### Module GraphQL Registration

Each module can expose an extension method to register its types:

```csharp
public static IRequestExecutorBuilder AddPersonGraphQLTypes(
    this IRequestExecutorBuilder builder)
{
    return builder
        .AddType<PersonType>()
        .AddTypeExtension<PersonQueries>()
        .AddTypeExtension<PersonMutations>()
        .AddTypeExtension<PersonSubscriptions>()
        .AddDataLoader<PersonByIdDataLoader>();
}
```

## Dependency Injection in Resolvers

HotChocolate supports constructor-less DI — services are injected as resolver parameters:

```csharp
// Services are injected automatically by parameter type
public static async Task<Person?> GetPersonAsync(
    [ID] Guid id,
    IPersonRepository repository,      // injected
    ILogger<PersonQueries> logger,     // injected
    CancellationToken ct)              // injected
{
    logger.LogDebug("Fetching person {PersonId}", id);
    return await repository.GetByIdAsync(new PersonId(id), ct);
}
```

## ID Handling

Use the `[ID]` attribute to relay-encode IDs:

```csharp
// Accepts and returns relay-style global IDs (base64 encoded type:id)
public static async Task<Person?> GetPersonAsync(
    [ID] Guid id,           // client sends "UGVyc29uOmFiYzEyMw==" — decoded to Guid
    IPersonRepository repository,
    CancellationToken ct)
    => await repository.GetByIdAsync(new PersonId(id), ct);
```

## Global Error Filter

```csharp
public sealed class GraphQLErrorFilter : IErrorFilter
{
    public IError OnError(IError error)
    {
        // Don't leak internal exception details in production
        if (error.Exception is not null)
        {
            return error
                .WithMessage("An unexpected error occurred")
                .WithCode("INTERNAL_ERROR")
                .RemoveException();
        }

        return error;
    }
}

// Register
builder.Services
    .AddGraphQLServer()
    .AddErrorFilter<GraphQLErrorFilter>();
```

## MediatR Alternative for Mutations

Instead of putting business logic directly in resolvers, you can dispatch commands through MediatR. See `integration-mediatr.md` for this pattern. The resolver becomes a thin dispatcher:

```csharp
[MutationType]
public static class OrderMutations
{
    [Error<ValidationException>]
    public static async Task<Guid> PlaceOrder(
        PlaceOrderInput input,
        ISender sender,
        CancellationToken ct)
        => await sender.Send(new PlaceOrderCommand(input.CustomerId, input.Lines), ct);
}
```
