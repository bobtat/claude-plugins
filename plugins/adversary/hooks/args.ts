export type Options = { brief?: string; focus?: string; model?: 'opus' | 'sonnet' | 'haiku' }
export type Args =
  | ({ sub: 'pr'; target: string } & Options)
  | ({ sub: 'plan' } & Options)
  | ({ sub: 'doc'; target: string } & Options)
  | { sub: 'triage' }

export const USAGE = [
  '/adversary pr <number|url>   [--brief <key|#n|url|"text">] [--focus "..."] [--model opus|sonnet|haiku]',
  '/adversary plan              [--brief ...] [--focus ...] [--model ...]',
  '/adversary doc <path>        [--brief ...] [--focus ...] [--model ...]',
  '/adversary triage            reopen the triage pane for the last review',
].join('\n')

const MODELS = ['opus', 'sonnet', 'haiku'] as const

type Token = { text: string; quoted: boolean }
type Result = { ok: true; args: Args } | { ok: false; error: string }

const fail = (message: string): Result => ({ ok: false, error: `${message}\n${USAGE}` })

function tokenize(raw: string): Token[] | null {
  const tokens: Token[] = []
  let i = 0
  while (i < raw.length) {
    if (/\s/.test(raw[i])) {
      i++
    } else if (raw[i] === '"') {
      let text = ''
      i++
      while (i < raw.length && raw[i] !== '"') {
        if (raw[i] === '\\' && raw[i + 1] === '"') i++
        text += raw[i++]
      }
      if (i >= raw.length) return null
      i++
      tokens.push({ text, quoted: true })
    } else {
      let text = ''
      while (i < raw.length && !/\s/.test(raw[i])) text += raw[i++]
      tokens.push({ text, quoted: false })
    }
  }
  return tokens
}

// A quoted token is always a value, so "--force" inside quotes is never mistaken for a flag.
const isFlag = (t: Token) => !t.quoted && t.text.startsWith('--')

export function parseArgs(raw: string): Result {
  const tokens = tokenize(raw)
  if (!tokens) return fail('Unterminated quote.')

  const options: Options = {}
  const positional: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (!isFlag(token)) {
      positional.push(token.text)
      continue
    }
    const name = token.text.slice(2)
    if (name !== 'brief' && name !== 'focus' && name !== 'model') return fail(`Unknown option ${token.text}.`)
    const value = tokens[++i]
    if (!value || isFlag(value) || value.text.trim() === '') return fail(`${token.text} needs a value.`)
    if (name === 'model') {
      const model = MODELS.find(m => m === value.text)
      if (!model) return fail(`Unknown model "${value.text}"; use ${MODELS.join(', ')}.`)
      options.model = model
    } else {
      options[name] = value.text
    }
  }

  const [sub, ...rest] = positional
  if (!sub) return fail('Missing subcommand.')

  switch (sub) {
    case 'triage':
      if (rest.length > 0 || Object.keys(options).length > 0) return fail('triage takes no arguments or options.')
      return { ok: true, args: { sub } }
    case 'plan':
      if (rest.length > 0) return fail('plan takes no target.')
      return { ok: true, args: { sub, ...options } }
    case 'pr':
    case 'doc':
      if (rest.length !== 1 || rest[0].trim() === '') return fail(`${sub} needs exactly one target.`)
      return { ok: true, args: { sub, target: rest[0], ...options } }
    default:
      return fail(`Unknown subcommand "${sub}".`)
  }
}
