/* «منحة أعضاء وجيز» على الخادم (٢٠ أكتوبر ٢٠٢٦) — والعلّةُ في رأس `grant.service.ts`.

   ① **تبدأ موقوفة** بستّين بالمئة وألف كود — ولا يُعطى كودٌ قبل أن تُشغَّل.
   ② **كودٌ لكلّ صاحب نموذج، بنسبة يومه** — من عبّأه مرّتين أخذ كودَه نفسَه، وتغييرُ النسبة على ما بعده.
   ③ **ولا يتجاوز المُعطى العدد** — ولا يُنقَص العددُ تحت ما أُعطي.
   ④ **بدلُ الباقة لا فوقها** — أربعُ دوراتٍ بأربعين بالمئة من سعرها، والفاتورةُ هي العرض.
   ⑤ **ويدفع الأقلّ** — سلّةٌ سعرُ باقتها أقلّ يُقال لصاحبها، ولا يُحرق الكود.
   ⑤ب **وعلى أربع دوراتٍ بحدٍّ أقصى** — والحدُّ بيد صاحب المنصّة.
   ⑥ **يُنقل ويُستعمل مرّة** — يستعمله غيرُ صاحبه، ثمّ لا يستعمله ثالث.
   ⑦ **ومنحةٌ واحدةٌ لكلّ متعلّم** — ولو جمع أكوادَ غيره.
   ⑧ **والحملةُ تُقرأ عند الاستعمال** — إيقافُها أو نهايتُها توقف كلَّ كود.
   ⑨ **وعند الشراء المباشر وحدَه** — بابُ الموافقة الإداريّة يردّه.
   ⑩ **وطلبُ المنحة يُقاصّ به خصمُ إكمال الخطّة** — لا يُعطى «ما فاته» فوق منحته.
   ⑪ **وفحصُ الهامش** — سعرُ الشعبة بعد المنحة مقابل أجر مقعدها. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { PlanService } from '../../services/plan.service'
import { GrantService } from '../../services/grant.service'
import { approvedPlanBy, approvedTrainerPlan } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let plans: PlanService
let grants: GrantService
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
  return (await auth.register(`grant-${seq}-${STAMP}@test.local`, 'Learner#12345', `مشتر ${seq}`)).userId
}
async function openCohort(courseId = nextCourse(), price = 150, plan?: { create: unknown }) {
  return prisma.cohort.create({
    data: {
      plans: plan ?? { create: await approvedTrainerPlan(prisma) },
      courseId, title: `شعبة المنحة ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() + 30 * 86_400_000),
    } as never,
  })
}
const cohorts = async (n: number, price = 150) => {
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push((await openCohort(nextCourse(), price)).id)
  return out
}
async function lead() {
  return (await prisma.lead.create({ data: { fullName: `عضو وجيز ${++seq}`, phone: `0798${String(400000 + seq)}` } })).id
}
const setGrant = (input: Parameters<GrantService['update']>[0]) => grants.update(input, ownerId)
async function pay(userId: string, cohortIds: string[], couponCode?: string) {
  const out = await commerce.checkout(userId, cohortIds, couponCode)
  await commerce.payOrder(out.orderId, userId, `grant-${out.orderId}`)
  return out
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  plans = new PlanService(prisma)
  grants = new GrantService(prisma)
  ownerId = (await auth.register(`grant-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'asc' } }))
    .map((c) => c.id)
}, 240_000)

describe('① تبدأ موقوفة', () => {
  it('⚠️ بستين وألف — ولا يعطى كود قبل أن تشغل', async () => {
    const s = await grants.settings()
    expect(s).toMatchObject({ percentOff: 60, maxCodes: 1000, maxCourses: 4, active: false, open: false })
    await expect(grants.issue({ leadId: await lead() })).rejects.toMatchObject({ code: 'grant_closed' })
    expect((await grants.settings()).issued).toBe(0)
  })
})

describe('② كود لكل صاحب نموذج بنسبة يومه', () => {
  it('⚠️ مرتين = الكود نفسه، وتغيير النسبة على ما بعده — ويكتب الأثر', async () => {
    await setGrant({ active: true, percentOff: 60, maxCodes: null, closesAt: null })
    const l = await lead()
    const a = await grants.issue({ leadId: l })
    expect(a.code).toMatch(/^WG-[A-Z2-9]{8}$/)
    expect(a.percentOff).toBe(60)
    const again = await grants.issue({ leadId: l })
    expect(again, 'أخذ صاحب النموذج كودا ثانيا').toMatchObject({ code: a.code, reused: true })

    await setGrant({ percentOff: 55 })
    const b = await grants.issue({ leadId: await lead() })
    expect(b.percentOff).toBe(55)
    const old = await prisma.coupon.findUniqueOrThrow({ where: { code: a.code } })
    expect(old.percentOff, 'غيرت النسبة الجديدة كودا أعطي قبلها').toBe(60)
    expect(old.maxUses).toBe(1)
    expect(old.restrictedToUserId, 'ربط الكود بحساب فلا ينقل').toBeNull()
    expect(await prisma.auditEvent.count({ where: { action: 'coupon.grant_settings', after: { path: ['percentOff'], equals: 55 } } })).toBeGreaterThan(0)
    expect(await prisma.auditEvent.count({ where: { action: 'coupon.grant_issue', meta: { path: ['code'], equals: b.code } } })).toBe(1)
    await setGrant({ percentOff: 60 })
  })
})

describe('③ ولا يتجاوز المعطى العدد', () => {
  it('⚠️ يعطى إلى العدد ثم يقال انتهت — ولا ينقص العدد تحت ما أعطي', async () => {
    const issued = (await grants.settings()).issued
    await setGrant({ maxCodes: issued + 1 })
    await grants.issue({ leadId: await lead() })
    await expect(grants.issue({ leadId: await lead() })).rejects.toMatchObject({ code: 'grant_sold_out' })
    await expect(setGrant({ maxCodes: issued })).rejects.toMatchObject({ code: 'below_issued' })
    await setGrant({ maxCodes: null })
  })
})

describe('④ بدل الباقة لا فوقها', () => {
  it('⚠️ أربع دورات بـ٦٠٪ من سعرها لا بسلم الباقة — والعرض هو الفاتورة', async () => {
    const u = await learner()
    const ids = await cohorts(4)
    const { code } = await grants.issue({ leadId: await lead() })
    const q = await commerce.quote(u, ids, code)
    expect(q.bundleDiscount, 'اجتمعت المنحة مع خصم الباقة').toBe(0)
    expect(q.bundlePct).toBe(0)
    expect(q.couponDiscount).toBe(360)
    expect(q.total).toBe(240)
    expect(q.grantPct).toBe(60)
    const out = await commerce.checkout(u, ids, code)
    expect(out.total).toBe(q.total)
    const order = await prisma.order.findUniqueOrThrow({ where: { id: out.orderId } })
    expect(Number(order.bundleDiscount)).toBe(0)
    expect(Number(order.discount)).toBe(360)
  })
})

describe('⑤ ويدفع الأقل', () => {
  it('⚠️ سعر الباقة أقل = يقال له ولا يحرق الكود', async () => {
    await setGrant({ percentOff: 20 })
    const { code } = await grants.issue({ leadId: await lead() })
    await setGrant({ percentOff: 60 })
    const u = await learner()
    const ids = await cohorts(4)
    /* أربع دوراتٍ بسلّمها ٢٨٪ أكثرُ من منحةٍ بعشرين */
    await expect(commerce.quote(u, ids, code)).rejects.toMatchObject({ code: 'grant_not_better' })
    await expect(commerce.checkout(u, ids, code)).rejects.toMatchObject({ code: 'grant_not_better' })
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code } })).usedCount, 'أحرق الكود بلا خصم').toBe(0)
    /* ودورةٌ واحدة بلا سلّم: المنحةُ أكثر فتقع */
    const one = await commerce.quote(u, [(await openCohort()).id], code)
    expect(one.total).toBe(120)
  })
})

