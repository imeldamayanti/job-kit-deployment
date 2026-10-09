// Every selector the LinkedIn public pages need lives here. When the markup changes, this is the
// only file to edit; a parser that finds nothing reports `parse`, it does not crash (PRD §8).
export const SELECTORS = {
  card: '.base-search-card',
  title: '.base-search-card__title',
  company: '.base-search-card__subtitle',
  location: '.job-search-card__location',
  listed: 'time.job-search-card__listdate',
  link: 'a.base-card__full-link',
  logo: 'img.artdeco-entity-image',
  detailDescription: '.show-more-less-html__markup',
  criteriaItem: '.description__job-criteria-item',
  criteriaLabel: '.description__job-criteria-subheader',
  criteriaValue: '.description__job-criteria-text',
} as const

// Present on a results page even when it holds no cards, absent on a changed layout or a login wall.
export const RESULTS_MARKER = 'base-search-card'
export const LOGIN_WALL_MARKER = 'authwall'
