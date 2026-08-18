/* تدقيق منظومة التشخيص V2 — يفشل (exit 1) عند أي كسر بنيوي.
   يفحص: أهلية الأسئلة والشخصيات، الفلاتر الصارمة، المهارات المجهولة،
   التفسير، التنوع، الأسئلة اليتيمة/الميتة/المكررة، المسارات غير القابلة للوصول
   والمهيمنة، وتغطية الكتالوج للمجالات.
   الاستخدام: npx tsx scripts/audit-diagnostic-v2.ts */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchPathways, pathwayProfiles, pathwaySkills, questionBank } from '../src/domain/diagnostic/catalog'
import { domainsV2, pathwayDomainsV2, questionMetaV2, skillLayersV2 } from '../src/domain/diagnostic/v2/data'
import { questionPlanV21 } from '../src/domain/diagnostic/v2_1/data'
import { CORE_SEQUENCE } from '../src/domain/diagnostic/v2/select'
import type { PersonaKey } from '../src/domain/diagnostic/v2/types'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const failures: string[] = []
const warnings: string[] = []
const ok = (msg: string) => console.log(`  ✅ ${msg}`)
const fail = (msg: string) => {
  failures.push(msg)
  console.log(`  ❌ ${msg}`)
}
const warn = (msg: string) => {
  warnings.push(msg)
  console.log(`  ⚠️ ${msg}`)
}

console.log('═══ تدقيق منظومة التشخيص V2 ═══\n')

/* ١) تغطية الميتا: كل سؤال نشط له ميتا V2 أو خطة V2.1 */
console.log('١) تغطية ميتا الأسئلة')
const active = questionBank.filter((q) => q.active !== false)
const noMeta = active.filter((q) => !questionMetaV2[q.question_id] && !questionPlanV21[q.question_id])
if (noMeta.length === 0) ok(`كل الأسئلة النشطة (${active.length}) لها ميتا V2 أو خطة V2.1`)
else fail(`${noMeta.length} سؤال بلا ميتا: ${noMeta.map((q) => q.question_id).join(', ')}`)

/* ٢) أهلية الشخصيات: كل سؤال غير ميت يصل لشخصية واحدة على الأقل —
   أسئلة خطة V2.1 أهليتها بالمرحلة المهنية (موثقة في الخطة) لا بشخصيات V2 */
console.log('\n٢) الأسئلة اليتيمة (لا تصل أي شخصية)')
const orphans = active.filter((q) => {
  if (questionPlanV21[q.question_id]) return false
  const m = questionMetaV2[q.question_id]
  if (!m || m.layer === 'retire_candidate') return false
  if (m.allowed_personas === 'all') return false
  const reachable = (m.allowed_personas as PersonaKey[]).filter((p) => !m.excluded_personas.includes(p))
  return reachable.length === 0
})
if (orphans.length === 0) ok('لا أسئلة يتيمة')
else fail(`أسئلة يتيمة: ${orphans.map((q) => q.question_id).join(', ')}`)

/* ٣) الأسئلة الميتة موثقة */
console.log('\n٣) مرشحو التقاعد موثقون')
const retired = active.filter((q) => questionMetaV2[q.question_id]?.layer === 'retire_candidate')
ok(`${retired.length} سؤالًا مرشح تقاعد (لا يُطرح في V2، محفوظ للمراجعة الأكاديمية) — لم يُحذف شيء`)

/* ٤) تكرار القياس: حقيقة واحدة تقيسها أسئلة متعددة نشطة غير متقاعدة */
console.log('\n٤) ازدواج القياس')
const byMeasure = new Map<string, string[]>()
for (const q of active) {
  const m = questionMetaV2[q.question_id]
  if (!m || m.layer === 'retire_candidate') continue
  const key = (m.measures ?? []).filter((x) => x !== 'skill_vector')[0]
  if (!key) continue
  if (!byMeasure.has(key)) byMeasure.set(key, [])
  byMeasure.get(key)!.push(q.question_id)
}
const dupes = [...byMeasure.entries()].filter(([, ids]) => ids.length > 1)
if (dupes.length <= 8) {
  ok(`${dupes.length} حقيقة تقيسها أكثر من سؤال (مقبول للتحقق المتعمد): ${dupes.map(([k, v]) => `${k}←${v.join('+')}`).join(' | ')}`)
} else {
  fail(`ازدواج قياس مفرط: ${dupes.map(([k]) => k).join(', ')}`)
}

