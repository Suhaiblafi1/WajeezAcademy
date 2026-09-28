/* رابطُ حجز جلسة التهيئة يصل في رسالة اعتماد التوقيع — قابلا للنقر.

   قرارُ صاحب المنصّة (٢٨ سبتمبر ٢٠٢٦): «once we approve their signature, the
   email they receive.. i need you add a link of my calendly so they can book a
   session if they need assistant in comleting their profile (materials)».

   ═══ ولمَ يُقاس على الرسالة المصيَّرة لا على الشيفرة ═══

   `richHtml` **لا يُلقِّم الروابطَ العارية**: النصُّ الخالصُ يُهرَّب
   (`esc`)، ولا يصير وسما `<a>` إلّا ما جاء جزءا `{ text, href }` أو رابطَ
   `note`/`cta`. فرابطٌ يُكتب في متن فقرةٍ نصّا يصل **حرفا ميّتا** لا يُنقر —
   وهو العطبُ نفسُه الذي أوصل `**` نجمتَين إلى ستّةَ عشرَ موضعا قبل أن يُقاس
   المطبوعُ لا المكتوب.

   فهذا الفحصُ يصيّر الرسالةَ ويسأل: أفي HTML وسمٌ يحمل الرابط؟ وأفي النصّ
   الخالص عنوانُه؟ (فمن يقرأ الرسالةَ نصّا بلا HTML يجده.) */

import { describe, expect, it } from 'vitest'
import { contractApprovedMail } from '../../../server/services/trainer-decision-mail'
import { renderMail } from '../../../server/services/mail-template'
import {
  ORIENTATION_BOOKING_URL, ORIENTATION_CTA_AR,
} from '../../application/trainer/orientation-session'

const BASE = {
  legalName: 'سُهيب الحسن',
  title: 'عقدُ تدريبٍ — الفصلُ الشتويّ',
  approvedOnAr: '٢٨ سبتمبر ٢٠٢٦',
  portalUrl: 'https://www.wajeezacademy.com/trainer',
}

/** العرضُ المشروطُ هو الحالُ التي تُفتح فيها البوّابةُ وتبدأ فيها المهلة */
const CONDITIONAL = { ...BASE, gatesActivation: true }
/** وبندٌ يُوثَّق على مدرّبٍ نشطٍ أصلا — لا بوّابةَ تُفتح ولا موادَّ تُنتظَر */
const PLAIN = { ...BASE, gatesActivation: false }

describe('رابطُ جلسة التهيئة في رسالة اعتماد التوقيع', () => {
  it('الرابطُ في الرسالة، و**وسما** يُنقر لا حرفا ميّتا', () => {
    const { html } = renderMail(contractApprovedMail(CONDITIONAL).doc)
    expect(html, 'الرابطُ غائبٌ عن الرسالة').toContain(ORIENTATION_BOOKING_URL)
    /* والوسمُ لا الحرف: `href="…"` يعني أنّه يُنقر */
    expect(html, 'الرابطُ نصٌّ لا يُنقر — و`richHtml` لا يُلقِّم العاريَ')
      .toMatch(new RegExp(`<a[^>]+href="${ORIENTATION_BOOKING_URL.replace(/[/.]/g, '\\$&')}"`))
  })

  it('ويصل من يقرأ النصَّ الخالصَ بلا HTML', () => {
    const { text } = renderMail(contractApprovedMail(CONDITIONAL).doc)
    expect(text, 'لا عنوانَ في النسخة النصّيّة').toContain(ORIENTATION_BOOKING_URL)
  })

  it('ويُقرأ عرضا لا واجبا — كما يقول البند 2-8', () => {
    const { text } = renderMail(contractApprovedMail(CONDITIONAL).doc)
    expect(text).toContain('إن أردتَ')
    expect(text, 'الجلسةُ حقٌّ لا التزام — والنصُّ يجب أن يقولَه')
      .toMatch(/حقٌّ لك لا التزامٌ عليك/)
  })

  it('واسمُ الزرّ من موضعه لا منسوخا — فلا نسختان تفترقان', () => {
    const { html } = renderMail(contractApprovedMail(CONDITIONAL).doc)
    expect(html).toContain(ORIENTATION_CTA_AR)
  })

  /* ولا يُعرَض على من لا موادَّ تُنتظَر منه: بندٌ يُوثَّق على مدرّبٍ نشطٍ
     أصلا لا بوّابةَ تُفتح له ولا مهلةَ تبدأ — فدعوةٌ إلى جلسةٍ عن «إعداد
     محاورك» تُقرأ عبثا، أو تُفهَم طلبا لعملٍ لا يُطلب منه. */
  it('ولا يُدعى إليها من لا طورَ موادَّ له', () => {
    const { html, text } = renderMail(contractApprovedMail(PLAIN).doc)
    expect(html, 'دُعي إلى جلسةِ موادَّ من لا موادَّ عليه').not.toContain(ORIENTATION_BOOKING_URL)
    expect(text).not.toContain(ORIENTATION_BOOKING_URL)
  })

  it('وما كانت الرسالةُ تقوله يبقى — فالنقلُ لم يُسقِطْ شيئا', () => {
    const { text } = renderMail(contractApprovedMail(CONDITIONAL).doc)
    /* الحقائقُ الثلاثُ التي كانت في الكتلة قبل استخراجها */
    expect(text).toContain(BASE.title)
    expect(text).toContain(BASE.approvedOnAr)
    expect(text, 'سقطت الإحالةُ إلى «عقدي»').toContain('عقدي')
    expect(text, 'سقط تذكيرُ البند الثاني: التأهيلُ لا يُلزم بإسناد')
      .toContain('التأهيلُ لدورةٍ لا يُلزم الأكاديميّةَ بإسنادها')
    expect(text, 'سقط زرُّ البوّابة').toContain(BASE.portalUrl)
  })

  it('وعنوانُ الرسالة وترويستُها كما كانا', () => {
    const mail = contractApprovedMail(CONDITIONAL)
    expect(mail.subject).toContain('اعتُمد عقدُك')
    expect(mail.subject).toContain(BASE.title)
    expect(mail.doc.heading).toContain('اعتُمد توقيعُك')
    expect(contractApprovedMail(PLAIN).doc.heading).toBe('اعتُمد عقدُك')
  })
})
