// Sums token usage per agent from a headless run's transcripts.
// usage: analyze.mjs <run dir>   (reads result.json for the session id)
import fs from 'node:fs';
import path from 'node:path';
const W = process.argv[2];
const result = JSON.parse(fs.readFileSync(path.join(W, 'result.json'), 'utf8'));
const proj = fs.readdirSync(path.join(process.env.HOME, '.claude/projects')).map(d => path.join(process.env.HOME, '.claude/projects', d)).find(d => fs.existsSync(path.join(d, result.session_id + '.jsonl')));
const files = [[`orchestrator`, path.join(proj, result.session_id + '.jsonl')]];
const sub = path.join(proj, result.session_id, 'subagents');
if (fs.existsSync(sub)) for (const f of fs.readdirSync(sub).filter(f => f.endsWith('.jsonl'))) {
  let type = f;
  try { type = JSON.parse(fs.readFileSync(path.join(sub, f.replace('.jsonl', '.meta.json')), 'utf8')).agentType ?? f; } catch {}
  files.push([type.replace('agentic-qa:', ''), path.join(sub, f)]);
}
const rows = []; const detail = {};
for (const [name, file] of files) {
  const seen = new Map(); const tools = {}; const results = {};
  const idToTool = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    const m = e.message;
    if (e.type === 'assistant' && m?.usage) {
      seen.set(m.id, {u: m.usage, model: m.model});   // last entry for a message id wins
      for (const c of m.content ?? []) if (c.type === 'tool_use') { idToTool[c.id] = c.name; }
    }
    if (e.type === 'user' && Array.isArray(m?.content)) for (const c of m.content) if (c.type === 'tool_result') {
      const t = (idToTool[c.tool_use_id] ?? '?').replace('mcp__plugin_agentic-qa_playwright__', 'pw:');
      const size = typeof c.content === 'string' ? c.content.length : JSON.stringify(c.content ?? '').length;
      results[t] ??= {n: 0, chars: 0}; results[t].n++; results[t].chars += size;
    }
  }
  const calls = [...seen.values()];
  const s = k => calls.reduce((n, c) => n + (c.u[k] ?? 0), 0);
  const ctx = calls.map(c => (c.u.input_tokens ?? 0) + (c.u.cache_read_input_tokens ?? 0) + (c.u.cache_creation_input_tokens ?? 0));
  rows.push({agent: name, model: (calls[0]?.model ?? '').replace('claude-', ''), apiCalls: calls.length, input: s('input_tokens'), cacheWrite: s('cache_creation_input_tokens'), cacheRead: s('cache_read_input_tokens'), output: s('output_tokens'), lastCtx: ctx.at(-1) ?? 0, maxCtx: Math.max(0, ...ctx)});
  detail[name] = results;
}
console.table(rows);
const tot = k => rows.reduce((n, r) => n + r[k], 0);
console.log(`TOTAL  apiCalls ${tot('apiCalls')}  input ${tot('input')}  cacheWrite ${tot('cacheWrite')}  cacheRead ${tot('cacheRead')}  output ${tot('output')}`);
console.log(`result.json: total_cost_usd ${result.total_cost_usd}  duration_ms ${result.duration_ms}  num_turns ${result.num_turns}`);
for (const [k, v] of Object.entries(result.modelUsage ?? {})) console.log(`  ${k}: in ${v.inputTokens} out ${v.outputTokens} cacheRead ${v.cacheReadInputTokens} cacheWrite ${v.cacheCreationInputTokens} cost ${v.costUSD}`);
for (const a of ['step-executor', 'qa-reporter']) if (detail[a]) { console.log(`\n${a}: tool results (count, total chars)`); console.table(Object.fromEntries(Object.entries(detail[a]).sort((x, y) => y[1].chars - x[1].chars))); }
