import { useEffect, useState } from 'react'
import { todayKey } from '../../core/applications/followup'

// Today's date, kept current while a page stays open: it changes at midnight, and again when a tab that slept
// through one is woken (timers do not run in a sleeping tab). The badge for follow-ups (FR-47) follows it.
export function useToday(): string {
  const [today, setToday] = useState(() => todayKey(new Date()))

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      setToday(todayKey(new Date()))
      const now = new Date()
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
      clearTimeout(timer)
      // A second past midnight, so the clock has certainly turned over.
      timer = setTimeout(refresh, midnight - now.getTime() + 1000)
    }
    refresh()
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  return today
}
