/* البند ٣٧ · مقعدُ «وضعك العمليّ» — يُطرح حيث يُقرأ جوابُه، ويُشتقّ حيث لا يُقرأ.
 *
 * ── ما قاله المتوسّط، وما قاله التفصيل ──
 *
 * قياسٌ مضادٌّ للواقع على ٣٠٠ جلسة أعطى هذا السؤالَ «٢٧٪ هدرا» — رقمٌ يُغري
 * بتقاعده. والتفصيلُ بالمرحلة يقلب الحكم:
 *
 *   خمسُ مراحلَ عاملة   ← ١٤٨ مقعدا · **صفرٌ ميّت**
 *   غير متأكّد           ← ٢٧ مقعدا · ٢٧ ميّتا (١٠٠٪)
 *   خرّيج حديث           ← ٣٨ · ٢٣ (٦١٪)
 *   طالب جامعيّ          ← ٢٨ · ١٤ (٥٠٪)
 *
 * فالتقاعدُ الشاملُ كان سيُتلف ١٤٨ مقعدا حيّا ليوفّر ٦٤. **والمتوسّطُ يخفي
 * ذلك تماما**: سؤالٌ حاسمٌ في مكانٍ وميّتٌ في آخرَ يُقرأ «متوسّطَ الفائدة».
 *
 * ── والعطبُ الذي أمسكه القياسُ في أوّل صياغةٍ لهذا الإصلاح ──
 *
 * اشتققتُ «موظّف» للمراحل الخمس العاملة — وهو اشتقاقٌ صحيحٌ بداهةً وخاطئٌ
 * أثرا: يملأ الحقلَ فيصمت السؤال، ويصمت معه `contradictions.ts` عمّن وصف
 * نفسه موظّفا ثمّ قال إنّه لا يعمل. وأمسكه العدّ: هبطت مقاعدُ السؤال من ٢٤١
 * إلى ٣٨. فهذا الملفُّ يحرس الاتّجاهين معا — لا يُطرح حيث لا يُقرأ، **ولا
 * يُشتقّ حيث يُقرأ**. */

import { describe, expect, it } from 'vitest'
import { applyDerivedRules } from '../../domain/diagnostic/facts'
import type { FactBag } from '../../domain/diagnostic/types'
import {
  GOALS_NEEDING_EMPLOYMENT,
  STAGE_NEEDS_EMPLOYMENT_QUESTION,
  stageToEmploymentState,
  type CareerStage,
} from '../../domain/diagnostic/v2_1/maps'

const WORKING: CareerStage[] = ['early_career', 'experienced', 'manager', 'senior_manager', 'trainer_ld']

describe('٣٧ · مقعدُ «وضعك العمليّ»', () => {
  it('لا يُشتقّ للمراحل الخمس العاملة — وإلّا صمت السؤالُ وصمت معه كشفُ التناقض', () => {
    for (const stage of WORKING) {
      expect(
        stageToEmploymentState(stage),
        `«${stage}» تُشتقّ حالتُها، فلن يُطرح السؤالُ ولن يُكشف من هو بين وظيفتين`,
      ).toBeNull()
      expect(STAGE_NEEDS_EMPLOYMENT_QUESTION, `«${stage}» خرجت من المسؤولات`).toContain(stage)
    }
  })

  it('ويُشتقّ لمن لا يُقرأ جوابُه — والمؤسّسُ والمستقلُّ من مرحلتهما', () => {
    expect(stageToEmploymentState('founder')).toBe('business_owner')
    expect(stageToEmploymentState('freelancer')).toBe('self_employed')
    expect(stageToEmploymentState('university_student')).toBe('not_working')
    /* «غير متأكّد» لا يُشتقّ ولا يُسأل: مرحلتُه لا تقول شيئا عن عمله */
    expect(stageToEmploymentState('other_unsure')).toBeNull()
    expect(STAGE_NEEDS_EMPLOYMENT_QUESTION).not.toContain('other_unsure')
  })

  it('والخرّيجُ الحديثُ يُسأل — جوابُه وحدَه يفصل الباحثَ عن العمل عن الخرّيج', () => {
    expect(STAGE_NEEDS_EMPLOYMENT_QUESTION).toContain('fresh_graduate')
    expect(stageToEmploymentState('fresh_graduate')).toBeNull()
  })

  it('والطالبُ الجامعيُّ لا تُشتقّ حالتُه قبل أن يُعرف هدفُه', () => {
    /* اشتقاقٌ سابقٌ للهدف يُسكت السؤالَ حتّى في الأهداف الثلاثة التي تقرؤه */
    const beforeGoal: FactBag = { career_stage: { value: 'university_student', sourceQuestionId: 'QC-S1-001', evidenceQuality: 1 } }
    applyDerivedRules(beforeGoal)
    expect(
      beforeGoal['employment_state'],
      'اشتُقّت قبل الهدف — فلن تُسأل ولو كان الهدف «أول وظيفة»',
    ).toBeUndefined()

    /* وبعد هدفٍ لا يقرؤها — تُشتقّ فيبقى سطرُ التفسير ولا يُهدر مقعد */
    const afterOtherGoal: FactBag = {
      career_stage: { value: 'university_student', sourceQuestionId: 'QC-S1-001', evidenceQuality: 1 },
      goal_code_v21: { value: 'ai_better', sourceQuestionId: 'QC-G2-001', evidenceQuality: 1 },
    }
    applyDerivedRules(afterOtherGoal)
    expect(afterOtherGoal['employment_state']?.value).toBe('not_working')
    expect(afterOtherGoal['employment_state']?.sourceQuestionId, 'دليلٌ مستنتَجٌ يُنسب إلى سؤال').toBe('derived')
  })

  it('والأهدافُ التي تقرأ الحالةَ هي التي تحسمها قاعدةُ «أوّلُ وظيفة أم ترقية»', () => {
    expect(GOALS_NEEDING_EMPLOYMENT).toContain('first_job')
    expect(GOALS_NEEDING_EMPLOYMENT).toContain('promotion')
    expect(GOALS_NEEDING_EMPLOYMENT.length).toBeLessThanOrEqual(4)
  })
})
