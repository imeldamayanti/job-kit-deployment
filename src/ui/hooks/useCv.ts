import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Application, TailoredCv } from '../../core/applications/types'
import { createAutosaver } from '../../core/profile/autosave'
import { cvToText } from '../../core/tailor/cv-text'
import { cvParts } from '../../core/tailor/edit'
import { assemble } from '../../core/tailor/grounded'
import { detectLanguage } from '../../core/tailor/language'
import { describeReplaced } from '../../core/tailor/pdf-layout'
import type { Profile } from '../../core/profile/types'
import type { CvParts } from '../../core/tailor/diff'
import { isStale } from '../../core/tailor/hash'
import type { CvAvailability } from '../../core/tailor/limits'
import { loadApplicationData, watchApplications } from '../../platform/application-storage'
import { loadProfile, watchProfile } from '../../platform/storage'
import { copyText } from '../../platform/clipboard'
import { downloadCv } from '../../platform/cv-pdf'
import { buildCv, cvStatus, restoreCv, saveCvEdit } from '../../platform/tailor'
import type { CvTabState } from '../../entrypoints/options/CvTab'

type Link = Parameters<CvTabState['onLink']>[0]

const EDIT_DELAY_MS = 500

// The CV tab of one application: its CV, whether "Buat CV" is on and why not, the act of making one, and hand edits (T48, T49).
// `onLink` is the page's way to take the person where the reason can be fixed. `where` names the screen the person is on:
// the key and the daily limit are changed on another page, so coming back is the moment to read the reason again.
export function useCv(application: Application | undefined, onLink: (link: Link) => void, where = ''): CvTabState {
  const [cv, setCv] = useState<TailoredCv | null>(null)
  const [availability, setAvailability] = useState<CvAvailability | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [rejected, setRejected] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadNote, setDownloadNote] = useState<string | null>(null)

  const id = application?.id
  const cvId = application?.cvId ?? null
  const text = application?.job.description

  const refresh = useCallback(async () => {
    if (!id) return
    const [data, status] = await Promise.all([loadApplicationData(), cvStatus(id)])
    setCv(data.cvs.find((item) => item.id === cvId) ?? null)
    setAvailability(status)
  }, [id, cvId])

  useEffect(() => {
    void refresh()
  }, [refresh, text, where])
  // The daily count and the key live elsewhere; a change to the applications is the moment this page re-reads them.
  useEffect(() => watchApplications(() => void refresh()), [refresh])
  useEffect(() => {
    void loadProfile().then(setProfile)
    return watchProfile(setProfile)
  }, [])

  const create = useCallback(
    async (acknowledged: boolean) => {
      if (!id) return
      setBusy(true)
      setMessage(null)
      setRejected(false)
      setNotice(null)
      try {
        const result = await buildCv(id, { acknowledged })
        if (result.ok) setMessage(result.fallback ? 'AI tidak mengembalikan butir; isi Profile dipakai apa adanya.' : null)
        else if (result.reason === 'notice') setNotice(result.message)
        else {
          setMessage(result.message)
          setRejected(result.reason === 'ungrounded' || result.reason === 'unreadable')
        }
      } finally {
        setBusy(false)
        await refresh()
      }
    },
    [id, refresh],
  )

  // Edits are saved after a short pause, like the notes; the page reads the CV again once saved so the Diedit mark shows.
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  const editor = useMemo(
    () =>
      cvId
        ? createAutosaver<CvParts>((parts) => saveCvEdit(cvId, parts), EDIT_DELAY_MS, (state) => state === 'saved' && void refreshRef.current())
        : null,
    [cvId],
  )
  useEffect(() => () => void editor?.flush(), [editor])

  const restore = useCallback(async () => {
    if (!cvId) return
    await editor?.flush()
    await restoreCv(cvId)
    await refresh()
  }, [cvId, editor, refresh])

  // Unduh PDF or Word (T50): the file is made here, in this browser. When it cannot be, the reason is shown and the text can be copied.
  const download = useCallback(async (format: 'pdf' | 'docx' = 'pdf') => {
    if (!id) return
    setDownloading(true)
    setDownloadError(null)
    setDownloadNote(null)
    try {
      const result = await downloadCv(id, { format })
      if (result.ok) setDownloadNote(describeReplaced(result.replaced))
      else setDownloadError(result.message)
    } finally {
      setDownloading(false)
    }
  }, [id])

  const copyCv = useCallback(async () => {
    if (!cv || !profile) return
    const doc = assemble(profile, cvParts(cv))
    const copied = await copyText(cvToText(doc, detectLanguage(doc.experience.flatMap((job) => [job.title, ...job.bullets]).join(' '))))
    setDownloadNote(copied ? 'Teks CV disalin.' : 'Teks CV tidak bisa disalin otomatis. Pilih teks di halaman ini lalu salin.')
  }, [cv, profile])

  return {
    cv, availability, busy, message, rejected, notice, profile, onLink, downloading, downloadError, downloadNote,
    stale: cv !== null && profile !== null && isStale(cv.profileHash, profile),
    onCreate: () => void create(false),
    onContinue: () => void create(true),
    onDismissNotice: () => setNotice(null),
    onEdit: (parts) => editor?.schedule(parts),
    onRestore: () => void restore(),
    onDownload: () => void download(),
    onDownloadWord: () => void download('docx'),
    onCopyText: () => void copyCv(),
  }
}
