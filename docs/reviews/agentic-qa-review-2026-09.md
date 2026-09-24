# agentic-qa review — September 2026

A five-agent review of the `agentic-qa` plugin at v0.2.0. Four reviewers worked
one axis each over all 17 files; a fifth attacked their findings.

**Every finding here is on `main`.** The review ran against the
`claude/playwright-mcp-reliability-hk1ssx` branch, which merged as PR #17 before
the review was written up, so the plugin as published carries all of it.

Every finding below survived that adversarial pass. Verdicts are the critic's;
where the critic overturned or narrowed a reviewer, the original claim and the
correction are both recorded, because the correction is usually the more
interesting half.

**Nothing here is fixed.** This is the findings record. Two of the criticals
mean a user installing this plugin today gets one that hangs before producing a
report on a clean run, and whose Playwright driver cannot execute at all.

**Revised 2026-09-24** after a second read against `ad19c7c`. Every line citation
was re-checked and holds. Changes from the first version: F3 gains a second
missing signal and a second hang site; F5 notes the two retry definitions
disagree; F6 moves from Critical to High; the peer-addressing refutation is
withdrawn and reopened as F21; F19 and F20 are new; the evidence-quality note
now names F1.

## Provenance key

Both are live on `main`. The labels say when a defect was introduced, not where
it is now.

- **[NEW]** — introduced by the Playwright-fallback work (PR #17, merged
  2026-09-17).
- **[PRE]** — predates it; shipped in `b51592d` with the plugin itself.

## Evidence quality, stated up front

F1, F2, F9 and F15 rest on documentation read through a summarizing fetch
rather than on observed behavior. F1's core claim — that a plugin-bundled server
is addressed under an `mcp__plugin_` prefix — is not in doubt; its exact string
is, which is F2. That method proved unreliable *during this review*:
three fetches of the same page produced three different renderings of the same
example (see F2). Where a finding depends on a character-exact string or on a
harness behavior, it is marked UNRESOLVED and says what would settle it. The
plugin is markdown and JSON with no test runner, so nothing here was confirmed
by execution.

---

## Critical

### F1 [NEW] — every Playwright tool name in the executor's allowlist is wrong

`agents/step-executor.md:4` grants 23 tools as `mcp__playwright__browser_*`.
A plugin-bundled MCP server is not addressed that way. The scoped form is:

```
mcp__plugin_<plugin-name>_<server-name>__<tool-name>
```

and the documentation states the full name is required in a subagent's `tools`
field specifically, warning that a bare server key "never fires" for a
plugin-bundled server.

As shipped, the executor's allowlist grants 23 tools that do not exist under
those names, so the Playwright driver is inert. This is the same defect the PR
set out to fix — an allowlist naming tools the agent cannot reach — reintroduced
in the fix itself.

The `mcp__claude-in-chrome__*` entries are unaffected: that server is not
plugin-bundled, so the bare form is correct for it.

*Verified independently by the orchestrator against two doc pages, and confirmed
by the critic against a third.*

### F2 [NEW] — the exact replacement string is not settled — UNRESOLVED

`agentic-qa` contains a hyphen, so F1's fix depends on whether hyphens are
preserved (`mcp__plugin_agentic-qa_playwright__browser_navigate`) or converted
(`mcp__plugin_agentic_qa_playwright__browser_navigate`).

Three fetches of the reference page produced three different answers: an example
preserving hyphens, an example converting them, and a page containing only the
placeholder form with no concrete example at all. A character-replacement rule
that would preserve hyphens appears in the docs, but the third reading suggests
it may govern the plugin *data directory* rather than tool naming.

The critic refuted this as a non-issue on the strength of two consistent fetches.
That refutation is not accepted: it used the same unreliable method, and the
disagreement is itself the evidence.

**What settles it:** install the plugin and read the actual tool list. Do not
fix F1 from documentation alone. The revision pass checked whether this machine
could settle it and it cannot: `agentic-qa` is not installed here, and the only
`mcp__plugin_agentic…` strings in local transcripts are quotations of this
document, not observed tool lists.

### F3 [PRE] — the report never finalizes, because nothing sends the signal it waits for

`agents/qa-reporter.md:22` and `skills/qa-reporting/SKILL.md:18` gate
finalization — Status, Summary, the self-check, rendering
`walkthrough-report.html` — on "the final signal" from `step-executor`, framed as
a distinct, named event.

`agents/step-executor.md` and `skills/step-execution/SKILL.md`, read in full,
describe exactly two messages the executor ever sends: a per-step result, and an
escalation notice to the orchestrator. Neither file instructs it to send a
completion message to anyone. The executor never even loads the `qa-reporting`
skill, so nothing in its own instructions mentions that a signal is expected.

