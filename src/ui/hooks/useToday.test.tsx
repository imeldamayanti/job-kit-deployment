import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToday } from './useToday'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement | null = null

function Day() {
  return <span>{useToday()}</span>
}

async function render() {
  container = document.createElement('div')
  document.body.append(container)
  await act(async () => createRoot(container!).render(<Day />))
  return container
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  container?.remove()
})

describe('useToday', () => {
  it('is today on the person’s own clock', async () => {
    vi.setSystemTime(new Date(2026, 9, 15, 10, 0))

    expect((await render()).textContent).toBe('2026-10-15')
  })

  it('moves to the next day at midnight, without a reload', async () => {
    vi.setSystemTime(new Date(2026, 9, 15, 23, 59, 0))
    const root = await render()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
    })

    expect(root.textContent).toBe('2026-10-16')
  })

  it('catches up when the tab wakes after a long sleep', async () => {
    vi.setSystemTime(new Date(2026, 9, 15, 22, 0))
    const root = await render()

    vi.setSystemTime(new Date(2026, 9, 17, 9, 0))
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(root.textContent).toBe('2026-10-17')
  })
})
