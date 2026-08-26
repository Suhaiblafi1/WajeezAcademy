/* مساعد مشترك للاختبارات والمحاكاة — يشغّل جلسة تشخيص بإجابات مكتوبة */

import { DiagnosticEngine } from '../../domain/diagnostic/engine'
import type { Answer } from '../../domain/diagnostic/types'

export type Script = Record<string, string | string[]>

/** يشغل المحرك حتى التوقف؛ السؤال غير المكتوب يجاب بأول خيار (حتمي) */
export function runSession(script: Script, mode: 'quick' | 'deep' = 'quick') {
  const engine = new DiagnosticEngine(`test-${Math.abs(hashCode(JSON.stringify(script)))}`)
  engine.setMode(mode)
  const askedOrder: string[] = []
  for (let i = 0; i < 40; i++) {
    const next = engine.nextQuestion()
    if (!next.question) break
    const q = next.question
    askedOrder.push(q.question_id)
    const scripted = script[q.question_id]
    let value: Answer['value']
    if (scripted !== undefined) {
      value = scripted
    } else if (q.options_ar.length > 0) {
      /* سؤال مهارة غير مكتوب في النص: الوسط لا القاع. الافتراض السابق
         (options_ar[0]) يعني «لم أتعامل معها عمليًا» في كل مهارة، فتصير
         الشخصية «من لم يفعل شيئا قط» ويحسم الترشيحَ أكبرُ فجوة لا أقربُ
         سياق — وهو ليس ما تدّعي هذه الاختبارات قياسه. */
      const skillLike = q.answer_type === 'skill_level_5' || q.answer_type === 'likert_5'
      const idx = skillLike ? Math.min(2, q.options_ar.length - 1) : 0
      value = q.answer_type === 'multi_choice' || q.answer_type === 'rank_top3' ? [q.options_ar[idx]] : q.options_ar[idx]
    } else {
      value = 'لا ينطبق'
    }
    engine.answer({ questionId: q.question_id, value })
  }
  const recommendation = engine.recommend()
  return { engine, recommendation, askedOrder, state: engine.getState() }
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

/* إجابات مشتركة جاهزة */
export const CONSENT_YES = {
  'QB-M0-001': 'أنا المتعلم',
  'QB-M0-002': 'من 25 إلى 34',
  'QB-M0-006': 'نعم',
  'QB-M0-008': 'لا',
}

export const STUDENT_LOST: Script = {
  ...CONSENT_YES,
  'QB-M0-002': 'من 19 إلى 24',
  'QB-M1-001': 'طالب جامعة',
  'QB-M2-001': 'لا أعرف بعد',
  'QB-M2-005': 'غير واضح',
  'QB-M2-015': 'متوسطة',
  'QB-M7-001': 'من 5 إلى 7 ساعات',
}

export const GRAD_INTERVIEWS: Script = {
  ...CONSENT_YES,
  'QB-M0-002': 'من 19 إلى 24',
  'QB-M1-001': 'خريج جديد',
  'QB-M1-003': 'أبحث عن عمل',
  'QB-M2-001': 'وظيفة أو ترقية',
  'QB-M2-005': 'واضح',
  'QB-M2-015': 'عالية',
  'QB-M3A-003': 'واضح',
  'QB-M3A-004': 'لا',
  'QB-M3A-006': 'مبتدئ',
  'QB-M3A-007': 'لا يوجد دليل',
  'QB-M7-001': 'من 5 إلى 7 ساعات',
}

export const GOV_EMPLOYEE: Script = {
  ...CONSENT_YES,
  'QB-M0-002': 'من 25 إلى 34',
  'QB-M1-001': 'موظف',
  'QB-M1-003': 'موظف حكومي',
  'QB-M2-001': 'وظيفة أو ترقية',
  'QB-M2-005': 'واضح',
  'QB-M2-015': 'عالية',
  'QB-M3B-001': 'حكومي',
  'QB-M3B-003': 'نعم',
  'QB-M3B-011': ['خدمة جمهور'],
  'QB-M3B-012': 'لا',
  'QB-M7-001': 'من 5 إلى 7 ساعات',
}

export const NEW_MANAGER: Script = {
  ...CONSENT_YES,
  'QB-M0-002': 'من 25 إلى 34',
  'QB-M1-001': 'موظف',
  'QB-M1-003': 'دوام كامل',
  'QB-M2-001': 'قيادة وتأثير',
  'QB-M2-005': 'واضح جدا',
  'QB-M2-015': 'حاسمة',
  'QB-M3B-001': 'خاص',
  'QB-M3B-012': 'نعم',
  'QB-M7-001': 'من 5 إلى 7 ساعات',
}

export const FOUNDER_IDEA: Script = {
  ...CONSENT_YES,
  'QB-M1-001': 'رائد أعمال/مستقل',
  'QB-M1-003': 'صاحب مشروع',
  'QB-M2-001': 'مشروع أو دخل',
  'QB-M2-005': 'واضح',
  'QB-M2-015': 'حاسمة',
  'QB-M3C-001': 'عندي فكرة ولم أبدأ بعد',
  'QB-M3C-002': 'غير واضح',
  'QB-M3C-004': 'لا',
  'QB-M3C-010': 'لا أعرفها',
  'QB-M3C-011': 'أعمل وحدي',
  'QB-M7-001': 'من 5 إلى 7 ساعات',
}

export const EMPLOYEE_DATA: Script = {
  ...CONSENT_YES,
  'QB-M0-002': 'من 25 إلى 34',
  'QB-M1-001': 'موظف',
  'QB-M1-003': 'دوام كامل',
  'QB-M2-001': 'وظيفة أو ترقية',
  'QB-M2-005': 'واضح',
  'QB-M2-015': 'عالية',
  'QB-M3B-001': 'خاص',
  'QB-M3B-011': ['عمليات'],
  'QB-M3B-012': 'لا',
  'QB-M7-001': 'من 5 إلى 7 ساعات',
}
