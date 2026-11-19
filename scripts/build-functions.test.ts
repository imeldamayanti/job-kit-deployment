// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { CV_SYSTEM } from '../src/core/tailor/prompt'

// vitest runs from the repository root.
const root = `${process.cwd()}/`
const FUNCTIONS = ['generate', 'create-payment', 'midtrans-callback'] as const
const bundle = (name: string) => readFileSync(`${root}supabase/functions/${name}/index.ts`, 'utf8')

// The Edge Functions are bundled from src/ so the server and the extension share one source (spec §5.4). These tests build for real.
describe('build-functions', () => {
  beforeAll(() => {
    execFileSync('node', ['scripts/build-functions.mjs'], { cwd: root, stdio: 'pipe' })
  }, 60_000)

  it('writes supabase/functions/<name>/index.ts for all three functions', () => {
    for (const name of FUNCTIONS) expect(existsSync(`${root}supabase/functions/${name}/index.ts`), name).toBe(true)
  })

  it('leaves no extension or browser code in any bundle', () => {
    for (const name of FUNCTIONS) {
      const code = bundle(name)
      expect(code, name).not.toContain('chrome.')
      expect(code, name).not.toContain('browser.')
      expect(code, name).not.toContain('wxt')
    }
  })

  it('serves each function with Deno.serve', () => {
    for (const name of FUNCTIONS) expect(bundle(name), name).toContain('Deno.serve')
  })

  it('bundles the one CV prompt of src/core into generate', () => {
    const code = bundle('generate')
    // Line by line: the bundler may re-wrap a template literal, but not change its text.
    for (const line of CV_SYSTEM.split('\n').filter((text) => text.trim())) expect(code).toContain(line)
  })
})
