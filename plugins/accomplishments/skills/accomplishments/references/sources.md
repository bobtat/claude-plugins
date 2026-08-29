# Sources, Measurements, and Known Gaps

## Where the Ideas Come From

**The brag document** — Julia Evans, *[Get your work recognized: write a brag document](https://jvns.ca/blog/brag-documents/)* (2019). The origin of the practice this plugin automates. Her core arguments are load-bearing here: that nobody else is tracking your work, that memory is heavily weighted toward the last few weeks of a review period, and that the document should be written continuously rather than assembled under deadline. The journal format and the working rhythm in `SKILL.md` are a mechanized version of her recommendation.

**Glue work** — Tanya Reilly, *[Being Glue](https://noidea.dog/glue)* (2019). The source of the team-tier argument in `impact.md`: that the work holding a team together — unblocking people, writing the doc, running the process — is invisible to systems that track tickets and commits, and therefore has to be recorded deliberately or not at all. This is why the mining commands are explicitly framed as insufficient on their own.

**Operating at the next level** — Tanya Reilly, *The Staff Engineer's Path* (O'Reilly, 2022), and Will Larson, *Staff Engineer: Leadership Beyond the Management Track* (2021; material also at [staffeng.com](https://staffeng.com)). The promotion-packet guidance in `formats.md` follows both on one specific point: promotion committees recognize demonstrated current behavior at the target level, sustained over time, rather than betting on potential. The "multiple instances across time" requirement comes from there.

**Scope and consequence over effort** — a common thread in published engineering career ladders and in Gergely Orosz, *The Software Engineer's Guidebook* (2023). The impact ladder in `impact.md` is not any single company's framework; it is the common shape most of them share. Any organization with its own ladder should override it — the ladder here is a default for people who have none, not a claim about how a particular company levels.

**STAR** — Situation, Task, Action, Result. Standard in behavioral interviewing since the 1970s; no single canonical citation, and the plugin does not follow it strictly. The journal entry format keeps its useful skeleton (context, action, result) and adds the parts STAR omits, which are the parts that matter for a review: who was affected, what the counterfactual was, and where each number came from.

**Claude Code mechanics** — the [hooks reference](https://code.claude.com/docs/en/hooks) for the `SessionEnd` event contract, and the `cleanupPeriodDays` setting for transcript retention. Both were checked against the running version rather than assumed.

## Measurements Taken for This Plugin

This repository's own numbers, measured on one developer's machine in August
2026. Not published figures; they will differ elsewhere.

Several figures in the v0.2.0 release of this file **did not reproduce** under
adversarial re-measurement and are corrected below. The retractions are kept
rather than deleted, because a plugin whose central rule is *never invent a
number* has no business quietly editing its own.

- **Transcript retention is real and is 30 days.** Oldest transcript on disk 29
  days old, no `cleanupPeriodDays` override. Reproduced.
- **gzip compresses these transcripts 2.9x**, not the ~10x plain text suggests.
  Reproduced exactly (110.0 MB → 37.9 MB). Retained because it corrects a
  common intuition, though the design it justified is gone.
- **Credential-shaped strings cluster in tool traffic.** Re-measurement over a
  larger scan found 465 hits, 78% in tool traffic and 9.5% in prompts. The
  v0.2.0 figures (92 of 120 = 77%; 28 = 23%) were a smaller sample. The
  load-bearing ratio — most exposure is in tool traffic — holds.
- **Digest reduction is 1476x.** 115 transcripts, 66.4 MB, produce 26 digests
  totalling 46 KB; about 0.5 MB per year.
- **Only 26 of 115 transcripts yield a digest.** The other 89 are SDK or
  automation runs containing no typed prompt. A session with nothing typed
  correctly produces nothing.
- **288 typed prompts kept, 59 injected blocks dropped** by the structural
  filters, with zero human-origin prompts lost.
- **A Haiku call through `claude -p` takes 6-8 seconds.** Far past the ~1.5
  second `SessionEnd` budget, which is why stage 2 is detached.
- **Subagent transcripts** live under `<session-id>/subagents/` and are never
  passed to the hook.

### Corrections to v0.2.0

- **"The first timestamped record is around line 16" — withdrawn, it was
  false.** 38 of 40 sampled transcripts carry a timestamp on line 1. It was
  offered as the justification for the 256 KB head-scan; the scan is still
  correct defensive behaviour, but it never needed that justification.
- **"Content breakdown: 40.1% metadata / 24.1% tool results / 20.3% tool inputs
  / 7.8% prompts" — not reproducible.** Independent measurement over a larger
  corpus gives roughly 16% metadata, 61% tool results, 6% tool inputs, 3.2%
  prompts, 14% assistant. The bucketing method was never stated, which is the
  underlying defect. **Prompts are ~3% of content, not 7.8%** — the earlier
  figure overstated them by more than double.
- **"564x reduction" and "about 1 MB per year" — superseded.** Both were
  computed before the injected-content filters existed and over a different file
  set.
- **The README's "here is a real digest" sample was hand-formatted** and not in
  a shape `digest.py` can emit. It has been replaced with measured figures. This
  was the plugin's own fabrication failure mode, committed in its own README.

## This Plugin's Own Synthesis

Not sourced from anywhere in particular; assembled here because no one place holds it:

- **The three-failure frame** — evaporation, deflation, fabrication — as the organizing structure, and the observation that they occur at three different times and therefore need three different mechanisms. Evans covers deflation and, implicitly, evaporation. Fabrication is not a failure mode she had to consider, because a human writing their own brag document does not invent metrics to fill gaps.
- **Fabrication as the model-specific failure.** The `source` field on every metric and the `confidence` field on every entry exist to make invention structurally difficult rather than merely discouraged. This mirrors the never-invent gates in this marketplace's `editing` plugin and rests on the same observation: asked to make something concrete, a model supplies the missing specific, because doing so is cheaper than finding it and produces better prose.
- **Retention as the design constraint.** The argument that capture must be automatic *because the evidence is actively being deleted on a 30-day timer* is specific to working inside Claude Code, and does not appear in any career-advice source, none of which contemplated a tool that erases its own record of your reasoning.
- **The evidence table** — what each source proves and what it cannot. The specific claim that reviews given are the most under-claimed and most easily counted evidence in engineering reviews is an observation, not a citation.
- **The interview question ordering** in `interviewing.md`, and the phrasing of question 4 ("is there a number" rather than "what was the number") as an anti-fabrication device.

## Known Gaps

- **No company's actual framework is encoded.** The ladder is a generic default. Where a real one exists, the plugin should be pointed at it; a review mapped to the wrong ladder is worse than one mapped to none.
- **Non-GitHub forges are unsupported in the mining commands.** GitLab, Bitbucket, and Azure DevOps have equivalents that are not written down here. Git-level commands work everywhere.
- **No issue-tracker integration is shipped.** JIRA and Linear go through whatever MCP server or CLI the user has, or through pasted text. The plugin deliberately does not guess at ticket contents.
- **Redaction is two imperfect passes.** Regex catches formats; Haiku catches prose. Neither is a guarantee, and a secret phrased unusually enough to defeat both will survive into a digest. `<journal>/exclude` is the only hard answer, and it works by not reading the project at all.
- **The digest cannot show what was tried and abandoned.** That reasoning lived in the assistant's replies and tool calls, which are discarded. Recovering it requires a sweep inside the 30-day window, where a model reads the still-live transcript and writes prose about it.
- **An earlier version of this plugin archived complete transcripts.** It was replaced because the measurements above showed the career signal is 7.8% of the bytes and the credential exposure is mostly in the other 92%. The reasoning for the original choice — that scrubbing corrupts evidence — was sound only while the whole transcript was treated as the evidence.
- **Nothing here is validated against actual promotion outcomes.** The guidance reflects published advice from practitioners and a coherent theory of what reviewers need. No claim is made that following it changes review results.
