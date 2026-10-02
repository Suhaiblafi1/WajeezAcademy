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
   ④ **ودعوةُ الحجز زرُّها إلى صفحة الطلب حين لا يُمرَّر رابطُ تقويم** — وهو
      المسقَطُ الآمن. أمّا الوجهةُ المباشرةُ إلى التقويم (٢٤ سبتمبر ٢٠٢٦)
      فحارسُها `trainer/invite-only-booking`، لأنّها تلزمها حالُ البابَين. */

import { describe, expect, it } from 'vitest'
import {
  bookingReminderMail, decisionMailFor, draftReminderMail, rejectionMail, rejectionUndoneMail, waitlistMail,
  withdrawalUndoneMail,
} from '../../server/services/trainer-decision-mail'
import { renderMail, type MailBlock } from '../../server/services/mail-template'
import {
  conditionalOfferMail, finalApprovalMail, conditionReminderMail, conditionLapsedMail,
  type ConditionalOfferMailInput, type FinalApprovalMailInput,
  type ConditionReminderMailInput, type ConditionLapsedMailInput,
} from '../../server/services/trainer-decision-mail'
import { FEE_EXAMPLE_HEADING_AR } from '@/application/trainer/fee-example'
import { noFaultClauseOf, renderContractBodyAr } from '@/application/trainer/contract-body'
import { DEFAULT_REQUIRED_DOCUMENTS } from '@/application/trainer/contract-documents'
import { EXTENSION_DAYS, MATERIALS_WINDOW_DAYS } from '@/application/trainer/conditional-offer'

import { APPLICANT_STATUS } from '@/application/trainer/application-options'

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

/* ═══ دعوةُ من لم يحجز — طريقُها هنا، ونصُّها في حارسٍ آخر ═══

   صارت الرسالةُ **دعوةً** بعد أن كانت «بقيت خطوةٌ واحدة» (قرارُ صاحب المنصّة،
   ٢٢ سبتمبر ٢٠٢٦). والمفحوصُ هنا طريقُها: زرٌّ واحدٌ، ولا رابطَ ثانٍ في المتن،
   ورقمُ الطلب وحدَه في الحقائق — وهي قراراتُ ١٨ و١٩ سبتمبر، لا تسقط بتبدّل
   النبرة ولا بتبدّل الوجهة.

   ═══ ووجهةُ الزرّ صارت حالَين (٢٤ سبتمبر ٢٠٢٦) ═══

   التقويمُ مباشرةً لمن مُرِّر رابطُه، وصفحةُ الطلب مسقَطا حين لا يُمرَّر.
   والمفحوصُ هنا **المسقَطُ** وحدَه — تُبنى الرسالةُ بلا `bookingUrl` كما
   تُبنى حين يتعذّر. أمّا الحالُ المباشرةُ فمع سببها في
   `trainer/invite-only-booking`: بابُ الحجز هناك يُقفل ويُفتح، وهي فرعٌ منه.

   أمّا **ما تقوله** ومن تُرسَل إليه فحارسُهما `trainer/interview-invitation`:
   هناك يُفحص أنّ ألفاظَها ألفاظُ الوحدة المشتركة نفسُها التي تقرؤها بطاقةُ
   صفحته، وأنّها لا تطلب حجزا يومَ يُوقَف الحجز. */
describe('دعوةُ من لم يحجز — طريقُها', () => {
  const STATUS = 'https://example.test/join-trainer/status'
  const mail = bookingReminderMail({ fullName: NAME, reference: REF, statusUrl: STATUS })

  it('زرُّها يسقط إلى صفحة الطلب حين لا يُمرَّر رابطُ تقويم', () => {
    const cta = mail.doc.blocks.find((b: MailBlock) => b.kind === 'cta')
    expect(cta, 'لا زرَّ في رسالةٍ كلُّ غرضِها نقرةٌ واحدة').toBeTruthy()
    expect(cta && cta.kind === 'cta' && cta.href).toBe(STATUS)
  })

  it('وطريقٌ واحدٌ لا غير: زرٌّ واحدٌ ولا رابطَ ثانٍ في المتن', () => {
    /* ═══ ما حُذف هنا (١٩ سبتمبر ٢٠٢٦) ═══

       كان تحت الزرّ رابطُ التقويم المباشر «لمن تعذّر عليه الدخول»، وسطرٌ
       يدعوه إلى الردّ. وقرارُ صاحب المنصّة حذفُهما: «لا داعي لهذا النصّ».

       وغرضُ الرسالة نقرةٌ واحدة، فكلُّ وجهةٍ ثانيةٍ تقسم الانتباه. ومن تعذّر
       عليه الدخولُ يتابع طلبَه بالبريد وحدَه في `/join-trainer` ويحجز من
       تحتها — فالمخرجُ في المنتَج لا في الرسالة. */
    expect(mail.doc.blocks.filter((b: MailBlock) => b.kind === 'cta'), 'زرّان يتنازعان النقرة').toHaveLength(1)
    const linkInBody = mail.doc.blocks.some((b: MailBlock) =>
      (b.kind === 'p' || b.kind === 'note' || b.kind === 'callout') && Array.isArray(b.text))
    expect(linkInBody, 'عاد رابطٌ ثانٍ في متن الرسالة').toBe(false)
    expect(mail.doc.blocks.filter((b: MailBlock) => b.kind === 'note'), 'عاد سطرٌ ملحقٌ في الذيل').toHaveLength(0)
  })

  it('ورقمُ الطلب في الموضوع وفي جدول الحقائق — ولا صفَّ سواه', () => {
    expect(mail.subject).toContain(REF)
    const facts = mail.doc.blocks.find((b: MailBlock) => b.kind === 'facts')
    expect(facts && facts.kind === 'facts' && facts.rows.map((r) => r.value)).toEqual([REF])
  })

  it('وعنوانُ صفحة الطلب يخرج في النصّ الخامّ — فمن عطّل الـHTML يبلغ موعدَه', () => {
    expect(rendered(mail.doc).text).toContain(STATUS)
  })
})

