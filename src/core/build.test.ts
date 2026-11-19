import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aiModeFrom, isShareBuild } from './build'
import { SUPABASE_CONFIG } from './sync/config'

describe('isShareBuild', () => {
  it('is on only for the string "true"', () => {
    expect(isShareBuild('true')).toBe(true)
    expect(isShareBuild(undefined)).toBe(false)
    expect(isShareBuild('1')).toBe(false)
    expect(isShareBuild('')).toBe(false)
  })
})

describe('aiModeFrom', () => {
  it('turns AI off for the shared build, whatever the mode says', () => {
    expect(aiModeFrom(undefined, 'true')).toBe('off')
    expect(aiModeFrom('byok', 'true')).toBe('off')
    expect(aiModeFrom('server', 'true')).toBe('off')
  })

  it('uses the owner key only when the mode is exactly "byok"', () => {
    expect(aiModeFrom('byok', undefined)).toBe('byok')
    expect(aiModeFrom('byok', 'false')).toBe('byok')
    expect(aiModeFrom('BYOK', undefined)).toBe('server')
  })

  it('defaults to the server, for an unset or unknown mode', () => {
    expect(aiModeFrom(undefined, undefined)).toBe('server')
    expect(aiModeFrom('', '')).toBe('server')
    expect(aiModeFrom('server', undefined)).toBe('server')
    expect(aiModeFrom('whatever', '1')).toBe('server')
  })
})

// `AI_MODE` is written as literal comparisons so the bundler can fold them, and `aiModeFrom` states the same rules for wxt.config.ts
// and the tests. This is what keeps the two from drifting apart: every combination of the two variables must give the same mode.
describe('AI_MODE agrees with aiModeFrom', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  const share = [undefined, 'true', 'false', '1', ''] as const
  const mode = [undefined, 'byok', 'server', 'BYOK', 'whatever', ''] as const
  const cases = share.flatMap((s) => mode.map((m) => [s, m] as const))

  it.each(cases)('share %j, mode %j', async (s, m) => {
    vi.resetModules()
    vi.stubEnv('WXT_SHARE_BUILD', s as string)
    vi.stubEnv('WXT_AI_MODE', m as string)
    const build = await import('./build')
    expect(build.AI_MODE).toBe(aiModeFrom(m, s))
    expect(build.AI_ENABLED).toBe(build.AI_MODE !== 'off')
  })
})

// The default (server) build must carry no AI provider address and no owner key: the AI is on our server. The test reads the
// bundle that `npm run build` wrote, so it is skipped when there is none, or when the last build in .output was another mode
// (the own-key build, `npm run build:byok`, writes to the same folder and is meant to contain them).
const OUT = resolve(process.cwd(), '.output/chrome-mv3')
const FORBIDDEN = ['api.anthropic.com', 'generativelanguage.googleapis.com', 'opencode.ai', '127.0.0.1:8787', 'bandelbanget']

function isServerBuild(): boolean {
  try {
    const manifest = JSON.parse(readFileSync(resolve(OUT, 'manifest.json'), 'utf8')) as { host_permissions?: string[] }
    return (manifest.host_permissions ?? []).some((host) => host.includes(new URL(SUPABASE_CONFIG.url).host))
  } catch {
    return false
  }
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? filesUnder(resolve(dir, entry.name)) : [resolve(dir, entry.name)]))
}

describe.skipIf(!existsSync(OUT) || !isServerBuild())('the server build bundle', () => {
  const files = existsSync(OUT) ? filesUnder(OUT).filter((file) => /\.(js|mjs|html|css|json)$/.test(file)) : []

  it('has files to look at', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(FORBIDDEN)('does not contain %s', (needle) => {
    const hits = files.filter((file) => readFileSync(file, 'utf8').includes(needle)).map((file) => file.slice(OUT.length + 1))
    expect(hits).toEqual([])
  })
})
