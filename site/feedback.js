import { SUPABASE } from './config.js'
import { buildRow, sendFeedback } from './feedback-core.js'

const form = document.getElementById('fb')
const status = document.getElementById('status')
const submit = form.querySelector('button[type="submit"]')

const TEXT = {
  empty: 'Tulis pesannya dulu.',
  inactive: 'Formulir ini belum aktif. Pesanmu belum terkirim.',
  sent: 'Terkirim. Terima kasih!',
  failed: 'Gagal terkirim. Coba lagi nanti.',
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const data = new FormData(form)
  if (String(data.get('website') ?? '') !== '') return
  const row = buildRow(data)
  if (row === null) {
    status.textContent = TEXT.empty
    return
  }
  submit.disabled = true
  status.textContent = 'Mengirim…'
  const result = await sendFeedback(row, SUPABASE)
  if (result === 'sent') form.reset()
  status.textContent = TEXT[result]
  submit.disabled = false
})
