// Builds results/rating.html: one self-contained page to rate the 9 results. Usage: node make-rating-html.mjs [model]
import { readFileSync, writeFileSync } from 'node:fs'
import { PROFILES } from './profiles.mjs'

const model = process.argv[2] ?? 'gemini-3.6-flash'
const data = JSON.parse(readFileSync(new URL('./results/combined.json', import.meta.url), 'utf8'))
const norm = (s) => s.toLowerCase().replace(/[.\s]+$/g, '').replace(/\s+/g, ' ').trim()
const sentences = (text) => text.split(/(?<=\.)\s+/).map(norm).filter(Boolean)

const cards = []
let i = 0
for (const p of PROFILES) {
  for (const j of data.jobs) {
    i++
    const pick = (mode) => data.results.find((r) => r.model === model && r.mode === mode && !r.error && r.profile === p.id && r.job === j.id)
    const one = pick('one')
    const two = pick('two')
    const swap = i % 2 === 0
    const [x, y] = swap ? [two, one] : [one, two]
    const shape = (r) => {
      if (!r) return null
      const o = r.output
      const known = new Set(p.skills.map((s) => s.toLowerCase()))
      return {
        skills: (o.skills ?? []).map((s) => ({ name: s, ok: known.has(String(s).toLowerCase()) })),
        experience: (o.experience ?? []).map((e) => {
          const src = p.experience.find((s) => s.id === e.sourceId)
          const srcSentences = new Set(src ? sentences(src.description) : [])
          return { id: e.sourceId, title: src?.title ?? '?', bullets: (e.bullets ?? []).map((b) => ({ text: b, same: srcSentences.has(norm(b)) })) }
        }),
        covered: o.coverage?.covered ?? [],
        missing: o.coverage?.missing ?? [],
        checker: [...r.violations, ...r.coverageViolations].map((v) => `${v.type}:${v.value}`),
      }
    }
    cards.push({
      n: i,
      profile: `${p.id} · ${p.label}`,
      job: `${j.id} · ${j.title}`,
      original: p.experience.map((e) => ({ title: e.title, text: e.description })),
      skills: p.skills,
      x: shape(x),
      y: shape(y),
      key: { x: swap ? '2 panggilan' : '1 panggilan', y: swap ? '1 panggilan' : '2 panggilan' },
    })
  }
}

const css = `
:root{--bg:#fafaf7;--card:#fff;--ink:#1d1d1b;--mute:#6b6b66;--line:#e3e2dc;--ok:#e3f4e6;--okink:#17602a;--warn:#fff1d6;--warnink:#8a5a00;--bad:#fde4e1;--badink:#9b1c10;--acc:#2f5fd0}
@media(prefers-color-scheme:dark){:root{--bg:#161614;--card:#1f1f1c;--ink:#ecece6;--mute:#9a9a92;--line:#34342f;--ok:#183a21;--okink:#8fdc9f;--warn:#44330f;--warnink:#f0c46b;--bad:#4a1e19;--badink:#ff9d90;--acc:#7fa0ff}}
*{box-sizing:border-box}body{margin:0 auto;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif;padding:16px;max-width:1100px}
h1{font-size:18px;margin:0 0 4px}.sub{color:var(--mute);margin:0 0 12px}
.chip{padding:2px 8px;border-radius:99px;display:inline-block}
.ok{background:var(--ok);color:var(--okink)}.warn{background:var(--warn);color:var(--warnink)}.bad{background:var(--bad);color:var(--badink)}
.nav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.nav button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:6px 10px;cursor:pointer}
.nav button.on{border-color:var(--acc);outline:2px solid var(--acc)}.nav button.done::after{content:" ✓"}
.box{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:12px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:760px){.grid{grid-template-columns:1fr}}
h2{font-size:15px;margin:0 0 6px}h3{font-size:13px;color:var(--mute);margin:10px 0 4px;text-transform:uppercase;letter-spacing:.04em}
ul{margin:0;padding-left:18px}li{margin:3px 0}.b{padding:2px 6px;border-radius:6px}
.rate{display:flex;align-items:center;gap:6px;margin:8px 0;flex-wrap:wrap}.rate b{min-width:64px}
.rate button{width:36px;height:36px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;font-size:15px}
.rate button.on{background:var(--acc);color:#fff;border-color:var(--acc)}
textarea{width:100%;min-height:54px;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px;font:inherit}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.act{border:1px solid var(--acc);background:var(--acc);color:#fff;border-radius:8px;padding:8px 14px;cursor:pointer}
.act.ghost{background:transparent;color:var(--acc)}pre{white-space:pre-wrap;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px;font-size:13px}
.how{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:12px}.how ol{margin:6px 0 0;padding-left:20px}`

