#!/usr/bin/env node
// PreToolUse guard: holds agentic-qa's own agents to the person-owned allowlist.
// Every other agent and session passes straight through.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const PLUGIN_AGENT = 'agentic-qa:';
const EXECUTOR = 'agentic-qa:step-executor';
const RUNNER = 'agentic-qa:qa-runner';
const REPORTER = 'agentic-qa:qa-reporter';
const NETWORK_RESTRICTED = new Set([
  'agentic-qa:behavior-coverage-critic',
  'agentic-qa:step-plan-critic',
]);
// The critics hold no Bash. Each writes one thing, its findings, into the run's
// working directory, so that is the only place its file tools may write.
const CRITICS = new Set(['agentic-qa:behavior-coverage-critic', 'agentic-qa:step-plan-critic']);
const SHELL_KEYWORDS = new Set(['for', 'while', 'until', 'if', 'case', 'select', 'function', 'do', 'done', 'then', 'else', 'elif', 'fi', 'esac', '{', '}', '[[', '!', 'time']);
const ALWAYS_ALLOWED_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

// Throughout, these are lists of what may run, not of what may not: programs,
// curl and sort options, sed commands. Each denylist this guard started with was
// bypassed by something it hadn't named, such as an abbreviated long option.
// awk, find, xargs and env are absent because each can start another program.
export const EXECUTOR_COMMANDS = new Set([
  'base64', 'basename', 'cat', 'cd', 'cp', 'curl', 'cut', 'date', 'dirname', 'echo',
  'false', 'grep', 'head', 'jq', 'ls', 'mkdir', 'mv', 'printf', 'rm', 'sed', 'sleep',
  'sort', 'tail', 'tee', 'test', 'touch', 'tr', 'true', 'uniq', 'wc', '[',
]);
const NETWORK_TOOLS = new Set([
  'curl', 'wget', 'nc', 'ncat', 'netcat', 'socat', 'ssh', 'scp', 'sftp', 'rsync', 'telnet', 'ftp',
]);
const CURL_SHORT_FLAGS = new Set(['s', 'S', 'f', 'i', 'I', 'v', 'k', 'G']);
const CURL_SHORT_WITH_VALUE = new Set(['H', 'd', 'X', 'o', 'm', 'w', 'A', 'e', 'b', 'c', 'F', 'T', 'u', 'D']);
const CURL_LONG_FLAGS = new Set([
  '--silent', '--show-error', '--fail', '--include', '--head', '--verbose', '--insecure', '--get',
  '--compressed', '--http1.1', '--http2',
]);
const CURL_LONG_WITH_VALUE = new Set([
  '--header', '--data', '--data-raw', '--data-binary', '--data-urlencode', '--json', '--request',
  '--output', '--max-time', '--connect-timeout', '--write-out', '--user-agent', '--referer',
  '--cookie', '--cookie-jar', '--form', '--upload-file', '--user', '--dump-header', '--retry',
  '--retry-delay', '--cacert', '--form-string',
]);
const CURL_WRITES_FILE = new Set(['-o', '--output', '-D', '--dump-header', '-c', '--cookie-jar']);
const CURL_READS_FILE = new Set(['-T', '--upload-file']);
const CURL_DATA = new Set(['-d', '--data', '--data-binary', '--data-urlencode', '--json', '-F', '--form']);
const CURL_WRITE_OUT = new Set(['-w', '--write-out']);

// Programs that read their arguments as data rather than as paths.
const DATA_ARGUMENTS = new Set(['echo', 'printf', 'tr', 'sleep', 'date', 'true', 'false', 'test', '[']);

// What decides this guard's behaviour, or what runs later, must not be writable
// by the agents it guards.
const PROTECTED_FILE = /(^|[/\\])(agentic-qa\.local\.md|[._]curlrc|[._]netrc|\.bashrc|\.bash_profile|\.bash_login|\.bash_logout|\.profile|\.zshrc|\.zshenv|\.zprofile|\.gitconfig|\.mcp\.json|settings(\.local)?\.json|target-guard\.mjs|hooks\.json|CLAUDE\.md|AGENTS\.md)[. ]*(:.*)?$/i;
const PROTECTED_DIR = /(^|[/\\])(\.ssh|\.git|\.husky|\.kube|\.aws|\.config|\.docker|\.gnupg)([/\\]|$)/i;
// Windows short names reach these without spelling them, and only these are
// refused because `RUNNER~1` is an ordinary part of a CI temp path.
const PROTECTED_SHORT_NAME = /(^|[/\\])_?(AGENTI|CURLRC|NETRC|CLAUDE|BASHRC|BASH_|PROFIL|ZSHRC|ZSHENV|ZPROFI|GITCON|SETTIN|MCP|SSH|GIT|HUSKY|KUBE|AWS|CONFIG|DOCKER|GNUPG|TARGET|HOOKS)[A-Z0-9_-]*~\d/i;
const CLAUDE_DIR = /(^|[/\\])\.claude([/\\]|$)/i;
// A run's own files can legitimately live here: the session scratchpad.
// Playwright's output used to, under plugins/data, which also holds every other
// plugin's stored data. It now writes outside .claude, so that is no longer exempt.
const CLAUDE_DIR_EXEMPT = /(^|[/\\])\.claude[/\\]jobs[/\\]/i;

function protectedForm(text) {
  if (PROTECTED_FILE.test(text) || PROTECTED_DIR.test(text)) return `"${text}" touches a file that controls this guard or what runs later`;
  if (PROTECTED_SHORT_NAME.test(text)) return `"${text}" looks like the Windows short name of a protected file`;
  if (CLAUDE_DIR.test(text) && (!CLAUDE_DIR_EXEMPT.test(text) || /(^|[/\\])\.\.([/\\]|$)/.test(text))) {
    return `"${text}" is inside .claude`;
  }
  return null;
}

// A path can be attached to its option, as in `-o.claude/x` or `--dir=.claude/x`.
export function protectedPath(text) {
  const forms = [text];
  if (text.startsWith('-')) forms.push(text.replace(/^-[a-zA-Z]/, ''), text.replace(/^[^=]*=/, ''));
  for (const form of forms) {
    const reason = protectedForm(form);
    if (reason) return reason;
  }
  return null;
}

const unsafeDestination = word => word.dynamic || /[*?[\]{}]/.test(word.text);

// Refusals of how a command is written, not of what it reaches: a variable or a
// glob where a path must be literal, an expansion left unquoted. The same command
// with its paths spelled out is checked in full like any other, so asking for it
// gives nothing away, where an escalation over one ends an unattended run with no
// step verified. What a command reaches is never in this set.
const SPELL_OUT = 'Send it once more with every path spelled out in full: no variable, no glob, no unquoted expansion';
const FORM_REFUSALS = new Map();
const spellOut = (reason, hint = SPELL_OUT) => { FORM_REFUSALS.set(reason, hint); return reason; };
export const isFormRefusal = reason => FORM_REFUSALS.has(reason);

