import type { PlanItem } from './plan'

export type Selection = {
  disabled: ReadonlySet<string>
  overwrite: ReadonlySet<string>
}

export function selectItems(items: PlanItem[], selection: Selection): PlanItem[] {
  return items.filter(
    (item) => !selection.disabled.has(item.fieldId) && (!item.hasExistingText || selection.overwrite.has(item.fieldId)),
  )
}
