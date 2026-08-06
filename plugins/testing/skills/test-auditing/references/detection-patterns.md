# Detection Patterns & Tooling

Starting points for the mechanical sweep. Every pattern here produces **candidates, not findings** — a `Thread.Sleep` hit may be inside a correct polling helper, and a test with no assertion token may be asserting through a house helper. Counts are reliable enough to rank areas; individual hits are not reportable until seen.

Adjust to the repo. If a codebase wraps its assertions in a custom helper, the generic assertion pattern will report the entire suite as assertion-free, and a report built on that is worse than no report.

**Patterns are given as runnable commands, not as table cells, deliberately** — a regex alternation `|` has to be escaped to `\|` to survive a markdown table, and `\|` in a regex means a *literal pipe*. Copying a pattern out of a table silently matches nothing. Run these as written; `$T` is the test path established below.

## Scoping the Sweep

Find the test tree before sweeping it; running these against production code produces nonsense.

```bash
fd -t d '^(tests?|spec|__tests__|Tests)$'          # common layouts
rg --files -g '*[Tt]est*' -g '*[Ss]pec*' | head -50
```

Set `T` to the resulting path(s) and report the file count — it is the denominator for the sampling statement.

```bash
T=tests            # adjust
rg --files "$T" | wc -l
```

## Signals

Each maps to an entry in the `testing` skill's `references/anti-patterns.md`, which is where the interpretation lives.

### Sleeps and real waiting

```bash
rg -c 'Thread\.Sleep|Task\.Delay' "$T"                    # C#
rg -c 'setTimeout\(|await sleep\(|await delay\(' "$T"     # TS/JS
rg -c 'time\.sleep' "$T"                                  # Python
rg -c 'Thread\.sleep' "$T"                                # Java
rg -c 'time\.Sleep' "$T"                                  # Go
```

`Task.Delay` and `setTimeout` have legitimate uses in async helpers — check the enclosing function before counting a file as flaky.

### Disabled tests

```bash
rg -c '\[Ignore|\(Skip\s*=' "$T"                                    # C#
rg -c '\b(it|test|describe)\.(skip|todo)\b|\bxit\(|\bxdescribe\(' "$T"  # TS/JS
rg -c '@pytest\.mark\.skip|@unittest\.skip|xfail' "$T"              # Python
rg -c '@Disabled|@Ignore' "$T"                                      # Java
rg -c 't\.Skip\(' "$T"                                              # Go
```

**Always report this count.** A disabled test is protection the suite claims and does not provide, and it is invisible in a green CI run. Cross-reference against the risk ranking — a disabled test on a high-risk module is a specific finding regardless of the total.

### Real clock and unseeded randomness

```bash
rg -c 'DateTime\.(Now|UtcNow|Today)|new Random\(\)' "$T"               # C#
rg -c 'new Date\(\)|Date\.now\(\)|Math\.random\(\)' "$T"               # TS/JS
rg -c 'datetime\.(now|utcnow)\(|time\.time\(|random\.' "$T"            # Python
rg -c 'LocalDate(Time)?\.now\(|new Date\(\)|currentTimeMillis' "$T"    # Java
rg -c 'time\.Now\(\)|rand\.' "$T"                                      # Go
```

High counts here are nearly always a **production** finding: the clock is not injected anywhere, so tests have no way to control it.

### Mock density

```bash
rg -c 'Mock<|Substitute\.For<|A\.Fake<|new Mock\(' "$T"            # C#
rg -c 'jest\.mock\(|vi\.mock\(|jest\.fn\(|vi\.fn\(|sinon\.' "$T"   # TS/JS
rg -c 'MagicMock|unittest\.mock|mocker\.|patch\(' "$T"             # Python
rg -c 'Mockito\.|@Mock\b|mock\(' "$T"                              # Java
rg -c 'gomock|mockery' "$T"                                        # Go
```

Useful as a **per-file ratio** against test count, not as a total. Files in the top decile of mocks-per-test are where over-mocking lives, and per the `testing` skill's `references/test-doubles.md` that is usually a statement about production design — too many collaborators, or decision logic tangled with I/O.

