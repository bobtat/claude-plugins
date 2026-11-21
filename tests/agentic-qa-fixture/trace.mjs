// Prints one agent's tool calls and results from a run. usage: trace.mjs <run dir> <agent substring> [width]
import fs from 'node:fs'; import path from 'node:path';
const [W, who, width = 260] = process.argv.slice(2);
const sid = JSON.parse(fs.readFileSync(path.join(W, 'result.json'), 'utf8')).session_id;
const root = path.join(process.env.HOME, '.claude/projects');
const proj = fs.readdirSync(root).map(d => path.join(root, d)).find(d => fs.existsSync(path.join(d, sid + '.jsonl')));
const dir = path.join(proj, sid, 'subagents');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'))) {
  const meta = fs.readFileSync(path.join(dir, f.replace('.jsonl', '.meta.json')), 'utf8');
  if (!meta.includes(who)) continue;
  let last = null;
  for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean)) {
    const e = JSON.parse(l); const m = e.message; if (!m || !Array.isArray(m.content)) continue;
    for (const c of m.content) {
      if (c.type === 'tool_use') { console.log(`${m.id === last ? '  +' : '>>'} ${c.name.replace('mcp__plugin_agentic-qa_playwright__', 'pw:')} ${JSON.stringify(c.input).slice(0, width)}`); last = m.id; }
      if (c.type === 'tool_result') console.log('     = ' + (typeof c.content === 'string' ? c.content : JSON.stringify(c.content)).slice(0, width).replace(/\n/g, ' '));
      if (c.type === 'text' && e.type === 'assistant' && c.text.trim()) console.log('   TEXT ' + c.text.slice(0, width * 2).replace(/\n/g, ' '));
    }
  }
}
