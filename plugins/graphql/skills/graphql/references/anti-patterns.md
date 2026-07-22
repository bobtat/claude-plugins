# GraphQL Anti-Patterns

## Schema Design Anti-Patterns

### 1. Database-Driven Schema
**Problem**: Mirroring database tables as GraphQL types exposes internals and creates a rigid API.

```graphql
# Anti-pattern — this is just your database schema with a GraphQL syntax
type PersonEntity {
  person_id: Int!
  first_name: String
  last_name: String
  created_at: String
  updated_at: String
  is_deleted: Boolean!
}

# Better — consumer-focused, hides implementation details
type Person {
  id: ID!
  firstName: String!
  lastName: String!
  fullName: String!
}
```

**Rule**: Design the schema for your consumers, then map it to your domain model.

### 2. God Types
**Problem**: A single type with dozens of fields that tries to represent everything.

```graphql
# Anti-pattern — Order does too much
type Order {
  id: ID!
  # ... 15 order fields ...
  customerName: String
  customerEmail: String
  shippingStreet: String
  shippingCity: String
  paymentMethod: String
  paymentStatus: String
  # ... 20 more flattened fields ...
}

# Better — compose through the graph
type Order {
  id: ID!
  status: OrderStatus!
  totalAmount: Decimal!
  customer: Customer!
  shippingAddress: Address
  payment: Payment
  lines(first: Int, after: String): OrderLineConnection!
}
```

**Rule**: If a type has more than ~10-12 fields, look for natural groupings to extract.

### 3. Stringly-Typed Fields
**Problem**: Using `String` for values that have a fixed set of options.

```graphql
# Anti-pattern
type Order {
  status: String!    # "pending"? "PENDING"? "Pending"?
}

# Better
type Order {
  status: OrderStatus!
}
enum OrderStatus { PENDING CONFIRMED SHIPPED DELIVERED CANCELLED }
```

**Rule**: If a field has a known set of valid values, use an enum.

### 4. Nullable Everything
**Problem**: Making every field nullable "just in case" removes useful type information.

```graphql
# Anti-pattern — clients can't trust anything
type Person {
  id: ID
  firstName: String
  lastName: String
  orders: [Order]
}

# Better — be explicit about what's guaranteed
type Person {
  id: ID!
  firstName: String!
  lastName: String!
  orders: [Order!]!    # non-null list of non-null items
}
```

**Rule**: Default to non-null. Only make fields nullable when absence has semantic meaning.

## Operation Anti-Patterns

### 5. Generic CRUD Mutations
**Problem**: Mutations that mirror REST CRUD operations lose domain intent.

```graphql
# Anti-pattern — what does "update" mean? Any field? All fields?
type Mutation {
  createOrder(input: OrderInput!): Order!
  updateOrder(id: ID!, input: OrderInput!): Order!
  deleteOrder(id: ID!): Boolean!
}

# Better — specific actions with clear intent
type Mutation {
  placeOrder(input: PlaceOrderInput!): PlaceOrderPayload!
  cancelOrder(input: CancelOrderInput!): CancelOrderPayload!
  shipOrder(input: ShipOrderInput!): ShipOrderPayload!
}
```

**Rule**: Name mutations after domain actions. Each mutation takes only the fields it needs.

### 6. Shared Input Types
**Problem**: Reusing the same input type across mutations leads to confusing optional fields.

```graphql
# Anti-pattern — which fields are required for which mutation?
input OrderInput {
  customerId: ID
  lines: [OrderLineInput]
  shippingAddress: AddressInput
  notes: String
}

type Mutation {
  placeOrder(input: OrderInput!): Order!    # are all fields needed?
  updateOrder(input: OrderInput!): Order!   # which are optional?
}

# Better — dedicated inputs per mutation
input PlaceOrderInput {
  customerId: ID!      # clearly required
  lines: [OrderLineInput!]!
}

input UpdateShippingInput {
  orderId: ID!
  shippingAddress: AddressInput!
}
```

**Rule**: One input type per mutation. Never reuse inputs across operations.

### 7. Throwing Errors for Business Logic
**Problem**: Using GraphQL errors (transport-level) for domain validation.

```graphql
# Anti-pattern — error is in the errors array, untyped
{
  "errors": [{ "message": "Email already exists", "extensions": { "code": "DUPLICATE" } }],
  "data": { "createPerson": null }
}

# Better — errors are part of the payload, typed and handleable
{
  "data": {
    "createPerson": {
      "person": null,
      "errors": [{ "__typename": "DuplicateEmailError", "email": "test@example.com" }]
    }
  }
}
```

**Rule**: Reserve GraphQL errors for infrastructure failures (auth, rate limiting, server errors). Use typed payload errors for business logic.

## Performance Anti-Patterns

### 8. N+1 Queries
**Problem**: Resolving a list of items where each item triggers a separate database query.

```graphql
# This query could trigger 1 + N database calls
{
  orders(first: 50) {
    edges {
      node {
        id
        customer { name }    # separate query per order!
      }
    }
  }
}
```

**Rule**: Always use DataLoaders for fields that resolve related data. See `performance.md`.

### 9. Unbounded Queries
**Problem**: Allowing clients to request unlimited data.

```graphql
# Anti-pattern — no limits
type Query {
  orders: [Order!]!                   # could return millions
  allCustomers: [Customer!]!          # unbounded
}

# Better — require pagination
type Query {
  orders(first: Int!, after: String): OrderConnection!
}
```

**Rule**: Paginate all collection fields. Set a maximum page size server-side.

### 10. Deeply Nested Queries
**Problem**: Allowing clients to traverse the graph infinitely.

```graphql
# Dangerous — unbounded depth
{
  person(id: "1") {
    friends {
      friends {
        friends {
          friends {
            # infinite nesting
          }
        }
      }
    }
  }
}
```

**Rule**: Set query depth limits and complexity analysis. See `performance.md`.

## Structural Anti-Patterns

### 11. Leaking Module Boundaries
**Problem**: Exposing internal module structure through the schema.

```graphql
# Anti-pattern — module internals in the schema
type Query {
  orderModule_getOrderById(id: ID!): OrderModuleOrderEntity
  inventoryModule_getStock(productId: ID!): [InventoryModuleStockRecord!]
}

# Better — unified schema, module boundaries invisible to consumers
type Query {
  order(id: ID!): Order
}
type Order {
  lines: [OrderLine!]!
  shipments(first: Int, after: String): ShipmentConnection!
}
```

**Rule**: The schema should feel like one cohesive API, not a collection of modules bolted together.
