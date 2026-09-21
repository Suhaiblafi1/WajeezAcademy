/* ليبلاتُ صفّ الطابور — نتيجةُ اللقاء وموعدُه.

   ═══ ما طُلب (٢١ سبتمبر ٢٠٢٦) ═══

   «قلتَ لي مرارا إنّك ستضع نتيجةَ التقييم بجانب الحالة، والتي اتّفقنا أن
   تأخذها من روابط التقييم… إذا كانت مطابقةً وإن كانت مختلفةً نُظهر
   الاثنين. هذا سيكون لنا دليلٌ أنّ المقابلة تمّت وهذه نتيجتُها».
   و«للأشخاص الذين حجزوا موعدا ضعْ في الليبل موعدَ مقابلتهم القادمة، وإن
   لم يحجز فيكون الليبلُ أنّه لم يحجز موعدا بعد».

   ═══ وما يُحرَس هنا ═══

   ① **قرارُ رابط التقييم يصل الصفَّ** — وكان لا يصله أصلا: الصفُّ يقرأ
      `TrainerInterview.outcome` وحدَها، والقرارُ الذي كُتب في الرابط يبقى
      خلفَ فتحةِ ملفّ. وهو الشكوى بعينها.
   ② **والمتّفقان واحدٌ والمختلفان اثنان** — لا بادئةَ مصدرٍ حين لا منازع،
      ولا كتمانَ لأحدهما حين يختلفان.
   ③ **ولا يُقال «لم يحجز» لمن لا يُنتظَر منه حجز** — ولا حين لا يُعرف من
      حجز أصلا، فالمزامنةُ تسقط فيصدق النفيُ على الجميع.
   ④ **وموعدٌ مضى ولم تُسجَّل نتيجتُه لا يُخفى** — لقاءٌ جرى وينتظر من
      يكتب قولَه فيه، وصمتُ الصفّ عنه هو ما يُبقي الطلبَ واقفا. */

import { describe, expect, it } from 'vitest'
import { bookingLabel, verdictBadges } from '@/application/trainer/queue-labels'
import { NO_SHOW } from '@/application/trainer/interview-outcome'
import { BOOKABLE_STATUSES } from '@/application/trainer/application-options'

const NOW = new Date('2026-09-21T12:00:00Z')
const SOON = '2026-09-25T10:00:00.000Z'
const PAST = '2026-09-17T10:00:00.000Z'

describe('① نتيجةُ رابط التقييم تصل الصفَّ', () => {
  it('من قُرئ ملفُّه برابطٍ ولم تُسجَّل نتيجةُ موعده — قرارُ الرابط هو الخبر', () => {
    const badges = verdictBadges({ interviewOutcome: null, reviewVerdicts: ['passed'] })
    expect(badges, 'قرارُ الرابط لا يصل الصفَّ — وهو الشكوى بعينها').toEqual([
      { key: 'passed', source: 'review' },
    ])
  })

  it('ومن لم يُقابَل ولم يُقرأ ملفُّه لا شارةَ له — فراغٌ أصدقُ من «بلا نتيجة»', () => {
    expect(verdictBadges({ interviewOutcome: null, reviewVerdicts: [] })).toEqual([])
  })
})

