# Operations — Queries, Mutations & Subscriptions

## Queries

### Design Principles
- Queries are **read-only** — no side effects
- Name queries as **nouns** or **noun phrases** (`person`, `persons`, `order`, `orders`)
- Return non-null where possible; use nullable only when "not found" is a valid outcome
- Support filtering, sorting, and pagination for collection queries

```graphql
type Query {
  """Fetch a person by their unique ID. Returns null if not found."""
  person(id: ID!): Person

  """Paginated list of all persons, with optional filtering."""
  persons(
    first: Int
    after: String
    where: PersonFilterInput
    order: [PersonSortInput!]
  ): PersonConnection!

  """Fetch an order by ID."""
  order(id: ID!): Order
}
```

### Single Item vs. Collection
- **Single item**: `person(id: ID!): Person` — nullable, returns `null` for not found
- **Collection**: `persons(...): PersonConnection!` — non-null, returns empty connection when no results
- Don't add `personByEmail`, `personByName` etc. — use filter arguments on the collection query instead

### Filtering and Sorting
Use input types for filtering with a consistent pattern:

```graphql
input PersonFilterInput {
  firstName: StringOperationFilterInput
  lastName: StringOperationFilterInput
  dateOfBirth: DateOperationFilterInput
  and: [PersonFilterInput!]
  or: [PersonFilterInput!]
}
```

## Mutations

### Design Principles
- Mutations represent **domain actions**, not CRUD operations
- Name mutations as **verbs** describing the action (`createPerson`, `recordWeight`, `placeOrder`)
- Every mutation takes a **single input argument** and returns a **payload type**
- Payloads include the modified entity and any errors

### Naming
```graphql
# Good — describes domain actions
type Mutation {
  createPerson(input: CreatePersonInput!): CreatePersonPayload!
  recordWeight(input: RecordWeightInput!): RecordWeightPayload!
  placeOrder(input: PlaceOrderInput!): PlaceOrderPayload!
  cancelOrder(input: CancelOrderInput!): CancelOrderPayload!
}

# Bad — generic CRUD
type Mutation {
  updatePerson(id: ID!, data: PersonInput!): Person!
  upsertWeight(input: WeightInput!): Weight!
}
```

### Input Types
- One input type per mutation — don't reuse inputs across mutations
- Include only the fields the mutation needs
- Use `ID!` for references to existing entities

```graphql
input CreatePersonInput {
  firstName: String!
  lastName: String!
  dateOfBirth: Date
  email: String
}

input PlaceOrderInput {
  customerId: ID!
  lines: [OrderLineInput!]!
}

input OrderLineInput {
  productId: ID!
  quantity: Int!
}
```

### Payload Types
Every mutation returns a payload with the result and possible errors:

```graphql
type CreatePersonPayload {
  person: Person
  errors: [CreatePersonError!]
}

union CreatePersonError = ValidationError | DuplicateEmailError

type ValidationError {
  message: String!
  field: String!
}

type DuplicateEmailError {
  message: String!
  email: String!
}
```

Why payloads over throwing errors:
- **Typed errors** — clients can handle specific error cases
- **Partial success** — some mutations can succeed partially
- **No reliance on transport-level errors** — GraphQL errors are for infrastructure failures, not business logic

## Subscriptions

### Design Principles
- Subscriptions are for **real-time updates** — don't use them as a polling replacement
- Name subscriptions with the `on` prefix (`onOrderPlaced`, `onWeightRecorded`)
- Keep subscription payloads lean — clients can query for additional data
- Subscriptions pair naturally with **domain events**

```graphql
type Subscription {
  """Emitted when a new order is placed."""
  onOrderPlaced(customerId: ID!): Order!

  """Emitted when a weight reading is recorded for the given person."""
  onWeightRecorded(personId: ID!): WeightReading!
}
```

### Subscription Granularity
- **Too broad**: `onPersonUpdated` — fires on every change, clients filter client-side
- **Too narrow**: `onPersonFirstNameChanged` — too many subscription types to manage
- **Right level**: `onOrderPlaced`, `onWeightRecorded` — maps to meaningful domain events

### Connecting to Domain Events
Subscriptions should be backed by domain events:

```
Domain Event (OrderPlaced) → Event Bus → Subscription (onOrderPlaced) → Client
```

Don't create subscriptions that poll the database — they should be push-based from events.
