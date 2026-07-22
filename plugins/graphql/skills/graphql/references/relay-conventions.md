# Relay Conventions

## What is Relay?

Relay is a set of GraphQL conventions (originally from Facebook's Relay client framework) that provide standardized patterns for pagination, object identification, and cache management. These conventions are useful regardless of which client framework you use.

## The Three Relay Conventions

1. **Global Object Identification** — Every entity has a globally unique ID and can be refetched via a `node` query
2. **Connections** — Standardized cursor-based pagination
3. **Mutations** — Single input argument, payload return type (covered in `operations.md`)

## Global Object Identification

### The `node` Interface

Any type that can be fetched by ID implements the `Node` interface:

```graphql
interface Node {
  id: ID!
}

type Person implements Node {
  id: ID!
  firstName: String!
  lastName: String!
}

type Order implements Node {
  id: ID!
  status: OrderStatus!
  totalAmount: Decimal!
}
```

### The `node` Query

A single query that can fetch any entity by its global ID:

```graphql
type Query {
  node(id: ID!): Node
  nodes(ids: [ID!]!): [Node]!
}
```

This enables:
- **Generic refetching** — clients can refresh any entity without knowing its type-specific query
- **Cache normalization** — clients like Apollo and Relay can cache by global ID
- **Cross-type lists** — timelines and feeds that mix different types

### Global IDs

Global IDs encode both the type and the database key, making them unique across the entire schema:

```
Raw database ID:    3f2504e0-4f89-11d3-9a0c-0305e82c3301
Global ID:          UGVyc29uOjNmMjUwNGUwLTRmODktMTFkMy05YTBjLTAzMDVlODJjMzMwMQ==
                    (base64 of "Person:3f2504e0-4f89-11d3-9a0c-0305e82c3301")
```

Clients should treat global IDs as **opaque strings** — never parse them.

### HotChocolate Implementation

```csharp
// Program.cs — enable node resolution
builder.Services
    .AddGraphQLServer()
    .AddQueryType()
    .AddGlobalObjectIdentification()    // enables node/nodes queries
    .AddType<PersonType>()
    .AddType<OrderType>();
```

```csharp
// Mark types as node types
[ObjectType<Person>]
public static partial class PersonType
{
    static partial void Configure(IObjectTypeDescriptor<Person> descriptor)
    {
        descriptor.ImplementsNode();
    }

    // Node resolver — how to fetch this type by its global ID
    [NodeResolver]
    public static async Task<Person?> GetByIdAsync(
        Guid id,          // HotChocolate decodes the global ID and passes the raw value
        IPersonRepository repository,
        CancellationToken ct)
        => await repository.GetByIdAsync(new PersonId(id), ct);
}
```

### Using `[ID]` for Global ID Encoding

```csharp
[QueryType]
public static class PersonQueries
{
    // Input: client sends a global ID string
    // HotChocolate decodes it to the raw Guid
    public static async Task<Person?> GetPersonAsync(
        [ID] Guid id,
        IPersonRepository repository,
        CancellationToken ct)
        => await repository.GetByIdAsync(new PersonId(id), ct);
}

// On output types, IDs are automatically encoded as global IDs
// when GlobalObjectIdentification is enabled
```

## Connections (Cursor-Based Pagination)

### Why Connections Over Offset Pagination

| | Offset (`skip/take`) | Cursor (connections) |
|---|---|---|
| **Consistency** | Items shift when data changes | Stable — cursor points to a fixed position |
| **Performance** | `OFFSET N` gets slower as N grows | Cursor-based seeks are O(1) |
| **Real-time** | New items cause duplicates/skips | New items don't affect current page |
| **Infinite scroll** | Problematic | Natural fit |

### Connection Structure

```graphql
type PersonConnection {
  edges: [PersonEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type PersonEdge {
  node: Person!
  cursor: String!        # opaque cursor — don't parse
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

### Pagination Arguments

```graphql
type Query {
  # Forward pagination
  persons(first: Int!, after: String): PersonConnection!

  # Backward pagination
  persons(last: Int!, before: String): PersonConnection!
}
```

- `first` + `after` — "give me the first N items after this cursor"
- `last` + `before` — "give me the last N items before this cursor"

### HotChocolate Implementation

```csharp
[QueryType]
public static class PersonQueries
{
    [UsePaging(
        MaxPageSize = 50,
        DefaultPageSize = 20,
        IncludeTotalCount = true)]
    [UseFiltering]
    [UseSorting]
    public static IQueryable<Person> GetPersons(AppDbContext dbContext)
        => dbContext.Persons;
}
```

HotChocolate automatically:
- Generates the `PersonConnection`, `PersonEdge`, and `PageInfo` types
- Handles cursor encoding/decoding
- Applies `first`/`after`/`last`/`before` to the `IQueryable`
- Computes `totalCount` when requested

### Nested Connections

Use connections for any relationship that can grow:

```csharp
[ObjectType<Person>]
public static partial class PersonType
{
    [UsePaging(MaxPageSize = 100, DefaultPageSize = 20)]
    public static IQueryable<WeightReading> GetWeightHistory(
        [Parent] Person person,
        AppDbContext dbContext)
        => dbContext.WeightReadings
            .Where(r => r.PersonId == person.Id)
            .OrderByDescending(r => r.RecordedAt);
}
```

### When to Use Connections vs. Simple Lists

**Use connections** for:
- Any collection that can grow unbounded (people, orders, readings)
- Data that clients will paginate or infinite-scroll through
- Cross-module relationships

**Use simple lists `[Type!]!`** for:
- Small, bounded collections (a person's allergies, order line items, enum values)
- Computed aggregations (weekly summary stats)
- Collections that will always be loaded in full
