import { TriangleAlert } from 'lucide-react'

export function StorageFullNotice() {
  return (
    <div role="alert" className="flex items-center gap-2 rounded-lg border border-border bg-rose-50 px-4 py-3 text-rose-700">
      <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" className="shrink-0" />
      <p className="text-[13px] font-semibold">Tidak tersimpan — penyimpanan penuh. Data lama aman.</p>
    </div>
  )
}
