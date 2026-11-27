#!/usr/bin/env node
// Renders walkthrough-report.html from walkthrough-report.md, with each step's evidence
// embedded, as one self-contained file. Dependency-free Node.
//
//   node render-report.mjs <working directory>
//
// Everything it reads is hostile text: a walkthrough of a stored-XSS ticket carries its
// payload in the evidence by design, and the file this writes is opened on other
// people's machines. So nothing passes through as HTML. Every character of the report
// and of the evidence is escaped, the few constructs that become markup are built here,
// and the page forbids scripts and anything fetched from elsewhere.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const IMAGE_TYPES = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp'};
// A text evidence file is shown whole up to this size, and cut with a note beyond it.
export const TEXT_LIMIT = 200_000;
// An image larger than this is named, not embedded: the page has to open.
export const IMAGE_LIMIT = 8_000_000;
export const WITHHELD = 'evidence withheld — contains a credential, see the working directory';
const CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'";

export const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// Inline Markdown: code spans, bold, emphasis and links to http(s). The text is escaped
// first, so whatever is left unmatched is shown as it was typed.
export function inline(text) {
  return String(text).split(/(`[^`]+`)/).map(part => {
    if (/^`[^`]+`$/.test(part)) return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
    return escapeHtml(part)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => `<a href="${url}" rel="noreferrer noopener">${label}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=$|[\s).,;:])/g, '$1<em>$2</em>');
  }).join('');
}

// Which steps have evidence that must not be shown. step-results.md is append-only and a
// step's last entry is its result, but a credential on screen in any attempt is still on
// the screenshot, so one `Sensitive: yes` in any entry withholds the step.
export function sensitiveSteps(results) {
  const steps = new Set();
  let step = null;
  for (const line of String(results).split('\n')) {
    const head = /^##\s+(S\d+)\b/.exec(line);
    if (head) step = head[1];
    else if (step && /^\s*[-*]\s*\*{0,2}Sensitive:?\*{0,2}:?\s*yes\b/i.test(line)) steps.add(step);
  }
  return steps;
}

// An evidence file is embedded only if it really is inside the run's evidence folder.
// The report is written by a model from text the system under test supplied, so a path
// in it is a claim: `evidence/../../../home/me/.ssh/id_rsa` must embed nothing.
function evidenceFile(dir, relative) {
  const root = path.join(dir, 'evidence');
  let real;
  try {
    real = fs.realpathSync(path.resolve(dir, relative));
    const inside = path.relative(fs.realpathSync(root), real);
    if (inside === '' || inside.startsWith('..') || path.isAbsolute(inside)) return null;
    if (!fs.statSync(real).isFile()) return null;
  } catch {
    return null;
  }
  return real;
}

function renderEvidence(dir, relative, counts) {
  const name = escapeHtml(relative);
  const file = evidenceFile(dir, relative);
  if (!file) {
    counts.missing++;
    return `<p class="evidence-note">${name}: not found in this run's evidence folder</p>`;
  }
  const type = IMAGE_TYPES[path.extname(file).toLowerCase()];
  const size = fs.statSync(file).size;
  if (type) {
    if (size > IMAGE_LIMIT) {
      counts.missing++;
      return `<p class="evidence-note">${name}: ${size} bytes, too large to embed; see the working directory</p>`;
    }
    counts.images++;
    return `<figure><img alt="${name}" src="data:${type};base64,${fs.readFileSync(file).toString('base64')}"><figcaption>${name}</figcaption></figure>`;
  }
  const buffer = fs.readFileSync(file);
  if (buffer.subarray(0, 8000).includes(0)) {
    counts.missing++;
    return `<p class="evidence-note">${name}: not text and not an image this report can show; see the working directory</p>`;
  }
  counts.texts++;
  const text = buffer.toString('utf8');
  const cut = text.length > TEXT_LIMIT ? `\n… cut at ${TEXT_LIMIT} characters of ${text.length}; the whole file is in the working directory` : '';
  return `<figure><figcaption>${name}</figcaption><pre>${escapeHtml(text.slice(0, TEXT_LIMIT) + cut)}</pre></figure>`;
}

const EVIDENCE_LINE = /^\s*[-*]\s*\*{0,2}Evidence:?\*{0,2}:?\s*(.*)$/i;
const EVIDENCE_PATH = /evidence\/[A-Za-z0-9._/-]*[A-Za-z0-9_-]/g;

function cells(row) {
  const body = row.trim().replace(/^\|/, '').replace(/\|$/, '');
  return body.split(/(?<!\\)\|/).map(cell => cell.replace(/\\\|/g, '|').trim());
}

const verdictClass = text => /✅|\bpass(ed)?\b/i.test(text) ? 'pass' : /❌|\bfail(ed)?\b/i.test(text) ? 'fail' : /⏳|⏭|❔|⏸|⚠️|👁|blocked|skipped|not verified|paused|observed/i.test(text) ? 'open' : '';

