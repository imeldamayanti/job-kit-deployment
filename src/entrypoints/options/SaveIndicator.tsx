import type { SaveState } from '../../core/profile/autosave'

export function SaveIndicator({ state }: { state: SaveState | 'idle' }) {
  return (
    <p aria-live="polite" className="inline-flex h-6 min-w-24 items-center justify-end gap-2 text-[13px] text-text-secondary">
      {state === 'saved' && (
        <>
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-green-700" />
          Tersimpan
        </>
      )}
    </p>
  )
}
