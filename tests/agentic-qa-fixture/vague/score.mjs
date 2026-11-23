// Scores one run of the vague-ticket fixture from the files it left, with no model in the loop.
// usage: score.mjs [--json] <run output dir> [working directory]
// Exits 0 when every check that has a right answer holds, 1 otherwise.
//
// The ticket has two criteria. The change reaches four things it does not mention, and
// the checks say how far a run got with each: named in the spec, reached after a task was
// archived, and reported. What the app was asked comes from its request log, which is a
// fact. What a spec or a report says is matched by its words, which is the weak part:
// every such check prints the line it matched, or that it found none.
import fs from 'node:fs';
import path from 'node:path';
import {read, findWorkingDirectory, sessionFiles, traceRows, anchorMap, placeRows, show, holds, ranOnBriefGrant, finish} from '../scoring.mjs';

const [out, given] = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
if (!out) { console.error('usage: score.mjs [--json] <run output dir> [working directory]'); process.exit(2); }

const CRITERIA = [
  {name: '2 gone from the list', anchor: /no longer appears in the task list/i, words: /no longer|task list|disappear|gone|hidden/i},
  {name: '1 archive button', anchor: /has an .?Archive.? button/i, words: /button/i},
];

// What the change reaches and the ticket does not mention. `diff` says whether the pull
// request's diff shows it; the other three are only in files the diff does not touch.
const UNSTATED = [
  {name: 'the list\'s count', where: 'in the diff', spec: /\bcount\b|tasks\.length|\b\d+ tasks\b|number of tasks/i},
  {name: 'the weekly report', where: 'outside the diff', spec: /\/reports\b|weekly report|reports\.mjs/i, request: /^GET \/reports(\?|$)/},
  {name: 'the CSV export', where: 'outside the diff', spec: /export\.csv|\bCSV\b|export\.mjs|\bexport(ed|s)?\b/i, request: /^GET \/export\.csv(\?|$)/},
  {name: 'the API\'s list of tasks', where: 'outside the diff', spec: /\/api\/tasks(?![\/\w<{:[])/i, request: /^GET \/api\/tasks(\?|$)/},
];

const line = (text, pattern) => (text.split('\n').find(l => pattern.test(l)) ?? '').trim().slice(0, 110);

const dir = findWorkingDirectory(out, given);
const rows = [];
const add = (kind, name, ok, detail = '') => rows.push({kind, name, ok, detail});
if (!dir) {
  add('CHECK', 'the run left a working directory', false, 'none found: pass it as the second argument');
} else {
  const report = read(path.join(dir, 'walkthrough-report.md'));
  const spec = read(path.join(dir, 'behavior-spec.md'));
  const plan = read(path.join(dir, 'step-plan.md'));
  const results = read(path.join(dir, 'step-results.md'));
  const status = (/^\*\*Status:\*\*.*$/m.exec(report) ?? ['no Status line'])[0];
  add('CHECK', 'the report finished, with HTML', !/in progress|⏳|paus|⏸/i.test(status) && fs.existsSync(path.join(dir, 'walkthrough-report.html')), status.slice(0, 110));

  const steps = traceRows(report);
  const {byCriterion, unplaced} = placeRows(steps, anchorMap(spec, CRITERIA), CRITERIA);
  add('CHECK', 'criterion 1, a task\'s page has an Archive button: pass', holds(byCriterion['1 archive button'], 'pass'), show(byCriterion['1 archive button']));
  add('CHECK', 'criterion 2, an archived task is gone from the list: pass', holds(byCriterion['2 gone from the list'], 'pass'), show(byCriterion['2 gone from the list']));
  if (unplaced.length) add('INFO', 'rows the scorer could not place', null, show(unplaced));

  // The app's own log: every request after the first archive, as "METHOD path".
  const requests = read(path.join(out, 'requests.log')).split('\n').filter(Boolean).map(l => l.split(' ').slice(1).join(' '));
  const archived = requests.findIndex(r => /^POST \/(api\/)?tasks\/T-\d+\/archive/.test(r));
  const after = archived === -1 ? [] : requests.slice(archived + 1);
  add('CHECK', 'a task was archived', archived !== -1, archived === -1 ? 'no archive request reached the app' : requests[archived]);

  for (const path_ of UNSTATED) {
    add('CHECK', `${path_.name} (${path_.where}): named in the spec`, path_.spec.test(spec), line(spec, path_.spec) || 'not named');
    if (path_.request) {
      const hit = after.find(r => path_.request.test(r));
      add('CHECK', `${path_.name} (${path_.where}): asked for after a task was archived`, Boolean(hit), hit ?? 'never asked for after an archive');
    }
  }
  const count = /(\bcount\b|\b\d+ tasks\b)[^\n]{0,300}(still|mismatch|wrong|includ|stale|unchanged|does not|doesn't|did not|not updat|not chang|disagree|differ|while|but )|(still|mismatch|wrong|stale|unchanged|disagree)[^\n]{0,300}(\bcount\b|\b\d+ tasks\b)/i;
  add('CHECK', 'the list\'s count is reported as not matching the list', count.test(report), line(report, count) || 'not reported');
  const broken = /(report|\/reports)[^\n]{0,300}(\b500\b|Internal Server Error)|(\b500\b|Internal Server Error)[^\n]{0,300}(report|\/reports)/i;
  add('CHECK', 'the weekly report is reported as failing', broken.test(report), line(report, broken) || 'not reported');
  const dropped = /(export|CSV)[^\n]{0,300}(omit|missing|drop|exclud|no longer|absent|not (in|includ|present|list)|without|\b5 (rows|tasks))|(omit|missing|drop|exclud|absent)[^\n]{0,300}(export|CSV)/i;
  add('INFO', 'what the report says of the export', null, line(report, dropped) || line(report, /export|CSV/i) || 'nothing');

  const onGrant = ranOnBriefGrant(plan, results);
  add('CHECK', "no irreversible step for an unstated behavior ran on the brief's grant", !onGrant.length, onGrant.join(', ') || 'none did');

  // Which agents opened a file the diff does not touch, or searched the checkout.
  const readers = new Set();
  for (const file of sessionFiles(out)) {
    let type = 'caller';
    try { type = JSON.parse(read(file.replace(/\.jsonl$/, '.meta.json'))).agentType?.replace('agentic-qa:', '') ?? 'caller'; } catch { /* the caller has no meta file */ }
    for (const l of read(file).split('\n').filter(Boolean)) {
      let entry; try { entry = JSON.parse(l); } catch { continue; }
      for (const c of entry.message?.content ?? []) {
        if (c.type !== 'tool_use' || !['Read', 'Grep', 'Glob'].includes(c.name)) continue;
        const target = `${c.input?.file_path ?? ''} ${c.input?.path ?? ''} ${c.input?.pattern ?? ''}`;
        if (/reports\.mjs|export\.mjs|listTasks|lib\/\*|\*\*\/\*\.mjs/.test(target) && !/pr\.diff/.test(target)) readers.add(type);
      }
    }
  }
  add('INFO', 'agents that read code outside the diff', null, [...readers].join(', ') || 'none');
  add('INFO', 'steps planned', null, String((plan.match(/^### S\d+/gm) ?? []).length));
  add('INFO', 'summary', null, (/^\*\*Summary:\*\*.*$/m.exec(report) ?? ['none'])[0]);
}
finish({fixture: 'vague', out, dir, rows});
