/* حرّاسُ مهلة العرض المشروط — الحسابُ كلُّه في وحدةٍ خالصة، فيُفحَص بلا قاعدة.
   ولكلِّ حارسٍ نقضٌ رُئي وهو يسقط (سكربتُ النقض في رسالة الالتزام). */
import { describe, it, expect } from 'vitest'
import {
  MATERIALS_WINDOW_DAYS, EXTENSION_DAYS, REMINDER_LEAD_DAYS,
  deadlineFrom, conditionPhase, daysLeft, isLapsed, dueReminder,
  deadlineAfterPause, extendProblemAr, extendedDeadline,
  conditionLineAr, CONDITION_PHASE_LABELS_AR,
  type ConditionPhase,
} from '@/application/trainer/conditional-offer'

const DAY = 86_400_000
/* التوقيعُ — وهو أصلُ الأجل منذ ٢٧ سبتمبر ٢٠٢٦ */
const SIGNED = new Date('2026-10-01T16:00:00Z')
const DUE = new Date(SIGNED.getTime() + MATERIALS_WINDOW_DAYS * DAY)

/* ═══ الأصلُ صار التوقيعَ لا الجلسة (٢٧ سبتمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «معه ٥ أيّام من بعد التوقيع لإتمام الموادّ». وكانت
   سبعةً من جلسة التهيئة.

   وهذا يُبدّل **المبدأ** لا الرقمَ وحدَه، ومقياسُه في آخر هذه المجموعة:
   عرضان يُوقَّعان في يومَين مهلتاهما مختلفتان. وكان الحارسُ هنا يقيس عكسَه
   بحرفه — «تنتهي مهلتُهما في اللحظة نفسِها» — فقُلب ولم يُحذَف. */
describe('المهلةُ خمسةُ أيّامٍ من التوقيع', () => {
  it('تُحسب من التوقيع زائدَ خمسة', () => {
    expect(MATERIALS_WINDOW_DAYS).toBe(5)
    expect(deadlineFrom(SIGNED)!.toISOString()).toBe(DUE.toISOString())
  })

  it('ولا مهلةَ لعرضٍ لم يُوقَّع', () => {
    expect(deadlineFrom(null)).toBeNull()
    expect(deadlineFrom(undefined)).toBeNull()
    expect(deadlineFrom('ليس تاريخا')).toBeNull()
  })

  /* والمقياسُ الذي يُثبت أنّ المبدأَ التوقيعُ لا الجلسة: لو كانت الجلسةُ
     لَتساوت مهلتا موقِّعَين في يومَين — وهي حالٌ تقع كثيرا: عرضٌ يُركَّب
     لاثنين بجلسةٍ واحدةٍ فيوقّع أحدُهما اليومَ والآخرُ غدا. */
  it('وعرضان يُوقَّعان في يومَين مهلتاهما مختلفتان بمقدار ما بينهما', () => {
    const today = deadlineFrom(SIGNED)!
    const tomorrow = deadlineFrom(new Date(SIGNED.getTime() + DAY))!
    expect(tomorrow.getTime() - today.getTime(),
      'تساوت مهلتا موقِّعَين في يومَين — فالأصلُ ليس التوقيع').toBe(DAY)
  })
})

describe('أطوارُ الشرط', () => {
  it('بلا مهلةٍ فطورُه «لا مهلة» — ولو مضى شهر', () => {
    const f = { now: new Date(SIGNED.getTime() + 30 * DAY) }
    expect(conditionPhase(f)).toBe('none')
    expect(isLapsed(f)).toBe(false)
    expect(daysLeft(f)).toBeNull()
  })

  it('وتسير ما لم تنقضِ', () => {
    expect(conditionPhase({ conditionDeadlineAt: DUE, now: SIGNED })).toBe('running')
  })

  it('وتتجمّد بإعلان الاكتمال', () => {
    const f = { conditionDeadlineAt: DUE, conditionPausedAt: SIGNED, now: new Date(DUE.getTime() + 5 * DAY) }
    expect(conditionPhase(f)).toBe('under_review')
    /* ولا تنقضي وهي مجمَّدةٌ ولو تجاوز الوقتُ تاريخَها — وهو المقصود */
    expect(isLapsed(f)).toBe(false)
  })

  it('وتنقضي بانقضاء تاريخها', () => {
    const f = { conditionDeadlineAt: DUE, now: new Date(DUE.getTime() + 1) }
    expect(conditionPhase(f)).toBe('lapsed')
    expect(isLapsed(f)).toBe(true)
  })

  it('واعتمادُ الموادّ يغلبُ كلَّ ما سبق', () => {
    const f = { conditionDeadlineAt: DUE, conditionMetAt: DUE, now: new Date(DUE.getTime() + 90 * DAY) }
    expect(conditionPhase(f)).toBe('met')
    expect(isLapsed(f)).toBe(false)
  })

  it('ولكلِّ طورٍ وسمٌ مقروء — ولا طورَ بلا وسم', () => {
    const phases: ConditionPhase[] = ['none', 'running', 'under_review', 'met', 'lapsed']
    expect(Object.keys(CONDITION_PHASE_LABELS_AR).sort()).toEqual([...phases].sort())
    for (const p of phases) expect(CONDITION_PHASE_LABELS_AR[p].length).toBeGreaterThan(3)
  })
})