/* ═══ نقضُ الاعتذار — والسببُ يسافر هنا وحدَه ═══

   قرارُ صاحب المنصّة (١٩ سبتمبر ٢٠٢٦): «عند رفض أيّ مدرّب أريد خيارَ التراجع
   عن الرفض مع ذكر السبب، والذي يصل للمتقدّم بالإيميل».

   وهو معكوسُ الحارس الأوّل في هذا الملفّ تماما، فيُقرآن معا: ما يُكتب عند
   الردّ لا يسافر، وما يُكتب عند نقضه يسافر بنصّه. ولو وُصل أحدُهما بقالب
   الآخر يوما سقط أحدُ الحارسَين. */
describe('رسالةُ التراجع عن الرفض', () => {
  const STATUS = 'https://example.test/join-trainer'
  const WHY = 'قرأنا شهادةَ الاعتماد بعد القرار فتبيّن أنّ الخبرةَ تفي بما تطلبه الشعبة'
  const mail = rejectionUndoneMail({ fullName: NAME, reference: REF, noteAr: WHY, statusUrl: STATUS })

  it('السببُ يصل صاحبَ الطلب بنصّه — نصًّا وHTML', () => {
    const out = rendered(mail.doc)
    expect(out.text, 'سببُ التراجع لم يصل في النصّ الخامّ').toContain(WHY)
    expect(out.html, 'سببُ التراجع لم يصل في الـHTML').toContain(WHY)
  })

  it('ولا تُقال بلا سبب — النوعُ يشترطه، فلا يمرّ نداءٌ بلا كلمة', () => {
    /* بنيةً لا اتّفاقا: `noteAr` إلزاميٌّ في هذه بخلاف أختَيها. والفحصُ على
       ما يقبله المترجم — ولو صار اختياريّا يوما لم يبقَ خطأٌ يُتوقَّع هنا،
       فيسقط `@ts-expect-error` نفسُه في `tsc` (توجيهٌ بلا خطأ خطأ). */
    const missing: Parameters<typeof rejectionUndoneMail>[0] = {
      fullName: NAME, reference: REF, statusUrl: STATUS,
      // @ts-expect-error — بلا سببٍ لا تُبنى الرسالةُ أصلا
      noteAr: undefined,
    }
    expect(missing.noteAr).toBeUndefined()
  })

  it('وتقول ما وقع في عنوانها — «عُدنا في قرارنا» لا «طلبك تحت المراجعة»', () => {
    /* من قرأ اعتذارا بالأمس ثمّ رأى عنوانا محايدا ظنّه رسالةً آليّةً مكرّرة */
    expect(mail.subject, 'الموضوعُ لا يقول إنّنا عُدنا').toContain('عُدنا')
    expect(mail.subject).toContain(REF)
    expect(mail.doc.preheader, 'بلا سطرِ معاينةٍ يقرأ الصندوقُ التحيّةَ وحدَها').toBeTruthy()
  })

  it('وزرُّها إلى صفحة متابعة الطلب — فالبابُ الذي أُغلق يُفتح بنقرة', () => {
    /* بخلاف رسالة الاعتذار: تلك بلا زرٍّ لأنّ لا شاشةَ تُفتح بعدها، وهذه
       طلبُها عاد حيّا — و`BOOKABLE_STATUSES` تقبل «قيد المراجعة». */
    const cta = mail.doc.blocks.find((b: MailBlock) => b.kind === 'cta')
    expect(cta, 'لا زرَّ إلى صفحة الطلب').toBeTruthy()
    expect(cta && cta.kind === 'cta' && cta.href).toBe(STATUS)
    expect(rendered(mail.doc).text, 'العنوانُ لا يخرج في النصّ الخامّ').toContain(STATUS)
  })

  it('ورقمُ الطلب فيها — فيُسأل به إن سأل', () => {
    const facts = mail.doc.blocks.find((b: MailBlock) => b.kind === 'facts')
    expect(facts && facts.kind === 'facts' && facts.rows.some((r) => r.value === REF)).toBe(true)
  })
})

/* ═══ وإعادةُ المسحوب — أختُ نقض الاعتذار (٢٩ سبتمبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «هناك حساباتٌ مسحوبة.. أرجو إعادتها». فالإعادةُ خبرٌ
   يصل صاحبَه بسببه كأختها — ويفترقان في جملة: من سحب طلبَه بيده لا يُفرض
   عليه ما تركه، فالرسالةُ تقول له إنّه إن لم يُرِد المضيَّ يردّ فنغلقه. */
