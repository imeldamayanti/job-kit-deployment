import { classifyWorkplace } from '../classify'
import { htmlToText, truncateText } from '../text'
import type { RawJob } from '../types'
import { dateOnly, DESCRIPTION_LIMIT, emptyJob } from './shared'
import { LOGIN_WALL_MARKER, RESULTS_MARKER, SELECTORS } from './linkedin-selectors'

const squash = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim()

export type LinkedInDetail = { description: string; level: string; contract: string }

export function looksLikeResults(html: string): boolean {
  return html.includes(RESULTS_MARKER)
}

export const isLoginWall = (html: string) => html.includes(LOGIN_WALL_MARKER)

// Runs where a DOM exists: the offscreen document, or a test.
export function parseSearchPage(html: string): RawJob[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return [...doc.querySelectorAll(SELECTORS.card)]
    .map((card) => {
      const title = squash(card.querySelector(SELECTORS.title)?.textContent)
      const where = squash(card.querySelector(SELECTORS.location)?.textContent)
      const href = card.querySelector<HTMLAnchorElement>(SELECTORS.link)?.getAttribute('href') ?? ''
      return {
        ...emptyJob('linkedin'),
        title,
        company: squash(card.querySelector(SELECTORS.company)?.textContent),
        location: where,
        workplace: classifyWorkplace({ location: where, title }),
        postedAt: dateOnly(card.querySelector(SELECTORS.listed)?.getAttribute('datetime')),
        url: href,
        logoUrl: card.querySelector(SELECTORS.logo)?.getAttribute('data-delayed-url') ?? '',
      }
    })
    .filter((job) => job.title !== '' && job.url !== '')
}

export function parseDetailPage(html: string): LinkedInDetail {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const criteria = new Map<string, string>()
  for (const item of doc.querySelectorAll(SELECTORS.criteriaItem)) {
    criteria.set(
      squash(item.querySelector(SELECTORS.criteriaLabel)?.textContent).toLowerCase(),
      squash(item.querySelector(SELECTORS.criteriaValue)?.textContent),
    )
  }
  const markup = doc.querySelector(SELECTORS.detailDescription)?.innerHTML ?? ''
  return {
    description: truncateText(htmlToText(markup), DESCRIPTION_LIMIT),
    level: criteria.get('seniority level') ?? '',
    contract: criteria.get('employment type') ?? '',
  }
}
