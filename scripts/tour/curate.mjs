/* يُبقي من لقطات الجولة ما يُستشهَد به فقط كي يبقى ما يُلتزَم في Git صغيرا:
   كلُّ شاشةٍ عليها ملاحظة (حاسوب) · شاشةٌ واحدة لكلّ مسارٍ بأعلى دورٍ يراها · كلُّ لقطات
   الرحلات والأدلّة. الباقي يُنقل إلى TOUR_ARCHIVE (خارج المستودع) لا يُحذف.
   الاستعمال: TOUR_ARCHIVE=/tmp/.../tour-archive node scripts/tour/curate.mjs */
import { readFileSync, existsSync, mkdirSync, renameSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'

const DIR = process.env.TOUR_DIR ?? 'docs/audit-2026-09/tour'
const ARCHIVE = process.env.TOUR_ARCHIVE
if (!ARCHIVE) { console.error('TOUR_ARCHIVE مطلوب'); process.exit(1) }
const F = JSON.parse(readFileSync(join(DIR, 'findings.json'), 'utf8'))
const rows = F.results.filter((r) => r.viewport === 'desktop' && !r.error)
const mobile = new Map(F.results.filter((r) => r.viewport === 'mobile').map((r) => [`${r.role}|${r.path}`, r]))
const flagged = (r) => r.navError || r.failedReqs?.length || r.consoleErrs?.length || r.artifacts?.length || r.overflowX || r.deadEnd
const keep = new Set()
/* صفحاتُ «خارج الدور» (403 فقط، شاشةُ المنع الصريحة) متشابهةٌ كلُّها — يكفي مثالٌ واحد لكلّ دور */
const forbiddenOnly = (r) => r.failedReqs?.length && r.failedReqs.every((x) => /^403/.test(x)) && !r.artifacts?.length && !r.overflowX && !r.navError && !(r.consoleErrs ?? []).some((c) => !/Failed to load resource/.test(c))
const seenForbidden = new Set()
for (const r of rows) {
  if (!flagged(r)) continue
  if (forbiddenOnly(r)) { if (seenForbidden.has(r.role)) continue; seenForbidden.add(r.role) }
  keep.add(r.file)
}
const roles = [...new Set(rows.map((r) => r.role))]
for (const p of new Set(rows.map((r) => r.path))) {
  const r = roles.map((role) => rows.find((x) => x.role === role && x.path === p)).filter(Boolean).find((x) => !x.redirected) ?? rows.find((x) => x.path === p)
  if (r) keep.add(r.file)
  const m = mobile.get(`${r?.role}|${p}`); if (m?.overflowX) keep.add(m.file)
}
/* الأدلّةُ والرحلات تبقى كلُّها */
for (const d of readdirSync(DIR)) if (/^evidence-|^journeys$/.test(d)) for (const f of readdirSync(join(DIR, d))) keep.add(join(DIR, d, f))
let moved = 0, kept = 0, keptBytes = 0
for (const role of readdirSync(DIR)) {
  const sub = join(DIR, role); if (!statSync(sub).isDirectory()) continue
  for (const f of readdirSync(sub)) {
    const file = join(sub, f)
    if (keep.has(file)) { kept++; keptBytes += statSync(file).size; continue }
    const dest = join(ARCHIVE, role, f); mkdirSync(dirname(dest), { recursive: true }); renameSync(file, dest); moved++
  }
}
console.log(`✓ أُبقي ${kept} ملفّا (${(keptBytes / 1024 / 1024).toFixed(1)} MB) · نُقل ${moved} إلى ${ARCHIVE}`)
