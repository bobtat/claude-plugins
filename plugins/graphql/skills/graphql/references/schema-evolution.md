# Schema Evolution & Deprecation

## Core Philosophy

GraphQL APIs evolve continuously — no versioning (no `/v2/graphql`). The schema grows additively and old fields are phased out gracefully through a lifecycle.

## Field Lifecycle

```
1. Add new field (non-breaking)
2. Migrate clients to new field
3. Deprecate old field (non-breaking)
4. Monitor usage of deprecated field
5. Remove old field (breaking — only when safe)
```

## Adding Fields (Always Safe)

Adding fields, types, enum values, or arguments with defaults is always non-breaking:

```csharp
// Before
[ObjectType<Person>]
public static partial class PersonType
{
    public static string GetFullName([Parent] Person person)
        => $"{person.Name.First} {person.Name.Last}";
}

// After — new field added, existing clients unaffected
[ObjectType<Person>]
public static partial class PersonType
{
    public static string GetFullName([Parent] Person person)
        => $"{person.Name.First} {person.Name.Last}";

    // New field — no client breaks
    public static string GetDisplayName([Parent] Person person)
        => person.PreferredName ?? person.Name.First;
}
```

## Deprecating Fields

Mark fields for removal. Deprecated fields remain functional but signal to clients they should migrate.

```csharp
// Using HotChocolate's descriptor
static partial void Configure(IObjectTypeDescriptor<Person> descriptor)
{
    descriptor.Field(p => p.Name.First)
        .Name("firstName")
        .Deprecated("Use `displayName` instead. Will be removed after 2026-09-01.");
}

// Or via attribute
[GraphQLDeprecated("Use `displayName` instead.")]
public static string GetFirstName([Parent] Person person)
    => person.Name.First;
```

In the schema this produces:
```graphql
type Person {
  firstName: String! @deprecated(reason: "Use `displayName` instead. Will be removed after 2026-09-01.")
  displayName: String!
}
```

## Deprecation Best Practices

### Always include in the deprecation reason:
- **What to use instead** — "Use `displayName` instead"
- **When it will be removed** — "Will be removed after 2026-09-01"
- **Why it's changing** (if helpful) — "Consolidated name fields for consistency"

### Deprecation is appropriate for:
- Fields being renamed
- Fields being replaced by richer types (e.g., `weight: Float` → `weight: Weight` with unit)
- Fields moving to a different location in the graph
- Arguments being restructured

### Deprecation is NOT appropriate for:
- Security-sensitive fields that must be removed immediately
- Fields that return incorrect data — fix or remove them

## Renaming Fields

Renaming is a two-step process — you can't rename in place:

```csharp
// Step 1: Add new field, deprecate old
[GraphQLDeprecated("Use `dateOfBirth` instead. Will be removed after 2026-09-01.")]
public static DateOnly? GetDob([Parent] Person person)
    => person.DateOfBirth;

public static DateOnly? GetDateOfBirth([Parent] Person person)
    => person.DateOfBirth;

// Step 2 (after clients migrate): Remove the deprecated field
```

## Changing Field Types

Never change a field's type in place — it breaks existing clients. Instead:

```csharp
// Before: weight was a simple float
// type Person { weight: Float }

// Step 1: Add new typed field, deprecate old
[GraphQLDeprecated("Use `currentWeight` which includes the unit. Will be removed after 2026-09-01.")]
public static double? GetWeight([Parent] Person person)
    => person.LatestWeight?.ToKilograms().Value;

public static Weight? GetCurrentWeight([Parent] Person person)
    => person.LatestWeight;
```

## Evolving Input Types

Adding optional fields to inputs is safe. Making optional fields required is breaking.

```csharp
// Safe — new optional field with default
public sealed record CreatePersonInput(
    string FirstName,
    string LastName,
    string? Email = null,
    DateOnly? DateOfBirth = null,
    string? PreferredName = null   // new optional field — safe
);

// BREAKING — don't do this
// Making a previously optional field required
// Adding a new required field without a default
```

## Evolving Enums

Adding enum values is technically non-breaking but can surprise clients:

```graphql
# Before
enum WeightUnit { KILOGRAMS POUNDS }

# After — clients with exhaustive switch/match will fail
enum WeightUnit { KILOGRAMS POUNDS STONE }
```

**Mitigation**: Document that enums may grow and clients should handle unknown values.

## Monitoring Deprecated Field Usage

Before removing deprecated fields, verify no clients are using them. Use your framework's instrumentation to track which fields are queried and set up alerts for deprecated field usage before removal.

## Schema Change Review Checklist

Before merging schema changes, verify:

1. **No removed fields** — only additions and deprecations
2. **No changed types** — field types must not change
3. **No new required arguments** — new args must have defaults
4. **No removed enum values** — only additions
5. **Deprecations include reason and timeline** — clients need migration guidance
6. **Non-null additions are safe** — new non-null fields must have resolvers that always succeed
