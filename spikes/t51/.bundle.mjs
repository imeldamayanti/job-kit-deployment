// src/core/ai/errors.ts
var AiError = class extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
  reason;
};
var MESSAGES = {
  "invalid-key": "Kunci ditolak penyedia.",
  quota: "Kuota atau saldo di penyedia habis.",
  network: "Tidak bisa menghubungi penyedia. Periksa koneksi internet.",
  server: "Penyedia sedang bermasalah. Coba lagi nanti.",
  "bad-request": "Penyedia menolak permintaan. Periksa nama model.",
  "no-permission": "Izin untuk penyedia AI belum diberikan.",
  "invalid-output": "Jawaban penyedia tidak bisa dibaca.",
  "no-key": "Kunci API belum diisi."
};
var aiErrorMessage = (reason) => MESSAGES[reason];

// src/core/tailor/hash.ts
function profileHash(profile) {
  const { firstName, middleName, lastName } = profile.personal;
  const { email, phone, city, linkedin, website } = profile.contact;
  const seen = JSON.stringify({
    name: [firstName, middleName, lastName],
    contact: [email, phone, city, linkedin, website],
    skills: profile.skills.map((s) => s.name),
    experience: profile.experience.map((e) => [e.id, e.company, e.title, e.start, e.end, e.current, e.description]),
    education: profile.education.map((e) => [e.id, e.institution, e.level, e.major, e.gpa, e.year])
  });
  let hash = 2166136261;
  for (const char of seen) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// src/core/tailor/grounded.ts
var LEXICON = new Set(
  "kubernetes docker aws gcp azure kotlin swift java python typescript javascript react vue angular svelte node nodejs sql postgres postgresql mysql mongodb redis graphql terraform jenkins tableau powerbi excel pandas spark hadoop tensorflow pytorch linux git github jira figma agile scrum android ios flutter django flask laravel spring golang rust php ruby rails kafka rabbitmq elasticsearch nginx ansible helm prometheus grafana datadog sentry firebase supabase oauth jest cypress playwright selenium webpack vite nextjs redux tailwind sass bigquery snowflake airflow dbt looker numpy scikitlearn sklearn cisco vmware citrix okta intune sccm powershell bash vpn dns dhcp activedirectory".split(/\s+/)
);
var NOT_TECHNICAL = /* @__PURE__ */ new Set(["i", "a", "cv", "ui", "ux", "id", "it", "ok"]);
var escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function canonicalNumber(raw) {
  let text = raw;
  const hasDot = text.includes(".");
  const hasComma = text.includes(",");
  if (hasDot && hasComma) {
    const decimalAt = Math.max(text.lastIndexOf("."), text.lastIndexOf(","));
    text = `${text.slice(0, decimalAt).replace(/[.,]/g, "")}.${text.slice(decimalAt + 1)}`;
  } else if (/^[1-9]\d{0,2}([.,]\d{3})+$/.test(text)) {
    text = text.replace(/[.,]/g, "");
  } else {
    text = text.replace(",", ".");
  }
  return /^\d{1,15}(\.\d+)?$/.test(text) ? String(Number(text)) : text;
}
var numbersIn = (text) => [...text.matchAll(/\d+(?:[.,]\d+)*/g)].map((m) => canonicalNumber(m[0]));
var wordsIn = (text) => [...text.matchAll(/[A-Za-z][A-Za-z0-9.+#/-]*[A-Za-z0-9+#]|[A-Za-z]/g)].map((m) => m[0]);
var keyOf = (word) => word.toLowerCase().replace(/[.\-/]/g, "");
function isTechnical(word) {
  const key = keyOf(word);
  if (NOT_TECHNICAL.has(key)) return false;
  return LEXICON.has(key) || /[a-z][A-Z]/.test(word) || /^[A-Z]{2,}$/.test(word) || /[A-Za-z]\.[A-Za-z]/.test(word) || /[A-Za-z]\d|\d[A-Za-z]/.test(word) || /[+#]$/.test(word);
}
function ownNames(profile) {
  const names = [
    ...profile.skills.map((s) => s.name),
    ...profile.experience.flatMap((e) => [e.company, e.title]),
    ...profile.education.flatMap((e) => [e.institution, e.level, e.major])
  ];
  return [...new Set(names.map((n) => n.trim()).filter((n) => n !== ""))].sort((a, b) => b.length - a.length);
}
function withoutNames(text, names) {
  let out = text;
  for (const name of names) out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, "giu"), " ");
  return out;
}
function checkText(text, sourceText, profile, where) {
  const violations = [];
  const claim = withoutNames(text, ownNames(profile));
  const allowedNumbers = new Set(numbersIn(sourceText));
  for (const number of new Set(numbersIn(claim))) if (!allowedNumbers.has(number)) violations.push({ type: "number", value: number, where });
  const allowedWords = new Set(wordsIn(`${sourceText} ${profile.skills.map((s) => s.name).join(" ")}`).map(keyOf));
  const reported = /* @__PURE__ */ new Set();
  for (const word of wordsIn(claim)) {
    const key = keyOf(word);
    if (reported.has(key) || !isTechnical(word) || allowedWords.has(key)) continue;
    reported.add(key);
    violations.push({ type: "term", value: word.toLowerCase().replace(/\.$/, ""), where });
  }
  return violations;
}
function violationMessage(violation) {
  switch (violation.type) {
    case "skill":
      return `Skill "${violation.value}" tidak ada di Profile.`;
    case "source":
      return `Pengalaman atau pendidikan "${violation.value}" tidak ada di Profile atau ganda.`;
    case "number":
      return `Angka "${violation.value}" tidak ada di pengalaman asalnya.`;
    case "term":
      return `Istilah "${violation.value}" tidak ada di pengalaman asalnya maupun daftar skill.`;
  }
}

// src/core/tailor/coverage.ts
var COMMON = new Set(
  "yang dengan untuk dalam pada dari atau serta dapat dalam memiliki mampu minimal pengalaman kemampuan bekerja with and for the that this have has experience ability years year work working strong good knowledge understanding skills skill using used build building plus including related relevant least within across ensure".split(/\s+/)
);

// src/core/tailor/parse.ts
function readJson(text) {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end <= start) return void 0;
    try {
      return JSON.parse(clean.slice(start, end + 1));
    } catch {
      return void 0;
    }
  }
}

// src/core/profile/job-preferences.ts
function createEmptyJobPreferences() {
  return { roles: [], level: "", locations: [], workModes: [], mustHave: [], avoid: [], minSalary: "" };
}

// src/core/tailor/privacy.ts
var escapeRegExp2 = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var bounded = (name) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp2(name)}(?![\\p{L}\\p{N}])`, "giu");
var COMPANY_PREFIX = /^(?:pt|cv|ud|pd)\.?\s+/i;
var COMPANY_SUFFIX = /\s+(?:ltd|inc|llc|tbk|co|corp|gmbh|pte)\.?$/i;
var SCHOOL_PREFIX = /^(?:universitas|institut|politeknik|sekolah tinggi|university|institute|polytechnic)\s+/i;
function variants(name, prefix, suffix) {
  const forms = /* @__PURE__ */ new Set([name]);
  const bare = name.replace(prefix, "");
  const trimmed = suffix ? bare.replace(suffix, "") : bare;
  for (const form of [bare, trimmed]) if (form.length >= 4) forms.add(form);
  return [...forms];
}
function identityValues(profile) {
  const { personal, contact } = profile;
  const names = [personal.firstName, personal.middleName, personal.lastName].map((n) => n.trim()).filter((n) => n !== "");
  const full = [names.join(" "), [personal.firstName, personal.lastName].map((n) => n.trim()).filter((n) => n !== "").join(" ")];
  const parts = names.filter((n) => n.length >= 5);
  const others = [contact.email, contact.phone, contact.linkedin, contact.website, contact.street, personal.birthDate];
  return [...new Set([...full, ...parts, ...others].map((v) => v.trim()).filter((v) => v.length >= 3))].sort((a, b) => b.length - a.length);
}
var REDACTED = "[dihapus]";
function pseudonymize(profile) {
  const codes = /* @__PURE__ */ new Map();
  const byName = /* @__PURE__ */ new Map();
  const swaps = [];
  const counters = { C: 0, S: 0 };
  const codeFor = (name, kind) => {
    const known = byName.get(name);
    if (known) return known;
    const code = `{${kind}${++counters[kind]}}`;
    byName.set(name, code);
    codes.set(code, name);
    const forms = kind === "C" ? variants(name, COMPANY_PREFIX, COMPANY_SUFFIX) : variants(name, SCHOOL_PREFIX);
    for (const form of forms) swaps.push([form, code]);
    return code;
  };
  const company = (name) => name.trim() === "" ? "" : codeFor(name.trim(), "C");
  const institution = (name) => name.trim() === "" ? "" : codeFor(name.trim(), "S");
  const companies = profile.experience.map((e) => company(e.company));
  const schools = profile.education.map((e) => institution(e.institution));
  const identity = identityValues(profile);
  swaps.sort((a, b) => b[0].length - a[0].length);
  const clean = (text) => {
    let out = text;
    for (const value of identity) out = out.replace(new RegExp(escapeRegExp2(value), "gi"), REDACTED);
    for (const [form, code] of swaps) out = out.replace(bounded(form), code);
    return out;
  };
  const payload = {
    skills: [...new Set(profile.skills.map((s) => s.name.trim()).filter((n) => n !== ""))],
    experience: profile.experience.map((e, i) => ({ id: e.id, title: clean(e.title), company: companies[i] ?? "", description: clean(e.description) })),
    education: profile.education.map((e, i) => ({ id: e.id, institution: schools[i] ?? "", level: clean(e.level), major: clean(e.major) }))
  };
  const restore = (text) => text.replace(/\{\s*([CS])\s*(\d+)\s*\}/gi, (match, kind, n) => codes.get(`{${kind.toUpperCase()}${n}}`) ?? match);
  const restoreOutput = (output) => ({
    skills: [...output.skills],
    experience: output.experience.map((item) => ({ sourceId: item.sourceId, bullets: item.bullets.map(restore) })),
    education: [...output.education]
  });
  return { payload, restore, restoreOutput };
}

// src/core/feed/text.ts
function truncateText(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}\u2026`;
}

