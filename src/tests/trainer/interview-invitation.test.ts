/* دعوةُ لقاء التعارف — حارسُ من يُدعى، وما يُقال له، وأنّه يُقال مرّةً واحدة.

   ═══ ما يُفحص هنا ولماذا ═══

   ① **من يُدعى** — «مهتمّون بملفّك» خبرٌ عن فعلٍ وقع عندنا. فلو انفتح المِحَكُّ
      لكلّ من لم يحجز لَقرأها من قدّم قبل ساعةٍ ولم يفتح ملفَّه أحد — وشاشتُه
      نفسُها تقول له «ونقرأ طلبك قبله»، فتُكذّبها بطاقةٌ فوقها في الشاشة
      الواحدة. وأخطرُ من ذلك عكسُه: أن تُعرض لمن حجز، فيحجز ثانيا.
   ② **والنصُّ مصدرُه واحد** — الدعوةُ تُقرأ في البريد وفي البطاقة، وزرُّ
      البريد يفتح تلك البطاقةَ بعينها. فلو كُتبت مرّتين لقرأ في بريدنا شيئا
      وفي موقعنا غيرَه بنقرةٍ واحدةٍ بينهما. والمقيسُ هنا أنّ **الرسالةَ
      المبنيّةَ فعلا** تحمل ألفاظَ الوحدة، لا أنّ الملفَّ يستوردها.
   ③ **ولا يُطلب حجزٌ من بابٍ مغلق** — `INTERVIEW_BOOKING_PAUSE` يُغلق التقويم،
      والاهتمامُ يبقى صادقا. فالمبدَّلُ ما نطلبه: طرفا الفرع يُفحصان معا هنا
      فلا يُنسى طرفُ العودة يومَ تُفتح المواعيد.
   ④ **وفعلُ الأثر واحدٌ للكاتب والقارئ** — البريدُ يكتبه والصفحةُ تقرؤه. ولو
      بُدِّل في موضعٍ وبقي الآخرُ لَخرج البريدُ ولا شيءَ في الشاشة: عطبٌ لا
      يُحمِّر شيئا، ولا يُكتشف إلّا بشكوى متقدّم.

   والفحصُ على البنية لا على ورودِ حرفٍ في ملفّ: ما يُقرأ من الشيفرة يُقرأ
   بعد نزع التعليقات، ويُنتزع فرعٌ بعينه لا نافذةُ حروف. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  INTERVIEW_INVITATION, INVITATION_ACTION, INTEREST_SHOWN_STATUSES,
  invitationAskAr, isInvitedToBook,
} from '@/application/trainer/interview-invitation'
import {
  APPLICANT_STATUS, BOOKABLE_STATUSES, INTERVIEW_BOOKING_PAUSE,
} from '@/application/trainer/application-options'
import { bookingReminderMail } from '../../../server/services/trainer-decision-mail'
import { renderMail } from '../../../server/services/mail-template'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

/** الشيفرةُ بلا تعليقاتها — فلا يُقاس شرحٌ يذكر الدعوةَ مكانَ شيفرةٍ تعرضها */
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('من يُدعى إلى حجز موعده', () => {
  it('من اجتاز الفرزَ الأوّليَّ ولا موعدَ له — نظرٌ وقع فيصدُق الاهتمام', () => {
    for (const status of INTEREST_SHOWN_STATUSES) {
      expect(isInvitedToBook({ status, liveInterviews: 0 }), status).toBe(true)
    }
  })

  it('⚠️ ومن دُعي بالبريد يجد دعوتَه في صفحته — وزرُّ الرسالة يفتحها', () => {
    /* هذا هو نصفُ الخاصّيّة: رسالةٌ تقول «نرغب بلقائك» وزرُّها يفتح صفحةً
       تعرض تقويما محيَّدا بلا كلمةٍ عمّا قرأه قبل لحظة — فيشكّ أنّه في
       الموضع الصحيح، أو يقرأ الرسالةَ آليّةً لا تعني ملفَّه. */
    expect(isInvitedToBook({ status: 'submitted', liveInterviews: 0, invitedAt: '2026-09-22T08:00:00.000Z' }))
      .toBe(true)
    expect(isInvitedToBook({ status: 'submitted', liveInterviews: 0, invitedAt: new Date() })).toBe(true)
  })

  it('⚠️ ولا يُدَّعى اهتمامٌ لمن لم يُنظر في ملفّه بعد — والشاشةُ تقول «ونقرأ طلبك قبله»', () => {
    /* «مقدَّم» و«قيد المراجعة» و«طُلبت معلومات» طلبٌ في الطابور لم يُقل فيه
       قولٌ بعد. ولهؤلاء التقويمُ كما كان: يحجز متى شاء بلا دعوى نقولها له. */
    for (const status of BOOKABLE_STATUSES) {
      if (INTEREST_SHOWN_STATUSES.includes(status)) continue
      expect(isInvitedToBook({ status, liveInterviews: 0 }), status).toBe(false)
      expect(isInvitedToBook({ status, liveInterviews: 0, invitedAt: null }), status).toBe(false)
    }
  })

  it('⚠️ ولا تُعرض لمن حجز — ولو دُعي بالأمس: دعوةٌ فوق موعدٍ محجوزٍ تُنتج موعدَين', () => {
    for (const status of BOOKABLE_STATUSES) {
      expect(isInvitedToBook({ status, liveInterviews: 1, invitedAt: new Date() }), status).toBe(false)
    }
  })

  it.each([
    ['draft', 'طلبٌ لم يصل بعد — لا يُدعى إلى موعدٍ على طلبٍ ناقص'],
    ['email_verification_pending', 'بريدٌ لم يُوثَّق'],
    ['interview_scheduled', 'موعدُه محجوزٌ فعلا'],
    ['rejected', 'انتهى الطلب — والدعوةُ تفتح بابا مغلقا'],
    ['withdrawn', 'سحب طلبَه'],
    ['active', 'صار مدرّبا'],
  ])('⚠️ ولا من حالتُه «%s» ولو دُعي — %s', (status) => {
    expect(isInvitedToBook({ status, liveInterviews: 0, invitedAt: new Date() })).toBe(false)
  })

  it('ومِحَكُّها هو مِحَكُّ الإرسال نفسُه — فلا دعوةٌ في شاشةٍ لا يقبلها الخادم', () => {
    /* `canRemindToBook` تحرس المسارَ في الخادم. ولو كتبت هذه الوحدةُ شرطَها
       بيدها لَعُرضت دعوةٌ لمن يردّه الخادمُ ٤٠٩ — أو سقطت عن مستحقٍّ لها. */
    const src = code('src/application/trainer/interview-invitation.ts')
    expect(src, 'الوحدةُ تكتب شرطَ الحجز بيدها لا بالمِحَكّ المشترك').toContain('canRemindToBook(')
  })

  it('وكلُّ حالةٍ يصدُق فيها الاهتمامُ حالةٌ يُحجَز فيها أصلا', () => {
    for (const status of INTEREST_SHOWN_STATUSES) {
      expect(BOOKABLE_STATUSES, `«${status}» لا يُحجَز فيها`).toContain(status)
      expect(APPLICANT_STATUS[status], `حالةٌ لا وجود لها: ${status}`).toBeDefined()
    }
  })
})

