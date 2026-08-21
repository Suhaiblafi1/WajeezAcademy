/* تدقيق فضاء التوصيات الموحد V2.1 — بوابة سلامة بنيوية بالخصائص لا بالأعداد
   (البند د-١): كل كيان نشط له جمهور ومجال · مراجع الدورات حية · لا نسخ مضمنة ·
   لا حقيقة مطلوبة غير قابلة للإنتاج · مهارات تشخيصية قابلة للقياس · مهارة مسجَّلة ·
   جدوى صالحة · مركب حقيقي متعدد المجالات · الدورة كيان مركزي واحد · حوكمة أكاديمية.

   الأعداد تُعرض ولا تُفشل: تدقيقٌ يفشل عند كل إضافة مشروعة يُعتاد تجاهله فيموت.
   الاستخدام: npm run audit:recommendation-universe */

import { recommendationUniverse } from '../../src/domain/diagnostic/v2_1/universe'
import { courseById, skillSlugs } from '../../src/domain/diagnostic/catalog'
import { measurableSkills } from '../../src/domain/diagnostic/v2_1/universe'

const failures: string[] = []
/* ثغرات معروفة تُعرض ولا تُفشل — انظر KNOWN_AUDIENCE_GAPS */
const audienceGaps: string[] = []
const u = recommendationUniverse()

/* ١) خصائص لا أعداد (البند د-١)
   ⚠ كان هذا القسم يقارن بـ35 و36 و20 و15. أي إضافة مشروعة للكتالوج — مسار جديد
   أو قالب جديد — كانت تُفشل التدقيق. والنتيجة الحتمية: الفريق يعتاد تجاهله أو
   يرفع الرقم بلا تفكير، وعندها يموت التدقيق. فاستُبدلت الأعداد بخصائص لا تتغيّر
   مهما نما الكتالوج، وبقيت الأعداد **معلومة تُعرض** لا شرطا يُفشل. */
const standards = u.active.filter((e) => e.entity_type === 'standard')
const composites = u.active.filter((e) => e.entity_type === 'composite')

/* لا فضاء فارغ ولا نوعٌ غائب — الحدّ الأدنى الذي بدونه لا معنى للتدقيق نفسه */
if (u.entities.length === 0) failures.push('الفضاء الكلي فارغ')
if (standards.length === 0) failures.push('لا كيان قياسي نشط واحد')
if (composites.length === 0) failures.push('لا كيان مركب نشط واحد')
if (u.active.length > u.entities.length) failures.push('النشط أكثر من الكلي — حساب معطوب')

/* خصائص كل كيان نشط: جمهور محدد ومجال واحد على الأقل.
   الكيان بلا جمهور ينافس كل مستخدم بلا قيد («الجوكر»)، وبلا مجال لا يدخل من
   احتياج المستخدم. وهاتان هما العلّتان التي كان العدد الثابت يخفيهما. */
/* ثغرة جمهور معروفة تنتظر قرارا أكاديميا — تُبلَّغ ولا تُفشل، وكل ثغرة جديدة
   تُفشل. القائمة تسمّي الكيان وسببه وما يحلّه، على نفس نمط ACADEMIC_REVIEW_OVERRIDES:
   حاجزٌ يفشل دائما على حالة قائمة يُعتاد تجاهله، وحاجزٌ بلا استثناء موثق يُعطَّل.
   ⚠ إضافة سطر هنا قرار أكاديمي لا حلٌّ تقني: يُحلّ بتحديد المراحل المهنية في
   composite-templates (نصّ persona موجود: «باحث عن ترقية، خبير، قائد، متحدث،
   أو مستقل») ثم إزالة السطر. */
const KNOWN_AUDIENCE_GAPS: Record<string, string> = {
  'TPL-PERSONAL-BRAND-001':
    'جمهوره موصوف نصّا في persona ولا مراحل مهنية مهيكلة — فينافس كل مرحلة. ' +
    'يُحلّ بتحديد career_stages من نصّه ثم إزالة هذا السطر.',
}

for (const e of u.active) {
  const personaGate = e.hard_exclusions.find((h) => h.id === 'persona_mismatch')
  const audienceDefined =
    (personaGate?.condition.values ?? []).length > 0 || e.career_stages.length > 0
  if (!audienceDefined) {
    const known = KNOWN_AUDIENCE_GAPS[e.entity_id]
    if (known) audienceGaps.push(`${e.entity_id}: ${known}`)
    else failures.push(`${e.entity_id}: كيان نشط بلا جمهور محدد — ينافس كل مستخدم بلا قيد`)
  }
  if (e.domains.length === 0) failures.push(`${e.entity_id}: كيان نشط بلا مجال — لا يدخل من احتياج المستخدم`)
}
/* استثناء صار بلا محل: يُزال من القائمة لا يُترك يخفي عودة العلّة */
for (const id of Object.keys(KNOWN_AUDIENCE_GAPS)) {
  const e = u.byId.get(id)
  if (!e) { failures.push(`ثغرة جمهور معروفة لكيان غير موجود: ${id} — أزل السطر من KNOWN_AUDIENCE_GAPS`); continue }
  const gate = e.hard_exclusions.find((h) => h.id === 'persona_mismatch')
  if ((gate?.condition.values ?? []).length > 0 || e.career_stages.length > 0) {
    failures.push(`${id}: صار له جمهور محدد — أزل السطر من KNOWN_AUDIENCE_GAPS`)
  }
}