### Test declarations and assertions

Needed as denominators, and to find assertion-free tests.

```bash
# Test declarations
rg -c '\[Fact\b|\[Theory\b|\[Test\b|\[TestMethod\b' "$T"                              # C#
rg -c '\b(it|test)\s*\(|\b(it|test)\.(each|only|skip|todo|concurrent)\b' "$T"         # TS/JS
rg -c '^\s*def test_' "$T"                                                            # Python
rg -c '@Test\b' "$T"                                                                  # Java
rg -c '^func Test' "$T"                                                               # Go

# Assertions
rg -c 'Assert\.|\.Should\(\)|Verify\(' "$T"                # C#
rg -c 'expect\(|assert\.' "$T"                             # TS/JS
rg -c '^\s*assert |self\.assert' "$T"                      # Python
rg -c 'assert(That|Equals|True|Null)|verify\(' "$T"        # Java
rg -c 'assert\.|require\.|t\.Error|t\.Fatal' "$T"          # Go
```

Two deliberate choices there, both of which undercount the denominator if you "simplify" them. `\[Fact\b` rather than `\[Fact\]`, because `[Fact(Skip = "…")]` is still a declared test — and `\[Test\b` does not match `[TestMethod]` or `[TestFixture]`, which is why `TestMethod` is listed separately. The `.each|.only|.skip|.todo` alternation catches parameterized and modified declarations that a bare `it(` misses; `describe(` is deliberately excluded, since it groups tests rather than declaring one.