describe('رسالةُ إعادة الطلب المسحوب', () => {
  const STATUS = 'https://example.test/join-trainer'
  const WHY = 'سُحب الطلبُ بخطأٍ في تطبيق ملفّ القرارات، وهو طلبٌ نريد المضيَّ فيه'
  const mail = withdrawalUndoneMail({ fullName: NAME, reference: REF, noteAr: WHY, statusUrl: STATUS })

  it('السببُ يصل صاحبَ الطلب بنصّه — نصًّا وHTML', () => {
    const out = rendered(mail.doc)
    expect(out.text, 'سببُ الإعادة لم يصل في النصّ الخامّ').toContain(WHY)
    expect(out.html, 'سببُ الإعادة لم يصل في الـHTML').toContain(WHY)
  })

  it('ولا تُقال بلا سبب — النوعُ يشترطه كأختها', () => {
    const missing: Parameters<typeof withdrawalUndoneMail>[0] = {
      fullName: NAME, reference: REF, statusUrl: STATUS,
      // @ts-expect-error — بلا سببٍ لا تُبنى الرسالةُ أصلا
      noteAr: undefined,
    }
    expect(missing.noteAr).toBeUndefined()
  })

  it('وتقول ما وقع — «أعدنا فتحَ طلبك» ورقمُه، لا «عُدنا في قرارنا» فذاك للمردود', () => {
    expect(mail.subject, 'الموضوعُ لا يقول إنّ الطلبَ أُعيد').toContain('أعدنا فتحَ طلبك')
    expect(mail.subject, 'رسالةُ المسحوب تقول ما يقوله المردود').not.toContain('عُدنا في قرارنا')
    expect(mail.subject).toContain(REF)
    expect(mail.doc.preheader, 'بلا سطرِ معاينةٍ يقرأ الصندوقُ التحيّةَ وحدَها').toBeTruthy()
  })

  it('ومن سحبه بيده لا يُفرض عليه — يردّ فنغلقه', () => {
    expect(rendered(mail.doc).text, 'لا تقول لمن سحب بيده إنّه يستطيع الإغلاق').toContain('نغلقه')
  })

  it('وزرُّها إلى صفحة متابعة الطلب، ورقمُه في حقائقها', () => {
    const cta = mail.doc.blocks.find((b: MailBlock) => b.kind === 'cta')
    expect(cta && cta.kind === 'cta' && cta.href).toBe(STATUS)
    const facts = mail.doc.blocks.find((b: MailBlock) => b.kind === 'facts')
    expect(facts && facts.kind === 'facts' && facts.rows.some((r) => r.value === REF)).toBe(true)
  })
})

/* ═══ تذكيرُ من بدأ ولم يُكمل ═══

   المسوّدةُ نصفُ طلبٍ عند الخادم: أكمل قسمَه الأوّل ثمّ أغلق الصفحة، ولا
   يعلم أنّ طلبَه لم يصلنا. وطلبه صاحبُ المنصّة فعلا يُضغط من قائمة الصفّ
   (٢٠ سبتمبر ٢٠٢٦). وما يُحرس: أن تقول ما وقع، وأن تفتح البابَ الذي يُكمل
   منه — لا نموذجا يبدأ من أوّله. */
describe('رسالةُ تذكير المسوّدة', () => {
  const STATUS = 'https://example.test/join-trainer/status'
  const mail = draftReminderMail({ fullName: NAME, reference: REF, statusUrl: STATUS })

  it('تقول إنّ ما كُتب محفوظٌ وإنّ الطلبَ لم يصل بعد — لا «شكرا لتقديمك»', () => {
    const out = rendered(mail.doc)
    expect(out.text, 'لا تقول إنّ المحفوظَ محفوظ').toContain('محفوظ')
    expect(out.text, 'لا تقول إنّ الطلبَ لم يصل المراجعةَ بعد').toContain('لم يصل')
    expect(mail.doc.preheader, 'بلا سطرِ معاينةٍ يقرأ الصندوقُ التحيّةَ وحدَها').toBeTruthy()
  })

  it('وزرُّها إلى صفحة الحالة — فيها «أكمل طلبك» يفتح النموذجَ على ما كُتب', () => {
    /* ولو فُتح النموذجُ من أوّله لظنّ أنّه يبدأ من الصفر، فيتركه ثانية */
    const cta = mail.doc.blocks.find((b: MailBlock) => b.kind === 'cta')
    expect(cta, 'لا زرَّ يُكمل منه').toBeTruthy()
    expect(cta && cta.kind === 'cta' && cta.href).toBe(STATUS)
    expect(rendered(mail.doc).text, 'العنوانُ لا يخرج في النصّ الخامّ').toContain(STATUS)
  })

  it('ولا تَعِد بحذفٍ ولا تقول «آخرُ تذكير» — المسوّدةُ لا تُحذف بمضيّ وقت', () => {
    const out = rendered(mail.doc).text
    expect(out, 'تَعِد بحذفٍ لا يقع').not.toMatch(/يُحذف|سيُحذف|تُحذف/)
    expect(out, 'تقول «آخرُ تذكير» ولا شيءَ يقيسه').not.toContain('آخر تذكير')
  })

  it('ورقمُ الطلب فيها وفي موضوعها — فيُسأل به إن سأل', () => {
    expect(mail.subject).toContain(REF)
    const facts = mail.doc.blocks.find((b: MailBlock) => b.kind === 'facts')
    expect(facts && facts.kind === 'facts' && facts.rows.some((r) => r.value === REF)).toBe(true)
  })
})

