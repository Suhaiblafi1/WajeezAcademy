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
import {
  bookingLabel, resultKey, verdictBadges,
  RESULT_CONTESTED, RESULT_NONE, type ReviewVerdict,
} from '@/application/trainer/queue-labels'
import { NO_SHOW } from '@/application/trainer/interview-outcome'
import { BOOKABLE_STATUSES } from '@/application/trainer/application-options'

/** قرارُ قارئٍ — والاسمُ يُمرَّر حين يُفحَص عرضُه */
const rv = (verdict: string, reviewerName: string | null = null): ReviewVerdict => ({ verdict, reviewerName })

const NOW = new Date('2026-09-21T12:00:00Z')
const SOON = '2026-09-25T10:00:00.000Z'
const PAST = '2026-09-17T10:00:00.000Z'

describe('① نتيجةُ رابط التقييم تصل الصفَّ', () => {
  it('من قُرئ ملفُّه برابطٍ ولم تُسجَّل نتيجةُ موعده — قرارُ الرابط هو الخبر', () => {
    const badges = verdictBadges({ interviewOutcome: null, reviewVerdicts: [rv('passed')] })
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
    expect(verdictBadges({ interviewOutcome: 'passed', reviewVerdicts: [rv('passed')] })).toEqual([
      { key: 'passed', source: 'recorded' },
    ])
  })

  it('والمختلفتان تُعرضان معا بمصدرَيهما — وهو الدليلُ المطلوب', () => {
    const badges = verdictBadges({ interviewOutcome: NO_SHOW, reviewVerdicts: [rv('passed')] })
    expect(badges, 'كُتمت إحدى النتيجتين المختلفتين').toHaveLength(2)
    expect(badges[0]).toEqual({ key: NO_SHOW, source: 'recorded' })
    expect(badges[1]).toEqual({ key: 'passed', source: 'review' })
  })

  it('وقارئان اختلفا: يُعرض موافقُ المسجَّلة مطويّا فيها، ويُعرض المخالف', () => {
    const badges = verdictBadges({ interviewOutcome: 'passed', reviewVerdicts: [rv('passed'), rv('failed')] })
    expect(badges).toEqual([
      { key: 'passed', source: 'recorded' },
      { key: 'failed', source: 'review' },
    ])
  })

  it('والمكرَّرُ لا يُكرَّر — قارئان اتّفقا قولٌ واحد', () => {
    expect(verdictBadges({ interviewOutcome: null, reviewVerdicts: [rv('hold'), rv('hold')] })).toEqual([
      { key: 'hold', source: 'review' },
    ])
  })
})

describe('③ «لم يحجز» تُقال لمن يُنتظَر منه حجزٌ وحدَه', () => {
  const unbooked = {
    status: 'under_review', interviewsCount: 0, pendingInterviewAt: null,
    interviewOutcome: null, reviewVerdicts: [],
  }

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
      { status: 'interview_scheduled', interviewsCount: 1, pendingInterviewAt: null, interviewOutcome: null, reviewVerdicts: [] },
      { trusted: true, now: NOW },
    )).toBeNull()
  })

  it('وحين لا يُوثَق ما نعرفه عن الحجز لا يُنفى حجزٌ — النفيُ وحدَه يسقط', () => {
    expect(bookingLabel(unbooked, { trusted: false, now: NOW }), 'قيل «لم يحجز» والمزامنةُ ساقطة')
      .toBeNull()
    /* أمّا موعدٌ في القاعدة فواقعٌ ولو سقطت المزامنة — سُجّل يدويّا أو وصل قبلها */
    expect(bookingLabel(
      { status: 'interview_scheduled', interviewsCount: 1, pendingInterviewAt: SOON, interviewOutcome: null, reviewVerdicts: [] },
      { trusted: false, now: NOW },
    )).toEqual({ kind: 'upcoming', at: SOON })
  })
})

