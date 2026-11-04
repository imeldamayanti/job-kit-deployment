import { LOGIN_FORM, LOGIN_PATHS, THREAD_ORIGIN, THREAD_SELECTORS as SELECTOR } from './thread-selectors'

export type ThreadPost = { url: string; postedAt: string; text: string }

// Lines that are only the post's age ("20h", "3d") or a like/reply count ("36", "1.2K") sit among the text spans.
// The "Translate" button Threads adds under posts in another language is also a text span.
const COUNTER_OR_AGE = /^(?:\d+\s?[smhdw]|[\d.,]+\s?[KkMm]?|translate|terjemahkan|lihat terjemahan)$/i

function dateOf(value: string | null): string {
  const time = Date.parse(value ?? '')
  return Number.isNaN(time) ? '' : new Date(time).toISOString().slice(0, 10)
}

// Reads the posts the page shows right now. A post counts once, by its own link.
export function readThreadPosts(root: ParentNode): ThreadPost[] {
  const seen = new Set<string>()
  const posts: ThreadPost[] = []
  for (const container of root.querySelectorAll(SELECTOR.post)) {
    const href = container.querySelector(SELECTOR.permalink)?.getAttribute('href')
    if (!href) continue
    const link = new URL(href, THREAD_ORIGIN)
    link.search = ''
    link.hash = ''
    if (seen.has(link.href)) continue
    seen.add(link.href)

    const text = [...container.querySelectorAll(SELECTOR.text)]
      // Nested spans repeat their parent's words; the author and the post link are not the post's text.
      .filter((span) => !span.closest(SELECTOR.author) && !span.parentElement?.closest(SELECTOR.text))
      .map((span) => (span.textContent ?? '').trim())
      .filter((line) => line !== '' && !COUNTER_OR_AGE.test(line))
      .join('\n')
    posts.push({ url: link.href, postedAt: dateOf(container.querySelector(SELECTOR.time)?.getAttribute('datetime') ?? null), text })
  }
  return posts
}

// Logged out, or stopped by a checkpoint: either way the feed is not there and nothing more is tried today.
export function isLoginWall(root: ParentNode, href: string): boolean {
  try {
    const path = new URL(href).pathname
    if (LOGIN_PATHS.some((prefix) => path.startsWith(prefix))) return true
  } catch {
    // An address that does not parse says nothing; the form check below decides.
  }
  return root.querySelector(LOGIN_FORM) !== null
}
