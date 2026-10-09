import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosaver } from './autosave'

describe('createAutosaver', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves only the latest value after the delay, once', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const saver = createAutosaver<string>(save, 400)

    saver.schedule('a')
    saver.schedule('ab')
    saver.schedule('abc')
    await vi.advanceTimersByTimeAsync(399)
    expect(save).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('abc')
  })

  it('reports saving, then saved, and saved within 2 seconds of the change', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const states: string[] = []
    const saver = createAutosaver<string>(save, 400, (state) => states.push(state))

    saver.schedule('x')
    await vi.advanceTimersByTimeAsync(2000)

    expect(states).toEqual(['saving', 'saved'])
  })

  it('flush saves a pending value immediately', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const saver = createAutosaver<string>(save, 400)

    saver.schedule('pending')
    await saver.flush()

    expect(save).toHaveBeenCalledWith('pending')
  })
})
