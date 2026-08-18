/* اشتقاق الشخصية الدقيقة من الحقائق — قواعد مرتبة حتمية وموثقة.
   الأولوية: صاحب القرار المؤسسي ← أمان القاصرين ← نص وصف M1 الصريح ← الرموز المشتقة.
   النص الخام (raw) لسؤال «أي وصف يقترب من وضعك» هو الأدق — يفرق طالب المدرسة عن الجامعة. */

import type { FactBag } from '../types'
import type { PersonaKey, PersonaResult } from './types'

const PERSONA_LABELS_AR: Record<PersonaKey, string> = {
  school_student: 'طالب مدرسة',
  university_student: 'طالب جامعة',
  graduate: 'خريج حديث',
  job_seeker: 'باحث عن عمل',
  junior_employee: 'موظف في بداية مساره',
  experienced_employee: 'موظف ذو خبرة',
  new_manager: 'مدير جديد',
  leader: 'قائد',
  gov_employee: 'موظف حكومي',
  gov_manager: 'مدير حكومي',
  founder_idea: 'رائد أعمال في مرحلة الفكرة',
  founder_operating: 'صاحب مشروع قائم',
  freelancer: 'مستقل (عمل حر)',
  ld_professional: 'مختص تعلم وتطوير',
  parent_guardian: 'ولي أمر / هدف أسري',
  personal_development: 'متعلم للتطوير الشخصي',
  unsure_explorer: 'مستكشف غير محسوم الاتجاه',
  b2b_sponsor: 'جهة عمل (قطاع خاص)',
  b2g_sponsor: 'جهة حكومية',
  unknown: 'غير محدد بعد',
}

export function personaLabelAr(key: PersonaKey): string {
  return PERSONA_LABELS_AR[key]
}

function hasLeadership(facts: FactBag): 'none' | 'informal' | 'formal' | 'unknown' {
  const v = facts['leadership_context']?.value
  if (v === undefined) return 'unknown'
  if (v === 'none' || v === '') return 'none'
  if (v === 'informal') return 'informal'
  return 'formal'
}

