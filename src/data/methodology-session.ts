/* مراجع جلسة التشخيص — فُصلت عن `methodology.ts` عمدا.
   السبب (البند ع-١): هذه الدالة وحدها تحتاج `skillsCatalog`، وهو يجرّ محمّل
   الكتالوج كاملا (~2.2 ميغابايت من JSON). و`methodology.ts` يستورده
   `public-content.ts` الذي تستورده الصفحة الرئيسية — فكان الكتالوج كله يهبط
   في حزمة الدخول ويُحمَّل على كل زائر قبل أول بكسل.

   بعد الفصل: مستورد هذه الوحدة الوحيد هو صفحة التشخيص، وهي مسار كسول
   (React.lazy) بحزمته الخاصة — فلا يحمّل الكتالوج إلا من يفتح التشخيص فعلا. */

import { skillsCatalog } from '../domain/diagnostic/catalog'
import { publicReferences, type MethodologyReference } from './methodology'

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
