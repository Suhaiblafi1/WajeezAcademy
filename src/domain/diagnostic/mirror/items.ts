/* «مرآة وجيز» — أربعةٌ وعشرون بندا بلا تسجيلٍ ولا بريد (البند ٤٠).
 *
 * ── لماذا هي أرخصُ ممّا تبدو ──
 *
 * ثمانيةَ عشرَ بندا منها **موجودةٌ حرفا في بنك الأسئلة** (`QB-M5-001…018`):
 * ثلاثةٌ لكلّ بُعدٍ من أبعاد هولاند الستّة، كلُّها `likert_5` بالمسطرة نفسِها.
 * فكلفةُ تأليفها **صفر**، ولا يُنسخ نصُّها هنا: تُقرأ من البنك بمعرّفها كي
 * يبقى للنصّ مصدرٌ واحد.
 *
 * والستّةُ الباقيةُ جاهزيّةُ تعلّمٍ — وهي المؤلَّفةُ هنا.
 *
 * ── وما يُبذَر منها في المحرّك، وما يُعرض ولا يُبذَر ──
 *
 * `goal_clarity` **يُبذَر**: هو المانعُ الأوّلُ في التشخيص اليوم («هدفُك ما
 * زال غيرَ واضح»)، ومن أجاب عنه هنا لا يُسأل عنه هناك.
 *
 * و`application_readiness` و`completion_pattern` **يُعرضان ولا يُبذَران**،
 * وهذا قرارٌ لا سهو:
 *
 *   · الأوّلُ كان سؤالا في التشخيص (`QB-M2-015`) **فتقاعد**، ومكتوبٌ في
 *     `RETIRED_IN_CODE` لماذا: «أثرُه الوحيدُ المبرمَجُ عقوبة» — لا قالبَ
 *     واحدٌ يفضّل خطّةً نظريّةً لمن قال إنّ استعدادَه منخفض، فكان يعاقب من
 *     يصدُق في جوابه. وبذرُه من المرآة يُحيي العقوبةَ من بابٍ خلفيّ.
 *   · والثاني تقرؤه **صفرُ مواضع** في المحرّك.
 *
 * فيُعرضان للمتعلّم لأنّهما يفيدانه في قراءة نفسه، ولا يُمرَّران إلى قرارٍ لا
 * يعرف ماذا يفعل بهما. **ومرآةٌ تُري ما لا تستعمله أصدقُ من مرآةٍ تستعمل ما
 * لا تُريه.** */

import { questionById } from '../catalog'
import { RIASEC_DIMS, type RiasecDim } from '../v2_1/maps'

/** مسطرةُ ليكرت الخماسيّة — نصُّها نصُّ البنك حرفا، فلا مسطرتان في المنتج */
export const LIKERT_AR = ['لا ينطبق أبدا', 'ينطبق قليلا', 'ينطبق أحيانا', 'ينطبق غالبا', 'ينطبق جدا'] as const

/** بنودُ الميول — ثلاثةٌ لكلّ بُعد، بمعرّفاتها في البنك */
export const RIASEC_ITEM_IDS: Record<RiasecDim, [string, string, string]> = {
  riasec_realistic: ['QB-M5-001', 'QB-M5-002', 'QB-M5-003'],
  riasec_investigative: ['QB-M5-004', 'QB-M5-005', 'QB-M5-006'],
  riasec_artistic: ['QB-M5-007', 'QB-M5-008', 'QB-M5-009'],
  riasec_social: ['QB-M5-010', 'QB-M5-011', 'QB-M5-012'],
  riasec_enterprising: ['QB-M5-013', 'QB-M5-014', 'QB-M5-015'],
  riasec_conventional: ['QB-M5-016', 'QB-M5-017', 'QB-M5-018'],
}

export type ReadinessKey = 'goal_clarity' | 'application_readiness' | 'completion_pattern'

export interface MirrorItem {
  id: string
  text_ar: string
  /** بُعدُ ميلٍ أو مقياسُ جاهزيّة */
  measures: RiasecDim | ReadinessKey
  block: 'interest' | 'readiness'
}

/* الجاهزيّةُ بندان لكلّ مقياس — لا واحدٌ، لأنّ بندا واحدا يقيس صياغتَه لا
   صاحبَه. وهي مصوغةٌ بصيغة الخبر لا السؤال كي تشبه بنودَ البنك فلا يشعر
   المتعلّم بأنّه انتقل إلى اختبارٍ ثانٍ في منتصف الأوّل. */
const READINESS: MirrorItem[] = [
  { id: 'MIR-GC-1', measures: 'goal_clarity', block: 'readiness', text_ar: 'أعرف بدقّة ما أريد أن أصير إليه مهنيّا خلال سنتين.' },
  { id: 'MIR-GC-2', measures: 'goal_clarity', block: 'readiness', text_ar: 'لو سألني أحدٌ عن هدفي المهنيّ لأجبتُه بجملةٍ واحدةٍ واضحة.' },
  { id: 'MIR-AR-1', measures: 'application_readiness', block: 'readiness', text_ar: 'أتعلّم أسرعَ حين أطبّق بيدي لا حين أقرأ أو أشاهد.' },
  { id: 'MIR-AR-2', measures: 'application_readiness', block: 'readiness', text_ar: 'عندي وقتٌ أسبوعيٌّ أستطيع أن أخصّصه لتمرينٍ عمليّ فعلا.' },
  { id: 'MIR-CP-1', measures: 'completion_pattern', block: 'readiness', text_ar: 'ما أبدؤه من تعلّمٍ أُنهيه غالبا.' },
  { id: 'MIR-CP-2', measures: 'completion_pattern', block: 'readiness', text_ar: 'أعود إلى ما توقّفتُ عنه بدل أن أبدأ شيئا جديدا.' },
]

/** البنودُ الأربعةُ والعشرون بترتيب العرض — الميولُ أوّلا ثمّ الجاهزيّة */
export function mirrorItems(): MirrorItem[] {
  const interest: MirrorItem[] = []
  for (const dim of RIASEC_DIMS) {
    for (const id of RIASEC_ITEM_IDS[dim]) {
      const q = questionById.get(id)
      /* بندٌ اختفى من البنك لا يُخترَع نصُّه هنا — يُسقَط ويحرسه الاختبار */
      if (!q) continue
      interest.push({ id, text_ar: q.text_ar, measures: dim, block: 'interest' })
    }
  }
  return [...interest, ...READINESS]
}