/* ═══ العرضُ المشروط والاعتمادُ النهائيّ — أوّلُ الطور وآخرُه ═══

   وهما البريدان اللذان طُلب نصُّهما. ويُفحَصان هنا لا في جولةِ الخادم لأنّ
   نصَّهما دالّتان خالصتان: تأخذان اسما وتاريخا وتردّان رسالة. */
describe('بريدُ العرض المشروط', () => {
  const OFFER: ConditionalOfferMailInput = {
    fullName: 'عبد الرحمن العتيبي',
    reference: 'WJ-TR-2026-00041',
    url: 'https://wajeezacademy.com/c/tok',
    expiresAt: new Date('2026-09-30T12:00:00Z'),
    orientationOnAr: 'الخميس 1 أكتوبر 2026، 7:00 م',
    orientationUrl: 'https://meet.example.com/wajeez',
    deadlineOnAr: '8 أكتوبر 2026',
    windowDays: 7,
    extensionDays: 2,
    requiredDocumentsAr: ['صورةُ الهويّة', 'شهادةُ الخبرة'],
    portalUrl: 'https://wajeezacademy.com/trainer',
  }
  const flat = (m: ReturnType<typeof conditionalOfferMail>) =>
    JSON.stringify(m.doc)

  it('عنوانُها يقول «عرضٌ مشروط» — لا «اكتمل اعتمادُك»', () => {
    const m = conditionalOfferMail(OFFER)
    expect(m.subject).toContain('الاتفاقيّة التدريبيّة')
    expect(m.subject, 'رقمُ الطلب لا يُقرأ في العنوان').toContain(OFFER.reference)
    expect(m.doc.heading, 'بُشِّر باعتمادٍ لم يقع').not.toMatch(/اكتمل اعتمادُك/)
    expect(flat(m), 'قيل له «عقد» والعرضُ مشروط').toMatch(/وهي اتفاقيّةٌ مشروطة/)
    /* ═══ ونجمتان كانتا تُطبَعان نجمتَين (٢٧ سبتمبر ٢٠٢٦) ═══

       كان هذا الفحصُ نفسُه يطابق `عرضٌ مشروطٌ\*\* لا عقدٌ نهائيّ` — أي أنّه
       **يحرس النجمتَين**. و`richHtml` لا يفسّر Markdown، فكانتا تصلان
       المدرّبَ حرفَين. ستَّ عشرةَ مرّةً في هذا الملفّ.

       فيُثبَّت نفيُهما في كلّ ما يُرسَل: ما لا مفسِّرَ له لا يُكتب. */
    expect(flat(m), 'عادت النجمتان تُطبَعان في نصٍّ يصل المدرّب').not.toContain('**')
  })

  /* ═══ والرسالةُ صارت خارطةً مرقّمة (٢٧ سبتمبر ٢٠٢٦) ═══

     بلاغُ صاحب المنصّة: «هي ليست عمليّة — يجب أن يكون فيها تفاصيلُ المرحلة
     الحاليّة والقادمة». فيُقاس أنّ الخطواتِ الخمسَ فيها، **وأنّ واحدةً منها
     وحدَها مُعلَّمةٌ `now`** — فخمسةٌ متساويةٌ لا تقول أين هو. */
  it('وتحمل خارطةَ الخطوات الخمس، وواحدةً وحدَها هي دورُه الآن', () => {
    const doc = conditionalOfferMail(OFFER).doc
    const steps = doc.blocks.filter((b) => b.kind === 'steps')
    expect(steps.length, 'لا خارطةَ خطواتٍ في رسالة إصدار العرض').toBe(1)
    const items = (steps[0] as { items: readonly { textAr: string; state?: string }[] }).items
    expect(items.length, 'الخطواتُ ليست خمسا').toBe(5)
    expect(items.filter((i) => i.state === 'now').length, 'لا خطوةَ واحدةٌ مُعلَّمةٌ دورَه الآن').toBe(1)
    expect(items[0].state, 'دورُه ليس الأولى — وهو لم يوقّع بعد').toBe('now')
    /* وآخرُها استقبالُ الطلبات: هو ما يريده، فلا تنتهي الخارطةُ دونه */
    expect(items[4].textAr).toMatch(/تبدأ باستقبال الطلبات/)
  })

  it('وجلستُه ومهلتُه ورابطُ حضوره فيها', () => {
    const body = flat(conditionalOfferMail(OFFER))
    expect(body).toContain(OFFER.orientationOnAr!)
    expect(body).toContain(OFFER.deadlineOnAr!)
    expect(body).toContain(OFFER.orientationUrl!)
    expect(body, 'المهلةُ بلا عدد').toMatch(/7 أيّام/)
  })

  /* ولا يُقال «أمامك سبعةٌ» بلا مبدإٍ: من قرأها عدَّها من يوم قراءته فظنّ
     نفسَه متأخّرا وهو في وقته — أو العكسُ وهو أسوأ. */
  it('ومن لم يُعرَف موعدُ جلسته يُقال له إنّه يصله — ولا تاريخَ يُخترَع', () => {
    const body = flat(conditionalOfferMail({
      ...OFFER, orientationOnAr: null, orientationUrl: null, deadlineOnAr: null,
    }))
    expect(body).toMatch(/ويصلك موعدُها/)
    expect(body).not.toContain(OFFER.orientationOnAr!)
    expect(body).not.toContain(OFFER.deadlineOnAr!)
  })

  /* ═══ ولا يُدعى إلى بابٍ لا يُفتح له (٢٧ سبتمبر ٢٠٢٦) ═══

     كانت تقول: «بوّابتُك تُفتح بتوقيعك — فادخلها من الآن». وهي دعوةٌ إلى
     بابٍ مقفل: من وقّع دورُه `trainer_applicant` ولا يملك `trainer.portal`،
     وبوّابتُه لا تُفتح إلّا باعتمادنا. فيُثبَّت نفيُها. */
  it('ولا يُقال له إنّ بوّابتَه تُفتح بتوقيعه — فالبابُ يُفتح باعتمادنا', () => {
    const body = flat(conditionalOfferMail(OFFER))
    expect(body, 'عادت تدعوه إلى بوّابةٍ لا تُفتح له').not.toMatch(/تُفتح بتوقيعك/)
    expect(body, 'لا يُقال متى تُفتح').toMatch(/تُفتح لك بوّابتُك على المنصّة/)
    expect(body, 'لا يُقال إنّ المهلةَ من الاعتماد').toMatch(/تبدأ يومَ نعتمد توقيعَك/)
  })

  it('وسطرُ الوثائق يُطبَع عند الحاجة وحدَها', () => {
    expect(flat(conditionalOfferMail(OFFER))).toMatch(/وما نحتاجه منك مع التوقيع/)
    expect(
      flat(conditionalOfferMail({ ...OFFER, requiredDocumentsAr: [] })),
      'سطرٌ فارغٌ في بريدِ إنسان',
    ).not.toMatch(/وما نحتاجه منك مع التوقيع/)
  })

  it('وتعرض المخرجَ إن لم يتحقّق الشرط', () => {
    const body = flat(conditionalOfferMail(OFFER))
    expect(body).toMatch(/فلا إخلالَ من أحد/)
    expect(body).toMatch(/تؤجّل التحاقَك إلى فصل التدريب القادم/)
  })

  /* ═══ الحارسُ المزدوج: المثالُ في المتن لا في البريد ═══

     جوابُ صاحب المنصّة «في العقد وحدَه». ونقضُ كلٍّ من الطرفَين يسقط على
     الآخر: فإن عاد المثالُ إلى البريد سقط هذا، وإن غاب عن المتن سقط حارسُه
     في `contract-body.test.ts`. */
  it('ولا مثالَ حسابيّا فيها — موضعُه متنُ العقد', () => {
    const body = flat(conditionalOfferMail(OFFER))
    expect(body, 'المثالُ عاد إلى البريد').not.toContain(FEE_EXAMPLE_HEADING_AR)
    expect(body, 'أرقامُ أتعابٍ في بريدٍ لا مثالَ فيه').not.toMatch(/مجموعُ هذا المثال/)
  })

  it('وزرٌّ واحدٌ إلى صفحة التوقيع', () => {
    const ctas = conditionalOfferMail(OFFER).doc.blocks.filter((b) => b.kind === 'cta')
    expect(ctas.length, 'زرّان في رسالةٍ واحدة').toBe(1)
    expect((ctas[0] as { href: string }).href).toBe(OFFER.url)
  })
})

