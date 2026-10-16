import { FileText } from 'lucide-react'

// "CV" or "Surat": green when the document exists, grey when not. A marker, not a button (design-system §4.4).
// `label` replaces the word when the marker says more, as in the panel ("CV siap").
export function DocChip({ kind, ok, label }: { kind: 'cv' | 'letter'; ok: boolean; label?: string }) {
  return (
    <span
      data-doc={kind}
      data-ok={ok}
      className={'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ' + (ok ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-text-secondary')}
    >
      <FileText size={12} strokeWidth={2} aria-hidden="true" />
      {label ?? (kind === 'cv' ? 'CV' : 'Surat')}
    </span>
  )
}