describe('④ وموعدُه يُقرأ في الصفّ', () => {
  it('القادمُ يُعرض تاريخا لا عددا', () => {
    expect(bookingLabel(
      { status: 'interview_scheduled', interviewsCount: 1, pendingInterviewAt: SOON, interviewOutcome: null, reviewVerdicts: [] },
      { trusted: true, now: NOW },
    )).toEqual({ kind: 'upcoming', at: SOON })
  })

  it('وما مضى ولم تُسجَّل نتيجتُه يُنادى عليه — لا يُخفى', () => {
    expect(bookingLabel(
      { status: 'interview_scheduled', interviewsCount: 1, pendingInterviewAt: PAST, interviewOutcome: null, reviewVerdicts: [] },
      { trusted: true, now: NOW },
    )).toEqual({ kind: 'overdue', at: PAST })
  })

  it('وتاريخٌ لا يُقرأ لا يُعرض حرفا خاما', () => {
    expect(bookingLabel(
      { status: 'interview_scheduled', interviewsCount: 1, pendingInterviewAt: 'ليس تاريخا', interviewOutcome: null, reviewVerdicts: [] },
      { trusted: true, now: NOW },
    )).toBeNull()
  })
})

/* ═══ ⑤ ولا يقول الصفُّ شيئا وضدَّه (٢١ سبتمبر ٢٠٢٦) ═══

   شكا صاحبُ المنصّة: «لماذا مكتوبٌ هنا بلا نتيجة ونحن وضعنا نتيجتَه وهي
   ظاهرة؟» — وصفُّه يحمل «مضى موعدُه — بلا نتيجة» وإلى جانبها «يجتاز».

   وعلّتُه أنّ «المعلَّق» كان يُقاس بـ`TrainerInterview.outcome` وحدَها، أمّا
   قرارُ رابط التقييم فلم يكن يُقرأ — وهو قولُنا فيه بعينه، معروضٌ في الصفّ
   نفسِه. والشرطُ الآن `verdictBadges` نفسُها، فلا ينحرف الحكمان. */
describe('⑤ ولا «بلا نتيجة» إلى جانب نتيجةٍ معروضة', () => {
  const heldRow = (extra: { interviewOutcome?: string | null; reviewVerdicts?: ReviewVerdict[] }) => ({
    status: 'interview_scheduled', interviewsCount: 1, pendingInterviewAt: PAST,
    interviewOutcome: null, reviewVerdicts: [], ...extra,
  })

  it('قرارُ رابط التقييم يكفي — والموعدُ يُقرأ «جرى لقاؤه» لا «بلا نتيجة»', () => {
    const row = heldRow({ reviewVerdicts: [rv('passed')] })
    expect(verdictBadges(row), 'تعطّل الفحصُ: لا شارةَ نتيجةٍ أصلا').toHaveLength(1)
    expect(bookingLabel(row, { trusted: true, now: NOW }), 'قيل «بلا نتيجة» وقولُنا فيه معروض')
      .toEqual({ kind: 'held', at: PAST })
  })

  it('وكذلك نتيجةُ الموعد المسجَّلة — حين يبقى موعدٌ آخرُ بلا تسجيل', () => {
    expect(bookingLabel(heldRow({ interviewOutcome: 'hold' }), { trusted: true, now: NOW }))
      .toEqual({ kind: 'held', at: PAST })
  })

  it('ومن لا قولَ لنا فيه يبقى «بلا نتيجة» — وهي الحالُ التي وُضعت لها', () => {
    const row = heldRow({})
    expect(verdictBadges(row), 'تعطّل الفحصُ: له شارةُ نتيجة').toHaveLength(0)
    expect(bookingLabel(row, { trusted: true, now: NOW })).toEqual({ kind: 'overdue', at: PAST })
  })

  it('والقادمُ يبقى قادما ولو كُتب فيه قولٌ سابق', () => {
    expect(bookingLabel(
      { ...heldRow({ reviewVerdicts: [rv('hold')] }), pendingInterviewAt: SOON },
      { trusted: true, now: NOW },
    )).toEqual({ kind: 'upcoming', at: SOON })
  })
})