describe('بريدُ الاعتماد النهائيّ', () => {
  const APPROVED: FinalApprovalMailInput = {
    fullName: 'عبد الرحمن العتيبي',
    reference: 'WJ-TR-2026-00041',
    approvedCoursesAr: ['دورةُ الحوار الأسريّ', 'دورةُ الحدود'],
    contractUrl: null,
    portalUrl: 'https://wajeezacademy.com/trainer',
    approvedOnAr: '9 أكتوبر 2026',
    sealed: 'now',
  }

  it('تقول إنّ الشرطَ تحقّق وإنّ العرضَ صار عقدا موقَّعا من الطرفَين', () => {
    const m = finalApprovalMail(APPROVED)
    expect(m.subject).toMatch(/اعتُمدتَ مدرّبا/)
    expect(JSON.stringify(m.doc)).toMatch(/موقَّعا من الطرفَين/)
  })

  /* ═══ وتقول أيَّ خَتمٍ وقع (١ أكتوبر ٢٠٢٦) ═══
     صار توقيعُنا على العرض المشروط يقع مع اعتماد الدورات — فتقوله الرسالةُ التي
     تُرسَل حينها. ومن خُتم عرضُه يومَ اعتُمد توقيعُه (٢٧ سبتمبر — ١ أكتوبر) لا
     يُقال له «وقّعنا الآن». ومن لا عرضَ مشروطَ له لا يُقال له إنّ شرطَ عرضه تحقّق. */
  /* ويُقاس على متن الرسالة (أوّلُ فقرة) والترويسة كلٌّ وحدَه: سطرُ الترويسة
     يقولها أيضا، فقياسُ الرسالة جملةً يخضرّ عليه وإن سكت المتن — وقد وقع ذلك
     حين نُقض المتنُ وحدَه. */
  const firstP = (m: ReturnType<typeof finalApprovalMail>) =>
    (m.doc.blocks.find((b) => b.kind === 'p') as { text: string }).text
  it('⚠️ وقّعنا الآن — يُقال صريحا، ولا يُقال لمن خُتم قبلُ', () => {
    const now = finalApprovalMail({ ...APPROVED, sealed: 'now' })
    expect(firstP(now), 'لم يقل متنُ الرسالة إنّا وقّعنا مع اعتماد دوراته').toMatch(/ووقّعنا العقدَ من جهتنا/)
    expect(now.doc.preheader, 'لم تقله الترويسة').toMatch(/ووقّعنا العقدَ من جهتنا/)
    const earlier = finalApprovalMail({ ...APPROVED, sealed: 'earlier' })
    expect(JSON.stringify(earlier.doc), 'قيل «وقّعنا» لمن وقّعنا عرضَه يومَ اعتماد توقيعه').not.toMatch(/وقّعنا العقدَ/)
    expect(firstP(earlier)).toMatch(/تحقّق شرطُ الاتفاقيّة/)
  })

  it('⚠️ ومن لا عرضَ مشروطَ له: لا شرطَ تحقّق ولا عقدَ يُدعى إليه', () => {
    const m = finalApprovalMail({ ...APPROVED, sealed: 'none', contractUrl: 'https://x/y' })
    const body = JSON.stringify(m.doc)
    expect(body, 'قيل له إنّ شرطَ عرضه تحقّق ولا عرضَ له').not.toMatch(/شرطُ الاتفاقيّة|موقَّعا من الطرفَين/)
    expect(m.subject, 'عنوانٌ يَعِده بعقدٍ موقَّع').not.toMatch(/عقدُك موقَّعا/)
    const ctas = m.doc.blocks.filter((b) => b.kind === 'cta').map((b) => (b as { label: string }).label)
    expect(ctas, 'زرٌّ إلى عقدٍ موقَّعٍ لا وجودَ له').not.toContain('اقرأ عقدَك موقَّعا')
  })

  /* و«اعتُمدت موادُّك» بلا تسميةٍ تُقرأ اعتمادا لكلّ ما قدّم — ومنه ما أُعيد
     إليه. فيُدرَّس ما لم يُعتمَد. */
  it('وتسمّي ما اعتُمد بأسمائه، وتقول إنّ ما أُعيد يبقى عنده', () => {
    const body = JSON.stringify(finalApprovalMail(APPROVED).doc)
    for (const t of APPROVED.approvedCoursesAr) expect(body).toContain(t)
    expect(body).toMatch(/ولا يُدرَّس إلّا ما اعتُمد/)
  })

  it('وتقول إنّ حسابَه البنكيَّ صار يُكتب — وهو ما تغيّر باعتماده', () => {
    expect(JSON.stringify(finalApprovalMail(APPROVED).doc)).toMatch(/حسابَك البنكيَّ/)
  })

  it('ولا زرَّ لمستندٍ لا رابطَ له — ووعدٌ بزرٍّ لا يفتح شيئا أسوأُ من غيابه', () => {
    const none = finalApprovalMail(APPROVED).doc.blocks.filter((b) => b.kind === 'cta')
    expect(none.length, 'زرٌّ إلى مستندٍ بلا رابط').toBe(1)
    const withDoc = finalApprovalMail({ ...APPROVED, contractUrl: 'https://x/y' })
      .doc.blocks.filter((b) => b.kind === 'cta')
    expect(withDoc.length).toBe(2)
  })
})

