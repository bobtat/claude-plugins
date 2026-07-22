# Error Handling Strategy

## The Two Error Channels

GraphQL has two distinct ways to communicate errors. Using the right one matters.

### 1. GraphQL Errors (transport-level)
The `errors` array at the root of a GraphQL response. Reserved for **infrastructure failures** — things the client can't meaningfully handle per-field.

```json
{
  "errors": [
    {
      "message": "Not authenticated",
      "extensions": { "code": "AUTH_NOT_AUTHENTICATED" }
    }
  ],
  "data": null
}
```

**Use for:**
- Authentication failures (not logged in)
- Authorization failures (insufficient permissions)
- Rate limiting
- Server errors (unhandled exceptions)
- Malformed queries
- Timeout / cancellation

### 2. Payload Errors (domain-level)
Typed error objects returned as part of a mutation's payload. Used for **business logic outcomes** the client should handle.

```json
{
  "data": {
    "createPerson": {
      "person": null,
      "errors": [
        {
          "__typename": "DuplicateEmailError",
          "message": "A person with this email already exists",
          "email": "jane@example.com"
        }
      ]
    }
  }
}
```

**Use for:**
- Validation failures (empty name, invalid date range)
- Business rule violations (duplicate email, conflicting schedule)
- Domain-specific "not found" (entity doesn't exist when creating a related record)
- Concurrent modification conflicts

## Decision Guide

```
Is the error about the request itself?
  → Yes: authentication, authorization, malformed query → GraphQL error
  → No: Is it a domain/business rule violation?
    → Yes: validation, duplicates, conflicts → Payload error
    → No: Is it an infrastructure failure?
      → Yes: database down, timeout → GraphQL error
```

## Defining Error Types

```csharp
// Base interface for all domain errors (optional but useful)
public interface IDomainError
{
    string Message { get; }
}

// Specific error types — these become GraphQL union members
public sealed record ValidationError(string Message, string Field) : IDomainError;

public sealed record DuplicateEmailError(string Message, string Email) : IDomainError;

public sealed record NotFoundError(string Message, string EntityName, string Id) : IDomainError;

public sealed record ConflictError(string Message, string Details) : IDomainError;
```

## Handling Errors in Queries

Queries typically don't use payload errors. Instead:

- **Not found**: Return `null` with a nullable return type
- **Authorization**: Use your framework's auth middleware — it handles the GraphQL error
- **Invalid arguments**: Let the framework's validation handle it

## Error Codes

Use consistent error codes for GraphQL-level errors:

| Code | When |
|------|------|
| `AUTH_NOT_AUTHENTICATED` | No valid credentials |
| `AUTH_NOT_AUTHORIZED` | Insufficient permissions |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Unhandled server error |
| `VALIDATION_ERROR` | Request validation failed (malformed input) |
| `TIMEOUT` | Operation timed out |

## Client-Side Error Handling Pattern

Design errors so clients can handle them with pattern matching:

```graphql
mutation CreatePerson($input: CreatePersonInput!) {
  createPerson(input: $input) {
    person {
      id
      firstName
    }
    errors {
      __typename
      ... on ValidationError {
        message
        field       # client can highlight the specific form field
      }
      ... on DuplicateEmailError {
        message
        email       # client can show "this email is taken"
      }
    }
  }
}
```

The `__typename` field lets clients switch on error type without parsing messages.

## Global Error Filter

Catch unhandled exceptions and convert them to safe GraphQL errors. Don't leak internal exception details in production:

```csharp
// Framework-specific — see hotchocolate.md for HotChocolate implementation
// The filter should:
// 1. Strip exception details from error messages
// 2. Map known exception types to appropriate error codes
// 3. Log the original exception server-side
```

## Anti-Patterns

- **Don't use error codes in payload errors** — use union types and `__typename` instead
- **Don't put stack traces in error messages** — use a global error filter
- **Don't throw generic exceptions** — use specific exception types mapped to typed errors
- **Don't use GraphQL errors for validation** — clients can't programmatically handle them per-field
- **Don't swallow errors silently** — log them server-side even if the client gets a clean message