describe('⑤ب وعلى أربع دورات بحد أقصى', () => {
  it('⚠️ خمس دورات بالمنحة ترد — والحد بيد صاحب المنصة', async () => {
    const { code } = await grants.issue({ leadId: await lead() })
    const u = await learner()
    const five = await cohorts(5, 100)
    await expect(commerce.quote(u, five, code)).rejects.toMatchObject({ code: 'grant_max_courses' })
    expect((await commerce.quote(u, five.slice(0, 4), code)).total).toBe(160)
    await setGrant({ maxCourses: 5 })
    expect((await commerce.quote(u, five, code)).total).toBe(200)
    await setGrant({ maxCourses: 4 })
  })
})

describe('⑥ ينقل ويستعمل مرة', () => {
  it('⚠️ يستعمله غير صاحبه — ثم لا يستعمله ثالث، ولا يستعمله صاحبه في طلب ثان', async () => {
    const { code } = await grants.issue({ leadId: await lead() })
    const friend = await learner()
    const out = await commerce.checkout(friend, [(await openCohort()).id], code)
    expect(out.total).toBe(60)
    await expect(commerce.quote(friend, [(await openCohort()).id], code)).rejects.toMatchObject({ code: 'grant_pending' })
    await commerce.payOrder(out.orderId, friend, `grant-${out.orderId}`)
    const third = await learner()
    await expect(commerce.quote(third, [(await openCohort()).id], code)).rejects.toMatchObject({ code: 'grant_used' })
  })
})

