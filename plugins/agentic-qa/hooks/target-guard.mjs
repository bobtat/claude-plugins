#!/usr/bin/env node
// PreToolUse guard: holds agentic-qa's own agents to the person-owned allowlist.
// Every other agent and session passes straight through.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const PLUGIN_AGENT = 'agentic-qa:';
const EXECUTOR = 'agentic-qa:step-executor';
const NETWORK_RESTRICTED = new Set([
  'agentic-qa:qa-reporter',
  'agentic-qa:behavior-coverage-critic',
  'agentic-qa:step-plan-critic',
]);
const ALWAYS_ALLOWED_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

// Throughout, these are lists of what may run, not of what may not: programs,
// curl and sort options, sed commands. Each denylist this guard started with was
// bypassed by something it hadn't named, such as an abbreviated long option.
// awk, find, xargs and env are absent because each can start another program.
const EXECUTOR_COMMANDS = new Set([
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
  '--retry-delay', '--cacert',
]);
const CURL_WRITES_FILE = new Set(['-o', '--output', '-D', '--dump-header', '-c', '--cookie-jar']);
const CURL_READS_FILE = new Set(['-T', '--upload-file']);
const CURL_DATA = new Set(['-d', '--data', '--data-binary', '--data-urlencode', '--json', '-F', '--form']);
const CURL_WRITE_OUT = new Set(['-w', '--write-out']);

// Programs that read their arguments as data rather than as paths.
const DATA_ARGUMENTS = new Set(['echo', 'printf', 'tr', 'sleep', 'date', 'true', 'false', 'test', '[']);
// Programs whose first positional argument is a pattern or filter, not a path.
const PATTERN_FIRST = new Set(['jq', 'grep']);
const WRITES_TO_ARGUMENTS = new Set(['cp', 'mv', 'tee', 'touch', 'mkdir', 'uniq']);

// What decides this guard's behaviour, or what runs later, must not be writable
// by the agents it guards.
const PROTECTED_FILE = /(^|[/\\])(agentic-qa\.local\.md|[._]curlrc|[._]netrc|\.bashrc|\.bash_profile|\.bash_login|\.bash_logout|\.profile|\.zshrc|\.zshenv|\.zprofile|\.gitconfig|\.mcp\.json|settings(\.local)?\.json|target-guard\.mjs|hooks\.json|CLAUDE\.md|AGENTS\.md)[. ]*(:.*)?$/i;
const PROTECTED_DIR = /(^|[/\\])(\.ssh|\.git|\.husky|\.kube|\.aws|\.config|\.docker|\.gnupg)([/\\]|$)/i;
// Windows short names reach these without spelling them, and only these are
// refused because `RUNNER~1` is an ordinary part of a CI temp path.
const PROTECTED_SHORT_NAME = /(^|[/\\])_?(AGENTI|CURLRC|NETRC|CLAUDE|BASHRC|BASH_|PROFIL|ZSHRC|ZSHENV|ZPROFI|GITCON|SETTIN|MCP|SSH|GIT|HUSKY|KUBE|AWS|CONFIG|DOCKER|GNUPG|TARGET|HOOKS)[A-Z0-9_-]*~\d/i;
const CLAUDE_DIR = /(^|[/\\])\.claude([/\\]|$)/i;
// A run's own files can legitimately live here: the session scratchpad and
// Playwright's output directory.
const CLAUDE_DIR_EXEMPT = /(^|[/\\])\.claude[/\\](jobs|plugins[/\\]data)[/\\]/i;

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