A clean run therefore executes every step, fills every Traceability row, and
stops. `walkthrough.md:121` ("Once `qa-reporter` signals done…") never fires, so
Phase 5 never runs. This is not one of the five escalation triggers, so the run
hangs silently rather than pausing and notifying.

**The chain is broken twice, not once** (added in revision). Even if the
executor did send a final signal, nothing instructs `qa-reporter` to tell the
orchestrator it has finished: `agents/qa-reporter.md` and
`skills/qa-reporting/SKILL.md` both end at rendering the HTML and send no
message to anyone. Two sites wait on that message — `walkthrough.md:121` and
`agents/qa-runner.md:24`, which uses the same wording — so the agent-invoked
path hangs the same way the interactive one does.

The critic was specifically instructed to try to break this finding and reported
that it survives: the only escape is `qa-reporter` inferring completion from full
Traceability coverage, which nothing authorizes — the self-check is a validation
to run *after* finalization starts, not a trigger to start it.

### F4 [PRE] — backoff can fire an irreversible action four times on one approval

`skills/step-execution/SKILL.md:37-41` retries the identical action on a timeout
or 5xx, up to four attempts. Nothing instructs re-checking authorization per
attempt, and nothing instructs verifying whether the previous attempt's side
effect actually landed.

An `escapes` step — a real payment, a delivered email — receives one
`confirmed live` approval. The request succeeds server-side and the response
times out, which is an ordinary failure mode. The executor classifies it an
environment failure and re-sends the identical non-idempotent action.

`step-results.md` has one `Authorization` field and no attempt count, so the
result is indistinguishable from a single approved call.

### F5 [PRE] — the same retry silently converts a real failure into a pass

The retry rule does not distinguish an infrastructure 5xx from a 5xx returned by
the application under test — precisely the intermittent bug a walkthrough exists
to catch. A racy failure on attempt 1 that passes on attempt 2 produces a clean
`pass`, and `Deviation` is scoped to *adapting* an action rather than repeating
it, so the original failure leaves no trace.

The two definitions of the retry already disagree on this point (added in
revision). `skills/step-execution/SKILL.md:37` retries on "a 5xx **gateway**
error" — which gestures at the infrastructure/application distinction — while
`agents/step-executor.md:30` says "5xx" unqualified. Part of the fix is bringing
the agent file in line with the skill.

The critic was asked whether F4 and F5 are one mechanism double-counted and
concluded they are not: same rule, two independent harms — repeated physical
side effects versus destroyed evidence integrity. One fix (attempt tracking plus
idempotency-aware classification, disclosed per attempt) closes both.

### F7 [PRE] — the production gate specifies no mechanism

`walkthrough.md:63-64` places two gates side by side. The reachability gate says
the base URL is "checked, not just accepted as a string." The production gate —
the plugin's most load-bearing safety claim, stated as absolute in three
documents — names no check at all: no hostname pattern, no denylist, nothing.
It rests entirely on model judgment about a self-reported string.

A secondary, lower-urgency half: `.claude/agentic-qa.local.md` is trusted on
later runs with no re-validation language and no `.gitignore` guidance. The
critic's correction is that this does not introduce a new bypass — cached values
face the same unstructured gate a fresh run does — it just means an unattended
re-run skips re-asking.

---

## High

### F6 [PRE] — agent-invoked runs drop the only scope-creep backstop

`walkthrough.md:107` names the User Gate as "the only place" an `Added` row is
struck. `agents/qa-runner.md:21` keeps every `Added` row, because there is nobody
to ask.

Ticket and PR text are attacker-influenceable in most deployments and are the
primary input to the extractor and both critics. No document contains any
instruction to treat that content as data rather than instruction — a grep for
`redact|scrub|sanitiz|untrusted|inject` across the plugin returns nothing. With
`pre_authorize_contained: true` in the brief, a fabricated `contained` step can
be planned and executed with no human ever seeing it.

The critic tested each link and confirmed the conclusion, with two corrections
carried here: unscoped `Bash` on five of seven agents is a **severity
amplifier, not a causal link** — the outcome follows from the missing strike plus
blanket pre-authorization alone — and "attacker-influenceable ticket text" is a
threat-model assumption about deployment, not a fact about the repo.

*Moved from Critical in revision.* The premise the critic flagged is an
assumption, and a fabricated step must also be classified `contained` by
`step-plan-critic`, which grounds that call against the code. F1, F3 and F4 fail
on an ordinary run with no adversary; this one needs both an adversary and a
misclassification.

### F19 [NEW] — a registered tool is not a connected driver

`walkthrough.md:66` selects `claude-in-chrome` "if its tools are present." That
MCP server registers its tools whether or not a browser extension is connected,
so a session with no Chrome attached still records `Browser driver:
claude-in-chrome`. The executor's first browser call then fails, is classed as an
environment failure, backs off four times over roughly ninety seconds, and
escalates — and Playwright, which would have worked, is never tried.

