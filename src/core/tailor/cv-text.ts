import { formatPeriod } from './format'
import { CV_LABELS, type Lang } from './language'
import type { CvDocument } from './types'

// The CV as plain text, for "Salin teks CV" when the PDF could not be made (PRD §8). Same order as the PDF.
export function cvToText(doc: CvDocument, lang: Lang): string {
  const labels = CV_LABELS[lang]
  const lines: string[] = [doc.header.name]
  if (doc.header.contacts.length > 0) lines.push(doc.header.contacts.join(' · '))
  if (doc.summary !== '') lines.push('', doc.summary)

  if (doc.skills.length > 0) lines.push('', labels.skills.toUpperCase(), doc.skills.join(', '))

  if (doc.experience.length > 0) {
    lines.push('', labels.experience.toUpperCase())
    doc.experience.forEach((job, index) => {
      if (index > 0) lines.push('')
      lines.push(job.title)
      const meta = [job.company, job.location, formatPeriod(job.start, job.end, job.current, lang)].filter((part) => part !== '').join(' · ')
      if (meta !== '') lines.push(meta)
      for (const bullet of job.bullets) lines.push(`- ${bullet}`)
    })
  }

  if (doc.education.length > 0) {
    lines.push('', labels.education.toUpperCase())
    for (const school of doc.education) {
      const title = [school.level, school.major].filter((part) => part !== '').join(' ')
      if (title !== '') lines.push(title)
      const meta = [school.institution, school.location, school.year].filter((part) => part !== '').join(' · ')
      if (meta !== '') lines.push(meta)
      if (school.gpa !== '') lines.push(`${labels.gpa}: ${school.gpa}`)
      if (school.publication !== '') lines.push(`${labels.publication}: ${school.publication}`)
      if (school.achievements.length > 0) lines.push(`${labels.achievements}:`, ...school.achievements.map((text) => `- ${text}`))
    }
  }

  if (doc.projects.length > 0) {
    lines.push('', labels.projects.toUpperCase())
    doc.projects.forEach((project, index) => {
      if (index > 0) lines.push('')
      lines.push(project.name)
      const meta = [project.role, project.date].filter((part) => part !== '').join(' · ')
      if (meta !== '') lines.push(meta)
      for (const bullet of project.bullets) lines.push(`- ${bullet}`)
    })
  }
  return lines.join('\n')
}
