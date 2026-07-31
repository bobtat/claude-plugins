# Collapsing Duplicated Tests Into a Table (TypeScript)

Demonstrates when parameterizing helps, when it hides meaning, and how to keep each case self-documenting.

## The Starting Point

```typescript
describe("validatePassword", () => {
  it("test 1", () => {
    const result = validatePassword("abc");
    expect(result.valid).toBe(false);
  });

  it("test 2", () => {
    const result = validatePassword("abcdefgh");
    expect(result.valid).toBe(false);
  });

  it("test 3", () => {
    const result = validatePassword("abcdefg1");
    expect(result.valid).toBe(false);
  });

  it("test 4", () => {
    const result = validatePassword("Abcdefg1");
    expect(result.valid).toBe(true);
  });

  it("test 5", () => {
    const result = validatePassword("Abcdefg1!");
    expect(result.valid).toBe(true);
  });

  it("rejects short passwords", () => {
    expect(validatePassword("Ab1!").valid).toBe(false);
    expect(validatePassword("Ab1!x").valid).toBe(false);
    expect(validatePassword("Ab1!xy").valid).toBe(false);
    expect(validatePassword("Ab1!xyz").valid).toBe(false);
  });
});
```

Problems: names carry no information, so a red `test 3` tells you nothing; the last test is four assertions in one and stops at the first failure; and nothing asserts *why* a password was rejected, so a rule failing for the wrong reason passes.

## Step 1 — Assert the Reason, Not Just the Verdict

Before parameterizing, fix the assertion. `valid: false` passes when any rule rejects — including the wrong one. If `validatePassword` returns error codes, assert them:

```typescript
expect(validatePassword("abcdefgh")).toEqual({
  valid: false,
  errors: ["missing_uppercase", "missing_digit"],
});
```

Now a test named "rejects a password with no digit" actually verifies that. This matters more than the table: **a parameterized suite over a weak assertion multiplies a useless test.**

## Step 2 — The Table

Each row names itself, states the input, and states the full expected outcome:

```typescript
describe("validatePassword", () => {
  it.each([
    {
      scenario: "meets every rule comfortably",
      password: "Abcdefghij1",
      expected: { valid: true, errors: [] },
    },
    {
      scenario: "is one character short of the minimum",
      password: "Abcdef1",
      expected: { valid: false, errors: ["too_short"] },
    },
    {
      scenario: "is exactly at the minimum length",
      password: "Abcdefg1",
      expected: { valid: true, errors: [] },
    },
    {
      scenario: "has no uppercase letter",
      password: "abcdefg1",
      expected: { valid: false, errors: ["missing_uppercase"] },
    },
    {
      scenario: "has no digit",
      password: "Abcdefgh",
      expected: { valid: false, errors: ["missing_digit"] },
    },
    {
      scenario: "breaks several rules at once",
      password: "abc",
      expected: {
        valid: false,
        errors: ["too_short", "missing_uppercase", "missing_digit"],
      },
    },
    {
      scenario: "is empty",
      password: "",
      expected: {
        valid: false,
        errors: ["too_short", "missing_uppercase", "missing_digit"],
      },
    },
  ])("validates a password that $scenario", ({ password, expected }) => {
    expect(validatePassword(password)).toEqual(expected);
  });
});
```

`it.each` rather than `describe.each` wrapping a single `it`: one row is one test, so the extra nesting level bought nothing but a deeper path in the output. The title carries only the scenario — putting the expected value in the name (`` returns ${JSON.stringify(...)} ``) would both restate the assertion and rot the moment the expectation changes.

Failure output now reads:

```
✕ validates a password that has no digit
    - Expected: { valid: false, errors: ["missing_digit"] }
    + Received: { valid: false, errors: ["missing_digit", "missing_special"] }
```

That names the broken rule and shows the diff — without opening the file.

## Step 3 — Keep the Cases That Don't Fit

Not everything belongs in the table. Behaviors with a different shape stay as their own tests:

