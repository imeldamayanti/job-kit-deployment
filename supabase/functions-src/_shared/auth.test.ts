// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { userFromRequest } from './auth'

const base64url = (text: string) => Buffer.from(text, 'utf8').toString('base64url')
const token = (payload: unknown) => `${base64url('{"alg":"HS256"}')}.${base64url(JSON.stringify(payload))}.signature`
const withAuth = (value: string | null) => new Request('https://f.test/generate', { method: 'POST', headers: value === null ? {} : { authorization: value } })

describe('userFromRequest', () => {
  it('reads sub and email from the token payload', () => {
    expect(userFromRequest(withAuth(`Bearer ${token({ sub: 'u-1', email: 'a@b.test' })}`))).toEqual({ id: 'u-1', email: 'a@b.test' })
  })

  it('reads a non-ASCII email and a payload whose base64url needs padding', () => {
    expect(userFromRequest(withAuth(`Bearer ${token({ sub: 'u-2', email: 'dewí@b.test' })}`))).toEqual({ id: 'u-2', email: 'dewí@b.test' })
    expect(userFromRequest(withAuth(`Bearer ${token({ sub: 'u-3' })}`))).toEqual({ id: 'u-3', email: null })
  })

  it('has no user for a key without sub, such as the anon key', () => {
    expect(userFromRequest(withAuth(`Bearer ${token({ role: 'anon' })}`))).toBeNull()
  })

  it('returns null for a missing header or a malformed token', () => {
    for (const value of [null, '', 'Bearer', 'Bearer a.b', 'Bearer a.b.c', 'Bearer a.!!!.c', `Bearer ${base64url('x')}.${base64url('not json')}.s`, `Token ${token({ sub: 'u' })}`]) {
      expect(userFromRequest(withAuth(value)), String(value)).toBeNull()
    }
    expect(userFromRequest(withAuth(`Bearer ${token(['sub'])}`))).toBeNull()
    expect(userFromRequest(withAuth(`Bearer ${token({ sub: 5 })}`))).toBeNull()
  })
})
