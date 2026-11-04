/* معاينةُ رابط الشراء (٤ نوفمبر ٢٠٢٦) — والعلّةُ في `CommerceService.preview` و`code-attempts.ts`.

   ① **المعاينةُ هي الفاتورة** — لكلّ نوع: بلا كود، منحة وجيز، منحة المؤثرين، المنحة العامة، كوبون عادي.
   ② **ولا تكتب شيئا** — لا طلبَ ولا فاتورةَ ولا حجزَ مقعد ولا عدَّ استعمالٍ للكود.
   ③ **والكودُ المردودُ سببُه وسعرٌ بدونه** — غيرُ صالح، مستعمَلٌ كلُّه، حملةٌ أُغلقت، دوراتٌ أكثر من حدّه — والدفعُ يردّه بالسبب نفسِه.
   ④ **والإعداداتُ تُقرأ حين تُسأل** — لا نسبةَ ولا حدَّ مكتوبا في المعاينة.
   ⑤ **وزائرٌ بلا حساب** — يُسعَّر، وما يخصّ الحسابَ يُفحص بعد دخوله.
   ⑥ **وما في الرابط لا يُصدَّق** — شعبةٌ لا وجودَ لها تُترك، وممتلئةٌ تُستبعد، ومكرّرٌ يُعدّ مرّة.
   ⑦ **ولا اسمَ لصاحب الكود** — اسمُ الحملة وحدَه.
   ⑧ **وتجربةُ الأكواد لها حدّ** — من عنوانٍ واحد.
   ⑨ **ومصدرُ الطلب في أثره** — حملةُ واتساب تُعرف ولا تغيّر السعر.
   ⑩ **والمسارُ عامٌّ** — يعمل بلا جلسة. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { InfluencerService } from '../../services/influencer.service'
import { CodeAttemptGuard, CODE_ATTEMPTS_PER_HOUR } from '../../services/commerce/code-attempts'
import { approvedTrainerPlan } from '../helpers/approved-trainer'
import { buildApp } from '../../http/app'
import { INFLUENCER_GRANT_SLUG, OPEN_GRANT_SLUG } from '../../../src/application/commerce/grant'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let members: GrantService
let influencerGrant: GrantService
let openGrant: GrantService
let influencers: InfluencerService
let app: FastifyInstance
let ownerId = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()

const nextCourse = () => {
  const id = pool.shift()
  if (!id) throw new Error('نفدت الدوراتُ المنشورة')
  return id
}
async function learner() {
  seq += 1
  return (await auth.register(`buylink-${seq}-${STAMP}@test.local`, 'Learner#12345', `مشتر ${seq}`)).userId
}
async function cohort(price: number, capacity = 20) {
  return (await prisma.cohort.create({
    data: {
      plans: { create: await approvedTrainerPlan(prisma) },
      courseId: nextCourse(), title: `شعبة الرابط ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price, currency: 'USD', capacity, startsAt: new Date(Date.now() + 30 * 86_400_000),
    } as never,
  })).id
}
async function lead(name = `عضو ${++seq}`) {
  return (await prisma.lead.create({ data: { fullName: name, phone: `0797${String(500000 + seq)}` } })).id
}
/** ما يكتبه أيُّ شراء — يُعدّ قبل المعاينة وبعدها */
async function writes() {
  const [orders, invoices, payments, holds, used] = await Promise.all([
    prisma.order.count(), prisma.invoice.count(), prisma.payment.count(),
    prisma.enrollmentRequest.count(), prisma.coupon.aggregate({ _sum: { usedCount: true } }),
  ])
  return { orders, invoices, payments, holds, used: used._sum.usedCount ?? 0 }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  members = new GrantService(prisma)
  influencerGrant = new GrantService(prisma, INFLUENCER_GRANT_SLUG)
  openGrant = new GrantService(prisma, OPEN_GRANT_SLUG)
  influencers = new InfluencerService(prisma)
  ownerId = (await auth.register(`buylink-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'desc' } }))
    .map((c) => c.id)
  for (const g of [members, influencerGrant, openGrant]) await g.update({ active: true, maxCodes: null, closesAt: null }, ownerId)
  app = await buildApp(prisma)
}, 240_000)

afterAll(async () => { await app?.close() })

describe('① المعاينة هي الفاتورة — لكل نوع', () => {
  it('⚠️ بلا كود: ١٧٠ + ١٠٠ بخصم بناء المسار ٨٪ = ٢٤٨٫٤٠ — والفاتورة نفسها', async () => {
    const ids = [await cohort(170), await cohort(100)]
    const anon = await commerce.preview(null, ids)
    expect(anon).toMatchObject({ subtotal: 270, bundlePct: 8, bundleDiscount: 21.6, couponDiscount: 0, total: 248.4, couponError: null })
    const u = await learner()
    const out = await commerce.checkout(u, ids)
    expect(out.total).toBe(anon.total)
  })

  it('⚠️ منحة وجيز ٦٠٪: دورة بـ١٧٠ = ٦٨، ودورتان ١٧٠ و١٠٠ = ١٠٨، بدل خصم بناء المسار', async () => {
    await members.update({ percentOff: 60, maxCourses: 4 }, ownerId)
    const { code } = await members.issue({ leadId: await lead() })
    const one = await commerce.preview(null, [await cohort(170)], code)
    expect(one).toMatchObject({ subtotal: 170, couponDiscount: 102, total: 68, grantPct: 60, grantNameAr: 'منحة وجيز', couponError: null })
    const ids = [await cohort(170), await cohort(100)]
    const two = await commerce.preview(null, ids, code)
    expect(two).toMatchObject({ bundlePct: 0, bundleDiscount: 0, couponDiscount: 162, total: 108 })
    const out = await commerce.checkout(await learner(), ids, code)
    expect(out.total, 'افترق المعروض عن المصدر').toBe(two.total)
  })

  it('⚠️ منحة وجيز على أربع دورات (١٧٠ + ١٠٠ + ١٥٠ + ٢٠٠ = ٦٢٠) = ٢٤٨', async () => {
    const { code } = await members.issue({ leadId: await lead() })
    const ids = [await cohort(170), await cohort(100), await cohort(150), await cohort(200)]
    const q = await commerce.preview(null, ids, code)
    expect(q).toMatchObject({ subtotal: 620, couponDiscount: 372, total: 248 })
    const bare = await commerce.preview(null, ids)
    expect(bare.total, 'بلا كود: خصم بناء المسار ٢٨٪').toBe(446.4)
  })

  it('⚠️ منحة المؤثرين ٤٥٪ والمنحة العامة ٥٠٪ والكوبون العادي فوق خصم البناء', async () => {
    await influencerGrant.update({ percentOff: 45, maxCourses: 4 }, ownerId)
    await openGrant.update({ percentOff: 50, maxCourses: 4 }, ownerId)
    const inf = await influencers.create({ nameAr: `مؤثر خفي ${STAMP}`, code: `HID${STAMP % 100000}`, commissionPercent: 15 }, ownerId)
    const infCode = (await influencerGrant.issue({ leadId: await lead(), influencer: { id: inf.id, commissionPercent: 15 } })).code
    const openCode = (await openGrant.issue({ leadId: await lead() })).code
    await prisma.coupon.create({ data: { code: `TEN${STAMP}`, percentOff: 10, active: true } })
    const ids = [await cohort(170), await cohort(100)]
    expect((await commerce.preview(null, ids, infCode)).total).toBe(148.5)
    expect((await commerce.preview(null, ids, openCode)).total).toBe(135)
    const ten = await commerce.preview(null, ids, `TEN${STAMP}`)
    expect(ten).toMatchObject({ bundleDiscount: 21.6, couponDiscount: 24.84, total: 223.56 })
    const out = await commerce.checkout(await learner(), ids, `ten${STAMP}`)
    expect(out.total).toBe(ten.total)
  })
})

describe('② ولا تكتب شيئا', () => {
  it('⚠️ لا طلب ولا فاتورة ولا دفعة ولا حجز مقعد ولا عد استعمال — بحساب وبدونه', async () => {
    const { code } = await members.issue({ leadId: await lead() })
    const ids = [await cohort(170), await cohort(100)]
    const u = await learner()
    const before = await writes()
    await commerce.preview(null, ids, code)
    await commerce.preview(u, ids, code)
    await commerce.preview(u, ids, 'WG-NOPE0000')
    expect(await writes()).toEqual(before)
    const c = await prisma.coupon.findUniqueOrThrow({ where: { code } })
    expect(c.usedCount).toBe(0)
  })
})

describe('③ الكود المردود: سببه وسعر بدونه — والدفع يرده بالسبب نفسه', () => {
  it('⚠️ كود غير صالح', async () => {
    const ids = [await cohort(170)]
    const q = await commerce.preview(null, ids, 'WG-ZZZZZZZZ')
    expect(q.couponError).toMatchObject({ code: 'bad_coupon' })
    expect(q.total).toBe(170)
  })

  it('⚠️ دورات أكثر من حد الكود: القاعدة نفسها في الدفع — والسعر سعر البناء', async () => {
    const { code } = await members.issue({ leadId: await lead() })
    const ids = [await cohort(100), await cohort(100), await cohort(100), await cohort(100), await cohort(100)]
    const q = await commerce.preview(null, ids, code)
    expect(q.couponError).toMatchObject({ code: 'grant_max_courses' })
    expect(q.couponError!.messageAr).toContain('4')
    expect(q).toMatchObject({ bundlePct: 30, total: 350, couponDiscount: 0 })
    await expect(commerce.checkout(await learner(), ids, code)).rejects.toMatchObject({ code: 'grant_max_courses' })
  })

  it('⚠️ كود استعمل كل دوراته', async () => {
    const { code } = await members.issue({ leadId: await lead() })
    const buyer = await learner()
    const ids = [await cohort(100), await cohort(100), await cohort(100), await cohort(100)]
    await commerce.checkout(buyer, ids, code)
    const q = await commerce.preview(null, [await cohort(100)], code)
    expect(q.couponError).toMatchObject({ code: 'grant_used' })
    expect(q.total).toBe(100)
  })

  it('⚠️ منحة انتهت: السبب والسعر العادي', async () => {
    const { code } = await openGrant.issue({ leadId: await lead() })
    await openGrant.update({ closesAt: new Date(Date.now() - 60_000) }, ownerId)
    try {
      const q = await commerce.preview(null, [await cohort(170), await cohort(100)], code)
      expect(q.couponError).toMatchObject({ code: 'grant_closed' })
      expect(q.total).toBe(248.4)
    } finally {
      await openGrant.update({ closesAt: null }, ownerId)
    }
  })
})

describe('④ الإعدادات تقرأ حين تسأل', () => {
  it('⚠️ حد الدورات ينزل من لوحة الإدارة فتقوله المعاينة دون تغيير في الشيفرة', async () => {
    const { code } = await members.issue({ leadId: await lead() })
    const ids = [await cohort(100), await cohort(100), await cohort(100)]
    expect((await commerce.preview(null, ids, code)).couponError).toBeNull()
    await members.update({ maxCourses: 2 }, ownerId)
    try {
      const q = await commerce.preview(null, ids, code)
      expect(q.couponError).toMatchObject({ code: 'grant_max_courses' })
      expect(q.couponError!.messageAr).toContain('2')
    } finally {
      await members.update({ maxCourses: 4 }, ownerId)
    }
  })
})

describe('⑤ زائر بلا حساب', () => {
  it('⚠️ دورة يملكها: تستبعد بعد الدخول بسببها، ولا تستبعد قبله ويقال إنها تفحص بعده', async () => {
    const owned = await cohort(170)
    const other = await cohort(100)
    const u = await learner()
    await prisma.enrollment.create({ data: { userId: u, cohortId: owned, status: 'enrolled' } as never })
    const signed = await commerce.preview(u, [owned, other])
    expect(signed.accountChecked).toBe(true)
    expect(signed.excluded.map((e) => e.reason)).toEqual(['already_enrolled'])
    expect(signed.total).toBe(100)
    const anon = await commerce.preview(null, [owned, other])
    expect(anon.accountChecked).toBe(false)
    expect(anon.excluded).toEqual([])
  })

  it('⚠️ كود لحساب بعينه: يطلب الدخول ولا يقول «ليس لحسابك»', async () => {
    const u = await learner()
    await prisma.coupon.create({ data: { code: `ADV-${STAMP}`, percentOff: 10, maxUses: 1, active: true, restrictedToUserId: u } })
    const ids = [await cohort(170)]
    const anon = await commerce.preview(null, ids, `ADV-${STAMP}`)
    expect(anon.couponError?.messageAr).toContain('سجل الدخول')
    const own = await commerce.preview(u, ids, `ADV-${STAMP}`)
    expect(own.couponError).toBeNull()
    expect(own.total).toBe(153)
  })
})

describe('⑥ ما في الرابط لا يصدق', () => {
  it('⚠️ شعبة لا وجود لها تترك، وممتلئة تستبعد، ومكرر يعد مرة', async () => {
    const a = await cohort(170)
    const full = await cohort(100, 1)
    await prisma.enrollment.create({ data: { userId: await learner(), cohortId: full, status: 'enrolled' } as never })
    const q = await commerce.preview(null, [a, a, full, '00000000-0000-4000-8000-000000000000'])
    expect(q.unknownCohorts).toBe(1)
    expect(q.excluded.map((e) => e.reason)).toEqual(['capacity_full'])
    expect(q.items.map((i) => i.cohortId)).toEqual([a])
    expect(q.total).toBe(170)
    await expect(commerce.preview(null, ['00000000-0000-4000-8000-000000000000'])).rejects.toMatchObject({ code: 'empty_cart' })
  })
})

describe('⑦ ولا اسم لصاحب الكود', () => {
  it('⚠️ اسم المؤثر وصاحب النموذج لا يردان في المعاينة', async () => {
    const inf = await influencers.create({ nameAr: `سرية ${STAMP}`, code: `SEC${STAMP % 100000}`, commissionPercent: 15 }, ownerId)
    const { code } = await influencerGrant.issue({ leadId: await lead(`صاحب نموذج ${STAMP}`), influencer: { id: inf.id, commissionPercent: 15 } })
    const json = JSON.stringify(await commerce.preview(null, [await cohort(170)], code))
    expect(json).not.toContain(`سرية ${STAMP}`)
    expect(json).not.toContain(`صاحب نموذج ${STAMP}`)
    expect(json).not.toContain(`SEC${STAMP % 100000}`)
    expect(json).toContain('منحة مؤثرين وجيز')
  })
})

describe('⑧ تجربة الأكواد لها حد', () => {
  it('⚠️ عشرة أكواد مردودة من عنوان ثم لا يسأل عن جديد — والكود نفسه والعنوان الآخر لا يتأثران', async () => {
    let t = 0
    const codes = new CodeAttemptGuard(CODE_ATTEMPTS_PER_HOUR, () => t)
    const ids = [await cohort(170)]
    for (let i = 0; i < CODE_ATTEMPTS_PER_HOUR; i++) {
      const q = await commerce.preview(null, ids, `WG-GUESS${String(i).padStart(3, '0')}`, { key: '1.1.1.1', codes })
      expect(q.couponError?.code).toBe('bad_coupon')
    }
    const blocked = await commerce.preview(null, ids, 'WG-GUESS999', { key: '1.1.1.1', codes })
    expect(blocked.couponError?.code).toBe('too_many_codes')
    expect(blocked.total).toBe(170)
    expect((await commerce.preview(null, ids, 'WG-GUESS000', { key: '1.1.1.1', codes })).couponError?.code, 'أعيد الكود نفسه').toBe('bad_coupon')
    expect((await commerce.preview(null, ids, 'WG-GUESS999', { key: '2.2.2.2', codes })).couponError?.code).toBe('bad_coupon')
    t += 3_600_001
    expect((await commerce.preview(null, ids, 'WG-GUESS998', { key: '1.1.1.1', codes })).couponError?.code, 'لم تمض الساعة').toBe('bad_coupon')
  })

  it('⚠️ كود صالح لا يسع السلة لا يعد تجربة', async () => {
    const codes = new CodeAttemptGuard(1, () => 0)
    const { code } = await members.issue({ leadId: await lead() })
    const five = [await cohort(100), await cohort(100), await cohort(100), await cohort(100), await cohort(100)]
    await commerce.preview(null, five, code, { key: 'k', codes })
    expect(codes.allows('k', 'WG-OTHER000')).toBe(true)
  })
})

describe('⑨ مصدر الطلب في أثره', () => {
  it('⚠️ حملة واتساب تكتب في أثر الطلب، والسعر كما هو', async () => {
    const ids = [await cohort(170)]
    const u = await learner()
    const out = await commerce.checkout(u, ids, undefined, undefined, { utmSource: 'whatsapp', utmCampaign: 'wajeez-sales', at: new Date().toISOString() })
    expect(out.total).toBe(170)
    const ev = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'order.checkout', entityId: out.orderId } })
    expect(ev.meta).toMatchObject({ touch: { utmSource: 'whatsapp', utmCampaign: 'wajeez-sales' } })
  })
})

describe('⑩ المسار عام', () => {
  it('⚠️ يعمل بلا جلسة ويرفض المدخل المشوه', async () => {
    const ids = [await cohort(170), await cohort(100)]
    const res = await app.inject({ method: 'POST', url: '/api/public/checkout/preview', payload: { cohortIds: ids } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ total: 248.4, accountChecked: false })
    const bad = await app.inject({ method: 'POST', url: '/api/public/checkout/preview', payload: { cohortIds: ['not-a-uuid'] } })
    expect(bad.statusCode).toBe(422)
  })
})