describe('ما بقي من الأيّام', () => {
  it('خمسةٌ في لحظة التوقيع', () => {
    expect(daysLeft({ conditionDeadlineAt: DUE, now: SIGNED })).toBe(MATERIALS_WINDOW_DAYS)
  })

  it('ويُجبَر الكسرُ إلى أعلى — فمن بقي له ساعةٌ له «يومٌ» لا صفر', () => {
    expect(daysLeft({ conditionDeadlineAt: DUE, now: new Date(DUE.getTime() - 3600_000) })).toBe(1)
  })

  it('ولا عددَ لمن لا مهلةَ له ولا لمن تجمّدت ولا لمن انقضت', () => {
    expect(daysLeft({ now: SIGNED })).toBeNull()
    expect(daysLeft({ conditionDeadlineAt: DUE, conditionPausedAt: SIGNED, now: SIGNED })).toBeNull()
    expect(daysLeft({ conditionDeadlineAt: DUE, now: new Date(DUE.getTime() + DAY) })).toBeNull()
  })
})

describe('التذكيرُ مرّةً واحدة', () => {
  const twoLeft = new Date(DUE.getTime() - REMINDER_LEAD_DAYS * DAY)

  it('يُستحقّ قبل يومَين', () => {
    expect(REMINDER_LEAD_DAYS).toBe(2)
    expect(dueReminder({ conditionDeadlineAt: DUE, now: twoLeft })).toBe(true)
  })

  it('ولا يُستحقّ مبكّرا', () => {
    expect(dueReminder({ conditionDeadlineAt: DUE, now: SIGNED })).toBe(false)
  })

  it('ولا يُطرَق بابٌ مرّتين', () => {
    expect(dueReminder({ conditionDeadlineAt: DUE, conditionRemindedAt: twoLeft, now: twoLeft })).toBe(false)
  })

  it('ولا يُذكَّر من تجمّدت مهلتُه ولا من انقضت ولا من اعتُمد', () => {
    expect(dueReminder({ conditionDeadlineAt: DUE, conditionPausedAt: twoLeft, now: twoLeft })).toBe(false)
    expect(dueReminder({ conditionDeadlineAt: DUE, now: new Date(DUE.getTime() + DAY) })).toBe(false)
    expect(dueReminder({ conditionDeadlineAt: DUE, conditionMetAt: twoLeft, now: twoLeft })).toBe(false)
  })

  /* ضمانُ الترحيل: من هو في التهيئة اليومَ بلا عرضٍ موقَّعٍ مهلتُه `NULL`،
     فلا يطرق العاملُ بابَه برسالةٍ عن مهلةٍ لم يقبلها قطّ. */
  it('ولا يُذكَّر قطُّ من لا مهلةَ له', () => {
    expect(dueReminder({ now: twoLeft })).toBe(false)
    expect(dueReminder({ orientationAt: null, conditionDeadlineAt: null, now: twoLeft })).toBe(false)
  })
})

