import { CV_LABELS, type Lang } from './language'

const MONTHS: Record<Lang, string[]> = {
  id: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

// "2023-01" is Jan 2023; a bare year stays a year; anything else is shown as typed rather than guessed.
function month(value: string, lang: Lang): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim())
  const name = match ? MONTHS[lang][Number(match[2]) - 1] : undefined
  return match && name ? `${name} ${match[1]}` : value.trim()
}

// The dates of a job as a CV shows them: "Jan 2023 – sekarang", "Jan 2022 – Jun 2022".
export function formatPeriod(start: string, end: string, current: boolean, lang: Lang = 'id'): string {
  const from = month(start, lang)
  const to = current ? CV_LABELS[lang].now : month(end, lang)
  if (from === '') return to
  return to === '' ? from : `${from} – ${to}`
}
