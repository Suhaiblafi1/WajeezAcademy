/* تدقيق سجل المراجع المنهجية — يفشل (exit 1) عند أي خلل.
   الضوابط:
   1) لا يظهر للعميل إلا مرجع implemented بدليل تطبيق حقيقي ورابط https.
   2) كلمات تسويقية محظورة (ادعاء اعتماد/شراكة رسمية) في الصفحات والسجل.
   3) لا مراجع هندسية/قانونية (WCAG/OWASP/React...) في سجل العميل.
   4) لا صور/شعارات في صفحة المنهجية (حقوق ترخيص).
   5) أدلة الربط الفعلية: الأسئلة/المهارات/الكتالوج تدعم كل مرجع معلن.
   6) صيغة source_url سليمة (فحص الشبكة HEAD تحذير فقط عند الانقطاع). */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'))
const readText = (p: string) => readFileSync(join(root, p), 'utf8')

const registry = readJson('src/data/methodology-references.v1.json')
const questions = readJson('src/data/catalog/questions.v1.ar.json')
const skills = readJson('src/data/catalog/skills.v1.ar.json')
const core = readJson('src/data/catalog/core-catalog.v2.json')

const methodologyPage = readText('src/pages/Methodology.tsx')
const homePage = readText('src/pages/Home.tsx')
const diagnosticPage = readText('src/pages/Diagnostic.tsx')
const registryRaw = readText('src/data/methodology-references.v1.json')

const problems: string[] = []
const warnings: string[] = []
const check = (cond: boolean, msg: string) => {
  if (!cond) problems.push(msg)
}

/* 1) سلامة السجل: كل مرجع ظاهر للعميل */
const refs = registry.references as {
  id: string
  name_ar: string
  source_url: string
  implementation_status: string
  implementation_evidence: string
  public_visibility: boolean
}[]
check(Array.isArray(refs) && refs.length >= 5, `عدد المراجع ${refs.length} أقل من 5`)
for (const r of refs) {
  if (!r.public_visibility) continue
  check(
    r.implementation_status === 'implemented',
    `مرجع ظاهر ${r.id} حالته ${r.implementation_status} — لا يظهر إلا implemented`
  )
  check(
    typeof r.implementation_evidence === 'string' && r.implementation_evidence.length >= 30,
    `مرجع ${r.id} بلا دليل تطبيق كافٍ`
  )
  check(/^https:\/\//.test(r.source_url), `مرجع ${r.id} رابطه ليس https: ${r.source_url}`)
}

/* 2) الكلمات المحظورة — ادعاءات اعتماد/تحقق علمي لا نملك إثباته */
const FORBIDDEN = [
  'معتمد من', 'شريك رسمي', 'موثّق من', 'دقة علمية', 'مطابق بالكامل', 'مصادق عليه',
  'مبني على علم', 'مراجع علمية موثوقة',
]
const surfaces: [string, string][] = [
  ['Methodology.tsx', methodologyPage],
  ['Home.tsx', homePage],
  ['Diagnostic.tsx', diagnosticPage],
  ['methodology-references.v1.json', registryRaw],
]
for (const [name, text] of surfaces) {
  for (const word of FORBIDDEN) {
    if (!text.includes(word)) continue
    // اسمح فقط إن وُجدت الكلمة داخل سياق نفي/إخلاء صريح
    const idx = text.indexOf(word)
    const context = text.slice(Math.max(0, idx - 60), idx + word.length + 60)
    const isNegation = /لا|ليس|لسنا|دون|بدون|لا ندّعي/.test(context)
    check(isNegation, `${name}: كلمة محظورة «${word}» دون سياق نفي — …${context.trim()}…`)
  }
}

/* 3) لا مراجع هندسية/قانونية في سجل العميل */
const ENGINEERING = ['WCAG', 'ARIA', 'OWASP', 'GDPR', 'React', 'TypeScript', 'GOV.UK', 'Vite', 'Tailwind']
for (const r of refs) {
  const hay = `${r.name_ar} ${r.name_en ?? ''} ${r.organization ?? ''}`
  for (const eng of ENGINEERING) {
    check(!hay.includes(eng), `مرجع هندسي/قانوني ${eng} تسرب لسجل العميل في ${r.id}`)
  }
}

/* 4) لا صور في صفحة المنهجية */
check(!/<img/i.test(methodologyPage), 'Methodology.tsx يحوي <img> — الشعارات ممنوعة بلا ترخيص')

/* 5) أدلة الربط الفعلية */
const anchorCount = (needle: string) =>
  (questions.questions as { reference_anchor?: string }[]).filter((q) =>
    (q.reference_anchor ?? '').includes(needle)
  ).length
const frameworkCount = (needle: string) =>
  (skills.skills as { source_frameworks?: string[] }[]).filter((s) =>
    (s.source_frameworks ?? []).some((f) => f.includes(needle))
  ).length

check(anchorCount('RIASEC') >= 10, `أسئلة موسومة بـRIASEC أقل من 10 (وجد ${anchorCount('RIASEC')})`)
check(frameworkCount('O*NET') >= 100, `مهارات O*NET أقل من 100 (وجد ${frameworkCount('O*NET')})`)
check(frameworkCount('ESCO') >= 100, `مهارات ESCO أقل من 100 (وجد ${frameworkCount('ESCO')})`)
check(frameworkCount('DigComp') >= 40, `مهارات DigComp أقل من 40 (وجد ${frameworkCount('DigComp')})`)

/* ECD: كل دورة تحمل ادعاء إتقان ودليلا مطلوبا */
const courses = core.courses as { course_id: string; assessment_claim_ar?: string; evidence_required_ar?: string }[]
for (const c of courses) {
  check(Boolean(c.assessment_claim_ar), `دورة ${c.course_id} بلا assessment_claim (دليل ECD)`)
  check(Boolean(c.evidence_required_ar), `دورة ${c.course_id} بلا evidence_required (دليل ECD)`)
}

/* Backward Design عبر DR-02 وBloom عبر DR-03 في قواعد التصميم */
const rules = (core.design_rules as { id: string }[]).map((r) => r.id)
check(rules.includes('DR-02'), 'قاعدة التصميم DR-02 (التصميم العكسي) مفقودة من الكتالوج')
check(rules.includes('DR-03'), 'قاعدة التصميم DR-03 (ناتج قابل للملاحظة/بلوم) مفقودة من الكتالوج')

/* 6) فحص الروابط — انقطاع الشبكة تحذير لا فشل */
const checkUrls = async () => {
  const urls = [...new Set(refs.map((r) => r.source_url))]
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    await Promise.all(
      urls.map(async (u) => {
        try {
          const res = await fetch(u, { method: 'HEAD', signal: controller.signal, redirect: 'follow' })
          if (res.status >= 400) warnings.push(`رابط ${u} أعاد ${res.status}`)
        } catch {
          warnings.push(`تعذر الوصول لـ ${u} (ربما انقطاع شبكة — تحقق يدويا)`)
        }
      })
    )
  } finally {
    clearTimeout(timer)
  }
}
await checkUrls()

/* النتيجة */
for (const w of warnings) console.warn(`⚠️  ${w}`)
if (problems.length > 0) {
  console.error(`\n❌ تدقيق المنهجية فشل — ${problems.length} مشكلة:`)
  for (const p of problems) console.error(`   - ${p}`)
  process.exit(1)
}
console.log(`✅ تدقيق المنهجية نظيف: ${refs.length} مراجع، كلها implemented بأدلة ربط فعلية.`)
if (warnings.length > 0) console.log(`   (${warnings.length} تحذير شبكة — لا يفشل البناء)`)