// src/core/tailor/prompt.ts
var SHAPE = `{
  "requirements": ["requirement lowongan, maksimal 8"],
  "covered": ["requirement dari daftar di atas yang didukung profil, disalin persis"],
  "skills": ["skill dari daftar skill profil, diurutkan dari yang paling relevan"],
  "experience": [{ "sourceId": "id pengalaman", "bullets": ["butir hasil penyesuaian"] }],
  "education": ["id pendidikan yang relevan"]
}`;
var CV_SYSTEM = `Kamu menyesuaikan CV dengan lowongan. Dari teks lowongan, ambil requirement-nya, lalu pilih dan rapikan isi profil agar selaras.
Aturan keras:
- Hanya gunakan fakta yang ada di profil. Jangan menambah skill, alat, angka, persen, atau pencapaian yang tidak tertulis di deskripsi pengalaman.
- "skills" hanya boleh berisi nama dari daftar skill profil.
- Tiap butir ditulis ulang dari deskripsi pengalaman asalnya, maksimal 3 butir per pengalaman, dalam bahasa yang sama dengan deskripsi asalnya. Urutkan pengalaman dan butir dari yang paling relevan dengan lowongan.
- Jangan menulis jabatan, nama perusahaan, institusi, atau tanggal. Kode seperti {C1} atau {S1} boleh muncul apa adanya.
- Requirement yang tidak didukung profil tetap ditulis di "requirements"; jangan ditambal dengan butir karangan.
- Balas hanya JSON, tanpa teks lain, tanpa code fence.
Bentuk JSON:
${SHAPE}`;

