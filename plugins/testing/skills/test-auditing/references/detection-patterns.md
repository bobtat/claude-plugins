# Detection Patterns & Tooling

Starting points for the mechanical sweep. Every pattern here produces **candidates, not findings** — a `Thread.Sleep` hit may be inside a correct polling helper, and a test with no assertion token may be asserting through a house helper. Counts are reliable enough to rank areas; individual hits are not reportable until seen.

Adjust to the repo. If a codebase wraps its assertions in a custom helper, the generic assertion pattern will report the entire suite as assertion-free, and a report built on that is worse than no report.

**Patterns are given as runnable commands, not as table cells, deliberately** — a regex alternation `|` has to be escaped to `\|` to survive a markdown table, and `\|` in a regex means a *literal pipe*. Copying a pattern out of a table silently matches nothing. Run these as written; `$T` is the test path established below.

## Scoping the Sweep

Find the test tree before sweeping it; running these against production code produces nonsense.

```bash
rg --files | rg -o '^.*/(tests?|spec|__tests__|Tests)/' | sort -u | head -20   # common layouts
rg --files -g '*[Tt]est*' -g '*[Ss]pec*' | head -50
```

Set `T` to the resulting path(s) and report the file count — it is the denominator for the sampling statement.

```bash
T=tests            # adjust — the test tree
P=src              # adjust — the production tree, used by the complexity proxy
B=cypress          # adjust — the browser-suite tree, if one exists (see below)
rg --files "$T" | wc -l
```

**All three are variables for a reason.** An earlier draft hardcoded `src` in the complexity proxy; on a repo with no `src/` directory ripgrep exits 2, the pipeline yields nothing, and the complexity dimension drops silently out of the risk model — the ranking still prints, just without one of its inputs.

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
rg -c '\[Ignore|\(Skip\s*=' "$T"                                              # C#
rg -c '\b(it|test|describe)(\.\w+)*\.(skip|todo|failing)\b|\bxit\(|\bxdescribe\(' "$T"  # TS/JS
rg -c '@pytest\.mark\.(skip|xfail)|@unittest\.skip|\bpytest\.skip\(' "$T"     # Python
rg -c '@Disabled|@Ignore|\bassum(eTrue|eFalse|ingThat)\(' "$T"                # Java
rg -c 't\.Skip(f|Now)?\(' "$T"                                                # Go
rg -c '\b(it|test|describe|context)\.only\b' "$T"                             # TS/JS — see below
```

Four of these are wider than they look, and each was narrowed by an actual miss:

- The TS/JS `(\.\w+)*` is what catches `test.concurrent.skip(…)`. Without it that reads as an *active* test to the declaration pattern below and as no skip at all here — a suite looking healthier in both directions at once.
- Python's in-body `pytest.skip("…")` is a very common silent no-op and is not a marker.
- Java's `assumeTrue`/`assumingThat` are JUnit's silent-skip mechanism; a failed assumption aborts the test and reports green.
- Go's `t.Skipf` and `t.SkipNow()` are as common as `t.Skip`.

**`.only` belongs here even though it is not a skip**, and it is listed against `$T` rather than only in the browser section. It is the inverse defect — it disables every *other* test in its file while CI stays green — and it is not Cypress-specific: Jest, Vitest, and Mocha all have it. A repo with no browser suite never reaches the browser section, so this is the only place it gets swept.

**Always report this count.** A disabled test is protection the suite claims and does not provide, and it is invisible in a green CI run. Cross-reference against the risk ranking — a disabled test on a high-risk module is a specific finding regardless of the total.

### Real clock and unseeded randomness

```bash
rg -c 'DateTime(Offset)?\.(Now|UtcNow|Today)|new Random\(\)|Random\.Shared' "$T"       # C#
rg -c 'new Date\(\)|Date\.now\(\)|Math\.random\(\)' "$T"                              # TS/JS
rg -c 'datetime\.(now|utcnow)\(|time\.time\(|random\.' "$T"                           # Python
rg -c '(Instant|LocalDate|LocalDateTime|LocalTime|ZonedDateTime)\.now\(|new Date\(\)|currentTimeMillis' "$T"   # Java
rg -c 'time\.Now\(\)|rand\.' "$T"                                                     # Go
```

`DateTimeOffset` and `Instant` are not optional additions. `DateTimeOffset.UtcNow` is the form the `testing:testing` skill's `references/test-doubles.md` explicitly recommends, and `Instant.now()` is the dominant modern Java clock call — a sweep omitting them is blind to exactly the APIs this plugin's own guidance pushes people toward.

High counts here are nearly always a **production** finding: the clock is not injected anywhere, so tests have no way to control it.

### Mock density

```bash
rg -c 'Mock<|Mock\.Of<|Substitute\.For<|A\.Fake<|new Mock\(' "$T"          # C#
rg -c 'jest\.mock\(|vi\.mock\(|jest\.fn\(|vi\.fn\(|sinon\.' "$T"           # TS/JS
rg -c 'MagicMock|unittest\.mock|mocker\.|patch\(' "$T"                     # Python
rg -c 'Mockito\.|@Mock\w*|@InjectMocks|@Spy\b|mock\(' "$T"                 # Java
rg -c 'gomock|mockery|testify/mock|mock\.Mock\b|\.AssertExpectations\(' "$T"  # Go
```

`@Mock\w*` rather than `@Mock\b` because `\b` fails on `@MockBean`, the Spring standard. `@InjectMocks` is the strongest single over-mocking signal in Java and was absent entirely. `testify/mock` is the most widely used Go mocking package and `gomock|mockery` misses it.

Useful as a **per-file ratio** against test count, not as a total. Files in the top decile of mocks-per-test are where over-mocking lives, and per the `testing` skill's `references/test-doubles.md` that is usually a statement about production design — too many collaborators, or decision logic tangled with I/O.

### Test declarations and assertions

Needed as denominators, and to find assertion-free tests.

```bash
# Test declarations
rg -c '\[Fact\b|\[Theory\b|\[Test(Case|Method)?\b|\[DataTestMethod\b|\[DataRow\b|\[InlineData\b' "$T"   # C#
rg -c '\b(it|test)\s*\(|\b(it|test)(\.\w+)*\.(each|only|skip|todo|concurrent|failing)\b' "$T"          # TS/JS
rg -c '^\s*(async )?def test_' "$T"                                                                    # Python
rg -c '@(Test|ParameterizedTest|RepeatedTest|TestFactory|TestTemplate)\b' "$T"                         # Java
rg -c '^func Test[^a-z]|^func \(\w+ \*?\w+\) Test[^a-z]' "$T"                                          # Go

