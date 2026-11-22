import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Application, CoverLetter } from '../../core/applications/types'
import { LETTER_LANG, type Lang, type Tone } from '../../core/letters/language'
import { createAutosaver } from '../../core/profile/autosave'
import { isStale } from '../../core/tailor/hash'
import { AI_MODE } from '../../core/build'
import type { CvAvailability } from '../../core/tailor/limits'
import { loadAccountStatus } from '../../platform/account'
import { doneLine } from '../../platform/remote'
import type { Profile } from '../../core/profile/types'
import type { LetterTabState } from '../../entrypoints/options/LetterTab'
import { loadApplicationData, watchApplications } from '../../platform/application-storage'
import { copyText } from '../../platform/clipboard'
import { buildLetter, letterStatus, restoreLetter, saveLetterEdit } from '../../platform/letter'
import { isRejection } from '../../platform/tailor'
import { loadProfile, watchProfile } from '../../platform/storage'

type Link = Parameters<LetterTabState['onLink']>[0]

const EDIT_DELAY_MS = 500

// The Surat tab of one application (T52): its letter, whether "Buat surat" is on and why not, the act of writing one, the
// language and tone for the next one, and hand edits. `onLink` takes the person to where a reason can be fixed; `where`
// names the screen, so coming back from Atur Lowongan reads the reason again (the same as the CV tab).
// `account` is the server build's side of it: where "Beli kredit" goes, and what to do once credits were spent (read the status again).
export function useLetter(application: Application | undefined, onLink: (link: Link) => void, where = '', account?: { onBuy: () => void; onSpent: () => void }): LetterTabState {
  const [letter, setLetter] = useState<CoverLetter | null>(null)
  const [availability, setAvailability] = useState<CvAvailability | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [rejected, setRejected] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [copyNote, setCopyNote] = useState<string | null>(null)
  // The balance as last seen (a cache the server keeps current), and the line after a paid letter. Server build only.
  const [balance, setBalance] = useState<number | null>(null)
  const [done, setDone] = useState<string | null>(null)
  // What the person picked; absent means "as the letter is, or as the posting reads".
  const [pickedLang, setPickedLang] = useState<Lang | undefined>()
  const [pickedTone, setPickedTone] = useState<Tone | undefined>()

  const id = application?.id
  const letterId = application?.letterId ?? null
  const job = application?.job

  const refresh = useCallback(async () => {
    if (!id) return
    const [data, status, account] = await Promise.all([loadApplicationData(), letterStatus(id), AI_MODE === 'server' ? loadAccountStatus() : Promise.resolve(null)])
    setLetter(data.letters.find((item) => item.id === letterId) ?? null)
    setAvailability(status)
    setBalance(account?.credits ?? null)
  }, [id, letterId])

  useEffect(() => {
    void refresh()
  }, [refresh, job?.description, where])
  // Another application starts without the last one's "Surat siap".
  useEffect(() => setDone(null), [id])
  useEffect(() => watchApplications(() => void refresh()), [refresh])
  useEffect(() => {
    void loadProfile().then(setProfile)
    return watchProfile(setProfile)
  }, [])
  // A new letter, or another application, starts from its own language and tone again.
  useEffect(() => {
    setPickedLang(undefined)
    setPickedTone(undefined)
    setCopyNote(null)
  }, [id, letterId])

  const lang = pickedLang ?? letter?.lang ?? LETTER_LANG
  const tone = pickedTone ?? letter?.tone ?? 'formal'

  const create = useCallback(
    async (acknowledged: boolean) => {
      if (!id) return
      setBusy(true)
      setMessage(null)
      setRejected(false)
      setNotice(null)
      setCopyNote(null)
      setDone(null)
      try {
        const result = await buildLetter(id, { acknowledged, lang, tone })
        if (result.ok) {
          if (AI_MODE === 'server') setDone(await doneLine('Surat'))
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
    [id, lang, tone, refresh, account],
  )

  // Edits are saved after a short pause, like the notes and the CV; the page reads the letter again once saved so the mark shows.
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  const editor = useMemo(
    () =>
      letterId
        ? createAutosaver<string>((body) => saveLetterEdit(letterId, body), EDIT_DELAY_MS, (state) => state === 'saved' && void refreshRef.current())
        : null,
    [letterId],
  )
  useEffect(() => () => void editor?.flush(), [editor])

  const restore = useCallback(async () => {
    if (!letterId) return
    await editor?.flush()
    await restoreLetter(letterId)
    await refresh()
  }, [letterId, editor, refresh])

  // Salin copies what is saved after pending edits are written, so the clipboard and the page never differ.
  const copy = useCallback(async () => {
    if (!letterId) return
    await editor?.flush()
    const latest = (await loadApplicationData()).letters.find((item) => item.id === letterId)
    if (!latest) return
    setCopyNote((await copyText(latest.body)) ? 'Surat disalin.' : 'Surat tidak bisa disalin otomatis. Pilih teks di kotak lalu salin.')
  }, [letterId, editor])

  return {
    letter, availability, busy, message, rejected, notice, lang, tone, copyNote, onLink, done,
    credit: AI_MODE === 'server' ? { balance, onBuy: account?.onBuy ?? (() => {}) } : undefined,
    langAuto: pickedLang === undefined,
    stale: letter !== null && profile !== null && isStale(letter.profileHash, profile),
    onCreate: () => void create(false),
    onContinue: () => void create(true),
    onDismissNotice: () => setNotice(null),
    onEdit: (body) => editor?.schedule(body),
    onRestore: () => void restore(),
    onCopy: () => void copy(),
    onLang: setPickedLang,
    onTone: setPickedTone,
  }
}