// src/core/tailor/pipeline.ts
var NO_TOKENS = { inputTokens: 0, outputTokens: 0 };
var MAX_SHOWN = 3;
function ungroundedMessage(violations) {
  const shown = violations.slice(0, MAX_SHOWN).map(violationMessage).join(" ");
  const more = violations.length > MAX_SHOWN ? ` Dan ${violations.length - MAX_SHOWN} lainnya.` : "";
  return `Hasil AI ditolak karena memuat hal yang tidak ada di Profile-mu. ${shown}${more}`;
}

// src/core/letters/closing.ts
var CLOSING = {
  id: { formal: "Hormat saya,", casual: "Salam hangat," },
  en: { formal: "Sincerely,", casual: "Best regards," }
};
var SIGN_OFF = /^(?:hormat saya|hormat kami|salam hangat|salam|salam hormat|best regards|kind regards|warm regards|regards|sincerely|yours sincerely|yours faithfully|terima kasih|thanks|thank you),?$/i;
var PLACEHOLDER = /^[{[(<]\s*[^}\])>]*(?:nama|name)[^}\])>]*[}\])>]$/i;
var fullName = (profile) => [profile.personal.firstName, profile.personal.middleName, profile.personal.lastName].map((part) => part.trim()).filter((part) => part !== "").join(" ");
function withoutSignOff(body) {
  const lines = body.trim().split("\n");
  const filled = lines.map((line, index) => ({ line: line.trim(), index })).filter((row) => row.line !== "");
  const tail = filled.slice(-3);
  const start = tail.find((row) => SIGN_OFF.test(row.line));
  if (start) return lines.slice(0, start.index).join("\n").trimEnd();
  const last = tail.at(-1);
  if (last && PLACEHOLDER.test(last.line)) return lines.slice(0, last.index).join("\n").trimEnd();
  return lines.join("\n").trimEnd();
}
function finishLetter(body, profile, lang, tone) {
  const name = fullName(profile);
  return `${withoutSignOff(body)}

${CLOSING[lang][tone]}${name === "" ? "" : `
${name}`}`;
}