Line 66 routes "present but fails later" to backoff deliberately, so this is the
design working as written; the flaw is the premise that presence implies
availability, which holds for Playwright and not for `claude-in-chrome`. Sits
with F8/F9 — all three are about how the driver gets chosen.

### F8 [NEW] — the agent-invoked path cannot produce the driver field three documents require

`agents/qa-runner.md` is byte-identical to its pre-PR-#17 version. The defect is
not a change to that file — it is that three other documents now read a field it
was never taught to write.

`agents/qa-runner.md:18` — the agent-invoked equivalent of Intake — enumerates
the four validity gates and writes `intake.md`, never determining or recording
`Browser driver`. `browser_driver` is absent from the brief schema in both
`qa-runner.md` and `skills/agentic-qa/SKILL.md:29-41`.

Meanwhile `skills/step-planning/SKILL.md:27`, `skills/step-execution/SKILL.md:73`
and `agents/step-executor.md:18` all read that field as settled fact, one of them
instructing "read it, don't re-derive it."

**The obvious fix does not work,** per F9: `qa-runner` cannot detect driver
presence from inside its own restricted context. The brief needs an explicit
`browser_driver` field instead.

### F9 [NEW] — the driver check is possible interactively and impossible agent-invoked

Reported as a single defect; the critic split it, and the split is the finding.

- **Interactive — REFUTED.** `walkthrough.md` is a slash command, and a command's
  `allowed-tools` is a permission pre-approval list, not a visibility restriction;
  its execution context is the main session's. The orchestrator can see which
  browser tools are registered despite not listing them. The design holds here.
- **Agent-invoked — CONFIRMED.** `qa-runner` is a genuine subagent whose tool set
  is fixed before it runs, and it is granted no browser tools. It cannot read
  what it is asked to read.

*Leans strongly but rests on doc-summarized fetches; observing a live session
would settle it.*

### F10 [PRE] — the reporter is told to display a pause it never hears about

`skills/qa-reporting/SKILL.md:12` instructs `qa-reporter` to show
`⏸ paused, waiting on SSO login` so a report opened mid-wait shows status rather
than silence. But `agents/step-executor.md:32` sends the pause notice only to the
orchestrator, and `qa-reporter` is a sibling spawned alongside it, not its
invoker. Nothing tells the executor to also notify the reporter, or the
orchestrator to relay it.

