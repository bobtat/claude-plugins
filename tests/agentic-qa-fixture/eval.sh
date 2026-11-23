#!/bin/sh
# Runs the plugin as it stands several times against the three fixtures and says how often each
# check held and what the runs cost. One run is an anecdote: this is what to compare a
# change against, before and after.
#
# Every run is a whole unattended walkthrough and spends real tokens: about $0.80 for the
# orders fixture and $1.10 for the team one at 0.19.0, so five of each is about $10. The
# three fixtures use different ports and run side by side, one run of each at a time.
# LANES=2 runs two of each at a time, on a second set of ports, and takes about half as long.
#
# usage: eval.sh <label> [runs of each fixture, default 5]
#   MODEL, FIXTURE_WORK, PW_FLAGS, CHROMIUM   as for run.sh
#   LANES   how many runs of each fixture go at once (default 1)
# Agents must be able to spawn agents: set CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=2 where it is 1.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
LABEL="$1"; N="${2:-5}"
[ -n "$LABEL" ] || { echo "usage: eval.sh <label> [runs]" >&2; exit 2; }
WORK="${FIXTURE_WORK:-${TMPDIR:-/tmp}/agentic-qa-fixture}"
mkdir -p "$WORK"

LANES="${LANES:-1}"
lane() {
  # $1 is the script, $2 the letter that marks its runs, $3 the folder they go in, $4 which lane this is.
  # Lane k takes runs k, k+LANES, k+2*LANES and so on, on ports 100*(k-1) above the fixture's own.
  # A run that fails is still scored.
  off=$((($4 - 1) * 100)); i="$4"
  while [ "$i" -le "$N" ]; do
    ORDERS_PORT=$((8765 + off)) TEAM_PORT=$((8770 + off)) TEAM_RELAY_PORT=$((8771 + off)) VAGUE_PORT=$((8780 + off)) \
      "$1" "$LABEL-$2$i" > "$WORK/eval-$LABEL-$2$i.log" 2>&1 || true
    echo "finished $LABEL-$2$i"
    # A run the API stopped, at a usage limit for one, tested nothing, and the next would be stopped too.
    if grep -q '"is_error":true' "$WORK/$3/$LABEL-$2$i/result.json" 2>/dev/null; then
      echo "stopping lane $4 of the $3 runs: $LABEL-$2$i ended in an API error"
      break
    fi
    i=$((i + LANES))
  done
}
k=1
while [ "$k" -le "$LANES" ]; do
  lane "$HERE/run-unattended.sh" o unattended "$k" &
  lane "$HERE/team/run.sh" t team "$k" &
  lane "$HERE/vague/run.sh" v vague "$k" &
  k=$((k + 1))
done
wait

orders=""; team=""; vague=""; i=1
while [ "$i" -le "$N" ]; do
  orders="$orders $WORK/unattended/$LABEL-o$i"
  team="$team $WORK/team/$LABEL-t$i"
  vague="$vague $WORK/vague/$LABEL-v$i"
  i=$((i + 1))
done
echo
# shellcheck disable=SC2086
node "$HERE/tabulate.mjs" orders $orders
echo
# shellcheck disable=SC2086
node "$HERE/tabulate.mjs" team $team
echo
# shellcheck disable=SC2086
node "$HERE/tabulate.mjs" vague $vague
