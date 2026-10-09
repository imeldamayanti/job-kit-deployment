import { useEffect, useState } from 'react'
import { bannerText, type OpenedJob } from '../../core/feed/opened'
import { loadOpened } from '../../platform/opened-jobs'

// Shown when the active tab was opened from the Lowongan page.
export function FromFeed({ tabId }: { tabId: number | undefined }) {
  const [opened, setOpened] = useState<OpenedJob | undefined>()
  useEffect(() => {
    setOpened(undefined)
    if (tabId !== undefined) void loadOpened(tabId).then(setOpened)
  }, [tabId])
  if (!opened) return null
  return (
    <p className="rounded-lg bg-accent-wash px-3 py-2 text-[13px] font-semibold text-text-primary">
      {bannerText(opened)}
      <span className="block truncate text-[12px] font-normal text-text-secondary">{opened.title}</span>
    </p>
  )
}
