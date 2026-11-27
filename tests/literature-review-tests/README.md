# literature-review checks

Checks for `plugins/literature-review`. Run them after any change to the plugin:

```
python tests/literature-review-tests/run.py
python tests/literature-review-tests/run.py -v     # print every check, not just failures
```

Any Python 3, standard library only, no network. It exits 1 if anything fails.

They live outside `plugins/literature-review/` because everything in the plugin folder is
copied to users when they install it.

## What it checks

- **The eight scripts, against their fixtures.** The expected numbers are written in
  `run.py`: twelve quotations with nine verified, κ of 0.533 and 0.769, exclusion reasons
  rendered from the protocol, five reports of four studies, an overall rating derived
  as the worst domain, two judges merged at κ 0.75 with one rating adjudicated, twelve numbers with nine traced. A script whose output drifts
  fails here before it reaches a review.
- **The inputs the scripts must refuse.** A record ID with a dot in it, an appraisal that
  names no records, an exclusion that cites an inclusion code, a doubt that names no
  criterion, a coded value outside its list, a rating off the scale, an overall rating a
  judge wrote, a judgment with no eligibility line, an adjudicated rating off the scale, a flow whose arithmetic does not close, two figure labels that run into each
  other. These failures are quiet when they regress: the script still runs and prints
  believable numbers.
- **The repository's rules for a plugin.** `version` and `description` agree between
  `marketplace.json` and `plugin.json`; every `literature-review:<name>` reference
  resolves to a skill, agent or command; no skill or agent is named bare in backticks;
  no command `!` block contains shell expansion; frontmatter has the required keys.

## What it does not check

Whether the pipeline produces a good review. That takes a real run, which costs money:
the one full run cost $86.67. `plugins/literature-review/README.md` says what that run
did and did not exercise.

A new fixture case gets a line here in `run.py`. An expected number changes only when
the fixture does.
