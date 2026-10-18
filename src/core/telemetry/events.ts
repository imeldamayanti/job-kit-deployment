// Opt-in, anonymous usage counts (PRD §4.4, RFC D18). Only these names, a day, the version and a count ever leave the browser:
// no id of any kind, no text from the person's data. Pure; the platform stores the state and sends the batch.

export const EVENT_NAMES = ['fill', 'application_added', 'cv_built', 'letter_built', 'feed_run', 'sync_run', 'error'] as const
export type EventName = (typeof EVENT_NAMES)[number]

export type TelemetryState = {
  enabled: boolean
  // day (YYYY-MM-DD) -> name -> count, waiting to be sent
  counts: Record<string, Partial<Record<EventName, number>>>
  lastSentDay: string | null
}

export type EventRow = { name: EventName; day: string; version: string; count: number }

export const initialTelemetry = (): TelemetryState => ({ enabled: false, counts: {}, lastSentDay: null })

const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/
const VERSION_FORMAT = /^\d+\.\d+\.\d+$/
const isName = (value: string): value is EventName => (EVENT_NAMES as readonly string[]).includes(value)

// Turning it off forgets what was waiting; turning it on starts from nothing.
export const setTelemetry = (state: TelemetryState, enabled: boolean): TelemetryState => (enabled ? { ...state, enabled: true } : initialTelemetry())

export function recordEvent(state: TelemetryState, name: EventName, day: string): TelemetryState {
  if (!state.enabled || !isName(name) || !DAY_FORMAT.test(day)) return state
  const today = state.counts[day] ?? {}
  return { ...state, counts: { ...state.counts, [day]: { ...today, [name]: (today[name] ?? 0) + 1 } } }
}

// `before`: only days strictly earlier are included, so today's counts keep growing and go out whole tomorrow.
export function buildBatch(state: TelemetryState, version: string, before?: string): EventRow[] {
  if (!state.enabled || !VERSION_FORMAT.test(version)) return []
  return Object.keys(state.counts)
    .filter((day) => before === undefined || day < before)
    .sort()
    .flatMap((day) =>
      Object.entries(state.counts[day] ?? {})
        .filter(([name, count]) => isName(name) && Number.isInteger(count) && (count as number) > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name: name as EventName, day, version, count: count as number })),
    )
}

export const shouldSend = (state: TelemetryState, today: string, version = '0.0.0'): boolean =>
  state.enabled && state.lastSentDay !== today && buildBatch(state, version, today).length > 0

// Removes what went out (days before today); today's counts stay.
export const afterSend = (state: TelemetryState, today: string): TelemetryState => ({
  ...state,
  counts: Object.fromEntries(Object.entries(state.counts).filter(([day]) => day >= today)),
  lastSentDay: today,
})

export const EVENT_LABEL: Record<EventName, string> = {
  fill: 'Fill dipakai',
  application_added: 'Lamaran ditambah',
  cv_built: 'CV dibuat',
  letter_built: 'Surat dibuat',
  feed_run: 'Lowongan diambil',
  sync_run: 'Sinkron jalan',
  error: 'Ada error',
}

// What the person sees on the Akun page: the next batch, in words.
export function describePending(state: TelemetryState, version: string): string[] {
  const rows = buildBatch(state, version)
  const days = [...new Set(rows.map((r) => r.day))]
  return days.map((day) => `${day}: ${rows.filter((r) => r.day === day).map((r) => `${EVENT_LABEL[r.name]} × ${r.count}`).join(', ')} (versi ${version})`)
}
