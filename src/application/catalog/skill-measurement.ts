/* حالة قياس المهارة (البند ب-٤) — لمنتقي المهارات في شاشة التأليف.

   المشكلة التي يحلّها: القائمة وحدها لا تكفي. مهارة مسجَّلة لا يقيسها سؤال
   تُضعف وزن المهارات بنفس قدر الخطأ الإملائي: تدخل مقام التغطية ولا تُقاس
   أبدا، فتبقى «مجهولة» في كل جلسة تشخيص. والمؤلّف لا يرى الفرق بين الصلاحية
   والفائدة إلا إن أُظهر له.

   المصدر الحاكم هو المحرك لا التوثيق: `measurableSkills()` تُشتق من بنك
   الأسئلة الفعلي ومن خطة سطح B2C — أي ما يُسأل حقا. وحقل `measured_by` في
   skill-layers توثيقٌ قد يتباعد عنه، فمن يقرأ التوثيق وحده يخطئ. (صفر تباعد
   في 2026-08-26: التوثيق الناقص امتلأ بتأليف أسئلة القياس، والثلاث «الموثقة بلا
   قياس» تبيّن أنها ليست تباعدا بل أسئلة منقولة عمدا إلى ما بعد التوصية.)

   ولا حكم هنا يمنع: المؤلّف يرى الحالة ويقرّر. المنع بلا بديل يدفعه إلى حشر
   مهارة قريبة خاطئة — وهذا أسوأ من مهارة صحيحة غير مقيسة. */

import { measurableSkills } from '../../domain/diagnostic/v2_1/universe'
import { isDiagnosticSkillActive, layersOfSkill } from '../../domain/diagnostic/v2/data'
import { planOf } from '../../domain/diagnostic/v2_1/data'
import { skillsCatalog } from '../../domain/diagnostic/catalog'

/** ثلاث حالات فقط، مرتّبة من الأنفع إلى الأضرّ */
export type SkillMeasureState =
  /** يقيسها سؤال فعلي في مسار B2C — تفصل بين المرشحين */
  | 'measured'
  /** مسجَّلة ونشطة تشخيصيا ولا يقيسها سؤال — تدخل المقام ولا تُقاس */
  | 'registered_unmeasured'
  /** موقوفة تشخيصيا — لا تدخل الحساب إطلاقا */
  | 'inactive'

/** حدٌّ لَيّن لعدد مهارات الدورة — ضِعف ما عليه الكتالوج المنشور (أربع لكل دورة) */
export const SOFT_MAX_SKILLS = 8
/** عند بلوغ هذه النسبة من غير المقيس (بأربع مهارات أو أكثر) يُنبَّه المؤلّف */
export const DILUTION_RATIO = 0.75

export interface SkillState {
  slug: string
  nameAr: string
  state: SkillMeasureState
  /** معرّف السؤال الموثَّق للقياس — قد يكون null مع state=measured (توثيق متأخر) */
  measuredBy: string | null
  /** دور المهارة في القرار كما وُثّق — يساعد المؤلّف على الاختيار */
  decisionRoleAr: string | null
  /** جملة تُعرض بجانب الاسم — تقول الحالة وأثرها لا الحالة وحدها */
  noteAr: string
}

export const STATE_LABEL_AR: Record<SkillMeasureState, string> = {
  measured: 'مقيسة',
  registered_unmeasured: 'مسجَّلة بلا سؤال',
  inactive: 'موقوفة تشخيصيا',
}

/** سؤال قياس المهارة نُقل عمدا إلى ما بعد التوصية — موجود ويُسأل، ولا يفصل بين
    المرشحين. غيابه عن الترشيح قرارٌ لا عطل: مهارة لا يتطلبها أي مقرر، فقياسها
    قبل النتيجة مقعد بلا أثر قراري. */
function isPostRecommendation(questionId: string | null): boolean {
  return !!questionId && planOf(questionId)?.final_status === 'post_recommendation'
}

function noteFor(state: SkillMeasureState, measuredBy: string | null): string {
  if (state === 'measured') {
    return measuredBy ? `يقيسها ${measuredBy} · تفصل بين المرشحين` : 'يقيسها سؤال فعلي · تفصل بين المرشحين'
  }
  if (state === 'registered_unmeasured') {
    /* «بلا سؤال» تكذب حين يوجد سؤال بعد التوصية: من يقرأها قد يؤلّف سؤالا ثانيا
       للمهارة نفسها — وحارس التأليف على معرّف السؤال لا على المهارة، فلن يمنعه. */
    if (isPostRecommendation(measuredBy)) {
      return `يقيسها ${measuredBy} بعد التوصية · لا تفصل بين المرشحين`
    }
    return 'مسجَّلة بلا سؤال · تدخل المقام ولا تُقاس'
  }
  return 'موقوفة تشخيصيا · لا تدخل الحساب إطلاقا'
}

