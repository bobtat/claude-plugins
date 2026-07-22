# Testing GraphQL

## Testing Layers

```
Schema Tests          — Does the schema look right? (snapshot)
Resolver Unit Tests   — Does business logic work in isolation?
Integration Tests     — Do queries return correct data end-to-end?
```

## Schema Snapshot Testing

Catch unintentional schema changes by snapshotting the SDL:

```csharp
// Verifies the schema hasn't changed unexpectedly
[Fact]
public async Task Schema_Should_Not_Change_Unexpectedly()
{
    var schema = await new ServiceCollection()
        .AddGraphQLServer()
        .AddQueryType()
        .AddMutationType()
        .AddApplicationGraphQLTypes()
        .BuildSchemaAsync();

    var sdl = schema.Print();

    // Using Verify (https://github.com/VerifyTests/Verify)
    await Verify(sdl);

    // Or using a simple snapshot approach
    // Assert.Equal(expectedSdl, sdl);
}
```

Update snapshots intentionally when the schema evolves. Unexpected snapshot changes indicate accidental breaking changes.

## Integration Testing with HotChocolate

HotChocolate provides `IRequestExecutor` for in-memory query execution — no HTTP server needed. Examples use HotChocolate 14 APIs (`OperationRequestBuilder`, `OperationResult`); on v13 these are `QueryRequestBuilder` and `QueryResult`:

```csharp
// Base class for GraphQL integration tests
public abstract class GraphQLIntegrationTestBase : IAsyncLifetime
{
    private IRequestExecutor _executor = null!;
    protected AppDbContext DbContext { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        var services = new ServiceCollection();

        // Use an in-memory or Testcontainers database
        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase("test"));

        services.AddScoped<IPersonRepository, PersonRepository>();

        _executor = await services
            .AddGraphQLServer()
            .AddQueryType()
            .AddMutationType()
            .AddApplicationGraphQLTypes()
            .AddFiltering()
            .AddSorting()
            .BuildRequestExecutorAsync();

        var scope = services.BuildServiceProvider().CreateScope();
        DbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await DbContext.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await DbContext.Database.EnsureDeletedAsync();
        await DbContext.DisposeAsync();
    }

    protected async Task<IExecutionResult> ExecuteAsync(string query,
        Dictionary<string, object?>? variables = null)
    {
        var requestBuilder = OperationRequestBuilder.New().SetDocument(query);

        if (variables is not null)
            requestBuilder.SetVariableValues(variables);

        return await _executor.ExecuteAsync(requestBuilder.Build());
    }

    protected static void AssertNoErrors(IExecutionResult result)
    {
        var queryResult = Assert.IsType<OperationResult>(result);
        Assert.Null(queryResult.Errors);
    }
}
```

## Query Integration Tests

```csharp
public sealed class PersonQueryTests : GraphQLIntegrationTestBase
{
    [Fact]
    public async Task GetPerson_Returns_Person_When_Found()
    {
        // Arrange — seed the database
        var person = Person.Create(new PersonName("Jane", "Doe"));
        await DbContext.Persons.AddAsync(person);
        await DbContext.SaveChangesAsync();

        // Act
        var result = await ExecuteAsync($$"""
            query {
                person(id: "{{person.Id.Value}}") {
                    firstName
                    lastName
                    fullName
                }
            }
            """);

        // Assert
        AssertNoErrors(result);
        var queryResult = Assert.IsType<OperationResult>(result);
        var data = queryResult.Data!;

        var personData = Assert.IsType<Dictionary<string, object?>>(
            ((Dictionary<string, object?>)data)["person"]);
        Assert.Equal("Jane", personData["firstName"]);
        Assert.Equal("Doe", personData["lastName"]);
        Assert.Equal("Jane Doe", personData["fullName"]);
    }

    [Fact]
    public async Task GetPerson_Returns_Null_When_Not_Found()
    {
        var result = await ExecuteAsync($$"""
            query {
                person(id: "{{Guid.NewGuid()}}") {
                    firstName
                }
            }
            """);

        AssertNoErrors(result);
        var queryResult = Assert.IsType<OperationResult>(result);
        var data = (Dictionary<string, object?>)queryResult.Data!;
        Assert.Null(data["person"]);
    }

    [Fact]
    public async Task GetPersons_Returns_Paginated_Results()
    {
        // Arrange
        for (var i = 0; i < 5; i++)
            await DbContext.Persons.AddAsync(
                Person.Create(new PersonName($"Person{i}", "Test")));
        await DbContext.SaveChangesAsync();

        // Act
        var result = await ExecuteAsync("""
            query {
                persons(first: 2) {
                    edges {
                        node { firstName }
                        cursor
                    }
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                    totalCount
                }
            }
            """);

        // Assert
        AssertNoErrors(result);
        var queryResult = Assert.IsType<OperationResult>(result);
        var data = (Dictionary<string, object?>)queryResult.Data!;
        var persons = (Dictionary<string, object?>)data["persons"]!;
        Assert.Equal(5, (int)persons["totalCount"]!);
    }
}
```

