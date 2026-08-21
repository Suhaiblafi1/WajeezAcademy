/* طبقة قراءة سجل المراجع — لا يظهر للعميل إلا المطبق فعلا بدليل */

import registry from './methodology-references.v1.json'

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

/** تثبيت سجل المراجع القادم من API — المحتويات تُستبدل في مكانها */
export function installMethodologyRegistry(next: MethodologyReference[]): void {
  all.splice(0, all.length, ...next)
}

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

/* sessionContributingReferences نُقلت إلى methodology-session.ts —
   كانت تجرّ الكتالوج كاملا إلى حزمة الدخول (البند ع-١). */

/** مراجع تصميم الدورات (تظهر في سياق الدورة لا في حساب الجلسة) */
export function courseDesignReferences(): MethodologyReference[] {
  return publicReferences().filter((r) => ['REF-BACKWARD-DESIGN', 'REF-BLOOM'].includes(r.id))
}
