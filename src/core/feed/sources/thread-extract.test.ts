import { describe, expect, it } from 'vitest'
import { parseThreadPost } from './thread-extract'

const URL = 'https://www.threads.com/share/D4hg9klTS/'

const HIRING = `We're hiring: Full-Stack Developer — on-site in Uluwatu, Bali 🌴
Ready to build with us? 👉 Apply via the link in our bio.
𝘋𝘳𝘪𝘷𝘦𝘯 𝘣𝘺 𝘋𝘶𝘵𝘤𝘩 𝘌𝘹𝘱𝘦𝘳𝘵𝘪𝘴𝘦. 𝘐𝘯𝘴𝘱𝘪𝘳𝘦𝘥 𝘣𝘺 𝘉𝘢𝘭𝘪.
#FullStackDeveloper #BaliJobs #LowonganKerjaBali #TechJobsIndonesia #NGHPropertyGroup`

const CHATTER = 'Ada yang sejak kerja pake AI jadi CAPEEEEE banget ga otak dan mentalnya. Kalau menurut kalian kenapa ya gitu?'

describe('parseThreadPost', () => {
  it('reads one job out of a hiring post', () => {
    const [job, ...rest] = parseThreadPost(HIRING, { url: URL, postedAt: '2026-10-19' })
    expect(rest).toEqual([])
    expect(job).toMatchObject({
      source: 'thread',
      title: 'Full-Stack Developer',
      company: 'NGH Property Group',
      location: 'Uluwatu, Bali',
      workplace: 'onsite',
      postedAt: '2026-10-19',
      url: URL,
    })
  })

  it('folds styled unicode letters and drops hashtag lines from the description', () => {
    const [job] = parseThreadPost(HIRING, { url: URL })
    expect(job?.description).toContain('Driven by Dutch Expertise')
    expect(job?.description).not.toContain('#')
  })

  it('returns nothing for a post that is not a job', () => {
    expect(parseThreadPost(CHATTER, { url: URL })).toEqual([])
    expect(parseThreadPost('', { url: URL })).toEqual([])
  })

  it('leaves unknown fields empty instead of guessing', () => {
    const [job] = parseThreadPost('Lowongan: Data Analyst. Kirim CV ke hr@contoh.id', { url: URL })
    expect(job).toMatchObject({ title: 'Data Analyst', company: '', location: '', workplace: 'unknown', salary: '' })
  })

  it('ignores posts that only talk about jobs', () => {
    const talk = [
      'Job portal underrated padahal GACOR BGTT mana banyak loker remote di luar negeri😭',
      'YAALLAH MAU LOKERRRRRRR FRESGRADDDD 😭',
      'Kalian gausah buka 10 tab job loker remote, jobly.my.id udah sediain dari seluruh job loker remote yang terpecaya buat nyariin kamu job remote yang cocok dan semua loker GRATIS!\ntinggal tingkatin',
    ]
    for (const text of talk) expect(parseThreadPost(text, { url: URL })).toEqual([])
  })

  it('keeps a role that starts with a work-mode word', () => {
    const [job] = parseThreadPost("We're hiring: Remote Backend Engineer. DM kami", { url: URL })
    expect(job?.title).toBe('Remote Backend Engineer')
  })

  it('reads remote and contract hints', () => {
    const [job] = parseThreadPost("We're hiring: Product Designer (remote, contract) at Acme", { url: URL })
    expect(job).toMatchObject({ title: 'Product Designer', workplace: 'remote', contract: 'Contract', company: 'Acme' })
  })
})
