// Builds spikes/t51/results/report.html from the latest results JSON: a summary of refusals A (production prompt) vs B (no tool ban),
// every letter with what the fact check found, and rating buttons (saved in the browser, copyable).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
const dir = new URL('./results/', import.meta.url)
const latest = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().at(-1)
const data = JSON.parse(readFileSync(new URL(latest, dir), 'utf8'))
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const rows = data.rows
const by = (v) => rows.filter((r) => r.variant === v)
const stat = (v) => {
  const r = by(v)
  const bad = r.filter((x) => !x.ok)
  return { n: r.length, ok: r.length - bad.length, bad: bad.length, ai: bad.filter((x) => x.reason === 'ai').length, ungrounded: bad.filter((x) => x.reason === 'ungrounded').length, unreadable: bad.filter((x) => x.reason === 'unreadable').length, usd: r.reduce((s, x) => s + (x.usd ?? 0), 0) }
}
const terms = (v) => {
  const m = new Map()
  for (const r of by(v)) for (const x of r.violations) m.set(`${x.type}:${x.value}`, (m.get(`${x.type}:${x.value}`) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1])
}
const A = stat('A'), B = stat('B')
const bar = (s) => `<div class="bar"><i class="ok" style="width:${(s.ok / s.n) * 100}%"></i><i class="ug" style="width:${(s.ungrounded / s.n) * 100}%"></i><i class="un" style="width:${((s.unreadable + s.ai) / s.n) * 100}%"></i></div>`
const cell = (r) => `<a href="#c-${r.variant}-${r.profile}-${r.job}" class="cell ${r.ok ? 'ok' : r.reason === 'ungrounded' ? 'ug' : 'un'}" title="${esc(r.ok ? 'lolos' : r.message)}">${r.profile}·${r.job}<b>${r.ok ? '✓' : r.reason === 'ungrounded' ? '✗' : '!'}</b></a>`
const card = (r) => `<article class="card" id="c-${r.variant}-${r.profile}-${r.job}" data-id="${r.variant}-${r.profile}-${r.job}">
<header><span class="tag ${r.variant}">Prompt ${r.variant}</span><b>${esc(r.profileName)} → ${esc(r.jobTitle)}</b><span class="mute">${esc(r.company)}</span>
<span class="st ${r.ok ? 'ok' : r.reason === 'ungrounded' ? 'ug' : 'un'}">${r.ok ? `lolos · ${r.words} kata · ${r.lang}` : r.reason === 'ungrounded' ? 'DITOLAK pemeriksa fakta' : 'gagal: ' + esc(r.reason)}</span></header>
${r.ok ? `<pre>${esc(r.body)}</pre>` : `<p class="why">${esc(r.message)}</p>${r.violations.length ? `<ul class="v">${r.violations.map((v) => `<li><code>${esc(v.value)}</code> <span class="mute">${v.type === 'number' ? 'angka' : v.type === 'term' ? 'istilah' : v.type}</span></li>`).join('')}</ul>` : ''}`}
<footer>${r.ok ? ['Jujur', 'Layak kirim'].map((k) => `<span class="rate" data-k="${k}"><em>${k}</em>${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}">${n}</button>`).join('')}</span>`).join('') : ''}
<span class="mute">${r.inTokens}+${r.outTokens} token${r.usd != null ? ` · $${r.usd.toFixed(4)}` : ''}</span></footer></article>`
const grid = (v) => ['A', 'B', 'C'].map((p) => `<div class="row">${by(v).filter((r) => r.profile === p).map(cell).join('')}</div>`).join('')
const list = (v) => terms(v).map(([k, n]) => `<li><code>${esc(k.split(':')[1])}</code> <span class="mute">${k.startsWith('number') ? 'angka' : 'istilah'} ×${n}</span></li>`).join('') || '<li class="mute">tidak ada</li>'
writeFileSync(new URL('report.html', dir), `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mutu surat T51</title><style>
:root{--bg:#fafaf7;--card:#fff;--ink:#1d1d1b;--mute:#6b6b66;--line:#e3e2dc;--ok:#2e8b4a;--okbg:#e3f4e6;--ug:#c0392b;--ugbg:#fde4e1;--un:#b7791f;--unbg:#fff1d6;--acc:#2f5fd0}
@media(prefers-color-scheme:dark){:root{--bg:#161614;--card:#1f1f1c;--ink:#ecece6;--mute:#9a9a92;--line:#34342f;--ok:#7fd196;--okbg:#183a21;--ug:#ff8f84;--ugbg:#4a1e19;--un:#f0c46b;--unbg:#44330f;--acc:#8aa8ff}}
*{box-sizing:border-box}body{margin:0 auto;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,sans-serif;padding:16px;max-width:1100px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px}.mute{color:var(--mute);font-size:13px}code{background:var(--line);padding:1px 5px;border-radius:4px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:700px){.two{grid-template-columns:1fr}}
.box{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}.big{font-size:28px;font-weight:700}
.bar{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--line);margin:8px 0}.bar i{display:block}.bar .ok{background:var(--ok)}.bar .ug{background:var(--ug)}.bar .un{background:var(--un)}
.row{display:flex;gap:6px;margin:4px 0}.cell{flex:1;text-align:center;padding:6px;border-radius:8px;text-decoration:none;color:var(--ink);font-size:13px;border:1px solid var(--line)}.cell b{margin-left:6px}
.cell.ok{background:var(--okbg)}.cell.ug{background:var(--ugbg)}.cell.un{background:var(--unbg)}
ul.t{margin:6px 0 0;padding-left:18px}ul.v{margin:6px 0;padding-left:18px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin:12px 0}.card header{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline}
.tag{font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px;background:var(--line)}.tag.A{background:var(--okbg);color:var(--ok)}.tag.B{background:var(--unbg);color:var(--un)}
.st{margin-left:auto;font-size:12px;font-weight:700;padding:2px 8px;border-radius:6px}.st.ok{background:var(--okbg);color:var(--ok)}.st.ug{background:var(--ugbg);color:var(--ug)}.st.un{background:var(--unbg);color:var(--un)}
pre{white-space:pre-wrap;font:inherit;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:12px;margin:10px 0}.why{color:var(--ug);margin:10px 0 0}
footer{display:flex;flex-wrap:wrap;gap:14px;align-items:center}.rate{display:inline-flex;gap:4px;align-items:center}.rate em{font-style:normal;font-size:13px;color:var(--mute);margin-right:4px}
.rate button{width:32px;height:32px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}.rate button[aria-pressed=true]{background:var(--acc);color:#fff;border-color:var(--acc)}
.sticky{position:sticky;bottom:0;background:var(--bg);padding:10px 0;display:flex;gap:10px;align-items:center;border-top:1px solid var(--line)}.sticky button{padding:8px 14px;border-radius:8px;border:0;background:var(--acc);color:#fff;font-weight:600;cursor:pointer}
</style></head><body>
<h1>Mutu surat T51 — ${esc(data.model)}</h1>
<p class="mute">3 profil × 3 lowongan × 2 prompt, lewat <code>writeLetter</code> asli (prompt, privasi, pemeriksa fakta). ${esc(data.at.slice(0, 10))}. Prompt A = produksi (melarang menyebut alat lowongan yang tidak ada di Profile). Prompt B = sama tanpa larangan itu.</p>
<div class="two">
<div class="box"><b>Prompt A (produksi)</b><div class="big">${A.ok} / ${A.n} lolos</div>${bar(A)}<span class="mute">ditolak pemeriksa ${A.ungrounded} · tak terbaca ${A.unreadable} · gagal panggilan ${A.ai} · $${A.usd.toFixed(4)}</span>${grid('A')}<h2>Yang memicu penolakan</h2><ul class="t">${list('A')}</ul></div>
<div class="box"><b>Prompt B (tanpa larangan)</b><div class="big">${B.ok} / ${B.n} lolos</div>${bar(B)}<span class="mute">ditolak pemeriksa ${B.ungrounded} · tak terbaca ${B.unreadable} · gagal panggilan ${B.ai} · $${B.usd.toFixed(4)}</span>${grid('B')}<h2>Yang memicu penolakan</h2><ul class="t">${list('B')}</ul></div>
</div>
<p class="mute">Hijau lolos · merah ditolak pemeriksa fakta · kuning gagal teknis. Klik sel untuk lompat ke suratnya. Bacalah suratnya, lalu nilai: <b>Jujur</b> (adakah klaim yang bukan milik profil, meski lolos mesin?) dan <b>Layak kirim</b> (akan kamu kirim apa adanya?).</p>
<h2>Semua surat</h2>
${rows.map(card).join('')}
<div class="sticky"><button id="copy" type="button">Salin nilai saya</button><span class="mute" id="note">Nilai tersimpan di browser ini.</span></div>
<script>
const KEY='t51-ratings-${esc(latest)}';let r={};try{r=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}
const paint=()=>document.querySelectorAll('.card').forEach(c=>c.querySelectorAll('.rate').forEach(g=>g.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String((r[c.dataset.id]||{})[g.dataset.k]==b.dataset.n)))))
document.addEventListener('click',e=>{const b=e.target.closest('.rate button');if(!b)return;const c=b.closest('.card').dataset.id,k=b.closest('.rate').dataset.k;(r[c]=r[c]||{})[k]=+b.dataset.n;try{localStorage.setItem(KEY,JSON.stringify(r))}catch{};paint()})
document.getElementById('copy').onclick=async()=>{const t=Object.entries(r).map(([id,v])=>id+': jujur '+(v['Jujur']??'-')+', layak '+(v['Layak kirim']??'-')).join('\\n')||'(belum ada nilai)';try{await navigator.clipboard.writeText(t);document.getElementById('note').textContent='Tersalin.'}catch{document.getElementById('note').textContent=t}}
paint()
</script></body></html>`)
console.log('wrote report.html from', latest)
