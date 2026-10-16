// Rough fact checker for the spike (a draft of what T46 validateGrounded will become).
// Mechanical only: it cannot see semantic claims such as "memimpin tim"; the 9 results are rated by hand for that.

const LEXICON = new Set(
  ('kubernetes docker aws gcp azure kotlin swift java python typescript javascript react vue angular svelte node nodejs sql postgres postgresql mysql mongodb redis ' +
    'graphql terraform jenkins tableau powerbi excel pandas spark hadoop tensorflow pytorch linux git github jira figma agile scrum android ios flutter django flask ' +
    'laravel spring golang rust php ruby rails kafka rabbitmq elasticsearch nginx ansible helm prometheus grafana datadog sentry firebase supabase oauth jest cypress ' +
    'playwright selenium webpack vite nextjs next.js redux tailwind sass bigquery snowflake airflow dbt looker numpy scikit-learn sklearn cisco vmware citrix okta ' +
    'intune sccm powershell bash vpn dns dhcp active-directory').split(/\s+/),
)
const STOP = new Set(['i', 'a', 'cv', 'ui', 'ux'])

const numbersIn = (text) =>
  [...text.matchAll(/\d+(?:[.,]\d+)*/g)].map((m) => m[0].replace(/[.,]$/, '').replace(',', '.'))

const wordsIn = (text) => [...text.matchAll(/[A-Za-z][A-Za-z0-9.+#/-]*[A-Za-z0-9+#]|[A-Za-z]/g)].map((m) => ({ word: m[0], index: m.index }))

// A word counts as a technical term when it is in the lexicon, is camelCase, ALLCAPS (2+), has a dot or digit inside, or ends in + / #.
function isTechnical(word) {
  const w = word.toLowerCase()
  if (STOP.has(w)) return false
  return LEXICON.has(w) || /[a-z][A-Z]/.test(word) || /^[A-Z]{2,}$/.test(word) || /[A-Za-z]\.[A-Za-z]/.test(word) || /[A-Za-z]\d|\d[A-Za-z]/.test(word) || /[+#]$/.test(word)
}

export function checkOutput(output, profile) {
  const violations = []
  const add = (type, value, where) => violations.push({ type, value, where })
  const skillSet = new Set(profile.skills.map((s) => s.toLowerCase()))
  const skillText = profile.skills.join(' ').toLowerCase()

  for (const skill of output.skills ?? []) if (!skillSet.has(String(skill).toLowerCase())) add('skill', skill, 'skills')

  const expById = new Map(profile.experience.map((e) => [e.id, e]))
  const seen = new Set()
  for (const item of output.experience ?? []) {
    const source = expById.get(item.sourceId)
    if (!source || seen.has(item.sourceId)) {
      add('source', item.sourceId, 'experience')
      seen.add(item.sourceId)
      continue
    }
    seen.add(item.sourceId)
    const desc = source.description.toLowerCase()
    const allowedNumbers = new Set(numbersIn(source.description))
    ;(item.bullets ?? []).forEach((bullet, i) => {
      const where = `${item.sourceId}#${i + 1}`
      for (const n of new Set(numbersIn(bullet))) if (!allowedNumbers.has(n)) add('number', n, where)
      const reported = new Set()
      for (const { word } of wordsIn(bullet)) {
        const lower = word.toLowerCase().replace(/\.$/, '')
        if (reported.has(lower) || !isTechnical(word)) continue
        if (!desc.includes(lower) && !skillText.includes(lower)) {
          reported.add(lower)
          add('term', lower, where)
        }
      }
    })
  }

  const eduIds = new Set(profile.education.map((e) => e.id))
  for (const id of output.education ?? []) if (!eduIds.has(id)) add('source', id, 'education')
  return violations
}

// Requirement the model claims is covered although a lexicon term in it is absent from the profile.
export function checkCoverage(covered, profile) {
  const haystack = [profile.skills.join(' '), ...profile.experience.map((e) => e.description)].join(' ').toLowerCase()
  const out = []
  for (const req of covered ?? []) {
    for (const { word } of wordsIn(String(req))) {
      const lower = word.toLowerCase()
      if (LEXICON.has(lower) && !haystack.includes(lower)) out.push({ type: 'coverage', value: lower, where: String(req).slice(0, 60) })
    }
  }
  return out
}
