/* قبولُ طلب التعديل — ما يُقاس بلا قاعدة (١ أكتوبر ٢٠٢٦).

   ① أيُّ إصدارٍ قرأه صاحبُ الطلب: «حدِّث نصَّ العروض المفتوحة» يكتب الحاضرَ
      فوق عرضٍ طُلب تعديلُه، فلا يُقاس ما تغيّر من صفٍّ حُدّث تحته.
   ② والمسوّدةُ لا تخرج بسطر «اكتب هنا».
   ③ ورسالةُ «يبقى العرضُ كما هو» لا تقول «لم يتغيّر فيه حرف» عن نصٍّ تغيّر.

   وقياسُ ما يخرج من الخدمة نفسِها في
   `server/tests/trainer/contract-amendment-accept.test.ts`. */

import { describe, expect, it } from 'vitest'
import {
  AMENDMENT_PLACEHOLDER_AR, defaultAmendmentAcceptBodyAr, hasAmendmentPlaceholder, versionReadByRequester,
} from '../../application/trainer/contract-resign'
import { amendmentAnsweredMail } from '../../../server/services/trainer-decision-mail'
import { renderMail } from '../../../server/services/mail-template'

const ASKED = '2026-09-30T10:00:00Z'

describe('ما قرأه صاحبُ الطلب', () => {
  it('⚠️ حُدّث بعد طلبه: ما قرأه هو السابق', () => {
    expect(versionReadByRequester({
      bodyVersion: 'v22', bodyPrevVersion: 'v21',
      bodyUpdatedAt: '2026-10-01T09:00:00Z', amendmentRequestedAt: ASKED,
    })).toBe('v21')
  })

  it('وحُدّث قبل طلبه: قرأ المحدَّث', () => {
    expect(versionReadByRequester({
      bodyVersion: 'v22', bodyPrevVersion: 'v21',
      bodyUpdatedAt: '2026-09-29T09:00:00Z', amendmentRequestedAt: ASKED,
    })).toBe('v22')
  })

  it('ولم يُحدَّث قطّ: ما في صفّه', () => {
    expect(versionReadByRequester({ bodyVersion: 'v21', amendmentRequestedAt: ASKED })).toBe('v21')
  })
})

describe('المسوّدة', () => {
  it('بلا جوابٍ مكتوب: سطرٌ يُستبدَل، ويُعرَف أنّه لم يُستبدَل', () => {
    const body = defaultAmendmentAcceptBodyAr('اتفاقية تقديم خدمات تدريبية')
    expect(body).toContain(AMENDMENT_PLACEHOLDER_AR)
    expect(hasAmendmentPlaceholder(body)).toBe(true)
  })

  it('وما كتبه الموظّفُ في اللوح يحلّ محلّه — فلا يُكتب الجوابُ مرّتين', () => {
    const body = defaultAmendmentAcceptBodyAr('اتفاقية', 'قبلنا أن نتحمّل رسومَ مصرفنا.')
    expect(body).toContain('قبلنا أن نتحمّل رسومَ مصرفنا.')
    expect(hasAmendmentPlaceholder(body)).toBe(false)
  })
})

describe('«يبقى العرضُ كما هو» يصدق فيما بقي', () => {
  const base = {
    fullName: 'محمّد', reference: 'TR-1', title: 'اتفاقية', replyAr: 'لا نستطيع تغييرَ البند الرابع',
    url: 'https://x.test/c/abc', expiresOnAr: '١٥ أكتوبر ٢٠٢٦',
  }

  /* ═══ وما تغيّر يُقال سطرا وملخّصا لا نقاطا (١ أكتوبر ٢٠٢٦) ═══
     كان يُقاس هنا أنّ النقطةَ نفسَها تُقال. وقرارُ صاحب المنصّة لمن طلب تعديلا:
     «في سطرٍ واحد… لا نريد أن نقول كلَّ شيءٍ عدّلناه… وملخّصا عنها بطريقةٍ
     مختصرة» — فيُقال إنّا عدّلنا، وأبوابُ ذلك، والنقاطُ في العقد. */
  it('⚠️ تغيّر نصُّه بعد طلبه: يُقال إنّا عدّلنا وأبوابُ ذلك — لا النقاط، ولا «لم يتغيّر فيه حرف»', () => {
    const doc = amendmentAnsweredMail({
      ...base, changeGroups: [{ titleAr: 'الصرف — البند 4', itemsAr: ['تتحمّل الأكاديميّةُ رسومَ مصرفها.'] }],
    })
    const { text } = renderMail(doc.doc)
    expect(text).not.toContain('لم يتغيّر فيه حرف')
    expect(text, 'لم يُقل إنّا عدّلنا العقد').toContain('أجرينا على العقد توضيحاتٍ وتعديلاتٍ')
    expect(text, 'لم يُسمَّ بابُ التعديل').toContain('وشملت: الصرف.')
    expect(text, 'قيلت النقطةُ كاملةً لمن طلب تعديلا').not.toContain('تتحمّل الأكاديميّةُ رسومَ مصرفها.')
  })

  it('ولم يتغيّر: يُقال ذلك كما كان', () => {
    const { text } = renderMail(amendmentAnsweredMail({ ...base, changeGroups: [] }).doc)
    expect(text).toContain('لم يتغيّر فيه حرف')
  })
})
