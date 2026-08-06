---
description: Check whether pushed code still does what its ticket or PR description said — per-behavior verdicts with code citations, corroborated by the tests that already exist
argument-hint: [PR number or URL | ticket key | description file | prose] (defaults to the current branch's PR)
allowed-tools: Agent, Read, Write, Grep, Glob, Bash, TodoWrite
---

## Context

- Current branch: !`git branch --show-current`
- Default branch: !`git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || echo "origin/HEAD not set"`
- Changed files vs. default branch: !`git diff --name-only "$(git merge-base HEAD "$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/main)" 2>/dev/null || echo HEAD)" 2>/dev/null || git diff --name-only HEAD`
- Uncommitted changes: !`git status --porcelain`

**State which base you compared against** in your report. If the default branch could not be determined and the diff fell back to uncommitted changes only, say so explicitly — a conformance check that silently examined three files when the branch changed thirty is worse than no check.

## Task

Answer one question: **does the code that was pushed still do what the description said it would?**

This is not a code review and not a test review. For each described behavior, the output is a verdict — implemented as described, implemented differently, not implemented, or undeterminable — with a code citation that makes it checkable in seconds.

This plugin's skills and agents are addressed as `testing:<name>`; there is no bare-name fallback. **Load the `testing:spec-conformance` skill now** and follow its procedure. Load the `testing:testing` skill for the interpretation criteria in its references. Phase 1 loads `testing:behavior-extraction`.

### The rule that makes this trustworthy

> **Extract the description's behaviors before opening any code, and never revise the spec after reading the implementation.**

The oracle discipline this plugin runs on is about *sequencing*, not abstinence. This command must read the implementation — that is its whole job — but the specification it judges against has to be frozen first. A spec adjusted after seeing the diff will always find that the diff conforms.

Its corollary: **a contradiction is a finding, not a thing to explain away.** If the code disagrees with the description, report both sides quoted. Deciding the ticket is merely stale is the user's call, never yours.

### Artifacts

Write to your scratchpad directory, or a temp directory:

- `behavior-spec.md` — Phase 1. If the user points you at a `behavior-spec.md` from an earlier `/test-write` run for this same ticket, **reuse it** rather than re-deriving, and say that you did. Do not go hunting for one: `/test-write` writes to a session-scoped directory that a later run cannot locate, so a search would fail silently and a second, subtly different spec is worse than an honest re-derivation.
- `locations.md` — Phase 2, the behavior → code map
- `conformance.md` — Phase 5, the same report you give the user, saved so it can be attached to the PR

Track the phases with TodoWrite.

---

## Phase 0 — Intake

This command needs **two** inputs: a description, and a change to judge against it. Usually one PR supplies both.

**Fetch only the description in this phase.** Record where the change will come from; do not retrieve it until Phase 2. Running `gh pr diff` here puts the implementation in context before extraction, which defeats Phase 1 irrecoverably — and silently, because the report would still claim the spec was frozen.

| `$ARGUMENTS` | Fetch now — the description | Record for Phase 2 — the change |
|---|---|---|
| PR number or URL | `gh pr view <n> --json title,body,url` plus any linked issue | `gh pr diff <n>` |
| Ticket key (`ABC-123`) | A JIRA/tracker MCP server if connected, else ask the user to paste it | Current branch vs. default (see Context) |
| A file path | Read it | Current branch vs. default |
| Prose | That text | Current branch vs. default |
| Empty | The PR for the current branch if one exists (`gh pr view --json title,body,url`), else ask | That PR, else current branch vs. default |

The Context block above already lists changed **file names**. That is far weaker exposure than a diff, but it is not nothing: do not open any of those files during Phase 1, and do not let a filename suggest a behavior. If a behavior would not be in your spec had you not seen that list, it is `observed`, not `stated`.

If the description is too thin to yield a single testable behavior — a title with no body, "fix the thing" — **stop and ask.** A conformance check against an empty specification is a code review wearing a costume, and it will manufacture behaviors to have something to judge.

If there is a description but no change to judge — clean tree, no PR — say so and stop.

## Phase 1 — Extract, before any code is read

Load the `testing:behavior-extraction` skill. Work **only** from the description. Produce `behavior-spec.md` exactly as `/test-write` does: numbered behaviors with stable IDs in Given/When/Then, each anchored to a verbatim quote, plus the unspecified-behavior register.

**Do not open the diff during this phase.** For a PR, the oracle is the description and its linked issue; the diff is evidence of what was written, never evidence that it is correct.

Freeze the spec here. Later phases may add `observed` behaviors — the diff doing things nobody described — but they may not edit, soften, or reinterpret a behavior that was extracted from the description.

## Phase 2 — Locate

Now read the diff. Then follow into the surrounding code.

Spawn `Explore` agents (read-only, parallel when the questions are independent) to answer: **what code, if any, implements behavior `Bn`?**

**Batch the behaviors — do not spawn one agent per behavior.** A real ticket routinely yields fifteen to thirty, and thirty repository-wide searches is a cost with no matching benefit. Group by subsystem where the spec suggests one, otherwise about five behaviors per agent, and **cap the fan-out at four or five agents.** Give each agent its behaviors in full with their anchors, and this instruction verbatim:

> *Report where the behavior is or is not implemented, with file and line. Do not judge whether it is correct — that is not your output. If the behavior is implemented partly here and partly elsewhere, say so and name both.*

Write `locations.md`: behavior ID → file:line, or an explicit "nothing found, searched X."

**The diff is not the system.** A three-line PR can satisfy a described behavior entirely through code that already existed and is now merely called. Reporting `absent` from the diff alone is the single most likely way this command is wrong. Before any `absent` verdict, confirm the behavior is not implemented elsewhere in the repository.

No verdicts in this phase. Locating and judging are separated so that a citation exists before an opinion does.

## Phase 3 — Adjudicate

On the main thread, because this is the judgment. For each behavior in the spec, exactly one verdict, and each requires its evidence before it may be stated:

| Verdict | Requires |
|---|---|
| `conforms` | The `file:line` that implements it |
| `contradicts` | The anchor quote, the code location, and what the code does instead |
| `absent` | Where it would have to live, and the searches you ran that did not find it |
| `partial` | Which described cases are handled and which are not, each named |
| `undeterminable` | Why reading cannot settle it, and what would |

**A verdict whose evidence you cannot supply is not discarded — it becomes `undeterminable`, with the reason.** Every behavior in the spec gets exactly one verdict and appears in the report; dropping one would hide it, which is the failure the per-behavior table exists to prevent. What you may never do is state a stronger verdict than your evidence supports.

`undeterminable` is therefore always reachable, because its requirement — saying why reading cannot settle it — is one you can always meet. That is deliberate. It is the floor, not a failure.

Then two sweeps the spec makes possible and a plain code review does not:

1. **Undescribed changes.** Behavior in the diff that no part of the description covers. These are `observed` behaviors per the `testing:behavior-extraction` skill — record each with its code location. They are scope creep, an unrelated fix riding along, or a bug, and the user decides which.
2. **Questions the change answered silently.** Walk the unspecified-behavior register against the code. Where the description left a boundary open and the implementation picked a side, report it: the register question, the side the code chose, and the location. This is often the highest-value output of the whole run and it costs nothing extra to produce.

## Phase 4 — Corroborate with the tests that exist

Detect the test runner and its command. Identify which existing tests cover each behavior, and **run those tests** — not the whole suite. This command writes nothing, so a full-suite run costs time and drags unrelated pre-existing failures into the report. Fall back to a broader run only if targeted selection is not possible, and say so.

Give every verdict an **evidence tier**:

| Tier | Meaning |
|---|---|
| `tested` | A test covers this behavior and was executed; give the result |
| `read` | The verdict comes from reading code only |
| `untested` | No test covers this behavior at all |

Running tests does not make every verdict evidence-backed — only the covered ones. `untested` is a finding in its own right: it names exactly where `/test-write` should be pointed next.

Bound the run with a timeout. If the suite will not run — missing dependencies, no database, wrong runtime — **say so, mark every affected verdict `read`, and continue.** A degraded run reported honestly is useful; a blocked command is not. Never describe a test as passing that you did not execute.

## Phase 5 — Report

```markdown
## Verdict
<Does the pushed code do what was described? One paragraph. Lead with contradictions if any exist.>

## Behavior conformance
| Behavior | Verdict | Evidence | Location |

## Contradictions — the code disagrees with the description
| Behavior | Description says | Code does | Location |

## Absent — described, not implemented
| Behavior | Anchor | Where it would belong | Searched |

## Undescribed changes
| Code location | What it does | Nothing in the description covers it |

## Questions the change answered silently
| Register question | Side the code chose | Location |

## Test corroboration
Command: <exact command>
Result: <pass/fail counts>
Behaviors actually covered: <IDs>
Behaviors with no test: <IDs>

## Compared against
Base: <the base, stated plainly>
Not examined: <anything out of scope, and why>

## What this check cannot tell you
- Whether the description itself was right. Faithful implementation of a bad ticket conforms.
- Whether these verdicts are trustworthy: they are readings of code, not executed results,
  except where marked `tested`. The defenses against a confident wrong reading are designed
  but unmeasured.
- Whether an `absent` is real. Behavior satisfied by pre-existing code the change merely
  calls looks identical to behavior never implemented.
```

End with the two or three things most worth acting on. If the code conforms to the description, **say that plainly** — a conformance check that never returns "conforms" is not a check, it is a finding generator.

---

## Rules that hold across all phases

- **Never edit any file in the repository under review.** This command reports; it does not fix. Offer next steps instead. Its own artifacts go to the working directory and are the only things it writes.
- **Never revise the behavior spec after reading code.** Add `observed` behaviors; change nothing that came from the description.
- **Never resolve a contradiction by declaring the ticket stale.** Quote both sides and let the user decide.
- **`undeterminable` is an expected outcome**, not a failure to try harder. Overstating certainty is the specific way this command becomes worthless, because its output is claims about code rather than executed results.
- **Hand off rather than absorb.** A gap → `/test-write <the same ticket or PR>`. Weak tests around a conforming behavior → `/test-review <path>`. No idea where the repo is weak overall → `/test-audit`.
