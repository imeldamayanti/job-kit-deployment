// The private admin page (RFC D19): turns what admin_stats() answers into rows. Pure, no DOM. Only plain numbers and short
// strings are kept, and the page writes them with textContent, so a strange answer cannot inject anything.
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const str = (v) => (typeof v === 'string' ? v.slice(0, 40) : '')
const list = (v) => (Array.isArray(v) ? v : [])

export function parseStats(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  return {
    accountsTotal: num(r.accounts_total),
    accountsWriting7d: num(r.accounts_writing_7d),
    newByDay: list(r.accounts_new_by_day).filter((x) => x && /^\d{4}-\d{2}-\d{2}$/.test(x.day) && typeof x.count === 'number').map((x) => ({ day: x.day, count: x.count })),
    events7d: list(r.events_7d).filter((x) => x && typeof x.count === 'number').map((x) => ({ name: str(x.name), version: str(x.version), count: x.count })),
    byVersion30d: list(r.events_by_version_30d).filter((x) => x && typeof x.count === 'number').map((x) => ({ version: str(x.version), count: x.count })),
  }
}

export function sections(stats) {
  return {
    headline: [
      { label: 'Akun terdaftar', value: String(stats.accountsTotal) },
      { label: 'Akun yang menulis dalam 7 hari', value: String(stats.accountsWriting7d) },
    ],
    tables: [
      { title: 'Akun baru per hari (30 hari)', head: ['Hari', 'Akun'], rows: stats.newByDay.map((x) => [x.day, String(x.count)]) },
      { title: 'Kejadian 7 hari terakhir', head: ['Kejadian', 'Versi', 'Jumlah'], rows: stats.events7d.map((x) => [x.name, x.version, String(x.count)]) },
      { title: 'Hitungan per versi (30 hari)', head: ['Versi', 'Jumlah'], rows: stats.byVersion30d.map((x) => [x.version, String(x.count)]) },
    ],
  }
}

export function adminRequest(config, token) {
  return {
    url: `${config.url.replace(/\/$/, '')}/rest/v1/rpc/admin_stats`,
    init: { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.key, Authorization: `Bearer ${token}` }, body: '{}' },
  }
}
