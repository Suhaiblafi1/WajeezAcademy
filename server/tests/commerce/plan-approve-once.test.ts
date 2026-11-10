/* موافقةُ طلبات الخطّة تقع مرّةً واحدة (١٠ نوفمبر ٢٠٢٦).

   كانت الطلباتُ المعلَّقةُ تُقرأ خارج المعاملة، ثمّ تُكتب «محجوزة» بمعرّفاتها بلا شرط حالتها. فنقرتان على «وافق» — أو
   موظّفان في اللحظة نفسِها — تقرآن «معلَّقة» كلتاهما: طلبا شراءٍ وفاتورتان للخطّة نفسِها، والثانيةُ تأخذ الحجوزَ من
   الأولى فتبقى فاتورةٌ بلا حجزٍ تُدفع. والعلّةُ في `CommerceService.approvePlanRequests`. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { approvedTrainerPlan } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
const STAMP = Date.now()

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
}, 240_000)

describe('موافقة طلبات الخطة', () => {
  it('⚠️ نقرتان على «وافق»: طلب شراء واحد وفاتورة واحدة — وترد الثانية', async () => {
    const userId = (await auth.register(`plan-once-${STAMP}@test.local`, 'Learner#12345', 'صاحب الخطة')).userId
    const ops = (await auth.register(`plan-once-ops-${STAMP}@test.local`, 'Ops#123456789', 'العمليات')).userId
    const plan = await prisma.learnerPlan.create({ data: { userId, nameAr: 'خطة الموافقة' } })
    const courses = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, take: 2 })).map((c) => c.id)
    for (const courseId of courses) {
      const cohort = await prisma.cohort.create({
        data: {
          plans: { create: await approvedTrainerPlan(prisma) }, courseId, title: `شعبة ${courseId} ${STAMP}`,
          status: 'open', registrationOpen: true, financialReady: true, price: 100, currency: 'USD', capacity: 10,
          startsAt: new Date(Date.now() + 7 * 86_400_000),
        },
      })
      await prisma.enrollmentRequest.create({ data: { userId, cohortId: cohort.id, planId: plan.id } })
    }

    const out = await Promise.allSettled([
      commerce.approvePlanRequests(plan.id, ops),
      commerce.approvePlanRequests(plan.id, ops),
    ])
    expect(out.filter((x) => x.status === 'fulfilled'), 'وافق مرتين').toHaveLength(1)
    expect((out.find((x) => x.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ status: 409 })

    const orders = await prisma.order.findMany({ where: { userId }, include: { invoice: true } })
    expect(orders, 'طلبا شراء للخطة نفسها').toHaveLength(1)
    const held = await prisma.enrollmentRequest.findMany({ where: { planId: plan.id } })
    expect(held.every((r) => r.status === 'seat_held' && r.orderId === orders[0].id), 'الحجوز على غير الطلب الباقي').toBe(true)
  })
})
