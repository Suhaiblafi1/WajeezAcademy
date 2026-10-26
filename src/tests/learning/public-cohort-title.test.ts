/* المتعلّمُ لا يرى رقمَ الشعبة (`publicCohortTitleAr` في `application/learning/cohort-title.ts`، ٢٦ أكتوبر ٢٠٢٦).

   «Remove "- شعبة 2" from the class titles» (صاحب المنصّة). يحرس: أنّ الذيلَ يُنزع بأيّ شرطةٍ وأيّ أرقام، وأنّ
   ما في وسط الاسم لا يُمسّ، وأنّ اسما ليس فيه إلّا الرقمُ يبقى — وأنّ خياراتِ الشراء كلَّها تمرّ به. */

import { describe, expect, it } from 'vitest'
import { publicCohortTitleAr } from '@/application/learning/cohort-title'
import { cohortOptionsFrom } from '@/services/cohort-prices'

describe('اسم الشعبة بلا رقمها', () => {
  it.each([
    ['ثقافة الذكاء الاصطناعي: من الوعي إلى التطبيق (AI Literacy)- شعبة 2', 'ثقافة الذكاء الاصطناعي: من الوعي إلى التطبيق (AI Literacy)'],
    ['إدارة المشاريع — شعبة ١', 'إدارة المشاريع'],
    ['إدارة المشاريع – شعبة 12', 'إدارة المشاريع'],
    ['إدارة المشاريع (شعبة ٣)', 'إدارة المشاريع'],
    ['إدارة المشاريع - شعبة ٢ ', 'إدارة المشاريع'],
  ])('⚠️ %s', (from, to) => {
    expect(publicCohortTitleAr(from)).toBe(to)
  })

  it('⚠️ وما ليس ذيلا لا يمس — ولا اسم بلا رقم', () => {
    expect(publicCohortTitleAr('شعبة 2 من إدارة المشاريع')).toBe('شعبة 2 من إدارة المشاريع')
    expect(publicCohortTitleAr('الذكاء الاصطناعي مساعدك الشخصي: ابحث عن وظيفة')).toBe('الذكاء الاصطناعي مساعدك الشخصي: ابحث عن وظيفة')
    expect(publicCohortTitleAr('دورة الشعبة الصباحية')).toBe('دورة الشعبة الصباحية')
  })

  it('⚠️ واسم ليس فيه إلا الرقم يبقى — لا صندوق بلا اسم', () => {
    expect(publicCohortTitleAr('شعبة 1')).toBe('شعبة 1')
    expect(publicCohortTitleAr('— شعبة ٢')).toBe('— شعبة ٢')
  })

  it('⚠️ وخيارات الشراء كلها تمر به — المنتقي والسلة وتبديل الشعبة', () => {
    const [opt] = cohortOptionsFrom([{
      id: 'c-1', courseId: 'C-1', title: 'إدارة المشاريع - شعبة 2', status: 'open', price: 100, currency: 'USD',
      startsAt: '2099-12-01T00:00:00.000Z', seatsLeft: 10, trainers: [], sessions: [],
    }]).get('C-1') ?? []
    expect(opt?.title).toBe('إدارة المشاريع')
  })
})
