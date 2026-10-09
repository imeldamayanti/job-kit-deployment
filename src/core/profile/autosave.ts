export type SaveState = 'saving' | 'saved'

export type Autosaver<T> = {
  schedule: (value: T) => void
  flush: () => Promise<void>
}

export function createAutosaver<T>(
  save: (value: T) => Promise<void>,
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
    await save(value)
    onState?.('saved')
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