describe('⑦ ومنحة واحدة لكل متعلم', () => {
  it('⚠️ ولو جمع أكواد غيره', async () => {
    const u = await learner()
    const first = await grants.issue({ leadId: await lead() })
    const second = await grants.issue({ leadId: await lead() })
    await pay(u, [(await openCohort()).id], first.code)
    await expect(commerce.quote(u, [(await openCohort()).id], second.code)).rejects.toMatchObject({ code: 'grant_once' })
    /* وغيرُه يستعمل الثاني */
    expect((await commerce.quote(await learner(), [(await openCohort()).id], second.code)).grantPct).toBe(60)
  })
})

describe('⑧ والحملة تقرأ عند الاستعمال', () => {
  it('⚠️ إيقافها ونهايتها يوقفان كل كود — وتشغيلها يعيده', async () => {
    const { code } = await grants.issue({ leadId: await lead() })
    const u = await learner()
    const c = (await openCohort()).id
    await setGrant({ active: false })
    await expect(commerce.quote(u, [c], code)).rejects.toMatchObject({ code: 'grant_closed' })
    await setGrant({ active: true, closesAt: new Date(Date.now() - 60_000) })
    await expect(commerce.quote(u, [c], code)).rejects.toMatchObject({ code: 'grant_closed' })
    await expect(grants.issue({ leadId: await lead() })).rejects.toMatchObject({ code: 'grant_closed' })
    await setGrant({ closesAt: new Date(Date.now() + 30 * 86_400_000) })
    expect((await commerce.quote(u, [c], code)).total).toBe(60)
    await setGrant({ closesAt: null })
  })
})

describe('⑨ وعند الشراء المباشر وحده', () => {
  it('⚠️ موافقة طلب التسجيل الإدارية ترده', async () => {
    const u = await learner()
    const c = await openCohort()
    const req = await commerce.requestEnrollment(u, c.id)
    const { code } = await grants.issue({ leadId: await lead() })
    await expect(commerce.approveEnrollmentRequest(req.id, ownerId, code)).rejects.toMatchObject({ code: 'grant_checkout_only' })
  })
})

describe('⑩ وطلب المنحة يقاص به خصم إكمال الخطة', () => {
  it('⚠️ دورتان بالمنحة ثم الباقيتان — لا «ما فات» فوق المنحة', async () => {
    const u = await learner()
    const [A, B, C, D] = [nextCourse(), nextCourse(), nextCourse(), nextCourse()]
    await plans.adopt(u, { nameAr: 'خطتي', composed: true, courseIds: [A, B, C, D] })
    const { code } = await grants.issue({ leadId: await lead() })
    const first = await pay(u, [(await openCohort(A)).id, (await openCohort(B)).id], code)
    expect(first.total).toBe(120)
    const q = await commerce.quote(u, [(await openCohort(C)).id, (await openCohort(D)).id])
    expect(q.planCredit, 'أعطي خصم الإكمال كأن المنحة لم تكن').toBe(0)
    expect(q.total).toBe(276)
  })
})

describe('⑪ وفحص الهامش', () => {
  it('⚠️ أجر المقعد كما هو، ونسبة الإيراد على سعر القائمة — وبنسبة تجرب قبل الحفظ', async () => {
    const user = await prisma.user.create({ data: { email: `grant-tr-${STAMP}@wajeez.test`, displayName: 'مدرب المنحة', passwordHash: 'x' } })
    const app = await prisma.trainerApplication.create({
      data: { reference: `WJ-TR-GRANT-${STAMP}`, fullName: 'مدرب المنحة', email: user.email, status: 'active' },
    })
    const profileId = (await prisma.trainerProfile.create({ data: { userId: user.id, applicationId: app.id } })).id
    const seat = await openCohort(nextCourse(), 200, { create: approvedPlanBy(profileId) })
    const share = await openCohort(nextCourse(), 200, { create: approvedPlanBy(profileId) })
    for (const c of [seat, share]) {
      await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: ownerId } })
    }
    await prisma.trainerCompensationRule.create({ data: { profileId, type: 'per_seat', rate: 90, cohortId: seat.id, effectiveFrom: new Date(Date.now() - 86_400_000) } })
    await prisma.trainerCompensationRule.create({ data: { profileId, type: 'revenue_share', rate: 50, cohortId: share.id, effectiveFrom: new Date(Date.now() - 86_400_000) } })

    const row = async (pct?: number) => {
      const m = await grants.margins(pct)
      return (id: string) => m.rows.find((r) => r.cohortId === id)!
    }
    const at60 = await row()
    expect(at60(seat.id)).toMatchObject({ listPrice: 200, price: 80, seatCost: 90, margin: -10 })
    expect(at60(share.id), 'نسبة الإيراد تحسب على سعر القائمة كما في الكشف').toMatchObject({ price: 80, seatCost: 100, margin: -20 })
    const at40 = await row(40)
    expect(at40(seat.id)).toMatchObject({ price: 120, margin: 30 })
  })
})
