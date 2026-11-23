#!/bin/sh
# Runs the plugin as it stands several times against both fixtures and says how often each
# check held and what the runs cost. One run is an anecdote: this is what to compare a
# change against, before and after.
#
# Every run is a whole unattended walkthrough and spends real tokens: about $0.80 for the
# orders fixture and $1.10 for the team one at 0.19.0, so five of each is about $10. The
# two fixtures use different ports and run side by side, one run of each at a time.
#
# usage: eval.sh <label> [runs of each fixture, default 5]
#   MODEL, FIXTURE_WORK, PW_FLAGS, CHROMIUM   as for run.sh
# Agents must be able to spawn agents: set CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=2 where it is 1.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
LABEL="$1"; N="${2:-5}"
[ -n "$LABEL" ] || { echo "usage: eval.sh <label> [runs]" >&2; exit 2; }
WORK="${FIXTURE_WORK:-${TMPDIR:-/tmp}/agentic-qa-fixture}"
mkdir -p "$WORK"

lane() {
  # $1 is the script, $2 the letter that marks its runs, $3 the folder they go in. A run that fails is still scored.
  i=1
  while [ "$i" -le "$N" ]; do
    "$1" "$LABEL-$2$i" > "$WORK/eval-$LABEL-$2$i.log" 2>&1 || true
    echo "finished $LABEL-$2$i"
    # A run the API stopped, at a usage limit for one, tested nothing, and the next would be stopped too.
    if grep -q '"is_error":true' "$WORK/$3/$LABEL-$2$i/result.json" 2>/dev/null; then
      echo "stopping the $3 runs: $LABEL-$2$i ended in an API error"
      break
    fi
    i=$((i + 1))
  done
}
lane "$HERE/run-unattended.sh" o unattended &
lane "$HERE/team/run.sh" t team &
wait

orders=""; team=""; i=1
while [ "$i" -le "$N" ]; do
  orders="$orders $WORK/unattended/$LABEL-o$i"
  team="$team $WORK/team/$LABEL-t$i"
  i=$((i + 1))
done
echo
# shellcheck disable=SC2086
node "$HERE/tabulate.mjs" orders $orders
echo
# shellcheck disable=SC2086
node "$HERE/tabulate.mjs" team $team
