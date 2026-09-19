/* ملخّصُ من أتمّ ولم يحجز — ومَن يدخله ومَن لا يدخله.

   ═══ ما يُحرَس ═══

   ① **من حجز لا يُدرَج** — والملغى ليس حاجزا: من ألغى موعدَه أحوجُ الناس
      إلى التذكير. والمِحَكُّ هو `canRemindToBook` نفسُه، فلو أُدرج من لا
      يقبله لَظهر في ملخّصٍ من لو ضُغط له الزرُّ لَرُدّ ٤٠٩.
   ② **ومن وقع في طلبه قرارٌ يخرج** — المردودُ والمنتظِرُ ومن حُدّد موعدُه.
   ③ **والعتبةُ عند طرفها** — ثلاثةٌ تُدرِج، ويومان لا. فحدٌّ يُكتب `<=`
      بدل `<` يزحف يوما، ويصير الملخّصُ قائمةَ الواصلين لا المتأخّرين.
   ④ **والصمتُ حين لا أحد** — `null` لا ملخّصٌ بصفر: رسالةٌ يوميّةٌ تقول
      «لا شيء» تُعلّم قارئَها أن يمرَّ عليها، فتضيع يومَ تحمل خبرا.
   ⑤ **وأطولُهم وقوفا أوّلا، و`oldestDays` أكبرُهم لا أوّلُهم في المصفوفة.**
   ⑥ **ومن ذُكِّر يُقال إنّه ذُكِّر** — بلا هذا يُبدأ من أوّل القائمة كلَّ
      صباح، فيُذكَّر من ذُكِّر أمسِ ويبقى من لم يُمَسّ آخرَها.
   ⑦ **والمتنُ فقراتٌ مفصولة** — `notificationMailDoc` يقسم على السطر
      الفارغ وحدَه، فجمعُها بسطرٍ واحدٍ يُخرج الأسماءَ ملتصقةً في الرسالة.
   ⑧ **والصباحُ بتوقيت الأكاديمية** — خادمٌ على UTC يرسل ملخّصَ السابعةِ
      العاشرةَ صباحا، وخادمٌ آخرُ يرسله ليلا. */

import { describe, expect, it } from 'vitest'
import {
  DIGEST_FROM_HOUR, DIGEST_NAMES, DIGEST_TO_HOUR, UNBOOKED_AFTER_DAYS,
  isDigestHour, lateToBook, unbookedDigest, unbookedTitleAr, type UnbookedRow,
} from '@/application/trainer/unbooked-digest'

