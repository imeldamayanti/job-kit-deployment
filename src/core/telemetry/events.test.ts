import { describe, expect, it } from 'vitest'
import { afterSend, buildBatch, describePending, EVENT_NAMES, initialTelemetry, recordEvent, setTelemetry, shouldSend } from './events'

const DAY = '2026-10-18'
const on = () => setTelemetry(initialTelemetry(), true)

describe('telemetry events', () => {
  it('knows a fixed list of names and nothing else', () => {
    expect(EVENT_NAMES).toEqual(['fill', 'application_added', 'cv_built', 'letter_built', 'feed_run', 'sync_run', 'error'])
  })

  it('is off by default and records nothing while off', () => {
    const state = initialTelemetry()
    expect(state.enabled).toBe(false)
    expect(recordEvent(state, 'fill', DAY)).toBe(state)
  })

  it('counts events per day and name once on', () => {
    let state = on()
    state = recordEvent(state, 'fill', DAY)
    state = recordEvent(state, 'fill', DAY)
    state = recordEvent(state, 'cv_built', DAY)
    expect(state.counts).toEqual({ [DAY]: { fill: 2, cv_built: 1 } })
  })

  it('ignores a name that is not on the list, so nothing free-form can sneak in', () => {
    const state = on()
    expect(recordEvent(state, 'someone@example.com' as never, DAY)).toBe(state)
  })

  it('turning it off throws away what was waiting', () => {
    const state = recordEvent(on(), 'fill', DAY)
    expect(setTelemetry(state, false)).toEqual(initialTelemetry())
  })

  it('builds rows with name, day, version and count, and no identifier of any kind', () => {
    const state = recordEvent(recordEvent(on(), 'fill', DAY), 'error', '2026-10-17')
    const rows = buildBatch(state, '0.1.0')
    expect(rows).toEqual([
      { name: 'error', day: '2026-10-17', version: '0.1.0', count: 1 },
      { name: 'fill', day: DAY, version: '0.1.0', count: 1 },
    ])
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(['count', 'day', 'name', 'version'])
  })

  it('sends nothing for a version that does not look like a version, or when off', () => {
    const state = recordEvent(on(), 'fill', DAY)
    expect(buildBatch(state, 'v1; DROP TABLE')).toEqual([])
    expect(buildBatch(setTelemetry(state, false), '0.1.0')).toEqual([])
  })

  const NEXT = '2026-10-19'

  it('sends finished days only, at most once a day, and only when something is waiting', () => {
    const waiting = recordEvent(on(), 'fill', DAY)
    expect(shouldSend(on(), NEXT, '0.1.0')).toBe(false)
    expect(shouldSend(waiting, DAY, '0.1.0')).toBe(false) // today is still growing
    expect(shouldSend(waiting, NEXT, '0.1.0')).toBe(true)
    expect(shouldSend({ ...waiting, lastSentDay: NEXT }, NEXT, '0.1.0')).toBe(false)
  })

  it('leaves today out of the batch', () => {
    const state = recordEvent(recordEvent(on(), 'fill', DAY), 'fill', NEXT)
    expect(buildBatch(state, '0.1.0', NEXT).map((r) => r.day)).toEqual([DAY])
  })

  it('after a send, clears the days that went out, keeps today, and remembers the day', () => {
    const state = afterSend(recordEvent(recordEvent(on(), 'fill', DAY), 'fill', NEXT), NEXT)
    expect(state.counts).toEqual({ [NEXT]: { fill: 1 } })
    expect(state.lastSentDay).toBe(NEXT)
    expect(state.enabled).toBe(true)
  })

  it('shows the person, in words, exactly what would go out next', () => {
    const state = recordEvent(recordEvent(recordEvent(on(), 'fill', DAY), 'fill', DAY), 'cv_built', DAY)
    expect(describePending(state, '0.1.0')).toEqual([`${DAY}: CV dibuat × 1, Fill dipakai × 2 (versi 0.1.0)`])
    expect(describePending(on(), '0.1.0')).toEqual([])
  })
})
