# GraphQL.NET Patterns

GraphQL.NET (the `graphql-dotnet` project, package `GraphQL`) is the other major .NET GraphQL server library. Unlike HotChocolate's convention/attribute-driven approach, GraphQL.NET is **explicit**: every type in the schema is a graph type class you define, and fields are declared with a fluent builder. Examples target GraphQL.NET v7/v8 — adapt to the project's version (pre-v7 code chains `.Name()` instead of passing the name to `Field(...)`).

## Concept Mapping from HotChocolate

If you know one framework, this table locates the equivalent in the other:

| Concern | HotChocolate | GraphQL.NET |
|---|---|---|
| Object type shaping | `[ObjectType<T>]` partial class | `ObjectGraphType<T>` subclass |
| Root query/mutation | `[QueryType]` / `[MutationType]` statics | `ObjectGraphType` subclasses assigned to `Schema.Query` / `Schema.Mutation` |
| Input types | Input records by convention | `InputObjectGraphType<T>` subclass |
| N+1 batching | DataLoader classes / `[DataLoader]` | `IDataLoaderContextAccessor` + `GetOrAddBatchLoader` |
| Typed mutation errors | `[Error<T>]` + `.AddMutationConventions()` | No equivalent — build payload/error types manually |
| Global error shaping | `IErrorFilter` | `ErrorInfoProvider` + `UnhandledExceptionDelegate` |
| Pagination | `[UsePaging]` | `Connection<TNodeType>()` builder (manual resolution) |
| Deprecation | `[GraphQLDeprecated]` | `.DeprecationReason("...")` |
| Endpoint | `app.MapGraphQL()` | `app.UseGraphQL<TSchema>("/graphql")` |

## Packages & Registration

```csharp
// Core + server + JSON + DataLoader
// dotnet add package GraphQL
// dotnet add package GraphQL.Server.Transports.AspNetCore
// dotnet add package GraphQL.SystemTextJson
// dotnet add package GraphQL.DataLoader

builder.Services.AddGraphQL(b => b
    .AddSchema<AppSchema>()
    .AddSystemTextJson()
    .AddDataLoader()
    .AddGraphTypes(typeof(AppSchema).Assembly)   // register all graph types in the assembly
    .AddAuthorizationRule()                       // enforce Authorize metadata (see below)
    .AddErrorInfoProvider(opt =>
        opt.ExposeExceptionDetails = builder.Environment.IsDevelopment()));

var app = builder.Build();
app.UseGraphQL<AppSchema>("/graphql");
app.UseGraphQLGraphiQL();   // IDE at /ui/graphiql
app.Run();
```

## Schema Class

The schema resolves its root types from DI:

```csharp
public sealed class AppSchema : Schema
{
    public AppSchema(IServiceProvider provider) : base(provider)
    {
        Query = provider.GetRequiredService<AppQuery>();
        Mutation = provider.GetRequiredService<AppMutation>();
        Subscription = provider.GetRequiredService<AppSubscriptions>();
    }
}
```

## Object Types

Graph types are explicit classes — this is where you shape the schema independently of the domain model (same principle as HotChocolate type extensions):

```csharp
public sealed class PersonType : ObjectGraphType<Person>
{
    public PersonType()
    {
        Name = "Person";
        Description = "A person tracked in the system.";

        Field(p => p.Id, type: typeof(NonNullGraphType<IdGraphType>));

        // Flatten value objects; domain internals simply aren't declared
        Field<NonNullGraphType<StringGraphType>>("firstName")
            .Resolve(ctx => ctx.Source.Name.First);
        Field<NonNullGraphType<StringGraphType>>("lastName")
            .Resolve(ctx => ctx.Source.Name.Last);

        // Computed field
        Field<NonNullGraphType<StringGraphType>>("fullName")
            .Resolve(ctx => $"{ctx.Source.Name.First} {ctx.Source.Name.Last}");

        // Nullable scalar from a CLR property
        Field(p => p.Email, nullable: true);
    }
}
```

Nullability is driven by the graph type (`NonNullGraphType<T>`) or the `nullable:` argument — it is **not** inferred from C# nullable annotations the way HotChocolate infers it. Be deliberate: the schema-design guidance (non-null by default) requires wrapping types in `NonNullGraphType<>` here.

## Queries & Arguments

```csharp
public sealed class AppQuery : ObjectGraphType
{
    public AppQuery()
    {
        Field<PersonType>("person")
            .Argument<NonNullGraphType<IdGraphType>>("id")
            .ResolveAsync(async ctx =>
            {
                var id = ctx.GetArgument<Guid>("id");
                var repository = ctx.RequestServices!.GetRequiredService<IPersonRepository>();
                return await repository.GetByIdAsync(new PersonId(id), ctx.CancellationToken);
            });
    }
}
```

Resolve services from `ctx.RequestServices` (scoped to the request) rather than injecting them into the graph type's constructor — graph types are singletons, so constructor-injected scoped services (like a DbContext) are a lifetime bug. `IDataLoaderContextAccessor` is a safe constructor injection because it is itself a singleton accessor.

## Input Types & Mutations

There are no mutation conventions — build the payload shape yourself, which aligns with the payload/typed-error guidance in `operations.md` and `error-handling.md`:

