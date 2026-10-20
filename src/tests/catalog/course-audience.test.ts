/* «لمن هذه الدورة» — من الكتالوج ومن مدرّبي شعبها (٢٠ أكتوبر ٢٠٢٦).

   الحارسُ على ما يُعرض: دورةٌ بلا شعبةٍ يمتلئ قسمُها من الكتالوج، ودورةٌ لها شعبٌ يُضاف إليه ما اختاره
   مدرّبوها — مرتّبا بعدد من اختاره، في حدّه. والنصُّ بلا تشكيل. والمستوى و«قبلها» سقطا منه بقرار
   صاحب المنصّة: «موجودٌ داخل تفاصيل الشعبة». */

import { describe, expect, it } from 'vitest'
import { courseAudienceView, MAX_SHOWN_GOALS, MAX_SHOWN_STAGES } from '@/application/catalog/course-audience'
import { cohortOptionsFrom } from '@/services/cohort-prices'
import { CASE_MARKS } from '@/application/text/plain-ar'
import { courseFullById } from '@/data/courses'

const course = { targetAudience: 'من يتقدّم كثيرا بلا ردّ، أو يصل إلى المقابلةِ ثمّ يرتبك بإجاباتٍ محفوظةٍ لا تُقنع.' }
const none = { stages: [], goals: [] }

describe('لمن هذه الدورة', () => {
  it('⚠️ بلا شعبة: وصفُ الكتالوج وحدَه، بلا تشكيلٍ إلّا الشدّة', () => {
    const v = courseAudienceView(course, [])
    expect(v.lead).toBe('من يتقدّم كثيرا بلا ردّ، أو يصل إلى المقابلة ثمّ يرتبك بإجابات محفوظة لا تقنع.')
    expect(v).toMatchObject({ stages: [], goals: [], fromCohorts: 0 })
  })

  it('⚠️ كلُّ دورةٍ في الكتالوج يمتلئ قسمُها بوصفٍ بلا تشكيل', () => {
    for (const id of ['C-CAR-101', 'C-JOB-104', 'C-BIZ-101']) {
      const v = courseAudienceView(courseFullById(id)!, [])
      expect(v.lead, id).toBeTruthy()
      expect(v.lead, id).not.toMatch(CASE_MARKS)
    }
  })

  it('⚠️ مع الشعب: ما اختاره مدرّبوها — الأكثرُ اختيارا أوّلا، ثمّ ترتيبُ التشخيص', () => {
    const v = courseAudienceView(course, [
      { audience: { stages: ['experienced', 'fresh_graduate'], goals: ['promotion'] } },
      { audience: { stages: ['fresh_graduate', 'university_student'], goals: ['first_job', 'promotion'] } },
    ])
    expect(v.stages).toEqual(['خريج حديث', 'طالب جامعي', 'موظف ذو خبرة'])
    expect(v.goals).toEqual(['التقدم أو الترقية في عملي', 'الحصول على أول وظيفة'])
    expect(v.fromCohorts).toBe(2)
  })

  it('وفي حدّه: أربعُ مراحلَ وثلاثةُ أهداف — وشعبةٌ لم تختر شيئا لا تُعدّ', () => {
    const v = courseAudienceView(course, [
      { audience: { stages: ['university_student', 'fresh_graduate', 'early_career'], goals: ['first_job', 'practical_skills'] } },
      { audience: { stages: ['experienced', 'manager', 'senior_manager'], goals: ['promotion', 'leadership_prep'] } },
      { audience: none },
    ])
    expect(v.stages).toHaveLength(MAX_SHOWN_STAGES)
    expect(v.goals).toHaveLength(MAX_SHOWN_GOALS)
    expect(v.fromCohorts).toBe(2)
  })

  it('⚠️ وما يصل من الخادم يُصفّى: رمزٌ مخترَعٌ يسقط، وخادمٌ أقدمُ بلا الحقل لا يكسر شيئا', () => {
    const base = { courseId: 'C-1', status: 'open', price: 100, currency: 'USD', startsAt: null }
    const map = cohortOptionsFrom([
      { ...base, id: 'a', audience: { stages: ['manager', 'astronaut'], goals: ['promotion', 'x'] } },
      { ...base, id: 'b' },
    ])
    const [a, b] = map.get('C-1')!
    expect(a.audience).toEqual({ stages: ['manager'], goals: ['promotion'] })
    expect(b.audience).toEqual({ stages: [], goals: [] })
  })
})