```typescript
  it("does not include the password in the error output", () => {
    // Guards against leaking the attempted password into logs via errors.
    const result = validatePassword("Sup3rSecret!");
    expect(JSON.stringify(result)).not.toContain("Sup3rSecret");
  });

  it("evaluates a 10,000-character password without blowing up", () => {
    expect(() => validatePassword("A1".repeat(5000))).not.toThrow();
  });
```

Forcing these into the table would mean adding columns used by one row each — the sign that a case wants its own test.

## When a Table Is the Wrong Choice

Parameterizing hurts when it hides the difference between cases:

```typescript
// Bad: what does this prove? Three rows exercising identical logic.
it.each([
  ["abcdefg1", false],
  ["abcdefg2", false],
  ["abcdefg3", false],
])("password %s", (password, valid) => { /* ... */ });
```

Three values in the same equivalence class is one test, not three. Also avoid a table when:

- **Cases need different setup.** Conditional arrange inside the body (`if (scenario === "premium") ...`) is logic in the test — split it.
- **The expected value must be computed** from the input inside the body. That reintroduces the production formula into the test.
- **The parameter list needs a comment to be read.** `[100, 10, true, false, 85.5]` is unreadable; use named object fields as above, or write separate tests.

The test that a table replaces well is one you'd otherwise copy-paste with a single literal changed. If more than the literal changes, keep them separate.

## Property-Based as the Complement

Where a rule holds for *all* inputs, one property covers cases you'd never enumerate. But be careful what you assert, because the obvious property is a trap:

```typescript
// WRONG — this is the "expected value computed from the input" anti-pattern.
it("reports missing_uppercase iff there is no uppercase letter", () => {
  fc.assert(
    fc.property(fc.string(), (password) => {
      const { errors } = validatePassword(password);
      expect(errors.includes("missing_uppercase")).toBe(!/[A-Z]/.test(password));
    }),
  );
});
```

If the implementation checks uppercase with `/[A-Z]/`, this property restates the implementation and can only ever pass. It cannot tell you that `/[A-Z]/` is itself the wrong rule — which it is, for titlecase characters like `ǅ` (U+01C5) and for non-Latin scripts. A property that mirrors the production predicate is as vacuous as an example test that computes its own expectation.

Useful properties assert **relationships the implementation doesn't state directly**:

```typescript
import fc from "fast-check";

it("is valid exactly when it reports no errors", () => {
  fc.assert(
    fc.property(fc.fullUnicodeString(), (password) => {
      const { valid, errors } = validatePassword(password);
      expect(valid).toBe(errors.length === 0);
    }),
  );
});

it("never reports the same rule twice", () => {
  fc.assert(
    fc.property(fc.fullUnicodeString(), (password) => {
      const { errors } = validatePassword(password);
      expect(new Set(errors).size).toBe(errors.length);
    }),
  );
});

it("appending characters never introduces a too_short error", () => {
  fc.assert(
    fc.property(fc.fullUnicodeString(), fc.fullUnicodeString(), (base, suffix) => {
      const longer = validatePassword(base + suffix);
      expect(longer.errors.includes("too_short")).toBe(
        base.length + suffix.length < 8,
      );
    }),
  );
});
```

Each of these can fail for a real reason: a `valid`/`errors` inconsistency, a duplicated code from two rules firing on the same cause, a length check that counts UTF-16 code units where the requirement is characters (`"😀".length === 2` — a genuine class of bug here, and one `fc.string()` cannot reach because its default alphabet is printable ASCII).

Two lessons worth carrying: **choose the generator deliberately** — `fc.string()` will never produce the Unicode input you're worried about — and **assert a law, not the formula**. Keep the table too: it documents intent for a reader, while the property hunts for the input you didn't imagine.

## Result

| | Before | After |
|---|---|---|
| Named behaviors | 1 of 6 | All |
| Asserted the *reason* for rejection | No | Yes |
| Boundary cases (empty, one-under, exactly-at) | 1 of 3 | 3 of 3 |
| Failure message identifies the rule | No | Yes |
| Multi-assertion tests aborting early | 1 | 0 |
| Duplicate rows in the same equivalence class | 3 | 0 |
| Lines of test code | 28 | ~42 — and each line carries information |

Fewer lines is not the goal. The table earned its place by making every case named, complete, and independently reported.
