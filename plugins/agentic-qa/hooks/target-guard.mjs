#!/usr/bin/env node
// PreToolUse guard: holds agentic-qa's own agents to the person-owned allowlist.
// Every other agent and session passes straight through.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const EXECUTOR = 'agentic-qa:step-executor';
const NETWORK_RESTRICTED = new Set([
  'agentic-qa:qa-reporter',
  'agentic-qa:behavior-coverage-critic',
  'agentic-qa:step-plan-critic',
]);
const ALWAYS_ALLOWED_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

// Deliberately a list of what may run, not of what may not: a denylist can't
// keep up with every way a shell can reach a network, and awk, find, xargs and
// env are absent because each can start another program.
const EXECUTOR_COMMANDS = new Set([
  'base64', 'basename', 'cat', 'cd', 'cp', 'curl', 'cut', 'date', 'dirname', 'echo',
  'false', 'grep', 'head', 'jq', 'ls', 'mkdir', 'mv', 'printf', 'rm', 'sed', 'sleep',
  'sort', 'tail', 'tee', 'test', 'touch', 'tr', 'true', 'uniq', 'wc', '[',
]);
const NETWORK_TOOLS = new Set([
  'curl', 'wget', 'nc', 'ncat', 'netcat', 'socat', 'ssh', 'scp', 'sftp', 'rsync', 'telnet', 'ftp',
]);
const CURL_FORBIDDEN = /^(-K|--config|-x|--proxy|--preproxy|--socks\S*|--connect-to|--resolve|--doh-url|--unix-socket|--abstract-unix-socket|--interface|--dns-servers|-L|--location|--location-trusted|--proto-redir|--next|-:)(=.*)?$/;
const CURL_VALUE_FLAGS = new Set([
  '-H', '--header', '-d', '--data', '--data-raw', '--data-binary', '--data-urlencode', '--json',
  '-X', '--request', '-o', '--output', '-m', '--max-time', '--connect-timeout', '-w', '--write-out',
  '-A', '--user-agent', '-e', '--referer', '-b', '--cookie', '-c', '--cookie-jar', '-F', '--form',
  '-T', '--upload-file', '-u', '--user', '-D', '--dump-header', '--retry', '--retry-delay', '--cacert',
]);

