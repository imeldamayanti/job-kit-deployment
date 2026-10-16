import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script'
import { listen } from '../../platform/messaging'
import { createPageHandlers } from './handlers'

type Guarded = typeof globalThis & { __jobkitReady?: boolean }

export default defineUnlistedScript(() => {
  const scope = globalThis as Guarded
  if (scope.__jobkitReady) return
  scope.__jobkitReady = true

  listen(createPageHandlers(document))
})