```csharp
public sealed record CreatePersonInput(string FirstName, string LastName, string? Email);

public sealed class CreatePersonInputType : InputObjectGraphType<CreatePersonInput>
{
    public CreatePersonInputType()
    {
        Name = "CreatePersonInput";
        Field(i => i.FirstName);
        Field(i => i.LastName);
        Field(i => i.Email, nullable: true);
    }
}

public sealed class AppMutation : ObjectGraphType
{
    public AppMutation()
    {
        Field<NonNullGraphType<CreatePersonPayloadType>>("createPerson")
            .Argument<NonNullGraphType<CreatePersonInputType>>("input")
            .ResolveAsync(async ctx =>
            {
                var input = ctx.GetArgument<CreatePersonInput>("input");
                var repository = ctx.RequestServices!.GetRequiredService<IPersonRepository>();

                // Return domain errors as payload data, not thrown exceptions
                if (await repository.EmailExistsAsync(input.Email, ctx.CancellationToken))
                    return CreatePersonPayload.Failed(new DuplicateEmailError(input.Email));

                var person = Person.Create(new PersonName(input.FirstName, input.LastName));
                await repository.AddAsync(person, ctx.CancellationToken);
                return CreatePersonPayload.Succeeded(person);
            });
    }
}
```

The payload and error types are plain classes with their own `ObjectGraphType`s (and a `UnionGraphType` for the error union). More boilerplate than HotChocolate's `[Error<T>]`, but the schema shape is identical.

## DataLoaders (N+1 Prevention)

`AddDataLoader()` registers `IDataLoaderContextAccessor` and hooks batch dispatch into execution. Loaders are created inline in resolvers, keyed by name:

```csharp
public sealed class OrderType : ObjectGraphType<Order>
{
    public OrderType(IDataLoaderContextAccessor accessor)
    {
        // One-to-one: batches all customer lookups in the request into one query
        Field<CustomerType, Customer>("customer")
            .ResolveAsync(ctx =>
            {
                var loader = accessor.Context!.GetOrAddBatchLoader<Guid, Customer>(
                    "GetCustomersById",
                    ids => ctx.RequestServices!.GetRequiredService<ICustomerRepository>()
                        .GetByIdsAsync(ids, ctx.CancellationToken));
                return loader.LoadAsync(ctx.Source.CustomerId.Value);
            });

        // One-to-many: ILookup groups children by parent key
        Field<ListGraphType<OrderLineType>, IEnumerable<OrderLine>>("lines")
            .ResolveAsync(ctx =>
            {
                var loader = accessor.Context!.GetOrAddCollectionBatchLoader<Guid, OrderLine>(
                    "GetLinesByOrderId",
                    ids => ctx.RequestServices!.GetRequiredService<IOrderLineRepository>()
                        .GetByOrderIdsAsync(ids, ctx.CancellationToken));
                return loader.LoadAsync(ctx.Source.Id.Value);
            });
    }
}
```

`LoadAsync` returns `IDataLoaderResult<T>` — return it directly from `ResolveAsync` (do not await it inside the resolver; the executor dispatches the batch). Chain dependent loads with `.Then(...)`.

## Subscriptions

Subscription fields return an `IObservable<T>` via `ResolveStream`:

```csharp
public sealed class AppSubscriptions : ObjectGraphType
{
    public AppSubscriptions(IOrderEventStream events)
    {
        Field<OrderType, Order>("orderPlaced")
            .Argument<NonNullGraphType<IdGraphType>>("customerId")
            .ResolveStream(ctx =>
                events.OrdersPlacedFor(ctx.GetArgument<Guid>("customerId")));
    }
}
```

Back the stream with `System.Reactive` (`Subject<T>` / `ReplaySubject<T>`) or an event-bus adapter. Domain events feed the observable the same way they feed HotChocolate's `ITopicEventSender`.

## Error Handling

- **Payload errors** (business outcomes): return them as payload data — see the mutation example above.
- **GraphQL errors** (infrastructure): throw or add an `ExecutionError` with a code:

```csharp
ctx.Errors.Add(new ExecutionError("Not authorized to view this order")
{
    Code = "AUTH_NOT_AUTHORIZED",
});
```

- **Unhandled exceptions**: shape them centrally instead of leaking internals:

```csharp
builder.Services.AddGraphQL(b => b
    .ConfigureExecutionOptions(options =>
        options.UnhandledExceptionDelegate = async context =>
        {
            // Log the real exception server-side
            context.ErrorMessage = "An unexpected error occurred";
        }));
```

## Deprecation

```csharp
Field<NonNullGraphType<StringGraphType>>("firstName")
    .Resolve(ctx => ctx.Source.Name.First)
    .DeprecationReason("Use `displayName` instead. Will be removed after 2026-09-01.");
```

## Authorization

Authorization metadata lives on types/fields; `AddAuthorizationRule()` (package `GraphQL.Server.Authorization.AspNetCore` behavior now in core server packages) enforces it against ASP.NET Core policies:

```csharp
this.AuthorizeWithPolicy("CanViewOrders");            // whole type

Field<OrderType>("order")
    .AuthorizeWithPolicy("CanViewOrders")             // single field
    .ResolveAsync(/* ... */);
```

## Relay Conventions

GraphQL.NET has less built-in Relay support than HotChocolate:

- **Connections**: the `Connection<TNodeType>()` builder generates connection/edge types, but you resolve `first`/`after` slicing yourself — there is no `[UsePaging]` equivalent that translates to `IQueryable`.
- **Global object identification**: not built in. Implement the `Node` interface and `node(id:)` query manually, or use the community `GraphQL.Relay` package.

If the project needs heavy Relay semantics, weigh this gap when choosing the framework (see `relay-conventions.md` for what the schema must provide).