/* ═══ بريدا العامل — التذكيرُ والانقضاء ═══ */
describe('بريدُ التذكير بالمهلة', () => {
  const BASE: ConditionReminderMailInput = {
    fullName: 'عبد الرحمن العتيبي',
    reference: 'WJ-TR-2026-00041',
    deadlineOnAr: '8 أكتوبر 2026',
    daysLeft: 2,
    extensionDays: 2,
    portalUrl: 'https://wajeezacademy.com/trainer',
    extensionsLeft: 2,
  }
  const flat = (i: ConditionReminderMailInput) => JSON.stringify(conditionReminderMail(i).doc)

  it('يعدّ ما بقي بصيغته العربيّة، ويسمّي تاريخَ الانتهاء', () => {
    expect(conditionReminderMail(BASE).subject).toContain('يومان')
    expect(conditionReminderMail({ ...BASE, daysLeft: 1 }).subject).toContain('يومٌ واحد')
    expect(flat(BASE)).toContain(BASE.deadlineOnAr)
  })

  it('ويطمئنه أنّ وقتَ مراجعتنا لا يُحسب عليه', () => {
    expect(flat(BASE)).toMatch(/لا يُحسب عليك/)
  })

  /* ═══ وهذا الحارسُ كان يُثبّت اللحنَ نفسَه (٢٧ سبتمبر ٢٠٢٦) ═══

     كان يطابق `/تمديدُ 2 يومين/` — أي أنّه **يحرس الخطأ**: «٢ يومين» لحنٌ،
     والمثنّى لا يحمل عددَه. وقد صُحّح في متن العقد يومَ كُتب، وبقي في البريد
     لأنّ حارسَه يمنع تصحيحَه.

     فصار يُثبّت الصوابَ ونفيَ اللحن معا. */
  it('ويعرض البابَين لمن بقيت له مرّاتُ تمديد، بلا لحنٍ في المثنّى', () => {
    const body = flat(BASE)
    expect(body, 'عاد لحنُ «2 يومين»').not.toMatch(/2 يومين/)
    expect(body, 'لا يُقال بكم يُمدَّد').toMatch(/تمديدُها يومين/)
    expect(body, 'لا يُقال كم بقي له').toMatch(/وبقيت لك مرّتين/)
    expect(body).toMatch(/التأجيلُ إلى فصل التدريب القادم/)
  })

  it('وحين تبقى واحدةٌ يقولها واحدةً — فلا يُعِدُّ مرّتَين', () => {
    const body = flat({ ...BASE, extensionsLeft: 1 })
    expect(body, 'قيل له مرّتان وقد بقيت واحدة').not.toMatch(/وبقيت لك مرّتين/)
    expect(body).toMatch(/وبقيت لك مرّةً واحدة/)
  })

  /* ولا يُعرَض تمديدٌ أُنفِق: يطلبه فيُردّ، وقد ضاع يومٌ في انتظار جوابٍ معروف */
  it('ولا يعرض التمديدَ على من أنفق مرّاتِه — ويدلّه على التأجيل', () => {
    const body = flat({ ...BASE, extensionsLeft: 0 })
    expect(body, 'عُرض تمديدٌ لا يُمنَح').not.toMatch(/أمامك بابان/)
    expect(body).toMatch(/أُنفقت مرّاتُ التمديد/)
    expect(body).toMatch(/التأجيلَ إلى فصل التدريب القادم/)
  })

  it('وزرُّه إلى بوّابته — فهناك يرفع', () => {
    const ctas = conditionReminderMail(BASE).doc.blocks.filter((b) => b.kind === 'cta')
    expect(ctas.length).toBe(1)
    expect((ctas[0] as { href: string }).href).toBe(BASE.portalUrl)
  })
})

