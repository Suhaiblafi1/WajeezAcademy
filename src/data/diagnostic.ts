/* عقود واجهة التشخيص — الأنواع والتسميات التي تشترك فيها الصفحات.
   منطق المحرك الحي كله في src/domain/diagnostic — لا يعاش محركان. */

import type { Pathway } from './pathways'

export type Dim = 'persona' | 'goal' | 'branch' | 'skills' | 'interest'
type Answers = Record<string, string>

export interface DiagOption {
  label: string
  value: string
  /** معرف الخيار الثابت (o1..on) — يُسجَّل مع الإجابة ليكون القرار مستقلا عن نص الخيار */
  optionId?: string
}

export type Trigger =
  | 'always'
  | 'goal_unclear'      // الهدف مجاب لكن الوضوح متوسط/غامض
  | 'goal_changed'      // إجابة التأكيد غيّرت الهدف → استنكاري
  | 'urgent_ambitious'  // طموح كبير + موعد قريب → سؤال الواقعية
  | 'close_margin'      // المساران المتصدران متقاربان → كسر تعادل
  | 'uncertainty'       // علم الغموض العام → تعميق
  | 'uns_none'          // «كلها تبدو متشابهة» → تعميق الاستكشاف

export interface DiagQuestion {
  id: string
  module: string
  moduleLabel: string
  text: string | ((a: Answers) => string)
  hint?: string | ((a: Answers) => string)
  /** المرجع العلمي الذي بُني عليه السؤال — يظهر للمستخدم */
  source?: string
  type: 'single' | 'multi' | 'text' | 'ratings'
  options?: DiagOption[] | ((a: Answers) => DiagOption[])
  /** لأسئلة التقييم الجماعي: مهارات تُقيَّم كلها في سؤال واحد من 1 إلى 5 */
  items?: { key: string; label: string }[]
  maxSelect?: number
  measures: Dim[]
  weight: number
  level: 'core' | 'deep' | 'conditional' | 'optional'
  trigger?: Trigger
}

export const GOAL_LABELS: Record<string, string> = {
  job: 'وظيفة أولى أو ترقية',
  project: 'إطلاق مشروع أو دخل إضافي',
  change: 'تغيير مسارك المهني بالكامل',
  skill: 'إتقان مهارة محددة تحتاجها الآن',
  performance: 'تحسين أدائك في وظيفتك الحالية',
  family: 'هدف أسري أو تركيز ورفاه',
}

export const GAP_LABELS: Record<string, string> = {
  data: 'التعامل مع البيانات والجداول',
  writing: 'الكتابة المهنية والتقارير',
  communication: 'التواصل والعرض',
  projects: 'تنظيم المشاريع والمتابعة',
  ai: 'استخدام أدوات الذكاء الاصطناعي',
}

/** ما يعيق الموظف في يومه → مقابله في خريطة المهارات (يُستبعد من سؤال المهارات ويُدمج في الفجوات) */
export const OBSTACLE_TO_GAP: Record<string, string> = {
  writing: 'writing',
  data: 'data',
  digital_ai: 'ai',
  projects: 'projects',
  communication: 'communication',
}

export interface GapDetail {
  skill: string
  current: string
  target: string
  priority: 'عالية' | 'متوسطة'
  coveredBy: string[]
}

export interface DiagResult {
  /** المسار الأعلى — null عندما لا كيان مفروضًا (اتجاه استكشافي / إحالة مستشار بلا مرشح) */
  top: Pathway | null
  faster: Pathway | null
  cheaper: { p: Pathway; courseCount: number } | null
  confidence: number
  confidenceBand: string
  needsAdvisor: boolean
  reasons: string[]
  gaps: string[]
  gapDetails: GapDetail[]
  unavailableSkills: string[]
  priorOverlap: string[]
  changeMakers: string[]
  reconciled: boolean
  secondGoal: string | null
  resultJson: Record<string, unknown>
}
