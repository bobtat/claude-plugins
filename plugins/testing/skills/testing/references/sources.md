# Sources

What the guidance in this skill rests on, and where each idea comes from. Listed so a reader can check a claim rather than take it on authority — and so the boundary between sourced material and this plugin's own synthesis is visible.

## Primary Sources

**Kent Beck — [Test Desiderata](https://testdesiderata.com/)** (also as a video series)
Twelve properties we want from tests: isolated, composable, deterministic, fast, writable, readable, behavioral, structure-insensitive, automated, specific, predictive, inspiring. The two that `SKILL.md` opens with are *behavioral* and *structure-insensitive*. *Specific* ("if a test fails, the cause of the failure should be obvious") grounds the naming rules and the assertion-roulette entry; *isolated* and *deterministic* ground the flakiness material.

**Martin Fowler — [Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html)**
The five-double taxonomy as Fowler renders Meszaros' version of it, and the state-verification / behavior-verification distinction. Source of the quoted definitions in `test-doubles.md`, of "only mocks insist upon behavior verification," and of the classical/mockist framing — including the fact that limiting mocks to boundaries is the *classical* position rather than a universal one. Also the source for the coupling cost: "Mockist tests are thus more coupled to the implementation of a method."

**Martin Fowler — [UnitTest](https://martinfowler.com/bliki/UnitTest.html)**
"The team decides what makes sense to be a unit." Solitary vs. sociable unit tests, with the terms credited to Jay Fields. Also the point that doubling external resources is not an absolute rule.

**Martin Fowler — [TestPyramid](https://martinfowler.com/bliki/TestPyramid.html)**
Attributes the pyramid to Mike Cohn's *Succeeding with Agile* (2009). Source of the brittleness argument against UI-level tests, the caveat that end-to-end / UI / customer-facing are orthogonal characteristics, and the footnote that fast, reliable, cheap high-level tests reduce the need for lower-level ones.

**Martin Fowler — [TestCoverage](https://martinfowler.com/bliki/TestCoverage.html)**
Coverage as diagnostic, not target. "If you make a certain level of coverage a target, people will try to attain it" is **Fowler's own sentence**, not a quotation — an earlier draft of this plugin misattributed it to Brian Marick. The two lines the page does attribute to Marick are "I expect a high level of coverage. Sometimes managers require one. There's a subtle difference," and "If a part of your test suite is weak in a way that coverage can detect, it's likely also weak in a way coverage can't detect." Also Fowler's expectation of upper-80s/90s from thoughtful testing, with suspicion of 100%.

**Martin Fowler — [Eradicating Non-Determinism in Tests](https://martinfowler.com/articles/nonDeterminism.html)**
The five causes of flakiness (isolation, asynchrony, remote services, time, resource leaks), immediate quarantine, "Always wrap the system clock," "Never use bare sleeps... use a callback or polling," and the pool-size-1 trick for exposing resource leaks.

**Dan North — [Introducing BDD](https://dannorth.net/blog/introducing-bdd/)**
The `agiledox` origin of behavior-style test naming, tests as documentation, and *should* as a design probe rather than a naming convention — if the "this class should…" sentence won't fit one responsibility, the behavior belongs elsewhere. Also the Given/When/Then formulation quoted in `bdd.md` ("Given some initial context (the givens), When an event occurs, Then ensure some outcomes"), the "As a [X] I want [Y] so that [Z]" story template, the ubiquitous-language argument, and the JBehave lineage of today's Gherkin runners.

Two positions in `bdd.md` are **not** North's and should not be read as his: the recommendation to default to *no* Gherkin tooling unless genuinely non-technical readers exist, and the rule that most scenarios belong as unit tests rather than as end-to-end tests. North's article is broadly enthusiastic about executable specifications; those two are this plugin's judgment about cost, informed by the pyramid material in `test-scope.md`.

**Related work named but not fetched:** Gojko Adzic's *Specification by Example* and Matt Wynne's Example Mapping are the natural next reading for deriving scenarios collaboratively. They are referenced nowhere in the plugin's prescriptions because they were not consulted — noted here so the gap is visible rather than implied.

**Microsoft — [Best practices for writing unit tests](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices)** (John Reese, with Roy Osherove)
Written for .NET, but almost all of it is language-agnostic. Source of: naming as method + scenario + expected behavior; *minimally passing tests* (simplest input that verifies the behavior); *avoid magic strings* (name significant literals as constants); *use helper methods instead of Setup and Teardown*, with the three reasons quoted in `test-design.md`; validating private methods through public ones; and the seam-for-`DateTime.Now` example. Also the source for the **umbrella naming convention** documented under "Vocabulary Collisions" in `test-doubles.md` — fake as the generic term, mock as "a fake you assert against" — which conflicts with the Meszaros/Fowler taxonomy this skill otherwise uses. The article itself now notes that divergence.

Two of its prescriptions are adopted with a stated distinction rather than wholesale, because taken literally they conflict with other guidance here: *minimally passing* applies to incidental values but not to the value the behavior turns on, and *avoid magic strings* means naming **significant** literals while incidental data still belongs in a builder default.

**Kent C. Dodds — [Write tests. Not too many. Mostly integration.](https://kentcdodds.com/blog/write-tests)**
The testing trophy: static analysis, unit, integration, end-to-end, with the weight on integration because it "strike[s] a great balance on the trade-offs between confidence and speed/expense." Note the static-analysis base layer — the trophy is four layers, not a re-proportioned three.

**Michael Feathers — *Getting Empirical about Refactoring*** ([StickyMinds](https://www.stickyminds.com/article/getting-empirical-about-refactoring))
The churn-vs-complexity view: read version-control history to find refactoring candidates, with the **high-churn × high-complexity** quadrant as the one that matters — code that changes constantly *and* is hard to understand, where conditionals get hacked into conditionals. The risk model in `test-auditing` is this crossed with test protection.

**The primary URL returned HTTP 403 from this environment.** The quadrant semantics above are taken from search-surfaced excerpts of the article and from secondary accounts of Feathers' talks on the same material, not from the article itself. Treat the paraphrase as second-hand, and note this is a different work from *Working Effectively with Legacy Code* cited below.

**Ernesto Tagwerker — [Churn vs. Complexity vs. Code Coverage](https://www.fastruby.io/blog/code-quality/churn-vs-complexity-vs-coverage.html)**
Adds test coverage as a third dimension to Feathers' two, and frames it as precisely the question `/test-audit` exists to answer: "Should I refactor this module? Should I increase test coverage before I refactor this module?" The high-churn / high-complexity / **low-coverage** combination is the top-risk cell — "refactoring modules that lack proper tests can quickly turn into a nightmare." Implemented as the Ruby tool Skunk (RubyCritic + SimpleCov). Only the three-dimensional framing is used here; the tool is not.

**Andre Hora & Romain Robbes — [Are Coding Agents Generating Over-Mocked Tests? An Empirical Study](https://arxiv.org/abs/2602.00409)** (MSR '26, arXiv:2602.00409, January 2026)
1,254,878 commits from 2025 across 2,168 TypeScript/JavaScript/Python repositories; 48,563 commits authored or co-authored by Claude Code, Copilot, or Cursor. Their closing recommendation — put mocking guidance in agent configuration files — is the empirical case for this plugin existing.

Findings used here, stated with the precision the paper does:

- Agent test commits add mocks at 36% vs. 26% for non-agents. The commit-level analysis reports χ² = 505.5, p < 0.001 and **no effect size**. Effect sizes come from the repository-level comparison: *small* (Cliff's delta 0.252) in high-agent-activity repositories (36% vs. 28%), and **negligible** (Cliff's delta 0.002) in the 282 lower-activity ones, which the paper calls "statistically significant, but not meaningful."
- Double-type adoption, as the share of the 496 repositories with agent mock activity containing at least one agent commit using each type (agents vs. non-agents): mock 95%/91%, fake 32%/57%, spy 33%/51%, dummy 19%/40%, stub 14%/30%. **These are repository ratios, not proportions of doubles written** — Figure 5's axis is "Repositories ratio," and the values do not sum to 100%.

Earlier drafts of this plugin got both of these wrong: they attached the 0.252 effect size to the commit-level statistic and omitted the negligible result, and they misread stub's non-agent figure as 51% (which is spy's), producing the false claim that agents specifically neglect the two state-verifying doubles. The largest gap is fake (25 points); dummy (21) and spy (18) follow, and spy verifies interactions while dummy verifies nothing. The supportable claim is only that agents use a narrower range of double types and most under-use the fake.

## Books (cited from, not fetched)

These are the origin of much of the vocabulary. They are not freely available online, and the specific quoted definitions below were verified through the secondary sources noted.

**Gerard Meszaros — *xUnit Test Patterns: Refactoring Test Code* (2007)**
The test-double taxonomy and most of the test-smell names used in `anti-patterns.md` (Assertion Roulette, Mystery Guest, Eager Test, Erratic Test, Fragile Test, Obscure Test, Conditional Test Logic, Test Code Duplication, Slow Tests), plus the indirect-inputs / indirect-outputs framing and the Test Spy ("essentially just a Test Stub with recording capability") vs. Mock Object distinction. The companion site `xunitpatterns.com` is HTTP-only and was unreachable from this environment, so these definitions are taken from Fowler's rendering in *Mocks Aren't Stubs*, from Meszaros' definitions as quoted in the Hora & Robbes paper, and from search-surfaced excerpts of the site's own pages — not from the site directly.

**Michael Feathers — *Working Effectively with Legacy Code* (2004)**
Everything in `legacy-code.md`: "legacy code is code without tests," the seam definition ("a place where you can alter behavior in your program without editing in that place") and enabling points, object/link/preprocessing seams, characterization tests, the Legacy Code Change Algorithm, and Sprout Method / Sprout Class / Wrap Method / Wrap Class. Verified against [understandlegacycode.com's summary](https://understandlegacycode.com/blog/key-points-of-working-effectively-with-legacy-code/).

**Vladimir Khorikov — *Unit Testing: Principles, Practices, and Patterns* (2019)**
The four pillars — protection against regressions, resistance to refactoring, fast feedback, maintainability — and the argument that resistance to refactoring is effectively binary and should always be maximized. His chapter-1 excerpt PDF did not parse cleanly; the pillars are cited from the book and cross-checked against secondary summaries.

**Steve Freeman & Nat Pryce — *Growing Object-Oriented Software, Guided by Tests* (2009)**
"Mock roles, not objects" — the argument that doubles belong at the level of a collaborator *role* you have defined, not a concrete class or a vendor API. Underpins the "double at your own port, not the vendor's API" rule in `test-doubles.md`. Test Data Builder pattern (Pryce) underpins the builder guidance in `test-design.md`.

**Bertrand Meyer — *Object-Oriented Software Construction***
Command/query separation, which the query-vs-command rule for choosing doubles applies to test design.

## This Plugin's Own Synthesis

Not attributable to a source above — stated here so it isn't mistaken for received wisdom:

- The ordering of the five doubles by coupling, and the recommendation to default to fakes over mocks. Consistent with Fowler's documented trade-off, but the prescription is this plugin's.
- The scope-selection table mapping "what you're verifying" to a slice, and the specific speed budgets. The budgets are conventional practice, not measured thresholds.
- The "watch it fail first" rule as a required step for every test, including tests added to already-passing code.
- The "actually correct when" section on every anti-pattern.
- The significant-vs-incidental distinction used to reconcile "write expected values literally" with "avoid magic strings," and "realistic happy path" with "minimally passing tests."
- The "hook for lifecycle, helper for data" rule of thumb.
- The four-step handling of vocabulary collisions (reason precisely, write in the codebase's vocabulary, describe behavior when ambiguity matters, don't let a label authorize the wrong double).
- The workflow orderings and commit sequencing (`test:` → `refactor:` → `feat:`/`fix:`).
- In `test-auditing`: **defect history as the primary ranking signal** (Feathers and Tagwerker rank on churn, complexity, and coverage — using `fix`/`hotfix`/`revert` commits as a risk input is this plugin's addition), the coverage × assertion-quality cross-reference table, and the systemic-vs-specific reporting split. The sweep signal set is derived from `anti-patterns.md`, but the claim that these particular greps rank areas usefully is untested — see the verification gaps below.
- All code examples, which are hand-written and illustrative. None were compiled or executed.

## Not Yet Incorporated

Content gaps:

- **Mutation testing** — `test-auditing/references/detection-patterns.md` now names concrete tooling per ecosystem (Stryker.NET, StrykerJS, mutmut, PIT, go-mutesting) and scopes runs to a single module, closing the tooling half of this gap. The underlying claim — that mutation score is a better measure of protection than coverage — still rests on **no consulted source**; it is taken as received wisdom throughout this skill.
- **Contract testing** is named as a slice in `test-scope.md` without a source or a worked example — the only slice of the five with neither.
- **Collaborative scenario discovery** — Specification by Example and Example Mapping, named above but not consulted.
- **Languages.** Worked examples cover C#, Python, and TypeScript. Nothing for Go, Java, Rust, or Ruby; Go is the case where a naming convention genuinely differs (`go test` only discovers `TestXxx`), which an earlier draft got wrong. `test-auditing/references/detection-patterns.md` adds Go and Java *detection* patterns and tooling, which is not the same as guidance — none of those patterns has been run against a real repository in either language.
- **Async and concurrent code** beyond the flakiness material, and **fixtures containing sensitive data**, are not covered at all.

Verification gaps — these are about confidence in what is here, not missing content:

- **No code example has been compiled or run** except the refund arithmetic in `examples/outside-in-from-a-story.md`, which was executed and verified case by case. An adversarial review of the first four examples found a hard compile error, a fabricated coverage transcript, a property test that could not detect what the text claimed, and a call to a method that did not exist. Those are fixed; the process gap is not.
- **Skill triggering has never been measured.** Whether the `description` fires when intended, or over-fires on unrelated senses of "test," is unknown.
- **None of the three commands has been run against a real repository.** `/test-review`, `/test-write`, and `/test-audit` are all unexercised end to end. `/test-audit` is the most exposed: a wrong sweep pattern produces a confidently wrong map rather than an obvious failure, and its assumption that a mechanical pass can rank areas usefully is untested.

  The sweep patterns themselves are the one exception — every pattern in `test-auditing/references/detection-patterns.md` was **executed against a synthetic fixture** covering C#, TypeScript, Python, and Go, and the match counts checked against hand-verified expectations. That pass caught two real defects: `\[Fact\]` missed `[Fact(Skip = "…")]`, and `\b(it|test)\s*\(` missed `it.skip` and `it.each` — each of which silently undercounts the test denominator used to find assertion-free files. Java patterns and the git-history recipes were not fixture-tested. A synthetic fixture is not a real suite: it proves the regexes match what they claim, not that the signals rank anything usefully.
- **The gate is an untested hypothesis.** The claim that a stop-and-justify trigger at the mocking-library call outperforms prose guidance is a plausible mechanism and the plugin's headline design choice, but it is unmeasured. If it doesn't work, the plugin's central remedy doesn't work.

Known divergences from the adversarial review, kept deliberately:

- `SKILL.md` is longer than the review recommended (the procedure and gate cost more than the cut provenance saved).
- The trigger was not narrowed — the fix for an always-on skill is a smaller skill, not a narrower trigger.
- No hard numeric test-count budget was added; thresholds and a stop-rule are used instead.
