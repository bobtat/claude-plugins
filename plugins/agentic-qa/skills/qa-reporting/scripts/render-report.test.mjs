import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {escapeHtml, inline, sensitiveSteps, renderBody, renderPage, TEXT_LIMIT, WITHHELD} from './render-report.mjs';

const script = fileURLToPath(new URL('./render-report.mjs', import.meta.url));
// A 1x1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

function run(files = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'render-')));
  const dir = path.join(root, 'walkthrough-ABC-1');
  fs.mkdirSync(path.join(dir, 'evidence'), {recursive: true});
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), {recursive: true});
    fs.writeFileSync(path.join(root, name), content);
  }
  return {root, dir, done: () => fs.rmSync(root, {recursive: true, force: true})};
}

// No markup in the page may come from the text it was given: these are the only tags it builds.
const BUILT = new Set(['html', 'head', 'meta', 'title', 'style', 'body', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'pre', 'code', 'strong', 'em', 'a', 'hr', 'figure', 'figcaption', 'img']);
const tags = html => [...html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)/g)].map(m => m[1].toLowerCase());

test('every character that could start markup is escaped', () => {
  assert.equal(escapeHtml(`<a href="x" onclick='y'>&`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;');
  assert.equal(inline('**bold** and `<b>code</b>` and *em*'), '<strong>bold</strong> and <code>&lt;b&gt;code&lt;/b&gt;</code> and <em>em</em>');
  assert.equal(inline('snake_case_name and 2 * 3 * 4 stay as typed'), 'snake_case_name and 2 * 3 * 4 stay as typed');
});

test('a link is made only for http and https, and cannot break out of its attribute', () => {
  assert.equal(inline('[ticket](https://example.com/a?b=1&c=2)'), '<a href="https://example.com/a?b=1&amp;c=2" rel="noreferrer noopener">ticket</a>');
  for (const hostile of ['[x](javascript:alert(1))', '[x](data:text/html,<script>1</script>)', '[x](https://a.example/"onmouseover="alert(1))', '[x](vbscript:x)']) {
    const html = inline(hostile);
    assert.ok(!/href="(?!https?:\/\/)/.test(html), hostile);
    // Whatever the address holds, the tag has the two attributes this script wrote and no others.
    for (const tag of html.match(/<a [^>]*>/g) ?? []) assert.match(tag, /^<a href="https?:\/\/[^"<>]*" rel="noreferrer noopener">$/, hostile);
    assert.ok(!html.includes('<script'), hostile);
  }
});

test('hostile text in the report and in evidence reaches the page as text', () => {
  const payload = '<script>alert(1)</script><img src=x onerror=alert(2)>';
  const {dir, done} = run({
    'walkthrough-ABC-1/evidence/s1-response.txt': `{"name":"${payload}"}\n</pre><script>alert(3)</script>`,
    'walkthrough-ABC-1/evidence/s2-shot.png': PNG,
  });
  const markdown = `# Walkthrough Report: ${payload}\n\n**Status:** ❌ Failed — ${payload}\n\n## Traceability\n| Step | Behavior | Verdict |\n|---|---|---|\n| S1 | B1 — ${payload} | ❌ Fail |\n\n## S1 — ${payload}\n- Observed: ${payload}\n- Evidence: evidence/s1-response.txt\n\n## S2 — shot\n- Evidence: evidence/s2-shot.png\n\n\`\`\`\n${payload}\n\`\`\`\n`;
  const {page, counts} = renderPage(markdown, dir);
  assert.deepEqual(counts, {images: 1, texts: 1, withheld: 0, missing: 0});
  assert.ok(!/<script/i.test(page), 'no script element');
  assert.ok(!/onerror=alert\(2\)>/.test(page.replace(/&gt;/g, '')) || !/<img src=x/.test(page));
  for (const tag of tags(page)) assert.ok(BUILT.has(tag), `unexpected <${tag}> in the page`);
  // The only img is the embedded screenshot, and it carries no handler.
  const images = [...page.matchAll(/<img[^>]*>/g)].map(m => m[0]);
  assert.equal(images.length, 1);
  assert.match(images[0], /^<img alt="evidence\/s2-shot\.png" src="data:image\/png;base64,[A-Za-z0-9+/=]+">$/);
  assert.match(page, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">/);
  assert.ok(page.includes('&lt;script&gt;alert(3)&lt;/script&gt;'));
  done();
});

test('only a file inside the run\'s evidence folder is embedded', () => {
  const {root, dir, done} = run({
    'secret.txt': 'TOP-SECRET-VALUE',
    'walkthrough-ABC-1/intake.md': 'INTAKE-TEXT',
    'walkthrough-ABC-1/evidence/ok.txt': 'fine',
  });
  fs.symlinkSync(path.join(root, 'secret.txt'), path.join(dir, 'evidence', 'link.txt'));
  const lines = ['evidence/../../secret.txt', 'evidence/../intake.md', 'evidence/link.txt', 'evidence/missing.txt', 'evidence/', 'evidence/ok.txt'];
  const markdown = '## S1 — x\n' + lines.map(file => `- Evidence: ${file}`).join('\n') + `\n- Evidence: ${path.join(root, 'secret.txt')}\n`;
  const {page, counts} = renderPage(markdown, dir);
  assert.ok(!page.includes('TOP-SECRET-VALUE'));
  assert.ok(!page.includes('INTAKE-TEXT'));
  assert.ok(page.includes('<pre>fine</pre>'));
  assert.equal(counts.texts, 1);
  assert.ok(counts.missing >= 3);
  done();
});

test('a step marked sensitive has its evidence withheld, whichever entry said so', () => {
  const {dir, done} = run({
    'walkthrough-ABC-1/evidence/s1-keys.png': PNG,
    'walkthrough-ABC-1/evidence/s2-ok.txt': 'visible',
  });
  const results = '## S1 — keys\n- **Verdict:** pending\n- **Sensitive:** yes\n\n## S2 — ok\n- **Verdict:** pass\n\n## S1 — keys\n- **Verdict:** pass\n';
  assert.deepEqual([...sensitiveSteps(results)], ['S1']);
  assert.deepEqual([...sensitiveSteps('## S3 — x\n- Sensitive: yes\n## S4 — y\n- **Sensitive:** no\n')], ['S3']);
  const markdown = '## S1 — keys\n- Evidence: evidence/s1-keys.png\n\n## S2 — ok\n- Evidence: evidence/s2-ok.txt\n\n## Findings\n- Evidence: evidence/s2-ok.txt\n';
  const {page, counts} = renderPage(markdown, dir, results);
  assert.ok(!page.includes('data:image/png'));
  assert.ok(page.includes(escapeHtml(WITHHELD)));
  assert.equal(counts.withheld, 1);
  assert.equal(counts.texts, 2);
  done();
});

test('tables, lists and the header block keep their shape', () => {
  const {dir, done} = run();
  const markdown = '# Report\n\n**Ticket:** T-1   **PR:** #7\n**Status:** ✅ Passed\n\n| Step | Behavior | Verdict |\n|---|---|---|\n| S1 | a \\| b | ✅ Pass |\n| S2 | c | ❌ Fail |\n| S3 | d | ⏳ blocked — Q1 |\n\n1. one\n2. two\n\n- x\n- y\n\n---\n';
  const {html} = renderBody(markdown, dir);
  assert.match(html, /<p><strong>Ticket:<\/strong> T-1   <strong>PR:<\/strong> #7<br>\n<strong>Status:<\/strong> ✅ Passed<\/p>/);
  assert.match(html, /<thead><tr><th>Step<\/th><th>Behavior<\/th><th>Verdict<\/th><\/tr><\/thead>/);
  assert.match(html, /<td>a \| b<\/td><td class="pass">✅ Pass<\/td>/);
  assert.match(html, /<td class="fail">❌ Fail<\/td>/);
  assert.match(html, /<td class="open">⏳ blocked — Q1<\/td>/);
  assert.match(html, /<ol>\n<li>one<\/li>\n<li>two<\/li>\n<\/ol>\n<ul>\n<li>x<\/li>\n<li>y<\/li>\n<\/ul>\n<hr>/);
  done();
});

test('a long text file is cut with a note, and a binary one is not shown', () => {
  const {dir, done} = run({
    'walkthrough-ABC-1/evidence/big.txt': 'a'.repeat(TEXT_LIMIT + 50),
    'walkthrough-ABC-1/evidence/blob.bin': Buffer.from([1, 2, 0, 3, 4]),
  });
  const {page, counts} = renderPage('## S1 — x\n- Evidence: evidence/big.txt, evidence/blob.bin\n', dir);
  assert.match(page, new RegExp(`cut at ${TEXT_LIMIT} characters of ${TEXT_LIMIT + 50}`));
  assert.deepEqual(counts, {images: 0, texts: 1, withheld: 0, missing: 1});
  done();
});

test('run as a command it writes the page and says what it embedded', () => {
  const {dir, done} = run({
    'walkthrough-ABC-1/walkthrough-report.md': '# R\n\n## S1 — a\n- Evidence: evidence/s1.png\n',
    'walkthrough-ABC-1/evidence/s1.png': PNG,
  });
  const result = spawnSync(process.execPath, [script, dir], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 screenshots and 0 text files embedded, 0 withheld, 0 not embedded/);
  assert.ok(fs.readFileSync(path.join(dir, 'walkthrough-report.html'), 'utf8').startsWith('<!doctype html>'));
  assert.equal(spawnSync(process.execPath, [script, path.join(dir, 'nowhere')], {encoding: 'utf8'}).status, 1);
  assert.equal(spawnSync(process.execPath, [script], {encoding: 'utf8'}).status, 2);
  done();
});
