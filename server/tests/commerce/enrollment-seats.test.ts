/* مراجعةُ مسار التسجيل في الشعب (٥ نوفمبر ٢٠٢٦) — عطبان ثبتا بتجربةٍ على القاعدة، والعلّةُ في `enrollment.service.ts`.

   ① **والمقعدُ المحجوزُ لمن يدفع لا يأخذه غيرُه** — سجّل الفريقُ متعلّما في آخر مقعدٍ محجوزٍ لمشترٍ، فدفع المشتري ووُضع في قائمة
      الانتظار وقيل له «صارت مقاعدك تسجيلا».
   ② **وبندُ الطلب ينتقل مع المقعد** — من نقل مقعدَه إلى شعبةٍ أخرى بقي نصيبُ إيراده للمدرّب الأوّل، ولم يُحسب للثاني شيء. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { EarningsService } from '../../services/earnings.service'
import { approvedPlanBy, approvedTrainerPlan } from '../helpers/approved-trainer'

let prisma: PrismaClient, auth: AuthService, commerce: CommerceService, enrollments: EnrollmentService, seq = 0, admin = ''
const STAMP = Date.now()
let courses: string[] = []
const learner = async () => (await auth.register(`seats-${++seq}-${STAMP}@test.local`, 'Learner#12345', `l${seq}`)).userId
async function cohort(capacity: number, courseId = courses[0], plans?: unknown) {
  return (await prisma.cohort.create({ data: { plans: plans ?? { create: await approvedTrainerPlan(prisma) }, courseId, title: `شعبة التسجيل ${++seq}`, status: 'open', registrationOpen: true, financialReady: true, price: 100, currency: 'USD', capacity, startsAt: new Date(Date.now() + 30 * 86_400_000) } as never })).id
}
beforeAll(async () => {
  await setupTestDb(); prisma = await testPrisma(); auth = new AuthService(prisma)
  commerce = new CommerceService(prisma); enrollments = new EnrollmentService(prisma)
  admin = await learner()
  courses = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, take: 5 })).map((c) => c.id)
}, 240_000)
describe('مسار التسجيل', () => {
  it('⚠️ ① الفريق لا يسجل أحدا في مقعد محجوز لمشتر — والمشتري إذا دفع يسجل', async () => {
    const c = await cohort(1)
    const buyer = await learner()
    const o = await commerce.checkout(buyer, [c])
    const walkIn = await learner()
    const staff = await enrollments.enroll(c, walkIn, admin)
    await commerce.payOrder(o.orderId, buyer, `seats-${o.orderId}`)
    const mine = await prisma.enrollment.findUnique({ where: { cohortId_userId: { cohortId: c, userId: buyer } } })
    expect(staff.status, 'أخذ الفريق مقعدا محجوزا لمشتر').toBe('waitlisted')
    expect(mine?.status, 'دفع المشتري ووضع في الانتظار').toBe('enrolled')
  })
  it('⚠️ ② نصيب الإيراد ينتقل مع المقعد إلى الشعبة الجديدة', async () => {
    const mk = async (tag: string) => {
      const u = await prisma.user.create({ data: { email: `seats-t-${tag}-${STAMP}@wajeez.test`, displayName: tag, passwordHash: 'x' } })
      const a = await prisma.trainerApplication.create({ data: { reference: `WJ-TR-SEATS-${tag}-${STAMP}`, fullName: tag, email: u.email, status: 'active' } })
      return (await prisma.trainerProfile.create({ data: { userId: u.id, applicationId: a.id } })).id
    }
    const [x, y] = [await mk('x'), await mk('y')]
    const earnings = new EarningsService(prisma)
    for (const t of [x, y]) await earnings.setRule(admin, { profileId: t, type: 'revenue_share', rate: 40 })
    const cx = await cohort(20, courses[1], { create: approvedPlanBy(x) })
    const cy = await cohort(20, courses[1], { create: approvedPlanBy(y) })
    await prisma.cohortTrainer.create({ data: { cohortId: cx, profileId: x, role: 'lead', assignedBy: admin } })
    await prisma.cohortTrainer.create({ data: { cohortId: cy, profileId: y, role: 'lead', assignedBy: admin } })
    const b = await learner()
    const o = await commerce.checkout(b, [cx])
    await commerce.payOrder(o.orderId, b, `seats-b-${o.orderId}`)
    const e = await prisma.enrollment.findUniqueOrThrow({ where: { cohortId_userId: { cohortId: cx, userId: b } } })
    await enrollments.switchCohort(b, e.id, cy)
    expect((await earnings.computeCohort(cy)).total, 'لم يحسب لمدرب الشعبة الجديدة').toBe(40)
    expect((await earnings.computeCohort(cx)).total, 'بقي للمدرب الأول نصيب من غادره').toBe(0)
  })
})

