/* شاشةُ «المالية» تقرأ حالاتِ الخادم بأسمائها — على صفوفٍ حقيقيّة لا على نصّ الشيفرة.

   كانت الشاشةُ تنتظر استردادا «requested» والخادمُ يكتب «pending»: يُطلب الاستردادُ ولا يظهر
   زرُّ تنفيذه أبدا. وكانت تعرض «cancelled» بالإنجليزيّة لأنّ معجمَها لا يعرفها. فيُنشأ هنا
   الصفُّ بالمسار الحقيقيّ، وتُسأل وحداتُ الشاشة (`finance-status.ts`) عنه. */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { approvedTrainerPlan } from '../helpers/approved-trainer'
import { ARCHIVED_INV, ARCHIVED_REQ, PAY_STATUS, REFUND_AWAITING, RF_STATUS } from '../../../src/application/commerce/finance-status'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let managerId = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  managerId = (await auth.register('fin-status-mgr@test.local', 'Manager#12345', 'مالية')).userId
  await auth.setRoles(managerId, ['academic_manager'])
}, 240_000)

const cohort = async (title: string) => (await prisma.cohort.create({
  data: {
    plans: { create: await approvedTrainerPlan(prisma) },
    courseId: 'C-BIZ-101', title, status: 'open', registrationOpen: true,
    financialReady: true, price: 100, currency: 'USD', capacity: 20,
  },
})).id

describe('حالاتُ الاسترداد', () => {
  it('الاستردادُ المطلوبُ يُقرأ «ينتظر التنفيذ» — فيظهر زرّاه', async () => {
    /* المزوّدُ الاختباريّ يُسوّي عند الدفع — فدفعةٌ ناجحةٌ يُطلب ردُّها */
    const userId = (await auth.register('fin-status-buyer@test.local', 'Buyer#12345', 'مشترٍ')).userId
    const out = await commerce.checkout(userId, [await cohort('شعبة الاسترداد')])
    await commerce.payOrder(out.orderId, userId, `fin-status-${out.orderId}`)
    const payment = await prisma.payment.findFirstOrThrow({ where: { invoice: { orderId: out.orderId }, status: 'succeeded' } })
    expect(PAY_STATUS[payment.status], 'دفعةٌ ناجحةٌ لا تعرضها الشاشة فلا يُطلب ردُّها').toBeTruthy()

    const refund = await commerce.requestRefund(payment.id, managerId, { amount: 40, reason: 'انسحاب موثق' })
    expect(refund.status, 'الشاشةُ تنتظر حالةً لا يكتبها الخادم — فلا زرَّ تنفيذ').toBe(REFUND_AWAITING)
    expect(RF_STATUS[refund.status]).toBeTruthy()

    const done = await commerce.processRefund(refund.id, managerId, true)
    expect(RF_STATUS[done.status], `حالةٌ بلا اسم في الشاشة: ${done.status}`).toBeTruthy()
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })
    expect(PAY_STATUS[after.status], 'دفعةٌ رُدّ بعضُها تختفي فلا يُردّ باقيها').toBeTruthy()
  })
})

describe('الأرشيف', () => {
  it('الطلبُ الذي ألغاه صاحبُه وفاتورتُه يذهبان إلى الأرشيف', async () => {
    await prisma.integrationSetting.upsert({
      where: { provider: 'payment' },
      update: { enabled: true, config: { driver: 'manual' } },
      create: { provider: 'payment', enabled: true, config: { driver: 'manual' } },
    })
    try {
      const userId = (await auth.register('fin-status-cancel@test.local', 'Buyer#12345', 'مشترٍ')).userId
      const out = await commerce.checkout(userId, [await cohort('شعبة الإلغاء')])
      await commerce.cancelOrder(out.orderId, userId)
      const req = await prisma.enrollmentRequest.findFirstOrThrow({ where: { userId } })
      const invoice = await prisma.invoice.findUniqueOrThrow({ where: { orderId: out.orderId } })
      expect(ARCHIVED_REQ.has(req.status), `طلبٌ ملغى يبقى بين المعلَّق: ${req.status}`).toBe(true)
      expect(ARCHIVED_INV.has(invoice.status), `فاتورةٌ ملغاة تبقى بين الصادرة: ${invoice.status}`).toBe(true)
    } finally {
      await prisma.integrationSetting.deleteMany({ where: { provider: 'payment' } })
    }
  })
})
