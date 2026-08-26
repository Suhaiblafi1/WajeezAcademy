/* ج-٢ · مولّد خطة الأسئلة V2.1 (كان داخل scripts/build-v2_1-overlays.ts).
   منطقٌ وجداولُ حكمٍ منقولة كما هي: القاعدة الصارمة أن سؤالا لا نستطيع إكمال
   جملته «هذا السؤال موجود لأن إجابة أ مقابل ب تغيّر ___» يصبح retire_candidate.

   نُقل إلى الطبقة المشتركة لأن **سؤالا بلا مدخل في الخطة غير مرئي للمحرك**.
   قبل هذا البند كانت الخطة تُولَّد وقت البناء من ملف البنك وحده، فسؤال M4 جديد
   يُضاف بعد النشر — يقيس مهارة جديدة — يبقى خارج الخطة فلا يُطرح أبدا. الآن
   يولّدها باني اللقطة من الأسئلة المنشورة، فيدخل السؤال الجديد بافتراض وحدته.

   ما بقي في السكربت: أسئلة QC الجديدة وتأثيرات خياراتها وبطاقات القرار —
   محتوى مؤلَّف في الكود لا مولَّد من بيانات حية. */

import type { OverlaySource } from './source'
import {
  NEEDS_V21,
  Q,
  type CareerStage,
  type QuestionLayerV21,
  type QuestionSurface,
} from '../../../domain/diagnostic/v2_1/maps'

export type Action = 'keep' | 'rewrite' | 'replaced' | 'move_post' | 'retire' | 'out_of_scope'
/* الحالة النهائية — كل سؤال يُحسب مرة واحدة فقط، والمجموع = 198 دائمًا.
   الاشتقاق حتمي من (surface, phase, action) — لا حالة تُكتب يدويًا:
   active_b2c = سطح B2C ويُطرح في التدفق الأساسي/التكيفي
   deep_only = سطح B2C لكنه لا يُطرح إلا في جولة التأكيد الاختيارية
   post_recommendation = تخصيص ما بعد التوصية — لا أثر على المسار
   institutional = مسار المؤسسات B2B/B2G المستقل
   retired = متقاعد من B2C (تقاعد أو استبدال بسؤال QC)
   out_of_scope = خارج نطاق التشخيص كليًا (أسري/لغة/ميزانية/إقرارات واجهة) */
export type FinalStatus = 'active_b2c' | 'deep_only' | 'post_recommendation' | 'institutional' | 'retired' | 'out_of_scope'
export function finalStatusOf(surface: QuestionSurface, phase: PlanEntry['phase'], action: Action): FinalStatus {
  if (surface === 'b2c') return phase === 'confirmation' ? 'deep_only' : 'active_b2c'
  if (surface === 'post_recommendation') return 'post_recommendation'
  if (surface === 'b2b_b2g') return 'institutional'
  if (surface === 'ui_ack') return 'out_of_scope'
  return action === 'out_of_scope' ? 'out_of_scope' : 'retired'
}
export interface PlanEntry {
  surface: QuestionSurface
  layer21: QuestionLayerV21 | null
  phase: 'core' | 'adaptive' | 'confirmation' | 'none'
  action: Action
  stages: CareerStage[] | 'all'
  domains: string[]
  impact_ar: string
  why_ar: string
  replaced_by?: string
  measures: string[]
  final_status?: FinalStatus
}

const EMPLOYED: CareerStage[] = ['early_career', 'experienced', 'manager', 'senior_manager', 'trainer_ld']
const STUDENTISH: CareerStage[] = ['university_student', 'fresh_graduate', 'early_career']
const FOUNDERS: CareerStage[] = ['founder', 'freelancer']

