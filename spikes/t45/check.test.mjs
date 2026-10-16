import test from 'node:test'
import assert from 'node:assert/strict'
import { checkOutput } from './check.mjs'
import { PROFILES } from './profiles.mjs'

const A = PROFILES[0]
const ok = () => ({
  skills: ['react', 'TypeScript', 'Node.js'],
  experience: [{ sourceId: 'exp-a1', bullets: ['Membangun dashboard pelanggan dengan React dan TypeScript.', 'Menaikkan cakupan tes dari 40% ke 70% dengan Jest.'] }],
  education: ['edu-a1'],
})

test('rearranged skills and reworded bullets pass', () => {
  assert.deepEqual(checkOutput(ok(), A), [])
})

test('invented Kubernetes and 50% give two violations', () => {
  const out = ok()
  out.experience[0].bullets.push('Mengelola cluster Kubernetes dan memangkas waktu deploy 50%.')
  const v = checkOutput(out, A)
  assert.deepEqual(v.map((x) => `${x.type}:${x.value}`).sort(), ['number:50', 'term:kubernetes'])
})

test('skill outside the profile is flagged, case ignored for skills inside', () => {
  const out = ok()
  out.skills.push('Kotlin', 'jest')
  assert.deepEqual(checkOutput(out, A).map((x) => `${x.type}:${x.value}`), ['skill:Kotlin'])
})

test('unknown and duplicate sourceId are flagged', () => {
  const out = ok()
  out.experience.push({ sourceId: 'exp-zzz', bullets: ['x'] }, { sourceId: 'exp-a1', bullets: ['y'] })
  assert.deepEqual(checkOutput(out, A).map((x) => `${x.type}:${x.value}`).sort(), ['source:exp-a1', 'source:exp-zzz'])
})

test('Indonesian formatted number must exist in the source', () => {
  const p = { ...A, experience: [{ ...A.experience[0], description: 'Menghemat biaya Rp 1,5 juta per bulan dengan React.' }] }
  const good = { skills: [], experience: [{ sourceId: 'exp-a1', bullets: ['Menghemat Rp 1,5 juta per bulan.'] }], education: [] }
  const bad = { skills: [], experience: [{ sourceId: 'exp-a1', bullets: ['Menghemat Rp 2,5 juta per bulan.'] }], education: [] }
  assert.deepEqual(checkOutput(good, p), [])
  assert.deepEqual(checkOutput(bad, p).map((x) => `${x.type}:${x.value}`), ['number:2.5'])
})

test('unknown education id is flagged', () => {
  const out = ok()
  out.education = ['edu-nope']
  assert.deepEqual(checkOutput(out, A).map((x) => `${x.type}:${x.value}`), ['source:edu-nope'])
})
