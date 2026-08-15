/* طبقة قراءة سجل المراجع — لا يظهر للعميل إلا المطبق فعلا بدليل */

import registry from './methodology-references.v1.json'
import { skillsCatalog } from '../domain/diagnostic/catalog'

export interface MethodologyReference {
  id: string
  name_ar: string
  name_en: string
  organization: string
  source_url: string
  category: string
  purpose_ar: string
  customer_benefit_ar: string
  implementation_status: 'implemented' | 'partial' | 'planned'
  implementation_evidence: string
  limitations_ar: string
  last_reviewed_at: string
  public_visibility: boolean
}

const all = (registry as unknown as { references: MethodologyReference[] }).references

/** المراجع الظاهرة للعميل: مطبقة + دليل حقيقي + ظهور عام */
export function publicReferences(): MethodologyReference[] {
  return all.filter(
    (r) => r.implementation_status === 'implemented' && r.implementation_evidence.length > 0 && r.public_visibility,
  )
}

/** الشارات النصية المختصرة للصفحة الرئيسية */
export function referenceBadges(): string[] {
  const order = ['REF-ONET-CM', 'REF-RIASEC-ONET-IP', 'REF-ESCO', 'REF-DIGCOMP', 'REF-ECD']
  const short: Record<string, string> = {
    'REF-ONET-CM': 'O*NET',
    'REF-RIASEC-ONET-IP': 'RIASEC',
    'REF-ESCO': 'ESCO',
    'REF-DIGCOMP': 'DigComp',
    'REF-ECD': 'ECD',
  }
  const pub = new Set(publicReferences().map((r) => r.id))
  return order.filter((id) => pub.has(id)).map((id) => short[id])
}

/** المراجع التي ساهمت فعليا في جلسة تشخيص بعينها — لا يُعرض مرجع لم يسهم */
export function sessionContributingReferences(session: {
  interestVector: Record<string, number>
  skillVector: Record<string, number>
  hasTrace: boolean
}): MethodologyReference[] {
  const pub = new Map(publicReferences().map((r) => [r.id, r]))
  const out: MethodologyReference[] = []

  // RIASEC: أسئلة الميول غذّت متجه الاهتمامات
  if (Object.keys(session.interestVector).length > 0) {
    const r = pub.get('REF-RIASEC-ONET-IP')
    if (r) out.push(r)
  }
  // O*NET وESCO: مهارات موسومة بهما دخلت متجه المهارات
  const measuredSlugs = new Set(Object.keys(session.skillVector))
  let onet = false
  let esco = false
  let digcomp = false
  for (const s of skillsCatalog) {
    if (!measuredSlugs.has(s.slug)) continue
    const fws = (s as { source_frameworks?: string[] }).source_frameworks ?? []
    if (fws.includes('O*NET')) onet = true
    if (fws.includes('ESCO')) esco = true
    if (fws.includes('DigComp 2.2')) digcomp = true
  }
  if (onet) { const r = pub.get('REF-ONET-CM'); if (r) out.push(r) }
  if (esco) { const r = pub.get('REF-ESCO'); if (r) out.push(r) }
  if (digcomp) { const r = pub.get('REF-DIGCOMP'); if (r) out.push(r) }
  // ECD: أثر القرار نفسه تطبيق له — كل استنتاج مربوط بدليله
  if (session.hasTrace) {
    const r = pub.get('REF-ECD')
    if (r) out.push(r)
  }
  return out
}

/** مراجع تصميم الدورات (تظهر في سياق الدورة لا في حساب الجلسة) */
export function courseDesignReferences(): MethodologyReference[] {
  return publicReferences().filter((r) => ['REF-BACKWARD-DESIGN', 'REF-BLOOM'].includes(r.id))
}