/** يشتق الشخصية الدقيقة — نفس الحقائق تعطي نفس النتيجة دائمًا */
export function derivePersona(facts: FactBag): PersonaResult {
  const evidence: string[] = []
  const g = (k: string) => facts[k]?.value
  const raw = (k: string) => facts[k]?.raw ?? ''
  const isMinor = g('minor_flag') === 'yes'
  if (isMinor) evidence.push('minor_flag=yes')

  // ١) صاحب قرار مؤسسي — الجلسة لجهة لا لمتعلم فرد
  const owner = g('decision_owner')
  if (owner === 'employer') {
    const sector = g('sector')
    evidence.push('decision_owner=employer')
    return {
      key: sector === 'public' ? 'b2g_sponsor' : 'b2b_sponsor',
      confidence: 0.95,
      evidence,
      isMinor: false,
    }
  }
  if (owner === 'guardian') {
    evidence.push('decision_owner=guardian')
    return { key: 'parent_guardian', confidence: 0.9, evidence, isMinor }
  }

  // ٢) أمان القاصرين — قاصر يتعلم لنفسه يُعامل كطالب مدرسة مهما قال
  if (isMinor) {
    return { key: 'school_student', confidence: 0.95, evidence, isMinor: true }
  }

  // ٣) نص وصف M1 الصريح — أدق مصدر
  const personaRaw = raw('persona_type')
  const branch = g('persona_branch')
  if (branch === 'family' || personaRaw.includes('أب/أم')) {
    evidence.push('persona_branch=family')
    return { key: 'parent_guardian', confidence: 0.9, evidence, isMinor }
  }
  if (branch === 'unsure' || personaRaw.includes('غير متأكد')) {
    evidence.push('persona_branch=unsure')
    return { key: 'unsure_explorer', confidence: 0.85, evidence, isMinor }
  }
  if (personaRaw.includes('مدرسة')) {
    evidence.push('persona: طالب مدرسة')
    return { key: 'school_student', confidence: 0.95, evidence, isMinor }
  }
  if (personaRaw.includes('جامعة')) {
    evidence.push('persona: طالب جامعة')
    return { key: 'university_student', confidence: 0.95, evidence, isMinor }
  }
  if (personaRaw.includes('باحث عن عمل')) {
    evidence.push('persona: باحث عن عمل')
    return { key: 'job_seeker', confidence: 0.9, evidence, isMinor }
  }
  if (personaRaw.includes('خريج')) {
    const emp = g('employment_state')
    evidence.push('persona: خريج جديد')
    if (emp === 'not_working') {
      evidence.push('employment_state=not_working')
      return { key: 'job_seeker', confidence: 0.85, evidence, isMinor }
    }
    return { key: 'graduate', confidence: 0.9, evidence, isMinor }
  }
  if (personaRaw.includes('موظف') || g('persona_type') === 'employee' || g('persona_type') === 'manager') {
    const sector = g('sector')
    const lead = hasLeadership(facts)
    const fns = g('function_specialization')
    const fnList = Array.isArray(fns) ? fns : fns ? [fns] : []
    evidence.push('persona: موظف')
    if (fnList.includes('hr') && g('primary_goal') === 'design_training') {
      evidence.push('function=hr + goal=design_training')
      return { key: 'ld_professional', confidence: 0.85, evidence, isMinor }
    }
    if (sector === 'public') {
      evidence.push('sector=public')
      return {
        key: lead === 'none' ? 'gov_employee' : 'gov_manager',
        confidence: lead === 'unknown' ? 0.7 : 0.9,
        evidence,
        isMinor,
      }
    }
    if (lead === 'formal') return { key: 'leader', confidence: 0.85, evidence, isMinor }
    if (lead === 'informal') return { key: 'new_manager', confidence: 0.85, evidence, isMinor }
    // موظف بلا قيادة: مبتدئ أم ذو خبرة؟ العمر والتعليم قرائن — لا تُخترع خبرة بلا دليل
    const ageRaw = raw('age_band')
    if (ageRaw.includes('19') || ageRaw.includes('24')) {
      evidence.push('age_band≈19–24')
      return { key: 'junior_employee', confidence: 0.75, evidence, isMinor }
    }
    return { key: 'experienced_employee', confidence: lead === 'unknown' ? 0.65 : 0.8, evidence, isMinor }
  }
  if (personaRaw.includes('رائد') || personaRaw.includes('مستقل') || g('persona_type') === 'founder' || g('persona_type') === 'freelancer') {
    const stage = g('business_stage')
    const emp = g('employment_state')
    evidence.push('persona: رائد/مستقل')
    if (g('persona_type') === 'freelancer' || emp === 'self_employed') {
      evidence.push('employment=self_employed')
      return { key: 'freelancer', confidence: 0.85, evidence, isMinor }
    }
    if (stage === 'idea' || stage === 'validation' || stage === 'pre_revenue') {
      evidence.push(`business_stage=${String(stage)}`)
      return { key: 'founder_idea', confidence: 0.9, evidence, isMinor }
    }
    if (stage) {
      evidence.push(`business_stage=${String(stage)}`)
      return { key: 'founder_operating', confidence: 0.9, evidence, isMinor }
    }
    return { key: 'founder_idea', confidence: 0.55, evidence, isMinor }
  }

  // ٤) رموز مشتقة بلا نص صريح (بذر خارجي / جلسات قديمة)
  const pt = g('persona_type')
  if (pt === 'student') {
    const edu = g('education_state')
    if (edu === 'school') return { key: 'school_student', confidence: 0.7, evidence: ['persona_type=student', 'education=school'], isMinor }
    if (edu === 'university' || edu === 'diploma') return { key: 'university_student', confidence: 0.7, evidence: ['persona_type=student', `education=${String(edu)}`], isMinor }
    return { key: 'university_student', confidence: 0.45, evidence: ['persona_type=student'], isMinor }
  }
  if (pt === 'early_career') return { key: 'graduate', confidence: 0.55, evidence: ['persona_type=early_career'], isMinor }

  return { key: 'unknown', confidence: 0, evidence, isMinor }
}

/** شخصية V2 ← قاعدة V1 (للتعامل مع بروفايلات المسارات القائمة على رموز V1) */
export function basePersonaCode(key: PersonaKey): string | null {
  switch (key) {
    case 'school_student':
    case 'university_student':
      return 'student'
    case 'graduate':
    case 'job_seeker':
      return 'early_career'
    case 'junior_employee':
    case 'experienced_employee':
    case 'gov_employee':
      return 'employee'
    case 'new_manager':
    case 'leader':
    case 'gov_manager':
      return 'manager'
    case 'founder_idea':
    case 'founder_operating':
      return 'founder'
    case 'freelancer':
      return 'freelancer'
    case 'ld_professional':
      return 'trainer'
    default:
      return null
  }
}
