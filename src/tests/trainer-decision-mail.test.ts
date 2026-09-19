/* ما يصل المتقدّمَ عند القرار وعند التذكير — حارسُ نصٍّ يقرؤه إنسانٌ مرّةً.

   ═══ ولماذا في المسار السريع ═══

   لأنّ ما يحرسه دالّاتٌ خالصة: تأخذ اسما ورقما وتردّ رسالة. فلا قاعدةَ
   بيانات ولا خادم ولا بذرَ أدوار — وحارسٌ ثمنُه ملّي ثانيةٌ يُشغَّل في كلّ
   تغيير، وحارسٌ ثمنُه اثنتا عشرة دقيقةً لا يُشغَّل.

   ═══ وما يُفحص هنا ═══

   ① **سببُ الرفض لا يسافر** — يُمرَّر إلى `decisionMailFor` كما يُمرَّر في
      القرار الحقيقيّ، ثمّ يُفتَّش عنه في النصّ والـHTML فلا يوجد. ولو وُصل
      يوما بقالب الرفض سقط هذا السطر.
   ② **ولا زرَّ في رسالة الرفض** — لا شاشةَ تُفتح بعد القرار.
   ③ **وقائمةُ الانتظار تحمل ملاحظتَها** — وإلّا لم يكن الإسقاطُ قرارا بل عطبا
      عامًّا، ولم يُعرف الفرقُ بينهما.
   ④ **وتذكيرُ الحجز زرُّه إلى صفحة الطلب** — لا إلى التقويم رأسا: قرارُ صاحب
      المنصّة. والتقويمُ رابطٌ في المتن لمن تعذّر دخولُه. */

import { describe, expect, it } from 'vitest'
import {
  bookingReminderMail, decisionMailFor, rejectionMail, waitlistMail,
} from '../../server/services/trainer-decision-mail'
import { APPLICANT_STATUS } from '@/application/trainer/application-options'
import { renderMail, type MailBlock } from '../../server/services/mail-template'

const NAME = 'سلمى العمري'
const REF = 'WJ-TR-2026-00041'
/** ما يكتبه المراجعُ لعينه هو — لا لعين صاحب الطلب */
const INTERNAL_NOTE = 'الخبرةُ في المجال أقلُّ ممّا تحتاجه الشعبةُ المفتوحة'

const rendered = (doc: Parameters<typeof renderMail>[0]) => renderMail(doc)

describe('رسالةُ الاعتذار', () => {
  it('سببُ المراجعة لا يصل صاحبَ الطلب — نصًّا ولا HTML', () => {
    const mail = decisionMailFor('reject', { fullName: NAME, reference: REF, noteAr: INTERNAL_NOTE })
    const out = rendered(mail.doc)
    expect(out.text, 'سببُ الرفض خرج في النصّ الخامّ').not.toContain(INTERNAL_NOTE)
    expect(out.html, 'سببُ الرفض خرج في الـHTML').not.toContain(INTERNAL_NOTE)
    /* ولا عنوانَ يُمهّد له فارغا — «وممّا دار في مراجعتنا» ثمّ لا شيء */
    expect(out.text).not.toContain('وممّا دار في مراجعتنا')
    expect(out.text).not.toContain('وممّا كُتب في المراجعة')
  })

  it('ولا زرَّ فيها ولا سطرَ ملحقٌ بعد الخبر — تُقال كاملةً ثمّ تسكت', () => {
    const { doc } = rejectionMail({ fullName: NAME, reference: REF })
    expect(doc.blocks.filter((b: MailBlock) => b.kind === 'cta'), 'زرٌّ في رسالة اعتذار').toHaveLength(0)
    /* والسطرُ الخافتُ تحتها حُذف بقرار صاحب المنصّة (١٩ سبتمبر): «لا داعي
       لهذه الجملة». والدعوةُ إلى العودة موضعُها صفحةُ الحالة — تُفحص أدناه. */
    expect(doc.blocks.filter((b: MailBlock) => b.kind === 'note'), 'عاد السطرُ الملحقُ بعد الخبر').toHaveLength(0)
    /* وآخرُ ما فيها رقمُ الطلب — لا شيءَ بعده */
    expect(doc.blocks[doc.blocks.length - 1].kind, 'الرسالةُ لا تنتهي عند رقم الطلب').toBe('facts')
  })

  it('وتحمل رقمَ الطلب — فيُسأل به إن سأل', () => {
    const mail = rejectionMail({ fullName: NAME, reference: REF })
    expect(mail.subject).toContain(REF)
    const facts = mail.doc.blocks.find((b: MailBlock) => b.kind === 'facts')
    expect(facts && facts.kind === 'facts' && facts.rows.some((r) => r.value === REF)).toBe(true)
  })

  it('ولا تَعِد بمدّةِ انتظارٍ لا يقيسها شيء — لا في البريد ولا في الشاشة', () => {
    /* ═══ ما نُقض هنا ═══

       كان النصّان يقولان «يمكنك التقديم مجددا بعد ستة أشهر». ولا حاجزَ
       لها في الشيفرة: `submitPhase1` تردّ من له طلبٌ حيٌّ وحدَه، و`rejected`
       نهائيّة — فمن رُدّ يُقبل طلبُه في الغد. فالنصُّ يصرف عمّن كان يعود.

       وقرارُ صاحب المنصّة (١٩ سبتمبر ٢٠٢٦) حذفُها من الموضعَين معا. وهما
       يُفحصان هنا جميعا: بريدٌ بلا مدّة وشاشةٌ بمدّةٍ تُنتج التناقضَ نفسَه
       الذي حُذفت المدّةُ لأجله. */
    const WAIT_PROMISE = /(بعد|خلال)\s+\S+\s*(أشهر|شهرا|شهر|سنة|أسبوع)/
    const out = rendered(rejectionMail({ fullName: NAME, reference: REF }).doc)
    expect(out.text, 'رسالةُ الاعتذار تَعِد بمدّةِ انتظار').not.toMatch(WAIT_PROMISE)
    expect(APPLICANT_STATUS.rejected.explain, 'شاشةُ الحالة تَعِد بمدّةِ انتظار')
      .not.toMatch(WAIT_PROMISE)
    /* والبابُ يبقى مقولا في موضعه — صفحةُ الحالة. والحذفُ كان للمدّة لا
       للدعوة، فلو ذهبت الدعوةُ من هناك أيضا لم يبقَ للمردود طريقٌ يُقال له. */
    expect(APPLICANT_STATUS.rejected.explain, 'ذهبت الدعوةُ إلى العودة من صفحة الحالة')
      .toContain('تتقدّم من جديد')
  })

  it('وهي أربعُ حركاتٍ لا سطرٌ واحد: شكرٌ، ومراجعةٌ، وقرارٌ، وبابٌ يبقى', () => {
    const { doc } = rejectionMail({ fullName: NAME, reference: REF })
    const paragraphs = doc.blocks.filter((b: MailBlock) => b.kind === 'p')
    expect(paragraphs.length, 'اختُصرت الرسالةُ إلى سطرٍ يُقرأ حكما').toBeGreaterThanOrEqual(4)
    /* وسطرُ المعاينة مكتوبٌ صراحةً: بلاه أخذ الصندوقُ «مرحبا فلان،» */
    expect(doc.preheader, 'بلا سطرِ معاينةٍ يقرأ الصندوقُ التحيّةَ وحدَها').toBeTruthy()
  })
})