describe('بريدُ انقضاء المهلة', () => {
  const LAPSED: ConditionLapsedMailInput = {
    fullName: 'عبد الرحمن العتيبي',
    reference: 'WJ-TR-2026-00041',
    deadlineOnAr: '8 أكتوبر 2026',
    portalUrl: 'https://wajeezacademy.com/trainer',
    noFaultClause: '2-11',
  }
  const flat = () => JSON.stringify(conditionLapsedMail(LAPSED).doc)

  /* بندُ «لا إخلال» يقول إنّ عدمَ تحقّق الشرط ليس إخلالا من أحد — فلا تُكتب
     الرسالةُ بلغةِ مخالفةٍ ولا إنذار. */
  it('يقول إنّ لا إخلالَ من أحد — ويُحيل على البند', () => {
    const body = flat()
    expect(body).toMatch(/ولا يُعدُّ هذا إخلالا/)
    expect(body, 'لم يُحِل على بند الشرط').toContain('البند 2-11 من الاتفاقيّة')
  })

  /* ═══ ورقمُ البند هو بندُ «لا إخلال» في المتن الذي وقّعه (١ أكتوبر ٢٠٢٦) ═══
     كانت الرسالةُ تقول «البند 2-10» حرفا، وحارسُها يقيس ورودَ «2-10» — فخضرّ
     والبندُ 2-10 تمديدُ المهلة منذ زِيد بندُ الدورة الجديدة. فالمقيسُ هنا البنيةُ:
     يُصيَّر المتنُ، ويُعرف فيه البندُ الذي يقول «فلا يعد ذلك إخلالا» بمحكٍّ مستقلّ،
     ثمّ يُقابَل بما يقرؤه العاملُ وما تقوله الرسالة. */
  it('⚠️ والرقمُ رقمُ البند الذي يقول «لا إخلال» في المتن — لا حرفٌ مكتوب', () => {
    const body = renderContractBodyAr({
      academyPartyLineAr: 'أكاديمية وجيز للتدريب', academyLegalNameAr: 'أكاديمية وجيز للتدريب',
      academyTradingNameAr: 'أكاديمية وجيز', governingLawAr: 'القانون الأردني', disputeVenueAr: 'محاكم عمّان',
      trainerFullName: 'سعادُ المدرّبة', trainerEmail: 't@example.com',
      applicationReference: 'WJ-TR-2026-00042', issuedOnAr: '1 أكتوبر 2026',
      courses: [{ courseId: 'C-ACC-101', titleAr: 'أساسيات المحاسبة' }],
      compensation: { type: 'per_seat', rate: '15', referralRate: '25', minSeats: 5, currency: 'USD' },
      rateWaivedReasonAr: null, hoursNoteAr: null, requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS,
      conditional: { orientationOnAr: null, deadlineOnAr: null, windowDays: MATERIALS_WINDOW_DAYS, extensionDays: EXTENSION_DAYS },
    })
    const truth = /^(2-\d+) [^\n]*فلا يعد ذلك إخلالا/m.exec(body)?.[1]
    expect(truth, 'لا بندَ «لا إخلال» في المتن — الحارسُ يقيس الفراغ').toBeTruthy()
    expect(noFaultClauseOf(body), 'يقرأ العاملُ رقما غيرَ رقم البند').toBe(truth)
    const mail = JSON.stringify(conditionLapsedMail({ ...LAPSED, noFaultClause: noFaultClauseOf(body) }).doc)
    expect(mail, `أحالت الرسالةُ على غير البند ${truth}`).toContain(`البند ${truth} من الاتفاقيّة`)
    /* ومتنٌ لا يُعرف فيه البندُ يُحال فيه على العرض بلا رقمٍ — لا رقمٌ مخمَّن */
    const none = JSON.stringify(conditionLapsedMail({ ...LAPSED, noFaultClause: null }).doc)
    expect(none).toContain('وهو منصوصٌ في الاتفاقيّة')
    expect(none).not.toMatch(/البند 2-\d+ من الاتفاقيّة/)
  })

  it('ويعرض المخرجَين معا — التأجيلَ والحذف', () => {
    const body = flat()
    expect(body).toMatch(/التأجيلُ إلى الموسم القادم/)
    expect(body).toMatch(/حذفُ حسابك/)
  })

  it('ويقول إنّ ما رفعه يبقى — فلا يظنّ عملَه ضاع', () => {
    expect(flat()).toMatch(/لا يُمحى بانقضاء المهلة/)
  })

  it('ولا لغةَ إنذارٍ فيه', () => {
    const body = flat()
    for (const word of ['مخالف', 'إنذار', 'إخلالك', 'تقصير']) {
      expect(body, `لغةُ إنذارٍ في رسالةٍ شرطُها لم يتحقّق: ${word}`).not.toContain(word)
    }
  })
})

