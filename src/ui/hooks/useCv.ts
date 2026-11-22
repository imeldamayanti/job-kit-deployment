import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Application, TailoredCv } from '../../core/applications/types'
import { createAutosaver } from '../../core/profile/autosave'
import { cvToText } from '../../core/tailor/cv-text'
import { cvParts } from '../../core/tailor/edit'
import { assemble } from '../../core/tailor/grounded'
import { CV_LANG } from '../../core/tailor/language'
import { describeReplaced } from '../../core/tailor/pdf-layout'
import type { Profile } from '../../core/profile/types'
import type { CvParts } from '../../core/tailor/diff'
import { isStale } from '../../core/tailor/hash'
import { AI_MODE } from '../../core/build'
import type { CvAvailability } from '../../core/tailor/limits'
import { loadAccountStatus } from '../../platform/account'
import { doneLine } from '../../platform/remote'
import { loadApplicationData, watchApplications } from '../../platform/application-storage'
import { loadProfile, watchProfile } from '../../platform/storage'
import { copyText } from '../../platform/clipboard'
import { downloadCv } from '../../platform/cv-pdf'
import { buildCv, cvStatus, isRejection, restoreCv, saveCvEdit, saveCvOrder } from '../../platform/tailor'
import type { CvOrder } from '../../core/tailor/types'
import type { CvTabState } from '../../entrypoints/options/CvTab'

type Link = Parameters<CvTabState['onLink']>[0]

const EDIT_DELAY_MS = 500

// The CV tab of one application: its CV, whether "Buat CV" is on and why not, the act of making one, and hand edits (T48, T49).
// `onLink` is the page's way to take the person where the reason can be fixed. `where` names the screen the person is on:
// the key and the daily limit are changed on another page, so coming back is the moment to read the reason again.
// `account` is the server build's side of it: where "Beli kredit" goes, and what to do once credits were spent (read the status again).
export function useCv(application: Application | undefined, onLink: (link: Link) => void, where = '', account?: { onBuy: () => void; onSpent: () => void }): CvTabState {
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
  // The balance as last seen (a cache the server keeps current), and the line after a paid CV. Server build only.
  const [balance, setBalance] = useState<number | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const id = application?.id
  const cvId = application?.cvId ?? null
  const text = application?.job.description

  const refresh = useCallback(async () => {
    if (!id) return
    const [data, status, account] = await Promise.all([loadApplicationData(), cvStatus(id), AI_MODE === 'server' ? loadAccountStatus() : Promise.resolve(null)])
    setCv(data.cvs.find((item) => item.id === cvId) ?? null)
    setAvailability(status)
    setBalance(account?.credits ?? null)
  }, [id, cvId])

  useEffect(() => {
    void refresh()
  }, [refresh, text, where])
  // Another application starts without the last one's "CV siap".
  useEffect(() => setDone(null), [id])
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
      setDone(null)
      try {
        const result = await buildCv(id, { acknowledged })
        if (result.ok) {
          setMessage(result.note)
          // A fallback CV is not charged, so there is nothing to report spent.
          if (AI_MODE === 'server' && !result.fallback) setDone(await doneLine('CV'))
        } else if (result.reason === 'notice') setNotice(result.message)
        else {
          setMessage(result.message)
          setRejected(isRejection(result))
        }
      } finally {
        setBusy(false)
        await refresh()
        account?.onSpent()
      }
    },
    [id, refresh, account],
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

  // Which section leads the CV is saved at once, after any edit still waiting, and the page reads the CV again.
  const changeOrder = useCallback(async (order: CvOrder) => {
    if (!cvId) return
    await editor?.flush()
    await saveCvOrder(cvId, order)
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
    const doc = assemble(profile, cvParts(cv), cv.order)
    const copied = await copyText(cvToText(doc, CV_LANG))
    setDownloadNote(copied ? 'Teks CV disalin.' : 'Teks CV tidak bisa disalin otomatis. Pilih teks di halaman ini lalu salin.')
  }, [cv, profile])

  return {
    cv, availability, busy, message, rejected, notice, profile, onLink, downloading, downloadError, downloadNote, done,
    credit: AI_MODE === 'server' ? { balance, onBuy: account?.onBuy ?? (() => {}) } : undefined,
    stale: cv !== null && profile !== null && isStale(cv.profileHash, profile),
    onCreate: () => void create(false),
    onContinue: () => void create(true),
    onDismissNotice: () => setNotice(null),
    onEdit: (parts) => editor?.schedule(parts),
    onRestore: () => void restore(),
    onOrder: (order: CvOrder) => void changeOrder(order),
    onDownload: () => void download(),
    onDownloadWord: () => void download('docx'),
    onCopyText: () => void copyCv(),
  }
}