## Mutation Integration Tests

```csharp
public sealed class PersonMutationTests : GraphQLIntegrationTestBase
{
    [Fact]
    public async Task CreatePerson_Returns_Created_Person()
    {
        var result = await ExecuteAsync("""
            mutation {
                createPerson(input: {
                    firstName: "Jane"
                    lastName: "Doe"
                }) {
                    person {
                        id
                        firstName
                        lastName
                    }
                    errors {
                        __typename
                    }
                }
            }
            """);

        AssertNoErrors(result);
        var queryResult = Assert.IsType<OperationResult>(result);
        var data = (Dictionary<string, object?>)queryResult.Data!;
        var payload = (Dictionary<string, object?>)data["createPerson"]!;

        Assert.NotNull(payload["person"]);
        Assert.Null(payload["errors"]);

        // Verify persisted
        Assert.Single(DbContext.Persons);
    }

    [Fact]
    public async Task CreatePerson_Returns_Typed_Error_For_Invalid_Input()
    {
        var result = await ExecuteAsync("""
            mutation {
                createPerson(input: {
                    firstName: ""
                    lastName: "Doe"
                }) {
                    person { id }
                    errors {
                        __typename
                        ... on ValidationError {
                            message
                            field
                        }
                    }
                }
            }
            """);

        AssertNoErrors(result);  // No GraphQL-level errors
        var queryResult = Assert.IsType<OperationResult>(result);
        var data = (Dictionary<string, object?>)queryResult.Data!;
        var payload = (Dictionary<string, object?>)data["createPerson"]!;

        Assert.Null(payload["person"]);
        Assert.NotNull(payload["errors"]);  // Business error in payload
    }
}
```

## Resolver Unit Tests

Test complex resolver logic in isolation when it involves non-trivial computation:

```csharp
public sealed class PersonTypeTests
{
    [Fact]
    public void GetFullName_Combines_First_And_Last()
    {
        var person = Person.Create(new PersonName("Jane", "Doe"));
        var result = PersonType.GetFullName(person);
        Assert.Equal("Jane Doe", result);
    }
}
```

Most resolvers are simple enough that integration tests cover them. Only unit test resolvers with meaningful logic.

## Subscription Testing

```csharp
public sealed class SubscriptionTests : GraphQLIntegrationTestBase
{
    [Fact]
    public async Task OnOrderPlaced_Receives_Event()
    {
        var stream = await ExecuteAsync("""
            subscription {
                onOrderPlaced(customerId: "some-known-id") {
                    status
                    totalAmount
                }
            }
            """);

        var responseStream = Assert.IsType<ResponseStream>(stream);

        // Trigger the event
        await ExecuteAsync("""
            mutation {
                placeOrder(input: { customerId: "some-known-id", lines: [...] }) {
                    order { id }
                }
            }
            """);

        await foreach (var result in responseStream.ReadResultsAsync())
        {
            AssertNoErrors(result);
            break; // got the first event
        }
    }
}
```

## Test Organization

```
YourProject.Module.Tests/
  GraphQL/
    PersonQueryTests.cs         # Query integration tests
    PersonMutationTests.cs      # Mutation integration tests
    SubscriptionTests.cs        # Subscription integration tests
    SchemaTests.cs              # Schema snapshot tests
  Domain/
    PersonTests.cs              # Domain model unit tests (not GraphQL-specific)
```

## What to Test at Each Level

| Level | What to test | What NOT to test |
|-------|-------------|------------------|
| **Schema snapshot** | Schema shape, no accidental breaking changes | Field behavior |
| **Resolver unit** | Complex computed fields, custom logic | Simple pass-through fields |
| **Integration** | Full query/mutation flow, filtering, pagination, errors | Every field combination |

## Testing with Testcontainers

For realistic integration tests, use Testcontainers instead of in-memory databases:

```csharp
public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder()
        .WithImage("postgres:17")
        .Build();

    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync() => await _container.StartAsync();
    public async Task DisposeAsync() => await _container.DisposeAsync();
}
```

Adapt the container image and configuration to your project's database.
