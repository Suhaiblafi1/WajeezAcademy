/* جسرُ «مرآة وجيز» إلى المحرّك — حقائقُ مبذورةٌ بمصدرها، لا توصيةٌ ثانية.
 *
 * المرآةُ **ليست منتَجا ثانيا**: هي النصفُ الأوّلُ من الجلسة نفسِها. فما تقيسه
 * يصل إلى المحرّك بالدالّة القائمة، فلا يُسأل المتعلّمُ مرّتين، ويُكتب في سجلّ
 * الأثر بمصدرٍ يقول من أين جاء.
 *
 * وجودةُ الدليل ٠٫٦ لا ٠٫٩: جوابٌ في سياقٍ تمهيديٍّ بلا حساب، أضعفُ من جوابٍ
 * في تشخيصٍ كامل — والفرقُ يُكتب ولا يُخفى. */

import type { FactBag } from '../types'
import { RIASEC_DIMS, type RiasecDim } from '../v2_1/maps'
import type { MirrorResult } from './score'

export const MIRROR_V2_STORAGE_KEY = 'wajeez_mirror_v2'

/** حدُّ الميل الذي يستحقّ البذر — الحيادُ ٣، وما دونه ليس ميلا */
const LEAN_FLOOR = 3

/** «وضوحُ الهدف» من متوسّط بندَيه — والحدودُ هي حدودُ `QB-M2-005` نفسُها */
export function clarityBand(mean: number | null): 'high' | 'medium' | 'low' | null {
  if (mean === null) return null
  if (mean >= 4) return 'high'
  if (mean >= 3) return 'medium'
  return 'low'
}

/** الحقائقُ التي تُبذَر — و`riasec_*` تُسلَّم في متّجه الميول لا في الحقائق */
export function mirrorFacts(result: MirrorResult): FactBag {
  const facts: FactBag = {}
  const band = clarityBand(result.readiness.goal_clarity)
  if (band) {
    facts['goal_clarity'] = {
      value: band,
      sourceQuestionId: 'MIRROR-goal-clarity',
      evidenceQuality: 0.6,
    }
  }
  /* ولا يُبذَر `application_readiness` ولا `completion_pattern`: الأوّلُ
     متقاعدٌ لأنّ أثرَه المبرمَجَ عقوبة (`RETIRED_IN_CODE`)، والثاني تقرؤه
     صفرُ مواضع. وبذرُ ما لا يُقرأ زينةٌ، وبذرُ ما يُعاقب ضرر. */
  return facts
}

/** متّجهُ الميول كما يقرؤه المحرّك — المفتاحُ نفسُه والمدى نفسُه */
export function mirrorInterestVector(result: MirrorResult): Record<string, number> {
  const vector: Record<string, number> = {}
  for (const dim of RIASEC_DIMS) {
    const v = result.dims[dim]
    if (v !== null && v >= LEAN_FLOOR) vector[dim] = v
  }
  return vector
}

/** البنودُ التي لا تُعاد في التشخيص — من أجاب هنا لا يُسأل هناك */
export function mirrorAnsweredIds(result: MirrorResult, answers: Record<string, number>): string[] {
  void result
  return Object.keys(answers).filter((id) => id.startsWith('QB-M5-'))
}

export type { RiasecDim }
