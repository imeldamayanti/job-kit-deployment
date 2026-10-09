import { useEffect, useState } from 'react'
import { loadStorageUsage, type StorageUsage } from '../../platform/storage'

export function useStorageUsage(): StorageUsage | null {
  const [usage, setUsage] = useState<StorageUsage | null>(null)
  useEffect(() => {
    void loadStorageUsage().then(setUsage)
  }, [])
  return usage
}
