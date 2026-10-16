import type { Profile } from '../profile/types'
import { chooseOption, type ChoiceOption } from './choice'
import { matchField, normalize, type MatchKey } from './match'

export type PlanField = {
  id: string
  label: string
  autocomplete?: string
  hasText?: boolean
  // Marked required on the page (T16). Only used to say "Wajib" next to the fields left over.
  required?: boolean
  // A textarea. A cover letter goes only into one of these.
  multiline?: boolean
  kind?: 'text' | 'select' | 'radio'
  options?: ChoiceOption[]
}
export type PlanItem = {
  fieldId: string
  label: string
  key: MatchKey
  value: string
  choice?: number
  hasExistingText: boolean
}
export type Plan = {
  items: PlanItem[]
  skipped: { fieldId: string; label: string; required?: boolean }[]
  missing: { fieldId: string; label: string; key: MatchKey; required?: boolean }[]
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
  if (key === 'educationLevel') return profile.education.find((entry) => entry.level.trim() !== '')?.level ?? ''
  if (key === 'fullName') {
    const { firstName, middleName, lastName } = profile.personal
    return [firstName, middleName, lastName].filter(Boolean).join(' ')
  }
  if (key in profile.personal) return profile.personal[key as keyof Profile['personal']]
  return profile.contact[key as keyof Profile['contact']]
}

// What the application linked with the tab can answer (FR-44). Absent when the tab did not come from an application.
export type PlanDocuments = { coverLetter?: string }

const requiredFlag = (field: PlanField) => (field.required ? { required: true as const } : {})

export function buildPlan(fields: PlanField[], profile: Profile, documents: PlanDocuments = {}): Plan {
  const plan: Plan = { items: [], skipped: [], missing: [], matched: 0, total: fields.length }
  for (const field of fields) {
    const key = matchCustom(field.label, profile, 'exact') ?? matchField(field) ?? matchCustom(field.label, profile, 'contains')
    if (!key) {
      plan.skipped.push({ fieldId: field.id, label: field.label, ...requiredFlag(field) })
      continue
    }
    if (key === 'coverLetter') {
      // Only a textarea, and only when there is a letter. Without one nothing is "missing" from the Profile; the field is just left.
      const letter = documents.coverLetter?.trim() ?? ''
      if (!field.multiline || letter === '') {
        plan.skipped.push({ fieldId: field.id, label: field.label, ...requiredFlag(field) })
        continue
      }
      plan.matched += 1
      plan.items.push({ fieldId: field.id, label: field.label, key, value: letter, hasExistingText: field.hasText === true })
      continue
    }
    plan.matched += 1
    const value = valueFor(profile, key)
    if (!value) {
      plan.missing.push({ fieldId: field.id, label: field.label, key, ...requiredFlag(field) })
      continue
    }
    const hasExistingText = field.hasText === true
    if (field.kind === 'select' || field.kind === 'radio') {
      const options = field.options ?? []
      const choice = chooseOption(key, value, options)
      if (choice === null) {
        plan.skipped.push({ fieldId: field.id, label: field.label, ...requiredFlag(field) })
        continue
      }
      plan.items.push({ fieldId: field.id, label: field.label, key, value: options[choice]?.label ?? value, choice, hasExistingText })
    } else {
      plan.items.push({ fieldId: field.id, label: field.label, key, value, hasExistingText })
    }
  }
  return plan
}
