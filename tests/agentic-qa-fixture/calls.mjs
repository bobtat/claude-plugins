// One line per API call for one agent: the context that call read, what it added, and the tools it called with
// the size of each result. Shows which turns an agent could have done without. usage: calls.mjs <run dir> <agent substring>
import fs from 'node:fs'; import path from 'node:path';
const [W, who] = process.argv.slice(2);
const sid = JSON.parse(fs.readFileSync(path.join(W, 'result.json'), 'utf8')).session_id;
const root = path.join(process.env.HOME, '.claude/projects');
const proj = fs.readdirSync(root).map(d => path.join(root, d)).find(d => fs.existsSync(path.join(d, sid + '.jsonl')));
const dir = path.join(proj, sid, 'subagents');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'))) {
  if (!fs.readFileSync(path.join(dir, f.replace('.jsonl', '.meta.json')), 'utf8').includes(who)) continue;
  const calls = new Map(); const size = {};
  for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean)) {
    const e = JSON.parse(l); const m = e.message; if (!m) continue;
    if (e.type === 'assistant' && m.usage) {
      const call = calls.get(m.id) ?? {tools: []};
      for (const c of m.content ?? []) if (c.type === 'tool_use') call.tools.push([c.id, c.name.replace('mcp__plugin_agentic-qa_playwright__', 'pw:'), JSON.stringify(c.input).slice(0, 90)]);
      call.u = m.usage; calls.set(m.id, call);   // the last entry for a message id carries its final usage
    }
    if (e.type === 'user' && Array.isArray(m.content)) for (const c of m.content) if (c.type === 'tool_result') {
      size[c.tool_use_id] = typeof c.content === 'string' ? c.content.length : JSON.stringify(c.content ?? '').length;
    }
  }
  let n = 0, read = 0;
  for (const {u, tools} of calls.values()) {
    const ctx = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
    read += ctx;
    console.log(`${String(++n).padStart(3)}  context ${String(ctx).padStart(6)}  new ${String(u.cache_creation_input_tokens ?? 0).padStart(6)}  out ${String(u.output_tokens ?? 0).padStart(5)}  ` + (tools.map(t => `${t[1]} (${size[t[0]] ?? '?'} chars back) ${t[2]}`).join('\n' + ' '.repeat(49)) || '(no tool call)'));
  }
  console.log(`${n} calls, ${read} input tokens in all`);
}