// src/core/letters/grounded.ts
function validateLetter(body, profile, job) {
  const source = [
    ...profile.experience.flatMap((e) => [e.description, e.start, e.end]),
    ...profile.education.flatMap((e) => [e.year, e.major, e.level]),
    job.title,
    job.company
  ].join("\n");
  const violations = checkText(body, source, profile, "surat");
  return { ok: violations.length === 0, violations };
}

// src/core/tailor/language.ts
var ID = new Set(
  "yang dan dengan untuk di ke dari pada adalah ini itu dalam akan atau kami kamu saya tidak juga sebagai oleh serta agar bisa dapat lebih membangun menulis membantu memiliki mencari bekerja tim pengalaman tahun sama bagi para sebuah setiap telah sudah masih sedang".split(/\s+/)
);
var EN = new Set(
  "the and with for of to in is are we you our will be as on at by or an that this from have has was were their your it its into per built wrote helped looking experience team years work working using".split(/\s+/)
);
function detectLanguage(text) {
  let id = 0;
  let en = 0;
  for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    if (ID.has(word)) id += 1;
    if (EN.has(word)) en += 1;
  }
  return en > id ? "en" : "id";
}

// src/core/letters/language.ts
function postingLanguage(job) {
  return detectLanguage(job.description.trim() !== "" ? job.description : job.title);
}

// src/core/letters/parse.ts
var MIN_WORDS = 30;
var MAX_WORDS = 450;
var words = (text) => text.trim().split(/\s+/).filter((w) => w !== "").length;
function parseLetter(text) {
  const data = readJson(text);
  if (typeof data !== "object" || data === null || Array.isArray(data)) return { ok: false, reason: "Jawaban penyedia bukan JSON." };
  const letter = data.letter;
  if (typeof letter !== "string") return { ok: false, reason: "Jawaban penyedia tidak berbentuk surat: letter." };
  const body = letter.trim();
  if (body === "") return { ok: false, reason: "Surat dari penyedia kosong." };
  const count = words(body);
  if (count < MIN_WORDS) return { ok: false, reason: `Surat dari penyedia terlalu pendek (${count} kata).` };
  if (count > MAX_WORDS) return { ok: false, reason: `Surat dari penyedia terlalu panjang (${count} kata).` };
  return { ok: true, body };
}