# Assertions
rg -c 'Assert\.|\.Should\(\)|Verify\(' "$T"                # C#
rg -c 'expect\(|assert\.' "$T"                             # TS/JS
rg -c '^\s*assert |self\.assert' "$T"                      # Python
rg -c '\bassert[A-Z]\w*\(|\bverify\(' "$T"                 # Java
rg -c 'assert\.|require\.|t\.Error|t\.Fatal' "$T"          # Go
```

Every widening above closes a **verified** miss, and each one zeroes or badly deflates a denominator on a real suite:

| Stack | Was missed | Consequence |
|---|---|---|
| C# | `[TestCase(…)]`, `[DataTestMethod]`, `[DataRow]` | A purely `[TestCase]`-driven NUnit file counts **zero** tests, so `asserts < tests` is `a < 0` and it can never be flagged whatever it contains |
| Python | `async def test_` | Zeroes the denominator on an async-first repo (pytest-asyncio, anyio) |
| Java | `@ParameterizedTest`, `@RepeatedTest` | JUnit 5 parameterized tests entirely invisible |
| Go | testify suite methods; `^func Test` also **matched `func Testify()`** | Both a miss and a false positive |
| Java asserts | `assertNotNull`, `assertFalse`, `assertThrows`, `assertArrayEquals`, … | The old alternation required `That`/`Equals`/`True`/`Null` immediately after `assert`. It also made a JUnit4 file full of `assertNotNull` read as assertion-free *and* weakly-asserted simultaneously |

`\[Fact\b` rather than `\[Fact\]` is still deliberate — `[Fact(Skip = "…")]` is a declared test. `\[Test(Case|Method)?\b` still correctly excludes `[TestFixture]`. `describe(` remains excluded, since it groups tests rather than declaring one.

**A `[Theory]` with six `[InlineData]` rows is one declaration line but six executed tests.** Counting either way is defensible; counting lines is what these patterns do, so do not present the denominator as a test count.

**Assertion-free candidates** — compare the two counts per file (C# shown; swap the patterns per stack):

```bash
rg -l --null '\[Fact\b|\[Theory\b' "$T" | while IFS= read -r -d '' f; do
  t=$(rg -c '\[Fact\b|\[Theory\b' "$f" 2>/dev/null || echo 0)
  a=$(rg -c 'Assert\.|\.Should\(\)' "$f" 2>/dev/null || echo 0)
  [ "$a" -lt "$t" ] && echo "$f  tests=$t asserts=$a"
done
```

`--null` with `read -r -d ''` rather than `for f in $(rg -l …)`, because the unquoted command substitution **word-splits on whitespace**. A path like `my tests/A.cs` becomes two arguments, `rg` exits 2 on both, `|| echo 0` yields `t=0 a=0`, and the file is silently skipped — a directory with a space in its name simply vanishes from the sweep.

**Know what this signal can and cannot see.** `rg -c` counts *matching lines*, not matches, so one test with two assertion lines masks a sibling test with none:

```csharp
[Fact] public void One()   { Assert.Equal(1,1);
                             Assert.Equal(2,2); }   // 2 assertion lines
[Fact] public void Two()   { Assert.True(true); }
[Fact] public void Three() { var x = Do(); }        // asserts nothing
```

Three tests, three assertion lines, `a < t` is false — **not flagged.** The one-directional claim holds (fewer assertion lines than tests does mean at least one test asserts nothing), but the converse does not, so this finds only the subset of vacuous tests living in files where no other test asserts twice. It is a cheap, high-precision, **low-recall** signal: trust a hit, never read a miss as a clean file. For real recall, per-test-block counting (`rg -A 15 '\[Fact'`, checking each block) or mutation testing is the answer.

Verify a couple of hits by hand before reporting; a house assertion helper produces a false positive across the whole suite.

### Weak assertions

```bash
rg -c 'Assert\.NotNull|Assert\.Throws<Exception>|Throw<Exception>' "$T"   # C#
rg -c 'toBeDefined\(\)|toBeTruthy\(\)|not\.toBeNull\(\)' "$T"             # TS/JS
rg -c 'assertIsNotNone|pytest\.raises\(Exception\)' "$T"                  # Python
rg -c 'assertNotNull|assertThrows\(Exception' "$T"                        # Java
rg -c 'assert\.(NotNil|Error|NotEmpty)\(|require\.(NotNil|Error)\(' "$T"  # Go
```

Broad exception assertions are the sharper finding, but **be precise about the mechanism, because it is framework-dependent and a reviewer told the wrong version will file false findings against correct tests.**

The hazard is a *subtype-matching* assertion swallowing an unrelated failure — most often a setup failure raised inside the asserted block. That is `pytest.raises(Exception)`, JUnit's `assertThrows(Exception.class, …)`, and Jest's bare `.toThrow()`.

**It is not xUnit's `Assert.Throws<T>`, which matches the exact type** and fails on a derived exception; NUnit's `Assert.Throws<T>` and MSTest's `Assert.ThrowsException<T>` are exact too. The C# forms that actually carry the hazard are `Assert.ThrowsAny<Exception>` (xUnit) and `Assert.Catch<Exception>` (NUnit). Keep the `Assert.Throws<Exception>` grep — a test asserting on a bare `throw new Exception()` is still worth seeing — but report it as an over-broad assertion, not as one that passes when setup fails.

### Logic in tests

```bash
rg -c '\bif\s*\(|\bfor(each)?\s*\(|\bwhile\s*\(|\bswitch\s*\(|\btry\b' "$T"   # C-family
rg -c '^\s+(if|for|while|try)\b' "$T"                                        # Python
```

Two corrections worth keeping: `\bfor\s*\(` does **not** match `foreach (` — `\bfor` matches, then `each` defeats `\s*\(` — and `foreach` is *the* C# loop form. And `\btry\s*\{` misses Allman-style `try` with the brace on the next line, which is the C# house style; ripgrep is line-oriented, so the brace cannot be relied on.

Expect false positives from arrange-phase fixture loops, which are legitimate (the `testing` skill's `references/anti-patterns.md`, *Logic in the Test* → "actually correct when"). Rank by density rather than reporting hits.

### Oversized snapshots

```bash
rg --files -g '*.snap' -g '*.approved.txt' -g '*.verified.txt' --null \
  | xargs -0 -r wc -l | grep -v ' total$' | sort -rn | head -20
rg -c 'toMatchSnapshot|MatchSnapshot|Approvals\.' "$T"
```

Snapshots over a few hundred lines are not reviewed, so their updates are reflexive. Report the largest, not the count.

Three shell details there, each of which corrupts the output silently: `-r` so a repo with no snapshots does not run `wc -l` argument-less and emit a spurious `0` that flows into the report as "largest snapshot"; `grep -v ' total$'` because `wc -l` over many files appends a total that sorts straight to the top of `head -20`; and `--null`/`-0` so paths with spaces survive.

### Structurally untested modules

Compare production directories against the test tree by name. Report directories with substantial code and no test counterpart — crossed with the risk ranking, an untested high-churn module is the top of the map.

## Browser and Component Suites (Cypress, Playwright)

**This detection gate is load-bearing: if it misses, the generic TS/JS patterns run against a browser suite and produce the zero-assertion catastrophe described below — a silent failure guarding against a silent failure.** So it globs config by extension rather than testing for `cypress.config.ts` alone: `.js`, `.mjs`, `.cjs`, and pre-v10 `cypress.json` are all live in the wild, and monorepos put none of them at the root. Playwright's default glob includes `*.test.ts` as well as `*.spec.ts`. When in doubt, check `package.json` scripts for `cypress run` / `playwright test`.

**Detect these before sweeping, and switch patterns if found.** The generic TS/JS patterns above are wrong for a Cypress suite in ways that fail silently — most importantly, idiomatic Cypress contains almost no `expect(`, so the generic assertion pattern reports **zero assertions across the whole suite** and the assertion-free heuristic then flags every file. Criteria for interpreting all of this are in the `testing` skill's `references/ui-testing.md`.

```bash
rg --files -g '*.cy.*' | head; rg --files -g 'cypress.config.*' -g 'cypress.json' | head
rg --files -g '*.spec.*' -g '*.test.*' -g '**/e2e/**' | head; rg --files -g 'playwright.config.*' | head
```

**Set `B` (declared in *Scoping the Sweep* above) to the browser-suite path only** — `cypress/`, `e2e/`, `tests/e2e/`, whatever the detection above turned up, and confirm it before sweeping:

```bash
rg --files "$B" | wc -l
```

**Every pattern in this section runs against `$B`, never `$T`** — and that is a claim to verify rather than trust, because an earlier draft of this file asserted exactly this sentence while twelve of its thirteen commands still used `$T`. Executed against a repo with a unit tree and a fully brittle Cypress suite containing a committed `.only`, that draft reported **zero** brittle selectors and **zero** `.only`. Nothing about the output looked wrong.

The two are not interchangeable, and one signal in particular breaks badly if you conflate them. Cypress inverts the general cleanup rule — it wants state reset in `beforeEach`, because `after` hooks have no guarantee of running when a test refreshes mid-run — while the `testing` skill's `references/test-scope.md` prescribes teardown cleanup for suites generally. Sweeping `afterEach(` across `$T` on a mixed repo therefore counts every ordinary unit test doing the recommended thing as a finding against advice that does not apply to it.

### Assertions — the correction that matters

```bash
rg -c '\.should\(|\.and\(|expect\(' "$B"        # Cypress: .should/.and are the assertion forms
rg -c 'await expect\(|expect\(' "$B"            # Playwright: web-first assertions
```

A Cypress test whose body is only `cy.get(...)` / `.click()` chains still asserts *existence*, because those commands fail when the element never appears. Count such files as **existence-only**, not assertion-free — they are smoke tests, which is a different finding from a vacuous test.

```bash
# Non-retrying Playwright assertions — looks equivalent, waits for nothing
rg -c 'expect\(await ' "$B"
```

### Waiting

```bash
rg -c 'cy\.wait\([0-9]|waitForTimeout\(' "$B"     # bare waits — the anti-pattern
rg -c "cy\.wait\(['\"]@" "$B"                     # aliased waits — the correct form
rg -c 'cy\.clock\(|page\.clock' "$B"              # controlled time — a good sign
```

Report these as a **ratio**. Bare waits are Cypress's own named anti-pattern; aliased waits are its prescribed fix, so the split says whether the suite knows the difference.

### Selector fragility — the best single UI metric

```bash
rg -c "cy\.get\(['\"][^'\"]*[.#>]|page\.locator\(['\"][^'\"]*[.#>]|nth-child|xpath|//\*?\[@" "$B"   # brittle: CSS / XPath
rg -c "cy\.get\(['\"]\[data-|getByTestId\(|data-testid" "$B"                                       # stable: test-id contract
rg -c 'getByRole\(|getByLabel(Text)?\(|getByPlaceholder(Text)?\(|getByText\(|cy\.contains\(|(find|query)By\w+\(' "$B"   # best: user-facing
```

Two widenings, both from verified misses. The brittle pattern previously required the `.` or `#` to be the **first** character, so `page.locator('button.primary')` and `cy.get('div > span')` — ordinary brittle selectors — did not count; XPath was not covered at all. And `getByLabel\(` matches Playwright's spelling but **not Testing Library's `getByLabelText(`**, so React Testing Library component suites scored zero user-facing queries despite `ui-testing.md` naming Testing Library in scope.

The **brittle-to-stable ratio** predicts how much of the suite goes red on the next redesign, and it is the strongest fragility signal available without reading anything. Since the whole metric is a ratio, a narrow numerator or denominator distorts it directly — which is why both sides were widened together.

**No published threshold backs this**, so report the ratio and the two raw counts rather than a verdict. As a rough convention, a brittle share above about a third is worth naming as a finding and above two-thirds is the dominant fragility story of the suite; both numbers are judgement, not measurement, and should be presented that way. Both frameworks document the same prescription (`ui-testing.md`), so a high brittle count is a finding against the project's own tooling's advice, not a matter of taste.

### `.only`, and the rest

```bash
rg -c '\b(it|test|describe|context)\.only\b' "$B"      # suite-wide outage; report separately
rg -c 'cy\.intercept\(|cy\.stub\(|cy\.spy\(|page\.route\(' "$B"   # network doubles
rg -c 'cy\.session\(|storageState' "$B"                # cached auth setup — a good sign
rg -c 'afterEach\(|after\(' "$B"                       # cleanup-after, against Cypress's advice
```

**Report `.only` separately from `.skip`, and rank it higher.** A committed `.only` silently reduces a file to one test while CI stays green — it is invisible protection loss, where `.skip` at least reads as a disabled test.

### Slice classification

Do not count a browser suite as one slice. The split changes the shape diagnosis completely:

```bash
rg --files "$B"/component 2>/dev/null | wc -l      # component — near-unit cost
rg --files "$B"/e2e "$B"/integration 2>/dev/null | wc -l   # browser E2E — seconds each
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
  | grep -iE '^[0-9a-f]+ (fix|hotfix|revert|bugfix|bug)([(:! ]|$)' \
  | cut -d' ' -f1 \
  | xargs -r -n1 git show --format= --name-only \
  | sed '/^$/d' | sort | uniq -c | sort -rn | head -40

# Branch density as a complexity proxy (adjust tokens per language)
rg -c '\bif\b|\bswitch\b|\bcase\b|\bcatch\b|&&|\|\|' "$P" | sort -t: -k2 -rn | head -40
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
