import { formatRupiah, PACKAGE } from './access'

// One line of the credit history as the Akun page shows it (mockup §10 S13). The ledger row has no more than a reason and a
// change, so what a "generate" was for (CV, letter, scoring) is not known here and reads as plain use of AI.
export type LedgerLine = { at: string; delta: number; reason: string }
export type LedgerView = { title: string; detail: string; amount: string; gain: boolean }

function label(reason: string, delta: number): { title: string; detail: string } {
  switch (reason) {
    case 'purchase':
      // The price is display-only (PACKAGE); a purchase of another size is shown without one.
      return { title: 'Pembelian', detail: delta === PACKAGE.credits ? `Paket ${delta} kredit · ${formatRupiah(PACKAGE.priceIdr)}` : `Paket ${delta} kredit` }
    case 'generate':
      return { title: 'Pemakaian AI', detail: `${Math.abs(delta)} kredit` }
    case 'refund':
      return { title: 'Dikembalikan', detail: 'Kredit pemakaian AI kembali' }
    case 'trial':
      return { title: 'Percobaan gratis', detail: 'Kredit saat daftar' }
    case 'expire':
      return { title: 'Hangus', detail: '1 tahun sejak pembelian terakhir' }
    case 'admin_grant':
      return { title: 'Kredit tambahan', detail: 'Ditambahkan ke saldomu' }
    default:
      return { title: 'Perubahan saldo', detail: '' }
  }
}

// A real minus sign (U+2212) so the sign lines up with the plus in a column of numbers.
export function describeEntry(entry: LedgerLine): LedgerView {
  return { ...label(entry.reason, entry.delta), amount: `${entry.delta >= 0 ? '+' : '−'}${Math.abs(entry.delta)}`, gain: entry.delta >= 0 }
}
