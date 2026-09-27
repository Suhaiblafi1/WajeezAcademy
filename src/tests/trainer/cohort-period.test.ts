/* مدّةُ الشعبة — القاعدةُ التي يقرؤها الخادمُ والشاشةُ معا.

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): المدرّبُ يحدّد متى تبدأ شعبتُه ومتى
   تنتهي، ولقاءاتُه داخلَها. والعلّةُ كاملةً في رأس
   `src/application/trainer/cohort-period.ts`. */

import { describe, expect, it } from 'vitest'
import {
  asPeriod, MAX_PERIOD_DAYS, periodBounds, periodDays, periodProblem, withinPeriod, zonedDay, zonedInstant,
} from '@/application/trainer/cohort-period'

describe('ما يمنع المدّة — بلغة من يصحّحها', () => {
  it('الناقصُ يُسمّى طرفُه الناقص', () => {
    expect(periodProblem(null)).toContain('بدء')
    expect(periodProblem({ startsOn: '2026-10-04' })).toContain('انتهاء')
    expect(periodProblem({ endsOn: '2026-11-08' })).toContain('بدء')
  })

  it('والنهايةُ بعد البداية — لا قبلها ولا في يومها', () => {
    expect(periodProblem({ startsOn: '2026-10-04', endsOn: '2026-10-03' })).toContain('بعد تاريخ البدء')
    expect(periodProblem({ startsOn: '2026-10-04', endsOn: '2026-10-04' })).toContain('بعد تاريخ البدء')
    expect(periodProblem({ startsOn: '2026-10-04', endsOn: '2026-10-05' })).toBeNull()
  })

  it('والتاريخُ الذي يقبله النمطُ ويرفضه الشهرُ مردود', () => {
    expect(periodProblem({ startsOn: '2026-02-31', endsOn: '2026-03-10' })).toContain('غيرُ صالح')
    expect(periodProblem({ startsOn: '2026-10-4', endsOn: '2026-11-08' })).toContain('غيرُ صالح')
  })

  it('والأطولُ من سنةٍ خطأُ سنةٍ في الغالب — والسنةُ نفسُها تمرّ', () => {
    expect(periodProblem({ startsOn: '2026-10-01', endsOn: '2027-10-01' })).toBeNull()
    expect(periodDays({ startsOn: '2026-10-01', endsOn: '2027-10-01' })).toBe(MAX_PERIOD_DAYS)
    expect(periodProblem({ startsOn: '2026-10-01', endsOn: '2027-10-02' })).toContain('أطولُ من سنة')
  })

  it('والبدءُ الماضي مردودٌ عند الحفظ — إلّا أن يكون البدءَ المعتمَدَ نفسَه', () => {
    const p = { startsOn: '2026-09-20', endsOn: '2026-11-01' }
    expect(periodProblem(p, { today: '2026-09-27' })).toContain('مضى')
    /* شعبةٌ جاريةٌ بدأت قبل أسبوع: لا يُطلب من مدرّبها تأخيرُ بدايتها */
    expect(periodProblem(p, { today: '2026-09-27', approvedStart: '2026-09-20' })).toBeNull()
    /* واليومُ نفسُه ليس ماضيا */
    expect(periodProblem({ startsOn: '2026-09-27', endsOn: '2026-11-01' }, { today: '2026-09-27' })).toBeNull()
    /* وبلا «اليوم» لا فحصَ للماضي — القائمةُ تحكم على الشكل لا على الساعة */
    expect(periodProblem(p)).toBeNull()
  })

  it('و`asPeriod` لا تصنع نصفَ مدّة', () => {
    expect(asPeriod({ startsOn: '2026-10-04', endsOn: null })).toBeNull()
    expect(asPeriod({ startsOn: '2026-10-04', endsOn: '2026-11-08' })).toEqual({ startsOn: '2026-10-04', endsOn: '2026-11-08' })
  })
})

describe('الحدّان لحظتان في عمّان — لا في غرينتش ولا في المتصفّح', () => {
  const p = { startsOn: '2026-10-04', endsOn: '2026-11-08' }

  it('أوّلُ اليوم منتصفُ ليله في عمّان، وآخرُه آخرُ ثانيةٍ منه', () => {
    const { from, to } = periodBounds(p)
    /* عمّان على +03:00 طوالَ السنة منذ ٢٠٢٢ */
    expect(from.toISOString()).toBe('2026-10-03T21:00:00.000Z')
    expect(to.toISOString()).toBe('2026-11-08T20:59:59.999Z')
  })

  it('⚠️ لقاءٌ في التاسعة مساءً من آخر يومٍ داخلَ المدّة — وكان يُردّ بحدّ غرينتش', () => {
    const lastEvening = zonedInstant('2026-11-08', [21, 0, 0, 0])
    expect(lastEvening.toISOString()).toBe('2026-11-08T18:00:00.000Z')
    expect(withinPeriod({ startsAt: lastEvening, endsAt: new Date(lastEvening.getTime() + 2 * 3600_000) }, p)).toBe(true)
  })

  it('ولقاءٌ يمتدّ بعد منتصف الليل الأخير خارجَها — بنهايته لا ببدايته', () => {
    const late = zonedInstant('2026-11-08', [23, 0, 0, 0])
    expect(withinPeriod({ startsAt: late, endsAt: new Date(late.getTime() + 2 * 3600_000) }, p)).toBe(false)
  })

  it('وقبل أوّل يومٍ خارجَها ولو بدقيقة', () => {
    const before = zonedInstant('2026-10-03', [23, 59, 0, 0])
    expect(withinPeriod({ startsAt: before }, p)).toBe(false)
    expect(withinPeriod({ startsAt: zonedInstant('2026-10-04', [0, 0, 0, 0]) }, p)).toBe(true)
  })

  it('ويومُ اللحظة يُقرأ في عمّان — منتصفُ ليلها يومٌ جديدٌ وغرينتش ما زال في أمسه', () => {
    expect(zonedDay(new Date('2026-10-03T21:30:00.000Z'))).toBe('2026-10-04')
    expect(zonedDay(new Date('2026-10-03T20:30:00.000Z'))).toBe('2026-10-03')
  })
})