export function parseSettings(text) {
  const out = {allowed_hosts: [], allowed_commands: []};
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return out;
  let key = null;
  for (const raw of match[1].split(/\r?\n/)) {
    const top = /^([A-Za-z_]+):/.exec(raw);
    if (top) { key = top[1]; continue; }
    const item = /^\s+-\s+(.+?)\s*$/.exec(raw);
    if (item && key in out) out[key].push(item[1].replace(/\s+#.*$/, '').replace(/^["']|["']$/g, '').toLowerCase());
  }
  return out;
}

function isTracked(root, file) {
  try {
    execFileSync('git', ['-C', root, 'ls-files', '--error-unmatch', file], {stdio: 'ignore'});
    return true;
  } catch {
    return false;
  }
}

export function loadSettings(projectDir, home = os.homedir()) {
  const merged = {allowed_hosts: [], allowed_commands: []};
  const files = [path.join(home, '.claude', 'agentic-qa.local.md')];
  const repoFile = path.join('.claude', 'agentic-qa.local.md');
  // A tracked copy is ignored: anyone who can merge could otherwise edit the gate.
  if (projectDir && !isTracked(projectDir, repoFile)) files.push(path.join(projectDir, repoFile));
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const parsed = parseSettings(fs.readFileSync(file, 'utf8'));
    merged.allowed_hosts.push(...parsed.allowed_hosts);
    merged.allowed_commands.push(...parsed.allowed_commands);
  }
  return merged;
}

export function hostAllowed(host, allowedHosts) {
  const h = host.toLowerCase();
  if (ALWAYS_ALLOWED_HOSTS.includes(h)) return true;
  return allowedHosts.some(entry =>
    entry.startsWith('*.') ? h.endsWith(entry.slice(1)) && h.length > entry.length - 1 : h === entry);
}

// Judged on the raw text, never on a URL parser's normalised form: the parser
// here and curl disagree on inputs like `http://a\@b`, and only the raw text is
// what curl receives.
export function checkUrl(value, allowedHosts) {
  const m = /^(?:([a-z][a-z0-9+.-]*):\/\/)?([^/?#]*)/i.exec(value);
  const scheme = (m[1] || 'http').toLowerCase();
  const authority = m[2];
  if (scheme !== 'http' && scheme !== 'https') return `scheme ${scheme} is not allowed`;
  if (!/^([a-z0-9.-]+|\[[0-9a-f:]+\])(:\d+)?$/i.test(authority)) {
    return `"${authority}" must be a literal host, with no variable, credentials or glob`;
  }
  const host = authority.replace(/:\d+$/, '');
  return hostAllowed(host, allowedHosts) ? null : `host ${host} is not in allowed_hosts`;
}

// Splits a command line into simple commands, each a list of words. Understands
// quoting, operators, comments, heredocs and substitutions, which are returned
// as commands of their own. `dynamic` marks a word that an unquoted or
// double-quoted expansion could change at run time.
export function parseShell(src) {
  const commands = [];
  const stack = [{words: [], word: null}];
  let heredocs = [];
  const top = () => stack[stack.length - 1];
  const start = () => { top().word ??= {text: '', dynamic: false}; return top().word; };
  const endWord = () => { const f = top(); if (f.word) { f.words.push(f.word); f.word = null; } };
  const endCommand = () => { endWord(); const f = top(); if (f.words.length) commands.push(f.words); f.words = []; };
  let i = 0;
  const openSub = close => { start().dynamic = true; stack.push({words: [], word: null, close}); };
  const closeSub = () => { endCommand(); stack.pop(); };
  while (i < src.length) {
    const c = src[i];
    const f = top();
    if (f.close === ')' && c === ')') { closeSub(); i++; continue; }
    if (f.close === '`' && c === '`') { closeSub(); i++; continue; }
    if (c === '\\') {
      const next = src[i + 1];
      if (next === '\n') { i += 2; continue; }
      start().text += next ?? '';
      i += 2;
      continue;
    }
    if (c === "'") {
      const end = src.indexOf("'", i + 1);
      if (end < 0) throw new Error('unterminated quote');
      start().text += src.slice(i + 1, end);
      i = end + 1;
      continue;
    }
    if (c === '"') {
      start();
      i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\') { top().word.text += src[i + 1] ?? ''; i += 2; continue; }
        if (src[i] === '`') throw new Error('backtick inside double quotes');
        if (src[i] === '$' && src[i + 1] === '(') {
          const end = matchParen(src, i + 1);
          const inner = parseShell(src.slice(i + 2, end));
          commands.push(...inner);
          top().word.dynamic = true;
          top().word.text += '$';
          i = end + 1;
          continue;
        }
        if (src[i] === '$') top().word.dynamic = true;
        top().word.text += src[i++];
      }
      if (i >= src.length) throw new Error('unterminated quote');
      i++;
      continue;
    }
    if (c === '$' && src[i + 1] === '(') { openSub(')'); top(); i += 2; continue; }
    if (c === '`') { openSub('`'); i++; continue; }
    if (c === '$') { start().dynamic = true; start().text += c; i++; continue; }
    if (c === '#' && !f.word) { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '<' && src[i + 1] === '<' && src[i + 2] !== '<') {
      endWord();
      const m = /^<<-?\s*(?:'([^']+)'|"([^"]+)"|\\?([\w.-]+))/.exec(src.slice(i));
      if (!m) throw new Error('unreadable heredoc');
      // Only a quoted delimiter's body is inert; an unquoted one still expands
      // $(...), so its body can run commands.
      heredocs.push({tag: m[1] ?? m[2] ?? m[3], literal: Boolean(m[1] ?? m[2])});
      i += m[0].length;
      continue;
    }
    if (c === '\n' || c === ';' || c === '|' || c === '&' || c === '(' || c === ')') {
      if (c === '&' && (src[i - 1] === '>' || src[i + 1] === '>')) { start().text += c; i++; continue; }
      endCommand();
      if (c === '\n' && heredocs.length) i = skipHeredocs(src, i + 1, heredocs, commands) - 1;
      if (c === '\n') heredocs = [];
      i++;
      continue;
    }
    if (c === ' ' || c === '\t') { endWord(); i++; continue; }
    start().text += c;
    i++;
  }
  if (stack.length > 1) throw new Error('unterminated substitution');
  endCommand();
  return commands;
}

function matchParen(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    if (src[i] === ')' && --depth === 0) return i;
  }
  throw new Error('unterminated substitution');
}

