/* طبقة المجالات: الهدف يحدد فضاء المشكلة أولًا، لا المسار.
   لا توصية نهائية قبل Domain Confidence كافية؛ التردد بين مجالين = سؤال فاصل. */

import type { FactBag } from '../types'
import { domainsOfPathway, functionDomainsV2, goalDomainsV2 } from './data'
import type { DomainAssessment, DomainId } from './types'

/* أوزان الأدلة على المجال — موثقة وقابلة للمراجعة */
const W_GOAL = 1.0
const W_FUNCTION = 0.35
const W_SECTOR_GOV = 0.3

/** عتبة وضوح المجال — دونها لا يُحسم اتجاه ولا تُفلتر مسارات بالمجال */
export const DOMAIN_CONFIDENCE_MIN = 0.55
/** فارق التقارب بين مجالين متصدرين — دونه يُطلب سؤال فاصل */
export const DOMAIN_CONTEST_MARGIN = 0.15

export function assessDomains(facts: FactBag): DomainAssessment {
  const scores: Partial<Record<DomainId, number>> = {}
  const add = (id: DomainId, w: number) => {
    scores[id] = (scores[id] ?? 0) + w
  }

  const goal = facts['primary_goal']?.value as string | undefined
  if (goal) {
    const ds = goalDomainsV2[goal] ?? []
    const w = ds.length > 0 ? W_GOAL / ds.length : 0
    ds.forEach((d) => add(d, w))
  }

  const fns = facts['function_specialization']?.value
  const fnList = Array.isArray(fns) ? (fns as string[]) : typeof fns === 'string' ? [fns] : []
  for (const f of fnList) {
    const ds = functionDomainsV2[f] ?? []
    const w = ds.length > 0 ? W_FUNCTION / ds.length : 0
    ds.forEach((d) => add(d, w))
  }

  if (facts['sector']?.value === 'public') add('gov_services', W_SECTOR_GOV)

  const ranked = (Object.entries(scores) as [DomainId, number][])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id]) => id)

  const top = ranked[0] ?? null
  const topScore = top ? scores[top]! : 0
  const second = ranked[1] ?? null
  const secondScore = second ? scores[second]! : 0

  /* الثقة: نسبة هيمنة المتصدر — هدف أحادي المجال بلا أدلة منافسة = 1 */
  const confidence = !goal || topScore === 0 ? 0 : topScore / (topScore + secondScore + 1e-9)
  const contested: [DomainId, DomainId] | null =
    top && second && topScore - secondScore < DOMAIN_CONTEST_MARGIN && secondScore > 0
      ? [top, second]
      : null

  return { scores, ranked, top, confidence, contested }
}

/** هل يتقاطع المسار مع المجالات النشطة؟ — يُستخدم للفلترة الصارمة بعد وضوح المجال فقط */
export function pathwayInActiveDomains(pathwayId: string, activeDomains: DomainId[]): boolean {
  if (activeDomains.length === 0) return true
  return domainsOfPathway(pathwayId).some((d) => activeDomains.includes(d))
}
