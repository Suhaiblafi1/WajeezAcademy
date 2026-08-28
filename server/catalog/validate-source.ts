/* بوابة تحقق مصدرية قبل الاستيراد (البند أ-١).

   المشكلة التي تحلّها: `audit:catalog` يفحص القاعدة **بعد** الاستيراد، فلا يمنع
   دخول بيانات معطوبة. والمستورد نفسه لا يرفض شيئا — يحذف المجهول صامتا. أي أن
   مهارة بخطأ إملائي، أو مسارا بلا جمهور، أو دورةً مشارا إليها ولا وجود لها،
   كلها تمرّ ثم تظهر بعد أسبوع كترشيح خاطئ لا يعرف أحد سببه.

   ما تفعله هذه البوابة: تقرأ ملفات المصدر (لا القاعدة) وترفض قبل أي كتابة.
   تُستدعى من `catalog:import` نفسه لا كخطوة منفصلة تُنسى، وفي CI أيضا.

   ⚠ الفحوص الصارمة تنجح على الكتالوج المنشور اليوم — أُثبت ذلك قبل تثبيتها،
   فالبوابة تمنع الانحدار ولا تُعلن حالةً قائمة عطلا. وما لا يجتازه الكتالوج
   اليوم (قابلية القياس) يُبلَّغ تحذيرا صريحا بالأرقام لا يُخفى ولا يُفشِل. */

import skillsJson from '../../src/data/catalog/skills.v1.ar.json'
import coreJson from '../../src/data/catalog/core-catalog.v2.json'
import templatesJson from '../../src/data/catalog/composite-templates.v1.json'
import profilesJson from '../../src/data/overlays/pathway-profiles.v1.json'
import domainsJson from '../../src/data/catalog/v2/pathway-domains.v2.json'
import layersJson from '../../src/data/catalog/v2/skill-layers.v2.json'
import { measurementDocDrift } from '../../src/application/catalog/skill-measurement'
import { measurableSkills } from '../../src/domain/diagnostic/v2_1/universe'

/** حدود ساعات الدورة — المنشور اليوم ٨–١٢، والمدى يترك مجالا للتأليف */
export const COURSE_HOURS_MIN = 1
export const COURSE_HOURS_MAX = 40

const F = {
  skills: 'src/data/catalog/skills.v1.ar.json',
  core: 'src/data/catalog/core-catalog.v2.json',
  templates: 'src/data/catalog/composite-templates.v1.json',
  profiles: 'src/data/overlays/pathway-profiles.v1.json',
  domains: 'src/data/catalog/v2/pathway-domains.v2.json',
  layers: 'src/data/catalog/v2/skill-layers.v2.json',
} as const

interface SourceCourse { course_id: string; title_ar: string; total_hours: number; skill_slugs: string[] }
interface SourcePathway { id: string; title: string; course_ids: string[] }
interface SourceLibraryResource { id: string; kind: string; title_ar: string; url: string; skill_slugs?: string[] }

/** أنواع موارد المكتبة المعروفة — الصفحة تعرف أيقونة كلٍّ منها وتسميته */
const LIBRARY_KINDS = new Set(['video', 'article', 'template', 'post', 'pdf', 'text', 'book'])

export interface ValidationResult {
  errorsAr: string[]
  warningsAr: string[]
  /* أرقام تُطبع دائما — الفحص الذي لا يقول ما فحصه لا يُثق به */
  stats: {
    courses: number
    pathways: number
    templates: number
    skills: number
    measurableSkills: number
    pathwaysWithoutMeasurableSkill: string[]
    /* البند ب-٤: تباعد التوثيق عن المحرك — measured_by مقابل ما يُسأل فعلا */
    undocumentedMeasured: string[]
    staleMeasuredDoc: string[]
    /* أسئلة قياس تقيس مفاتيح ليست مهارات مسجَّلة */
    measuredNotRegistered: string[]
  }
}