describe('التجميدُ يزيد المهلةَ بمقدار مدّته بالضبط', () => {
  it('لا أكثرَ ولا أقلّ', () => {
    const paused = new Date(DUE.getTime() - 2 * DAY)
    const resumed = new Date(paused.getTime() + 3 * DAY + 5 * 3600_000)
    const out = deadlineAfterPause({ conditionDeadlineAt: DUE, conditionPausedAt: paused }, resumed)
    expect(out!.getTime() - DUE.getTime()).toBe(resumed.getTime() - paused.getTime())
  })

  it('ومن لم تتجمّد مهلتُه لا تتحرّك', () => {
    const out = deadlineAfterPause({ conditionDeadlineAt: DUE }, new Date(DUE.getTime() + 9 * DAY))
    expect(out!.toISOString()).toBe(DUE.toISOString())
  })

  it('ومن لا مهلةَ له لا يكسبها بالتجميد', () => {
    expect(deadlineAfterPause({ conditionPausedAt: SIGNED }, new Date())).toBeNull()
  })
})

describe('التمديدُ يُمنح مرّتين', () => {
  it('ويزيد يومَين بالضبط', () => {
    expect(EXTENSION_DAYS).toBe(2)
    expect(extendProblemAr({ conditionDeadlineAt: DUE })).toBeNull()
    expect(extendedDeadline({ conditionDeadlineAt: DUE })!.getTime() - DUE.getTime())
      .toBe(EXTENSION_DAYS * DAY)
  })

  /* ═══ ومرّتان لا مرّة (٢٧ سبتمبر ٢٠٢٦) ═══

     «ويحقّ له طلبُ تمديدٍ ليومين مرّتين» — قرارُ صاحب المنصّة. وكان الحارسُ
     يقيس أنّ **الثانيةَ** تُردّ، والمِحَكُّ عنده تاريخُ التمديد. فقُلب إلى
     الثالثة، وصار المِحَكُّ العدّادَ — فتاريخُ الأوّل مكتوبٌ ولصاحبه ثانيةٌ
     بعدُ، ومن قاس عليه أغلق بابا مفتوحا. */
  it('والثانيةُ تُقبَل ولو كُتب تاريخُ الأولى', () => {
    expect(extendProblemAr({
      conditionDeadlineAt: DUE, conditionExtendedAt: SIGNED, conditionExtensionsUsed: 1,
    }), 'رُدّت الثانيةُ — وقياسُها على التاريخ يغلق بابا مفتوحا').toBeNull()
  })

  it('والثالثةُ تُردّ بنصٍّ يدلّه على التأجيل', () => {
    const problem = extendProblemAr({
      conditionDeadlineAt: DUE, conditionExtendedAt: SIGNED, conditionExtensionsUsed: 2,
    })
    expect(problem).not.toBeNull()
    expect(problem).toMatch(/التأجيل/)
  })

  it('ولا يُمدَّد ما لا مهلةَ له ولا ما اكتمل شرطُه', () => {
    /* وكان النصُّ يحيل إلى تاريخ الجلسة — وهي لم تعد أصلَ المهلة */
    expect(extendProblemAr({})).toMatch(/تبدأ بتوقيعه/)
    expect(extendProblemAr({ conditionDeadlineAt: DUE, conditionMetAt: DUE })).toMatch(/اعتُمدت/)
  })
})

describe('سطرُ الشريط', () => {
  it('يعدّ الأيّامَ بصيغتها العربيّة — مفردا ومثنّى وجمعا', () => {
    const line = (left: number) =>
      conditionLineAr({ conditionDeadlineAt: DUE, now: new Date(DUE.getTime() - left * DAY) })
    expect(line(1)).toContain('يومٌ واحد')
    expect(line(2)).toContain('يومان')
    expect(line(7)).toContain('7 أيّام')
  })

  it('ويقول للمجمَّدة إنّ وقتَ المراجعة لا يُحسب عليه', () => {
    expect(conditionLineAr({ conditionDeadlineAt: DUE, conditionPausedAt: SIGNED, now: SIGNED }))
      .toMatch(/مجمَّد/)
  })

  it('وللمنقضية يعرض المخرجَين: التأجيلَ أو الحذف', () => {
    const l = conditionLineAr({ conditionDeadlineAt: DUE, now: new Date(DUE.getTime() + DAY) })
    expect(l).toMatch(/أجِّل/)
    expect(l).toMatch(/حذف/)
  })

  it('ومن لا مهلةَ له يُقال له إنّ الجلسةَ تبدؤها — لا يُقال «صفرُ أيّام»', () => {
    const l = conditionLineAr({ now: SIGNED })
    expect(l).toMatch(/جلسة التهيئة/)
    expect(l).not.toMatch(/0|صفر/)
  })
})
