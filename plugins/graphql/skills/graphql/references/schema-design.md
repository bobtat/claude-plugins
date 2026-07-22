# Schema Design

## Type Design

### Object Types
Model types around what consumers need, not your database schema:

```graphql
# Good — consumer-focused, descriptive
type Person {
  id: ID!
  firstName: String!
  lastName: String!
  fullName: String!          # computed field — easy for clients
  age: Int                   # nullable — might not have date of birth
  dateOfBirth: Date
  latestWeight: Weight       # navigates the graph
  weightHistory(first: Int, after: String): WeightConnection!
}

# Bad — mirrors database tables
type Person {
  personId: UUID!
  first_name: String!
  last_name: String!
  dob: String               # untyped, snake_case
}
```

### Naming Conventions
- **Types**: PascalCase (`Person`, `WorkoutSession`, `BloodPressureReading`)
- **Fields**: camelCase (`firstName`, `dateOfBirth`, `heartRate`)
- **Enums**: SCREAMING_SNAKE_CASE values (`KILOGRAMS`, `POUNDS`, `RESTING_HEART_RATE`)
- **Input types**: Suffix with `Input` (`CreatePersonInput`, `RecordWeightInput`)
- **Payloads**: Suffix with `Payload` (`CreatePersonPayload`, `RecordWeightPayload`)
- **Connections**: Suffix with `Connection` (`WeightConnection`, `OrderConnection`)

### Nullability
Non-null is the default stance. Make a field nullable only when:
- The data genuinely might not exist (e.g., `dateOfBirth` before user provides it)
- The field can fail independently (e.g., a federated field from another service)
- You need room to return partial results

```graphql
type Person {
  id: ID!                    # always exists
  firstName: String!         # required
  email: String              # nullable — not every person has one
  latestWeight: Weight       # nullable — no readings yet
  weightHistory: WeightConnection!  # non-null — empty list, not null
}
```

### Lists
- Use `[Type!]!` (non-null list of non-null items) as the default for collections
- Never return `null` for a list — return an empty list instead
- Use connections (pagination) for lists that can grow unbounded

## Pagination — Connections Pattern

Use the Relay connections spec for any list that can grow:

```graphql
type Query {
  persons(first: Int, after: String, last: Int, before: String): PersonConnection!
}

type PersonConnection {
  edges: [PersonEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type PersonEdge {
  node: Person!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

When to use connections vs. simple lists:
- **Connections** — any collection that could grow (people, orders, readings)
- **Simple lists** `[Type!]!` — small, bounded collections (enum values, a person's allergies, order line items)

## Descriptions

Add descriptions to types and fields — they appear in introspection and tooling:

```graphql
"""A person tracked in the system."""
type Person {
  """Unique identifier for the person."""
  id: ID!

  """The person's most recent weight measurement, if any."""
  latestWeight: Weight

  """Paginated history of weight measurements, ordered by date descending."""
  weightHistory(first: Int, after: String): WeightConnection!
}
```

## Custom Scalars

Use custom scalars for domain-specific types rather than overloading `String`:

```graphql
scalar Date       # 2026-04-07
scalar DateTime   # 2026-04-07T14:30:00Z
scalar UUID       # strongly-typed identifiers
scalar Decimal    # precise monetary values
```

## Enums

Use enums for fixed sets of options:

```graphql
enum WeightUnit {
  KILOGRAMS
  POUNDS
}

enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  DELIVERED
  CANCELLED
}
```

## Interface and Union Types

Use when multiple types share a shape or a field can return different types:

```graphql
# Interface — shared fields across related types
interface Timestamped {
  id: ID!
  createdAt: DateTime!
}

type Order implements Timestamped {
  id: ID!
  createdAt: DateTime!
  status: OrderStatus!
  totalAmount: Decimal!
}

type Payment implements Timestamped {
  id: ID!
  createdAt: DateTime!
  amount: Decimal!
  method: PaymentMethod!
}

# Union — unrelated types grouped for a feed
union TimelineEntry = Order | Payment | Shipment
```
