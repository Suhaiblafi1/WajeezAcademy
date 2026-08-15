/* جسر «مؤشر وجيز» — يحوّل إجابات المؤشر الخمس المحفوظة محليا إلى حقائق موثقة المصدر
   في محرك التشخيص، فلا يُسأل المتعلم مرتين عن الشيء نفسه.
   التطابق الواضح فقط: ما لا يقابله حقيقة موثقة في بنك الأسئلة يُتجاهل ولا يُخترع.
   جودة الدليل 0.6 — أدنى من إجابة التشخيص الكامل (0.9)، لأنها إجابة سريعة في سياق تمهيدي. */

import type { FactBag } from './types'

export interface MirrorAnswers {
  [questionId: string]: string
}

export const MIRROR_STORAGE_KEY = 'wajeez_mirror'

/* m4: «عندما تفكر في وضعك المهني بعد سنتين — كيف تبدو الصورة؟»
   يقابل QB-M2-005 (goal_clarity: low | medium | high) — تطابق دلالي واضح */
const M4_TO_GOAL_CLARITY: Record<string, 'high' | 'medium' | 'low'> = {
  'واضحة ومكتوبة': 'high',
  'في رأسي تقريبا': 'medium',
  'ضبابية — وهذا يقلقني أحيانا': 'low',
}

/** يحوّل إجابات المؤشر إلى حقائق محرك بمصدر TEASER-* — بلا اختراع ولا تخمين */
export function mirrorAnswersToFacts(answers: MirrorAnswers): FactBag {
  const facts: FactBag = {}
  const m4 = answers['m4']
  const clarity = m4 ? M4_TO_GOAL_CLARITY[m4] : undefined
  if (clarity) {
    facts['goal_clarity'] = {
      value: clarity,
      sourceQuestionId: 'TEASER-m4',
      evidenceQuality: 0.6,
      raw: m4,
    }
  }
  return facts
}

/** يقرأ إجابات المؤشر من التخزين المحلي — يعيد null عند غيابها أو تلفها */
export function loadMirrorAnswers(storage: Pick<Storage, 'getItem'>): MirrorAnswers | null {
  try {
    const raw = storage.getItem(MIRROR_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { answers?: MirrorAnswers } | null
    const answers = parsed?.answers
    return answers && Object.keys(answers).length > 0 ? answers : null
  } catch {
    return null
  }
}
