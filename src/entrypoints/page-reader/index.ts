import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script'
import { createFiller } from '../../core/fill/apply'
import { scanFields, type ScannedField } from '../../core/fill/scan'
import { listen } from '../../platform/messaging'

type Guarded = typeof globalThis & { __jobkitReady?: boolean }

export default defineUnlistedScript(() => {
  const scope = globalThis as Guarded
  if (scope.__jobkitReady) return
  scope.__jobkitReady = true

  const filler = createFiller()
  let registry = new Map<string, ScannedField['element']>()

  listen({
    scan: () => {
      const fields = scanFields(document)
      registry = new Map(fields.map((field) => [field.id, field.element]))
      return {
        fields: fields.map(({ id, label, autocomplete, hasText }) => ({ id, label, autocomplete, hasText })),
        canUndo: filler.canUndo(),
      }
    },
    fill: (items) => {
      const targets = items.flatMap(({ fieldId, value }) => {
        const element = registry.get(fieldId)
        return element ? [{ element, value }] : []
      })
      const outcome = filler.fill(targets)
      return { filled: outcome.filled, skipped: outcome.skipped + (items.length - targets.length) }
    },
    undo: () => filler.undo(),
  })
})
