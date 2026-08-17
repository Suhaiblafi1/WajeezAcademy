/* نموذج المهارات V2 — إلغاء صارم لقاعدة «المجهول = 2.5».
   مهارة غير مقاسة = SkillState unknown: لا ترفع ولا تخفض، لا فجوة، لا mastered،
   ولا تدخل التفسير. measuredSkillCoverage يدخل في الثقة.
   ممنوع: Skill Gap قوي مع أغلب مهارات غير مقاسة. */

import { pathwaySkills } from '../catalog'
import { layersOfSkill } from './data'
import type { SkillState } from './types'

export const TARGET_LEVEL = 4

/** يبني حالات المهارات من متجه القياس — ما لم يُقس يبقى مجهولًا صراحة */
export function buildSkillStates(skillVector: Record<string, number>): Map<string, SkillState> {
  const map = new Map<string, SkillState>()
  for (const [slug, level] of Object.entries(skillVector)) {
    map.set(slug, { slug, state: 'measured', level })
  }
  return map
}

export interface PathwaySkillAssessment {
  /** متطلبات المسار كاملة */
  required: { slug: string; nameAr: string }[]
  /** مقاسة فعلًا */
  measured: { slug: string; nameAr: string; level: number }[]
  /** متطلبة لكنها غير مقاسة — تُعرض كمجهولة، لا تُفترض */
  unknown: { slug: string; nameAr: string }[]
  /** مقاسة دون المستوى المستهدف */
  gap: { slug: string; nameAr: string; level: number }[]
  /** مقاسة بمستوى إتقان */
  mastered: { slug: string; nameAr: string; level: number }[]
  /** measuredRequired / required — 0 إن لم يُقس شيء، 1 إن لم يتطلب المسار مهارات */
  measuredCoverage: number
  /** متوسط الفجوة على المقاس فقط — null إن لم تُقس أي مهارة */
  gapScore: number | null
}

export function assessPathwaySkills(
  pathwayId: string,
  skillStates: Map<string, SkillState>,
): PathwaySkillAssessment {
  const required = pathwaySkills(pathwayId).filter((s) => {
    /* مهارة موقفة أكاديميًا (غير نشطة) لا تُحسب متطلبًا حتى تُحسم مراجعتها */
    const meta = layersOfSkill(s.slug)
    return meta === undefined || meta.active
  })
  const measured: PathwaySkillAssessment['measured'] = []
  const unknown: PathwaySkillAssessment['unknown'] = []
  const gap: PathwaySkillAssessment['gap'] = []
  const mastered: PathwaySkillAssessment['mastered'] = []

  for (const s of required) {
    const st = skillStates.get(s.slug)
    if (st?.state === 'measured' && st.level !== undefined) {
      measured.push({ ...s, level: st.level })
      if (st.level < 3) gap.push({ ...s, level: st.level })
      else if (st.level >= TARGET_LEVEL) mastered.push({ ...s, level: st.level })
    } else {
      unknown.push(s)
    }
  }

  const measuredCoverage = required.length === 0 ? 1 : measured.length / required.length
  let gapScore: number | null = null
  if (measured.length > 0) {
    let sum = 0
    for (const m of measured) sum += Math.max(0, TARGET_LEVEL - m.level) / TARGET_LEVEL
    gapScore = sum / measured.length
  }

  return { required, measured, unknown, gap, mastered, measuredCoverage, gapScore }
}

/** ملاحظات التخصيص من المهارات الأربع المقاسة غير المغطاة — أثرها موثق ومحدود */
export function personalizationNotes(
  skillStates: Map<string, SkillState>,
  topPathwayDomains: string[],
): string[] {
  const notes: string[] = []
  const digital = skillStates.get('digital_literacy')
  const digitalDomains = ['ai_productivity', 'data_decision', 'product_mgmt', 'cyber_risk']
  if (digital?.state === 'measured' && digital.level !== undefined && digital.level <= 2) {
    if (topPathwayDomains.some((d) => digitalDomains.includes(d))) {
      notes.push('جاهزيتك الرقمية منخفضة نسبيًا — خطتك تبدأ بتمهيد رقمي قبل الغوص في الأدوات.')
    }
  }
  const focus = skillStates.get('focus_management')
  if (focus?.state === 'measured' && focus.level !== undefined && focus.level <= 2) {
    notes.push('إدارة التركيز تحتاج دعمًا — قسّمنا العبء الأسبوعي إلى وحدات أقصر.')
  }
  const agility = skillStates.get('learning_agility')
  if (agility?.state === 'measured' && agility.level !== undefined && agility.level >= 4) {
    notes.push('مرونة تعلمك عالية — يمكنك رفع وتيرة الخطة إن رغبت.')
  }
  return notes
}