describe('ما يُقال في الدعوة — بلفظ صاحب المنصّة', () => {
  it('⚠️ تقول الاهتمامَ بالملفّ والرغبةَ في اللقاء — وهما سببُ الرسالة', () => {
    /* «أن نطلب منهم — إنّنا مهتمّون بملفّك ونرغب بلقائك» (٢٢ سبتمبر ٢٠٢٦).
       ولو سقط أحدُهما عادت الرسالةُ إجراءً: طلبٌ بلا سببٍ يُقرأ. */
    expect(INTERVIEW_INVITATION.headingAr, 'العنوانُ لا يذكر الملفّ').toMatch(/ملفّ?ك/)
    expect(INTERVIEW_INVITATION.headingAr, 'العنوانُ لا يذكر الرغبةَ في اللقاء').toMatch(/لقائك|نلتقيك/)
    expect(INTERVIEW_INVITATION.interestAr, 'السببُ لا يذكر الاهتمام').toMatch(/اهتمام|مهتمّ/)
    expect(INTERVIEW_INVITATION.interestAr, 'السببُ لا يذكر الرغبةَ في اللقاء').toMatch(/نلتقيك|لقائك/)
  })

  it('⚠️ وما يُطلب: حجزُ موعدٍ لنتعرّف عليه وعلى خبراته أكثر', () => {
    /* والعلّةُ في الطلب مقصودةٌ: «لنتعرّف عليك وعلى خبراتك أكثر» تقول له ماذا
       يجري في اللقاء — فلا يقرأ موعدا مجهولا يُدعى إليه. */
    expect(INTERVIEW_INVITATION.askAr, 'لا يُطلب منه حجزٌ صريح').toMatch(/احجز/)
    expect(INTERVIEW_INVITATION.askAr, 'لا يُقال لماذا نلتقيه').toMatch(/خبراتك/)
    expect(INTERVIEW_INVITATION.askAr, 'ولا يُقال إنّ الوقتَ وقتُه هو').toMatch(/يناسبك/)
  })

  it('⚠️ ولا يُطلب حجزٌ حين يُوقَف الحجز — ويُقال متى يُفتح', () => {
    /* طرفا الفرع يُفحصان معا: طرفُ الوقف لا يقول «احجز» ويسمّي شهرَ العودة،
       وطرفُ العودة يعود إلى الطلب — فلا يبقى الموقعُ يقول «موقوف» وتقويمُه
       مفتوحٌ يومَ يُطفأ المفتاح. */
    const paused = invitationAskAr(true)
    expect(paused, 'يُطلب منه حجزٌ وبابُ الحجز مغلق').not.toMatch(/احجز/)
    expect(paused, 'لا يُقال متى يُفتح الحجز').toContain(INTERVIEW_BOOKING_PAUSE.resumeMonthAr)
    expect(paused, 'لا يُقال لماذا وُقف — فيُقرأ ردّا على ملفّه').toMatch(/امتلا|امتلأ/)
    expect(invitationAskAr(false), 'طرفُ العودة لا يطلب حجزا').toBe(INTERVIEW_INVITATION.askAr)
  })

  it('وافتراضُ المعامَل حالُ المنصّة — فلا يقرأ مُنادٍ المفتاحَ بنفسه', () => {
    expect(invitationAskAr()).toBe(invitationAskAr(INTERVIEW_BOOKING_PAUSE.active))
  })
})

