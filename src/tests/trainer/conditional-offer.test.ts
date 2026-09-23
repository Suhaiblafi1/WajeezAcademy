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
const SESSION = new Date('2026-10-01T16:00:00Z')
const DUE = new Date(SESSION.getTime() + MATERIALS_WINDOW_DAYS * DAY)

describe('المهلةُ سبعةُ أيّامٍ من تاريخ الجلسة', () => {
  it('تُحسب من تاريخ الجلسة زائدَ سبعة', () => {
    expect(MATERIALS_WINDOW_DAYS).toBe(7)
    expect(deadlineFrom(SESSION)!.toISOString()).toBe(DUE.toISOString())
  })

  it('ولا مهلةَ لعرضٍ بلا تاريخِ جلسة', () => {
    expect(deadlineFrom(null)).toBeNull()
    expect(deadlineFrom(undefined)).toBeNull()
    expect(deadlineFrom('ليس تاريخا')).toBeNull()
  })

  /* الحارسُ الذي يثبت أنّ المبدأَ الجلسةُ لا التوقيع: لو حُسبت من التوقيع
     لَاختلف اليومان. وهو مقيسٌ على البنية — الدالّةُ لا تعرف التوقيعَ أصلا. */
  it('وعرضان يُوقَّعان في يومَين بجلسةٍ واحدةٍ تنتهي مهلتُهما في اللحظة نفسِها', () => {
    const first = deadlineFrom(SESSION)
    const second = deadlineFrom(new Date(SESSION))
    expect(first!.getTime()).toBe(second!.getTime())
    expect(deadlineFrom.length).toBeLessThanOrEqual(2)
  })
})

describe('أطوارُ الشرط', () => {
  it('بلا مهلةٍ فطورُه «لا مهلة» — ولو مضى شهر', () => {
    const f = { now: new Date(SESSION.getTime() + 30 * DAY) }
    expect(conditionPhase(f)).toBe('none')
    expect(isLapsed(f)).toBe(false)
    expect(daysLeft(f)).toBeNull()
  })

  it('وتسير ما لم تنقضِ', () => {
    expect(conditionPhase({ conditionDeadlineAt: DUE, now: SESSION })).toBe('running')
  })

  it('وتتجمّد بإعلان الاكتمال', () => {
    const f = { conditionDeadlineAt: DUE, conditionPausedAt: SESSION, now: new Date(DUE.getTime() + 5 * DAY) }
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
  it('سبعةٌ في لحظة الجلسة', () => {
    expect(daysLeft({ conditionDeadlineAt: DUE, now: SESSION })).toBe(7)
  })

  it('ويُجبَر الكسرُ إلى أعلى — فمن بقي له ساعةٌ له «يومٌ» لا صفر', () => {
    expect(daysLeft({ conditionDeadlineAt: DUE, now: new Date(DUE.getTime() - 3600_000) })).toBe(1)
  })

  it('ولا عددَ لمن لا مهلةَ له ولا لمن تجمّدت ولا لمن انقضت', () => {
    expect(daysLeft({ now: SESSION })).toBeNull()
    expect(daysLeft({ conditionDeadlineAt: DUE, conditionPausedAt: SESSION, now: SESSION })).toBeNull()
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
    expect(dueReminder({ conditionDeadlineAt: DUE, now: SESSION })).toBe(false)
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
    expect(deadlineAfterPause({ conditionPausedAt: SESSION }, new Date())).toBeNull()
  })
})

describe('التمديدُ يُمنح مرّةً', () => {
  it('ويزيد يومَين بالضبط', () => {
    expect(EXTENSION_DAYS).toBe(2)
    expect(extendProblemAr({ conditionDeadlineAt: DUE })).toBeNull()
    expect(extendedDeadline({ conditionDeadlineAt: DUE })!.getTime() - DUE.getTime())
      .toBe(EXTENSION_DAYS * DAY)
  })

  it('والثانيةُ تُردّ بنصٍّ يدلّه على التأجيل', () => {
    const problem = extendProblemAr({ conditionDeadlineAt: DUE, conditionExtendedAt: SESSION })
    expect(problem).not.toBeNull()
    expect(problem).toMatch(/التأجيل/)
  })

  it('ولا يُمدَّد ما لا مهلةَ له ولا ما اكتمل شرطُه', () => {
    expect(extendProblemAr({})).toMatch(/تاريخَ جلسة/)
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
    expect(conditionLineAr({ conditionDeadlineAt: DUE, conditionPausedAt: SESSION, now: SESSION }))
      .toMatch(/مجمَّد/)
  })

  it('وللمنقضية يعرض المخرجَين: التأجيلَ أو الحذف', () => {
    const l = conditionLineAr({ conditionDeadlineAt: DUE, now: new Date(DUE.getTime() + DAY) })
    expect(l).toMatch(/أجِّل/)
    expect(l).toMatch(/حذف/)
  })

  it('ومن لا مهلةَ له يُقال له إنّ الجلسةَ تبدؤها — لا يُقال «صفرُ أيّام»', () => {
    const l = conditionLineAr({ now: SESSION })
    expect(l).toMatch(/جلسة التهيئة/)
    expect(l).not.toMatch(/0|صفر/)
  })
})
