/* «الدفعُ تجريبيّ ودوراتٌ تبقى لم تُدفع» — شكوى صاحب المنصّة، وحارسُها.

   المسارُ التجريبيُّ صحيحٌ حين يكتمل. والعطبُ في مسارين يتركان دَينا لا
   يُسدَّد أبدا:

   ① **موافقةُ العمليّات تُنشئ طلبا غيرَ مدفوعٍ عمدا.** وهو صحيحٌ مع مزوّدٍ
      حقيقيّ (يدفع المتعلّمُ لاحقا). وفي التجريبيّ لا معنى له إطلاقا: لا صفحةَ
      دفعٍ يُعاد منها، ولا webhook (التحقّقُ يردّ كاذبا بلا سرّ). فيبقى المتعلّمُ
      ينظر إلى «بانتظار الدفع» عن مالٍ لا وجودَ له.

   ② **نافذةُ الشراء بين النداءين.** إنشاءُ الطلب يحجز المقعد، والدفعُ نداءٌ
      ثانٍ. ومن أغلق متصفّحَه بينهما ترك طلبا معلَّقا ومقعدا محجوزا — **والمقعدُ
      المحجوزُ يمنعه هو من إعادة الشراء** (٤٠٩). ولم تكن في المُشغِّل وظيفةٌ
      واحدةٌ تمسّ الطلبات ولا المقاعد.

   ── ولماذا يُقاس على المزوّد المُستقرّ لا على الإعداد ──

   `getPaymentProvider` تُسقط إلى الاختباريّ حين تكون القناةُ مغلقة، **أو حين
   يُضبط مزوّدٌ حقيقيٌّ بلا مفتاحٍ سرّيّ**. والحكمُ على `driver` وحدَه يُخطئ
   الثانية — وهي التي تعرض للطالب «صفحةُ دفعٍ آمنة» فوق مزوّدٍ وهميّ. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { isTestProviderActive } from '../../services/payments/provider'
import { reclaimAbandonedOrders } from '../../worker/jobs'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let managerId = ''
let cohortId = ''

const learner = async (email: string) => (await auth.register(email, 'Learner#12345', 'متعلّم')).userId

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  const m = await auth.register('unpaid-manager@test.local', 'Manager#12345', 'مدير')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])
  cohortId = (await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title: 'شعبةُ فحصِ الدَّين', status: 'open',
      registrationOpen: true, financialReady: true, price: 100, currency: 'USD', capacity: 50,
    },
  })).id
}, 240_000)

describe('المزوّدُ المُستقرُّ لا الإعدادُ المعلَن', () => {
  it('قناةٌ مغلقة ← اختباريّ', () => {
    expect(isTestProviderActive({ enabled: false, driver: 'stripe', secretKey: 'sk_live_x' })).toBe(true)
  })

  it('ومزوّدٌ حقيقيٌّ **بلا مفتاحٍ سرّيّ** ← اختباريٌّ كذلك — وهذا ما يُخطئه الحكمُ على السائق', () => {
    expect(isTestProviderActive({ enabled: true, driver: 'stripe' })).toBe(true)
    expect(isTestProviderActive({ enabled: true, driver: 'moyasar' })).toBe(true)
  })

  it('وبمفتاحٍ حقيقيٍّ ليس اختباريّا', () => {
    expect(isTestProviderActive({ enabled: true, driver: 'stripe', secretKey: 'sk_test_x' })).toBe(false)
  })
})

describe('موافقةُ العمليّات لا تترك دَينا في التجريبيّ', () => {
  it('تُسوّي الطلبَ وتُسجّل المتعلّمَ — لا «بانتظار الدفع» عن مالٍ لا وجودَ له', async () => {
    const userId = await learner('unpaid-approve@test.local')
    const req = await commerce.requestEnrollment(userId, cohortId)
    const order = await commerce.approveEnrollmentRequest(req.id, managerId)

    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(row.status, 'طلبٌ غيرُ مدفوعٍ في بيئةٍ لا مالَ فيها').toBe('paid')
    const after = await prisma.enrollmentRequest.findUniqueOrThrow({ where: { id: req.id } })
    expect(after.status).toBe('converted')
    expect(await prisma.enrollment.count({ where: { cohortId, userId } })).toBe(1)
    /* والدفعةُ مسجَّلةٌ فعلا — لا تسويةً بلا أثرِ مال */
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { orderId: order.id } })
    const payment = await prisma.payment.findFirstOrThrow({ where: { invoiceId: invoice.id } })
    expect(payment.status).toBe('succeeded')
    expect(payment.provider).toBe('test')
  })
})

describe('الطلبُ المهجورُ يُلغى ويُفرِج عن مقعده', () => {
  it('الحديثُ لا يُمسّ — والمهلةُ تتجاوز أطولَ صفحةِ دفعٍ حقيقيّة', async () => {
    const userId = await learner('unpaid-fresh@test.local')
    const out = await commerce.checkout(userId, [cohortId])
    const r = await reclaimAbandonedOrders(prisma)
    expect(r.done, 'أُلغي طلبٌ عمرُه دقائق — يُسرَق مقعدُ من يدفع الآن').toBe(0)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: out.orderId } })).status).toBe('pending_payment')
  })

  it('والمهجورُ يُلغى، ويعود مقعدُه، ويستطيع صاحبُه الشراءَ من جديد', async () => {
    const userId = await learner('unpaid-stale@test.local')
    const out = await commerce.checkout(userId, [cohortId])
    /* المقعدُ المحجوزُ يمنعه من إعادة الشراء — وهو نصفُ العطب */
    await expect(commerce.checkout(userId, [cohortId])).rejects.toBeTruthy()

    await prisma.order.update({
      where: { id: out.orderId }, data: { createdAt: new Date(Date.now() - 3 * 3_600_000) },
    })
    const r = await reclaimAbandonedOrders(prisma)
    expect(r.done).toBeGreaterThan(0)

    const order = await prisma.order.findUniqueOrThrow({ where: { id: out.orderId } })
    expect(order.status).toBe('cancelled')
    expect((await prisma.invoice.findUniqueOrThrow({ where: { orderId: out.orderId } })).status).toBe('void')
    const held = await prisma.enrollmentRequest.findFirst({ where: { userId, cohortId } })
    expect(held?.status, 'بقي المقعدُ محجوزا بطلبٍ مُلغى').toBe('cancelled')

    /* والبابُ يُفتح من جديد */
    const again = await commerce.checkout(userId, [cohortId])
    expect(again.orderId).not.toBe(out.orderId)
  })

  it('ولا يُلغى طلبٌ عليه دفعةٌ ناجحة مهما طال — ماله وصل', async () => {
    const userId = await learner('unpaid-hasmoney@test.local')
    const out = await commerce.checkout(userId, [cohortId])
    await commerce.payOrder(out.orderId, userId, `k-${out.orderId}`)
    /* يُعاد إلى «لم يُدفع» صناعيّا مع بقاء دفعته — الحالةُ التي تُقرأ بيد */
    await prisma.order.update({
      where: { id: out.orderId },
      data: { status: 'pending_payment', createdAt: new Date(Date.now() - 5 * 3_600_000) },
    })
    const r = await reclaimAbandonedOrders(prisma)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: out.orderId } })).status).toBe('pending_payment')
    expect(r.summaryAr).toContain('دفعةٌ ناجحة')
  })
})
