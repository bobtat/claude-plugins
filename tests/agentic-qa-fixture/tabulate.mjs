// Scores several runs of one fixture and says how often each check held, and what they cost.
// usage: tabulate.mjs <orders|team> <run output dir>...
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const [fixture, ...outs] = process.argv.slice(2);
if (!['orders', 'team'].includes(fixture) || !outs.length) {
  console.error('usage: tabulate.mjs <orders|team> <run output dir>...');
  process.exit(2);
}
const scorer = fileURLToPath(new URL(fixture === 'team' ? './team/score.mjs' : './score.mjs', import.meta.url));
const runs = outs.map(out => {
  const res = spawnSync(process.execPath, [scorer, '--json', out], {encoding: 'utf8'});
  try {
    return JSON.parse(res.stdout);
  } catch {
    return {out, cost: NaN, held: 0, of: 0, checks: [{kind: 'CHECK', name: 'the run could be scored', ok: false, detail: (res.stderr || res.stdout).slice(0, 120)}]};
  }
});

const names = [...new Set(runs.flatMap(run => run.checks.filter(c => c.ok !== null).map(c => c.name)))];
const label = name => name + (runs.some(run => run.checks.some(c => c.name === name && c.kind === 'CANARY')) ? ' [canary]' : '');
const width = Math.max(...names.map(name => label(name).length));
console.log(`${fixture} fixture, ${runs.length} runs\n`);
console.log(`${'check'.padEnd(width)}  held  in which runs it did not`);
for (const name of names) {
  const each = runs.map(run => run.checks.find(c => c.name === name));
  const held = each.filter(c => c?.ok).length;
  const missed = each.map((c, i) => (c?.ok ? null : `${i + 1}${c ? ` (${String(c.detail).slice(0, 44)})` : ' (not scored)'}`)).filter(Boolean).join('; ');
  console.log(`${label(name).padEnd(width)}  ${held}/${runs.length}   ${missed}`);
}
const costs = runs.map(run => run.cost).filter(Number.isFinite);
const total = costs.reduce((a, b) => a + b, 0);
console.log(`\nper run: ${runs.map((run, i) => `${i + 1}: ${run.held}/${run.of}`).join('   ')}`);
console.log(`runs with every check held: ${runs.filter(run => run.of && run.held === run.of).length} of ${runs.length}`);
if (costs.length) console.log(`cost: $${Math.min(...costs).toFixed(2)} to $${Math.max(...costs).toFixed(2)}, mean $${(total / costs.length).toFixed(2)}, total $${total.toFixed(2)}`);