/* افتراضيات الوحدات */
const moduleDefault: Record<string, Pick<PlanEntry, 'surface' | 'layer21' | 'phase' | 'action' | 'stages' | 'why_ar'>> = {
  M0: { surface: 'retired_b2c', layer21: null, phase: 'none', action: 'retire', stages: [], why_ar: 'وحدة الاستقبال المؤسسي أُخرجت من محرك B2C.' },
  M3D: { surface: 'retired_b2c', layer21: null, phase: 'none', action: 'out_of_scope', stages: [], why_ar: 'الوحدة الأسرية خارج نطاق أكاديمية B2C — الأبوة ليست شخصية تعليمية هنا.' },
  M9: { surface: 'b2b_b2g', layer21: null, phase: 'none', action: 'out_of_scope', stages: [], why_ar: 'أسئلة مؤسسية — تعيش في مسار B2B/B2G المستقل.' },
  M5: { surface: 'b2c', layer21: 'domain_differentiation', phase: 'adaptive', action: 'keep', stages: 'all', why_ar: 'ميول RIASEC تُستخدم فقط عند غموض الهدف/الاحتياج لفصل المجالات.' },
  M6: { surface: 'post_recommendation', layer21: null, phase: 'none', action: 'move_post', stages: [], why_ar: 'أسلوب العمل يخصّص المتابعة والالتزام بعد التوصية — لا يحدد ماذا يتعلم الشخص.' },
  M8: { surface: 'b2c', layer21: 'confirmation_deep', phase: 'confirmation', action: 'keep', stages: 'all', why_ar: 'أسئلة تحقق وتعميق — تُدار من جولة التأكيد المشروطة.' },
}

