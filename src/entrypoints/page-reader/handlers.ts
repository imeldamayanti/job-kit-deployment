import { createFiller, type FillTarget } from '../../core/fill/apply'
import { hasLockedFrame } from '../../core/fill/frames'
import { createMarker } from '../../core/fill/mark'
import { scanFields, scanUploads, type ScannedField } from '../../core/fill/scan'
import type { Handlers } from '../../platform/messaging'

// Everything the page remembers between messages: what was filled (for Undo) and what is outlined (T16).
export function createPageHandlers(doc: Document): Handlers {
  const filler = createFiller()
  const marker = createMarker()
  let registry = new Map<string, ScannedField>()

  return {
    scan: () => {
      const fields = scanFields(doc)
      registry = new Map(fields.map((field) => [field.id, field]))
      return {
        fields: fields.map(({ id, label, autocomplete, hasText, required, multiline, kind, options }) => ({
          id,
          label,
          autocomplete,
          hasText,
          required,
          multiline,
          kind,
          options,
        })),
        uploads: scanUploads(doc),
        canUndo: filler.canUndo() || marker.active(),
        lockedFrame: hasLockedFrame(doc),
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
      // Only after the values are written, so a field that was just filled is never outlined (FR-09, FR-20).
      const marked = marker.mark(Array.from(registry.values()))
      return { filled: outcome.filled, skipped: outcome.skipped + (items.length - targets.length), marked }
    },
    undo: () => {
      marker.clear()
      return filler.undo()
    },
  }
}