**Assertion-free candidates** — compare the two counts per file (C# shown; swap the patterns per stack):

```bash
for f in $(rg -l '\[Fact\b|\[Theory\b' "$T"); do
  t=$(rg -c '\[Fact\b|\[Theory\b' "$f" || echo 0)
  a=$(rg -c 'Assert\.|\.Should\(\)' "$f" || echo 0)
  [ "$a" -lt "$t" ] && echo "$f  tests=$t asserts=$a"
done
```

A file with fewer assertions than tests has at least one test that asserts nothing. **This is the highest-value cheap signal in the sweep** — it finds the test that cannot fail without reading anything. Verify a couple by hand before reporting; a house assertion helper produces a false positive across the whole suite.

### Weak assertions

```bash
rg -c 'Assert\.NotNull|Assert\.Throws<Exception>|Throw<Exception>' "$T"   # C#
rg -c 'toBeDefined\(\)|toBeTruthy\(\)|not\.toBeNull\(\)' "$T"             # TS/JS
rg -c 'assertIsNotNone|pytest\.raises\(Exception\)' "$T"                  # Python
rg -c 'assertNotNull|assertThrows\(Exception' "$T"                        # Java
```

Broad exception assertions are the sharper finding: `Assert.Throws<Exception>` passes when the *setup* fails, so the test is green for the wrong reason.

### Logic in tests

```bash
rg -c '\bif\s*\(|\bfor\s*\(|\bwhile\s*\(|\btry\s*\{' "$T"   # C-family
rg -c '^\s+(if|for|while|try)\b' "$T"                       # Python
```

Expect false positives from arrange-phase fixture loops, which are legitimate (the `testing` skill's `references/anti-patterns.md`, *Logic in the Test* → "actually correct when"). Rank by density rather than reporting hits.

### Oversized snapshots

```bash
fd -e snap -e approved.txt -e verified.txt . | xargs wc -l | sort -rn | head -20
rg -c 'toMatchSnapshot|MatchSnapshot|Approvals\.' "$T"
```

Snapshots over a few hundred lines are not reviewed, so their updates are reflexive. Report the largest, not the count.

### Structurally untested modules

Compare production directories against the test tree by name. Report directories with substantial code and no test counterpart — crossed with the risk ranking, an untested high-churn module is the top of the map.

## Browser and Component Suites (Cypress, Playwright)

**Detect these before sweeping, and switch patterns if found.** The generic TS/JS patterns above are wrong for a Cypress suite in ways that fail silently — most importantly, idiomatic Cypress contains almost no `expect(`, so the generic assertion pattern reports **zero assertions across the whole suite** and the assertion-free heuristic then flags every file. Criteria for interpreting all of this are in the `testing` skill's `references/ui-testing.md`.

```bash
fd -e cy.ts -e cy.tsx -e cy.js | head; test -f cypress.config.ts && echo "cypress"
fd -e spec.ts -e spec.js -p 'e2e|tests' | head; test -f playwright.config.ts && echo "playwright"
```

**Set `B` to the browser-suite path only** — `cypress/`, `e2e/`, `tests/e2e/`, whatever the detection above turns up. Every pattern in this section runs against `$B`, never `$T`.

```bash
B=cypress          # adjust to what was detected
rg --files "$B" | wc -l
```

The two are not interchangeable, and one signal in particular breaks badly if you conflate them. Cypress inverts the general cleanup rule — it wants state reset in `beforeEach`, because `after` hooks have no guarantee of running when a test refreshes mid-run — while the `testing` skill's `references/test-scope.md` prescribes teardown cleanup for suites generally. Sweeping `afterEach(` across `$T` on a mixed repo therefore counts every ordinary unit test doing the recommended thing as a finding against advice that does not apply to it.

### Assertions — the correction that matters

```bash
rg -c '\.should\(|\.and\(|expect\(' "$T"        # Cypress: .should/.and are the assertion forms
rg -c 'await expect\(|expect\(' "$T"            # Playwright: web-first assertions
```

A Cypress test whose body is only `cy.get(...)` / `.click()` chains still asserts *existence*, because those commands fail when the element never appears. Count such files as **existence-only**, not assertion-free — they are smoke tests, which is a different finding from a vacuous test.

```bash
# Non-retrying Playwright assertions — looks equivalent, waits for nothing
rg -c 'expect\(await ' "$T"
```

### Waiting

```bash
rg -c 'cy\.wait\([0-9]|waitForTimeout\(' "$T"     # bare waits — the anti-pattern
rg -c "cy\.wait\(['\"]@" "$T"                     # aliased waits — the correct form
rg -c 'cy\.clock\(|page\.clock' "$T"              # controlled time — a good sign
```

Report these as a **ratio**. Bare waits are Cypress's own named anti-pattern; aliased waits are its prescribed fix, so the split says whether the suite knows the difference.

### Selector fragility — the best single UI metric

```bash
rg -c "cy\.get\(['\"][.#]|page\.locator\(['\"][.#]" "$T"                 # brittle: CSS class / id
rg -c "cy\.get\(['\"]\[data-|getByTestId\(" "$T"                         # stable: test-id contract
rg -c 'getByRole\(|getByLabel\(|getByText\(|cy\.contains\(' "$T"         # best: user-facing
```

The **brittle-to-stable ratio** predicts how much of the suite goes red on the next redesign, and it is the strongest fragility signal available without reading anything. Both frameworks document the same prescription (`ui-testing.md`), so a high brittle count is a finding against the project's own tooling's advice, not a matter of taste.

### `.only`, and the rest

```bash
rg -c '\b(it|test|describe|context)\.only\b' "$T"      # suite-wide outage; report separately
rg -c 'cy\.intercept\(|cy\.stub\(|cy\.spy\(|page\.route\(' "$T"   # network doubles
rg -c 'cy\.session\(|storageState' "$T"                # cached auth setup — a good sign
rg -c 'afterEach\(|after\(' "$B"                       # cleanup-after, against Cypress's advice
```

**Report `.only` separately from `.skip`, and rank it higher.** A committed `.only` silently reduces a file to one test while CI stays green — it is invisible protection loss, where `.skip` at least reads as a disabled test.

### Slice classification

Do not count a browser suite as one slice. The split changes the shape diagnosis completely:

```bash
rg --files cypress/component 2>/dev/null | wc -l      # component — near-unit cost
rg --files cypress/e2e cypress/integration 2>/dev/null | wc -l   # browser E2E — seconds each
```

`cypress/integration/` is the pre-v10 layout; a repo still using it is likely on an old major version, which is worth noting on its own.

## Risk Inputs from Git

```bash
# Churn, last 12 months
git log --since="12 months ago" --format= --name-only \
  | sed '/^$/d' | sort | uniq -c | sort -rn | head -40

# Defect history — the strongest available signal.
# Matches SUBJECT LINES only; see the warning below.
git log --since="12 months ago" --format='%H %s' \
  | grep -iE '^[0-9a-f]+ (fix|hotfix|revert|bugfix)([(:! ]|$)' \
  | cut -d' ' -f1 \
  | xargs -r -n1 git show --format= --name-only \
  | sed '/^$/d' | sort | uniq -c | sort -rn | head -40

# Branch density as a complexity proxy (adjust tokens per language)
rg -c '\bif\b|\bswitch\b|\bcatch\b|&&' src | sort -t: -k2 -rn | head -40
```

**Do not use `git log --grep` for the defect list.** `--grep` searches the entire commit message, so a feature commit whose body says "ratifies whatever was written, bugs included" is counted as a bug fix — and since defect history is the highest-weighted risk input, one chatty commit body can put the wrong module at the top of the map. Match subject lines, as above. This was an actual defect in an earlier draft of this file, caught by running it against this repo.

**Check the history is usable first.** A repo that squash-merges every PR into one commit, or that was recently migrated, has churn data meaning something different — compare `git log --oneline | wc -l` against the repo's age. Say so rather than ranking on noise.

**Adapt the subject pattern to the repo's convention.** The one above assumes conventional commits. A repo that writes "Fixed the null ref in checkout" or tags commits with issue keys needs a different filter — read fifty subject lines before trusting any of them, and say in the report which convention you matched and roughly what share of commits it classified.

Filter both lists to files that still exist; deleted paths otherwise dominate the counts.

## Coverage Tooling

Run only what the repo already has configured. Never install tooling mid-audit; if none exists, report "not measured" and offer setup as a follow-up.

| Stack | Tool | Typical invocation | Output |
|---|---|---|---|
| .NET | coverlet | `dotnet test --collect:"XPlat Code Coverage"` | Cobertura XML under `TestResults/` |
| JS/TS | Jest / Vitest / c8 | `--coverage` | `coverage/lcov.info`, `coverage-summary.json` |
| Python | coverage.py | `pytest --cov=<pkg> --cov-report=xml` | `coverage.xml`, `.coverage` |
| Java | JaCoCo | `mvn test jacoco:report` | `target/site/jacoco/jacoco.xml` |
| Go | built in | `go test ./... -coverprofile=cover.out` | `cover.out` |

Check for an existing report before running anything — CI often leaves one, and reading it costs nothing.

Read coverage **per module**, never as a repo total. Per the `testing` skill's `references/test-design.md`, the total is dominated by legacy code and tells you nothing about today's risk. Branch coverage beats line coverage where the tool reports it.

## Mutation Tooling

The only measure that answers *would these tests notice a defect*. Full-repo runs are prohibitively slow — **scope to the single top-ranked module and run only on explicit user approval.**

| Stack | Tool | Scoped invocation |
|---|---|---|
| .NET | Stryker.NET | `dotnet stryker --mutate "src/Module/**/*.cs"` |
| JS/TS | StrykerJS | `npx stryker run --mutate "src/module/**/*.ts"` |
| Python | mutmut | `mutmut run --paths-to-mutate src/module` |
| Java | PIT | `mvn org.pitest:pitest-maven:mutationCoverage -DtargetClasses=com.x.module.*` |
| Go | go-mutesting | `go-mutesting ./module/...` — less mature; say so if used |

Report the surviving-mutant count and what the survivors mean. A surviving mutant is a defect the suite would not catch — a far stronger statement than any coverage percentage, so quote the specific mutations that survived.

Give a time estimate before starting, and prefer a single class or file over a module when the module is large.
