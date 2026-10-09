import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script'
import { scanFields } from '../../core/fill/scan'
import { onScanRequest } from '../../platform/messaging'

type Guarded = typeof globalThis & { __jobkitReady?: boolean }

export default defineUnlistedScript(() => {
  const scope = globalThis as Guarded
  if (scope.__jobkitReady) return
  scope.__jobkitReady = true

  onScanRequest(() => scanFields(document).map(({ id, label, autocomplete }) => ({ id, label, autocomplete })))
})
