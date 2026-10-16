// Writes fixtures/applications/sample-applications.json: a job-kit Export (version 3) full of made-up
// applications, to try the Lamaran pages without applying to real jobs first. Dates are relative to
// today, so "Tanpa kabar" (14 days or more without a change) stays true whenever this is run.
//
//   node scripts/make-sample-applications.mjs
//
// Import it on the Data page with "Gabung". Do not use "Ganti seluruhnya": the file has no profile,
// and replacing would empty yours.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const NOW = new Date()
const ago = (days) => new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate() - days, 3)).toISOString()

const applications = []
const cvs = []
const letters = []

// moves: [status, daysAgo][] in order. The last move is the current status.
function add(n, title, company, source, created, moves, extra = {}) {
  const id = `sample-${String(n).padStart(2, '0')}`
  const events = [{ at: ago(created), type: 'created' }]
  let from = 'draft'
  for (const [to, days] of moves) {
    events.push({ at: ago(days), type: 'status', from, to })
    from = to
  }
  const madeAt = ago(Math.max(created - 1, 0))
  let cvId = null
  let letterId = null
  if (extra.cv) {
    cvId = `${id}-cv`
    events.push({ at: madeAt, type: 'cv' })
    cvs.push({
      id: cvId, applicationId: id, createdAt: madeAt, profileHash: 'sample',
      skills: ['TypeScript', 'React'], experience: [], education: [],
      coverage: { required: ['React', 'TypeScript', 'GraphQL'], covered: ['React', 'TypeScript'], missing: ['GraphQL'] },
      edited: false, aiVersion: { skills: ['TypeScript', 'React'], experience: [], education: [] },
    })
  }
  if (extra.letter) {
    letterId = `${id}-letter`
    events.push({ at: madeAt, type: 'letter' })
    letters.push({
      id: letterId, applicationId: id, createdAt: madeAt, profileHash: 'sample',
      lang: 'id', tone: 'formal', body: 'Yth. Tim Rekrutmen,\n\n(Surat contoh.)', aiBody: 'Yth. Tim Rekrutmen,\n\n(Surat contoh.)', edited: false,
    })
  }
  events.sort((a, b) => a.at.localeCompare(b.at))
  applications.push({
    id,
    jobId: `sample-job-${n}`,
    job: {
      title, company, source, url: `https://example.test/sample/${n}`,
      description: extra.noText ? '' : `${title} di ${company}.\nMembangun antarmuka web dengan React dan TypeScript.\nKerja sama dengan tim produk dan desain.`,
      capturedAt: ago(created),
    },
    status: moves.length ? moves.at(-1)[0] : 'draft',
    cvId, letterId,
    followUpAt: extra.followUp === undefined ? null : ago(-extra.followUp).slice(0, 10),
    notes: extra.notes ?? '',
    events,
    createdAt: ago(created),
    updatedAt: events.at(-1).at,
  })
}

// The 12 that were sent match PRD FR-48's example: 6 reached review, 3 reached interview, 1 offer,
// 4 rejected, 4 no reply (applied 14+ days ago, never changed), 3 still going.
add(1, 'Frontend Engineer (React)', 'PT Contoh Karya', 'greenhouse', 40, [['applied', 38], ['in-review', 30], ['interview', 22], ['offer', 10]], { cv: true, letter: true, notes: 'Offer: gaji Rp 22 jt. Jawab paling lambat minggu depan.' })
add(2, 'Fullstack Engineer', 'Sinar Data', 'lever', 30, [['applied', 28], ['in-review', 20], ['interview', 6]], { cv: true, notes: 'Interview teknis dengan Pak Dodi.', followUp: 2 })
add(3, 'Web Developer', 'Studio Contoh', 'lever', 35, [['applied', 33], ['in-review', 25], ['interview', 18], ['rejected', 12]], { cv: true, letter: true })
add(4, 'UI Engineer', 'Contoh Digital Nusantara', 'ashby', 12, [['applied', 11], ['in-review', 4]], { cv: true })
add(5, 'Software Engineer, Web Platform', 'Bumi Teknologi', 'greenhouse', 26, [['applied', 24], ['in-review', 16], ['rejected', 9]])
add(6, 'Product Engineer', 'Kita Studio', 'ashby', 24, [['applied', 22], ['in-review', 14], ['rejected', 7]], { cv: true })
add(7, 'Frontend Engineer (Intern)', 'Nusa Teknologi', 'linkedin', 20, [['applied', 18], ['rejected', 11]])
add(8, 'React Developer', 'Bumi Mandiri', 'remotive', 28, [['applied', 26]], { cv: true })
add(9, 'Senior Frontend Developer', 'Contoh Remote Co', 'remotive', 32, [['applied', 30]], { cv: true, letter: true })
add(10, 'Web Engineer', 'Lintas Kode', 'greenhouse', 45, [['applied', 42]])
add(11, 'JavaScript Developer', 'Aksara Pagi', 'linkedin', 21, [['applied', 20]])
add(12, 'Frontend Developer', 'Warung Digital', 'lever', 6, [['applied', 5]], { cv: true })
// Not sent, so the diagram does not count them: two drafts (one without posting text, to see the paste box) and one withdrawn.
add(13, 'Frontend Engineer', 'Mitra Solusi', 'greenhouse', 3, [], { cv: true })
add(14, 'Mobile Web Developer', 'Tanpa Teks Co', 'lever', 2, [], { noText: true })
add(15, 'Design Engineer', 'Lentera Kreatif', 'ashby', 15, [['withdrawn', 8]])

const file = { app: 'job-kit', version: 3, exportedAt: NOW.toISOString(), profile: { version: 2 }, jobs: [], applications, cvs, letters }

const out = join(root, 'fixtures', 'applications', 'sample-applications.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(file, null, 2) + '\n')
console.log(`${applications.length} lamaran, ${cvs.length} CV, ${letters.length} surat -> ${out}`)
