import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script'
import { isLoginWall, readThreadPosts } from '../../core/feed/sources/thread-dom'
import type { ThreadRead } from '../../core/feed/sources/thread'

type Guarded = typeof globalThis & { __jobkitThread?: { read: () => ThreadRead } }

// Injected into the Threads feed window by the thread collector. It only reads what the page already shows.
export default defineUnlistedScript(() => {
  ;(globalThis as Guarded).__jobkitThread = {
    read: () => ({ posts: readThreadPosts(document), loginWall: isLoginWall(document, location.href) }),
  }
})