const script = `
const CARDS=${JSON.stringify(cards)};
const MODEL=${JSON.stringify(model)};
let cur=0,R={};
try{R=JSON.parse(localStorage.getItem('t45-ratings')||'{}')}catch(e){}
const save=()=>{try{localStorage.setItem('t45-ratings',JSON.stringify(R))}catch(e){}};
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function version(c,v){
  const d=c[v];
  if(!d)return '<div class="box"><h2>Versi '+v.toUpperCase()+'</h2><p class="sub">Tidak ada hasil (kuota habis). Lewati.</p></div>';
  const sk=d.skills.map(s=>'<span class="chip '+(s.ok?'ok':'bad')+'">'+esc(s.name)+'</span>').join(' ')||'<i>kosong</i>';
  const ex=d.experience.map(e=>'<h3>'+esc(e.title)+'</h3><ul>'+(e.bullets.map(b=>'<li><span class="b '+(b.same?'ok':'warn')+'">'+esc(b.text)+'</span></li>').join('')||'<li><i>tanpa butir</i></li>')+'</ul>').join('')||'<p><i>Tidak ada pengalaman yang dipilih.</i></p>';
  const li=a=>a.length?'<ul>'+a.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p><i>-</i></p>';
  const rr=(R[c.n]&&R[c.n][v])||{};
  const row=(k,label)=>'<div class="rate"><b>'+label+'</b>'+[1,2,3,4,5].map(n=>'<button data-v="'+v+'" data-k="'+k+'" data-n="'+n+'" class="'+(rr[k]===n?'on':'')+'">'+n+'</button>').join('')+'</div>';
  const chk=d.checker.length?'<span class="chip bad">ditolak: '+esc(d.checker.join(', '))+'</span>':'<span class="chip ok">lolos (belum tentu jujur secara makna)</span>';
  return '<div class="box"><h2>Versi '+v.toUpperCase()+'</h2><h3>Skill</h3>'+sk+'<h3>Pengalaman</h3>'+ex+'<h3>Dianggap tertutup oleh AI</h3>'+li(d.covered)+'<h3>Belum tertutup</h3>'+li(d.missing)+'<h3>Pemeriksa mesin</h3><p>'+chk+'</p>'+row('j','Jujur')+row('s','Selaras')+'</div>';
}
function render(){
  const c=CARDS[cur];
  document.getElementById('nav').innerHTML=CARDS.map((k,i)=>{
    const r=R[k.n]||{};
    const ok=['x','y'].every(v=>!k[v]||(r[v]&&r[v].j&&r[v].s));
    return '<button class="'+(i===cur?'on ':'')+(ok?'done':'')+'" data-i="'+i+'">'+k.n+'</button>';
  }).join('');
  document.getElementById('card').innerHTML=
    '<div class="box"><h2>Kartu '+c.n+' dari 9</h2><p><b>Profil:</b> '+esc(c.profile)+'<br><b>Lowongan:</b> '+esc(c.job)+'</p><h3>Asli (satu-satunya kebenaran)</h3><p><b>Skill:</b> '+c.skills.map(esc).join(', ')+'</p>'+c.original.map(o=>'<p><b>'+esc(o.title)+':</b> '+esc(o.text)+'</p>').join('')+'</div>'+
    '<div class="grid">'+version(c,'x')+version(c,'y')+'</div>'+
    '<div class="box"><h3>Catatan (klaim palsu yang lolos mesin?)</h3><textarea id="note">'+esc((R[c.n]&&R[c.n].note)||'')+'</textarea></div>'+
    '<div class="row">'+(cur>0?'<button class="act ghost" id="prev">Sebelumnya</button>':'')+(cur<8?'<button class="act" id="next">Berikutnya</button>':'')+'</div>';
}
document.addEventListener('click',e=>{
  const t=e.target;
  if(t.dataset&&t.dataset.n){const c=CARDS[cur];R[c.n]=R[c.n]||{};R[c.n][t.dataset.v]=R[c.n][t.dataset.v]||{};R[c.n][t.dataset.v][t.dataset.k]=+t.dataset.n;save();render();}
  else if(t.dataset&&t.dataset.i){cur=+t.dataset.i;render();scrollTo(0,0);}
  else if(t.id==='next'){cur++;render();scrollTo(0,0);}
  else if(t.id==='prev'){cur--;render();scrollTo(0,0);}
  else if(t.id==='copy'){
    const L=['Hasil penilaian T45 ('+MODEL+')'];
    for(const c of CARDS){const r=R[c.n]||{};const f=v=>c[v]?(r[v]&&r[v].j&&r[v].s?'jujur '+r[v].j+', selaras '+r[v].s:'belum dinilai'):'tidak ada';
      L.push(c.n+' ('+c.profile.split(' ')[0]+'x'+c.job.split(' ')[0]+'): X '+f('x')+' | Y '+f('y')+(r.note?' | catatan: '+r.note:'')+' | kunci X='+c.key.x+', Y='+c.key.y);}
    const o=document.getElementById('out');o.hidden=false;o.textContent=L.join('\\n');
    try{navigator.clipboard.writeText(o.textContent)}catch(err){}
  }
  else if(t.id==='reveal'){const o=document.getElementById('out');o.hidden=false;o.textContent=CARDS.map(c=>c.n+': X = '+c.key.x+', Y = '+c.key.y).join('\\n');}
});
document.addEventListener('input',e=>{if(e.target.id==='note'){const c=CARDS[cur];R[c.n]=R[c.n]||{};R[c.n].note=e.target.value;save();}});
render();`

