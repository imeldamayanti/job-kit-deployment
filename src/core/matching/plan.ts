import type { Profile } from '../profile/types'
import { matchField, type MatchKey } from './match'

export type PlanField = { id: string; label: string; autocomplete?: string }
export type PlanItem = { fieldId: string; label: string; key: MatchKey; value: string }
export type Plan = {
  items: PlanItem[]
  skipped: { fieldId: string; label: string }[]
  missing: { fieldId: string; label: string; key: MatchKey }[]
  matched: number
  total: number
}

function valueFor(profile: Profile, key: MatchKey): string {
  if (key === 'fullName') {
    const { firstName, middleName, lastName } = profile.personal
    return [firstName, middleName, lastName].filter(Boolean).join(' ')
  }
  if (key in profile.personal) return profile.personal[key as keyof Profile['personal']]
  return profile.contact[key as keyof Profile['contact']]
}

export function buildPlan(fields: PlanField[], profile: Profile): Plan {
  const plan: Plan = { items: [], skipped: [], missing: [], matched: 0, total: fields.length }
  for (const field of fields) {
    const key = matchField(field)
    if (!key) {
      plan.skipped.push({ fieldId: field.id, label: field.label })
      continue
    }
    plan.matched += 1
    const value = valueFor(profile, key)
    if (value) plan.items.push({ fieldId: field.id, label: field.label, key, value })
    else plan.missing.push({ fieldId: field.id, label: field.label, key })
  }
  return plan
}