describe('الدعوةُ تُقال في البريد وفي البطاقة — بنصٍّ واحد', () => {
  const REF = 'WJ-TR-2026-00041'
  const STATUS = 'https://example.test/join-trainer/status'
  const mailText = (paused: boolean) =>
    renderMail(bookingReminderMail({ fullName: 'سلمى العمري', reference: REF, statusUrl: STATUS, paused }).doc).text

  it('⚠️ البريدُ يحمل ألفاظَ الوحدة لا نسخةً ثانيةً منها', () => {
    const text = mailText(false)
    expect(text, 'سببُ الدعوة لا يخرج في الرسالة').toContain(INTERVIEW_INVITATION.interestAr)
    expect(text, 'ما نطلبه لا يخرج في الرسالة').toContain(INTERVIEW_INVITATION.askAr)
  })

  it('⚠️ وعنوانُها عنوانُ الدعوة — يصدُق مفتوحا كان الحجزُ أو موقوفا', () => {
    for (const paused of [false, true]) {
      const mail = bookingReminderMail({ fullName: 'سلمى', reference: REF, statusUrl: STATUS, paused })
      expect(mail.doc.heading, `عنوانُ المتن لا يدعوه (paused=${paused})`).toBe(INTERVIEW_INVITATION.headingAr)
      expect(mail.subject, `الموضوعُ لا يدعوه (paused=${paused})`).toContain(INTERVIEW_INVITATION.headingAr)
      expect(mail.subject, 'الموضوعُ بلا رقم الطلب').toContain(REF)
    }
  })

  it('⚠️ ورسالةُ الوقف لا تطلب حجزا — لا في متنها ولا في اسم زرّها', () => {
    const mail = bookingReminderMail({ fullName: 'سلمى', reference: REF, statusUrl: STATUS, paused: true })
    expect(renderMail(mail.doc).text, 'الرسالةُ تدعوه إلى حجزٍ موقوف').not.toMatch(/احجز/)
    expect(renderMail(mail.doc).text, 'لا تقول متى يُفتح الحجز').toContain(INTERVIEW_BOOKING_PAUSE.resumeMonthAr)
    /* والزرُّ باقٍ ووجهتُه صفحةُ الطلب: هي تقول الصدقَ في الحالَين — تقويمٌ
       حين يُفتح، وإشعارُ الوقف وشهرُ العودة حين يُوقَف. */
    const cta = mail.doc.blocks.find((b) => b.kind === 'cta')
    expect(cta && cta.kind === 'cta' && cta.href, 'ذهب الزرُّ من رسالة الوقف').toBe(STATUS)
  })

  it('⚠️ والبطاقةُ تعرض الدعوةَ لمن دُعي وحدَه — ولا تحكم بنفسها', () => {
    /* ═══ والمقيسُ فرعُ التقويم وحدَه لا الملفُّ كلُّه ═══

       كتلةُ الوقف فوقَه تقرأ `invited` كذلك، فحارسٌ يقول «الملفُّ يذكر
       `{invited`» يمرّ وقد صارت الدعوةُ في فرع التقويم بلا شرطٍ أصلا —
       وقد وقع هذا فعلا وهو يُنقَض. فيُنتزع الفرعُ من بناء الرابط إلى آخره. */
    const card = code('src/components/BookInterview.tsx')
    const open = card.slice(card.indexOf('const url = trainerInterviewUrl('))
    expect(open, 'فرعُ التقويم لا يُقرأ — تغيّرت بنيةُ البطاقة').toBeTruthy()
    expect(open, 'العنوانُ لا يصير دعوةً لمن دُعي')
      .toMatch(/\{invited\s*\?\s*INTERVIEW_INVITATION\.headingAr/)
    expect(open, 'ذهب العنوانُ المحيَّدُ لمن لم يُدعَ — فصارت الدعوةُ للجميع')
      .toMatch(/:\s*<>احجز/)
    expect(open, 'سببُ الدعوة يُعرض بلا شرطٍ — فيقرؤه من لم يُدعَ')
      .toMatch(/\{invited && \([\s\S]{0,240}INTERVIEW_INVITATION\.interestAr/)
    expect(open, 'ما نطلبه لا يُعرض تحت السبب').toContain('INTERVIEW_INVITATION.askAr')
    /* ولا حكمَ في البطاقة: لو قرأت الحالةَ بنفسها لَصار للحكم موضعان */
    expect(card, 'البطاقةُ تحكم بنفسها من الحالة').not.toContain('isInvitedToBook')
  })

  it('⚠️ ولا تطلب حجزا في كتلة الوقف — الاهتمامُ يُقال والتقويمُ مغلق', () => {
    const card = code('src/components/BookInterview.tsx')
    /* والمِرساةُ حكمُ البوّابة لا المفتاح، ومنتهاها فرعُ «لم يُدعَ» بعدها
       (٢٤ سبتمبر ٢٠٢٦) — وإلّا ابتُلعت الكتلتان معا. */
    const from = card.indexOf("if (gate === 'paused')")
    const to = card.indexOf("if (gate === 'not_invited')")
    expect(from, 'لا خروجَ على المفتاح').toBeGreaterThan(-1)
    const block = card.slice(from, to)
    expect(block, 'الاهتمامُ لا يُقال لمن ينتظر شهرا').toContain('INTERVIEW_INVITATION.interestAr')
    expect(block, 'كتلةُ الوقف تطلب حجزا من بابٍ مغلق').not.toContain('INTERVIEW_INVITATION.askAr')
  })

  it('⚠️ وشاشةُ ما بعد الإرسال لا تدّعي اهتماما بملفٍّ لم يُقرأ بعد', () => {
    /* البطاقةُ نفسُها تُركَّب هناك، والمتقدّمُ أرسل طلبَه قبل ثانية. فلو
       مُرّرت لها الدعوةُ لَقرأ «نظرنا في ملفّك واهتممنا به» في اللحظة التي
       وصل فيها الطلبُ — وهو أوّلُ ما يقرؤه منّا. */
    const join = code('src/pages/JoinTrainer.tsx')
    const tag = /<BookInterview\b[\s\S]{0,400}?\/>/.exec(join)?.[0] ?? ''
    expect(tag, 'بطاقةُ الحجز مفقودةٌ من شاشة ما بعد الإرسال').toBeTruthy()
    expect(tag, 'شاشةُ الإرسال تدّعي اهتماما بملفٍّ لم يُقرأ').not.toContain('invited')
  })

  it('⚠️ وصفحةُ الحالة تحكم بالوحدة وتمرّر حكمَها إلى البطاقة', () => {
    const page = code('src/pages/ApplicantStatus.tsx')
    expect(page, 'الصفحةُ لا تقرأ حكمَ الدعوة').toContain('isInvitedToBook(')
    expect(page, 'الحكمُ لا يصل البطاقة').toMatch(/invited=\{isInvitedToBook\(/)
    expect(page, 'تاريخُ الدعوة لا يُقرأ من الخادم').toContain('interviewInvitedAt')
  })
})

describe('فعلُ الأثر — يكتبه البريدُ وتقرؤه الصفحة', () => {
  it('⚠️ المُرسِلُ يكتب الفعلَ نفسَه الذي تقرؤه الصفحة', () => {
    /* لو بُدِّل في موضعٍ وبقي الآخرُ: يخرج البريدُ ولا تظهر الدعوةُ في
       الشاشة — عطبٌ لا يُحمِّر شيئا ولا يُكتشف إلّا بشكوى متقدّم. */
    const service = code('server/services/trainer-review.service.ts')
    const send = service.slice(service.indexOf('async remindToBookInterview'))
    expect(send.slice(0, 2500), 'المُرسِلُ يكتب أثرا بفعلٍ آخر')
      .toContain(`action: '${INVITATION_ACTION}'`)
  })

  it('⚠️ وصفحةُ المتقدّم تقرؤه من الوحدة لا حرفا مكتوبا فيها', () => {
    const svc = code('server/services/trainer-application.service.ts')
    const mine = svc.slice(svc.indexOf('async myApplication'), svc.indexOf('async resumeAccess'))
    expect(mine, 'الصفحةُ لا تقرأ تاريخَ الدعوة أصلا').toContain('INVITATION_ACTION')
    expect(mine, 'تاريخُ الدعوة لا يُعاد إلى الشاشة').toContain('interviewInvitedAt')
    /* وأحدثُ دعوةٍ لا أقدمُها: من دُعي مرّتين يُقرأ آخرُ ما بُعث إليه */
    expect(mine, 'يُقرأ أوّلُ ما بُعث لا آخرُه').toMatch(/orderBy:\s*\{\s*createdAt:\s*'desc'\s*\}/)
  })

  it('وهو غيرُ فعلِ دعوة اللقاء الثاني — فلا يختلط طورٌ بطور', () => {
    expect(INVITATION_ACTION, 'جُمعت الدعوتان في فعلٍ واحد').not.toBe('trainer.interview.invite')
  })
})
