/* يحوّل نتائجَ الجولة (findings.json + journeys.json) إلى مصفوفةِ تغطيةٍ بالعربيّة
   وقائمةِ ملاحظاتٍ — ويُنتج صفحةَ معرضٍ HTML بالصور المختارة مضمَّنةً (لصفحةٍ تُنشر).

   الاستعمال:
     node scripts/tour/report.mjs                 → docs/audit-2026-09/tour/COVERAGE-AR.md
     GALLERY_OUT=/tmp/gallery.html node scripts/tour/report.mjs */

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'

const DIR = process.env.TOUR_DIR ?? 'docs/audit-2026-09/tour'
const F = JSON.parse(readFileSync(join(DIR, 'findings.json'), 'utf8'))
const J = existsSync(join(DIR, 'journeys', 'journeys.json')) ? JSON.parse(readFileSync(join(DIR, 'journeys', 'journeys.json'), 'utf8')) : null

const ROLE_AR = { visitor: 'زائر', student: 'طالب', trainer: 'مدرّب', advisor: 'مستشار', academic: 'مدير أكاديميّ', operations: 'عمليات', diagnostics: 'تشخيص', finance: 'مالية', support: 'دعم', superadmin: 'مدير النظام' }
const rows = F.results.filter((r) => r.viewport === 'desktop' && !r.error)
const mobile = new Map(F.results.filter((r) => r.viewport === 'mobile').map((r) => [`${r.role}|${r.path}`, r]))

function verdict(r) {
  const m = mobile.get(`${r.role}|${r.path}`)
  if (r.navError) return '❌'
  if (r.redirected && /\/auth/.test(r.finalUrl)) return '🔒'
  if (r.redirected) return '↪️'
  if (r.deadEnd) return '⛔'
  if (r.failedReqs?.length || r.consoleErrs?.length || r.artifacts?.length || r.overflowX || m?.overflowX) return '⚠️'
  if (r.thin) return '⬜'
  return '✅'
}

const roles = [...new Set(rows.map((r) => r.role))]
const paths = [...new Set(rows.map((r) => r.path))]
const byKey = new Map(rows.map((r) => [`${r.role}|${r.path}`, r]))

let md = `# مصفوفةُ التغطية — جولةُ الأدوار بالمتصفّح\n\n`
md += `> أُنتجت آليّا من \`findings.json\` في ${F.generatedAt.slice(0, 16).replace('T', ' ')} · ${F.results.length} لقطة · ${Math.round(F.durationMs / 1000)} ثانية.\n>\n`
md += `> ✅ تعمل وفيها محتوى · ⚠️ تعمل وعليها ملاحظة (خطأ كونسول، نداءٌ فاشل، نصٌّ مسرَّب، انسيابٌ أفقيّ) · ⬜ تعمل لكنّها شبهُ فارغة · ⛔ مسدودة («لا صلاحيات») · 🔒 تحوّل إلى الدخول · ↪️ تحوّل إلى صفحةٍ أخرى · ❌ لم تُحمَّل · — لم تُفتح بهذا الدور\n\n`
md += `| الشاشة | ${roles.map((r) => ROLE_AR[r] ?? r).join(' | ')} |\n|---|${roles.map(() => '---').join('|')}|\n`
for (const p of paths) {
  md += `| \`${p}\` | ${roles.map((role) => { const r = byKey.get(`${role}|${p}`); return r ? verdict(r) : '—' }).join(' | ')} |\n`
}

const flagged = rows.filter((r) => verdict(r) === '⚠️' || verdict(r) === '❌')
md += `\n## الملاحظات (${flagged.length} شاشة)\n\n`
for (const r of flagged) {
  const m = mobile.get(`${r.role}|${r.path}`)
  md += `### ${ROLE_AR[r.role]} · \`${r.path}\`${r.h1 ? ` — «${r.h1}»` : ''}\n`
  if (r.navError) md += `- لم تُحمَّل: ${r.navError}\n`
  r.failedReqs?.forEach((x) => (md += `- نداءٌ فاشل: \`${x}\`\n`))
  r.consoleErrs?.slice(0, 3).forEach((x) => (md += `- كونسول: ${x}\n`))
  r.artifacts?.forEach((x) => (md += `- نصٌّ مسرَّب — ${x}\n`))
  if (r.overflowX) md += `- انسيابٌ أفقيّ على الحاسوب\n`
  if (m?.overflowX) md += `- انسيابٌ أفقيّ على الهاتف\n`
  md += `- الصورة: \`${basename(r.file)}\`${m ? ` · الهاتف: \`${basename(m.file)}\`` : ''}\n\n`
}

const thin = rows.filter((r) => verdict(r) === '⬜' || verdict(r) === '⛔')
md += `\n## شاشاتٌ فارغة أو مسدودة (${thin.length})\n\n| الدور | الشاشة | العنوان | النصّ (حرف) | ملاحظة |\n|---|---|---|---|---|\n`
for (const r of thin) md += `| ${ROLE_AR[r.role]} | \`${r.path}\` | ${r.h1 || '—'} | ${r.textLen} | ${r.deadEnd ? '«لا صلاحيات مفعّلة»' : 'محتوى قليل'} |\n`

const slow = rows.filter((r) => r.loadMs > 4000).sort((a, b) => b.loadMs - a.loadMs).slice(0, 10)
if (slow.length) { md += `\n## الأبطأ تحميلا (> ٤ ثوانٍ حتّى ظهور المحتوى)\n\n| الدور | الشاشة | ms |\n|---|---|---|\n`; for (const r of slow) md += `| ${ROLE_AR[r.role]} | \`${r.path}\` | ${r.loadMs} |\n` }

