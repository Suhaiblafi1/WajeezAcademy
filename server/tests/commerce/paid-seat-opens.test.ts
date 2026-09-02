/* الدفعُ يفتح الدورة — ولا يُطلب مرّتين.

   سؤالُ صاحب المنصّة كان: أمربوطةٌ بوابةُ الطالب بالتسجيل والدفع، أم
   ستطلب منه أن يدفع مرّةً أخرى ولا تفتح له الدورات؟ وكان في المسلك بابان
   يقولان «نعم» على غير قصد:

   ١) القيدُ `userId_cohortId` على `enrollmentRequest` واحدٌ لا يُثنّى، وكان
      `checkout` يُنشئ طلبا ثانيا للشعبة نفسِها ثمّ **يُحوّل** الحجزَ القائم
      إليه. فمن دفع طلبَه الأوّل وضغط «اشترِ الآن» مرّةً أخرى — والشاشةُ
      كانت تعرضه — ثمّ وصل webhook الأوّل، وجدت التسويةُ حجزا لا يعود إليها:
      فاتورةٌ مدفوعةٌ وشعبةٌ لا تُفتح.

   ٢) والتسويةُ كانت تقرأ سجلَّ الحجز وحدَه لا بنودَ الفاتورة، فأيُّ حجزٍ ضاع
      — بأيّ سبب — يُسقط تسجيلَ صاحبِه صامتا والفاتورةُ «مدفوعة». */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { AuthError } from '../../services/auth.service'

let prisma: PrismaClient
let commerce: CommerceService
let learnerId = ''
let financeId = ''

const mkCohort = async (title: string) =>
  (await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title, status: 'open', registrationOpen: true, financialReady: true,
      price: 100, currency: 'USD', capacity: 20,
      startsAt: new Date(Date.now() + 60 * 86_400_000),
    },
  })).id

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  commerce = new CommerceService(prisma)
  const auth = new AuthService(prisma)
  learnerId = (await auth.register('seat-opens@test.local', 'Buyer#12345', 'مشترٍ')).userId
  financeId = (await auth.register('seat-finance@test.local', 'Finance#12345', 'مالية')).userId
}, 240_000)