// src/core/letters/prompt.ts
var LANGUAGE = { id: "bahasa Indonesia", en: "English" };
var TONE = {
  formal: "formal: sopan, lugas, tanpa singkatan gaul",
  casual: "santai: hangat dan natural, tetap sopan, tanpa bahasa gaul"
};
function letterSystem(lang, tone) {
  return `Kamu menulis surat lamaran kerja dalam ${LANGUAGE[lang]}, nada ${TONE[tone]}. Dasarnya hanya profil dan lowongan di bawah.
Aturan keras:
- Hanya gunakan fakta yang ada di profil. Jangan menambah skill, alat, angka, persen, tahun, atau pencapaian yang tidak tertulis di deskripsi pengalaman.
- Jangan menyebut alat atau teknologi dari lowongan yang tidak ada di profil, bahkan untuk mengaku belum memakainya. Bicarakan yang memang dimiliki.
- Panjang 120 sampai 250 kata, tiga sampai empat paragraf: pembuka dan posisi yang dilamar, dua pengalaman yang paling relevan dengan lowongan, lalu ajakan berdiskusi.
- Jangan menulis nama pelamar, kontak, tanggal, atau alamat. Mulai dengan salam kepada tim rekrutmen perusahaan. Kode seperti {C1} atau {S1} boleh muncul apa adanya.
- Jangan menulis penutup atau tanda tangan (misalnya "Hormat saya" atau nama): itu ditambahkan terpisah.
- Balas hanya JSON, tanpa teks lain, tanpa code fence.
Bentuk JSON:
{ "letter": "isi surat, paragraf dipisah baris kosong" }`;
}
var MAX_POSTING_CHARS = 4e3;
function letterUserPrompt(job, payload) {
  return `LOWONGAN
Judul: ${job.title}
Perusahaan: ${job.company}
${truncateText(job.description, MAX_POSTING_CHARS)}

PROFIL
${JSON.stringify(payload, null, 1)}`;
}

// src/core/letters/pipeline.ts
async function writeLetter({ profile, application, lang, tone = "formal", client, key, model, now, newId, maxTokens = 2e3 }) {
  const job = application.job;
  if (job.description.trim() === "") return { ok: false, reason: "no-text", message: "Tempel teks lowongan dulu.", usage: NO_TOKENS };
  const language = lang ?? postingLanguage(job);
  const hidden = pseudonymize(profile);
  let reply;
  try {
    reply = await client.complete({
      key,
      model,
      system: letterSystem(language, tone),
      user: letterUserPrompt(job, hidden.payload),
      maxTokens
    });
  } catch (error) {
    const ai = error instanceof AiError ? error.reason : "network";
    return { ok: false, reason: "ai", ai, message: aiErrorMessage(ai), usage: NO_TOKENS };
  }
  const usage = reply.usage;
  const parsed = parseLetter(reply.text);
  if (!parsed.ok) return { ok: false, reason: "unreadable", message: parsed.reason, usage };
  const restored = withoutSignOff(hidden.restore(parsed.body));
  const grounding = validateLetter(restored, profile, job);
  if (!grounding.ok) return { ok: false, reason: "ungrounded", message: ungroundedMessage(grounding.violations), usage, violations: grounding.violations };
  const body = finishLetter(restored, profile, language, tone);
  return {
    ok: true,
    usage,
    letter: { id: newId(), applicationId: application.id, createdAt: now.toISOString(), profileHash: profileHash(profile), lang: language, tone, body, aiBody: body, edited: false }
  };
}

// src/core/profile/types.ts
var PERSONAL_KEYS = [
  "firstName",
  "middleName",
  "lastName",
  "birthDate",
  "gender",
  "nationality"
];
var CONTACT_KEYS = [
  "email",
  "phone",
  "linkedin",
  "website",
  "street",
  "city",
  "province",
  "postalCode",
  "country"
];