const NOW = new Date('2026-09-19T10:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000)

let seq = 0
const row = (over: Partial<UnbookedRow> = {}): UnbookedRow => ({
  fullName: `متقدّمٌ ${(seq += 1)}`,
  reference: `WJ-TR-2609-${String(seq).padStart(4, '0')}`,
  status: 'submitted',
  liveInterviews: 0,
  completedAt: daysAgo(5),
  remindedAt: null,
  ...over,
})

describe('من يدخل الملخّص', () => {
  it('① من له موعدٌ قائمٌ لا يُدرَج، ومن ألغاه يُدرَج', () => {
    expect(lateToBook([row({ liveInterviews: 1 })], NOW)).toEqual([])
    /* الملغى لا يصل هنا مقابلةً قائمة — العدُّ نفسُه يستثني الملغاة */
    expect(lateToBook([row({ liveInterviews: 0 })], NOW)).toHaveLength(1)
  })

  it('② وما وقع فيه قرارٌ أو حُدّد موعدُه يخرج', () => {
    const decided = ['rejected', 'waitlisted', 'interview_scheduled', 'approved', 'withdrawn', 'academic_review']
    for (const status of decided) {
      expect(lateToBook([row({ status })], NOW), status).toEqual([])
    }
    /* وما يقبل الحجزَ يدخل */
    for (const status of ['submitted', 'under_review', 'information_requested', 'shortlisted']) {
      expect(lateToBook([row({ status })], NOW), status).toHaveLength(1)
    }
  })

  it('③ والعتبةُ عند طرفها: ثلاثةٌ تدخل ويومان لا', () => {
    expect(lateToBook([row({ completedAt: daysAgo(UNBOOKED_AFTER_DAYS - 1) })], NOW)).toEqual([])
    expect(lateToBook([row({ completedAt: daysAgo(UNBOOKED_AFTER_DAYS) })], NOW)).toHaveLength(1)
  })

  it('ومن لا تاريخَ لإتمامه لا يُدرَج — لا تُحسب له مدّةٌ من فراغ', () => {
    expect(lateToBook([row({ completedAt: null })], NOW)).toEqual([])
    expect(lateToBook([row({ completedAt: 'ليس تاريخا' })], NOW)).toEqual([])
  })

  it('⑤ وأطولُهم وقوفا أوّلا', () => {
    const late = lateToBook([
      row({ completedAt: daysAgo(4) }),
      row({ completedAt: daysAgo(20) }),
      row({ completedAt: daysAgo(9) }),
    ], NOW)
    expect(late.map((r) => r.days)).toEqual([20, 9, 4])
  })
})

describe('الملخّصُ نفسُه', () => {
  it('④ لا ملخّصَ حين لا متأخّر', () => {
    expect(unbookedDigest([], NOW)).toBeNull()
    /* ولا حين يسقط كلُّ من في الطابور على شرطٍ من الشروط */
    expect(unbookedDigest([
      row({ liveInterviews: 2 }),
      row({ status: 'rejected' }),
      row({ completedAt: daysAgo(1) }),
    ], NOW)).toBeNull()
  })

  it('⑤ والعددُ وأقدمُهم يُقرآن من الكلّ لا من أوّل صفّ', () => {
    const digest = unbookedDigest([
      row({ completedAt: daysAgo(4) }),
      row({ completedAt: daysAgo(17) }),
      row({ completedAt: daysAgo(6) }),
    ], NOW)
    expect(digest?.count).toBe(3)
    expect(digest?.oldestDays).toBe(17)
    /* ويُصرَّف في الخبر: «منذ 17 يوما» لا «منذ 17 أيّام» */
    expect(digest?.oldestAr).toBe('منذ 17 يوما')
  })

  it('⑥ ومن ذُكِّر يُقرأ في سطره متى ذُكِّر', () => {
    const [never, reminded, today] = lateToBook([
      row({ remindedAt: null }),
      row({ remindedAt: daysAgo(2) }),
      row({ remindedAt: daysAgo(0) }),
    ], NOW)
    expect(never.lineAr).toContain('لم يُذكَّر بعد')
    expect(reminded.lineAr).toContain('ذُكِّر منذ 2 يومين')
    expect(today.lineAr).toContain('ذُكِّر اليوم')
  })

  it('وكلُّ سطرٍ يحمل اسمَه ورقمَه ومدّتَه — فيُعرَف من السطر وحدَه', () => {
    const [line] = lateToBook([
      row({ fullName: 'سميرُ العبادي', reference: 'WJ-TR-2609-0007', completedAt: daysAgo(5) }),
    ], NOW)
    expect(line.lineAr).toContain('سميرُ العبادي')
    expect(line.lineAr).toContain('WJ-TR-2609-0007')
    expect(line.lineAr).toContain('أتمّ طلبَه منذ 5 أيّام')
  })

  it('⑦ والمتنُ فقرةٌ لكلّ اسم — فلا تلتصق الأسماءُ في الرسالة', () => {
    const digest = unbookedDigest([row(), row(), row()], NOW)
    const paragraphs = digest!.bodyAr.split(/\n{2,}/).filter(Boolean)
    /* سطرُ «لا يصل المتقدّمَ شيء» ثمّ ثلاثةُ أسماء */
    expect(paragraphs).toHaveLength(4)
    for (const line of digest!.lines) expect(paragraphs).toContain(line)
  })

  it('والمتنُ يقول إنّ المتقدّمَ لا يصله شيءٌ من هذه الرسالة', () => {
    const digest = unbookedDigest([row()], NOW)
    /* وهو ليس زينةً في النصّ: قرارُ «التذكيرُ يدويّ» يُقرأ هنا، ولولاه
       لَظنّ الموظّفُ أنّ الآلةَ راسلتهم فلا يرسل. */
    expect(digest?.bodyAr).toContain('ولا يصل المتقدّمَ شيءٌ من هذه الرسالة')
  })

  it('وما زاد على سقف الأسماء يُقال عددا لا يُبتلَع', () => {
    const many = Array.from({ length: DIGEST_NAMES + 3 }, (_, i) => row({ completedAt: daysAgo(4 + i) }))
    const digest = unbookedDigest(many, NOW)
    expect(digest?.count).toBe(DIGEST_NAMES + 3)
    expect(digest?.lines).toHaveLength(DIGEST_NAMES)
    expect(digest?.bodyAr).toContain('وفي الطابور 3 غيرُهم')
  })

  it('والعنوانُ يُصرَّف عربيّا — فلا «1 متقدّمين»', () => {
    expect(unbookedTitleAr(1)).toBe('متقدّمٌ واحدٌ لم يحجز موعدَ لقاء التعارف')
    expect(unbookedTitleAr(2)).toBe('متقدّمان لم يحجزا موعدَ لقاء التعارف')
    expect(unbookedTitleAr(4)).toBe('4 متقدّمين لم يحجزوا موعدَ لقاء التعارف')
    expect(unbookedTitleAr(12)).toBe('12 متقدّما لم يحجزوا موعدَ لقاء التعارف')
  })
})

describe('⑧ نافذةُ الصباح بتوقيت الأكاديمية', () => {
  /* عمّان على +٣ طوالَ السنة (لا توقيتَ صيفيّ منذ ٢٠٢٢) */
  it.each([
    ['2026-09-19T03:59:00Z', false, 'السادسةُ وتسعٌ وخمسون — قبل النافذة'],
    ['2026-09-19T04:00:00Z', true, 'السابعةُ تماما — أوّلُ النافذة'],
    ['2026-09-19T06:59:00Z', true, 'التاسعةُ وتسعٌ وخمسون — آخرُها'],
    ['2026-09-19T07:00:00Z', false, 'العاشرةُ تماما — خرجت'],
    ['2026-09-19T21:00:00Z', false, 'منتصفُ الليل'],
  ])('%s → %s (%s)', (iso, expected) => {
    expect(isDigestHour(new Date(iso))).toBe(expected)
  })

  it('ولو قُرئت الساعةُ بتوقيت الخادم لاختلف الجواب — وهذا ما يُحرَس', () => {
    /* السابعةُ صباحا بتوقيت عمّان هي الرابعةُ في UTC: فالنافذةُ لو قيست
       على UTC لَبدأت بعد ثلاث ساعات. */
    const dawn = new Date('2026-09-19T04:00:00Z')
    expect(isDigestHour(dawn), 'بتوقيت الأكاديمية').toBe(true)
    expect(isDigestHour(dawn, 'UTC'), 'بتوقيت الخادم').toBe(false)
  })

  it('والنافذةُ ثلاثُ ساعاتٍ لا لحظة — فدورةٌ تتأخّر لا تُفوّت اليوم', () => {
    expect(DIGEST_TO_HOUR - DIGEST_FROM_HOUR).toBeGreaterThanOrEqual(2)
  })
})
