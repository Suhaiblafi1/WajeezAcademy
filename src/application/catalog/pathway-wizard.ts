/* ج-٣ · مفردات معالج إضافة المسار ومنطق خطواته — نقي وقابل للاختبار.

   المشكلة التي يحلها المعالج: إضافة مسار تتطلب خمسة مواضع، ونقصُ واحدٍ ينتج
   «جوكرا»: كيانا بلا جمهور ينافس كل مستخدم، أو كيانا بلا مجال يُنشر ولا يُوصى
   به أبدا. النموذج المسطّح كان يقبل النقص ثم يظهر العطل بعد أسابيع في تدقيق.

   قاعدة الخطوات هنا: **لا تتقدّم خطوة إلا باكتمال ما يمنع الترشيح.** والحدّ
   بين «يمنع» و«ينقص» مقصود: الشخصيات والأهداف والمجال والدورات تمنع، وملاحظة
   المؤلّف ووقت الأسبوع لا تمنعان. */

import { GOALS_V21 } from '../../domain/diagnostic/v2_1/maps'
import { PERSONA_BASE_TO_STAGES, REACHABLE_LEGACY_GOALS } from '../../domain/diagnostic/v2_1/universe'

/** الشخصيات الأساسية بأسمائها العربية — نفس مفاتيح PERSONA_BASE_TO_STAGES */
export const PERSONA_LABELS_AR: Record<string, string> = {
  student: 'طالب',
  early_career: 'خريج حديث / بداية المسار',
  employee: 'موظف',
  manager: 'مدير / قائد فريق',
  founder: 'مؤسس / صاحب عمل',
  freelancer: 'مستقل',
  trainer: 'مدرب / مختص تعلم وتطوير',
}

export interface PersonaOption {
  key: string
  labelAr: string
  /** المراحل المهنية التي تفتحها هذه الشخصية — يراها المؤلّف قبل الاختيار */
  stages: string[]
}

export function personaOptions(): PersonaOption[] {
  return Object.entries(PERSONA_BASE_TO_STAGES).map(([key, stages]) => ({
    key,
    labelAr: PERSONA_LABELS_AR[key] ?? key,
    stages: [...stages],
  }))
}

export interface GoalOption {
  /** رمز الهدف القديم — هو ما يُخزَّن في الملف التشخيصي */
  legacy: string
  labelAr: string
  /** هل يستطيع تدفق B2C إنتاج هذا الهدف؟ غير القابل للوصول يُختار ويُنبَّه عليه */
  reachable: boolean
}

/** الأهداف المعروضة: مشتقة من GOALS_V21 لا مكتوبة يدويا — فلا تتقادم مع المحرك.
    الرموز المكرّرة تُدمج (أكثر من هدف V2.1 يشير لرمز قديم واحد). */
export function goalOptions(): GoalOption[] {
  const byLegacy = new Map<string, GoalOption>()
  for (const g of GOALS_V21) {
    if (byLegacy.has(g.legacy_goal)) continue
    byLegacy.set(g.legacy_goal, {
      legacy: g.legacy_goal,
      labelAr: g.label_ar,
      reachable: REACHABLE_LEGACY_GOALS.has(g.legacy_goal),
    })
  }
  return [...byLegacy.values()].sort((a, b) => a.labelAr.localeCompare(b.labelAr, 'ar'))
}

/* ─── منطق الخطوات ─── */

export type WizardStepKey = 'basics' | 'courses' | 'profile' | 'domains' | 'review'

export const WIZARD_STEPS: { key: WizardStepKey; labelAr: string; hintAr: string }[] = [
  { key: 'basics', labelAr: 'بيانات المسار', hintAr: 'عنوان وجمهور وتحوّل قبل/بعد' },
  { key: 'courses', labelAr: 'الدورات', hintAr: 'من الكتالوج بالترتيب' },
  { key: 'profile', labelAr: 'الجمهور والهدف', hintAr: 'إلزامي — الفراغ يطابق الجميع' },
  { key: 'domains', labelAr: 'المجال', hintAr: 'إلزامي — باب الدخول للتوصية' },
  { key: 'review', labelAr: 'الأثر والمراجعة', hintAr: 'الأثر التشخيصي قبل التقديم' },
]

export interface WizardDraft {
  id: string
  title: string
  audience: string
  beforeText: string
  afterText: string
  shortTitle: string
  durationWeeks: string
  weeklyHours: string
  level: string
  capstone: string
  courseIds: string[]
  personas: string[]
  goals: string[]
  domainIds: string[]
  minWeeklyLoad: string
  notesAr: string
}

export const EMPTY_DRAFT: WizardDraft = {
  id: '', title: '', audience: '', beforeText: '', afterText: '', shortTitle: '',
  durationWeeks: '', weeklyHours: '', level: '', capstone: '',
  courseIds: [], personas: [], goals: [], domainIds: [], minWeeklyLoad: '', notesAr: '',
}

/** ما يمنع الانتقال من الخطوة — قائمة فارغة تعني «امضِ». */
export function blockersOf(step: WizardStepKey, d: WizardDraft): string[] {
  switch (step) {
    case 'basics': {
      const out: string[] = []
      if (!/^PW-[A-Z0-9-]+$/.test(d.id.trim())) out.push('المعرف بصيغة PW-XXX-000')
      if (d.title.trim().length < 3) out.push('عنوان المسار (٣ أحرف على الأقل)')
      if (d.audience.trim().length < 10) out.push('الجمهور المستهدف بجملة مفهومة — «لمن هذا المسار؟»')
      if (d.beforeText.trim().length < 10) out.push('الحال قبل المسار')
      if (d.afterText.trim().length < 10) out.push('الحال بعد المسار — بلا التحوّل لا يعرف المتعلم ما يشتريه')
      return out
    }
    case 'courses':
      return d.courseIds.length === 0 ? ['دورة واحدة على الأقل — المسار وعدٌ بلا محتوى'] : []
    case 'profile': {
      const out: string[] = []
      if (d.personas.length === 0) out.push('شخصية واحدة على الأقل — الفراغ يجعل المسار يطابق كل شخصية')
      if (d.goals.length === 0) out.push('هدف واحد على الأقل — الفراغ يجعله يطابق كل هدف')
      return out
    }
    case 'domains':
      return d.domainIds.length === 0
        ? ['مجال واحد على الأقل — بلا مجال لا يدخل مطابقة احتياج المستخدم إطلاقا']
        : []
    case 'review':
      return []
  }
}

/** الأهداف المختارة التي لا يستطيع تدفق B2C إنتاجها — تُنبَّه ولا تمنع */
export function unreachableGoals(d: WizardDraft): string[] {
  return d.goals.filter((g) => !REACHABLE_LEGACY_GOALS.has(g))
}

/** المراحل المهنية التي يفتحها اختيار الشخصيات — أثر الاختيار مكتوب لا مخفي */
export function stagesOf(personas: string[]): string[] {
  return [...new Set(personas.flatMap((p) => PERSONA_BASE_TO_STAGES[p] ?? []))].sort()
}
