/* توليدُ اللقاءات من نمط الشعبة بتوقيتها لا بغرينتش (٨ نوفمبر ٢٠٢٦) — والعلّةُ في `CohortService.generateSessions`.

   «الثلاثاء والخميس · 18:00» تُحفظ بتوقيت الشعبة (عمّان افتراضا)، وكان المولِّدُ يقرؤها بغرينتش: فوُلدت اللقاءاتُ في
   التاسعة مساءً بعمّان، و«الثلاثاء · 22:30» وقعت فجرَ الأربعاء — والتوليدُ الآليُّ للفصل يمرّ به، فيرى المسجَّلون جدولا
   مزاحا ثلاثَ ساعات. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortService } from '../../services/cohort.service'
import { zonedClock, zonedDay } from '../../../src/application/trainer/cohort-period'

let prisma: PrismaClient
let cohorts: CohortService
let seq = 0

const weekdayIn = (at: Date, zone: string) => new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: zone }).format(at)
const cohort = async (days: string[], startTime: string, timezone = 'Asia/Amman') => {
  seq += 1
  return (await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title: `شعبة النمط ${seq}`, status: 'draft', capacity: 10,
      daysOfWeek: days, startTime, timezone, startsAt: new Date('2027-03-01T00:00:00Z'),
    } as never,
  })).id
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
}, 240_000)

describe('اللقاءات بتوقيت الشعبة', () => {
  it('⚠️ «الثلاثاء والخميس · 18:00» تولد في السادسة مساء بعمان، في يوميها', async () => {
    const out = await cohorts.generateSessions(null, await cohort(['tue', 'thu'], '18:00'), { weeks: 2 })
    expect(out.sessions).toHaveLength(4)
    for (const s of out.sessions) {
      expect(zonedClock(s.startsAt, 'Asia/Amman'), 'ولدت بساعة غرينتش').toBe('18:00')
      expect(['Tue', 'Thu']).toContain(weekdayIn(s.startsAt, 'Asia/Amman'))
    }
    expect(zonedDay(out.sessions[0]!.startsAt, 'Asia/Amman')).toBe('2027-03-02')
  })

  it('⚠️ «الثلاثاء · 22:30» يبقى الثلاثاء — لا فجر الأربعاء', async () => {
    const out = await cohorts.generateSessions(null, await cohort(['tue'], '22:30'), { weeks: 1 })
    const [s] = out.sessions
    expect(weekdayIn(s!.startsAt, 'Asia/Amman'), 'انتقل إلى اليوم التالي').toBe('Tue')
    expect(zonedClock(s!.startsAt, 'Asia/Amman')).toBe('22:30')
  })

  it('وما يكتب يقرأه النمط نفسه — فلا تنزاح الساعة بإعادة التوليد', async () => {
    const id = await cohort(['tue'], '18:00')
    await cohorts.generateSessions(null, id, { weeks: 1, apply: true })
    await prisma.cohortSession.updateMany({ where: { cohortId: id }, data: { placeholder: false, approvalState: 'approved' } })
    const pattern = await cohorts.applySessionPattern(id)
    expect(pattern?.startTime).toBe('18:00')
  })

  it('ومنطقة أخرى تقرأ بتوقيتها', async () => {
    const out = await cohorts.generateSessions(null, await cohort(['mon'], '09:00', 'Asia/Dubai'), { weeks: 1 })
    expect(zonedClock(out.sessions[0]!.startsAt, 'Asia/Dubai')).toBe('09:00')
  })
})
