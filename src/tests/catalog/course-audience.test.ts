/* «لمن هذه الدورة» — من الكتالوج ومن مدرّبي شعبها (٢٠ أكتوبر ٢٠٢٦).

   الحارسُ على ما يُعرض: دورةٌ بلا شعبةٍ يمتلئ قسمُها من الكتالوج، ودورةٌ لها شعبٌ يُضاف إليه ما اختاره
   مدرّبوها — مرتّبا بعدد من اختاره، في حدّه — والمستوى من المدرّبين أوّلا. والنصُّ بلا تشكيل. */

import { describe, expect, it } from 'vitest'
import { courseAudienceView, MAX_SHOWN_GOALS, MAX_SHOWN_STAGES } from '@/application/catalog/course-audience'
import { cohortOptionsFrom } from '@/services/cohort-prices'
import { CASE_MARKS } from '@/application/text/plain-ar'
import { courseFullById } from '@/data/courses'

const course = {
  targetAudience: 'من يتقدّم كثيرا بلا ردّ، أو يصل إلى المقابلةِ ثمّ يرتبك بإجاباتٍ محفوظةٍ لا تُقنع.',
  prerequisites: 'يُفضَّل إتمام «دورة ملفّك المهنيّ» أولا ضمن المسار نفسه.',
  level: 'تأسيسي–تطبيقي',
}
const none = { stages: [], goals: [] }

describe('لمن هذه الدورة', () => {
  it('⚠️ بلا شعبة: الكتالوجُ وحدَه — وصفُها ومستواها وما قبلها، بلا تشكيلٍ إلّا الشدّة', () => {
    const v = courseAudienceView(course, [])
    expect(v.lead).toBe('من يتقدّم كثيرا بلا ردّ، أو يصل إلى المقابلة ثمّ يرتبك بإجابات محفوظة لا تقنع.')
    expect(v.prerequisites).toBe('يفضّل إتمام «دورة ملفّك المهنيّ» أولا ضمن المسار نفسه.')
    expect(v.level).toBe('من مبتدئ إلى متوسّط')
    expect(v).toMatchObject({ stages: [], goals: [], fromCohorts: 0 })
  })

  it('⚠️ كلُّ دورةٍ في الكتالوج يمتلئ قسمُها: وصفٌ ومستوًى على سلّم الشعبة وما قبلها', () => {
    const ids = ['C-CAR-101', 'C-BIZ-101']
    for (const id of ids) {
      const full = courseFullById(id)!
      const v = courseAudienceView(full, [])
      expect(v.lead, id).toBeTruthy()
      expect(v.level, id).toMatch(/مبتدئ|متوسّط|متقدّم/)
      expect(`${v.lead}${v.prerequisites}`, id).not.toMatch(CASE_MARKS)
    }
  })

  it('⚠️ مع الشعب: ما اختاره مدرّبوها — الأكثرُ اختيارا أوّلا، ثمّ ترتيبُ التشخيص', () => {
    const v = courseAudienceView(course, [
      { level: null, audience: { stages: ['experienced', 'fresh_graduate'], goals: ['promotion'] } },
      { level: null, audience: { stages: ['fresh_graduate', 'university_student'], goals: ['first_job', 'promotion'] } },
    ])
    expect(v.stages).toEqual(['خريج حديث', 'طالب جامعي', 'موظف ذو خبرة'])
    expect(v.goals).toEqual(['التقدم أو الترقية في عملي', 'الحصول على أول وظيفة'])
    expect(v.fromCohorts).toBe(2)
  })

  it('وفي حدّه: أربعُ مراحلَ وثلاثةُ أهداف — وشعبةٌ لم تختر شيئا لا تُعدّ', () => {
    const v = courseAudienceView(course, [
      { level: null, audience: { stages: ['university_student', 'fresh_graduate', 'early_career'], goals: ['first_job', 'practical_skills'] } },
      { level: null, audience: { stages: ['experienced', 'manager', 'senior_manager'], goals: ['promotion', 'leadership_prep'] } },
      { level: null, audience: none },
    ])
    expect(v.stages).toHaveLength(MAX_SHOWN_STAGES)
    expect(v.goals).toHaveLength(MAX_SHOWN_GOALS)
    expect(v.fromCohorts).toBe(2)
  })

  it('⚠️ المستوى من المدرّبين قبل الكتالوج — ومدى الشعب مجموعا', () => {
    const one = courseAudienceView(course, [{ level: { from: 'advanced', to: 'advanced' }, audience: none }])
    expect(one.level).toBe('متقدّم')
    const two = courseAudienceView(course, [
      { level: { from: 'intermediate', to: 'intermediate' }, audience: none },
      { level: { from: 'beginner', to: 'intermediate' }, audience: none },
      { level: { from: 'intermediate', to: 'advanced' }, audience: none },
    ])
    expect(two.level).toBe('من مبتدئ إلى متقدّم')
  })

  it('⚠️ وما يصل من الخادم يُصفّى: رمزٌ مخترَعٌ يسقط، وخادمٌ أقدمُ بلا الحقلين لا يكسر شيئا', () => {
    const base = { courseId: 'C-1', status: 'open', price: 100, currency: 'USD', startsAt: null }
    const map = cohortOptionsFrom([
      { ...base, id: 'a', level: { from: 'advanced', to: 'beginner' }, audience: { stages: ['manager', 'astronaut'], goals: ['promotion', 'x'] } },
      { ...base, id: 'b' },
    ])
    const [a, b] = map.get('C-1')!
    expect(a.level).toEqual({ from: 'beginner', to: 'advanced' })
    expect(a.audience).toEqual({ stages: ['manager'], goals: ['promotion'] })
    expect(b).toMatchObject({ level: null, audience: { stages: [], goals: [] } })
  })
})