if (J) {
  md += `\n## الرحلاتُ التفاعليّة العشر\n\n`
  for (const j of J.journeys) {
    md += `### ${j.id} · ${j.titleAr} — ${j.clicks} ضغطة\n\n| الخطوة | النتيجة | ما شُوهد |\n|---|---|---|\n`
    for (const s of j.steps) md += `| ${s.name} | ${s.ok ? '✓' : '✗'} | ${(s.note || '').replace(/\|/g, '،').slice(0, 220)}${s.api?.length ? `<br><small>${s.api.slice(0, 3).join(' · ')}</small>` : ''} |\n`
    md += '\n'
  }
}
writeFileSync(join(DIR, 'COVERAGE-AR.md'), md)
console.log(`✓ ${join(DIR, 'COVERAGE-AR.md')} — ${rows.length} شاشة × حاسوب · ${flagged.length} ملاحظة · ${thin.length} فارغة/مسدودة`)

/* معرضٌ مضمَّن الصور — يُختار: كلُّ شاشةٍ عليها ملاحظة + شاشةٌ لكلّ مسارٍ بأعلى دورٍ يراه + خطواتُ الرحلات */
if (process.env.GALLERY_OUT) {
  const pick = new Map()
  for (const r of flagged) pick.set(r.file, { cap: `${ROLE_AR[r.role]} · ${r.path} — ملاحظة`, r })
  for (const p of paths) { const r = roles.map((role) => byKey.get(`${role}|${p}`)).filter(Boolean).find((x) => verdict(x) === '✅' || verdict(x) === '⬜'); if (r && !pick.has(r.file)) pick.set(r.file, { cap: `${ROLE_AR[r.role]} · ${p}${r.h1 ? ' — «' + r.h1 + '»' : ''}`, r }) }
  const jshots = J ? J.journeys.flatMap((j) => j.steps.filter((s) => s.shot && existsSync(s.shot)).map((s) => ({ file: s.shot, cap: `${j.id} · ${s.name} — ${s.ok ? '✓' : '✗'} ${(s.note || '').slice(0, 140)}` }))) : []
  const screens = [...pick.entries()].map(([file, v]) => ({ file, cap: v.cap })).filter((x) => existsSync(x.file))
  const items = [...screens, ...jshots.filter((x) => existsSync(x.file))]
  let total = 0
  const card = (x) => { const b = readFileSync(x.file); total += b.length; return `<figure><img loading="lazy" src="data:image/jpeg;base64,${b.toString('base64')}" alt=""><figcaption>${x.cap.replace(/</g, '&lt;')}</figcaption></figure>` }
  const cards = screens.map(card).join('\n') + '<!--J-->' + jshots.filter((x) => existsSync(x.file)).map(card).join('\n')
  const html = `<title>معرض جولة وجيز</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;700&family=Tajawal:wght@700;800&display=swap">
<style>:root{--bg:#FBFBF9;--ink:#17202A;--muted:#5B6572;--line:#E1E5E9}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#0F1418;--ink:#E8ECEF;--muted:#9AA5B1;--line:#26303A}}:root[data-theme="dark"]{--bg:#0F1418;--ink:#E8ECEF;--muted:#9AA5B1;--line:#26303A}
html{direction:rtl}body{margin:0;background:var(--bg);color:var(--ink);font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;font-size:16px;line-height:1.8}main{max-width:1200px;margin:0 auto;padding:32px 20px 64px}h1{font-family:"Tajawal","IBM Plex Sans Arabic",sans-serif;font-size:30px;margin:0 0 6px;text-wrap:balance}p.lede{color:var(--muted);margin:0 0 10px;max-width:70ch}p.legend{color:var(--muted);font-size:13px;margin:0 0 24px}h2{font-family:"Tajawal","IBM Plex Sans Arabic",sans-serif;font-size:20px;margin:36px 0 12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:18px}figure{margin:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--bg)}img{display:block;width:100%;height:auto}figcaption{padding:10px 12px;font-size:13px;color:var(--muted);border-top:1px solid var(--line)}</style>
<main><h1>معرض جولة الأدوار — أكاديمية وجيز</h1><p class="lede">${items.length} لقطة من ${F.results.length}: كلُّ شاشةٍ عليها ملاحظة، وشاشةٌ لكلّ مسارٍ بأعلى دورٍ يراه، ثمّ خطواتُ الرحلات العشر بالترتيب. بيئةٌ محلّيّة كاملة يوم ${F.generatedAt.slice(0, 10)} — لا شيءَ منها من الإنتاج.</p><p class="legend">في تعليق كلّ صورة: الدور · المسار · ما شُوهد. «ملاحظة» تعني نداءً فاشلا أو نصّا مسرَّبا أو شاشةَ منع. الرحلات: ✓ الخطوةُ تمّت، ✗ تعذّرت — والنصُّ بعدها هو ما قالته الشاشة.</p><h2>الشاشات</h2><div class="grid">${cards.split('<!--J-->')[0]}</div>${cards.includes('<!--J-->') ? `<h2>الرحلات العشر</h2><div class="grid">${cards.split('<!--J-->')[1]}</div>` : ''}</main>`
  writeFileSync(process.env.GALLERY_OUT, html)
  console.log(`✓ ${process.env.GALLERY_OUT} — ${items.length} صورة · ${(total / 1024 / 1024).toFixed(1)} MB مضمَّنة · ${(statSync(process.env.GALLERY_OUT).size / 1024 / 1024).toFixed(1)} MB`)
}
