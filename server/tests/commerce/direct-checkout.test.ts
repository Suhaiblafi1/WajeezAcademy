/* الشراء المباشر — لا طلبَ ولا انتظارَ موافقة.

   كان المسلك الوحيد: يطلب المتعلّم ← تراجع الإدارة وتوافق ← يُنشأ الطلب ←
   يدفع. وقرار صاحب المنتج: «الأسعار معلنة والدفع مباشر بلا طلب — التسجيل
   دائما متاح بغضّ النظر عن موعد فتح الشعبة. التسجيل شيء والبدء شيء آخر».

   فالتاريخ لا يحجب الشراء، والذي يحجب أمران: إغلاق التسجيل بقرارٍ إداريّ،
   أو نفادُ المقاعد. وهذا الملفّ يحرس الفرق بينهما — إذ الخلط بينهما هو ما
   يجعل شعبةً تبدأ بعد شهرين غيرَ قابلةٍ للشراء اليوم بلا سبب. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'

let prisma: PrismaClient
let commerce: CommerceService
let learnerId = ''
let farCohort = ''   // تبدأ بعد شهرين — يجب أن تُشترى اليوم
let closedCohort = ''
let fullCohort = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  commerce = new CommerceService(prisma)
  const auth = new AuthService(prisma)
  learnerId = (await auth.register('buy-direct@test.local', 'Buyer#12345', 'مشترٍ')).userId

  const mk = async (title: string, over: Record<string, unknown> = {}) =>
    (await prisma.cohort.create({
      data: {
        courseId: 'C-BIZ-101', title, status: 'open', registrationOpen: true, financialReady: true,
        price: 120, currency: 'USD', capacity: 20,
        startsAt: new Date(Date.now() + 60 * 86_400_000), // بعد شهرين
        ...over,
      },
    })).id

  farCohort = await mk('شعبة بعد شهرين')
  closedCohort = await mk('شعبة تسجيلها مغلق', { registrationOpen: false })
  fullCohort = await mk('شعبة بلا مقاعد', { capacity: 1 })
  /* تُملأ الشعبة الأخيرة بحجزٍ واحد */
  const other = (await auth.register('buy-other@test.local', 'Other#12345', 'آخر')).userId
  await prisma.enrollmentRequest.create({ data: { userId: other, cohortId: fullCohort, status: 'seat_held' } })
}, 240_000)

describe('الشراء المباشر', () => {
  it('١) شعبةٌ تبدأ بعد شهرين تُشترى اليوم — التسجيل شيء والبدء شيء آخر', async () => {
    const out = await commerce.checkout(learnerId, [farCohort])
    expect(out.total).toBe(120)
    expect(out.currency).toBe('USD')
    expect(out.invoiceNumber).toMatch(/^WJ-INV-/)

    /* المقعد محجوزٌ فورا بلا مراجعِ بشريّ */
    const held = await prisma.enrollmentRequest.findFirst({ where: { userId: learnerId, cohortId: farCohort } })
    expect(held?.status).toBe('seat_held')
    expect(held?.orderId).toBe(out.orderId)
    expect(held?.decidedBy, 'حُجز بقرار بشريّ لا بالشراء').toBeNull()
  })

  it('٢) والدفع يُسوّي الطلب فيصير المقعد تسجيلا فعليّا', async () => {
    const order = await prisma.order.findFirst({ where: { userId: learnerId }, orderBy: { createdAt: 'desc' } })
    await commerce.payOrder(order!.id, learnerId, `direct-${order!.id}`)
    const enrolled = await prisma.enrollment.findFirst({ where: { userId: learnerId, cohortId: farCohort } })
    expect(enrolled?.status).toBe('enrolled')
    const req = await prisma.enrollmentRequest.findFirst({ where: { userId: learnerId, cohortId: farCohort } })
    expect(req?.status).toBe('converted')
  })

  it('٣) وإغلاق التسجيل يحجب — وهو قرارٌ إداريّ لا تقويم', async () => {
    await expect(commerce.checkout(learnerId, [closedCohort])).rejects.toMatchObject({ code: 'closed' })
  })

  it('٤) ونفادُ المقاعد يحجب', async () => {
    await expect(commerce.checkout(learnerId, [fullCohort])).rejects.toMatchObject({ code: 'capacity_full' })
  })

  it('٥) ولا يُشترى ما اشتُري — لا دفعتان لمقعدٍ واحد', async () => {
    await expect(commerce.checkout(learnerId, [farCohort])).rejects.toMatchObject({ code: 'already_enrolled' })
  })

  it('٦) وعملتان في طلبٍ واحد تُرفضان — الجمع بينهما فاتورةٌ كاذبة', async () => {
    const jod = await prisma.cohort.create({
      data: {
        courseId: 'C-BIZ-101', title: 'شعبة بالدينار', status: 'open', registrationOpen: true,
        financialReady: true, price: 90, currency: 'JOD', capacity: 20,
      },
    })
    const usd = await prisma.cohort.create({
      data: {
        courseId: 'C-BIZ-101', title: 'شعبة بالدولار', status: 'open', registrationOpen: true,
        financialReady: true, price: 120, currency: 'USD', capacity: 20,
      },
    })
    await expect(commerce.checkout(learnerId, [jod.id, usd.id])).rejects.toMatchObject({ code: 'mixed_currency' })
  })
})
