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

/* ═══ وشرطٌ مفتوحٌ الدورُ فيه علينا (١٧ أكتوبر ٢٠٢٦) ═══
   اعتُمدت له دورةٌ ولم يُفعَّل (وواحدةٌ تكفي منذ ٢٠ أكتوبر): فبالتفعيل نوقّع العقدَ ويتحقّق شرطُه — وكان الوسمُ يقول
   «انقضت مهلتُه — مدِّدْ أو أنهِ» عن شرطٍ تحقّق (سؤالُ صاحب المنصّة عن مدرّبٍ دوراتُه الثلاثُ
   معتمدة). ويصدق على العقد المختوم قبل ١ أكتوبر ٢٠٢٦ وشرطُه مفتوح، فيُسأل في الحالتين. */
function openCondition(f: NextStepFacts, now: Date): NextStep | null {
  if (!f.gatesActivation) return null
  const phase = conditionPhase({ ...f, now })
  if (phase === 'met') return null
  if (f.coursesReady) return { textAr: 'اعتمدت له دورة — فعّله ووقّع العقد', who: 'you' }
  if (phase === 'under_review') return { textAr: 'أرسل شعبَه — راجِعْها واعتمِدْها', who: 'you' }
  if (phase === 'lapsed') return { textAr: 'انقضت مهلتُه — مدِّدْ أو أنهِ', who: 'you' }
  return null
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
        ? { textAr: 'انقضى رابطُه — جدِّدْه، أو اعتذر له وأجِّلْه، أو ألغِه', who: 'you' }
        : { textAr: 'ينتظر توقيعَه', who: 'them' }
    case 'amendment_requested':
      return { textAr: 'طلب تعديلا — أجِبْه', who: 'you' }
    case 'signed':
      return nameMatch(f) === 'differs'
        ? { textAr: 'وقّع باسمٍ مختلف — قابِلْه بهويّته ثمّ قرّر', who: 'you' }
        : { textAr: 'وقّع — اعتمِدْ توقيعَه', who: 'you' }
    case 'signature_approved': {
      /* وغيرُ المشروط — نشطٌ اعتُمد توقيعُه كالعقود الجديدة — يوقَّع تلقائيّا بأوّل دورةٍ تُعتمَد له بعد
         اعتماد توقيعه أو حين تكتمل دوراتُه (١٧ ثمّ ٢٠ أكتوبر ٢٠٢٦، `sealIfDue`). فإن حان ولم يوقَّع (عقدٌ من
         قبل هذا اليوم) فالدورُ عليك؛ وإلّا فهو يُعِدّ — وكان «وقِّعْه حين تعتمد دوراتِه» عليك دائما ولو لم يرسل شيئا */
      if (!f.gatesActivation) {
        return f.coursesReady
          ? { textAr: 'اعتمدت له دورة — وقّعه الآن', who: 'you' }
          : { textAr: 'يعد شعب دوراته — ونوقعه تلقائيا مع أول خطة تعتمدها له', who: 'them' }
      }
      const open = openCondition(f, now)
      if (open) return open
      if (conditionPhase({ ...f, now }) === 'met') return { textAr: 'اكتمل شرطُه — وقِّعْه', who: 'you' }
      return { textAr: 'يُعِدّ شعبَ دوراته في «شعبي»', who: 'them' }
    }
    case 'countersigned':
      return openCondition(f, now) ?? { textAr: 'نافذ — لا شيءَ عليك', who: 'none' }
    default:
      return { textAr: 'انتهى — لا خطوةَ بعده', who: 'none' }
  }
}
