/* مقعدُ المستكشف: لا يُقاس بالمهارةِ من لا مجالَ له بعد.

   ── الحادثةُ التي أنتجت هذا الحارس (١٦ سبتمبر ٢٠٢٦) ──

   أُضيفت ستُّ عائلاتِ دوراتٍ جديدةٍ ومعها عشرةُ أسئلةِ قياس. فضاق الهامشُ بين
   المرشّحين المتصدّرين (`margin < 0.15`)، فاشتعل بندُ **الفصل بدليل المهارة**
   بوزنِه ٠٫٩ وغلب بندَ **الاستكشاف** بوزنِه ٠٫٦. والنتيجةُ على رحلةِ «غير
   محسوم» المرجعيّة:

     قبل: ١٠ أسئلة · ستّةُ أسئلةِ ميلٍ وسؤالُ مجال · PW-STU-003 بثقة ٦٠٪
     بعد: ١٤ سؤالا · **كلُّها أسئلةُ مهارة، ولا سؤالَ ميلٍ واحد** · **لا نتيجة**
          بثقة ٣٦٪

   أي أنّ من قال «لا أعرف ما أريد» صار يُسأل أربعةَ عشرَ سؤالا ثمّ يُقال له
   «راجع مستشارا» — وهو أحوجُ الناسِ إلى التشخيص.

   ── والعلّةُ بنيويّةٌ لا عدديّة ──

   من لا هدفَ له ولا احتياج **لا مرشّحين له**: المتصدّرون عنده ما تصادف أن
   تصدّر بلا إشارةٍ منه. فقياسُ مهارةٍ «لتفصل» بينهم يستهلك مقعدا لا يغيّر شيئا
   حقيقيّا، ويزيح السؤالَ الذي كان سيقول ما يريد. والمؤلّفون بنوا هذا القيدَ
   نفسَه على `minimumEvidence` (`!unsureExplore`) ولم يبنوه على
   `evidenceSeparation` — فسدّ هنا.

   والقيدُ **مرفوعٌ بمجرّد أن يتّضح المجال**: عندها يصير الفصلُ بالمهارةِ فصلا
   حقيقيّا، والحارسُ يفحص الاتّجاهين معا فلا يخضرّ على منعٍ مطلق. */

import { describe, expect, it } from 'vitest'
import { scoreAdaptiveQuestionV21 } from '../../../domain/diagnostic/v2_1/engine'
import { planOf } from '../../../domain/diagnostic/v2_1/data'
import { questionById } from '../../../domain/diagnostic/catalog'
import { DOMAIN_CONFIDENCE_MIN } from '../../../domain/diagnostic/v2/domains'
import type { BankQuestion } from '../../../domain/diagnostic/types'

/** أوّلُ سؤالِ مهارةٍ حيٍّ في البنك — لا معرّفٌ مكتوبٌ باليد يبلى */
function anySkillQuestion(): BankQuestion {
  for (const [qid, q] of questionById) {
    const plan = planOf(qid)
    if (plan?.layer21 === 'evidence_skill' && plan.surface === 'b2c' && q.measures[0]) return q
  }
  throw new Error('لا سؤالَ مهارةٍ حيٌّ في البنك — تغيّرت البنيةُ لا الاختبار')
}

/* سياقُ قرارٍ أدنى: ما يقرؤه scoreAdaptiveQuestionV21 وحدَه */
function ctxWith(confidence: number) {
  return {
    phase: 'adaptive',
    domains: { scores: {}, ranked: [], top: null, confidence, contested: null },
    compositeAmbiguous: false,
  } as unknown as Parameters<typeof scoreAdaptiveQuestionV21>[3]
}

/* مرشّحانِ متلاصقان — الهامشُ دون ٠٫١٥ فيشتعل بندُ الفصل لولا القيد */
const TIGHT = [
  { pathwayId: 'PW-STU-003', total: 0.60 },
  { pathwayId: 'PW-STU-002', total: 0.55 },
] as unknown as Parameters<typeof scoreAdaptiveQuestionV21>[4]

describe('مقعدُ المستكشف — الفصلُ بالمهارةِ يُؤجَّل حتّى يتّضح المجال', () => {
  const q = anySkillQuestion()
  const slug = q.measures[0]
  const decisive = new Map([[slug, 1]])

  it('من قال «غير متأكّد» في هدفِه ومجالُه غامض: لا وزنَ لفصلِ المهارة', () => {
    const facts = {
      primary_goal: { value: 'explore', confidence: 1, source: 'test' },
    } as unknown as Parameters<typeof scoreAdaptiveQuestionV21>[1]
    const s = scoreAdaptiveQuestionV21(q, facts, [], ctxWith(DOMAIN_CONFIDENCE_MIN - 0.1), TIGHT, decisive)
    expect(s.components.evidenceSeparation, 'قياسُ مهارةٍ لفصلِ مرشّحين لم يخترهم أحد').toBe(0)
  })

  it('ومن قال «احتياجي غير متأكّد» كذلك', () => {
    const facts = {
      need_id: { value: 'need_unsure', confidence: 1, source: 'test' },
    } as unknown as Parameters<typeof scoreAdaptiveQuestionV21>[1]
    const s = scoreAdaptiveQuestionV21(q, facts, [], ctxWith(DOMAIN_CONFIDENCE_MIN - 0.1), TIGHT, decisive)
    expect(s.components.evidenceSeparation).toBe(0)
  })

  it('فإذا اتّضح المجالُ عاد الفصلُ بالمهارةِ فصلا حقيقيّا — فليس منعا مطلقا', () => {
    const facts = {
      primary_goal: { value: 'explore', confidence: 1, source: 'test' },
    } as unknown as Parameters<typeof scoreAdaptiveQuestionV21>[1]
    const s = scoreAdaptiveQuestionV21(q, facts, [], ctxWith(DOMAIN_CONFIDENCE_MIN + 0.1), TIGHT, decisive)
    expect(s.components.evidenceSeparation, 'القيدُ يجب أن يُرفَع عند وضوحِ المجال').toBeGreaterThan(0)
  })

  it('ومن حسم هدفَه لا يمسّه القيدُ أصلا مهما غمض مجالُه', () => {
    const facts = {
      primary_goal: { value: 'promotion', confidence: 1, source: 'test' },
    } as unknown as Parameters<typeof scoreAdaptiveQuestionV21>[1]
    const s = scoreAdaptiveQuestionV21(q, facts, [], ctxWith(DOMAIN_CONFIDENCE_MIN - 0.1), TIGHT, decisive)
    expect(s.components.evidenceSeparation).toBeGreaterThan(0)
  })

  /* ولا رحلةَ كاملةً هنا بقصد: جرّبتُها فخضرّت والقيدُ مقطوعٌ — لأنّ إعادةَ
     بناءِ رحلةِ المستكشفِ في اختبارِ وحدةٍ لا تُطابق المحاكيَ في كلِّ تفصيل،
     فتمضي رحلةٌ أخرى غيرُ التي انكسرت. والتغطيةُ الطرفيّةُ موجودةٌ حيث يجب:
     `sim-journeys --check` بالرحلاتِ العشرِ المرجعيّةِ هو الذي أمسك الانحدارَ
     أوّلَ مرّة، وهو الذي سيمسكه إن عاد. وحارسٌ يخضرّ في الحالين زينةٌ تُحذف
     لا تُترك. */
})