/* استثناءات صريحة لكل سؤال محفوظ/مُعاد/مستبدل */
const overrides: Record<string, Partial<PlanEntry>> = {
  'QB-M0-001': { surface: 'b2b_b2g', action: 'out_of_scope', why_ar: 'صاحب القرار المؤسسي — مسار B2B/B2G فقط. في B2C المتعلم هو صاحب القرار دائمًا.', impact_ar: 'خارج B2C — في مسار المؤسسات يغيّر لغة الرحلة كلها.' },
  'QB-M0-002': { surface: 'ui_ack', action: 'move_post', why_ar: 'العمر لم يعد مطلوبًا: المرحلة المهنية صريحة، وأمان القاصرين يُعالج بإقرار الواجهة.', impact_ar: 'لا أثر قراري في B2C.' },
  'QB-M0-003': { surface: 'post_recommendation', action: 'move_post', why_ar: 'الدولة تخصيص عرض/تسعير لاحقًا — لا تغيّر التوصية التعليمية.', impact_ar: 'لا أثر على المسار.' },
  'QB-M0-004': { surface: 'retired_b2c', action: 'retire', why_ar: 'الأكاديمية عربية حاليًا — سؤال اللغة غير قابل للاستخدام منتجيًا.', impact_ar: 'لا أثر — محذوف من B2C.' },
  'QB-M0-005': { surface: 'ui_ack', action: 'move_post', why_ar: 'الحفظ ميزة واجهة قائمة — ليس سؤالًا تشخيصيًا.', impact_ar: 'لا أثر قراري.' },
  'QB-M0-006': { surface: 'ui_ack', action: 'move_post', why_ar: 'الموافقة إقرار واجهة قبل البدء (موجودة في صفحة التشخيص) — لا تُحسب سؤالًا ولا تدخل الثقة.', impact_ar: 'لا تغيّر التوصية — إجراء قانوني فقط.' },
  'QB-M0-007': { surface: 'ui_ack', action: 'move_post', why_ar: 'الموافقة التسويقية قانونية مستقلة — تُدار بالواجهة عند الحاجة.', impact_ar: 'لا أثر قراري.' },
  'QB-M0-008': { surface: 'ui_ack', action: 'move_post', why_ar: 'سن 18+ يُذكر في إقرار الواجهة؛ لا سؤال قاصر داخل المحرك.', impact_ar: 'لا أثر قراري في B2C.' },
  'QB-M0-009': { surface: 'b2b_b2g', action: 'out_of_scope', why_ar: 'الجهة الدافعة سؤال مبيعات/عروض — يعالج في Checkout لا في التشخيص التعليمي.', impact_ar: 'خارج B2C.' },
  'QB-M0-010': { surface: 'retired_b2c', action: 'retire', why_ar: 'الارتياح للخصوصية لا يستطيع المنتج استخدام إجابته.', impact_ar: 'لا أثر — محذوف.' },

  'QB-M1-001': { action: 'replaced', replaced_by: Q.STAGE, why_ar: 'استُبدل بسؤال المرحلة المهنية الدقيق (10 أوصاف) — الفصل بين المرحلة وحالة العمل.', impact_ar: 'خليفته يحدد المرحلة ويفلتر كل ما بعدها.' },
  'QB-M1-002': { action: 'replaced', replaced_by: Q.STAGE, why_ar: 'المرحلة التعليمية اندمجت في سؤال المرحلة المهنية — لا حاجة لسؤالين.', impact_ar: 'لا أثر مستقل بعد الدمج.' },
  'QB-M1-003': { action: 'replaced', replaced_by: Q.EMPLOYMENT, why_ar: 'استُبدل بسؤال حالة العمل المنفصل (5 حالات) — يُسأل فقط عندما لا تحسمه المرحلة.', impact_ar: 'خليفته يفصل أول وظيفة عن ترقية.' },
  'QB-M1-005': { surface: 'retired_b2c', action: 'retire', why_ar: 'نص حر بلا consequence حتمي — سؤال الاحتياج QC-N3-001 يكتشف المجال بخيارات مؤثرة موثقة.', impact_ar: 'لا أثر قابل للحسم — محذوف من B2C.' },
  'QB-M1-007': { surface: 'retired_b2c', action: 'retire', why_ar: 'نص حر بلا consequence حتمي — سؤال الاحتياج QC-N3-001 يغطي الإشارة بخيارات مؤثرة.', impact_ar: 'لا أثر قابل للحسم — محذوف من B2C.' },
  'QB-M1-011': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: 'all', why_ar: 'وجود دليل مهاري (مشروع/شهادة) يرفع جودة الأدلة ويغيّر درجة الثقة.', impact_ar: '«لدي ملف أعمال» مقابل «لا دليل» يغيّر قوة التوصية وربما جولة التأكيد.' },

  'QB-M2-001': { action: 'replaced', replaced_by: Q.GOAL, why_ar: 'استُبدل بسؤال هدف تُفلتر خياراته حسب المرحلة المهنية — لا هدف واحد للجميع.', impact_ar: 'خليفته يحدد فضاء المشكلة.' },
  'QB-M2-005': { surface: 'b2c', layer21: 'goal_need', phase: 'core', action: 'keep', stages: 'all', why_ar: 'وضوح الهدف يقرر: انتقال سريع للأدلة أم استكشاف أعمق — ويدخل الثقة.', impact_ar: '«واضح تمامًا» مقابل «غامض» يغيّر مسار الجلسة والثقة النهائية.' },
  'QB-M2-010': { action: 'replaced', replaced_by: Q.MASTERY, why_ar: '«توسع أفقي/تعمق عمودي» مصطلح داخلي — استُبدل بسؤال إتقان مقابل منظومة بلغة المستخدم، ولا يُسأل إلا عند غموض قياسي/مركب.', impact_ar: 'خليفته يفصل بين مسار واحد وخطة مركبة.' },
  'QB-M2-015': { surface: 'b2c', layer21: 'feasibility', phase: 'adaptive', action: 'keep', stages: 'all', why_ar: 'الاستعداد للتطبيق العملي يضبط طبيعة الخطة (مشاريع مقابل محتوى نظري).', impact_ar: '«جاهز للتطبيق» مقابل «أفضل النظرية» يغيّر مكون الخطة لا المسار.' },
  'QB-M2-016': { surface: 'post_recommendation', action: 'move_post', why_ar: 'تفضيل التعامل مع مهارة غير متوفرة يُعرض بعد التوصية لا قبلها.', impact_ar: 'لا أثر على اختيار المسار.' },

  'QB-M3A-003': { surface: 'b2c', layer21: 'goal_need', phase: 'adaptive', action: 'keep', stages: STUDENTISH, why_ar: 'وضوح تصور أول وظيفة يفصل «جاهزية توظيف» عن «استكشاف اتجاه».', impact_ar: 'يغيّر المجال المتصدر لطالب/خريج.' },
  'QB-M3A-004': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: STUDENTISH, why_ar: 'وجود سيرة/ملف أصول مهنية دليل مباشر على جاهزية التوظيف.', impact_ar: 'يفصل مسارات الجاهزية عن بناء الأساس.' },
  'QB-M3A-005': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: [...STUDENTISH, 'freelancer'], why_ar: 'ملف الأعمال دليل مهارة قابل للعرض — يدعم أهداف بناء الهوية المهنية.', impact_ar: 'يغيّر قوة الأدلة وترتيب مسارات العلامة الشخصية.' },
  'QB-M3A-006': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: STUDENTISH, why_ar: 'الثقة بالمقابلات بصياغة دليلية تقيس فجوة جاهزية حقيقية.', impact_ar: 'تغيّر فجوة المهارات المقيسة لمسارات التوظيف.' },
  'QB-M3A-007': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: STUDENTISH, why_ar: 'التعرض العملي (تدريب/تطوع) دليل خبرة يفرّق بين مسارين متقاربين.', impact_ar: 'يرفع جودة الأدلة وقد يحسم الترتيب.' },

  'QB-M3B-001': { surface: 'b2c', layer21: 'domain_differentiation', phase: 'core', action: 'keep', stages: EMPLOYED, why_ar: 'القطاع (عام/خاص) يفلتر مسارات حكومية بأكملها — استبعاد صارم.', impact_ar: '«حكومي» مقابل «خاص» يفتح/يغلق مسارات حكومية ومجال الخدمات الحكومية.' },
  'QB-M3B-003': { surface: 'b2c', layer21: 'domain_differentiation', phase: 'adaptive', action: 'keep', stages: [...EMPLOYED, ...FOUNDERS], why_ar: 'الاحتكاك بالجمهور يفصل مسارات التواصل/المبيعات عن الداخلية.', impact_ar: 'يغيّر أهلية مسارات الاحتكاك الخارجي.' },
  'QB-M3B-010': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: EMPLOYED, why_ar: 'إدارة أصحاب المصلحة مهارة دالة على جاهزية القيادة والمشاريع.', impact_ar: 'تقيس مهارة متطلبة لمسارات القيادة — تغيّر الفجوة المقيسة.' },
  'QB-M3B-011': { surface: 'b2c', layer21: 'domain_differentiation', phase: 'adaptive', action: 'keep', stages: EMPLOYED, why_ar: 'التخصص الوظيفي (مشتريات/مالية/تسويق…) يربط المجال بالوظيفة الفعلية.', impact_ar: 'كل وظيفة ترفع مجالها — تغيّر ترتيب المسارات.' },
  'QB-M3B-012': { surface: 'b2c', layer21: 'domain_differentiation', phase: 'adaptive', action: 'keep', stages: ['early_career', 'experienced', 'trainer_ld'], why_ar: 'القيادة الفعلية (غير المعلنة في المرحلة) تفصل مسار الموظف عن المدير.', impact_ar: '«أدير أشخاصًا» يفتح مسارات القيادة ويغيّر الأهلية.' },
  'QB-M3B-013': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: EMPLOYED, why_ar: 'تحسين الإجراءات مهارة دالة لمسارات العمليات.', impact_ar: 'تغيّر الفجوة المقيسة لمسارات العمليات.' },
  'QB-M3B-014': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: EMPLOYED, why_ar: 'الحاجة للفهم المالي/الاقتصادي دليل داعم لمجال المالية.', impact_ar: 'يرفع مجال المالية عند التقارب.' },
  'QB-M3B-015': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: 'all', why_ar: 'الجاهزية لتعلم AI دليل داعم لمجال الذكاء الاصطناعي.', impact_ar: 'يرفع مجال AI عند التقارب.' },

  'QB-M3C-001': { surface: 'b2c', layer21: 'domain_differentiation', phase: 'core', action: 'rewrite', stages: 'all', why_ar: 'مرحلة المشروع تحسم «إطلاق أم نمو» — حاسمة لهدف المشروع.', impact_ar: '«فكرة» مقابل «مشروع قائم» يغيّر الهدف المحسوم والمسار.' },
  'QB-M3C-002': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: FOUNDERS, why_ar: 'وضوح العرض دليل نضج يفصل مسارات الإطلاق عن النمو.', impact_ar: 'يغيّر الترتيب بين مسارات الريادة.' },
  'QB-M3C-004': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: FOUNDERS, why_ar: 'وجود عملاء/مبيعات دليل مرحلة قاطع.', impact_ar: 'يحسم مرحلة المشروع والمسار.' },
  'QB-M3C-007': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: FOUNDERS, why_ar: 'التحدث مع العملاء دليل ممارسة يفصل عن الريادة النظرية.', impact_ar: 'يقيس مهارة اكتشاف العميل — تغيّر الفجوة.' },
  'QB-M3C-008': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: FOUNDERS, why_ar: 'إغلاق البيع مهارة دالة للمسارات التجارية.', impact_ar: 'تغيّر الفجوة المقيسة لمسارات المبيعات/النمو.' },
  'QB-M3C-009': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: FOUNDERS, why_ar: 'معرفة الأرقام دليل على النضج المالي للمشروع.', impact_ar: 'تغيّر فجوة المالية لمسارات الريادة.' },
  'QB-M3C-010': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: FOUNDERS, why_ar: 'انتظام العمليات دليل نضج تشغيلي.', impact_ar: 'تغيّر فجوة العمليات لمسارات الريادة.' },
  'QB-M3C-011': { surface: 'b2c', layer21: 'domain_differentiation', phase: 'adaptive', action: 'keep', stages: FOUNDERS, why_ar: 'العمل منفردًا أم مع فريق يفصل مسارات القيادة عن الإتقان الفردي.', impact_ar: 'يغيّر أهلية مسارات قيادة الفرق للمؤسسين.' },

  'QB-M3E-002': { surface: 'b2c', layer21: 'domain_differentiation', phase: 'adaptive', action: 'keep', stages: 'all', why_ar: 'قائمة الميول المختصرة تكتشف المجال عندما يكون الهدف والاحتياج غير محسومين.', impact_ar: 'تفتح مجالات لم تظهر من الهدف — تغيّر المرشحين.' },
  'QB-M3E-004': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: 'all', why_ar: 'التجربة العملية السابقة دليل يفصل الاستكشاف الجاد عن الفضول.', impact_ar: 'تغيّر نوع المخرج (استكشافي مقابل تطابق).' },

  'QB-M7-001': { action: 'replaced', replaced_by: Q.TIME, why_ar: 'استُبدل بسؤال الوقت الجديد (4 فئات واضحة) — القديم كرّر «7+» مرتين.', impact_ar: 'خليفته يحدد الجدوى فقط.' },
  'QB-M7-002': { surface: 'post_recommendation', action: 'move_post', why_ar: 'صيغة التعلم قيد منتج (Cohort) — لا تغيّر ماذا يتعلم.', impact_ar: 'لا أثر على المسار.' },
  'QB-M7-003': { surface: 'post_recommendation', action: 'move_post', why_ar: 'تفضيل الدفعة قيد منتج — يُستخدم في العرض لا في التوصية.', impact_ar: 'لا أثر على المسار.' },
  'QB-M7-004': { surface: 'retired_b2c', action: 'retire', why_ar: 'لغة المحتوى — الأكاديمية عربية حاليًا.', impact_ar: 'محذوف من B2C.' },
  'QB-M7-005': { surface: 'retired_b2c', action: 'retire', why_ar: 'الميزانية ليست إشارة ملاءمة أكاديمية — تعالج في العرض/الدفع.', impact_ar: 'محذوف من B2C.' },
  'QB-M7-006': { surface: 'post_recommendation', action: 'move_post', why_ar: 'الحاجة لمدرب تخصيص متابعة بعد التوصية.', impact_ar: 'لا أثر على المسار.' },
  'QB-M7-007': { surface: 'post_recommendation', action: 'move_post', why_ar: 'قبول الواجبات يخصّص الخطة بعد التوصية.', impact_ar: 'لا أثر على المسار.' },
  'QB-M7-008': { surface: 'post_recommendation', action: 'move_post', why_ar: 'وقت التعلم المفضل جدولة لاحقة.', impact_ar: 'لا أثر على المسار.' },
  'QB-M7-009': { surface: 'post_recommendation', action: 'move_post', why_ar: 'أهمية الشهادة عرض لاحق.', impact_ar: 'لا أثر على المسار.' },
  'QB-M7-010': { surface: 'post_recommendation', action: 'move_post', why_ar: 'احتياج الوصول يخصص التجربة — لا يغيّر المسار.', impact_ar: 'لا أثر على المسار.' },
  'QB-M7-011': { surface: 'post_recommendation', action: 'move_post', why_ar: 'الجهاز تخصيص تجربة.', impact_ar: 'لا أثر على المسار.' },
  'QB-M7-012': { surface: 'post_recommendation', action: 'move_post', why_ar: 'عوامل الإكمال متابعة بعد التوصية.', impact_ar: 'لا أثر على المسار.' },
  /* المرحلة 4 — قرار أكاديمي موثق: المهارات المقاسة غير المغطاة.
     لا مسار ولا قالب يعلنها حاسمة أو داعمة (diagnostic_skills)، فسؤالها في
     التدفق الأساسي يستهلك مقعدًا بلا أثر على الترتيب — تُنقل لما بعد التوصية
     حيث تخصّص خطة المتابعة لا اختيار المسار (مصفوفة القرار الأكاديمي).
     تحديث 2026-08-19: QB-M4-002 (creative_thinking) أُوقف كليًا — فحص الكود
     أثبت أن personalizationNotes لا يستهلكه إطلاقًا؛ لا يُسأل لمجرد جمع البيانات. */
  'QB-M4-002': { surface: 'retired_b2c', action: 'retire', why_ar: 'creative_thinking بلا فعل تخصيص مبرمج (لا مستهلك في personalizationNotes ولا غيره) — القياس لجمع البيانات فقط.', impact_ar: 'محذوف من B2C حتى يوجد فعل تخصيص حقيقي موثق.' },
  'QB-M4-005': { surface: 'post_recommendation', action: 'move_post', why_ar: 'digital_literacy مهارة مقاسة غير مغطاة — لا كيان يعلنها حاسمة أو داعمة، فقياسها قبل التوصية مقعد بلا أثر.', impact_ar: 'لا أثر على المسار — تُقاس بعده لتخصيص المتابعة.' },
  'QB-M4-023': { surface: 'post_recommendation', action: 'move_post', why_ar: 'learning_agility مهارة مقاسة غير مغطاة — لا كيان يعلنها حاسمة أو داعمة، فقياسها قبل التوصية مقعد بلا أثر.', impact_ar: 'لا أثر على المسار — تُقاس بعده لتخصيص المتابعة.' },
  'QB-M4-025': { surface: 'post_recommendation', action: 'move_post', why_ar: 'focus_management مهارة مقاسة غير مغطاة — لا كيان يعلنها حاسمة أو داعمة، فقياسها قبل التوصية مقعد بلا أثر.', impact_ar: 'لا أثر على المسار — تُقاس بعده لتخصيص المتابعة.' },
  /* إغلاق منطق V2.1 — تسعة أسئلة مهارية ميتة (قرار موثق): مهاراتها مقاسة لكنها
     غير معلَنة حاسمة ولا داعمة ولا مخرج تعلم لأي كيان نشط، ولم تُسأل قط في
     2000+10000 جلسة محاكاة — قياسها قبل التوصية مقعد بلا أثر. تُقاس بعده
     لتخصيص المتابعة فقط. (أُعيدت هذه القيود إلى المولد 2026-08-19 — كانت قد
     طُبقت على الناتج مباشرة، فأعاد التوليد إحياءها خطأً.) */
  'QB-M4-009': { surface: 'post_recommendation', action: 'move_post', why_ar: 'english مهارة مقاسة غير معلَنة حاسمة ولا داعمة ولا مخرج تعلم لأي كيان نشط (فحص إغلاق منطق V2.1 — 2000+10000 جلسة بلا سؤال واحد) — قياسها قبل التوصية مقعد بلا أثر.', impact_ar: 'لا أثر على المسار — تُقاس بعده لتخصيص المتابعة.' },
  'QB-M4-014': { surface: 'post_recommendation', action: 'move_post', why_ar: 'financial_literacy مهارة مقاسة غير معلَنة حاسمة ولا داعمة ولا مخرج تعلم لأي كيان نشط (فحص إغلاق منطق V2.1 — 2000+10000 جلسة بلا سؤال واحد) — قياسها قبل التوصية مقعد بلا أثر.', impact_ar: 'لا أثر على المسار — تُقاس بعده لتخصيص المتابعة.' },
  'QB-M4-015': { surface: 'post_recommendation', action: 'move_post', why_ar: 'economics_basics مهارة مقاسة غير معلَنة حاسمة ولا داعمة ولا مخرج تعلم لأي كيان نشط (فحص إغلاق منطق V2.1 — 2000+10000 جلسة بلا سؤال واحد) — قياسها قبل التوصية مقعد بلا أثر.', impact_ar: 'لا أثر على المسار — تُقاس بعده لتخصيص المتابعة.' },
  'QB-M4-019': { surface: 'post_recommendation', action: 'move_post', why_ar: 'leadership_influence مهارة مقاسة غير معلَنة حاسمة ولا داعمة ولا مخرج تعلم لأي كيان نشط (فحص إغلاق منطق V2.1 — 2000+10000 جلسة بلا سؤال واحد) — قياسها قبل التوصية مقعد بلا أثر.', impact_ar: 'لا أثر على المسار — تُقاس بعده لتخصيص المتابعة.' },
  'QB-M4-020': { surface: 'post_recommendation', action: 'move_post', why_ar: 'emotional_intelligence مهارة مقاسة غير معلَنة حاسمة ولا داعمة ولا مخرج تعلم لأي كيان نشط (فحص إغلاق منطق V2.1 — 2000+10000 جلسة بلا سؤال واحد) — قياسها قبل التوصية مقعد بلا أثر.', impact_ar: 'لا أثر على المسار — تُقاس بعده لتخصيص المتابعة.' },
  'QB-M4-021': { surface: 'post_recommendation', action: 'move_post', why_ar: 'problem_solving مهارة مقاسة غير معلَنة حاسمة ولا داعمة ولا مخرج تعلم لأي كيان نشط (فحص إغلاق منطق V2.1 — 2000+10000 جلسة بلا سؤال واحد) — قياسها قبل التوصية مقعد بلا أثر.', impact_ar: 'لا أثر على المسار — تُقاس بعده لتخصيص المتابعة.' },
  'QB-M4-022': { surface: 'post_recommendation', action: 'move_post', why_ar: 'research_learning مهارة مقاسة غير معلَنة حاسمة ولا داعمة ولا مخرج تعلم لأي كيان نشط (فحص إغلاق منطق V2.1 — 2000+10000 جلسة بلا سؤال واحد) — قياسها قبل التوصية مقعد بلا أثر.', impact_ar: 'لا أثر على المسار — تُقاس بعده لتخصيص المتابعة.' },
  'QB-M4-024': { surface: 'post_recommendation', action: 'move_post', why_ar: 'time_energy_management مهارة مقاسة غير معلَنة حاسمة ولا داعمة ولا مخرج تعلم لأي كيان نشط (فحص إغلاق منطق V2.1 — 2000+10000 جلسة بلا سؤال واحد) — قياسها قبل التوصية مقعد بلا أثر.', impact_ar: 'لا أثر على المسار — تُقاس بعده لتخصيص المتابعة.' },
  'QB-M4-026': { surface: 'post_recommendation', action: 'move_post', why_ar: 'entrepreneurship_basics مهارة مقاسة غير معلَنة حاسمة ولا داعمة ولا مخرج تعلم لأي كيان نشط (فحص إغلاق منطق V2.1 — 2000+10000 جلسة بلا سؤال واحد) — قياسها قبل التوصية مقعد بلا أثر.', impact_ar: 'لا أثر على المسار — تُقاس بعده لتخصيص المتابعة.' },
}
/* قاعدة «الجملة الحاسمة»: لا سبب واضح = مرشح تقاعد */
export function keepSentence(p: PlanEntry): string | null {
  if (p.surface !== 'b2c') return null
  if (p.impact_ar && !p.impact_ar.startsWith('لا أثر') && !p.impact_ar.startsWith('خارج')) {
    return `هذا السؤال موجود لأن إجابة مقابل أخرى تغيّر: ${p.impact_ar.replace(/\.$/, '')}.`
  }
  return null
}
/** خطة كل سؤال — تُبنى من الأسئلة في المصدر، لا من ملف ثابت */
export function buildQuestionPlan(src: OverlaySource): { plan: Record<string, PlanEntry>; retiredNoReason: string[] } {
  const plan: Record<string, PlanEntry> = {}
  const retiredNoReason: string[] = []
  for (const q of src.questions) {
    const mod = q.module_id
    const base = moduleDefault[mod]
    let entry: PlanEntry
    if (base) {
      entry = {
        ...base,
        domains: [],
        impact_ar: base.action === 'keep' ? (q.decision_impact ?? '') : base.why_ar,
        measures: q.measures ?? [],
      } as PlanEntry
    } else if (mod === 'M4') {
      entry = {
        surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'rewrite', stages: 'all',
        domains: [], impact_ar: `يقيس مهارة «${(q.measures ?? [])[0]}» بمقياس الدليل — تغيّر الفجوة المقيسة والثقة لكل مسار يتطلبها.`,
        why_ar: 'سؤال دليل مهاري — يُطرح فقط عندما تكون المهارة متطلبة لمرشح متصدر وقادرة على تغيير الترتيب.',
        measures: q.measures ?? [],
      }
    } else {
      /* أي سؤال M1/M2/M3 لم يُستعرض صراحة في V2.1 = مرشح تقاعد —
         الإبقاء استثناء موثق لا افتراض (§14/§15: الاستخدام الكثيف ≠ قيمة قرارية) */
      entry = {
        surface: 'retired_b2c',
        layer21: null,
        phase: 'none',
        action: 'retire',
        stages: [],
        domains: [],
        impact_ar: q.decision_impact || 'لا أثر قراري موثق.',
        why_ar: 'لم يُستعرض صراحة في V2.1 — سؤال بلا أثر قراري موثق يصبح مرشح تقاعد.',
        measures: q.measures ?? [],
      }
    }
    const ov = overrides[q.question_id]
    if (ov) entry = { ...entry, ...ov } as PlanEntry
    /* سؤال متقاعد في البنك (active:false) لا يصل المتعلم أبدًا — catalog.ts يرشّحه
       خارج السطح. فلو بقيت الخطة تصفه active_b2c لناقضت التشغيل الفعلي. */
    if (q.active === false) {
      entry = {
        ...entry,
        surface: 'retired_b2c', layer21: null, phase: 'none', action: 'retire', stages: [],
        why_ar: q.retired_reason_ar ?? entry.why_ar,
        impact_ar: 'لا أثر — متقاعد من البنك.',
      }
    }
    /* سؤال B2C نشط بلا جملة حاسمة = تقاعد إجباري */
    if (entry.surface === 'b2c' && entry.action !== 'replaced' && !keepSentence(entry)) {
      entry = {
        ...entry,
        surface: 'retired_b2c', layer21: null, phase: 'none', action: 'retire', stages: [],
        why_ar: `${entry.why_ar} — سقطت قاعدة الجملة الحاسمة.`,
      }
      retiredNoReason.push(q.question_id)
    }
    plan[q.question_id] = entry
  }

  /* الأسئلة الجديدة في الخطة */
  const newPlan: Record<string, PlanEntry> = {
    [Q.STAGE]: { surface: 'b2c', layer21: 'orientation', phase: 'core', action: 'keep', stages: 'all', domains: [], impact_ar: 'يحدد المرحلة المهنية ويفلتر الأهداف والاحتياجات والأهلية.', why_ar: 'أول حقيقة حاسمة — كل جلسة تبدأ هنا.', measures: ['career_stage'] },
    [Q.EMPLOYMENT]: { surface: 'b2c', layer21: 'orientation', phase: 'core', action: 'keep', stages: 'all', domains: [], impact_ar: 'يفصل أول وظيفة عن ترقية ويضبط واقعية التوصية.', why_ar: 'حالة العمل منفصلة عن المرحلة — تُسأل عند الحاجة فقط.', measures: ['employment_state'] },
    [Q.GOAL]: { surface: 'b2c', layer21: 'goal_need', phase: 'core', action: 'keep', stages: 'all', domains: [], impact_ar: 'يحدد فضاء المشكلة بخيارات مفلترة حسب المرحلة.', why_ar: 'الهدف قبل المجال قبل المسار.', measures: ['primary_goal'] },
    [Q.NEED]: { surface: 'b2c', layer21: 'goal_need', phase: 'core', action: 'keep', stages: 'all', domains: NEEDS_V21.flatMap((n) => n.domains), impact_ar: 'يكتشف المجال — محرك التمييز الرئيس بين المسارات والقوالب.', why_ar: 'الاحتياج الحقيقي لا اسم المسار.', measures: ['need_id'] },
    [Q.TIME]: { surface: 'b2c', layer21: 'feasibility', phase: 'core', action: 'keep', stages: 'all', domains: [], impact_ar: 'يحدد الجدوى وطول الخطة فقط.', why_ar: 'إشارة جدوى حقيقية.', measures: ['weekly_load'] },
    [Q.MASTERY]: { surface: 'b2c', layer21: 'confirmation_deep', phase: 'confirmation', action: 'keep', stages: 'all', domains: [], impact_ar: 'يفصل قياسيًا عن مركبًا عند الغموض.', why_ar: 'لا يُسأل إلا عند غموض فعلي.', measures: ['mastery_portfolio_pref'] },
  }
  Object.assign(plan, newPlan)

  /* ختم الحالة النهائية على كل سؤال — اشتقاق حتمي واحد، كل سؤال يُحسب مرة واحدة */
  for (const [id, p] of Object.entries(plan)) {
    p.final_status = finalStatusOf(p.surface, p.phase, p.action)
    void id
  }
  return { plan, retiredNoReason }
}
