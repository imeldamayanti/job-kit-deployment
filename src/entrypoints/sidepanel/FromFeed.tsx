import { bannerText } from '../../core/feed/opened'
import type { PanelTab } from '../../platform/panel-context'
import { DocChip } from '../../ui/primitives/DocChip'

// Shown when the active tab was opened by Buka & isi: where it came from, and, when the job has an application,
// which of its documents are ready (S1).
export function FromFeed({ tab }: { tab: PanelTab | undefined }) {
  if (!tab) return null
  const { opened, context } = tab
  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-lg bg-accent-wash px-3 py-2 text-[13px] font-semibold text-text-primary">
        {bannerText(opened)}
        <span className="block truncate text-[12px] font-normal text-text-secondary">{opened.title}</span>
      </p>
      {context && (
        <div className="flex flex-wrap gap-1.5">
          <DocChip kind="cv" ok={context.cvReady} label={context.cvReady ? 'CV siap' : 'CV belum'} />
          <DocChip kind="letter" ok={context.letterReady} label={context.letterReady ? 'Surat siap' : 'Surat belum'} />
        </div>
      )}
    </div>
  )
}
