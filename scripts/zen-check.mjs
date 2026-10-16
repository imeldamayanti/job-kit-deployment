// Tests an OpenCode Zen key from the terminal, outside the extension. Reads .env.local; prints status only, never the key.
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.startsWith('#'))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
)
const key = env.ZEN_API_KEY
const model = env.ZEN_MODEL || 'space-bunny-free'
if (!key) {
  console.error('ZEN_API_KEY di .env.local masih kosong.')
  process.exit(1)
}

const responses = model.startsWith('muse-')
const url = `https://opencode.ai/zen/v1/${responses ? 'responses' : 'chat/completions'}`
const body = responses
  ? { model, input: 'Balas satu kata: ok', max_output_tokens: 64 }
  : { model, max_tokens: 64, messages: [{ role: 'user', content: 'Balas satu kata: ok' }] }

const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify(body) })
const text = await res.text()
console.log(`${model} -> HTTP ${res.status}`)
console.log(text.slice(0, 600))
process.exit(res.ok ? 0 : 1)
