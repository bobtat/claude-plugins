# Worked Example: Long Method → Extract Function

Demonstrates: smell diagnosis, Slide Statements, Replace Temp with Query, Extract Function, and the test-after-every-step cadence. Language: TypeScript.

## Before

```typescript
function printOwing(invoice: Invoice): string {
  let outstanding = 0;
  let result = "";

  // print banner
  result += "***********************\n";
  result += "**** Customer Owes ****\n";
  result += "***********************\n";

  // calculate outstanding
  for (const o of invoice.orders) {
    outstanding += o.amount;
  }

  // record due date
  const today = new Date();
  invoice.dueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);

  // print details
  result += `name: ${invoice.customer}\n`;
  result += `amount: ${outstanding}\n`;
  result += `due: ${invoice.dueDate.toLocaleDateString()}\n`;
  return result;
}
```

## Diagnosis

- **Long Method**: four sections, each announced by a comment — the comments are begging to be function names.
- Mixed levels of abstraction: banner formatting next to date arithmetic.
- One hidden trap: the function is not pure — it **mutates `invoice.dueDate`** (a modifier hiding inside what looks like a query; see Separate Query from Modifier).

## Precondition

Tests exist and pass:

```typescript
test("prints owing with 30-day due date", () => { /* asserts full output string */ });
test("sums multiple orders", () => { /* ... */ });
```

If they didn't exist, write them first against current behavior (characterization), including the mutation of `invoice.dueDate`.

## Steps

**Step 1 — Extract the banner** (no locals involved, easiest first):

```typescript
function bannerText(): string {
  return "***********************\n" +
         "**** Customer Owes ****\n" +
         "***********************\n";
}
// in printOwing:  result += bannerText();
```

▶ Run tests. Green. Delete the `// print banner` comment — the name replaced it.

**Step 2 — Replace Temp with Query for `outstanding`.** The loop writes a local that the print section reads; extracting either section is blocked until the shared temp is gone:

```typescript
function calculateOutstanding(invoice: Invoice): number {
  let outstanding = 0;
  for (const o of invoice.orders) outstanding += o.amount;
  return outstanding;
}
// in printOwing:  const outstanding = calculateOutstanding(invoice);
```

▶ Run tests. Green. (Later, `calculateOutstanding` can shrink to a `reduce` — a separate micro-step.)

**Step 3 — Extract the due-date recording**, keeping the side effect explicit in the name:

```typescript
function recordDueDate(invoice: Invoice): void {
  const today = new Date();
  invoice.dueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
}
```

▶ Run tests. Green. The mutation now has a name that admits it (`record...`), making the query/modifier mix visible for a future refactoring.

**Step 4 — Extract the details printing**, passing what it reads:

```typescript
function printDetails(invoice: Invoice, outstanding: number): string {
  return `name: ${invoice.customer}\n` +
         `amount: ${outstanding}\n` +
         `due: ${invoice.dueDate.toLocaleDateString()}\n`;
}
```

▶ Run tests. Green.

## After

```typescript
function printOwing(invoice: Invoice): string {
  const outstanding = calculateOutstanding(invoice);
  recordDueDate(invoice);
  return bannerText() + printDetails(invoice, outstanding);
}
```

The function now reads at a single level of abstraction; every comment became a name; the hidden side effect is visible in the composition.

## Commit

```
refactor: decompose printOwing into intention-named functions
```

One commit for the whole completed refactoring (the intermediate steps were checkpoints, not commits). No behavior change is mixed in — `recordDueDate`'s query/modifier separation was *noted*, not performed; it would be its own refactoring with its own commit.