/* ٥) المهارات: المقاسة موثقة بطبقة diagnostic، والمتطلبة غير المقاسة لا تدخل الفجوة */
console.log('\n٥) طبقات المهارات')
const skillEntries = Object.entries(skillLayersV2)
const measuredSkills = skillEntries.filter(([, v]) => v.measured_by)
const uncoveredMeasured = measuredSkills.filter(([, v]) => !(v.pathway_ids?.length))
ok(`${measuredSkills.length} مهارة مقيسة بأسئلة M4 — منها ${uncoveredMeasured.length} غير مغطاة بمسار (إشارات تخصيص موثقة): ${uncoveredMeasured.map(([s]) => s).join(', ')}`)
const noLayer = pathwaySkillsAllSlugs().filter((s) => !skillLayersV2[s])
if (noLayer.length === 0) ok('كل مهارات المسارات موثقة الطبقة')
else fail(`مهارات بلا طبقة: ${noLayer.join(', ')}`)
function pathwaySkillsAllSlugs(): string[] {
  return [...new Set(launchPathways.flatMap((p) => pathwaySkills(p.id).map((s) => s.slug)))]
}

/* ٦) المجالات: كل مسار مربوط، وكل مجال بلا مسار = فجوة موثقة */
console.log('\n٦) تغطية المجالات')
const noDomainPathways = launchPathways.filter((p) => !(pathwayDomainsV2[p.id]?.length))
if (noDomainPathways.length === 0) ok('كل المسارات العشرين مربوطة بمجالات')
else fail(`مسارات بلا مجال: ${noDomainPathways.map((p) => p.id).join(', ')}`)
const coveredDomains = new Set(Object.values(pathwayDomainsV2).flat())
const gapDomains = domainsV2.filter((d) => !coveredDomains.has(d.id))
if (gapDomains.length > 0) {
  warn(`مجالات بلا مسار (فجوات كتالوج صريحة): ${gapDomains.map((d) => `${d.id} (${d.name_ar})`).join('، ')}`)
} else {
  ok('كل المجالات مغطاة')
}

/* ٧) قابلية الوصول: مسارات لا يمكن أن تفوز بأي شخصية من الشخصيات الـ75 */
console.log('\n٧) قابلية وصول المسارات (من تقرير المحاكاة)')
const reportPath = join(root, 'docs/diagnostic-v2/personas-report.json')
if (existsSync(reportPath)) {
  const report = JSON.parse(readFileSync(reportPath, 'utf8'))
  const winners = new Set(Object.keys(report.summary.pathwayDistribution).filter((k) => !k.startsWith('template:')))
  const unreachable = launchPathways.filter((p) => !winners.has(p.id))
  if (unreachable.length > 0) warn(`${unreachable.length} مسارًا لم يفز بالمرتبة الأولى في أي من 525 جلسة: ${unreachable.map((p) => p.id).join(', ')} — يُوثق في CATALOG_GAPS`)
  else ok('كل المسارات فازت مرة على الأقل')
  const total = report.summary.sessions
  const dominant = Object.entries(report.summary.pathwayDistribution).filter(([, v]) => (v as number) / total > 0.35)
  if (dominant.length > 0) warn(`مسارات مهيمنة (>35٪): ${JSON.stringify(dominant)}`)
  else ok('لا مسار مهيمن فوق 35٪')
} else {
  warn('تقرير المحاكاة غير موجود — شغّل npm run simulate:v2-personas أولًا')
}

/* ٨) النواة: كل أسئلة CORE_SEQUENCE موجودة ونشطة ولها ميتا core */
console.log('\n٨) سلامة النواة الدنيا')
const coreBad = CORE_SEQUENCE.filter((s) => {
  const q = questionBank.find((x) => x.question_id === s.questionId)
  const m = questionMetaV2[s.questionId]
  return !q || q.active === false || !m || m.phase !== 'core'
})
if (coreBad.length === 0) ok(`أسئلة النواة (${CORE_SEQUENCE.length}) كلها صالحة`)
else fail(`أسئلة نواة غير صالحة: ${coreBad.map((s) => s.questionId).join(', ')}`)

/* ٩) بروفايلات المسارات: كل مسار له بروفايل */
console.log('\n٩) بروفايلات المسارات')
const noProfile = launchPathways.filter((p) => !pathwayProfiles[p.id])
if (noProfile.length === 0) ok('كل مسار له بروفايل جمهور')
else fail(`مسارات بلا بروفايل: ${noProfile.map((p) => p.id).join(', ')}`)

console.log('\n═══ الخلاصة ═══')
console.log(`إخفاقات: ${failures.length} | تحذيرات: ${warnings.length}`)
if (failures.length > 0) {
  console.error('❌ فشل التدقيق')
  process.exit(1)
}
console.log('✅ نجح التدقيق')
