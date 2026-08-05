---
description: Audit tests for quality — behavior vs implementation coupling, mock overuse, missing cases, flakiness, and tests that cannot fail
argument-hint: [path or glob | --diff] (defaults to tests changed on this branch)
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*), Bash(git merge-base:*), Bash(git branch:*), Read, Grep, Glob
---

## Context

- Current branch: !`git branch --show-current`
- Default branch: !`git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || echo "origin/HEAD not set"`
- Changed files vs. default branch: !`git diff --name-only "$(git merge-base HEAD "$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/main)" 2>/dev/null || echo HEAD)" 2>/dev/null || git diff --name-only HEAD`
- Uncommitted changes: !`git status --porcelain`

**State which base you compared against** in your report. If the default branch could not be determined and the diff fell back to uncommitted changes only, say so explicitly — a review that silently examined three files when the branch changed thirty is worse than no review.

## Task

Audit test quality. **Load the `testing` skill first** and use its references as the criteria for this review — `references/anti-patterns.md` for the catalog, `references/test-doubles.md` for double misuse, `references/test-design.md` for naming/assertion/case-selection standards, and `references/test-scope.md` for slice mismatches. When the tests drive a browser or mount components, also load `references/ui-testing.md`; several checks below read differently against a retrying API.

### Step 1 — Determine scope

Interpret `$ARGUMENTS`:

- **A path or glob** → review those test files.
- **`--diff`, or empty** → review test files changed on this branch (see Context above). If nothing is changed, ask whether to review the whole suite or a specific area rather than guessing — a whole-suite audit on a large repo is a different job and should be an explicit choice.

Also read the **production code under test**. Most test defects are only visible against the code they exercise, and several — over-mocking, wrong scope, testing implementation — are ultimately statements about the production design.

### Step 2 — Check each test against these questions

For every test in scope:

1. **Could it fail?** Look for tests with no meaningful assertion, assertions inside branches that never execute, loops over possibly-empty collections, `assertNotNull` on always-non-null values, over-broad exception assertions, and doubles so lenient the code path never runs. **This is the highest-value check** — report these first, since they cost maintenance and provide nothing.

   **You cannot fully settle this by reading.** This command has no permission to run tests, and whether a mock is lenient enough to skip the code path or an exception assertion is swallowing a setup failure is often only decidable by executing it. So treat these as **candidates**: report each with the reasoning that makes it suspect, label it `unverified — requires running`, and say what running it would show. Do not state that a test cannot fail as established fact unless the defect is unambiguous on the page (a test body with no assertion at all, an assertion on a literal, an empty test). Offer to re-run the review with test execution if the user wants these confirmed.
2. **Does the name state the behavior?** A name that doesn't identify what broke is a defect, because it's read at failure time.
3. **Is it coupled to implementation?** Assertions on private state, internal call counts, call ordering, or exact log/exception message strings. Would a pure refactoring turn it red?
4. **Are the doubles justified?** Count them. Are any doubling something that isn't a real boundary (value objects, owned domain collaborators, the subject itself)? Is setup longer than the assertion? Are query calls being `verify`'d?
5. **Is the assertion complete?** Field-by-field checks that would miss a new or wrong field; `valid: false` without asserting *why*; collection length without contents.
6. **Is there logic in the test?** `if`/loop/`try` in act or assert; expected values computed with the production formula.
7. **Is it deterministic?** Real clock, `sleep`, unseeded randomness, unawaited async work, network access, shared mutable state, order dependence.
8. **Is the scope right?** Mocked database asserting SQL; business arithmetic verified through HTTP; a rule tested end-to-end that a unit test would catch.
9. **Are cases missing?** Against the production code: untested guard clauses and error branches, and missing boundaries (empty, zero, one, at-limit, over-limit, absent). Name the specific untested behavior, not "needs more coverage."
10. **For browser and component tests only** — the defect classes that dominate UI suites, per `references/ui-testing.md`:
    - **Selector coupling.** `cy.get('.btn-primary')`, XPath, `nth-child` — these break on any restyle. Role/label queries or `data-*` test ids don't. Both Cypress and Playwright document this as an anti-pattern, so it's a finding against the project's own tooling's advice.
    - **Bare waits.** `cy.wait(500)`, `page.waitForTimeout(...)` instead of an aliased route, an event, or a retrying assertion.
    - **Non-retrying assertions.** `expect(await locator.isVisible()).toBe(true)` looks equivalent to `await expect(locator).toBeVisible()` and waits for nothing — a common flake source.
    - **Committed `.only`.** Silently reduces a file to one test while CI stays green. Report it above `.skip`.
    - **Scope.** A business rule verified through the browser that a unit or component test would catch, or five acceptance scenarios turned into five E2E tests where one outer test plus fast tests underneath would do.

    **Do not report a Cypress test as assertion-free because it has no `expect(`.** `.should()` and `.and()` are the assertion forms, and a bare `cy.get(...)` chain still asserts existence — that makes it an existence-only smoke test, which is a different and much weaker finding than a test that asserts nothing.

### Step 3 — Verify before reporting

Do not report a finding you haven't grounded in the code. For each candidate:

- Quote the specific line(s) and say concretely what defect would slip through, or what change would break the test spuriously.
- Discard anything you can't state that way. A test that merely looks unusual is not a finding.
- Check the "actually correct when" section in `references/anti-patterns.md` before reporting — several anti-patterns have legitimate forms (a deliberate exactly-once assertion at a boundary, approval tests over reviewed output, shared immutable setup, a sociable unit test using real collaborators). Don't flag those.

### Step 4 — Report

Group findings by severity, most severe first:

- **Ineffective** — tests that cannot fail, or verify something other than what their name claims. These are worse than no test.
- **Fragile** — tests that will break on refactoring without behavior changing, and flaky/nondeterministic tests.
- **Gaps** — specific untested behaviors and boundaries, each named.
- **Maintainability** — naming, duplication, missing builders, wrong scope, weak assertions.

**Cap the report at roughly ten findings**, ranked by severity. If there are more, say how many you omitted and what categories they fell into — an undifferentiated wall of forty items gets no action, and the top ten are what determine whether the suite is trustworthy. Prefer one well-evidenced finding over three speculative ones.

For each finding give: file and line, the problem in one sentence, the concrete failure scenario or spurious-break scenario, the fix, and whether it is **confirmed** (unambiguous on the page) or **unverified** (requires running the test). Where the root cause is production design (over-mocking, untestable code, hidden clock/IO), say so explicitly and name the production change — fixing the test alone would just relocate the problem.

End with a short verdict: whether this suite would actually catch a regression in the code it covers, and the two or three changes with the most leverage. Be specific and factual — if the tests are sound, say that plainly rather than manufacturing findings.

Do not modify any files unless the user asks you to apply the fixes.