export function validateCatalogSource(): ValidationResult {
  const errorsAr: string[] = []
  const warningsAr: string[] = []

  const core = coreJson as unknown as {
    courses: SourceCourse[]
    launch_pathways: SourcePathway[]
    skill_extensions?: { slug: string }[]
    library_resources?: SourceLibraryResource[]
  }
  const skills = (skillsJson as unknown as { skills: { slug: string }[] }).skills
  const templates = (templatesJson as unknown as {
    templates: {
      template_id: string
      required_courses?: { course_id: string }[]
      conditional_courses?: { course_id: string }[]
      bridge_courses?: { course_id: string }[]
      starter_courses?: { course_id: string }[]
    }[]
  }).templates
  const profiles = (profilesJson as unknown as {
    profiles: Record<string, { personas?: unknown[]; goals?: unknown[] }>
  }).profiles
  const pathwayDomains = (domainsJson as unknown as { pathway_domains: Record<string, string[]> }).pathway_domains
  const layers = (layersJson as unknown as {
    skills: Record<string, { active?: boolean; diagnostic_active?: boolean; measured_by?: string }>
  }).skills

  const courseIds = new Set(core.courses.map((c) => c.course_id))
  const knownSlugs = new Set<string>([
    ...skills.map((s) => s.slug),
    /* ⚠ الامتدادات تُحسب معهم: بدونها يفشل الفحص على ٨٩ مهارة سليمة */
    ...(core.skill_extensions ?? []).map((s) => s.slug),
  ])

  /* ١ — كل شريحة مهارة في الدورات معروفة (الخطأ الإملائي يمرّ صامتا بلا هذا) */
  for (const c of core.courses) {
    for (const slug of c.skill_slugs) {
      if (!knownSlugs.has(slug)) {
        errorsAr.push(`${F.core} · الدورة ${c.course_id}: مهارة غير مسجَّلة «${slug}» — لا في ${F.skills} ولا في skill_extensions`)
      }
    }
  }

  /* ٢ — لكل مسار ملفٌ تعريفي بجمهور وأهداف غير فارغة (الفراغ يجعل المسار جوكرا يطابق الجميع) */
  for (const p of core.launch_pathways) {
    const prof = profiles[p.id]
    if (!prof) {
      errorsAr.push(`${F.profiles}: لا ملف تعريفي للمسار ${p.id} («${p.title}») — بلا ملف يُطابق كل شخصية`)
      continue
    }
    if (!prof.personas || prof.personas.length === 0) {
      errorsAr.push(`${F.profiles} · ${p.id}: personas فارغة — الفراغ يجعل المسار يطابق كل شخصية`)
    }
    if (!prof.goals || prof.goals.length === 0) {
      errorsAr.push(`${F.profiles} · ${p.id}: goals فارغة — الفراغ يجعل المسار يطابق كل هدف`)
    }
  }

  /* ٣ — لكل مسار مجال واحد على الأقل، وكل معرف مجال معروف في التصنيف.
     معرف مجهول لا يرمي خطأ في المحرك — يطابق لا شيء بصمت، فيصبح المسار كأنه بلا مجال (ج-١). */
  const knownDomainIds = new Set(
    (domainsJson as unknown as { domains: { id: string }[] }).domains.map((d) => d.id),
  )
  for (const p of core.launch_pathways) {
    const ids = pathwayDomains[p.id] ?? []
    if (ids.length === 0) {
      errorsAr.push(`${F.domains}: المسار ${p.id} بلا مجال — لا يدخل مطابقة المجالات إطلاقا`)
    }
    for (const d of ids) {
      if (!knownDomainIds.has(d)) {
        errorsAr.push(`${F.domains} · ${p.id}: معرف مجال مجهول «${d}» — يطابق لا شيء بصمت`)
      }
    }
  }
  for (const pid of Object.keys(pathwayDomains)) {
    if (!core.launch_pathways.some((p) => p.id === pid)) {
      errorsAr.push(`${F.domains}: مجالات لمسار غير موجود «${pid}» — صف معلّق يُنشر بلا صاحب`)
    }
  }

  /* ٤ — كل دورة مشار إليها موجودة (المستورد يحذف المجهول صامتا بلا هذا) */
  for (const p of core.launch_pathways) {
    for (const cid of p.course_ids) {
      if (!courseIds.has(cid)) errorsAr.push(`${F.core} · المسار ${p.id}: يشير إلى دورة غير موجودة «${cid}»`)
    }
  }
  for (const t of templates) {
    const refs = [
      ...(t.required_courses ?? []), ...(t.conditional_courses ?? []),
      ...(t.bridge_courses ?? []), ...(t.starter_courses ?? []),
    ]
    for (const r of refs) {
      if (!courseIds.has(r.course_id)) {
        errorsAr.push(`${F.templates} · القالب ${t.template_id}: يشير إلى دورة غير موجودة «${r.course_id}»`)
      }
    }
  }

  /* ٥ — لا معرّفات مكرَّرة (التكرار يجعل الاستيراد يكتب فوق نفسه بلا إنذار) */
  const dup = (ids: string[]) => {
    const seen = new Set<string>()
    const twice = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) twice.add(id)
      seen.add(id)
    }
    return [...twice]
  }
  for (const id of dup(core.courses.map((c) => c.course_id))) {
    errorsAr.push(`${F.core}: معرّف دورة مكرَّر «${id}»`)
  }
  for (const id of dup(core.launch_pathways.map((p) => p.id))) {
    errorsAr.push(`${F.core}: معرّف مسار مكرَّر «${id}»`)
  }
  for (const id of dup(templates.map((t) => t.template_id))) {
    errorsAr.push(`${F.templates}: معرّف قالب مكرَّر «${id}»`)
  }

  /* ٦ — ساعات كل دورة في المدى المعقول */
  for (const c of core.courses) {
    const h = c.total_hours
    if (!Number.isFinite(h) || !Number.isInteger(h) || h < COURSE_HOURS_MIN || h > COURSE_HOURS_MAX) {
      errorsAr.push(`${F.core} · الدورة ${c.course_id}: ساعات ${h} خارج المدى [${COURSE_HOURS_MIN}، ${COURSE_HOURS_MAX}]`)
    }
  }

  /* ٧ — قابلية القياس: مسار بلا مهارة واحدة مقيسة يجعل وزن المهارات (٢٥٪) بلا أثر.
     تحذير لا خطأ: الكتالوج المنشور اليوم لا يجتازه، وإفشال الاستيراد عليه يعطّل
     المنصة بلا أن يصلح شيئا. يُبلَّغ بالأرقام والأسماء ليُعالَج بقرار لا بمفاجأة.

     ⚠ المصدر هو المحرك لا التوثيق: `measurableSkills()` تُشتق من بنك الأسئلة
     وخطة سطح B2C — أي ما يُسأل حقا. قياس هذا الرقم من حقل `measured_by` كان
     يعطي رقما ثالثا مختلفا عمّا يراه المؤلّف وعمّا يحسبه auditStandard. */
  const isActive = (slug: string) => {
    const m = layers[slug]
    if (m === undefined) return true
    return m.active !== false && m.diagnostic_active !== false
  }
  const engineMeasured = measurableSkills()
  const isMeasured = (slug: string) => engineMeasured.has(slug)
  const byId = new Map(core.courses.map((c) => [c.course_id, c]))
  const pathwaysWithoutMeasurableSkill: string[] = []
  for (const p of core.launch_pathways) {
    const slugs = new Set<string>()
    for (const cid of p.course_ids) for (const s of byId.get(cid)?.skill_slugs ?? []) slugs.add(s)
    const measurable = [...slugs].filter((s) => isActive(s) && isMeasured(s))
    if (measurable.length === 0) pathwaysWithoutMeasurableSkill.push(p.id)
  }
  const measurableCount = [...knownSlugs].filter((s) => isActive(s) && isMeasured(s)).length
  if (pathwaysWithoutMeasurableSkill.length > 0) {
    warningsAr.push(
      `${pathwaysWithoutMeasurableSkill.length} من ${core.launch_pathways.length} مسارا بلا مهارة مقيسة واحدة — ` +
      `وزن المهارات (٢٥٪) بلا أثر فيها، وتغطية القياس تُحتسب لها فراغا: ` +
      pathwaysWithoutMeasurableSkill.join(' · '),
    )
    warningsAr.push(
      `المقيس من المهارات ${measurableCount} من ${knownSlugs.size} — ` +
      'كل مهارة مسجَّلة بلا سؤال يقيسها تدخل المقام ولا تُقاس أبدا (البند ب-٤).',
    )
  }

  /* ٩ — سؤال قياس يقيس مفتاحا ليس مهارة مسجَّلة: إجابته تسقط في متجه المهارات
     تحت مفتاح لا تطلبه دورة ولا يحتاجه مسار — أي أن المتعلم يُسأل ولا يُحتسب
     جوابه أبدا. تحذير لا خطأ: العلاج قرار تأليف (تسجيل المهارة أو تحويل
     السؤال إلى مهارة موجودة) لا إسقاط استيراد. */
  const measuredNotRegistered = [...engineMeasured].filter((s) => !knownSlugs.has(s)).sort()
  if (measuredNotRegistered.length > 0) {
    warningsAr.push(
      `${measuredNotRegistered.length} سؤال قياس ذاتي يقيس مفتاحا ليس مهارة مسجَّلة: ` +
      `${measuredNotRegistered.join(' · ')} — يُسأل المتعلم ولا يدخل جوابه أي ترشيح.`,
    )
  }

  /* ٨ — تباعد التوثيق عن المحرك (ب-٤): `measured_by` في skill-layers توثيقٌ،
     والمحرك يقيس ما يسأله بنك الأسئلة فعلا. من يقرأ التوثيق وحده يخطئ في
     الاتجاهين. تحذير لا خطأ: صيانة بيانات لا عطل يمنع الاستيراد. */
  const drift = measurementDocDrift()
  if (drift.undocumented.length > 0) {
    warningsAr.push(
      `${drift.undocumented.length} مهارة يقيسها المحرك بلا توثيق measured_by في ${F.layers}: ` +
      `${drift.undocumented.join(' · ')} — من يقرأ التوثيق يظنها غير مقيسة.`,
    )
  }
  if (drift.staleDoc.length > 0) {
    warningsAr.push(
      `${drift.staleDoc.length} مهارة موثَّقة بـmeasured_by ولا يقيسها المحرك: ` +
      `${drift.staleDoc.join(' · ')} — سؤالها خارج سطح B2C، فالتوثيق يَعِد بقياس لا يحدث.`,
    )
  }

  /* المكتبة (١د) — موادّ تُفتح في تبويب خارجي، فرابطها هو المادّة نفسها:
     رابطٌ معطوب هنا صفحةُ خطأ يراها المتعلم، لا حقلٌ ناقص في لوحة. */
  const library = core.library_resources ?? []
  const libIds = new Set<string>()
  for (const r of library) {
    if (libIds.has(r.id)) errorsAr.push(`مورد مكتبة مكرر المعرّف: ${r.id} في ${F.core}`)
    libIds.add(r.id)
    if (!r.title_ar?.trim()) errorsAr.push(`مورد المكتبة ${r.id} بلا عنوان عربي في ${F.core}`)
    if (!LIBRARY_KINDS.has(r.kind)) {
      errorsAr.push(`مورد المكتبة ${r.id} نوعه «${r.kind}» غير معروف — المعروف: ${[...LIBRARY_KINDS].join(' · ')}`)
    }
    if (!/^https:\/\//.test(r.url ?? '')) {
      errorsAr.push(`مورد المكتبة ${r.id} رابطه ليس https — المكتبة تفتح روابط خارجية، وhttp يُحجب في المتصفح`)
    }
    for (const slug of r.skill_slugs ?? []) {
      if (!knownSlugs.has(slug)) errorsAr.push(`مورد المكتبة ${r.id} يشير إلى مهارة غير مسجَّلة: ${slug}`)
    }
  }

  return {
    errorsAr,
    warningsAr,
    stats: {
      courses: core.courses.length,
      pathways: core.launch_pathways.length,
      templates: templates.length,
      skills: knownSlugs.size,
      measurableSkills: measurableCount,
      pathwaysWithoutMeasurableSkill,
      undocumentedMeasured: drift.undocumented,
      staleMeasuredDoc: drift.staleDoc,
      measuredNotRegistered,
    },
  }
}