/* كل مهارة يستعملها كيان مسجَّلة في أحد المصدرين — الخطأ الإملائي يمرّ بلا هذا */
for (const e of u.entities) {
  for (const s of e.skill_slugs) {
    if (!skillSlugs.has(s)) failures.push(`${e.entity_id}: مهارة غير مسجَّلة في أي مصدر: ${s}`)
  }
}

/* الوسم الموثق حاضر ومسبب — إزالته تتطلب إثبات وصول إنتاجي جديد */
const smartOps = u.byId.get('TPL-SMART-OPS-001')
if (!smartOps) failures.push('TPL-SMART-OPS-001: مفقود من الفضاء الكلي')
else if (smartOps.status !== 'needs_revision' || smartOps.status_reasons_ar.length === 0) {
  failures.push('TPL-SMART-OPS-001: فقد وسم needs_revision الموثق — إن عاد نشطًا فبإثبات وصول جديد موثق')
}

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

/* ٩) بوابة الحوكمة الأكاديمية (قرار 2026-08-19): مهارة محكومة
   (future_catalog_skill / future_personalization_signal / merged / pending_review)
   لا تظهر أبدًا حاسمة أو داعمة أو دليل توصية في أي كيان نشط،
   ولا يقيسها سؤال حي (b2c / post_recommendation). التفعيل = إزالة القيد من
   ACADEMIC_GOVERNANCE في build-v2-overlays.mjs بسبب موثق — لا طريق آخر. */
import { layersOfSkill, isDiagnosticSkillActive } from '../../src/domain/diagnostic/v2/data'
import questionPlanJson from '../../src/data/catalog/v2_1/question-plan.v2_1.json'
import bankJson from '../../src/data/catalog/questions.v1.ar.json'

const plan = (questionPlanJson as unknown as { plan: Record<string, { surface: string }> }).plan
const bank = (bankJson as unknown as { questions: { question_id: string; measures?: string[] }[] }).questions

for (const e of u.entities) {
  for (const s of [...e.diagnostic_skills, ...e.skill_slugs]) {
    const meta = layersOfSkill(s)
    if (meta && !isDiagnosticSkillActive(meta)) {
      failures.push(`${e.entity_id}: مهارة محكومة أكاديميًا (${meta.academic_status}) في أدوار الكيان: ${s} — تحتاج تفعيلًا أكاديميًا صريحًا`)
    }
  }
}
for (const q of bank) {
  const p = plan[q.question_id]
  if (!p || (p.surface !== 'b2c' && p.surface !== 'post_recommendation')) continue
  for (const m of q.measures ?? []) {
    const meta = layersOfSkill(m)
    if (meta && !isDiagnosticSkillActive(meta)) {
      failures.push(`${q.question_id}: سؤال حي (${p.surface}) يقيس مهارة محكومة (${meta.academic_status}): ${m}`)
    }
  }
}

/* ملخص — الأعداد معلومة تُعرض لا شرط يُفشل (د-١) */
console.log('═══ تدقيق فضاء التوصيات الموحد ═══')
console.log(`كيانات نشطة: ${u.active.length} (قياسية ${standards.length} + مركبة ${composites.length}) · إجمالي: ${u.entities.length}`)
const noMeasurable = u.active.filter((e) => e.skill_slugs.filter((s) => measurable.has(s)).length === 0)
if (noMeasurable.length > 0) {
  console.warn(
    `⚠ ${noMeasurable.length} كيانا نشطا بلا مهارة مقيسة واحدة — وزن المهارات لا يفرّقها عن منافسيها: ` +
    noMeasurable.map((e) => e.entity_id).join(' · '),
  )
  console.warn('  يُعرض ولا يُفشل: العلاج إضافة أسئلة قياس (ب-٤) لا إسقاط كيانات.')
}
console.log(`دورات مركزية مستخدمة: ${courseUsage.size} · مشتركة بين كيانات (بمرجع واحد لا نسخة): ${shared.length}`)
console.log(`أكثر الدورات مشاركة:`, [...courseUsage.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 5).map(([c, us]) => `${c} ← ${us.length} كيانات`).join(' · '))

if (audienceGaps.length > 0) {
  console.warn('\n⚠ ثغرات جمهور معروفة تنتظر قرارا أكاديميا:')
  for (const g of audienceGaps) console.warn('  · ' + g)
}

if (failures.length > 0) {
  console.error('\nفشل التدقيق:')
  for (const f of failures) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log('\n✓ كل بوابات الفضاء الموحد سليمة')
