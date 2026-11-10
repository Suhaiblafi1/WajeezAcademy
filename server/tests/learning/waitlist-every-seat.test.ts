/* المقعدُ الشاغرُ لمن ينتظره — من كلّ بابٍ يُخليه، لا من الإسقاط وحدَه (١٠ نوفمبر ٢٠٢٦).

   كان الطابورُ يُرقّى منه عند الإسقاط وحدَه (`drop`). وجُرّبت ثلاثةُ أبوابٍ أخرى فمرّت والمنتظِرُ منتظِر:
   ① التبديلُ إلى شعبةٍ أخرى — تعود الشعبةُ «مفتوحة» لمشترٍ جديد.
   ② رفعُ السعة — يبقى المنتظِرُ، وتبقى الشعبةُ «ممتلئة» فلا يُشترى مقعدُها الجديد.
   ③ حجزٌ لم يُدفع يُفكّ — بإلغاء صاحبه، أو بانقضاء ساعته في العامل.
   والعلّةُ في `EnrollmentService.fillFromWaitlist`. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { CohortService } from '../../services/cohort.service'
import { CommerceService } from '../../services/commerce.service'
import { reclaimAbandonedOrders } from '../../worker/jobs'
import { approvedTrainerPlan } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
let enrollments: EnrollmentService
let commerce: CommerceService
let adminId = ''
const STAMP = Date.now()
let seq = 0

const learner = async () => (await auth.register(`wl-${++seq}-${STAMP}@test.local`, 'Learner#12345', `متعلم ${seq}`)).userId
const cohort = async (capacity: number) => (await prisma.cohort.create({
  data: {
    plans: { create: await approvedTrainerPlan(prisma) }, courseId: 'C-BIZ-101', title: `شعبة الانتظار ${++seq}`,
    status: 'open', registrationOpen: true, financialReady: true, price: 100, currency: 'USD', capacity,
    startsAt: new Date(Date.now() + 20 * 86_400_000),
  } as never,
})).id
const seat = async (cohortId: string, userId: string) =>
  (await prisma.enrollment.findUniqueOrThrow({ where: { cohortId_userId: { cohortId, userId } } })).status
const cohortStatus = async (id: string) => (await prisma.cohort.findUniqueOrThrow({ where: { id } })).status

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  enrollments = new EnrollmentService(prisma)
  commerce = new CommerceService(prisma)
  adminId = await learner()
  /* مزوّدٌ يدويّ: الشراءُ يحجز المقعدَ ولا يسوّيه فورا — فيبقى حجزٌ يُفكّ */
  await prisma.integrationSetting.upsert({
    where: { provider: 'payment' },
    update: { enabled: true, config: { driver: 'manual' } },
    create: { provider: 'payment', enabled: true, config: { driver: 'manual' } },
  })
}, 240_000)

afterAll(async () => { await prisma.integrationSetting.deleteMany({ where: { provider: 'payment' } }) })

describe('المقعد الشاغر لمن ينتظره', () => {
  it('⚠️ ① من بدل شعبته: يرقى المنتظر إلى مقعده', async () => {
    const [c, other] = [await cohort(2), await cohort(5)]
    const [a, b, w] = [await learner(), await learner(), await learner()]
    const ea = await enrollments.enroll(c, a, null)
    await enrollments.enroll(c, b, null)
    await enrollments.enroll(c, w, null)
    expect(await seat(c, w)).toBe('waitlisted')

    await enrollments.switchCohort(a, ea.id, other)
    expect(await seat(c, w), 'بقي المنتظر منتظرا وعاد المقعد للبيع').toBe('enrolled')
    expect(await cohortStatus(c)).toBe('full')
  })

  it('⚠️ ② رفع السعة: يرقى المنتظرون بأقدميتهم وتفتح الشعبة لما بقي', async () => {
    const c = await cohort(1)
    const [a, w1, w2] = [await learner(), await learner(), await learner()]
    await enrollments.enroll(c, a, null)
    await enrollments.enroll(c, w1, null)
    await enrollments.enroll(c, w2, null)
    expect(await cohortStatus(c)).toBe('full')

    await new CohortService(prisma).update(adminId, c, { capacity: 4 })
    expect([await seat(c, w1), await seat(c, w2)], 'بقي المنتظرون بعد رفع السعة').toEqual(['enrolled', 'enrolled'])
    expect(await cohortStatus(c), 'بقيت ممتلئة وفيها مقعد شاغر').toBe('open')
  })

  it('⚠️ ③ حجز ألغاه صاحبه: يرقى المنتظر', async () => {
    const c = await cohort(2)
    const [a, h, w] = [await learner(), await learner(), await learner()]
    await enrollments.enroll(c, a, null)
    const order = await commerce.checkout(h, [c])
    await enrollments.enroll(c, w, null)
    expect(await seat(c, w)).toBe('waitlisted')

    await commerce.cancelOrder(order.orderId, h)
    expect(await seat(c, w), 'ذهب المقعد المفكوك للبيع لا للمنتظر').toBe('enrolled')
  })

  it('⚠️ ③ وحجز انقضت ساعته في العامل: يرقى المنتظر', async () => {
    const c = await cohort(2)
    const [a, h, w] = [await learner(), await learner(), await learner()]
    await enrollments.enroll(c, a, null)
    const order = await commerce.checkout(h, [c])
    await enrollments.enroll(c, w, null)
    await prisma.order.update({ where: { id: order.orderId }, data: { createdAt: new Date(Date.now() - 3 * 3_600_000) } })

    await reclaimAbandonedOrders(prisma)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } })).status).toBe('cancelled')
    expect(await seat(c, w), 'ذهب المقعد المفكوك للبيع لا للمنتظر').toBe('enrolled')
  })
})