describe('② المتّفقان واحدٌ والمختلفان اثنان', () => {
  it('المطابقةُ تُطوى في واحدةٍ — ولا تُعرض الكلمةُ نفسُها مرّتين', () => {
    expect(verdictBadges({ interviewOutcome: 'passed', reviewVerdicts: ['passed'] })).toEqual([
      { key: 'passed', source: 'recorded' },
    ])
  })

  it('والمختلفتان تُعرضان معا بمصدرَيهما — وهو الدليلُ المطلوب', () => {
    const badges = verdictBadges({ interviewOutcome: NO_SHOW, reviewVerdicts: ['passed'] })
    expect(badges, 'كُتمت إحدى النتيجتين المختلفتين').toHaveLength(2)
    expect(badges[0]).toEqual({ key: NO_SHOW, source: 'recorded' })
    expect(badges[1]).toEqual({ key: 'passed', source: 'review' })
  })

  it('وقارئان اختلفا: يُعرض موافقُ المسجَّلة مطويّا فيها، ويُعرض المخالف', () => {
    const badges = verdictBadges({ interviewOutcome: 'passed', reviewVerdicts: ['passed', 'failed'] })
    expect(badges).toEqual([
      { key: 'passed', source: 'recorded' },
      { key: 'failed', source: 'review' },
    ])
  })

  it('والمكرَّرُ لا يُكرَّر — قارئان اتّفقا قولٌ واحد', () => {
    expect(verdictBadges({ interviewOutcome: null, reviewVerdicts: ['hold', 'hold'] })).toEqual([
      { key: 'hold', source: 'review' },
    ])
  })
})

describe('③ «لم يحجز» تُقال لمن يُنتظَر منه حجزٌ وحدَه', () => {
  const unbooked = { status: 'under_review', interviewsCount: 0, pendingInterviewAt: null }

  it('من يُقبل حجزُه ولم يحجز — يُقال له ذلك', () => {
    expect(bookingLabel(unbooked, { trusted: true, now: NOW })).toEqual({ kind: 'unbooked' })
  })

  it('والمردودُ والنشطُ لم يحجزا كذلك — ولا يُقال لهما: خبرٌ لا عملَ تحته', () => {
    for (const status of ['rejected', 'active', 'withdrawn', 'draft']) {
      expect(BOOKABLE_STATUSES, `«${status}» صار يُحجَز — فليُراجَع هذا الحارس`).not.toContain(status)
      expect(bookingLabel({ ...unbooked, status }, { trusted: true, now: NOW }), status).toBeNull()
    }
  })

  it('ومن له موعدٌ قائمٌ لا يُقال له «لم يحجز» — ولو لم يكن معلَّقا', () => {
    expect(bookingLabel(
      { status: 'interview_scheduled', interviewsCount: 1, pendingInterviewAt: null },
      { trusted: true, now: NOW },
    )).toBeNull()
  })

  it('وحين لا يُوثَق ما نعرفه عن الحجز لا يُنفى حجزٌ — النفيُ وحدَه يسقط', () => {
    expect(bookingLabel(unbooked, { trusted: false, now: NOW }), 'قيل «لم يحجز» والمزامنةُ ساقطة')
      .toBeNull()
    /* أمّا موعدٌ في القاعدة فواقعٌ ولو سقطت المزامنة — سُجّل يدويّا أو وصل قبلها */
    expect(bookingLabel(
      { status: 'interview_scheduled', interviewsCount: 1, pendingInterviewAt: SOON },
      { trusted: false, now: NOW },
    )).toEqual({ kind: 'upcoming', at: SOON })
  })
})

describe('④ وموعدُه يُقرأ في الصفّ', () => {
  it('القادمُ يُعرض تاريخا لا عددا', () => {
    expect(bookingLabel(
      { status: 'interview_scheduled', interviewsCount: 1, pendingInterviewAt: SOON },
      { trusted: true, now: NOW },
    )).toEqual({ kind: 'upcoming', at: SOON })
  })

  it('وما مضى ولم تُسجَّل نتيجتُه يُنادى عليه — لا يُخفى', () => {
    expect(bookingLabel(
      { status: 'interview_scheduled', interviewsCount: 1, pendingInterviewAt: PAST },
      { trusted: true, now: NOW },
    )).toEqual({ kind: 'overdue', at: PAST })
  })

  it('وتاريخٌ لا يُقرأ لا يُعرض حرفا خاما', () => {
    expect(bookingLabel(
      { status: 'interview_scheduled', interviewsCount: 1, pendingInterviewAt: 'ليس تاريخا' },
      { trusted: true, now: NOW },
    )).toBeNull()
  })
})
