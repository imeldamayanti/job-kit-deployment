// Three real postings from fixtures/jobs/, flattened to plain text the way the feed does (htmlToText).
import { readFileSync } from 'node:fs'

const read = (name) => JSON.parse(readFileSync(new URL(`../../fixtures/jobs/${name}.json`, import.meta.url), 'utf8'))

export function htmlToText(html) {
  return html
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/<\/(p|li|div|h\d|ul|ol)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim()
}

export function loadJobs() {
  const lever = read('lever')[0]
  const remotive = read('remotive').jobs
  const leverText = [
    lever.descriptionPlain,
    ...lever.lists.map((l) => `${l.text}\n${htmlToText(l.content)}`),
    lever.additionalPlain,
  ].filter(Boolean).join('\n')
  const service = remotive.find((j) => j.title.startsWith('Tier III'))
  const swe = remotive.find((j) => j.title.startsWith('Software Engineer'))
  return [
    { id: 'J1', title: lever.text, company: 'Spotify (lever)', text: leverText },
    { id: 'J2', title: swe.title, company: `${swe.company_name} (remotive)`, text: htmlToText(swe.description) },
    { id: 'J3', title: service.title, company: `${service.company_name} (remotive)`, text: htmlToText(service.description) },
  ]
}