// src/core/profile/profile.ts
function emptyRecord(keys) {
  return Object.fromEntries(keys.map((key) => [key, ""]));
}
function createEmptyProfile() {
  return {
    version: 2,
    personal: emptyRecord(PERSONAL_KEYS),
    contact: emptyRecord(CONTACT_KEYS),
    education: [],
    experience: [],
    skills: [],
    custom: [],
    jobPrefs: createEmptyJobPreferences()
  };
}

// src/core/tailor/sample-profiles.ts
function build({ first, last, skills, education, experience }) {
  const profile = createEmptyProfile();
  profile.personal.firstName = first;
  profile.personal.lastName = last;
  profile.contact.email = `${first.toLowerCase()}@example.test`;
  profile.contact.phone = "081200000000";
  profile.contact.city = "Denpasar";
  profile.skills = skills.map((name) => ({ group: "teknis", name }));
  profile.education = education;
  profile.experience = experience;
  return profile;
}
var SAMPLE_WEB_DEV = build({
  first: "Sari",
  last: "Contohwati",
  skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "Git", "REST API", "Jest"],
  education: [{ id: "edu-a1", institution: "Universitas Contoh Nusantara", level: "S1", major: "Teknik Informatika", gpa: "3.5", year: "2022" }],
  experience: [
    {
      id: "exp-a1",
      company: "PT Contoh Teknologi",
      title: "Software Engineer",
      start: "2023-08",
      end: "",
      current: true,
      description: "Membangun fitur dashboard pelanggan dengan React dan TypeScript. Menulis REST API dengan Node.js dan PostgreSQL. Menulis tes unit dengan Jest sehingga cakupan tes naik dari 40% ke 70%. Ikut code review dua kali seminggu."
    },
    {
      id: "exp-a2",
      company: "CV Contoh Digital",
      title: "Staf Magang Pengembangan Web",
      start: "2022-01",
      end: "2022-06",
      current: false,
      description: "Memperbaiki bug tampilan di situs perusahaan. Membantu memindahkan halaman statis ke React."
    }
  ]
});
var SAMPLE_DATA_ANALYST = build({
  first: "Dewi",
  last: "Sampleton",
  skills: ["Python", "SQL", "Excel", "Tableau", "pandas", "Statistics", "English"],
  education: [{ id: "edu-b1", institution: "Sample State University", level: "Bachelor", major: "Statistics", gpa: "3.7", year: "2019" }],
  experience: [
    {
      id: "exp-b1",
      company: "Sample Analytics Ltd",
      title: "Data Analyst",
      start: "2021-03",
      end: "",
      current: true,
      description: "Built weekly sales dashboards in Tableau for the regional team. Wrote SQL queries and pandas scripts to clean order data from three sources. Reduced the weekly reporting time from 6 hours to 2 hours by automating the Excel export."
    },
    {
      id: "exp-b2",
      company: "Contoh Retail Group",
      title: "Junior Analyst",
      start: "2019-07",
      end: "2021-02",
      current: false,
      description: "Prepared monthly stock reports in Excel. Presented findings to the store managers of Contoh Retail Group."
    }
  ]
});
var SAMPLE_IT_SUPPORT = build({
  first: "Made",
  last: "Contohan",
  skills: ["Microsoft 365", "Windows", "Jaringan dasar", "Ticketing", "Komunikasi", "Bahasa Inggris"],
  education: [{ id: "edu-c1", institution: "Politeknik Contoh Mandiri", level: "D3", major: "Teknik Komputer", gpa: "3.4", year: "2023" }],
  experience: [
    {
      id: "exp-c1",
      company: "PT Contoh Layanan Prima",
      title: "IT Support",
      start: "2024-02",
      end: "",
      current: true,
      description: "Menangani tiket keluhan pengguna lewat sistem ticketing, rata-rata 15 tiket per hari. Memasang ulang Windows dan mengatur akun Microsoft 365 untuk karyawan baru. Memeriksa kabel dan switch saat jaringan kantor bermasalah."
    }
  ]
});
var SAMPLE_PROFILES = [SAMPLE_WEB_DEV, SAMPLE_DATA_ANALYST, SAMPLE_IT_SUPPORT];
export {
  SAMPLE_PROFILES,
  letterSystem,
  validateLetter,
  writeLetter
};
