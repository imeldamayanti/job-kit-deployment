import { describe, expect, it } from 'vitest'
import { describeEntry } from './ledger'

const entry = (reason: string, delta: number) => ({ at: '2026-11-19T08:00:00.000Z', delta, reason })

describe('describeEntry', () => {
  it('labels a purchase with the package and its price', () => {
    expect(describeEntry(entry('purchase', 50))).toEqual({ title: 'Pembelian', detail: 'Paket 50 kredit · Rp10.800', amount: '+50', gain: true })
  })

  it('labels a purchase of another size without a price it cannot know', () => {
    expect(describeEntry(entry('purchase', 20))).toEqual({ title: 'Pembelian', detail: 'Paket 20 kredit', amount: '+20', gain: true })
  })

  it('labels use of AI as a loss with a minus sign', () => {
    expect(describeEntry(entry('generate', -1))).toEqual({ title: 'Pemakaian AI', detail: '1 kredit', amount: '−1', gain: false })
  })

  it('labels a refund, the free trial and a lapse', () => {
    expect(describeEntry(entry('refund', 1))).toEqual({ title: 'Dikembalikan', detail: 'Kredit pemakaian AI kembali', amount: '+1', gain: true })
    expect(describeEntry(entry('trial', 3))).toEqual({ title: 'Percobaan gratis', detail: 'Kredit saat daftar', amount: '+3', gain: true })
    expect(describeEntry(entry('expire', -12))).toEqual({ title: 'Hangus', detail: '1 tahun sejak pembelian terakhir', amount: '−12', gain: false })
  })

  it('labels an unknown reason plainly instead of showing the raw word', () => {
    expect(describeEntry(entry('sesuatu_baru', 2)).title).toBe('Perubahan saldo')
    expect(describeEntry(entry('admin_grant', 5)).title).toBe('Kredit tambahan')
  })
})