describe('الدفعُ يفتح الدورة ولا يُطلب مرّتين', () => {
  it('١) شراءٌ ثانٍ فوق حجزٍ لم يكتمل دفعُه يُرفض ويقول أين يُكمَل', async () => {
    const cohortId = await mkCohort('شعبة الطلب المعلَّق')
    const first = await commerce.checkout(learnerId, [cohortId])

    await expect(commerce.checkout(learnerId, [cohortId])).rejects.toThrow(AuthError)
    await expect(commerce.checkout(learnerId, [cohortId])).rejects.toMatchObject({ code: 'order_pending' })

    /* والحجزُ باقٍ على طلبه الأوّل — لم يُحوَّل إلى طلبٍ جديد */
    const held = await prisma.enrollmentRequest.findFirst({ where: { userId: learnerId, cohortId } })
    expect(held?.status).toBe('seat_held')
    expect(held?.orderId, 'الحجز انتقل إلى طلبٍ آخر فضاعت دفعةُ الأوّل').toBe(first.orderId)

    /* ولا طلبَ ثانيا في الدفتر لهذه الشعبة */
    const orders = await prisma.order.findMany({ where: { userId: learnerId, items: { some: { refId: cohortId } } } })
    expect(orders).toHaveLength(1)
  })

  it('٢) شراءٌ ثانٍ فوق دفعةٍ وصلت يُرفض بلا مطالبةٍ بمالٍ ثانٍ', async () => {
    const cohortId = await mkCohort('شعبة الدفعة الواصلة')
    const order = await commerce.checkout(learnerId, [cohortId])
    /* الطلبُ مدفوعٌ في الدفتر وحجزُه لم يُحوَّل بعد — لحظةُ ما بين الدفع وتسويته */
    await prisma.order.update({ where: { id: order.orderId }, data: { status: 'paid', paidAt: new Date() } })

    await expect(commerce.checkout(learnerId, [cohortId])).rejects.toMatchObject({ code: 'settling' })
  })

  it('٣) التسويةُ تفتح الدورة من بنود الفاتورة وإن ضاع سجلُّ الحجز', async () => {
    const cohortId = await mkCohort('شعبة الحجز الضائع')
    const order = await commerce.checkout(learnerId, [cohortId])

    /* يُمحى الحجزُ كما لو حوّله شراءٌ آخر أو محاه تدخّلٌ إداريّ */
    await prisma.enrollmentRequest.deleteMany({ where: { userId: learnerId, cohortId } })

    /* دفعةٌ مؤكَّدة (يدويّة هنا، وهي المسلكُ نفسُه الذي يسلكه webhook) */
    await commerce.recordManualPayment(order.invoiceId, financeId, { methodNote: 'حوالة بنكية' })

    const enrollment = await prisma.enrollment.findFirst({ where: { userId: learnerId, cohortId } })
    expect(enrollment?.status, 'فاتورةٌ مدفوعةٌ وشعبةٌ لم تُفتح').toBe('enrolled')
    /* وسجلُّ التقدّم يُجهَّز فورا — بوابةُ الطالب تقرأه */
    const progress = await prisma.courseProgress.findUnique({ where: { enrollmentId: enrollment!.id } })
    expect(progress?.percent).toBe(0)

    const invoice = await prisma.invoice.findUnique({ where: { id: order.invoiceId } })
    expect(invoice?.status).toBe('paid')
  })

  it('٤) الطلبُ المتروك يُلغيه صاحبُه فيُفرَج عن مقعده ويُشترى من جديد', async () => {
    const cohortId = await mkCohort('شعبة الطلب المتروك')
    const first = await commerce.checkout(learnerId, [cohortId])
    /* قفلٌ بلا مفتاحٍ سجن: الشراءُ مقفلٌ ما دام الحجزُ قائما */
    await expect(commerce.checkout(learnerId, [cohortId])).rejects.toMatchObject({ code: 'order_pending' })

    await commerce.cancelOrder(first.orderId, learnerId)

    const order = await prisma.order.findUnique({ where: { id: first.orderId }, include: { invoice: true } })
    expect(order?.status).toBe('cancelled')
    expect(order?.invoice?.status).toBe('void')
    const freed = await prisma.enrollmentRequest.findFirst({ where: { userId: learnerId, cohortId } })
    expect(freed?.status).toBe('cancelled')
    expect(freed?.orderId, 'الحجزُ الملغى بقي معلَّقا بطلبه').toBeNull()

    /* وبعد الإلغاء يُشترى من جديد بلا عائق */
    const again = await commerce.checkout(learnerId, [cohortId])
    expect(again.orderId).not.toBe(first.orderId)
    const held = await prisma.enrollmentRequest.findFirst({ where: { userId: learnerId, cohortId } })
    expect(held?.status).toBe('seat_held')
    expect(held?.orderId).toBe(again.orderId)
  })

  it('٥) المدفوعُ لا يُلغى من بوابة الطالب — ذاك استردادٌ لا إلغاء', async () => {
    const cohortId = await mkCohort('شعبة المدفوع')
    const order = await commerce.checkout(learnerId, [cohortId])
    await commerce.recordManualPayment(order.invoiceId, financeId, { methodNote: 'حوالة بنكية' })
    await expect(commerce.cancelOrder(order.orderId, learnerId)).rejects.toMatchObject({ code: 'already_paid' })
  })

  it('٦) لا يُلغي أحدٌ طلبَ غيره', async () => {
    const cohortId = await mkCohort('شعبة الغريب')
    const order = await commerce.checkout(learnerId, [cohortId])
    const auth = new AuthService(prisma)
    const stranger = (await auth.register('seat-stranger@test.local', 'Stranger#12345', 'غريب')).userId
    await expect(commerce.cancelOrder(order.orderId, stranger)).rejects.toMatchObject({ code: 'not_found' })
  })

  it('٧) المقعدُ المحجوزُ يُقرأ في بوابة الطالب بحالة طلبه', async () => {
    const cohortId = await mkCohort('شعبة القراءة')
    const order = await commerce.checkout(learnerId, [cohortId])

    const seats = await commerce.myHeldSeats(learnerId)
    const mine = seats.find((s) => s.cohortId === cohortId)
    expect(mine, 'الحجز لا يظهر في البوابة — فيبدو الدفع كأنّه ضاع').toBeTruthy()
    expect(mine!.status).toBe('seat_held')
    expect(mine!.orderStatus).toBe('pending_payment')
    expect(mine!.orderId).toBe(order.orderId)
    expect(mine!.invoiceNumber).toBe(order.invoiceNumber)
    expect(mine!.total).toBe(100)

    /* وبعد التسجيل الفعليّ لا يبقى حجزٌ معلَّقٌ يُقرأ */
    await commerce.recordManualPayment(order.invoiceId, financeId, { methodNote: 'حوالة بنكية' })
    const after = await commerce.myHeldSeats(learnerId)
    expect(after.some((s) => s.cohortId === cohortId)).toBe(false)
  })
})