/* ═══ ⑥ واسمُ القائل حين يختلف القرّاء، ومفتاحٌ يُرشَّح به (٢١ سبتمبر ٢٠٢٦) ═══

   «إن كان عندنا تقييمان أحدهما اجتاز والآخر لم يجتز فليُعكَس الاثنان على
   الليبل الرئيسيّ — مقيّمان مختلفان». وقولان بلا قائلَين تناقضٌ يُقرأ ولا
   يُعرف من يُسأل عنه.

   و«نتيجةُ التقييم» صارت مرشِّحا ثانيا، فلزمها مفتاحٌ واحد. **ويُشتقّ من
   الشارات نفسِها**: ما يُعرض هو ما يُرشَّح به، فلا يُنقَر مرشِّحٌ فيُخرج
   صفّا يقول غيرَ ما قال. */
describe('⑥ أسماءُ القرّاء ومفتاحُ النتيجة', () => {
  it('قولٌ واحدٌ لا قائلَ عليه — الاسمُ ضجيجٌ حين لا منازع', () => {
    const badges = verdictBadges({
      interviewOutcome: null,
      reviewVerdicts: [rv('passed', 'سارة'), rv('passed', 'أحمد')],
    })
    expect(badges, 'كُرّر القولُ الواحد').toHaveLength(1)
    expect(badges[0].byAr, 'كُتب قائلٌ على قولٍ لا منازعَ له').toBeUndefined()
  })

  it('وقولان متخالفان بقائلَيهما', () => {
    const badges = verdictBadges({
      interviewOutcome: null,
      reviewVerdicts: [rv('passed', 'سارة'), rv('failed', 'أحمد')],
    })
    expect(badges).toHaveLength(2)
    expect(badges.find((b) => b.key === 'passed')!.byAr).toBe('سارة')
    expect(badges.find((b) => b.key === 'failed')!.byAr).toBe('أحمد')
  })

  it('ومن اتّفقا على قولٍ خالفَ المسجَّلةَ يُعرضان معا باسمَيهما', () => {
    const badges = verdictBadges({
      interviewOutcome: NO_SHOW,
      reviewVerdicts: [rv('passed', 'سارة'), rv('passed', 'أحمد')],
    })
    expect(badges).toHaveLength(2)
    expect(badges[1].byAr, 'قولٌ ينازع المسجَّلةَ بلا قائليه').toBe('سارة · أحمد')
  })

  it('ومفتاحُ النتيجة يتبع الشاراتِ لا حسابا ثانيا', () => {
    expect(resultKey({ interviewOutcome: null, reviewVerdicts: [] }), 'من لا قولَ فيه')
      .toBe(RESULT_NONE)
    expect(resultKey({ interviewOutcome: 'passed', reviewVerdicts: [rv('passed', 'سارة')] }), 'المتّفقان قولٌ واحد')
      .toBe('passed')
    expect(resultKey({ interviewOutcome: null, reviewVerdicts: [rv('passed'), rv('failed')] }), 'المختلفان')
      .toBe(RESULT_CONTESTED)
    expect(resultKey({ interviewOutcome: NO_SHOW, reviewVerdicts: [rv('passed')] }), 'مسجَّلةٌ ينازعها قارئ')
      .toBe(RESULT_CONTESTED)
  })

  it('ولكلّ صفٍّ مفتاحٌ واحدٌ لا أكثر — فالمرشِّحُ يقسم الطابورَ ولا يكرّره', () => {
    const rows = [
      { interviewOutcome: null, reviewVerdicts: [] },
      { interviewOutcome: 'passed', reviewVerdicts: [] },
      { interviewOutcome: null, reviewVerdicts: [rv('failed', 'أحمد')] },
      { interviewOutcome: 'hold', reviewVerdicts: [rv('passed', 'سارة')] },
    ]
    const keys = rows.map(resultKey)
    expect(keys).toEqual([RESULT_NONE, 'passed', 'failed', RESULT_CONTESTED])
  })
})
