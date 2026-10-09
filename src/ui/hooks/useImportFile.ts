import { useCallback } from 'react'
import { eventForPdfResult } from '../../core/cv/import-event'
import { looksLikePdf } from '../../core/cv/pdf-text'
import { eventForImportFile } from '../../core/data/import'
import type { DataEvent } from '../../core/data/state'
import type { Profile } from '../../core/profile/types'
import { readPdfText } from '../../platform/pdf'

// Reads a file chosen on the Data page. The kind (PDF or Export JSON) comes from the content,
// not the name: a renamed file is still treated as what it is.
export function useImportFile(profile: Profile | null, dispatch: (event: DataEvent) => void) {
  return useCallback(
    async (file: File) => {
      if (!profile) return
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (looksLikePdf(bytes)) {
        dispatch({ type: 'start-parsing', fileName: file.name })
        dispatch(eventForPdfResult(file, await readPdfText(file), profile))
        return
      }
      dispatch(eventForImportFile(file, new TextDecoder().decode(bytes), profile))
    },
    [profile, dispatch],
  )
}