describe('رسالةُ قائمة الانتظار', () => {
  it('تحمل ملاحظةَ المراجعة — فالإسقاطُ في الرفض قرارٌ لا عطبٌ عامّ', () => {
    const mail = decisionMailFor('waitlist', { fullName: NAME, reference: REF, noteAr: INTERNAL_NOTE })
    expect(rendered(mail.doc).text).toContain(INTERNAL_NOTE)
  })

  it('وبلا ملاحظةٍ لا يبقى عنوانٌ يُمهّد لفراغ', () => {
    const { doc } = waitlistMail({ fullName: NAME, reference: REF })
    expect(doc.blocks.some((b: MailBlock) => b.kind === 'h')).toBe(false)
    expect(doc.blocks.some((b: MailBlock) => b.kind === 'callout')).toBe(false)
  })
})

describe('تذكيرُ من لم يحجز', () => {
  const STATUS = 'https://example.test/join-trainer/status'
  const BOOKING = 'https://calendly.com/x/y?email=s%40x.com'
  const mail = bookingReminderMail({ fullName: NAME, reference: REF, statusUrl: STATUS, bookingUrl: BOOKING })

  it('زرُّها إلى صفحة الطلب لا إلى التقويم رأسا', () => {
    const cta = mail.doc.blocks.find((b: MailBlock) => b.kind === 'cta')
    expect(cta, 'لا زرَّ في رسالةٍ كلُّ غرضِها نقرةٌ واحدة').toBeTruthy()
    expect(cta && cta.kind === 'cta' && cta.href).toBe(STATUS)
  })

  it('والتقويمُ رابطٌ في المتن — مخرجٌ لمن تعذّر دخولُه، لا زرٌّ ثانٍ', () => {
    const inText = mail.doc.blocks.some((b: MailBlock) =>
      b.kind === 'p' && Array.isArray(b.text)
      && b.text.some((part) => typeof part !== 'string' && part.href === BOOKING))
    expect(inText, 'رابطُ التقويم مفقودٌ من المتن').toBe(true)
    /* ولا يصير زرّا ثانيا: القالبُ زرُّه واحد، وزرّان يتنازعان النقرة */
    expect(mail.doc.blocks.filter((b: MailBlock) => b.kind === 'cta')).toHaveLength(1)
  })

  it('ورقمُ الطلب في الموضوع وفي جدول الحقائق', () => {
    expect(mail.subject).toContain(REF)
    const facts = mail.doc.blocks.find((b: MailBlock) => b.kind === 'facts')
    expect(facts && facts.kind === 'facts' && facts.rows.some((r) => r.value === REF)).toBe(true)
  })

  it('والعنوانان يخرجان في النصّ الخامّ — فمن عطّل الـHTML يبلغ موعدَه', () => {
    const out = rendered(mail.doc)
    expect(out.text).toContain(STATUS)
    expect(out.text).toContain(BOOKING)
  })
})
