/* تطابقُ المقاعد: ما يُعرض هو ما يقبله الشراء.

   كان عدّان لشيءٍ واحد. القائمةُ العامّة تحسب المتاحَ بـ`capacity − enrolled`
   وحدَه (public-catalog.service.ts)، و`checkout` يمنع على
   `enrolled + seat_held` (commerce.service.ts:303–309). فشعبةٌ امتلأت بحجوزٍ
   لم تُدفع بعد كانت تُعلن مقاعدَ متاحة، ثمّ ترمي 409 عند الضغط على «اشترِ».

   ولم يكن هذا يظهر قبل اليوم لأنّ الشراء كان يمرّ بنموذج «طلب تسجيل» لا
   ينادي الخادمَ أصلا. ومع الدفع المباشر يصير أوّلَ ما يصطدم به المشتري —
   ويقرؤه عطبا في الموقع لا امتلاءً في الشعبة.

   فالحارسُ هنا ليس على رقمٍ بل على **المطابقة**: كلّما قال العرضُ «صفر»
   وجب أن يرفض الشراءُ، وكلّما قال «واحد» وجب أن يقبل. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { PublicCatalogService } from '../../services/public-catalog.service'

let prisma: PrismaClient
let commerce: CommerceService
let publicCatalog: PublicCatalogService
let buyerId = ''
let cohortId = ''

/** المتاحُ كما تعلنه القائمة العامّة */
async function shownSeats(id: string): Promise<number | null> {
  const rows = await publicCatalog.cohorts()
  const row = rows.find((c) => c.id === id)
  expect(row, 'الشعبة لا تظهر في القائمة العامّة').toBeTruthy()
  return row!.seatsLeft
}

/** يحجز مقعدا بلا دفع — وهو ما كانت القائمةُ تتجاهله */
async function holdSeat(email: string) {
  const auth = new AuthService(prisma)
  const uid = (await auth.register(email, 'Holder#12345', 'حاجز')).userId
  await prisma.enrollmentRequest.create({
    data: { userId: uid, cohortId, status: 'seat_held' },
  })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  commerce = new CommerceService(prisma)
  publicCatalog = new PublicCatalogService(prisma)
  const auth = new AuthService(prisma)
  buyerId = (await auth.register('seat-parity-buyer@test.local', 'Buyer#12345', 'مشترٍ')).userId

  cohortId = (await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title: 'شعبة تطابق المقاعد',
      status: 'open', registrationOpen: true, financialReady: true,
      price: 100, currency: 'USD', capacity: 2,
      startsAt: new Date(Date.now() + 30 * 86_400_000),
    },
  })).id
}, 180_000)

describe('المقعد المحجوز مقعدٌ مشغول', () => {
  it('الشعبةُ الفارغة تعلن سعتَها كاملة', async () => {
    expect(await shownSeats(cohortId)).toBe(2)
  })

  it('وحجزٌ واحد لم يُدفع يُنقص المعروض — وهذا ما كان يُتجاهَل', async () => {
    await holdSeat('seat-parity-hold1@test.local')
    expect(await shownSeats(cohortId)).toBe(1)
  })

  it('وحين يبلغ المعروضُ صفرا يرفض الشراءُ فعلا — لا يَعِد ثمّ يرمي', async () => {
    await holdSeat('seat-parity-hold2@test.local')
    expect(await shownSeats(cohortId), 'العرض ما زال يقول إنّ ثمّة مقعدا').toBe(0)
    await expect(
      commerce.checkout(buyerId, [cohortId]),
      'العرضُ يقول صفرا والشراءُ يقبل — وهذا هو الافتراق نفسُه معكوسا',
    ).rejects.toThrow(/لا مقاعد متاحة/)
  })
})