/* ═══ هيئةُ القالب: ما يُرسَم لا ما يُكتب — قرارُ ٢٧ سبتمبر ٢٠٢٦ ═══

   بلاغُ صاحب المنصّة: «حسِّنِ التصميم، ولا تستخدم بولد بالكلمات لتكون أنعمَ
   النصوص». وموضعُ ذلك القالبُ لا القوالبُ التي تكتب النصّ — فالوزنُ مكتوبٌ
   في `mail-template.ts` مرّةً واحدة، ويرثه كلُّ بريدٍ في المنصّة.

   ولمَ يُحرَس أصلا: نُقض القالبُ بإعادة `font-weight:700` إلى التنبيه فلم
   يحمرّ شيء. وهيئةٌ لا يحرسها أحدٌ تعود في أوّل تعديلٍ يمرّ عليها. */
describe('هيئةُ قالب البريد', () => {
  const html = (blocks: MailBlock[]) => renderMail({
    heading: 'عنوان', blocks,
  }).html

  it('لا بولدَ في صندوق التنبيه — والتمييزُ بالأرضيّة والإطار واللون', () => {
    /* ويُقتطَع الصندوقُ وحدَه: القالبُ فيه `font-weight:700` مشروعةٌ في
       الزرّ وفي جدول الحقائق، فمسحُ الوثيقة كلِّها يخضرّ على غيره. */
    const out = html([{ kind: 'callout', text: 'تنبيهٌ يُقرأ' }])
    const cell = /<td bgcolor[^>]*>تنبيهٌ يُقرأ<\/td>/.exec(out)
    expect(cell, 'لم يُقرأ صندوقُ التنبيه').not.toBeNull()
    expect(cell![0], 'عاد وزنُ البولد إلى التنبيه').not.toContain('font-weight:700')
  })

  /* والخطواتُ تُرسَم مرقَّمةً وواحدةٌ منها مميَّزةٌ — وإلّا فهي قائمةٌ منقّطة
     بأرقام، لا تقول أين هو. */
  it('وخارطةُ الخطوات تُرقَّم، والحاليّةُ وحدَها ملوَّنة', () => {
    const out = html([{
      kind: 'steps',
      items: [
        { textAr: 'مضت', state: 'done' },
        { textAr: 'الآن', state: 'now' },
        { textAr: 'تأتي' },
      ],
    }])
    expect(out, 'ما مضى بلا علامة').toContain('&#10003;')
    expect(out, 'الأرقامُ لا تُطبَع').toMatch(/>2</)
    /* ويُعَدُّ ما يملأ القرصَ وحدَه (`bgcolor`): لونُ العلامة يَرِد في
       الترويسة والروابط نصّا، فعدُّه في الوثيقة كلِّها يقيس غيرَ ما يُقصَد. */
    const filled = out.split('bgcolor="#1F6E77"').length - 1
    expect(filled, 'المميَّزُ ليس واحدا — فما يُميَّز اثنان لا يُميَّز واحد').toBe(1)
  })

  it('والنصُّ الخامُّ يقول أين هو كذلك — فمن قرأه نصّا لم يضع', () => {
    const text = renderMail({
      heading: 'عنوان',
      blocks: [{
        kind: 'steps',
        items: [{ textAr: 'مضت', state: 'done' }, { textAr: 'الآن', state: 'now' }],
      }],
    }).text
    expect(text).toMatch(/1\. مضت\s+✓/)
    expect(text).toMatch(/2\. الآن\s+←/)
  })
})
