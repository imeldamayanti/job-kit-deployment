// What an account may do, worked out from its credit status (spec §5.1). Pure: the status comes from platform/account.ts.
// `paid` is "has bought credits at least once" (accounts.unlocked_at). It is not `Account.unlocked` of platform/sync.ts,
// which is the sync key being open.
export type AccountStatus = {
  credits: number
  paid: boolean
  trialGranted: boolean
  // When the whole balance lapses (ISO), or null when there is nothing to lapse.
  expiresAt: string | null
  // When this status was last read from the server (ISO).
  checkedAt: string
}

export type AccessLevel = 'preview' | 'free' | 'trial' | 'paid'

// `preview` is not signed in. A signed-in account whose status is not known yet counts as `free`.
export function accessLevel(signedIn: boolean, status: AccountStatus | null): AccessLevel {
  if (!signedIn) return 'preview'
  if (status?.paid) return 'paid'
  if (status && status.credits > 0) return 'trial'
  return 'free'
}

// `open`: Lowongan, Lamaran, Profile and Data are open and editable for every signed-in account (free, trial, paid).
// Whether the AI buttons are enabled is decided separately by the credit balance (credits > 0), not by the feature
// mode: when credits run out only AI stops.
// `locked`: preview only, i.e. not signed in (sample data, every action disabled).
export type FeatureMode = 'open' | 'locked'

// preview -> locked; every signed-in level (free, trial, paid, even with an unknown status) -> open.
export function featureMode(level: AccessLevel, _status: AccountStatus | null): FeatureMode {
  return level === 'preview' ? 'locked' : 'open'
}

const WARNING_DAYS = 30
const DAY_MS = 86_400_000

// True while credits remain and the balance lapses within 30 days (or already has).
export function expiryWarning(status: AccountStatus | null, now: Date): boolean {
  if (!status || status.credits <= 0 || status.expiresAt === null) return false
  const expires = Date.parse(status.expiresAt)
  if (Number.isNaN(expires)) return false
  return expires - now.getTime() <= WARNING_DAYS * DAY_MS
}

// The one package on sale. The server holds the real price (table `packages`); this is for display.
export const PACKAGE = { id: 'basic', priceIdr: 10800, credits: 50 } as const

// "Rp10.800": dots between thousands, written by hand so it never depends on the browser's locale data.
export function formatRupiah(value: number): string {
  return `Rp${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}