// Markdown to HTML for the constructs the report template uses: headings, paragraphs,
// lists, tables, fenced code, rules. Anything else is shown as escaped text.
export function renderBody(markdown, dir, sensitive = new Set(), counts = {images: 0, texts: 0, withheld: 0, missing: 0}) {
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let step = null;
  let paragraph = [];
  let list = null;
  const flush = () => {
    if (paragraph.length) out.push(`<p>${paragraph.map(inline).join('<br>\n')}</p>`);
    paragraph = [];
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^\s*(```+|~~~+)/.exec(line);
    if (fence) {
      flush();
      const body = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith(fence[1]); i++) body.push(lines[i]);
      out.push(`<pre>${escapeHtml(body.join('\n'))}</pre>`);
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      const stepHead = level === 2 ? /^(S\d+)\b/.exec(heading[2]) : null;
      if (level <= 2) step = stepHead ? stepHead[1] : null;
      out.push(`<h${level}${stepHead ? ` id="${stepHead[1].toLowerCase()}"` : ''}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^\s*\|/.test(line)) {
      flush();
      const rows = [];
      for (; i < lines.length && /^\s*\|/.test(lines[i]); i++) rows.push(cells(lines[i]));
      i--;
      const ruled = rows.length > 1 && rows[1].every(cell => /^:?-{1,}:?$/.test(cell));
      const head = ruled ? rows[0] : null;
      const body = ruled ? rows.slice(2) : rows;
      out.push('<table>' + (head ? `<thead><tr>${head.map(cell => `<th>${inline(cell)}</th>`).join('')}</tr></thead>` : '')
        + `<tbody>${body.map(row => `<tr>${row.map((cell, n) => { const kind = /verdict/i.test(head?.[n] ?? '') ? verdictClass(cell) : ''; return `<td${kind ? ` class="${kind}"` : ''}>${inline(cell)}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      out.push('<hr>');
      continue;
    }
    const item = /^\s*([-*]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      const kind = /\d/.test(item[1]) ? 'ol' : 'ul';
      if (paragraph.length || (list && list !== kind)) flush();
      if (!list) { out.push(`<${kind}>`); list = kind; }
      const evidence = EVIDENCE_LINE.exec(line);
      const files = evidence ? [...new Set(evidence[1].match(EVIDENCE_PATH) ?? [])] : [];
      let shown = '';
      if (files.length && step && sensitive.has(step)) {
        counts.withheld += files.length;
        shown = `<p class="evidence-note">${escapeHtml(WITHHELD)}</p>`;
      } else {
        shown = files.map(file => renderEvidence(dir, file, counts)).join('');
      }
      out.push(`<li>${inline(item[2])}${shown}</li>`);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (list) flush();
    paragraph.push(line.trim());
  }
  flush();
  return {html: out.join('\n'), counts};
}

const STYLE = `
body{font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;margin:0 auto;max-width:980px;padding:24px 16px;color:#1b1f24;background:#fff}
h1{font-size:1.6em;margin:0 0 .6em}h2{font-size:1.2em;margin:1.8em 0 .5em;padding-top:.6em;border-top:1px solid #d8dee4}h3{font-size:1.05em}
table{border-collapse:collapse;width:100%;margin:.6em 0;display:block;overflow-x:auto}th,td{border:1px solid #d8dee4;padding:6px 10px;text-align:left;vertical-align:top}th{background:#f3f5f7}
td.pass{background:#e9f7ee}td.fail{background:#fdecec}td.open{background:#fff6dd}
code,pre{font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}code{background:#f3f5f7;padding:1px 4px;border-radius:3px}
pre{background:#f3f5f7;padding:10px 12px;border-radius:6px;overflow-x:auto;white-space:pre-wrap;word-break:break-word}
figure{margin:.6em 0}figcaption{font-size:.85em;color:#57606a;margin:.2em 0}img{max-width:100%;border:1px solid #d8dee4;border-radius:4px}
.evidence-note{font-size:.9em;color:#8a4b00;margin:.3em 0}ul,ol{padding-left:1.4em}a{color:#0b57d0}
@media (prefers-color-scheme:dark){body{color:#e6e9ed;background:#15181c}th,pre,code{background:#22272e}th,td,img,h2{border-color:#3a414a}td.pass{background:#143222}td.fail{background:#3c1a1a}td.open{background:#3a3012}figcaption{color:#9aa4af}.evidence-note{color:#f0b46a}a{color:#8ab4f8}}
`.trim();

export function renderPage(markdown, dir, results = '') {
  const {html, counts} = renderBody(markdown, dir, sensitiveSteps(results));
  const title = /^#\s+(.*)$/m.exec(markdown)?.[1] ?? 'Walkthrough Report';
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
${html}
</body>
</html>
`;
  return {page, counts};
}

function main(argv) {
  const dir = argv[2];
  if (!dir) {
    console.error('usage: render-report.mjs <working directory>');
    return 2;
  }
  const source = path.join(dir, 'walkthrough-report.md');
  let markdown;
  try {
    markdown = fs.readFileSync(source, 'utf8');
  } catch (err) {
    console.error(`cannot read ${source}: ${err.message}`);
    return 1;
  }
  let results = '';
  try {
    results = fs.readFileSync(path.join(dir, 'step-results.md'), 'utf8');
  } catch {
    // A run that never started a step has no results file, and nothing to withhold.
  }
  const {page, counts} = renderPage(markdown, dir, results);
  const target = path.join(dir, 'walkthrough-report.html');
  fs.writeFileSync(target, page);
  console.log(`${target}: ${counts.images} screenshots and ${counts.texts} text files embedded, ${counts.withheld} withheld, ${counts.missing} not embedded`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv);
