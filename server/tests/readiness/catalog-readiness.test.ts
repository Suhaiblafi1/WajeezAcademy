/* جاهزيّة العرض — فتحُ الشعب ومحاذاةُ الأسعار.

   ما يُحرَس هنا ثلاثة، وكلُّها تمسّ المال:

   ١) **العرضُ لا يكتب.** الزرّ في اللوحة يعمل على قاعدة الإنتاج مباشرة. فلو
      كتب `apply=false` شيئا، لصار «اعرض ما سيحدث» فعلا لا استعلاما — وهو
      أخطر ما يمكن أن يُخطئ فيه زرٌّ يفتح ٨١ شعبة.

   ٢) **لا سعرَ مُختلَق.** دورةٌ بلا سعرِ قائمة لا تُفتح لها شعبة، لأنّ فتحها
      يوجب اختلاق رقم — ورقمٌ مُختلَق يُطالَب به في الفاتورة.

   ٣) **المقعدُ المدفوع لا يُعاد تسعيره.** إعادةُ التسعير بعد الحجز تغيّر ما
      اتُّفق عليه بعد الاتّفاق. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { openAllCohorts, alignCohortPrices } from '../../services/catalog-readiness.service'

let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
})

describe('فتح الشعب', () => {
  it('العرضُ لا يكتب صفّا واحدا', async () => {
    const before = await prisma.cohort.count()
    const r = await openAllCohorts(prisma, { apply: false })
    const after = await prisma.cohort.count()
    expect(after).toBe(before)
    expect(r.applied).toBe(false)
    expect(r.publishedCourses).toBeGreaterThan(0)
  })

  it('ولا يفتح دورةً بلا سعرِ قائمة — ولا يختلق لها سعرا', async () => {
    const r = await openAllCohorts(prisma, { apply: false })
    const refused = r.rows.filter((x) => x.reason)
    for (const row of refused) {
      const c = await prisma.course.findUnique({ where: { id: row.courseId }, select: { listPrice: true } })
      expect(c?.listPrice).toBeNull()
    }
    /* وكلُّ ما سيُفتح له سعرٌ موجب من كتالوجه */
    for (const row of r.rows.filter((x) => !x.reason)) {
      expect(row.price).toBeGreaterThan(0)
      expect(row.currency).not.toBe('—')
    }
  })

  it('والتنفيذُ يفتح فعلا، ثمّ لا يعيد فتحَ ما فُتح', async () => {
    const first = await openAllCohorts(prisma, { apply: true })
    expect(first.opened).toBeGreaterThan(0)
    const second = await openAllCohorts(prisma, { apply: true })
    expect(second.opened).toBe(0)
    expect(second.alreadyLive).toBeGreaterThanOrEqual(first.opened)
  })
})

describe('محاذاة الأسعار', () => {
  it('العرضُ لا يغيّر سعرا', async () => {
    const before = await prisma.cohort.findMany({ select: { id: true, price: true }, orderBy: { id: 'asc' } })
    await alignCohortPrices(prisma, { apply: false })
    const after = await prisma.cohort.findMany({ select: { id: true, price: true }, orderBy: { id: 'asc' } })
    expect(after.map((c) => String(c.price))).toEqual(before.map((c) => String(c.price)))
  })

  it('والمقعدُ المحجوز يمنع إعادة التسعير', async () => {
    /* شعبةٌ بسعرٍ مخالفٍ لقائمتها، وفيها مقعدٌ محجوز */
    const course = await prisma.course.findFirst({ where: { listPrice: { not: null } } })
    expect(course).toBeTruthy()
    const cohort = await prisma.cohort.create({
      data: {
        courseId: course!.id, title: 'شعبةٌ لها مقعدٌ محجوز', status: 'open',
        startsAt: new Date(Date.now() + 30 * 86_400_000), capacity: 10,
        price: 1, currency: 'USD', registrationOpen: true,
      },
    })
    /* متعلّمٌ حقيقيّ — قاعدةُ الاختبار تُبنى بلا مستخدمين */
    const learner = await prisma.user.create({
      data: {
        email: `seatholder-${Date.now()}@test.local`,
        passwordHash: 'x'.repeat(60),
        displayName: 'صاحبُ مقعدٍ محجوز',
      },
    })
    await prisma.enrollmentRequest.create({
      data: { cohortId: cohort.id, userId: learner.id, status: 'seat_held' },
    })

    const r = await alignCohortPrices(prisma, { apply: true })
    const blocked = r.rows.find((x) => x.cohortId === cohort.id)
    expect(blocked?.blocked).toContain('محجوزا')

    const after = await prisma.cohort.findUnique({ where: { id: cohort.id }, select: { price: true } })
    expect(Number(after!.price)).toBe(1)

    await prisma.enrollmentRequest.deleteMany({ where: { cohortId: cohort.id } })
    await prisma.cohort.delete({ where: { id: cohort.id } })
    await prisma.user.delete({ where: { id: learner.id } })
  })
})