const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nilai 9 hasil T45</title><style>${css}</style></head><body>
<h1>Nilai 9 hasil: CV disesuaikan lowongan</h1>
<p class="sub">Model ${model}. Tiap kartu: AI menulis ulang CV dari profil sintetis untuk satu lowongan. Tugas Anda: apakah AI jujur dan berguna.</p>
<div class="how"><b>Cara menilai (±1 menit per kartu)</b><ol>
<li>Baca kotak <b>Asli</b>: itu satu-satunya fakta yang benar.</li>
<li>Lihat Versi X dan Y. <span class="chip ok">hijau</span> = kalimat sama persis dengan Asli (aman). <span class="chip warn">kuning</span> = kalimat diubah atau digabung: <b>baca, apakah artinya bergeser?</b> <span class="chip bad">merah</span> = skill yang tidak ada di profil.</li>
<li><b>Jujur</b>: 5 = tidak ada klaim melebihi Asli; 1 = ada yang dikarang atau dilebihkan. <b>Selaras</b>: 5 = skill dan butir yang naik memang nyambung dengan lowongan, dan "tertutup" masuk akal; 1 = tidak nyambung.</li>
<li>Selesai 9 kartu, tekan <b>Salin hasil</b> lalu tempel ke chat.</li></ol></div>
<div class="nav" id="nav"></div><div id="card"></div>
<div class="row"><button class="act" id="copy">Salin hasil</button><button class="act ghost" id="reveal">Buka kunci X/Y (setelah menilai semua)</button></div>
<pre id="out" hidden></pre>
<script>${script}</script></body></html>`

writeFileSync(new URL('./results/rating.html', import.meta.url), html)
console.log('Ditulis results/rating.html,', cards.length, 'kartu,', html.length, 'byte')
