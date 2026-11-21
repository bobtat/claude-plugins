#!/bin/sh
# Same run directory as make-run.sh, with the plan reordered so the first page the executor sees is the large orders list.
set -e
"$(dirname "$0")/make-run.sh" "$1"
python3 - "$1/step-plan.md" <<'PY'
import re, sys
p = sys.argv[1]; s = open(p).read()
order = ['S7', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6']            # old ids, in their new order
new = {old: f'S{i+1}' for i, old in enumerate(order)}
ren = lambda t: re.sub(r'\bS([1-7])\b', lambda m: '@' + new['S' + m.group(1)][1:] + '@', t)
head, rest = s.split('## Traceability\n', 1)
table, rest = rest.split('\n## Step detail\n', 1)
detail, tail = rest.split('\n## Out of scope', 1)
rows = table.strip().split('\n'); hdr, rows = rows[:2], rows[2:]
rowby = {r.split('|')[1].strip(): r for r in rows}
blocks = {b.split(' ', 1)[0]: '### ' + b.strip() for b in detail.split('### ')[1:]}
out = head + '## Traceability\n' + '\n'.join(hdr + [ren(rowby[o]) for o in order]) + '\n\n## Step detail\n' + '\n\n'.join(ren(blocks[o]) for o in order) + '\n\n## Out of scope' + tail
open(p, 'w').write(re.sub(r'@(\d)@', r'S\1', out))
PY
