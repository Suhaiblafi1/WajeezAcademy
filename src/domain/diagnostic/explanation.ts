/* توليد الشرح العربي للتوصية — من بيانات المحرك فقط */

import { launchPathways, pathwaySkills } from './catalog'
import type { ConfidenceBreakdown, PathwayCandidate, Recommendation } from './types'

const GOAL_AR: Record<string, string> = {
  first_job: 'الحصول على أول وظيفة',
  promotion: 'ترقية أو تطور وظيفي',
  business_launch: 'إطلاق مشروع',
  first_customer: 'الوصول لأول عميل',
  revenue_growth: 'نمو الإيرادات',
  career_direction: 'تحديد اتجاه مهني',
  personal_growth: 'تطور شخصي وثقافة عامة',
  family_wellbeing: 'أسرة ورفاه',
  lead_team: 'قيادة فريق',
  operational_improvement: 'تحسين تشغيلي',
  digital_transformation: 'تحول رقمي',
  financial_decision: 'قرار مالي أوضح',
  personal_brand: 'علامة شخصية',
  reduce_cyber_risk: 'خفض المخاطر السيبرانية',
  supply_chain_resilience: 'مرونة سلسلة الإمداد',
  design_training: 'تصميم تدريب',
  execute_strategy: 'تنفيذ الاستراتيجية',
  product_launch: 'إطلاق منتج',
  improve_customer_experience: 'تحسين تجربة المستفيد',
  launch_service_business: 'إطلاق عمل خدمي',
  explore: 'استكشاف الاتجاه',
}

const SKILL_FALLBACK_AR: Record<string, string> = {}

export function goalLabel(code: string | undefined): string {
  if (!code) return 'هدفك'
  return GOAL_AR[code] ?? SKILL_FALLBACK_AR[code] ?? code
}

export function skillLabel(slug: string, pathwayId?: string): string {
  if (pathwayId) {
    const found = pathwaySkills(pathwayId).find((s) => s.slug === slug)
    if (found) return found.nameAr
  }
  for (const p of launchPathways) {
    const found = pathwaySkills(p.id).find((s) => s.slug === slug)
    if (found) return found.nameAr
  }
  return slug.replace(/_/g, ' ')
}

export function buildReasons(
  primary: PathwayCandidate,
  confidence: ConfidenceBreakdown,
  facts: Record<string, { value: unknown }>,
): string[] {
  const p = launchPathways.find((x) => x.id === primary.pathwayId)
  const reasons: string[] = []
  const goal = facts['primary_goal']?.value as string | undefined
  if (goal) reasons.push(`هدفك: ${goalLabel(goal)} — والمسار صمم لهذا التحول تحديدا.`)
  reasons.push(...primary.fit.reasons_ar.slice(0, 3))
  if (primary.gapSkillSlugs.length > 0) {
    reasons.push(
      `فجواتك المهارية التي سيعالجها: ${primary.gapSkillSlugs
        .slice(0, 4)
        .map((s) => skillLabel(s, primary.pathwayId))
        .join('، ')}.`,
    )
  }
  if (p?.after) reasons.push(`النتيجة المتوقعة: ${p.after}`)
  reasons.push(`درجة الثقة ${(confidence.total * 100).toFixed(0)}٪ (${confidence.band_ar}) — مبنية على تغطية الحقائق واتساق إجاباتك وفصل المرشحين.`)
  return reasons
}

export function buildChangeMakers(rec: Omit<Recommendation, 'change_makers_ar'>): string[] {
  const makers: string[] = []
  if (rec.confidence.coverage < 0.75) makers.push('إجابات عن سياقك وهدفك ووقتك سترفع دقة التوصية.')
  if (rec.confidence.consistency < 0.8) makers.push('حسم التناقضات في الإجابات قد يغير الترتيب.')
  if (rec.confidence.separation < 0.7) makers.push('سؤال فاصل واحد قد يقلب المسار الأول مع الثاني.')
  if (rec.primaryPathway && rec.primaryPathway.masteredSkillSlugs.length > 0)
    makers.push('إثبات إتقانك لمهارات المسار قد يقصر خطتك.')
  if (makers.length === 0) makers.push('النتيجة مستقرة؛ تغييرها يتطلب تغيير هدفك أو وقتك أو أدلة مهاراتك.')
  return makers
}
