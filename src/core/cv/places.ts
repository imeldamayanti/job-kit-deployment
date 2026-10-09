// Cities and provinces a CV header is likely to name. A city outside this list is still read when it
// is labelled ("Kota: ...") or written as "<place>, <province>", but then only with low confidence.
const CITIES = [
  'Jakarta',
  'Jakarta Pusat',
  'Jakarta Utara',
  'Jakarta Barat',
  'Jakarta Selatan',
  'Jakarta Timur',
  'Bandung',
  'Surabaya',
  'Yogyakarta',
  'Semarang',
  'Medan',
  'Makassar',
  'Depok',
  'Bekasi',
  'Tangerang',
  'Tangerang Selatan',
  'Bogor',
  'Malang',
  'Denpasar',
  'Palembang',
  'Balikpapan',
  'Batam',
  'Surakarta',
  'Solo',
  'Pekanbaru',
  'Padang',
  'Manado',
  'Pontianak',
  'Banjarmasin',
  'Samarinda',
  'Bandar Lampung',
  'Cirebon',
  'Sidoarjo',
  'Karawang',
  'Cikarang',
  'Jambi',
  'Mataram',
  'Kupang',
  'Ambon',
  'Jayapura',
]

const PROVINCES = [
  'Indonesia',
  'Aceh',
  'Sumatera Utara',
  'Sumatera Barat',
  'Riau',
  'Kepulauan Riau',
  'Jambi',
  'Sumatera Selatan',
  'Bengkulu',
  'Lampung',
  'Bangka Belitung',
  'DKI Jakarta',
  'Banten',
  'Jawa Barat',
  'Jawa Tengah',
  'DI Yogyakarta',
  'Daerah Istimewa Yogyakarta',
  'Jawa Timur',
  'Bali',
  'Nusa Tenggara Barat',
  'Nusa Tenggara Timur',
  'Kalimantan Barat',
  'Kalimantan Tengah',
  'Kalimantan Selatan',
  'Kalimantan Timur',
  'Kalimantan Utara',
  'Sulawesi Utara',
  'Sulawesi Tengah',
  'Sulawesi Selatan',
  'Sulawesi Tenggara',
  'Gorontalo',
  'Sulawesi Barat',
  'Maluku',
  'Maluku Utara',
  'Papua',
]

const byLowerCase = (names: string[]) => new Map(names.map((name) => [name.toLowerCase(), name]))
const cityMap = byLowerCase(CITIES)
const provinceMap = byLowerCase(PROVINCES)

// The canonical spelling of a known city, or undefined.
export function findCity(name: string): string | undefined {
  return cityMap.get(name.trim().toLowerCase())
}

export function isProvince(name: string): boolean {
  return provinceMap.has(name.trim().toLowerCase())
}
