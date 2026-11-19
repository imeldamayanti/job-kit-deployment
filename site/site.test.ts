// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = __dirname
const pages = readdirSync(dir).filter((f) => f.endsWith('.html'))
const read = (f: string) => readFileSync(join(dir, f), 'utf8')

describe('static site', () => {
  it('has the pages the plan asks for', () => {
    expect(pages.sort()).toEqual(['admin.html', 'harga.html', 'index.html', 'masukan.html', 'pasang.html', 'privasi.html'])
  })

  it('keeps the admin page out of search results and out of the public navigation', () => {
    expect(read('admin.html')).toContain('noindex')
    for (const page of pages.filter((p) => p !== 'admin.html')) expect(read(page)).not.toContain('/admin')
  })

  it.each(pages)('%s is a complete Indonesian page with a title and viewport', (page) => {
    const html = read(page)
    expect(html).toContain('<html lang="id">')
    expect(html).toMatch(/<title>[^<]{5,}<\/title>/)
    expect(html).toContain('name="viewport"')
    expect(html).toContain('name="description"')
  })

  it.each(pages)('%s links only to files and pages that exist', (page) => {
    const hrefs = [...read(page).matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]!)
    for (const href of hrefs.filter((h) => h.startsWith('/') && !h.startsWith('/_vercel'))) {
      const path = href === '/' ? 'index.html' : href.slice(1)
      expect(existsSync(join(dir, path)) || existsSync(join(dir, `${path}.html`)), `${page} -> ${href}`).toBe(true)
    }
  })

  it('privacy page says what Lowongan sends and that the extension has no telemetry', () => {
    const html = read('privasi.html')
    expect(html).toContain('role incaran dan lokasi')
    expect(html).toContain('telemetri <b>mati secara bawaan</b>')
    expect(html).toContain('Draf.')
    expect(html).toContain('Supabase')
  })

  it('privacy page describes the account, the AI server, and Midtrans instead of the old no-account text', () => {
    const html = read('privasi.html')
    expect(html).not.toContain('tidak memakai akun')
    expect(html).not.toContain('belum tersedia di versi ini')
    expect(html).toContain('Midtrans')
    expect(html).toContain('penyedia AI')
  })

  it('price page states the package, the all-in price, non-cash-out credits, and the 1 year expiry', () => {
    const html = read('harga.html')
    for (const text of ['Rp10.800', '50 kredit', 'sudah termasuk semua biaya', 'tidak bisa diuangkan', '1 tahun']) {
      expect(html, text).toContain(text)
    }
    expect(html.toLowerCase()).not.toContain('admin')
  })

  it('links the price page from every public page', () => {
    for (const page of pages.filter((p) => p !== 'admin.html')) expect(read(page), page).toContain('href="/harga"')
  })

  it('_headers carries the same CSP as vercel.json', () => {
    const config = JSON.parse(read('vercel.json'))
    const csp: string = config.headers[0].headers.find((h: { key: string }) => h.key === 'Content-Security-Policy').value
    const headers = read('_headers')
    expect(headers).toMatch(/^\/\*$/m)
    expect(headers).toContain(`Content-Security-Policy: ${csp}`)
    expect(headers).toContain('X-Content-Type-Options: nosniff')
    expect(headers).toContain('X-Frame-Options: DENY')
  })

  it('loads no third-party script besides Vercel analytics', () => {
    for (const page of pages) {
      const srcs = [...read(page).matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]!)
      for (const src of srcs) expect(src.startsWith('/'), `${page}: ${src}`).toBe(true)
    }
  })

  it('ships only a public Supabase key, or none yet', async () => {
    const { SUPABASE } = await import('./config.js')
    const { isPublicKey } = await import('./feedback-core.js')
    expect(SUPABASE.url === '' || /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(SUPABASE.url)).toBe(true)
    expect(SUPABASE.key === '' || isPublicKey(SUPABASE.key)).toBe(true)
  })

  it('has the feedback table script: insert-only for anon, RLS on, no select policy', () => {
    const sql = readFileSync(join(dir, 'supabase/feedback.sql'), 'utf8')
    expect(sql).toContain('enable row level security')
    expect(sql).toMatch(/for insert\s+to anon/)
    expect(sql).not.toMatch(/for (select|update|delete|all)/i)
    expect(sql).toContain('grant insert on public.feedback to anon')
  })

  it('vercel.json: clean URLs and a CSP that allows only itself plus Supabase', () => {
    const config = JSON.parse(read('vercel.json'))
    expect(config.cleanUrls).toBe(true)
    const headers = Object.fromEntries(config.headers[0].headers.map((h: { key: string; value: string }) => [h.key, h.value]))
    const csp: string = headers['Content-Security-Policy']
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toMatch(/connect-src 'self' https:\/\/\*\.supabase\.co/)
    expect(csp).not.toContain('unsafe-inline')
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it.each(pages)('%s has no inline style or script, so the CSP does not break it', (page) => {
    const html = read(page)
    expect(html).not.toMatch(/\sstyle="/)
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/)
    expect(html).not.toMatch(/\son[a-z]+="/)
  })

  it('keeps tests, SQL and docs out of the deploy', () => {
    const ignore = read('.vercelignore').split('\n')
    for (const entry of ['*.test.ts', '*.d.ts', 'supabase', 'README.md']) expect(ignore).toContain(entry)
  })
})
