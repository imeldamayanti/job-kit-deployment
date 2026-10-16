// Turns a run's JSON into two Markdown files: summary.md (numbers) and ratings.md (the 9 results for PIC to rate).
// Usage: node report.mjs results/<run>.json [--model gemini-3.8-flash]
import { readFileSync, writeFileSync } from 'node:fs'
import { PROFILES } from './profiles.mjs'

const file = process.argv[2]
const modelArg = process.argv.indexOf('--model')
const data = JSON.parse(readFileSync(file, 'utf8'))
const rows = data.results
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const usd = (x) => (x == null ? 'n/a' : `$${x.toFixed(5)}`)

// --- summary ---
const lines = ['# T45: ringkasan angka', '', `Run: ${data.at}`, '']
lines.push('| Model | Mode | Hasil | Gagal panggil/parse | Hasil dengan ≥1 pelanggaran | Pelanggaran (skill/sumber/angka/istilah/cakupan) | Token masuk | Token keluar | Detik | Biaya berbayar/CV |')
lines.push('|---|---|---|---|---|---|---|---|---|---|')
for (const model of data.models) {
  for (const mode of data.modes) {
    const g = rows.filter((r) => r.model === model && r.mode === mode)
    if (!g.length) continue
    const good = g.filter((r) => !r.error)
    const count = (t) => good.reduce((s, r) => s + r.violations.filter((v) => v.type === t).length, 0)
    const cov = good.reduce((s, r) => s + r.coverageViolations.length, 0)
    const dirty = good.filter((r) => r.violations.length || r.coverageViolations.length).length
    lines.push(
      `| ${model} | ${mode === 'one' ? '1 panggilan' : '2 panggilan'} | ${g.length} | ${g.length - good.length} | ${dirty}/${good.length} | ${count('skill')}/${count('source')}/${count('number')}/${count('term')}/${cov} | ${Math.round(avg(good.map((r) => r.inTokens)))} | ${Math.round(avg(good.map((r) => r.outTokens)))} | ${(avg(good.map((r) => r.ms)) / 1000).toFixed(1)} | ${usd(avg(good.map((r) => r.estCostUsd ?? 0)))} |`,
    )
  }
}
lines.push('', 'Lolos tanpa pemeriksa fakta = semua hasil yang berhasil di-parse (pengguna melihat semuanya). Lolos dengan pemeriksa = hasil dengan 0 pelanggaran mekanis; sisanya ditolak. Klaim semantik ("memimpin", "mengelola") tidak terlihat mesin dan dinilai PIC di ratings.md.', '')
lines.push('## Pelanggaran per hasil', '')
for (const r of rows.filter((x) => x.violations.length || x.coverageViolations.length || x.error)) {
  lines.push(`- ${r.model} / ${r.mode} / ${r.profile}×${r.job}: ${r.error ? 'ERROR ' + r.error.slice(0, 100) : [...r.violations, ...r.coverageViolations].map((v) => `${v.type}:${v.value}`).join(', ')}`)
}
writeFileSync(file.replace(/\.json$/, '-summary.md'), lines.join('\n') + '\n')

// --- ratings: 9 cards for one model; both modes shown blind as Versi X / Versi Y ---
const model = modelArg > 0 ? process.argv[modelArg + 1] : data.models[0]
const jobsById = Object.fromEntries(data.jobs.map((j) => [j.id, j]))
const card = (r, label) => {
  if (!r || r.error) return [`**${label}**: gagal (${r?.error?.slice(0, 80) ?? 'tidak ada'})`, '']
  const o = r.output
  const out = [`**${label}**`, `- Skill: ${(o.skills ?? []).join(', ') || '-'}`]
  for (const e of o.experience ?? []) {
    out.push(`- ${e.sourceId}:`)
    for (const b of e.bullets ?? []) out.push(`  - ${b}`)
  }
  out.push(`- Tertutup: ${(o.coverage?.covered ?? []).join('; ') || '-'}`, `- Belum tertutup: ${(o.coverage?.missing ?? []).join('; ') || '-'}`)
  out.push(`- Pemeriksa kasar: ${r.violations.length || r.coverageViolations.length ? 'DITOLAK → ' + [...r.violations, ...r.coverageViolations].map((v) => `${v.type}:${v.value}`).join(', ') : 'lolos'}`, '')
  return out
}
const sheet = ['# T45: 9 hasil untuk dinilai PIC', '', `Model: ${model}. Tiap kartu menampilkan dua versi tanpa label mode (X dan Y); kuncinya ada di bagian akhir. Nilai tiap versi 1 sampai 5 untuk: **selaras** (butir yang diubah benar-benar lebih dekat ke requirement) dan **jujur** (tidak ada klaim yang melebihi deskripsi asal). Tulis juga bila ada klaim palsu yang lolos pemeriksa.`, '']
const key = []
let i = 0
for (const p of PROFILES) {
  for (const j of data.jobs) {
    i++
    const one = rows.find((r) => r.model === model && r.mode === 'one' && r.profile === p.id && r.job === j.id)
    const two = rows.find((r) => r.model === model && r.mode === 'two' && r.profile === p.id && r.job === j.id)
    const swap = i % 2 === 0
    const [x, y] = swap ? [two, one] : [one, two]
    key.push(`${i}: X = ${swap ? '2 panggilan' : '1 panggilan'}, Y = ${swap ? '1 panggilan' : '2 panggilan'}`)
    sheet.push(`## Hasil ${i}: profil ${p.id} (${p.label}) × ${j.id} ${jobsById[j.id].title}`, '')
    sheet.push('Asli:')
    for (const e of p.experience) sheet.push(`- ${e.id} (${e.title}): ${e.description}`)
    sheet.push('', `Requirement (versi X): ${(x?.output?.requirements ?? []).join('; ') || '-'}`, `Requirement (versi Y): ${(y?.output?.requirements ?? []).join('; ') || '-'}`, '')
    sheet.push(...card(x, 'Versi X'), ...card(y, 'Versi Y'))
    sheet.push('Nilai X: selaras _/5, jujur _/5 · Nilai Y: selaras _/5, jujur _/5 · Catatan: ', '')
  }
}
sheet.push('## Kunci', '', ...key.map((k) => `- ${k}`), '')
writeFileSync(file.replace(/\.json$/, '-ratings.md'), sheet.join('\n'))
console.log('Ditulis:', file.replace(/\.json$/, '-summary.md'), 'dan -ratings.md')