/** حالة مهارة واحدة — تُحسب من المحرك لا من التوثيق */
export function skillStateOf(slug: string, nameAr?: string): SkillState {
  const meta = layersOfSkill(slug)
  const measured = measurableSkills().has(slug)
  const active = isDiagnosticSkillActive(meta)
  const state: SkillMeasureState = !active ? 'inactive' : measured ? 'measured' : 'registered_unmeasured'
  const measuredBy = meta?.measured_by ?? null
  return {
    slug,
    nameAr: nameAr ?? skillsCatalog.find((s) => s.slug === slug)?.name_ar ?? slug.replace(/_/g, ' '),
    state,
    measuredBy,
    decisionRoleAr: meta?.decision_role_ar ?? null,
    noteAr: noteFor(state, measuredBy),
  }
}

export interface SelectionAssessment {
  total: number
  measured: number
  unmeasured: number
  inactive: number
  /** تنبيهات تُعرض عند التأليف — لا تمنع الحفظ */
  warningsAr: string[]
}

/**
 * يقيس جودة اختيار المهارات لدورة.
 * لا يمنع شيئا: يقول للمؤلّف ما ترتّب على اختياره بالأرقام قبل أن يحفظه.
 */
export function assessSkillSelection(slugs: string[]): SelectionAssessment {
  const unique = [...new Set(slugs)]
  const states = unique.map((s) => skillStateOf(s))
  const measured = states.filter((s) => s.state === 'measured').length
  const inactive = states.filter((s) => s.state === 'inactive').length
  const unmeasured = states.filter((s) => s.state === 'registered_unmeasured').length
  const warningsAr: string[] = []

  if (unique.length > SOFT_MAX_SKILLS) {
    warningsAr.push(
      `هذه الدورة بلغت ${unique.length} مهارة — الحدّ المُوصى به ${SOFT_MAX_SKILLS}. ` +
      'كل مهارة زائدة تُوسّع مقام تغطية القياس فتخفض ثقة الترشيح في كل مسار يستخدمها.',
    )
  }
  if (unique.length > 0 && measured === 0) {
    warningsAr.push(
      'لا مهارة مقيسة واحدة في هذه الدورة — وزن المهارات لن يفرّقها عن أي دورة أخرى. ' +
      'اختر مهارة مقيسة واحدة على الأقل، أو اطلب إضافة سؤال قياس لإحدى مهاراتها.',
    )
  } else if (unique.length >= 4 && unmeasured / unique.length >= DILUTION_RATIO) {
    warningsAr.push(
      `${unmeasured} من ${unique.length} مهارة غير قابلة للقياس — ستُضعف دقة ترشيح كل مسار يستخدم هذه الدورة.`,
    )
  }
  if (inactive > 0) {
    warningsAr.push(
      `${inactive} مهارة موقوفة تشخيصيا في الاختيار — لا تدخل الحساب إطلاقا، فوجودها لا يضيف شيئا للترشيح.`,
    )
  }

  return { total: unique.length, measured, unmeasured, inactive, warningsAr }
}

/** ترتيب العرض: المقيسة أولا ثم المسجَّلة ثم الموقوفة، وأبجديا داخل كل حالة */
export function byStateThenName(a: SkillState, b: SkillState): number {
  const rank = (s: SkillState) => (s.state === 'measured' ? 0 : s.state === 'registered_unmeasured' ? 1 : 2)
  if (rank(a) !== rank(b)) return rank(a) - rank(b)
  return a.nameAr.localeCompare(b.nameAr, 'ar')
}

/**
 * تباعد التوثيق عن المحرك — مهارات **مسجَّلة** يقيسها المحرك بلا `measured_by`،
 * وأخرى موثَّقة لا يقيسها. تُعرض في التدقيق لا للمؤلّف: صيانة بيانات.
 *
 * ⚠ المفاتيح غير المسجَّلة تُستثنى هنا بقصد: غيابها من التوثيق نتيجةُ أنها ليست
 * مهارات أصلا، لا عطلُ توثيق. تُبلَّغ في بوابة المصدر بسببها الحقيقي — فكل
 * واقعة تُقال مرة واحدة بعلّتها لا مرتين بعلّتين مختلقتين.
 */
export function measurementDocDrift(): { undocumented: string[]; staleDoc: string[] } {
  const engine = measurableSkills()
  const registered = new Set(skillsCatalog.map((s) => s.slug))
  const undocumented: string[] = []
  const staleDoc: string[] = []
  for (const slug of engine) {
    if (!registered.has(slug)) continue
    if (!layersOfSkill(slug)?.measured_by) undocumented.push(slug)
  }
  for (const s of skillsCatalog) {
    const meta = layersOfSkill(s.slug)
    if (!meta?.measured_by || engine.has(s.slug)) continue
    /* سؤال نُقل عمدا إلى ما بعد التوصية ليس توثيقا بائتا: الحقل يصف سؤالا قائما
       يُسأل فعلا، والمحرك لا يقيسه قبل النتيجة بقرار موثق في خطة V2.1. البائت
       هو ما يَعِد بقياس لا وجود له — سؤال على سطح B2C لا يقيسه المحرك. */
    if (isPostRecommendation(meta.measured_by)) continue
    staleDoc.push(s.slug)
  }
  return { undocumented: undocumented.sort(), staleDoc: staleDoc.sort() }
}
