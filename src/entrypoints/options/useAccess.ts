import { useCallback, useEffect, useRef, useState } from 'react'
import { accessLevel, featureMode, type AccessLevel, type AccountStatus, type FeatureMode } from '../../core/account/access'
import { loadAccountStatus, refreshAccountStatus } from '../../platform/account'
import { currentSession, storedUserId } from '../../platform/sync'

// Where the sign-in stands on this page (spec §5.1, §5.5):
//   checking   - nothing read yet
//   signed-in  - a session exists, or one is stored and cannot be refreshed right now (offline: the cached status is used)
//   signed-out - nobody ever signed in here: the preview with sample data
//   expired    - there was a session and it cannot be refreshed any more: back to the sign-in gate, the data stays
export type SessionState = 'checking' | 'signed-in' | 'signed-out' | 'expired'

// What the AI buttons may do. Only the credit balance decides it, never the feature mode (spec §5.1).
//   signed-out - preview: "Masuk untuk memakai"
//   checking   - signed in, but the balance is not known yet (status null): neither locked nor "Beli kredit"
//   no-credits - balance 0: the button is off with the reason, and "Beli kredit" is offered
//   ready      - credits left
export type AiAvailability = 'signed-out' | 'checking' | 'no-credits' | 'ready'

export function aiAvailability(level: AccessLevel, status: AccountStatus | null): AiAvailability {
  if (level === 'preview') return 'signed-out'
  if (status === null) return 'checking'
  return status.credits > 0 ? 'ready' : 'no-credits'
}

// The reason shown with an AI button that is off. One text for "not enough credits", shared with the cost buttons of the CV and letter tabs.
export const AI_GATE_TEXT: Record<Exclude<AiAvailability, 'ready'>, string> = {
  'signed-out': 'Masuk untuk memakai',
  checking: 'Memeriksa saldo kredit…',
  'no-credits': 'Kredit tidak cukup. Butuh 1 kredit; saldomu 0.',
}

export type Access = {
  level: AccessLevel
  status: AccountStatus | null
  // Reads the session and the balance again (after signing in, buying, or a generate).
  refresh: () => Promise<void>
  session: SessionState
  // False until the first read of the session is in; the page draws nothing account-shaped before that.
  ready: boolean
  mode: FeatureMode
  ai: AiAvailability
}

// The access of whoever has this page open. The cached status shows at once and works offline; the network check follows.
// `enabled` is false in builds without accounts (own key, shared): nothing is read and nothing is sent.
export function useAccess(enabled = true): Access {
  const [session, setSession] = useState<SessionState>('checking')
  const [status, setStatus] = useState<AccountStatus | null>(null)
  const wasSignedIn = useRef(false)
  const latest = useRef(0)
  const alive = useRef(true)

  const check = useCallback(async () => {
    latest.current += 1
    const mine = latest.current
    const stale = () => !alive.current || latest.current !== mine

    const before = await storedUserId()
    if (before !== null) {
      const cached = await loadAccountStatus()
      if (stale()) return
      wasSignedIn.current = true
      setStatus(cached)
      setSession('signed-in')
    }

    const live = await currentSession()
    if (stale()) return
    if (live === null) {
      // A session that is still stored but could not be refreshed (no network) stays: the cached status is used.
      if ((await storedUserId()) !== null) return
      if (stale()) return
      const expired = before !== null || wasSignedIn.current
      wasSignedIn.current = false
      setStatus(null)
      setSession(expired ? 'expired' : 'signed-out')
      return
    }

    wasSignedIn.current = true
    setSession('signed-in')
    const fresh = await refreshAccountStatus()
    if (!stale()) setStatus(fresh)
  }, [])

  useEffect(() => {
    alive.current = true
    if (enabled) void check()
    return () => {
      alive.current = false
    }
  }, [check, enabled])

  const level = accessLevel(session === 'signed-in', status)
  return { level, status, refresh: check, session, ready: session !== 'checking', mode: featureMode(level, status), ai: aiAvailability(level, status) }
}
