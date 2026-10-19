/* قائمةُ بريد المتعلّم — لا مفتاحَ مكتوبٌ خطأً، ولا خارجَ ما قرّره صاحبُ المنصّة.

   مفتاحٌ في القائمة بحرفٍ ناقص لا يُسقط شيئا: يبقى خبرُه جرسا ولا يخرج بريدُه، ولا يعلم أحد.
   فكلُّ مفتاحٍ فيها له صنف. والصنفُ من «المال» أو «تغيير في شعبتك» — أو هو تحرّكُ جدول الشعبة
   نفسُه — لا تذكيرٌ ولا تقدّم: القرارُ (١٩ أكتوبر ٢٠٢٦) «المالُ وتغيّرُ الشعبة» وحدَهما.
   والسلوكُ نفسُه — صفُّ البريد بجانب الجرس — في `server/tests/notifications/learner-email.test.ts`. */

import { describe, expect, it } from 'vitest'
import { LEARNER_EMAIL_KEYS, alsoByEmail } from '@/application/notifications/learner-email'
import { categoryForTemplate } from '@/application/notifications/categories'

describe('قائمةُ بريد المتعلّم', () => {
  it('كلُّ مفتاحٍ فيها له صنف — فلا حرفَ ناقصا يُسكت بريده', () => {
    for (const k of LEARNER_EMAIL_KEYS) expect(categoryForTemplate(k), k).not.toBeNull()
  })

  it('ولا يخرج عن المال وتغيّر الشعبة', () => {
    for (const k of LEARNER_EMAIL_KEYS) {
      const cat = categoryForTemplate(k)?.key
      const ok = cat === 'money' || cat === 'enrollment_change' || k === 'cohort.schedule_changed'
      expect(ok, `${k} (${cat}) خارجَ ما قُرّر`).toBe(true)
    }
  })

  it('وللمتعلّم وحدَه، ومن الجرس وحدَه، وما لم يُمنع', () => {
    const base = { channel: 'in_app', templateKey: 'payment.succeeded' }
    expect(alsoByEmail(base)).toBe(true)
    expect(alsoByEmail({ ...base, audience: 'trainer' })).toBe(false)
    expect(alsoByEmail({ ...base, channel: 'email' })).toBe(false)
    expect(alsoByEmail({ ...base, skipEmail: true })).toBe(false)
    expect(alsoByEmail({ ...base, templateKey: 'session.reminder.24h' })).toBe(false)
  })
})