/**
 * يرمي عند العطل — تُستدعى من المستورد قبل أي كتابة.
 * @param verbose يطبع الإحصاء والتحذيرات. الافتراضي مُطفأ: المستورد يُستدعى في
 *   كل ملف اختبار، وتحذير يتكرر سبعة عشر مرة يُقرأ ضجيجا لا معلومة. أما
 *   الأخطاء فتُطبع دائما — استيراد يفشل بلا سبب مكتوب لا يُصلَح.
 */
export function assertCatalogSourceValid(opts: { verbose?: boolean } = {}): ValidationResult {
  const r = validateCatalogSource()
  if (opts.verbose) {
    console.log(
      `بوابة المصدر: ${r.stats.pathways} مسارا · ${r.stats.courses} دورة · ${r.stats.templates} قالبا · ` +
      `${r.stats.skills} مهارة (${r.stats.measurableSkills} مقيسة)`,
    )
    for (const w of r.warningsAr) console.warn(`⚠ ${w}`)
  }
  if (r.errorsAr.length > 0) {
    console.error(`\n❌ ${r.errorsAr.length} عطل في ملفات المصدر — لا استيراد:`)
    for (const e of r.errorsAr) console.error(`  · ${e}`)
    throw new Error(`بوابة المصدر رفضت الاستيراد: ${r.errorsAr.length} عطل`)
  }
  if (opts.verbose) console.log('✅ ملفات المصدر سليمة.')
  return r
}
