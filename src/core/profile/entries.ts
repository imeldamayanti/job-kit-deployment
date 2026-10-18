import type { Education, Experience, Project } from './types'

export function addEntry<T extends { id: string }>(list: T[], entry: T): T[] {
  return [...list, entry]
}

export function removeEntry<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((entry) => entry.id !== id)
}

export function updateEntry<T extends { id: string }>(list: T[], id: string, change: Partial<T>): T[] {
  return list.map((entry) => (entry.id === id ? { ...entry, ...change } : entry))
}

export function moveEntry<T extends { id: string }>(list: T[], id: string, direction: 'up' | 'down'): T[] {
  const from = list.findIndex((entry) => entry.id === id)
  const to = direction === 'up' ? from - 1 : from + 1
  if (from < 0 || to < 0 || to >= list.length) return list
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved as T)
  return next
}

export function createEducation(id: string): Education {
  return { id, institution: '', level: '', major: '', gpa: '', year: '' }
}

export function createExperience(id: string): Experience {
  return { id, company: '', title: '', start: '', end: '', current: false, description: '' }
}

export function createProject(id: string): Project {
  return { id, name: '', role: '', date: '', description: '' }
}

function joinParts(parts: string[]): string {
  return parts.filter((part) => part.trim() !== '').join(' · ')
}

export function summarizeEducation(entry: Education): string {
  return joinParts([entry.institution, `${entry.level} ${entry.major}`.trim(), entry.year]) || 'Belum diisi'
}

export function summarizeExperience(entry: Experience): string {
  const end = entry.current ? 'sekarang' : entry.end
  const period = [entry.start, end].filter((part) => part.trim() !== '').join(' - ')
  return joinParts([entry.title, entry.company, period]) || 'Belum diisi'
}

export function summarizeProject(entry: Project): string {
  return joinParts([entry.name, entry.role, entry.date]) || 'Belum diisi'
}
