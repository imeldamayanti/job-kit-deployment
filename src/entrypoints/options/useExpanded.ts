import { useCallback, useState } from 'react'

// Existing entries start folded; an entry the user just added starts open.
export function useExpanded() {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const toggle = useCallback((id: string) => {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const expand = useCallback((id: string) => setOpen((current) => new Set(current).add(id)), [])
  return { isOpen: (id: string) => open.has(id), toggle, expand }
}