export function parseSettings(text) {
  const out = {allowed_hosts: [], allowed_commands: []};
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return out;
  let key = null;
  for (const raw of match[1].split(/\r?\n/)) {
    const top = /^([A-Za-z_]+):/.exec(raw);
    if (top) { key = top[1]; continue; }
    const item = /^\s+-\s+(.+?)\s*$/.exec(raw);
    if (item && Object.hasOwn(out, key ?? '')) {
      out[key].push(item[1].replace(/\s+#.*$/, '').replace(/^["']|["']$/g, '').toLowerCase());
    }
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
// as commands of their own. `dynamic` marks a word that an expansion could change
// at run time. `split` marks one whose expansion is unquoted, which the shell can
// turn into several words, so nothing checked here describes what actually runs.
export function parseShell(src) {
  const commands = [];
  const stack = [{words: [], word: null}];
  let heredocs = [];
  const top = () => stack[stack.length - 1];
  const start = () => { top().word ??= {text: '', dynamic: false, split: false}; return top().word; };
  const endWord = () => { const f = top(); if (f.word) { f.words.push(f.word); f.word = null; } };
  const endCommand = () => { endWord(); const f = top(); if (f.words.length) commands.push(f.words); f.words = []; };
  let i = 0;
  const openSub = close => {
    const word = start();
    word.dynamic = true;
    word.split = true;
    stack.push({words: [], word: null, close});
  };
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
    if (c === '$' && src[i + 1] === '(') { openSub(')'); i += 2; continue; }
    if (c === '`') { openSub('`'); i++; continue; }
    if (c === '$') {
      const word = start();
      word.dynamic = true;
      word.split = true;
      word.text += c;
      i++;
      continue;
    }
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
    const redirect = /^(?:&>>?|>&|>>?\|?|<&|<>|<<<|<)/.exec(src.slice(i));
    if (redirect) {
      if (f.word && !f.word.dynamic && /^\d+$/.test(f.word.text)) f.word = null;
      else endWord();
      f.words.push({text: redirect[0], dynamic: false, split: false, redirect: true});
      i += redirect[0].length;
      continue;
    }
    if (c === '\n' || c === ';' || c === '|' || c === '&' || c === '(' || c === ')') {
      endCommand();
      if (c === '\n' && heredocs.length) i = skipHeredocs(src, i + 1, heredocs) - 1;
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

function skipHeredocs(src, start, heredocs) {
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

function splitRedirects(raw) {
  const words = [];
  const writes = [];
  for (let i = 0; i < raw.length; i++) {
    if (!raw[i].redirect) { words.push(raw[i]); continue; }
    const target = raw[++i];
    if (target && /^(&>>?|>>?\|?|>&|<>)$/.test(raw[i - 1].text)) writes.push(target);
  }
  return {words, writes};
}

const commandName = text => text.replace(/\\/g, '/').split('/').pop().toLowerCase().replace(/\.exe$/, '');

function checkCurlValue(flag, word) {
  if (!word) return `curl ${flag} needs a value`;
  if (CURL_WRITES_FILE.has(flag) || CURL_READS_FILE.has(flag)) {
    if (unsafeDestination(word) || word.text.includes('#')) return `curl ${flag} must name a literal path`;
    return protectedPath(word.text);
  }
  if (CURL_WRITE_OUT.has(flag)) {
    if (word.dynamic || /%output|^@/.test(word.text)) return `curl ${flag} can write a file, so its format must be literal and can't use %output or @`;
    return null;
  }
  if (CURL_DATA.has(flag)) {
    const file = /(?:^|=)[@<](.*)$/.exec(word.text);
    return file ? protectedPath(file[1]) : null;
  }
  return null;
}

function checkCurl(args, allowedHosts) {
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
      const r = checkCurlValue(text, args[++i]);
      if (r) return r;
      continue;
    }
    if (text.startsWith('-') && text.length > 1) {
      for (let k = 1; k < text.length; k++) {
        if (CURL_SHORT_FLAGS.has(text[k])) continue;
        if (!CURL_SHORT_WITH_VALUE.has(text[k])) return notListed(`-${text[k]}`);
        const attached = text.slice(k + 1);
        const value = attached ? {text: attached, dynamic} : args[++i];
        const r = checkCurlValue(`-${text[k]}`, value);
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

function checkSed(args) {
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
    if (/^-[nErsuzi]+$/.test(word.text)) {
      if (word.text.includes('i')) inPlace = true;
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
    if (inPlace && unsafeDestination(file)) return `sed -i on "${file.text}" must name a literal file`;
    const reason = protectedPath(file.text);
    if (reason) return reason;
  }
  return null;
}

function checkSort(args) {
  for (let i = 0; i < args.length; i++) {
    const {text, dynamic} = args[i];
    if (dynamic) return `sort argument "${text}" must be literal: a variable could be an option`;
    if (/^-[bdfghiMnRrsuVz]+$/.test(text) || text === '-' || !text.startsWith('-')) continue;
    if (/^-[kt]/.test(text)) {
      if (text.length === 2) i++;
      continue;
    }
    if (/^-o/.test(text)) {
      const value = text.length > 2 ? {text: text.slice(2), dynamic: false} : args[++i];
      if (!value || unsafeDestination(value)) return 'sort -o must name a literal path';
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

// Words that could be paths, for the protected-file check. Data and patterns are
// skipped, because `jq .profile` and `sed -n 1~2p` aren't touching anything.
function pathArguments(name, args) {
  if (DATA_ARGUMENTS.has(name) || name === 'curl' || name === 'sed') return [];
  if (PATTERN_FIRST.has(name)) {
    const first = args.findIndex(a => !a.text.startsWith('-'));
    return args.filter((_, i) => i !== first);
  }
  return args;
}

export function checkExecutorBash(command, settings, env = process.env) {
  let commands;
  try {
    commands = parseShell(command);
  } catch (err) {
    return `the command could not be read safely (${err.message}); write it more simply`;
  }
  const extra = new Set(settings.allowed_commands);
  for (const raw of commands) {
    const {words, writes} = splitRedirects(raw);
    for (const target of writes) {
      if (unsafeDestination(target)) return `a redirect to "${target.text}" must name a literal path`;
      const reason = protectedPath(target.text);
      if (reason) return reason;
    }
    let n = 0;
    while (n < words.length && isAssignment(words[n])) {
      const reason = checkAssignment(words[n], env);
      if (reason) return reason;
      n++;
    }
    if (n >= words.length) continue;
    // `A=1 cmd` reaches a program as its environment, and no list of names can
    // say which variables a given program acts on.
    if (n > 0) return `setting ${words[0].text.split('=')[0]} in front of a command is not allowed`;
    const head = words[n];
    if (head.dynamic) return `"${head.text}" hides which program runs`;
    // A path means a file the run may have written itself, whatever its name.
    if (/[/\\]/.test(head.text)) return `"${head.text}" runs a program by path`;
    const name = commandName(head.text);
    const args = words.slice(n + 1);
    const split = args.find(a => a.split);
    if (split) return `"${split.text}" must be in double quotes: unquoted, the shell can split it into extra arguments`;
    for (const word of pathArguments(name, args)) {
      const reason = protectedPath(word.text);
      if (reason) return reason;
    }
    if (extra.has(name) && !NETWORK_TOOLS.has(name)) continue;
    if (!EXECUTOR_COMMANDS.has(name)) {
      return `${name} is not in allowed_commands, so a person hasn't said this run may start it`;
    }
    if (name === 'cd' && args.some(a => a.dynamic)) return 'cd must name a literal directory';
    if (WRITES_TO_ARGUMENTS.has(name)) {
      const unsafe = args.find(unsafeDestination);
      if (unsafe) return `${name} on "${unsafe.text}" must name literal paths`;
    }
    if (name === 'printf' && args[0] && (args[0].dynamic || args[0].text.startsWith('-'))) {
      return 'printf\'s first argument must be a literal format: -v sets a variable';
    }
    let reason = null;
    if (name === 'curl') reason = checkCurl(args, settings.allowed_hosts);
    if (name === 'sed') reason = checkSed(args);
    if (name === 'sort') reason = checkSort(args);
    if (reason) return reason;
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
    for (const word of raw) {
      const reason = word.redirect ? null : protectedPath(word.text);
      if (reason) return reason;
    }
    const {words} = splitRedirects(raw);
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
  let resolved = path.resolve(file);
  for (;;) {
    try {
      resolved = fs.realpathSync(resolved);
      break;
    } catch {
      const parent = path.dirname(resolved);
      if (parent === resolved) break;
      resolved = parent;
    }
  }
  return protectedPath(resolved);
}

export function decide(input, settings) {
  const {agent_type: agent, tool_name: tool, tool_input: args = {}} = input;
  if (!agent?.startsWith(PLUGIN_AGENT)) return null;
  if (tool === 'Write' || tool === 'Edit' || tool === 'NotebookEdit') {
    return checkFileTool(args.file_path ?? args.notebook_path ?? '');
  }
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
    if (!input.agent_type?.startsWith(PLUGIN_AGENT)) return;
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