F3 and F10 are the same authoring pattern twice: the reporter's spec presupposes
a message type the executor's complete spec never produces. One fix — an explicit
end-to-end messaging contract — closes both, but it has to cover three messages,
not the executor's two: executor → reporter "final", executor → reporter
"paused", and reporter → orchestrator "done" (see F3's revision). It also
depends on F21 — the contract names a sibling the sender may not be able to
address.

---

## Medium and below

### F11 [NEW] — "no driver" is described as an escalation that nothing performs

`skills/agentic-qa/SKILL.md:47,55` lists it as one of five triggers that pause
and notify; `skills/step-execution/SKILL.md:77` tells the executor "Intake
already did" escalate. Neither orchestrator pauses for it. Interactively it
surfaces as blocked steps at the User Gate — which the same table row admits,
contradicting its own header.

Merged here with a separate reviewer's finding that agent-invoked no-driver runs
skip all browser coverage with no notification to the caller, against
`README.md:13`'s promise that anything needing a human "pauses and notifies
whoever invoked it." Same defect, two angles. Downgraded from the original
MED-HIGH: the caller does learn, via the report's `Blocked` section, just not
through the mechanism the text describes.

### F12 [NEW] — the stale-element test does not cover verification targets

`skills/step-execution/SKILL.md:47-54` requires matching an element's role and
accessible name recorded before re-snapshotting. The mechanism is sound for its
target case — a click on a named interactive element — and the critic agreed the
write-it-down-first device genuinely works there.

Two gaps: the match has no stated tolerance for dynamic name content (a counter
in a label), and generic roles (`status`, `alert`, `region`) often carry weak or
absent accessible names — exactly the roles a step's *verification* target uses.
No language extends the device to verification-only checks.

### F13 [PRE] — evidence capture writes credentials to files

Not a contradiction — a gap. The critic's correction stands: rule 4
(`skills/agentic-qa/SKILL.md:17`) governs *input* credentials reaching
`intake.md` and the brief, and never claimed to govern evidence captured during
execution. The exposure is real regardless:

- Screenshots are mandatory every browser step and base64-embed into the report.
- API evidence is "the response body as text" unconditionally — for a login or
  key-issuance endpoint, that body is the credential.
- `browser_network_requests` [NEW] captures full headers, `Authorization` and
  `Cookie` included.

All of it syncs incrementally to a configured report destination before any human
reviews content. No redaction guidance exists anywhere in the plugin.

### F14 [PRE] — the escalation target is ambiguous in nested runs

`skills/agentic-qa/SKILL.md:57` treats "whichever session or agent directly
invoked this one" and "the main or initial session" as synonyms. Under
`qa-runner` they differ. Low practical risk: the two operative files are each
correct for their own position in the chain, and the imprecision lives only in
the shared summary.

### F15 [PRE] — `SendMessage` may require a flag the plugin never mentions — UNRESOLVED

Current documentation says `SendMessage` does not require agent teams to be
enabled. A filed issue (anthropics/claude-code#35240) reports the opposite in
practice. The plugin's entire drafter/critic architecture depends on it and states
no prerequisite. **What settles it:** spawn two of these agents on a real install
and see whether the tool is offered.

### F20 [PRE] — the executor may be unable to load deferred browser tools — UNRESOLVED

The harness can defer MCP tools: listed by name, with schemas loaded through
`ToolSearch` before first use. `agents/step-executor.md:4` does not grant
`ToolSearch`. If a subagent with an explicit `tools` list inherits that
deferral, neither driver is callable regardless of how F1 resolves. Estimated at
roughly 30% likely to be real. **What settles it:** the same live install that
settles F2 — spawn the executor and see whether a browser tool call succeeds
without a `ToolSearch` first.

### F21 [PRE] — sibling agents may have no way to address each other — UNRESOLVED

Reopened in revision; originally listed under Refuted. Every pairing in the
plugin is between siblings: `behavior-extractor`/`behavior-coverage-critic`,
`step-planner`/`step-plan-critic`, and `step-executor`/`qa-reporter` are each
spawned by the orchestrator, then told to `SendMessage` one another. The
refutation held that addressing is by the ID returned at spawn time — but only
the spawner receives that ID, and neither `walkthrough.md` nor `qa-runner.md`
instructs the orchestrator to pass one sibling's ID to the other.

It works only if `SendMessage` resolves an agent by name. Harnesses where names
are the address exist, so this may be fine, but that is a different ground from
the one the refutation gave. The executor → reporter stream, which all of
Phase 4 depends on, rests on it. The text is also inconsistent about the
drafter/critic pairs: `walkthrough.md:96` calls the orchestrator's role "relay",
while both agents' descriptions say they message each other directly.
**What settles it:** check alongside F15 on a real install.

### F16 [PRE] — the planner is offered a citation source it cannot read

`skills/step-planning/SKILL.md:25` offers "the code path" as grounding, but
`agents/step-planner.md:4` grants no `Grep`/`Glob`/`Bash`. Mild: the drafter has a
fallback ground needing no code access, and its critic — which does hold those
tools — is the one chartered to check against code.

### F17 [PRE] — the umbrella over-scopes a direct invoker

`skills/agentic-qa/SKILL.md:24` tells a directly-invoking agent to hold "the
browser tools." Both real orchestrators omit them, and nothing at that level uses
them — browsing is always delegated to the executor.

### F18 [PRE] — the `testing` dependency is prose-only

`plugin.json` omits the supported `dependencies` field, so a hard requirement is
enforced only by a runtime check and a README line.

---

## Refuted — recorded so they are not re-raised

- **The interactive driver check.** See F9 — refuted for the interactive path,
  which is the one the plugin's text is written around.

## Held up under attack

Recorded because a guarantee that survives an adversarial pass is a result.

- The `escapes` gate on a step's **first** execution. The hole in F4 is the retry
  path around the gate, not the gate.
- The storage-state carve-out from the credentials rule, as scoped.
- The Added-row strike as a mechanism — the defect in F6 is its absence in
  agent-invoked mode, not weakness in the mechanism.
- `!` context blocks contain no shell expansion, per `CLAUDE.md`'s rule.
- Per-agent tool grants: `Agent` correctly withheld from the five phase agents,
  `AskUserQuestion` from all seven spawned agents, `Write` from both critics.
- Artifact field names agree across every writer and reader — except F8.
- Version and description in sync across both manifests.

## Suggested order, if these get fixed

1. **F1** with **F2** settled first by observation — the execution phase is inert
   until this is right, and it cannot be fixed from documentation. Settle F20,
   F21 and F15 on the same install; they all need a live session and nothing
   else.
2. **F3 + F10** — one three-message contract, written against however F21
   resolves.
3. **F4 + F5** — attempt tracking and idempotency-aware retry.
4. **F8 + F9 + F19** — `browser_driver` as a brief field, not a detection step,
   and a connectivity check rather than a presence check where Intake does
   detect.
5. **F6** — agent-invoked authorization, restated without the `Bash` link doing
   causal work.
6. **F7**, then **F13**, then the rest opportunistically.

F15 is worth a README line whichever way it resolves.
