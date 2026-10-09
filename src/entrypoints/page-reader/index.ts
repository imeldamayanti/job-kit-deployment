import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script'
import { createFiller, type FillTarget } from '../../core/fill/apply'
import { hasLockedFrame } from '../../core/fill/frames'
import { scanFields, type ScannedField } from '../../core/fill/scan'
import { listen } from '../../platform/messaging'

type Guarded = typeof globalThis & { __jobkitReady?: boolean }

export default defineUnlistedScript(() => {
  const scope = globalThis as Guarded
  if (scope.__jobkitReady) return
  scope.__jobkitReady = true

  const filler = createFiller()
  let registry = new Map<string, ScannedField>()

  listen({
    scan: () => {
      const fields = scanFields(document)
      registry = new Map(fields.map((field) => [field.id, field]))
      return {
        fields: fields.map(({ id, label, autocomplete, hasText, kind, options }) => ({ id, label, autocomplete, hasText, kind, options })),
        canUndo: filler.canUndo(),
        lockedFrame: hasLockedFrame(document),
      }
    },
    fill: (items) => {
      const targets = items.flatMap(({ fieldId, value, choice }): FillTarget[] => {
        const field = registry.get(fieldId)
        if (!field) return []
        if (field.kind === 'radio') return choice === undefined ? [] : [{ kind: 'radio', radios: field.radios, index: choice }]
        if (field.kind === 'select') {
          const option = choice === undefined ? undefined : field.options[choice]
          return option ? [{ kind: 'select', element: field.element as HTMLSelectElement, value: option.value }] : []
        }
        return [{ element: field.element, value }]
      })
      const outcome = filler.fill(targets)
      return { filled: outcome.filled, skipped: outcome.skipped + (items.length - targets.length) }
    },
    undo: () => filler.undo(),
  })
})
