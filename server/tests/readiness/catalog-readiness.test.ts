/* جاهزيّة العرض — محاذاةُ الأسعار.

   ما يُحرَس هنا يمسّ المال:

   ١) **العرضُ لا يكتب.** الزرّ في اللوحة يعمل على قاعدة الإنتاج مباشرة. فلو
      كتب `apply=false` شيئا، لصار «اعرض ما سيحدث» فعلا لا استعلاما.

   ٢) **المقعدُ المدفوع لا يُعاد تسعيره.** إعادةُ التسعير بعد الحجز تغيّر ما
      اتُّفق عليه بعد الاتّفاق.

   وكان هنا «فتحُ شعبةٍ لكلّ دورة» وإيقاعُ جلساته — وتقاعد الزرُّ (١٢ أكتوبر
   ٢٠٢٦): لا تُفتح شعبةٌ إلّا باعتماد خطّة مدرّبها، وحارسُ ذلك في
   `server/tests/learning/cohort-open-gate.test.ts`. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { alignCohortPrices } from '../../services/catalog-readiness.service'

let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
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
