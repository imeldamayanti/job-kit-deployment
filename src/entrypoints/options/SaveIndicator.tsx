import { Check } from 'lucide-react'
import type { SaveState } from '../../core/profile/autosave'

export function SaveIndicator({ state }: { state: SaveState | 'idle' }) {
  return (
    <p
      aria-live="polite"
      className="inline-flex h-6 min-w-24 items-center justify-end gap-1 text-[12px] font-semibold text-green-700"
    >
      {state === 'saved' && (
        <>
          <Check size={14} strokeWidth={2} aria-hidden="true" />
          Tersimpan
        </>
      )}
    </p>
  )
}
