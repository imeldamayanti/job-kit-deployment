export type SaveOutcome = { ok: true } | { ok: false; reason: 'storage-full' }
export type SaveState = 'saving' | 'saved' | 'storage-full'

export type Autosaver<T> = {
  schedule: (value: T) => void
  flush: () => Promise<void>
}

export function createAutosaver<T>(
  save: (value: T) => Promise<SaveOutcome>,
  delayMs: number,
  onState?: (state: SaveState) => void,
): Autosaver<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: { value: T } | undefined

  async function run(): Promise<void> {
    timer = undefined
    if (!pending) return
    const { value } = pending
    pending = undefined
    onState?.('saving')
    const outcome = await save(value)
    onState?.(outcome.ok ? 'saved' : outcome.reason)
  }

  return {
    schedule(value) {
      pending = { value }
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => void run(), delayMs)
    },
    async flush() {
      if (timer !== undefined) clearTimeout(timer)
      await run()
    },
  }
}
