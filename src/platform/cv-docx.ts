import { formatPeriod } from '../core/tailor/format'
import { CV_LABELS, type Lang } from '../core/tailor/language'
import type { CvDocument } from '../core/tailor/types'

// The CV as a Word file (.docx), in the same layout as the PDF: name and contacts centred, Education, Experience, Skills,
// each place with its dates flush right. Word writes any letter, so nothing is replaced. The library is loaded on first use.
const PAGE_WIDTH = 11906 // A4, in twentieths of a point
const MARGIN = 1020
const TEXT_WIDTH = PAGE_WIDTH - 2 * MARGIN
const GRAY = '444444'

export async function renderCvDocx(doc: CvDocument, lang: Lang, title: string): Promise<Uint8Array> {
  const { AlignmentType, BorderStyle, Document, LevelFormat, Packer, Paragraph, Tab, TabStopType, TextRun } = await import('docx')
  const labels = CV_LABELS[lang]
  const font = 'Arial'
  const run = (text: string, options: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}) =>
    new TextRun({ text, font, size: (options.size ?? 10) * 2, bold: options.bold, italics: options.italics, color: options.color })

  const heading = (text: string) =>
    new Paragraph({
      spacing: { before: 200, after: 80 },
      keepNext: true,
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '111111', space: 1 } },
      children: [run(text, { bold: true, size: 12 })],
    })
  // Name on the left, dates flush right through a right tab stop: plain text order, which a CV parser reads correctly.
  const split = (left: string, right: string, location = '') =>
    new Paragraph({
      keepNext: true,
      spacing: { before: 80 },
      tabStops: [{ type: TabStopType.RIGHT, position: TEXT_WIDTH }],
      children: [
        run(left, { bold: true, size: 10.5 }),
        ...(location !== '' ? [run(` - ${location}`, { bold: true, size: 10.5, color: '808080' })] : []),
        ...(right !== '' ? [new TextRun({ children: [new Tab(), right], font, size: 20 })] : []),
      ],
    })
  const subtitle = (text: string) => new Paragraph({ keepNext: true, children: [run(text, { italics: true })] })
  const bullet = (text: string, label = '', reference = 'bullets') =>
    new Paragraph({ numbering: { reference, level: 0 }, children: [...(label !== '' ? [run(`${label}: `, { bold: true })] : []), run(text)] })

  const body: InstanceType<typeof Paragraph>[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [run(doc.header.name.toUpperCase(), { bold: true, size: 20 })] }),
  ]
  if (doc.header.contacts.length > 0) {
    body.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [run(doc.header.contacts.join(' | '), { size: 9.5, color: GRAY })] }))
  }

  if (doc.summary !== '') body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [run(doc.summary)] }))

  if (doc.education.length > 0) {
    body.push(heading(labels.education))
    for (const school of doc.education) {
      if (school.institution !== '') body.push(split(school.institution, school.year, school.location))
      const level = [school.level, school.major].filter((part) => part !== '').join(' ')
      if (level !== '') body.push(subtitle(level))
      if (school.gpa !== '') body.push(bullet(school.gpa, labels.gpa))
      if (school.publication !== '') body.push(bullet(school.publication, labels.publication))
      if (school.achievements.length > 0) {
        body.push(bullet('', labels.achievements))
        for (const text of school.achievements) body.push(bullet(text, '', 'dashes'))
      }
    }
  }
  if (doc.experience.length > 0) {
    body.push(heading(labels.experience))
    for (const job of doc.experience) {
      body.push(split(job.company !== '' ? job.company : job.title, formatPeriod(job.start, job.end, job.current, lang), job.company !== '' ? job.location : ''))
      if (job.company !== '' && job.title !== '') body.push(subtitle(job.title))
      for (const text of job.bullets) body.push(bullet(text))
    }
  }
  if (doc.projects.length > 0) {
    body.push(heading(labels.projects))
    for (const project of doc.projects) {
      body.push(split(project.name, project.date))
      if (project.role !== '') body.push(subtitle(project.role))
      for (const text of project.bullets) body.push(bullet(text))
    }
  }
  if (doc.skills.length > 0) {
    body.push(heading(labels.skills), new Paragraph({ children: [run(doc.skills.join(', '))] }))
  }

  const file = new Document({
    title,
    creator: 'job-kit',
    numbering: {
      config: [
        {
          reference: 'dashes',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '-', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 220 } } } }],
        },
        {
          reference: 'bullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 220 } } } }],
        },
      ],
    },
    sections: [{ properties: { page: { size: { width: PAGE_WIDTH, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } }, children: body }],
  })
  // toBlob, not toBuffer: the browser has no Node Buffer.
  return new Uint8Array(await (await Packer.toBlob(file)).arrayBuffer())
}