function skipHeredocs(src, start, heredocs, commands) {
  let i = start;
  for (const {tag, literal} of heredocs) {
    const body = [];
    for (;;) {
      if (i >= src.length) throw new Error('unterminated heredoc');
      let end = src.indexOf('\n', i);
      if (end < 0) end = src.length;
      const line = src.slice(i, end).replace(/\r$/, '');
      i = end + 1;
      if (line.replace(/^\t+/, '') === tag) break;
      body.push(line);
    }
    if (!literal && /\$\(|`/.test(body.join('\n'))) throw new Error('substitution inside an unquoted heredoc');
  }
  return i;
}

const isAssignment = word => /^[A-Za-z_][A-Za-z0-9_]*=/.test(word.text);
const isRedirect = text => /^(\d*>>?|\d*>&\d*|&>>?|<|\d*<)/.test(text);

function dropRedirects(words) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const t = words[i].text;
    if (isRedirect(t)) {
      if (/^(\d*>>?|&>>?|<|\d*<)$/.test(t)) i++;
      continue;
    }
    out.push(words[i]);
  }
  return out;
}

const commandName = text => text.replace(/\\/g, '/').split('/').pop().toLowerCase().replace(/\.exe$/, '');

function checkCurl(args, allowedHosts) {
  let urls = 0;
  for (let i = 0; i < args.length; i++) {
    const {text, dynamic} = args[i];
    if (dynamic && text.startsWith('-')) return `"${text}" hides which curl option is used`;
    if (CURL_FORBIDDEN.test(text) || /^-[a-zA-Z]*[Lx:K]/.test(text) && !text.startsWith('--')) {
      return `curl ${text} is not allowed: it can reach a host the allowlist never sees. Read a redirect's Location and judge it yourself`;
    }
    if (text === '--url') {
      const r = checkUrl(args[++i]?.text ?? '', allowedHosts);
      if (r) return r;
      if (args[i].dynamic && /\$/.test(args[i].text.split('/').slice(0, 3).join('/'))) return 'the URL host must be literal';
      urls++;
      continue;
    }
    if (CURL_VALUE_FLAGS.has(text)) { i++; continue; }
    if (text.startsWith('-')) continue;
    if (/[{}[\]]/.test(text.split(/[?#]/)[0]) && !/^https?:\/\/\[[0-9a-f:]+\]/i.test(text)) return `"${text}" uses curl URL globbing`;
    const r = checkUrl(text, allowedHosts);
    if (r) return dynamic && /\$/.test(text) ? `the URL host must be literal: ${r}` : r;
    urls++;
  }
  return urls ? null : 'curl with no literal URL can\'t be checked';
}

// GNU sed can run programs through its `e` command, the `e` flag of `s`, and
// write files with `w`.
function checkSed(args) {
  const address = String.raw`(?:\d+(?:~\d+)?|\$|\/(?:\\.|[^/])*\/[IM]*)`;
  const command = new RegExp(String.raw`(?:^|[;{}\s])(?:${address}(?:\s*,\s*(?:${address}|[+~]\d+))?)?\s*!?\s*[ew](?:\s|$)`);
  const substitute = /(?:^|[;{}\s\d$/])s([^\w\s])(?:\\.|(?!\1).)*\1(?:\\.|(?!\1).)*\1[a-zA-Z0-9]*[ew]/;
  for (const {text} of args) {
    if (/^(-[a-zA-Z]*f|--file)/.test(text)) return 'sed -f loads a script this check can\'t read';
    if (text.startsWith('-')) continue;
    if (command.test(text) || substitute.test(text)) return 'sed\'s e and w commands are not allowed';
  }
  return null;
}

export function checkExecutorBash(command, settings) {
  let commands;
  try {
    commands = parseShell(command);
  } catch (err) {
    return `the command could not be read safely (${err.message}); write it more simply`;
  }
  const extra = new Set(settings.allowed_commands);
  for (const raw of commands) {
    const words = dropRedirects(raw);
    let n = 0;
    while (n < words.length && isAssignment(words[n])) {
      // These change where curl connects or which program a name finds, without
      // appearing in anything checkUrl sees.
      if (/^(PATH|IFS|HOME|ENV|BASH_ENV|LD_\w*|DYLD_\w*|CURL_\w*|\w*PROXY)=/i.test(words[n].text)) {
        return `setting ${words[n].text.split('=')[0]} is not allowed`;
      }
      n++;
    }
    if (n >= words.length) continue;
    const head = words[n];
    if (head.dynamic) return `"${head.text}" hides which program runs`;
    // A path means a file the run may have written itself, whatever its name.
    if (/[/\\]/.test(head.text)) return `"${head.text}" runs a program by path`;
    const name = commandName(head.text);
    const args = words.slice(n + 1);
    if (extra.has(name) && !NETWORK_TOOLS.has(name)) continue;
    if (!EXECUTOR_COMMANDS.has(name)) {
      return `${name} is not in allowed_commands, so a person hasn't said this run may start it`;
    }
    if (name === 'curl') {
      const r = checkCurl(args, settings.allowed_hosts);
      if (r) return r;
    }
    if (name === 'sed') {
      const r = checkSed(args);
      if (r) return r;
    }
    if (name === 'sort' && args.some(a => /^--compress-program/.test(a.text))) {
      return 'sort --compress-program starts another program';
    }
  }
  return null;
}

export function checkRestrictedBash(command) {
  let commands;
  try {
    commands = parseShell(command);
  } catch {
    commands = command.split(/[\s;|&()`]+/).map(text => [{text, dynamic: false}]);
  }
  for (const raw of commands) {
    const words = dropRedirects(raw);
    for (const word of words) {
      if (NETWORK_TOOLS.has(commandName(word.text))) return `${commandName(word.text)} is not available to this agent`;
      break;
    }
  }
  return null;
}

export function decide(input, settings) {
  const {agent_type: agent, tool_name: tool, tool_input: args = {}} = input;
  if (NETWORK_RESTRICTED.has(agent)) {
    return tool === 'Bash' ? checkRestrictedBash(args.command ?? '') : null;
  }
  if (agent !== EXECUTOR) return null;
  if (tool === 'Bash') return checkExecutorBash(args.command ?? '', settings);
  if (args.url === 'about:blank') return null;
  return checkUrl(args.url ?? '', settings.allowed_hosts);
}

function main() {
  let raw = '';
  process.stdin.on('data', d => { raw += d; }).on('end', () => {
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      return;
    }
    if (input.agent_type !== EXECUTOR && !NETWORK_RESTRICTED.has(input.agent_type)) return;
    let reason;
    try {
      const settings = loadSettings(process.env.CLAUDE_PROJECT_DIR || input.cwd);
      reason = decide(input, settings);
    } catch (err) {
      // A crash here would otherwise count as "allow", since a failing hook doesn't block.
      reason = `the target guard failed (${err.message}), so nothing it would check can run`;
    }
    if (reason) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `agentic-qa target guard: ${reason}. Do not rephrase this to get past it: end your turn with an ESCALATION saying what was refused.`,
        },
      }));
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
