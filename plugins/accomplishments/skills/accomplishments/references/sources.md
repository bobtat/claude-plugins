# Sources, Measurements, and Known Gaps

## Where the Ideas Come From

**The brag document** — Julia Evans, *[Get your work recognized: write a brag document](https://jvns.ca/blog/brag-documents/)* (2019). The origin of the practice this plugin automates. Her core arguments are load-bearing here: that nobody else is tracking your work, that memory is heavily weighted toward the last few weeks of a review period, and that the document should be written continuously rather than assembled under deadline. The journal format and the working rhythm in `SKILL.md` are a mechanized version of her recommendation.

**Glue work** — Tanya Reilly, *[Being Glue](https://noidea.dog/glue)* (2019). The source of the team-tier argument in `impact.md`: that the work holding a team together — unblocking people, writing the doc, running the process — is invisible to systems that track tickets and commits, and therefore has to be recorded deliberately or not at all. This is why the mining commands are explicitly framed as insufficient on their own.

**Operating at the next level** — Tanya Reilly, *The Staff Engineer's Path* (O'Reilly, 2022), and Will Larson, *Staff Engineer: Leadership Beyond the Management Track* (2021; material also at [staffeng.com](https://staffeng.com)). The promotion-packet guidance in `formats.md` follows both on one specific point: promotion committees recognize demonstrated current behavior at the target level, sustained over time, rather than betting on potential. The "multiple instances across time" requirement comes from there.

**Scope and consequence over effort** — a common thread in published engineering career ladders and in Gergely Orosz, *The Software Engineer's Guidebook* (2023). The impact ladder in `impact.md` is not any single company's framework; it is the common shape most of them share. Any organization with its own ladder should override it — the ladder here is a default for people who have none, not a claim about how a particular company levels.

**STAR** — Situation, Task, Action, Result. Standard in behavioral interviewing since the 1970s; no single canonical citation, and the plugin does not follow it strictly. The journal entry format keeps its useful skeleton (context, action, result) and adds the parts STAR omits, which are the parts that matter for a review: who was affected, what the counterfactual was, and where each number came from.

**Claude Code mechanics** — the [hooks reference](https://code.claude.com/docs/en/hooks) for the `SessionEnd` event contract, and the `cleanupPeriodDays` setting for transcript retention. Both were checked against the running version rather than assumed.

## Measurements Taken for This Plugin

These are this repository's own numbers, measured on one developer's machine in August 2026. They are not published figures, and they will differ for other people and other usage patterns.

- **Transcript retention is real and is 30 days.** The oldest transcript on disk was exactly 30 days old, with no `cleanupPeriodDays` override in any settings file. This is the fact the entire capture design rests on — it was verified, not assumed.
- **Transcript content breaks down as: 40.1% session metadata, 44.4% tool traffic (results plus inputs), 7.8% user prompts, 4.7% assistant replies.** Measured across 114 session transcripts holding 22.3 MB of content. This is the measurement that decided what the hook keeps.
- **Credential-shaped strings cluster in tool traffic.** 120 matches across nine patterns: 92 in tool results and inputs, 28 in user prompts, 4 in assistant replies. Some are certainly false positives (`password =` in documentation and sample code), so treat it as an upper bound on prevalence and a reliable signal about *distribution*.
- **Keeping only redacted prompts is a 564x reduction.** 65.4 MB of transcripts over 30 days becomes 0.12 MB of digests — about 1 MB per year against roughly 260 MB for gzipped full transcripts.
- **gzip compresses these transcripts 2.9x, not the ~10x plain text suggests.** Measured across all of them. Recorded because it was the basis of the abandoned full-transcript design, and because the intuition it corrects is a common one.
- **A Haiku call through `claude -p` takes about 6-8 seconds.** Far past the ~1.5 second `SessionEnd` budget, which is why stage 2 is detached rather than synchronous.
- **The first timestamped record in a transcript is around line 16.** The opening records are session metadata carrying no timestamp, which is why the hook scans rather than reading the first line.
- **Subagent transcripts exist separately**, under `<session-id>/subagents/`, and are not passed to the hook. They are never captured.

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
