const MIN_FRAME_SIZE = 200

// Hiring and form platforms that companies embed in their own career pages. Their frames start collapsed
// to nothing until the embedded page reports its height, so size alone would miss them.
const FORM_HOSTS = [
  'greenhouse.io',
  'lever.co',
  'ashbyhq.com',
  'workable.com',
  'smartrecruiters.com',
  'recruitee.com',
  'bamboohr.com',
  'myworkdayjobs.com',
  'teamtailor.com',
  'docs.google.com',
  'forms.gle',
  'jotform.com',
  'typeform.com',
  'airtable.com',
]

function isFormHost(src: string): boolean {
  try {
    const host = new URL(src).hostname
    return FORM_HOSTS.some((known) => host === known || host.endsWith(`.${known}`))
  } catch {
    return false
  }
}

function canRead(frame: HTMLIFrameElement): boolean {
  try {
    return frame.contentDocument !== null
  } catch {
    return false
  }
}

// A frame from another site is a locked box: the browser will not let this page's scripts look inside.
// Small ones are almost always tracking pixels or ads, so only frames big enough to hold a form count.
export function hasLockedFrame(doc: Document): boolean {
  return Array.from(doc.querySelectorAll('iframe')).some((frame) => {
    if (canRead(frame)) return false
    const { width, height } = frame.getBoundingClientRect()
    return (width >= MIN_FRAME_SIZE && height >= MIN_FRAME_SIZE) || isFormHost(frame.src)
  })
}

// A page can have a search box of its own and still keep the real application form inside a locked frame.
export function formIsLocked(matchedFields: number, lockedFrame: boolean): boolean {
  return lockedFrame && matchedFields === 0
}
