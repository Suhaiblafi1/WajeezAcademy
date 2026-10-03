/* ═══ الخطوةُ التالية لكلّ مدرّبٍ في شاشة العقود (٣ أكتوبر ٢٠٢٦) ═══
 *
 * طلبُ صاحب المنصّة: «اجعل كلَّ المدرّبين في خانة العقود كأنّها شريطٌ أضغط
 * عليه ينسدل، مع ذكر ما الخطوةُ القادمةُ له بجانب اسمه — لسهولة النظر على
 * الشاشة». فالصفُّ المطويُّ سطرٌ واحد: الاسمُ ثمّ ما يلي، ومن أراد التفصيلَ
 * فتحه.
 *
 * والجوابُ هنا من وقائع العقد وحدَها — حالتُه وأسماؤه ومهلتُه — لا من قراءةٍ
 * ثانيةٍ للخادم: سطرٌ يُرسَم لأربعين صفّا لا يسأل أربعين سؤالا. ومن عليه
 * الدورُ (`who`) يُقال لونا: ما عليك يُلفت، وما عليهم يُقرأ ولا يُلحّ.
 */

import { conditionPhase, type ConditionFacts } from './conditional-offer'
import { nameMatch } from './contract-names'

export type NextStepWho = 'you' | 'them' | 'none'

export interface NextStep {
  textAr: string
  who: NextStepWho
}

export interface NextStepFacts extends ConditionFacts {
  status: string
  gatesActivation: boolean
  tokenExpiresAt?: string | Date | null
  documentNameAr: string | null
  signedNameAr: string | null
  now?: Date
}

const past = (d: string | Date | null | undefined, now: Date) =>
  d != null && new Date(d).getTime() < now.getTime()

export function contractNextStep(f: NextStepFacts): NextStep {
  const now = f.now ?? new Date()
  switch (f.status) {
    case 'draft':
      return { textAr: 'أرسِلْه للتوقيع', who: 'you' }
    case 'sent':
      return past(f.tokenExpiresAt, now)
        ? { textAr: 'انقضى رابطُه — جدِّدْه أو ألغِه', who: 'you' }
        : { textAr: 'ينتظر توقيعَه', who: 'them' }
    case 'amendment_requested':
      return { textAr: 'طلب تعديلا — أجِبْه', who: 'you' }
    case 'signed':
      return nameMatch(f) === 'differs'
        ? { textAr: 'وقّع باسمٍ مختلف — قابِلْه بهويّته ثمّ قرّر', who: 'you' }
        : { textAr: 'وقّع — اعتمِدْ توقيعَه', who: 'you' }
    case 'signature_approved': {
      if (!f.gatesActivation) return { textAr: 'وقِّعْه حين تعتمد دوراتِه', who: 'you' }
      const phase = conditionPhase({ ...f, now })
      if (phase === 'under_review') return { textAr: 'أرسل شعبَه — راجِعْها واعتمِدْها', who: 'you' }
      if (phase === 'lapsed') return { textAr: 'انقضت مهلتُه — مدِّدْ أو أنهِ', who: 'you' }
      if (phase === 'met') return { textAr: 'اكتمل شرطُه — وقِّعْه', who: 'you' }
      return { textAr: 'يُعِدّ شعبَ دوراته في «شعبي»', who: 'them' }
    }
    case 'countersigned':
      return { textAr: 'نافذ — لا شيءَ عليك', who: 'none' }
    default:
      return { textAr: 'انتهى — لا خطوةَ بعده', who: 'none' }
  }
}
