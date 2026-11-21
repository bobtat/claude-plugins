// Per-turn usage for one subagent: what woke it, API calls, tokens. usage: turns.mjs <run dir> <agent substring>
import fs from 'node:fs'; import path from 'node:path';
const [W, who] = process.argv.slice(2);
const sid = JSON.parse(fs.readFileSync(path.join(W, 'result.json'), 'utf8')).session_id;
const root = path.join(process.env.HOME, '.claude/projects');
const proj = fs.readdirSync(root).map(d => path.join(root, d)).find(d => fs.existsSync(path.join(d, sid + '.jsonl')));
const dir = path.join(proj, sid, 'subagents');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'))) {
  if (!fs.readFileSync(path.join(dir, f.replace('.jsonl', '.meta.json')), 'utf8').includes(who)) continue;
  const turns = []; const seen = new Set();
  for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean)) {
    const e = JSON.parse(l); const m = e.message; if (!m) continue;
    if (e.type === 'user') {
      const c = typeof m.content === 'string' ? [{type: 'text', text: m.content}] : m.content;
      const text = c.filter(x => x.type === 'text').map(x => x.text).join(' ').replace(/\s+/g, ' ').trim();
      if (text && !c.some(x => x.type === 'tool_result')) turns.push({woke: text.replace(/<[^>]+>/g, '').trim().slice(0, 46), calls: 0, read: 0, write: 0, out: 0});
    }
    if (e.type === 'assistant' && m.usage && !seen.has(m.id)) { seen.add(m.id); const t = turns.at(-1); t.calls++; t.read += m.usage.cache_read_input_tokens ?? 0; t.write += m.usage.cache_creation_input_tokens ?? 0; }
    if (e.type === 'assistant' && m.usage) { const t = turns.at(-1); t.lastOut ??= {}; t.lastOut[m.id] = m.usage.output_tokens ?? 0; }
  }
  for (const t of turns) { t.out = Object.values(t.lastOut ?? {}).reduce((a, b) => a + b, 0); delete t.lastOut; }
  console.table(turns);
}