// Reads the two lists from a settings file's frontmatter. It is not a YAML parser:
// it reads a block list, at any indent, and a flow list on the key's own line. What
// it cannot read is reported in `problems` rather than dropped, because a list that
// reads as empty here and as full to the agent that plans the run fails one step at
// a time with nothing to say why.
export function parseSettings(text) {
  const out = {allowed_hosts: [], allowed_commands: [], problems: []};
  const body = text.replace(/^﻿/, '');
  const match = /^(?:[ \t]*\r?\n)*---[ \t]*\r?\n([\s\S]*?)\r?\n---/.exec(body);
  if (!match) {
    if (/^\s*(allowed_hosts|allowed_commands)\s*:/m.test(body)) out.problems.push('its lists are not inside a --- frontmatter block');
    return out;
  }
  const entry = (key, raw) => {
    let value = raw.replace(/\s+#.*$/, '').trim().replace(/^(["'])(.*)\1$/, '$2').toLowerCase();
    if (!value) return;
    if (key === 'allowed_hosts') {
      const url = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/.exec(value);
      if (url) {
        // A URL was meant as its host. The port goes too: an entry never matches one.
        out.problems.push(`"${value}" is a URL, and was read as its host`);
        value = url[1].replace(/^[^@]*@/, '').replace(/:\d+$/, '');
      } else if (/^[a-z0-9.*-]+:\d+$/.test(value)) {
        out.problems.push(`"${value}" has a port, which no entry can match: list the host alone`);
      } else if (/^[a-z0-9.*-]+\/$/.test(value)) {
        value = value.slice(0, -1);
      }
    }
    out[key].push(value);
  };
  let key = null;
  for (const raw of match[1].split(/\r?\n/)) {
    const top = /^([A-Za-z_]+):(.*)$/.exec(raw);
    if (top) {
      key = top[1];
      const rest = top[2].replace(/\s+#.*$/, '').trim();
      if (!rest || !Object.hasOwn(out, key) || key === 'problems') continue;
      const flow = /^\[(.*)\]$/.exec(rest);
      if (flow) flow[1].split(',').forEach(item => entry(key, item));
      else out.problems.push(`${key} has a value this guard cannot read ("${rest}"): write it as a list`);
      continue;
    }
    const item = /^\s*-\s+(.+?)\s*$/.exec(raw);
    if (item && Object.hasOwn(out, key ?? '') && key !== 'problems') entry(key, item[1]);
  }
  return out;
}

// Only exit 1 means untracked: it is what git answers for a file it does not know.
// Any other outcome leaves the question open, and an open question is answered
// "tracked": a corrupt HEAD, a checkout owned by someone else, git missing from
// PATH, or a git too slow to answer. Reading every failure as "untracked" let any
// of those turn a committed allowlist into one the guard honoured.
function isTracked(root, file) {
  try {
    execFileSync('git', ['-C', root, 'ls-files', '--error-unmatch', file], {stdio: 'ignore', timeout: 5000});
    return true;
  } catch (err) {
    return err.status !== 1;
  }
}

export function loadSettings(projectDir, home = os.homedir()) {
  const merged = {allowed_hosts: [], allowed_commands: [], problems: []};
  const files = [path.join(home, '.claude', 'agentic-qa.local.md')];
  const repoFile = path.join('.claude', 'agentic-qa.local.md');
  // A tracked copy is ignored: anyone who can merge could otherwise edit the gate.
  if (projectDir && fs.existsSync(path.join(projectDir, repoFile))) {
    if (isTracked(projectDir, repoFile)) merged.problems.push(`${repoFile} in the project is ignored: git tracks it, or could not say that it doesn't`);
    else files.push(path.join(projectDir, repoFile));
  }
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const parsed = parseSettings(fs.readFileSync(file, 'utf8'));
    merged.allowed_hosts.push(...parsed.allowed_hosts);
    merged.allowed_commands.push(...parsed.allowed_commands);
    merged.problems.push(...parsed.problems.map(problem => `${file}: ${problem}`));
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

// A problem with how a command is written that has a mechanical fix. Refused like
// any other, but the executor is asked for the command once more.
class Respell extends Error {
  constructor(message, hint) { super(message); this.hint = hint; }
}

const HEREDOC = /^<<(-?)[ \t]*(?:'([A-Za-z_][A-Za-z0-9_]*)'|"([A-Za-z_][A-Za-z0-9_]*)")(?=[\s;|&<>]|$)/;

// Splits a command line into simple commands, each a list of words, and throws on
// anything outside a small grammar. The grammar is small on purpose: this guard
// decides on its own reading of the text, and wherever that reading and bash's can
// differ, bash runs a command nobody checked. So it accepts only what it reads the
// way bash does: words, single and double quotes, $NAME, ${NAME}, $(command),
// redirects, heredocs with a quoted delimiter, and commands joined by && || ; | &.
// It refuses backticks, subshells, arithmetic, ${…} with any operator, $'…', and
// heredocs whose body bash would expand.
//
// On a word, `dynamic` marks an expansion that can change it at run time, `split`
// one that is unquoted and so can become several words, and `glob` and `brace`
// an unquoted pattern character the shell would expand. On a command, `next` is
// the operator that follows it and `sub` marks one inside a substitution.
export function parseShell(src) {
  const commands = [];
  const stack = [{words: [], word: null}];
  let heredocs = [];
  const top = () => stack[stack.length - 1];
  const start = () => { top().word ??= {text: '', dynamic: false, split: false, glob: false, brace: false}; return top().word; };
  const endWord = () => { const f = top(); if (f.word) { f.words.push(f.word); f.word = null; } };
  const endCommand = next => {
    endWord();
    const f = top();
    if (f.words.length) { f.words.next = next; f.words.sub = stack.length > 1; commands.push(f.words); }
    f.words = [];
  };
  const noHeredocPending = what => {
    if (heredocs.length) throw new Error(`${what} on a line that starts a heredoc`);
  };
  // Reads the expansion at src[i], which is a `$` not followed by a single `(`.
  const parameter = (i, quoted) => {
    const rest = src.slice(i, i + 80);
    if (rest.startsWith('$((') || rest[1] === '[') throw new Error('arithmetic, which evaluates its text as code');
    if (!quoted && (rest[1] === "'" || rest[1] === '"')) throw new Error('$\'…\' or $"…" quoting, which decodes its text');
    const braced = /^\$\{[A-Za-z_][A-Za-z0-9_]*\}/.exec(rest);
    if (braced) return {text: braced[0], expands: true};
    if (rest[1] === '{') throw new Error('${…} with anything but a plain name: an operator or subscript there can run a command');
    // $? $# $$ and $! are numbers, so unquoted they cannot split into extra words.
    if (/^\$[?#$!]/.test(rest)) return {text: rest.slice(0, 2), expands: true, whole: true};
    const plain = /^\$(?:[A-Za-z_][A-Za-z0-9_]*|[0-9@*-])/.exec(rest);
    return plain ? {text: plain[0], expands: true} : {text: '$', expands: false};
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const f = top();
    if (f.close === ')' && c === ')') { endCommand(')'); stack.pop(); i++; continue; }
    if (c === '\\') {
      const next = src[i + 1];
      if (next === undefined) throw new Error('a backslash at the end');
      if (next === '\n') { noHeredocPending('a continued line'); i += 2; continue; }
      start().text += next;
      i += 2;
      continue;
    }
    if (c === "'") {
      const end = src.indexOf("'", i + 1);
      if (end < 0) throw new Error('unterminated quote');
      const body = src.slice(i + 1, end);
      if (body.includes('\n')) noHeredocPending('a quoted newline');
      start().text += body;
      i = end + 1;
      continue;
    }
    if (c === '"') {
      const word = start();
      i++;
      while (i < src.length && src[i] !== '"') {
        const d = src[i];
        if (d === '\\') {
          // Inside double quotes bash drops a backslash only before these; before
          // anything else it stays, and on Windows it is then a path separator.
          const next = src[i + 1];
          if (next === undefined) throw new Error('unterminated quote');
          if (next === '\n') noHeredocPending('a continued line');
          else word.text += '$`"\\'.includes(next) ? next : `\\${next}`;
          i += 2;
          continue;
        }
        if (d === '`') throw new Error('a backtick: use $(…)');
        if (d === '\n') noHeredocPending('a quoted newline');
        if (d === '$' && src[i + 1] === '(' && src[i + 2] !== '(') {
          // Finding where a substitution ends means reading quotes and parentheses
          // exactly as bash does. Inside double quotes this takes only the plain case.
          const end = src.indexOf(')', i + 2);
          const inner = end < 0 ? null : src.slice(i + 2, end);
          if (inner === null || /[('"\\$`\n<>]/.test(inner)) {
            throw new Respell('a substitution inside double quotes that is more than a plain command such as $(cat file)',
              'Send it as two commands: first write the value to a file in the run\'s working directory, with nothing printed, then use $(cat <that file>) where the value goes');
          }
          for (const command of parseShell(inner)) { command.sub = true; commands.push(command); }
          word.dynamic = true;
          word.text += '$';
          i = end + 1;
          continue;
        }
        if (d === '$') {
          const read = parameter(i, true);
          if (read.expands) word.dynamic = true;
          word.text += read.text;
          i += read.text.length;
          continue;
        }
        word.text += d;
        i++;
      }
      if (i >= src.length) throw new Error('unterminated quote');
      i++;
      continue;
    }
    if (c === '`') throw new Error('a backtick: use $(…)');
    if (c === '$' && src[i + 1] === '(' && src[i + 2] !== '(') {
      const word = start();
      word.dynamic = true;
      word.split = true;
      stack.push({words: [], word: null, close: ')'});
      i += 2;
      continue;
    }
    if (c === '$') {
      const read = parameter(i, false);
      const word = start();
      if (read.expands) { word.dynamic = true; if (!read.whole) word.split = true; }
      word.text += read.text;
      i += read.text.length;
      continue;
    }
    if (c === '#' && !f.word) { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '<' && src[i + 1] === '<' && src[i + 2] !== '<') {
      endWord();
      const m = HEREDOC.exec(src.slice(i));
      if (!m) {
        throw new Respell('a heredoc needs a plain quoted delimiter', 'Send it once more with the heredoc\'s delimiter quoted, as in <<\'ENTRY\', so that bash expands nothing in its body');
      }
      if (stack.length > 1) throw new Error('a heredoc inside a substitution');
      heredocs.push({tag: m[2] ?? m[3], stripTabs: m[1] === '-'});
      i += m[0].length;
      continue;
    }
    const redirect = /^(?:&>>?|>&|>>?\|?|<&|<>|<<<|<)/.exec(src.slice(i));
    if (redirect) {
      if (f.word && !f.word.dynamic && /^\d+$/.test(f.word.text)) f.word = null;
      else endWord();
      f.words.push({text: redirect[0], dynamic: false, split: false, redirect: true});
      i += redirect[0].length;
      continue;
    }
    if (c === '\n' || c === ';' || c === '|' || c === '&') {
      const two = src.slice(i, i + 2);
      const operator = two === '&&' || two === '||' ? two : c;
      endCommand(operator);
      i += operator.length;
      if (c === '\n' && heredocs.length) {
        i = skipHeredocs(src, i, heredocs);
        heredocs = [];
      }
      continue;
    }
    // A subshell, a group, a function, a process substitution, (( )): none is needed.
    if (c === '(' || c === ')') throw new Error('parentheses outside $(…)');
    if (c === ' ' || c === '\t') { endWord(); i++; continue; }
    const word = start();
    if (c === '*' || c === '?' || c === '[') word.glob = true;
    if (c === '{' || c === '}') word.brace = true;
    word.text += c;
    i++;
  }
  if (stack.length > 1) throw new Error('unterminated substitution');
  if (heredocs.length) throw new Error('a heredoc with no body');
  endCommand('');
  return commands;
}

// A heredoc's body ends where bash ends it: at a line that is exactly the
// delimiter, with leading tabs removed only for <<-. Nothing else is trimmed.
function skipHeredocs(src, start, heredocs) {
  let i = start;
  for (const {tag, stripTabs} of heredocs) {
    for (;;) {
      if (i >= src.length) throw new Error('unterminated heredoc');
      let end = src.indexOf('\n', i);
      if (end < 0) end = src.length;
      const line = src.slice(i, end);
      i = end + 1;
      if ((stripTabs ? line.replace(/^\t+/, '') : line) === tag) break;
    }
  }
  return i;
}

const isAssignment = word => /^[A-Za-z_][A-Za-z0-9_]*=/.test(word.text);

// A redirect to /dev/tcp/<host>/<port> or /dev/udp/… is a network connection in
// bash, with no curl for the host checks to see. Of /dev, only these are needed.
const DEVICES = new Set(['/dev/null', '/dev/stdout', '/dev/stderr', '/dev/stdin']);

function splitRedirects(raw) {
  const words = [];
  const redirects = [];
  for (let i = 0; i < raw.length; i++) {
    if (!raw[i].redirect) { words.push(raw[i]); continue; }
    const operator = raw[i].text;
    const target = raw[++i];
    if (!target) throw new Error('a redirect with no target');
    // A here-string's operand is data, and `2>&1` names a descriptor.
    if (operator === '<<<') continue;
    if ((operator === '>&' || operator === '<&') && /^(\d+|-)$/.test(target.text) && !target.dynamic) continue;
    redirects.push({target, writes: operator !== '<' && operator !== '<&'});
  }
  return {words, redirects};
}

function checkRedirect({target}) {
  if (unsafeDestination(target)) return spellOut(`a redirect to "${target.text}" must name a literal path`);
  if (/^[/\\]+dev([/\\]|$)/i.test(target.text.replace(/[/\\]+/g, '/')) && !DEVICES.has(target.text)) {
    return `a redirect to "${target.text}" is not allowed: of /dev, only null, stdout, stderr and stdin`;
  }
  return protectedPath(target.text);
}

const commandName = text => text.replace(/\\/g, '/').split('/').pop().toLowerCase().replace(/\.exe$/, '');

// A value that begins with an expansion could begin with `@` once expanded, and
// curl then reads the file it names.
const startsDynamic = word => word.dynamic && word.text.startsWith('$');

// The file a curl option's value makes curl read, if it does. `null` when it reads
// none, and a refusal when the value hides whether it does.
function curlReads(flag, word) {
  const {text} = word;
  const hidden = () => ({refuse: spellOut(`curl ${flag} "${text}" could name a file once it is expanded`, 'Send it once more with the value starting with literal text, or with --data-raw or --form-string, which never read a file')});
  if (flag === '-H' || flag === '--header') return startsDynamic(word) ? hidden() : text.startsWith('@') ? {file: text.slice(1)} : null;
  if (flag === '-b' || flag === '--cookie') return startsDynamic(word) ? hidden() : text.includes('=') ? null : {file: text};
  if (flag === '--data-urlencode') {
    const at = text.indexOf('@');
    const equals = text.indexOf('=');
    if (word.dynamic && (equals < 0 || text.indexOf('$') < equals)) return hidden();
    return at >= 0 && (equals < 0 || at < equals) ? {file: text.slice(at + 1)} : null;
  }
  if (flag === '-F' || flag === '--form') {
    // `name=@file` uploads a file and `name=<file` sends its text, so an expanded
    // value can turn into either. --form-string sends the value as it is.
    if (word.dynamic) return hidden();
    const m = /^[^=]*=[@<]([^;,]*)/.exec(text);
    return m ? {file: m[1]} : null;
  }
  if (CURL_DATA.has(flag)) return startsDynamic(word) ? hidden() : text.startsWith('@') ? {file: text.slice(1)} : null;
  if (CURL_READS_FILE.has(flag) || flag === '--cacert') return {file: text};
  return null;
}

function checkCurlValue(flag, word, uses) {
  if (!word) return `curl ${flag} needs a value`;
  if (word.brace) return spellOut(`curl ${flag} "${word.text}" has an unquoted brace, which the shell expands into several arguments`, 'Send it once more with that value in quotes');
  if (CURL_WRITES_FILE.has(flag)) {
    if (unsafeDestination(word) || word.text.includes('#')) return spellOut(`curl ${flag} must name a literal path`);
    // `-` is curl's name for standard output, not a file.
    if (word.text !== '-') uses.push({text: word.text, writes: true});
    return null;
  }
  if (CURL_WRITE_OUT.has(flag)) {
    if (word.dynamic || /%output|^@/.test(word.text)) return `curl ${flag} can write a file, so its format must be literal and can't use %output or @`;
    return null;
  }
  const reads = curlReads(flag, word);
  if (reads?.refuse) return reads.refuse;
  if (reads) {
    if (word.dynamic || /[*?[\]{}#]/.test(reads.file)) return spellOut(`curl ${flag} must name a literal path`);
    uses.push({text: reads.file, writes: false});
  }
  return null;
}

function checkCurl(args, allowedHosts, uses) {
  // curl reads ~/.curlrc unless told not to, and that file can set a proxy.
  const first = args[0]?.text;
  if (first !== '-q' && first !== '--disable') return 'curl must start with -q, so no config file can redirect it';
  const notListed = text => `curl ${text} is not on this guard's list of options. It can't follow a redirect: read the Location and judge that host yourself`;
  let urls = 0;
  for (let i = 1; i < args.length; i++) {
    const {text, dynamic} = args[i];
    if (dynamic && text.startsWith('-')) return `"${text}" hides which curl option is used`;
    if (text === '--url') {
      const value = args[++i];
      const r = checkUrl(value?.text ?? '', allowedHosts);
      if (r) return r;
      urls++;
      continue;
    }
    if (text.startsWith('--')) {
      if (CURL_LONG_FLAGS.has(text)) continue;
      if (!CURL_LONG_WITH_VALUE.has(text)) return notListed(text);
      const r = checkCurlValue(text, args[++i], uses);
      if (r) return r;
      continue;
    }
    if (text.startsWith('-') && text.length > 1) {
      if (args[i].brace) return spellOut(`curl "${text}" has an unquoted brace, which the shell expands into several arguments`, 'Send it once more with that value in quotes');
      for (let k = 1; k < text.length; k++) {
        if (CURL_SHORT_FLAGS.has(text[k])) continue;
        if (!CURL_SHORT_WITH_VALUE.has(text[k])) return notListed(`-${text[k]}`);
        const attached = text.slice(k + 1);
        const value = attached ? {text: attached, dynamic} : args[++i];
        const r = checkCurlValue(`-${text[k]}`, value, uses);
        if (r) return r;
        break;
      }
      continue;
    }
    if (/[{}[\]]/.test(text.split(/[?#]/)[0]) && !/^https?:\/\/\[[0-9a-f:]+\]/i.test(text)) return `"${text}" uses curl URL globbing`;
    const r = checkUrl(text, allowedHosts);
    if (r) return r;
    urls++;
  }
  return urls ? null : 'curl with no literal URL can\'t be checked';
}

// Reads a sed script the way sed does and accepts only s, p, d, q and n. GNU sed
// can run programs through `e` and the `e` flag of `s`, and write files through
// `w`, `W` and the `w` flag, and matching those by pattern kept missing forms.
export function sedScriptAllowed(script) {
  let i = 0;
  const skip = () => { while (/[\s;]/.test(script[i] ?? '')) i++; };
  const delimited = (delim, brackets) => {
    while (i < script.length && script[i] !== delim) {
      if (script[i] === '\\') { i += 2; continue; }
      if (brackets && script[i] === '[') {
        i++;
        if (script[i] === '^') i++;
        if (script[i] === ']') i++;
        while (i < script.length && script[i] !== ']') i++;
      }
      i++;
    }
    if (i >= script.length) return false;
    i++;
    return true;
  };
  const address = () => {
    const number = /^(\d+(~\d+)?|\$)/.exec(script.slice(i));
    if (number) { i += number[0].length; return true; }
    if (script[i] === '/' || script[i] === '\\') {
      const delim = script[i] === '/' ? '/' : script[i + 1];
      i += script[i] === '/' ? 1 : 2;
      if (!delimited(delim, true)) return false;
      while (/[IM]/.test(script[i] ?? '')) i++;
      return true;
    }
    return false;
  };
  for (;;) {
    skip();
    if (i >= script.length) return true;
    if (address()) {
      if (script[i] === ',') {
        i++;
        if (/[+~]/.test(script[i] ?? '')) {
          i++;
          while (/\d/.test(script[i] ?? '')) i++;
        } else if (!address()) return false;
      }
    }
    while (/[\s!]/.test(script[i] ?? '')) i++;
    const command = script[i++];
    if (command === 's') {
      const delim = script[i++];
      if (!delim || /[\s\\]/.test(delim)) return false;
      if (!delimited(delim, true) || !delimited(delim, false)) return false;
      while (/[gpiIMm0-9]/.test(script[i] ?? '')) i++;
    } else if (!/^[pdqn]$/.test(command ?? '')) {
      return false;
    }
    if (i < script.length && !/[\s;]/.test(script[i])) return false;
  }
}

function checkSed(args, uses) {
  const scripts = [];
  const positional = [];
  let inPlace = false;
  let explicitScript = false;
  for (let i = 0; i < args.length; i++) {
    const word = args[i];
    if (word.dynamic) return `sed argument "${word.text}" must be literal: a variable could be a script or an option`;
    if (word.text === '-e') {
      explicitScript = true;
      if (!args[i + 1] || args[i + 1].dynamic) return 'sed -e needs a literal script';
      scripts.push(args[++i].text);
      continue;
    }
    // GNU sed reads what follows `i` in a cluster as a backup suffix: `-in` edits
    // in place and writes the original to a second file, named by adding `n`.
    if (/^-[nErsuz]*i?$/.test(word.text) && word.text.length > 1) {
      if (word.text.endsWith('i')) inPlace = true;
      continue;
    }
    if (word.text.startsWith('-') && word.text !== '-') return `sed ${word.text} is not on this guard's list of options`;
    positional.push(word);
  }
  if (!explicitScript) {
    const script = positional.shift();
    if (!script) return 'sed needs a script';
    scripts.push(script.text);
  }
  for (const script of scripts) {
    if (!sedScriptAllowed(script)) return `sed script "${script}" isn't made of s, p, d, q and n commands, which is all this guard can vouch for`;
  }
  for (const file of positional) {
    if (unsafeDestination(file) || file.brace) return spellOut(`sed on "${file.text}" must name a literal file`);
    uses.push({text: file.text, writes: inPlace});
  }
  return null;
}

function checkSort(args, uses) {
  for (let i = 0; i < args.length; i++) {
    const {text, dynamic} = args[i];
    if (dynamic) return `sort argument "${text}" must be literal: a variable could be an option`;
    if (/^-[bdfghiMnRrsuVz]+$/.test(text) || text === '-') continue;
    if (!text.startsWith('-')) {
      if (unsafeDestination(args[i])) return spellOut(`sort on "${text}" must name a literal file`);
      uses.push({text, writes: false});
      continue;
    }
    if (/^-[kt]/.test(text)) {
      if (text.length === 2) i++;
      continue;
    }
    if (/^-o/.test(text)) {
      const value = text.length > 2 ? {text: text.slice(2), dynamic: false} : args[++i];
      if (!value || unsafeDestination(value)) return spellOut('sort -o must name a literal path');
      uses.push({text: value.text, writes: true});
      continue;
    }
    return `sort ${text} is not on this guard's list of options`;
  }
  return null;
}

function checkAssignment(word, env) {
  const name = word.text.split('=')[0];
  // Setting one of these changes where curl connects or which program a name
  // finds, without appearing in anything checkUrl sees. An exported variable
  // stays exported when it is reassigned, so any of those can do the same.
  if (/^(PATH|CDPATH|IFS|HOME|ENV|BASH_ENV|GLOBIGNORE|LD_\w*|DYLD_\w*|CURL_\w*|\w*PROXY)$/i.test(name)
      || Object.keys(env).some(key => key.toLowerCase() === name.toLowerCase())) {
    return `setting ${name} is not allowed: it can change what later commands do`;
  }
  return protectedPath(word.text.slice(name.length + 1));
}

// The options each program that changes files may take. Anything else is refused,
// because an option is how `cp -t <dir>` or `mkdir -m` reaches past its arguments.
const WRITER_OPTIONS = {
  rm: ['-r', '-R', '-f', '-v'], mv: ['-f', '-n', '-v'], cp: ['-f', '-p', '-n', '-v'],
  mkdir: ['-p', '-v'], touch: ['-a', '-c', '-m'], tee: ['-a'], uniq: ['-c', '-d', '-u', '-i'],
  base64: ['-d', '-i', '--decode', '--ignore-garbage'],
};
const writerOption = (name, text) => WRITER_OPTIONS[name].includes(text)
  || (/^-[A-Za-z]+$/.test(text) && [...text.slice(1)].every(letter => WRITER_OPTIONS[name].includes(`-${letter}`)))
  || (name === 'base64' && /^(-w\d+|--wrap=\d+)$/.test(text));

// Options of grep and jq that take the words after them: how many, and whether the
// last of those is a file.
const VALUE_OPTIONS = {
  grep: {'-A': [1, false], '-B': [1, false], '-C': [1, false], '-m': [1, false], '-e': [1, false], '--regexp': [1, false], '-f': [1, true], '--file': [1, true]},
  jq: {'--arg': [2, false], '--argjson': [2, false], '--indent': [1, false], '-f': [1, true], '--from-file': [1, true], '--slurpfile': [2, true], '--rawfile': [2, true], '-L': [1, true]},
};
const GIVES_THE_PATTERN = new Set(['-e', '--regexp', '-f', '--file', '--from-file']);

// The files a command's arguments read and write. Every one is named literally:
// a variable or a glob in a path is how `rm …/target-gu*` and `cat ~/.ss?/id_rsa`
// reached files this guard protects by name.
function fileUses(name, args, uses) {
  if (DATA_ARGUMENTS.has(name)) return null;
  const files = [];
  const valued = VALUE_OPTIONS[name];
  let pattern = !valued;
  let options = true;
  for (let i = 0; i < args.length; i++) {
    const word = args[i];
    const {text} = word;
    if (options && text === '--') { options = false; continue; }
    if (options && text.startsWith('-') && text !== '-') {
      if (word.dynamic) return spellOut(`${name} "${text}" must be a literal option`);
      if (WRITER_OPTIONS[name] && !writerOption(name, text)) {
        return spellOut(`${name} ${text} is not among the options this guard lists for ${name}`, `Send it once more with only these options: ${WRITER_OPTIONS[name].join(' ')}`);
      }
      if (valued && text in valued) {
        const [count, isFile] = valued[text];
        if (GIVES_THE_PATTERN.has(text)) pattern = true;
        if (isFile && args[i + count]) files.push(args[i + count]);
        i += count;
      }
      continue;
    }
    // grep's pattern and jq's filter are data, and may come from a variable.
    if (!pattern) { pattern = true; continue; }
    files.push(word);
  }
  const variable = files.find(word => word.dynamic || word.glob || word.brace);
  if (variable) return spellOut(`${name} "${variable.text}" must name a literal path`);
  const texts = files.map(word => word.text);
  if (name === 'cp' && texts.length < 2) return 'cp needs a source and a destination';
  const written = name === 'rm' || name === 'mv' || name === 'mkdir' || name === 'touch' || name === 'tee' ? texts
    : name === 'cp' ? texts.slice(-1)
    : name === 'uniq' ? texts.slice(1)
    : [];
  texts.forEach((text, i) => uses.push({text, writes: written.includes(text) && (name !== 'cp' || i === texts.length - 1)}));
  return null;
}

const RUN_NAME = /^walkthrough-[A-Za-z0-9][A-Za-z0-9-]*$/;
const OUT_OF_PLACE = 'Send it once more writing only inside the run\'s working directory, by a path written out in full';

// Follows links in the part of a path that exists, so one planted earlier cannot
// hide where a path really leads.
function realExisting(abs, lib = path) {
  const tail = [];
  for (let head = abs; ;) {
    try {
      return lib.join(fs.realpathSync(head), ...tail);
    } catch {
      const parent = lib.dirname(head);
      if (parent === head) return abs;
      tail.unshift(lib.basename(head));
      head = parent;
    }
  }
}

function isDirectory(abs) {
  try {
    return fs.statSync(abs).isDirectory();
  } catch {
    return false;
  }
}

// Where the executor is, and where it may write. It writes to two places: the
// run's working directory, known by the two files Intake and the planner leave in
// it, and Playwright's output directory. That is a list of what is allowed. The
// list of protected names it replaces for writes kept missing files: a shell
// alias file, a workflow, this plugin's own agents.
export function makePlace({cwd, home = os.homedir(), env = process.env, lib = path, exists = fs.existsSync, real = realExisting, directory = isDirectory, named = false, project = null}) {
  const outputs = [lib.join(home, '.cache', 'agentic-qa', 'playwright-output')];
  if (env.CLAUDE_PLUGIN_DATA) outputs.push(lib.resolve(env.CLAUDE_PLUGIN_DATA, '..', '..', '..', '..', '.cache', 'agentic-qa', 'playwright-output'));
  const inside = (root, abs) => {
    const relative = lib.relative(root, abs);
    return relative === '' || (!relative.startsWith('..') && !lib.isAbsolute(relative));
  };
  const native = text => {
    const t = text === '~' || /^~[/\\]/.test(text) ? home + text.slice(1) : text;
    // Git Bash spells a drive /c/…, which Node on Windows reads as \c\… on the current drive.
    return lib === path.win32 ? t.replace(/^[/\\]([a-zA-Z])(?=[/\\]|$)/, '$1:') : t;
  };
  // `base` is every directory the shell might be in when a chain of && starts, and
  // `current` where it is at this point in the chain. Inside a chain a cd is
  // certain: what follows it runs only if it worked. Once the chain ends, a cd that
  // might have failed leaves both the old directory and the new one possible. A cd
  // that opens the whole command, to a directory that exists now, cannot have failed.
  let base = [cwd];
  let current = base;
  let moved = false;
  return {
    resolve: text => current.map(dir => real(lib.resolve(dir, native(text)), lib)),
    cd(text, first) {
      current = current.map(dir => lib.resolve(dir, native(text)));
      if (first && current.every(directory)) base = current;
      else moved = true;
    },
    endChain() {
      if (moved) base = [...new Set([...base, ...current])];
      current = base;
      moved = false;
    },
    writable(abs) {
      if (outputs.some(output => inside(output, abs))) return true;
      // qa-runner makes the run directory, so the two files that mark one are not
      // there yet. For it a run directory is known by its name, anywhere but inside
      // the project, where a new directory could be picked up by a test runner.
      if (named && abs.split(/[/\\]/).some(part => RUN_NAME.test(part)) && !(project && inside(real(lib.resolve(project), lib), abs))) return true;
      for (let dir = abs, depth = 0; depth < 64; depth++) {
        if (exists(lib.join(dir, 'intake.md')) && exists(lib.join(dir, 'step-plan.md'))) return true;
        const parent = lib.dirname(dir);
        if (parent === dir) return false;
        dir = parent;
      }
      return false;
    },
  };
}

function checkUse({text, writes}, what, place, readable) {
  const open = !writes && readable(text);
  const direct = open ? null : protectedPath(text);
  if (direct) return direct;
  if (!place) return null;
  for (const abs of place.resolve(text)) {
    const reason = open ? null : protectedPath(abs);
    if (reason) return reason;
    if (writes && !DEVICES.has(text) && !place.writable(abs)) {
      return spellOut(`${what} would write "${text}", which is outside the run's working directory`, OUT_OF_PLACE);
    }
  }
  return null;
}

function unreadable(err) {
  const reason = `the command could not be read safely (${err.message}); write it more simply`;
  return err instanceof Respell ? spellOut(reason, err.hint) : reason;
}

// What a response is put through before the executor sees it. Whatever a command
// prints is kept in the transcript, and a response can carry a credential nobody
// asked for: the response that creates a record often returns its token. Telling the
// executor to mask held in two fixture runs of three. So its curl may print a body
// only through this filter, exactly, and may not print headers at all.
export const RESPONSE_MASK = 'walk(if type == "object" then with_entries(if (.key | test("token|secret|password|passwd|pwd|key|session|auth|jwt|otp|cookie|credential"; "i")) and (.value | type == "string") then .value = "<masked>" else . end) else . end)';
const MASKED_CURL = `curl -q -sS -w '%{stderr}HTTP %{http_code}\\n' <options> <url> | jq '${RESPONSE_MASK}'`;
const JQ_PLAIN_OPTIONS = new Set(['-c', '-C', '-M', '-S', '-e']);
const sameFilter = text => text.replace(/\s+/g, ' ').trim() === RESPONSE_MASK;

// The options a curl command uses, read the way checkCurl reads them.
function curlOptions(args) {
  const used = new Map();
  for (let i = 0; i < args.length; i++) {
    const {text} = args[i];
    if (text.startsWith('--')) {
      const takes = CURL_LONG_WITH_VALUE.has(text) || text === '--url';
      used.set(text, takes ? args[++i]?.text ?? '' : true);
    } else if (text.startsWith('-') && text.length > 1) {
      for (let k = 1; k < text.length; k++) {
        if (!CURL_SHORT_WITH_VALUE.has(text[k])) { used.set(`-${text[k]}`, true); continue; }
        used.set(`-${text[k]}`, text.slice(k + 1) || (args[++i]?.text ?? ''));
        break;
      }
    }
  }
  return used;
}

// Applied to the executor after everything else has passed, so a host that isn't
// allowed is still refused as that, and not as a matter of form.
export function checkResponseMask(command) {
  let commands;
  try {
    commands = parseShell(command);
  } catch {
    return null;
  }
  for (let i = 0; i < commands.length; i++) {
    let words, redirects;
    try {
      ({words, redirects} = splitRedirects(commands[i]));
    } catch {
      continue;
    }
    if (!words.length || words[0].dynamic || commandName(words[0].text) !== 'curl') continue;
    const used = curlOptions(words.slice(1));
    if (['-i', '-I', '-v', '-D', '--include', '--head', '--verbose', '--dump-header'].some(flag => used.has(flag))) {
      return spellOut('curl may not print headers here: they carry cookies and tokens, and what is printed is kept',
        "Send it once more without -i, -I, -v or -D, and ask for what you need from the headers with -w: %{http_code}, %{redirect_url}, %{content_type}, %header{name}");
    }
    const file = used.get('-o') ?? used.get('--output');
    if (file === '/dev/null') continue;
    if (file !== undefined || redirects.some(redirect => redirect.writes && redirect.target.text !== '/dev/null')) {
      return spellOut('curl would write an unmasked response to a file', `Send it once more as: ${MASKED_CURL} | tee <file>`);
    }
    const next = commands[i].next === '|' && !commands[i].sub ? commands[i + 1] : null;
    const jq = next && !next[0].dynamic && commandName(next[0].text) === 'jq' ? next.slice(1).filter(word => !word.redirect) : null;
    const filters = jq ? jq.filter(word => !JQ_PLAIN_OPTIONS.has(word.text)) : [];
    if (!jq || filters.length !== 1 || filters[0].dynamic || !sameFilter(filters[0].text)) {
      return spellOut('curl\'s response must go straight through the mask before anything is printed: it can carry a token nobody asked for',
        `Send it once more as: ${MASKED_CURL} — with that filter exactly, or with -o /dev/null if only the status matters`);
    }
  }
  return null;
}

// What gh may be asked: to read issues and pull requests. It runs with whatever
// token the machine has, and a default one can comment, merge and delete.
const GH_READS = {issue: ['view', 'list'], pr: ['view', 'list', 'diff', 'checks'], search: ['prs', 'issues'], repo: ['view'], auth: ['status']};

function checkGh(args) {
  const [group, verb, ...rest] = args;
  if (!group || !verb || group.dynamic || verb.dynamic || !(GH_READS[group.text] ?? []).includes(verb.text)) {
    return `gh ${group?.text ?? ''} ${verb?.text ?? ''} is not one of the gh commands this agent may run: it reads issues and pull requests, and changes nothing`;
  }
  if (rest.some(word => word.text === '--web' || word.text === '-w')) return 'gh --web opens a browser on this machine';
  return null;
}

// git is asked three questions, in exactly these forms. Most git commands take an
// option that writes a file or starts a program.
const GIT_FORMS = 'git ls-files --error-unmatch <file>, git merge-base --is-ancestor <commit> <commit>, git rev-parse <ref>';

function checkGit(args, uses) {
  if (args.some(word => word.dynamic || word.glob || word.brace)) return spellOut('git must be given literal arguments');
  let words = args.map(word => word.text);
  if (words[0] === '-C') {
    if (!words[1]) return 'git -C needs a directory';
    uses.push({text: words[1], writes: false});
    words = words.slice(2);
  }
  const rev = /^[A-Za-z0-9][A-Za-z0-9._/~^@-]*$/;
  const ok = (words[0] === 'ls-files' && words.length === 3 && words[1] === '--error-unmatch' && !words[2].startsWith('-'))
    || (words[0] === 'merge-base' && words.length === 4 && words[1] === '--is-ancestor' && rev.test(words[2]) && rev.test(words[3]))
    || (words[0] === 'rev-parse' && (words.length === 2 || (words.length === 3 && ['--short', '--verify'].includes(words[1]))) && rev.test(words.at(-1)));
  return ok ? null : spellOut(`git ${words.join(' ')} is not one of the forms this agent may run`, `Send it once more as one of: ${GIT_FORMS}`);
}

// Waiting on a signal file is the one loop any agent here needs, so it is accepted
// in exactly this form and no other loop is.
const WAIT_LOOP = /^until \[ -f (?:"[^"$`\\\n]+"|'[^'\n]+'|[^\s"'$`\;&|<>()]+) \]; do sleep \d{1,3}; done(?:[ \t]*(?:;|&&|\n)\s*(?=\S)|$)/;

// The executor runs a fixed list, plus what a person listed for the system under
// test. qa-runner runs the same list, plus gh and git for reading and the wait. It
// reads the settings files, which it has to copy into intake.md, and so may name
// them where it only reads.
const EXECUTOR_PROFILE = {programs: EXECUTOR_COMMANDS, listed: true, handlers: {}, readable: () => false, wait: false, who: 'the executor'};
export const RUNNER_COMMANDS = new Set([...EXECUTOR_COMMANDS, 'gh', 'git']);
const RUNNER_PROFILE = {
  programs: RUNNER_COMMANDS, listed: false, handlers: {gh: checkGh, git: checkGit}, wait: true, who: 'qa-runner',
  // The settings file, and the directory it would be in, to see whether it is there.
  readable: text => /(^|[/\\])\.claude([/\\]agentic-qa\.local\.md|[/\\]?)$/i.test(text),
};

// The script the reporter runs to render the HTML report. It is this plugin's own
// file, beside this hook, and a plugin is normally installed under ~/.claude, which
// is protected as a whole. So it is allowed by being exactly this file, and only as
// what `node` is asked to run.
export const RENDERER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'qa-reporting', 'scripts', 'render-report.mjs');

function isRenderer(text, renderer) {
  if (!text || !path.isAbsolute(text)) return false;
  try {
    return fs.realpathSync(text) === fs.realpathSync(renderer);
  } catch {
    return false;
  }
}

// The reporter fills in a report, renders it, and copies both to a report
// destination. Its list is the executor's file and text tools without curl, and node
// for one thing: this plugin's renderer, given the run's working directory. It had
// been barred from network programs by name, which any interpreter gets round.
export const REPORTER_COMMANDS = new Set([...[...EXECUTOR_COMMANDS].filter(name => name !== 'curl'), 'node']);

function checkRendererCall(args, uses, renderer) {
  if (args.some(word => word.dynamic || word.glob || word.brace)) return spellOut('node must be given the renderer and the working directory as literal paths');
  if (args.length !== 2 || !isRenderer(args[0].text, renderer) || args[1].text.startsWith('-')) {
    return spellOut('node runs one thing for the reporter: this plugin\'s render-report.mjs, by its full path, with the working directory after it',
      'Send it once more as: node "<the qa-reporting skill\'s base directory>/scripts/render-report.mjs" "<working directory>"');
  }
  // It writes the page into that directory, which therefore has to be a run's.
  uses.push({text: path.join(args[1].text, 'walkthrough-report.html'), writes: true});
  return null;
}

// The evidence folder goes to a report destination whole. A directory copied whole
// has to be inside a run directory itself, which is what marking the source as
// written checks: cp -r of anything else would carry it to wherever reports go.
function checkReporterCp(args, uses) {
  const isRecursive = word => !word.dynamic && /^-[A-Za-z]*[rR][A-Za-z]*$/.test(word.text);
  const recursive = args.some(isRecursive);
  const plain = args.map(word => isRecursive(word) ? {...word, text: word.text.replace(/[rR]/g, '')} : word).filter(word => word.text !== '-');
  const before = uses.length;
  const reason = fileUses('cp', plain, uses);
  if (!reason && recursive) for (let i = before; i < uses.length; i++) uses[i].writes = true;
  return reason;
}

const reporterProfile = renderer => ({
  programs: REPORTER_COMMANDS, listed: false, wait: false, who: 'the reporter', readable: () => false,
  handlers: {node: (args, uses) => checkRendererCall(args, uses, renderer), cp: checkReporterCp},
});

// `place` says where the command runs, and turns on the rules about where it may
// write. The hook always passes one. Without it only the text is judged.
export const checkExecutorBash = (command, settings, env = process.env, place = null) => checkHeldBash(command, settings, env, place, EXECUTOR_PROFILE);
export const checkRunnerBash = (command, settings, env = process.env, place = null) => checkHeldBash(command, settings, env, place, RUNNER_PROFILE);
export const checkReporterBash = (command, settings, env = process.env, place = null, renderer = RENDERER) => checkHeldBash(command, settings, env, place, reporterProfile(renderer));

function checkHeldBash(command, settings, env, place, profile) {
  if (profile.wait) {
    // What follows the wait, such as reading the file it waited for, is an ordinary command.
    const wait = WAIT_LOOP.exec(command.trim());
    if (wait) {
      const rest = command.trim().slice(wait[0].length);
      return rest ? checkHeldBash(rest, settings, env, place, {...profile, wait: false}) : null;
    }
    if (/^\s*(until|while)\b/.test(command)) {
      return spellOut('a loop is accepted only as the wait on a signal file', 'Send it once more written exactly as: until [ -f <path> ]; do sleep 2; done');
    }
  }
  let commands;
  try {
    commands = parseShell(command);
  } catch (err) {
    return unreadable(err);
  }
  const extra = new Set(profile.listed ? settings.allowed_commands : []);
  const first = commands.find(raw => !raw.sub);
  for (const raw of commands) {
    const uses = [];
    let words;
    try {
      const split = splitRedirects(raw);
      words = split.words;
      for (const redirect of split.redirects) {
        const reason = checkRedirect(redirect);
        if (reason) return reason;
        uses.push({text: redirect.target.text, writes: redirect.writes});
      }
    } catch (err) {
      return unreadable(err);
    }
    let n = 0;
    while (n < words.length && isAssignment(words[n])) {
      const reason = checkAssignment(words[n], env);
      if (reason) return reason;
      n++;
    }
    let name = 'a redirect';
    if (n < words.length) {
      // `A=1 cmd` reaches a program as its environment, and no list of names can
      // say which variables a given program acts on.
      if (n > 0) return `setting ${words[0].text.split('=')[0]} in front of a command is not allowed`;
      const head = words[n];
      if (head.dynamic) return `"${head.text}" hides which program runs`;
      // A path means a file the run may have written itself, whatever its name.
      if (/[/\\]/.test(head.text)) return `"${head.text}" runs a program by path`;
      name = commandName(head.text);
      const args = words.slice(n + 1);
      const split = args.find(a => a.split);
      if (split) return spellOut(`"${split.text}" must be in double quotes: unquoted, the shell can split it into extra arguments`);
      if (extra.has(name) && !NETWORK_TOOLS.has(name)) {
        // A person listed this program, and it can do anything. Its arguments are
        // still not allowed to name what this guard protects.
        for (const word of args) {
          const reason = protectedPath(word.text);
          if (reason) return reason;
        }
      } else {
        // A loop or a condition is a way of writing commands, not a program to be
        // allowed or refused: say so, and the same commands can come back one by one.
        if (SHELL_KEYWORDS.has(name)) {
          return spellOut(`"${name}" is shell syntax this guard does not read: no loop and no condition is accepted, but for the wait on a signal file`,
            'Send it once more as plain commands, one for each item, joined by ; or && if you like');
        }
        if (!profile.programs.has(name)) {
          return profile.listed ? `${name} is not in allowed_commands, so a person hasn't said this run may start it`
            : `${name} is not a program ${profile.who} may start`;
        }
        if (name === 'printf' && args[0] && (args[0].dynamic || args[0].text.startsWith('-'))) {
          return 'printf\'s first argument must be a literal format: -v sets a variable';
        }
        let reason = null;
        if (name === 'cd') {
          const [to] = args;
          if (raw.sub) return 'cd inside a substitution is not allowed';
          if (args.length !== 1 || to.dynamic || to.glob || to.brace || to.text === '-') return spellOut('cd must name one literal directory');
          reason = protectedPath(to.text);
          if (!reason && place) place.cd(to.text, raw === first);
        } else if (name === 'curl') reason = checkCurl(args, settings.allowed_hosts, uses);
        else if (name === 'sed') reason = checkSed(args, uses);
        else if (name === 'sort') reason = checkSort(args, uses);
        else if (profile.handlers[name]) reason = profile.handlers[name](args, uses);
        else reason = fileUses(name, args, uses);
        if (reason) return reason;
      }
    }
    for (const use of uses) {
      const reason = checkUse(use, name, place, profile.readable);
      if (reason) return reason;
    }
    if (place && !raw.sub && raw.next !== '&&') place.endChain();
  }
  return null;
}

export function checkRestrictedBash(command, renderer = RENDERER) {
  let commands;
  try {
    commands = parseShell(command);
  } catch {
    commands = command.split(/[\s;|&()`<>]+/).map(text => [{text, dynamic: false}]);
  }
  for (const raw of commands) {
    const plain = raw.filter(word => !word.redirect);
    const runsRenderer = plain[0] && !plain[0].dynamic && commandName(plain[0].text) === 'node' && plain[1] && !plain[1].dynamic && isRenderer(plain[1].text, renderer);
    for (const word of raw) {
      if (word.redirect) continue;
      if (runsRenderer && word === plain[1]) continue;
      const reason = protectedPath(word.text);
      if (reason) return reason;
      if (/(^|[/\\])dev[/\\]+(tcp|udp)([/\\]|$)/i.test(word.text)) return `"${word.text}" opens a network connection`;
    }
    const words = raw.filter(word => !word.redirect);
    if (words[0] && NETWORK_TOOLS.has(commandName(words[0].text))) {
      return `${commandName(words[0].text)} is not available to this agent`;
    }
  }
  return null;
}

function checkFileTool(file) {
  if (!file) return 'a file tool call must name its path';
  const direct = protectedPath(file);
  if (direct) return direct;
  // A link planted earlier would otherwise hide the real destination.
  return protectedPath(realExisting(path.resolve(file)));
}

export function decide(input, settings, env = process.env) {
  const {agent_type: agent, tool_name: tool, tool_input: args = {}} = input;
  if (!agent?.startsWith(PLUGIN_AGENT)) return null;
  // The hook always knows where it is. Tests that judge text alone leave cwd out.
  // A critic may be spawned before the plan exists, so like qa-runner it knows a run
  // directory by its name.
  const named = agent === RUNNER || CRITICS.has(agent) || agent === REPORTER;
  // A report destination can be anywhere a person chose, the project included. What
  // makes it a place the reporter may write is that its folder is named for the run.
  const place = (agent === EXECUTOR || named) && input.cwd
    ? makePlace({cwd: input.cwd, env, named, project: agent === REPORTER ? null : env.CLAUDE_PROJECT_DIR || input.cwd}) : null;
  if (tool === 'Write' || tool === 'Edit' || tool === 'NotebookEdit') {
    const file = args.file_path ?? args.notebook_path ?? '';
    const reason = checkFileTool(file);
    if (reason || !place) return reason;
    return place.resolve(file).every(place.writable) ? null
      : spellOut(`${tool} would write "${file}", which is outside the run's working directory`, OUT_OF_PLACE);
  }
  // A plugin agent spawns only this plugin's agents: any other type is outside this guard.
  if (tool === 'Agent') {
    const type = String(args.subagent_type ?? '');
    return type.startsWith(PLUGIN_AGENT) ? null
      : spellOut(`spawning "${type || 'an agent with no subagent_type'}" is not allowed: this plugin's agents spawn only ${PLUGIN_AGENT}* agents, and one with no type is a general-purpose agent this guard does not hold`,
        `Send it once more with subagent_type set to the ${PLUGIN_AGENT}* agent you mean`);
  }
  if (NETWORK_RESTRICTED.has(agent)) {
    return tool === 'Bash' ? checkRestrictedBash(args.command ?? '') : null;
  }
  if (agent === RUNNER) return tool === 'Bash' ? checkRunnerBash(args.command ?? '', settings, env, place) : null;
  if (agent === REPORTER) return tool === 'Bash' ? checkReporterBash(args.command ?? '', settings, env, place) : null;
  if (agent !== EXECUTOR) return null;
  if (tool === 'Bash') return checkExecutorBash(args.command ?? '', settings, env, place) ?? checkResponseMask(args.command ?? '');
  if (args.url === 'about:blank') return null;
  return checkUrl(args.url ?? '', settings.allowed_hosts);
}

export function nextStep(reason) {
  return isFormRefusal(reason)
    ? `This is about how the command is written, not what it reaches. ${FORM_REFUSALS.get(reason)}. If that is refused too, end your turn with an ESCALATION saying what was refused`
    : 'Do not rephrase this to get past it: end your turn with an ESCALATION saying what was refused';
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
    if (!input.agent_type?.startsWith(PLUGIN_AGENT)) return;
    let reason;
    try {
      input.cwd ||= process.cwd();
      const settings = loadSettings(process.env.CLAUDE_PROJECT_DIR || input.cwd);
      reason = decide(input, settings);
      if (reason && settings.problems.length && /is not in allowed_(hosts|commands)/.test(reason)) {
        reason += `. The settings may be why: ${settings.problems.join('; ')}`;
      }
    } catch (err) {
      // A crash here would otherwise count as "allow", since a failing hook doesn't block.
      reason = `the target guard failed (${err.message}), so nothing it would check can run`;
    }
    if (reason) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `agentic-qa target guard: ${reason}. ${nextStep(reason)}.`,
        },
      }));
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
