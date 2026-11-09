/* لا يُشترى شيءٌ مجانا وحدَه (٩ نوفمبر ٢٠٢٦) — قرارُ صاحب المنصّة: «free session can't be bought solo, but as an extra with
   path that has payments anyway». والعلّةُ في `CommerceService.checkout` و`createCoupon`.

   ① كوبونٌ بمئة بالمئة كان يُنشئ طلبا بصفرٍ «ينتظر الدفع» لا يُدفع (حدُّ Stripe نصفُ دولار) — يبقى معلّقا ومقعدُه محجوزا.
   ② وكودٌ مكرّرٌ عند الإنشاء كان «خطأ في الخادم»، ونسبةٌ ومبلغٌ معا كانا يُقبلان فتغلب النسبةُ صامتة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { approvedTrainerPlan } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let adminId = ''
let pool: string[] = []
let seq = 0

const openCohort = async (price: number) => {
  seq += 1
  return (await prisma.cohort.create({
    data: {
      plans: { create: await approvedTrainerPlan(prisma) },
      courseId: pool.shift()!, title: `شعبة مجانية ${seq}`, status: 'open', registrationOpen: true,
      financialReady: true, price, currency: 'USD', capacity: 10, startsAt: new Date(Date.now() + 30 * 86_400_000),
    } as never,
  })).id
}
const buyer = async () => {
  seq += 1
  return (await auth.register(`nfs-${seq}@test.local`, 'Learn#12345', `مشتر ${seq}`)).userId
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  adminId = (await auth.register('nfs-admin@test.local', 'Admin#12345', 'المدير')).userId
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'asc' } })).map((c) => c.id)
}, 240_000)

describe('① لا يشترى شيء مجانا وحده', () => {
  it('⚠️ كوبون بمئة بالمئة: يرد الطلب بسببه — ولا طلب ولا مقعد محجوز', async () => {
    await commerce.createCoupon(adminId, { code: 'NFS100', percentOff: 100 })
    const me = await buyer()
    const cohortId = await openCohort(100)
    await expect(commerce.checkout(me, [cohortId], 'NFS100'), 'أنشأ طلبا بصفر لا يدفع').rejects.toMatchObject({ code: 'nothing_to_pay' })
    expect(await prisma.order.count({ where: { userId: me } })).toBe(0)
  })

  it('⚠️ وما يبقى منه أقل من نصف دولار كذلك', async () => {
    await commerce.createCoupon(adminId, { code: 'NFS9970', amountOff: 99.7 })
    await expect(commerce.checkout(await buyer(), [await openCohort(100)], 'NFS9970')).rejects.toMatchObject({ code: 'nothing_to_pay' })
  })

  it('وما يبقى منه مبلغ يدفع يمضي كما كان', async () => {
    await commerce.createCoupon(adminId, { code: 'NFS50', percentOff: 50 })
    const out = await commerce.checkout(await buyer(), [await openCohort(100)], 'NFS50')
    expect(out.total).toBe(50)
  })
})

describe('② إنشاء الكوبون', () => {
  it('⚠️ الكود المكرر يقال بجملته — لا خطأ خادم', async () => {
    await commerce.createCoupon(adminId, { code: 'NFSDUP', percentOff: 10 })
    await expect(commerce.createCoupon(adminId, { code: 'nfsdup', percentOff: 20 }), 'خطأ خادم على كود مكرر').rejects.toMatchObject({ code: 'code_taken' })
  })

  it('⚠️ ونسبة ومبلغ معا يردان — كما في التعديل', async () => {
    await expect(commerce.createCoupon(adminId, { code: 'NFSBOTH', percentOff: 10, amountOff: 50 })).rejects.toMatchObject({ code: 'bad_coupon' })
    expect(await prisma.coupon.count({ where: { code: 'NFSBOTH' } })).toBe(0)
  })
})
