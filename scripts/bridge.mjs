// Jembatan lokal: extension -> http://127.0.0.1:8787 -> `claude -p` (pakai login Claude Code di mesin ini).
// Jalankan: node scripts/bridge.mjs. Tempel token yang tercetak ke "Kunci API" (penyedia Claude Code) di Atur Lowongan.
// Hanya untuk pemakaian pribadi di mesin sendiri; jangan dibagikan atau dipasang di server.
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'

const PORT = Number(process.env.BRIDGE_PORT || 8787)
const TOKEN_FILE = new URL('../.env.bridge', import.meta.url)
const MAX_BODY = 200_000
const TIMEOUT_MS = 120_000
const MODEL = /^[\w.\-[\]]{1,64}$/

const token = existsSync(TOKEN_FILE) ? readFileSync(TOKEN_FILE, 'utf8').trim() : ''
const secret = token || randomBytes(24).toString('hex')
if (!token) writeFileSync(TOKEN_FILE, `${secret}\n`, { mode: 0o600 })

function runClaude({ model, system, user }) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      '--output-format', 'text',
      '--tools', '',
      '--setting-sources', '',
      '--strict-mcp-config',
      '--disable-slash-commands',
      '--no-session-persistence',
      '--model', model,
    ]
    if (system) args.push('--system-prompt', system)
    // Run from a temp dir so no project CLAUDE.md is picked up.
    const child = spawn('claude', args, { cwd: tmpdir(), stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS)
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) => { clearTimeout(timer); reject(e) })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0 && out.trim() !== '') resolve(out.trim())
      else reject(new Error(err.trim().slice(0, 300) || `claude exit ${code}`))
    })
    child.stdin.end(user)
  })
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin || ''
  const fromExtension = origin.startsWith('chrome-extension://')
  const reply = (status, body) => {
    res.writeHead(status, {
      'content-type': 'application/json',
      ...(fromExtension && { 'access-control-allow-origin': origin, vary: 'Origin' }),
    })
    res.end(JSON.stringify(body))
  }
  // Only the extension may call this; a web page in the browser carries a web Origin.
  if (!fromExtension) return reply(403, { error: 'origin' })
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'POST',
      'access-control-max-age': '600',
      vary: 'Origin',
    })
    return res.end()
  }
  if (req.method !== 'POST' || req.url !== '/complete') return reply(404, { error: 'not-found' })
  if (req.headers.authorization !== `Bearer ${secret}`) return reply(401, { error: 'token' })

  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > MAX_BODY) return reply(413, { error: 'too-large' })
  }
  let body
  try { body = JSON.parse(raw) } catch { return reply(400, { error: 'json' }) }
  const { model, system = '', user } = body ?? {}
  if (typeof user !== 'string' || user.trim() === '' || typeof system !== 'string' || typeof model !== 'string' || !MODEL.test(model)) {
    return reply(400, { error: 'bad-request' })
  }
  try {
    const text = await runClaude({ model, system, user })
    console.log(`${new Date().toLocaleTimeString()} ${model} ok (${user.length} char in, ${text.length} out)`)
    reply(200, { text })
  } catch (e) {
    console.error(`${new Date().toLocaleTimeString()} ${model} gagal: ${e.message}`)
    reply(502, { error: 'claude' })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Bridge job-kit di http://127.0.0.1:${PORT}`)
  console.log(`Token (tempel ke Kunci API): ${secret}`)
})
