import { useEffect, useState } from 'react'
import type { Application } from '../../core/applications/types'
import { loadApplications, watchApplications } from '../../platform/application-storage'

// The applications, following what any page or the side panel writes. `ready` turns true after the
// first read, so a page can tell "not loaded yet" from "no such application".
export function useApplications(): { applications: Application[]; ready: boolean } {
  const [applications, setApplications] = useState<Application[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void loadApplications().then((loaded) => {
      setApplications(loaded)
      setReady(true)
    })
    return watchApplications(setApplications)
  }, [])

  return { applications, ready }
}
