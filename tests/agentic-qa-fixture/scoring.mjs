// What the two fixtures' scorers share: finding a run's working directory, reading the
// report's Traceability table, and placing each row against a criterion of the ticket.
// No model is involved. A scorer reads files a run left and says which checks hold.
import fs from 'node:fs';
import path from 'node:path';

export const read = file => { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } };

function result(out) {
  try { return JSON.parse(read(path.join(out, 'result.json'))); } catch { return {}; }
}

export const cost = out => Number(result(out).total_cost_usd ?? NaN);

// A run the API stopped, such as at a usage limit, did not test the plugin. Nor did one
// whose session ended and stopped its agents while they were still working. Either is
// said to have not run and is left out of every count, never scored as a failure.
export function stopped(out) {
  const r = result(out);
  if (!('result' in r)) return 'no result was written';
  if (r.is_error) return String(r.result ?? 'the session ended in an error').slice(0, 120);
  const cut = /Background tasks still running .*?stopping them/.exec(read(path.join(out, 'stderr.txt')));
  return cut ? `the session ended first: ${cut[0].slice(0, 100)}` : null;
}

// Every transcript of the run's session: the caller's and each agent's.
export function sessionFiles(out) {
  try {
    const root = path.join(process.env.HOME ?? '', '.claude', 'projects');
    const sid = result(out).session_id;
    if (!sid) return [];
    for (const project of fs.readdirSync(root)) {
      const file = path.join(root, project, `${sid}.jsonl`);
      if (!fs.existsSync(file)) continue;
      const sub = path.join(root, project, sid, 'subagents');
      return [file, ...(fs.existsSync(sub) ? fs.readdirSync(sub).filter(f => f.endsWith('.jsonl')).map(f => path.join(sub, f)) : [])];
    }
  } catch { /* no transcripts */ }
  return [];
}

// The working directory is named in the caller's reply, and failing that in a transcript.
export function findWorkingDirectory(out, given) {
  if (given) return given;
  const pattern = /(\/[^\s`'"*\\]*walkthrough-[A-Za-z0-9-]+)/g;
  const isRun = dir => fs.existsSync(path.join(dir, 'intake.md'));
  for (const m of String(result(out).result ?? '').matchAll(pattern)) if (isRun(m[1])) return m[1];
  for (const file of sessionFiles(out)) for (const m of read(file).matchAll(pattern)) if (isRun(m[1])) return m[1];
  return null;
}

export const kindOf = verdict => /✅|\bpass/i.test(verdict) ? 'pass' : /❌|\bfail/i.test(verdict) ? 'fail' : /observed|👁/i.test(verdict) ? 'observed'
  : /not verified|❔|declin/i.test(verdict) ? 'not verified' : /blocked|⏳/i.test(verdict) ? 'blocked' : /skipped|⏭/i.test(verdict) ? 'skipped' : /paus|pending|⏸/i.test(verdict) ? 'paused' : 'other';

// Traceability rows: | S1 | B1, B2 — text | verdict |. Only that table: the report has
// others whose rows start with a step, and a question in one is not a verdict.
export function traceRows(report) {
  const table = (/^## Traceability[\s\S]*?(?=^## )/m.exec(report) ?? [report])[0];
  return [...table.matchAll(/^\|\s*(S\d+)\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*$/gm)].map(m => {
    const behavior = m[2].trim();
    // A run may split a behavior: B5a and B5b are both B5.
    const ids = ((/^[^—–-]*/.exec(behavior)?.[0] ?? '').match(/\b[AB]\d+[a-z]?\b/g) ?? []).map(id => id.replace(/[a-z]$/, ''));
    return {step: m[1], behavior, ids, verdict: m[3].trim(), kind: kindOf(m[3])};
  });
}

// Which criterion each behavior of the spec comes from, by the words of the ticket it is
// anchored to. An extractor quotes the criterion in every behavior, so this does not
// depend on how it numbered or named them. Criteria are tried in the order given: put
// the ones whose words could be found inside another's first.
export function anchorMap(spec, criteria) {
  const map = new Map();
  for (const block of spec.split(/^(?=###\s+[AB]\d+\b)/m)) {
    const id = /^###\s+([AB]\d+)\b/.exec(block)?.[1];
    if (!id) continue;
    const body = block.split(/^##\s/m)[0];
    const anchor = /\*{0,2}Anchor:?\*{0,2}:?\s*(.*)/i.exec(body)?.[1] ?? '';
    const hit = criteria.find(c => c.anchor.test(anchor)) ?? criteria.find(c => c.anchor.test(body));
    if (hit) map.set(id, hit.name);
  }
  return map;
}

// Rows from the acceptance criteria, grouped by criterion. A row is placed by the
// behaviors it names. One whose behaviors the spec does not anchor is placed by its own
// words, and one that fits nothing is returned as unplaced: it is never guessed at.
export function placeRows(rows, map, criteria) {
  const byCriterion = Object.fromEntries(criteria.map(c => [c.name, []]));
  const unplaced = [];
  for (const row of rows) {
    const fromCriteria = row.ids.filter(id => id.startsWith('B'));
    if (!fromCriteria.length) continue;
    const names = new Set(fromCriteria.map(id => map.get(id)).filter(Boolean));
    if (!names.size) {
      const hit = criteria.find(c => c.words?.test(row.behavior));
      if (hit) names.add(hit.name);
    }
    if (!names.size) unplaced.push(row);
    for (const name of names) byCriterion[name].push(row);
  }
  return {byCriterion, unplaced};
}

export const show = list => list.map(row => `${row.step} ${row.kind}`).join(', ') || 'no step';
// A criterion has a verdict when a step for it got that verdict and none failed or went
// unjudged. A step that observed a case beside it, or is blocked on a question about
// one, does not count against it: the criterion as written was still judged.
export const holds = (list, kind) => list.some(row => row.kind === kind) && list.every(row => row.kind === kind || row.kind === 'observed' || row.kind === 'blocked');

// Prints the checks, or with --json returns them for the tabulator. A check with ok
// null is information for a person and is not scored.
export function finish({fixture, out, dir, rows}) {
  const scored = rows.filter(r => r.ok !== null);
  const failed = scored.filter(r => !r.ok);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({fixture, out, dir, cost: cost(out), held: scored.length - failed.length, of: scored.length, checks: rows}));
  } else {
    const width = Math.max(...rows.map(r => r.name.length));
    for (const r of rows) console.log(`${r.ok === null ? 'INFO  ' : r.ok ? 'ok    ' : 'FAILED'}  ${r.kind.padEnd(6)}  ${r.name.padEnd(width)}  ${r.detail}`);
    console.log(`\n${scored.length - failed.length} of ${scored.length} checks hold${failed.some(r => r.kind === 'CANARY') ? ' — A CANARY WAS TRIPPED' : ''}${dir ? `\nworking directory: ${dir}` : ''}`);
  }
  process.exit(failed.length ? 1 : 0);
}
