/* تدقيق فضاء التوصيات الموحد V2.1 — بوابة سلامة بنيوية:
   36 كيانًا نشطًا (20+16) بعد إصلاحات المرحلة 4 · مراجع الدورات حية · لا نسخ مضمنة ·
   لا حقيقة مطلوبة غير قابلة للإنتاج · مهارات تشخيصية قابلة للقياس · جدوى صالحة ·
   مركب حقيقي متعدد المجالات · الدورة كيان مركزي واحد.
   الاستخدام: npm run audit:recommendation-universe */

import { recommendationUniverse } from '../../src/domain/diagnostic/v2_1/universe'
import { courseById } from '../../src/domain/diagnostic/catalog'
import { measurableSkills } from '../../src/domain/diagnostic/v2_1/universe'

const failures: string[] = []
const u = recommendationUniverse()

/* ١) الأعداد — بعد المرحلة 4: كل القوالب الـ16 نشطة (الخمسة المجمدة أُصلحت بنيويًا) */
if (u.active.length !== 36) failures.push(`الفضاء النشط ${u.active.length} ≠ 36`)
const standards = u.active.filter((e) => e.entity_type === 'standard')
const composites = u.active.filter((e) => e.entity_type === 'composite')
if (standards.length !== 20) failures.push(`القياسية ${standards.length} ≠ 20`)
if (composites.length !== 16) failures.push(`المركبة النشطة ${composites.length} ≠ 16`)
if (u.entities.length !== 36) failures.push(`إجمالي الكيانات ${u.entities.length} ≠ 36`)

/* ٢) تفرد المعرفات */
const ids = u.entities.map((e) => e.entity_id)
if (new Set(ids).size !== ids.length) failures.push('معرفات كيانات مكررة')

/* ٣) مراجع الدورات حية — ولا حقول نسخ مضمنة (الكيان يحمل معرفات فقط) */
for (const e of u.entities) {
  const refs = [...e.required_courses, ...e.conditional_courses, ...e.optional_courses]
  if (refs.length === 0) failures.push(`${e.entity_id}: بلا أي مرجع دورة`)
  for (const cid of refs) {
    if (!courseById.get(cid)) failures.push(`${e.entity_id}: مرجع دورة غير موجود ${cid}`)
    if (typeof cid !== 'string' || cid.length < 3) failures.push(`${e.entity_id}: مرجع مشبوه ${String(cid)}`)
  }
}

/* ٤) الخمسة المُصلحة في المرحلة 4 — نشطة وبلا حقائق مطلوبة غير قابلة للإنتاج.
   تصنيف إصلاحها الموثق: FIRST-JOB (education_state مشتقة من career_stage) ·
   CX (current_pain منتَجة من need_customer_experience) · TRAINER (current_domain → mapping) ·
   CYBER + STRATEGY (حقائق مؤسسية محظورة في B2C → سياق تنفيذ اختياري لا أهلية) */
const REPAIRED = ['TPL-FIRST-JOB-001', 'TPL-CX-001', 'TPL-DIGITAL-TRAINER-001', 'TPL-CYBER-MANAGER-001', 'TPL-STRATEGY-001']
for (const id of REPAIRED) {
  const e = u.byId.get(id)
  if (!e) failures.push(`${id}: مفقود من الفضاء الكلي`)
  else {
    if (e.status !== 'approved_active') failures.push(`${id}: حالته ${e.status} ≠ approved_active بعد الإصلاح`)
    if (e.unproducible_facts.length > 0) failures.push(`${id}: ما زالت تحمل حقائق غير قابلة للإنتاج: ${e.unproducible_facts.join('، ')}`)
  }
}

/* ٥) المهارات التشخيصية قابلة للقياس فعلًا */
const measurable = measurableSkills()
for (const e of u.entities) {
  for (const s of e.diagnostic_skills) {
    if (!measurable.has(s)) failures.push(`${e.entity_id}: مهارة تشخيصية غير قابلة للقياس ${s}`)
  }
}

/* ٦) الجدوى صالحة */
for (const e of u.entities) {
  const { min_weekly_load_order, estimated_hours, duration_weeks } = e.feasibility
  if (min_weekly_load_order < 1 || min_weekly_load_order > 4) failures.push(`${e.entity_id}: رتبة وقت دنيا غير صالحة`)
  if (estimated_hours <= 0 || duration_weeks <= 0) failures.push(`${e.entity_id}: ساعات/أسابيع غير صالحة`)
}

/* ٧) المركب النشط متعدد المجالات حقًا */
for (const e of composites) {
  if (e.domains.length < 2) failures.push(`${e.entity_id}: مركب نشط بأقل من مجالين جوهريين`)
  if (e.pathway_requirements.length < 2) failures.push(`${e.entity_id}: مركب يمثل أقل من مسارين`)
}

/* ٨) الدورة المركزية الواحدة — نفس الدورة قد تخدم عدة كيانات بمرجع واحد، لا بنسخ */
const courseUsage = new Map<string, string[]>()
for (const e of u.entities) {
  for (const cid of e.required_courses) {
    courseUsage.set(cid, [...(courseUsage.get(cid) ?? []), e.entity_id])
  }
}
const shared = [...courseUsage.entries()].filter(([, users]) => users.length > 1)

/* ملخص */
console.log('═══ تدقيق فضاء التوصيات الموحد ═══')
console.log(`كيانات نشطة: ${u.active.length} (قياسية ${standards.length} + مركبة ${composites.length}) · إجمالي: ${u.entities.length}`)
console.log(`دورات مركزية مستخدمة: ${courseUsage.size} · مشتركة بين كيانات (بمرجع واحد لا نسخة): ${shared.length}`)
console.log(`أكثر الدورات مشاركة:`, [...courseUsage.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 5).map(([c, us]) => `${c} ← ${us.length} كيانات`).join(' · '))

if (failures.length > 0) {
  console.error('\nفشل التدقيق:')
  for (const f of failures) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log('\n✓ كل بوابات الفضاء الموحد سليمة')
