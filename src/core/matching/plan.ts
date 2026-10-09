import type { Profile } from '../profile/types'
import { matchField, normalize, type MatchKey } from './match'

export type PlanField = { id: string; label: string; autocomplete?: string; hasText?: boolean }
export type PlanItem = {
  fieldId: string
  label: string
  key: MatchKey
  value: string
  hasExistingText: boolean
}
export type Plan = {
  items: PlanItem[]
  skipped: { fieldId: string; label: string }[]
  missing: { fieldId: string; label: string; key: MatchKey }[]
  matched: number
  total: number
}

function matchCustom(label: string, profile: Profile, mode: 'exact' | 'contains'): MatchKey | null {
  const text = normalize(label)
  for (const pair of profile.custom) {
    const key = normalize(pair.key)
    if (!key) continue
    if (mode === 'exact' ? text === key : ` ${text} `.includes(` ${key} `)) return `custom:${pair.id}`
  }
  return null
}

function valueFor(profile: Profile, key: MatchKey): string {
  if (key.startsWith('custom:')) return profile.custom.find((pair) => `custom:${pair.id}` === key)?.value ?? ''
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
    const key = matchCustom(field.label, profile, 'exact') ?? matchField(field) ?? matchCustom(field.label, profile, 'contains')
    if (!key) {
      plan.skipped.push({ fieldId: field.id, label: field.label })
      continue
    }
    plan.matched += 1
    const value = valueFor(profile, key)
    if (value) plan.items.push({ fieldId: field.id, label: field.label, key, value, hasExistingText: field.hasText === true })
    else plan.missing.push({ fieldId: field.id, label: field.label, key })
  }
  return plan
}
