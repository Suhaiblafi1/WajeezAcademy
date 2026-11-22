/* رفعُ خصم المؤثّر يرفع أكوادَ متابعيه القائمة — ولا يخفضها (٢٢ نوفمبر ٢٠٢٦) — والعلّةُ في `influencer.service.ts#raiseInfluencerCodes`.

   رفع صاحبُ المنصّة خصمَ كاسيت من 40% إلى 65%، فبقي من أخذ كودَه قبلُ على 40%. فسُئل، واختار «Raise to 65%».

   ① **رفعُه يرفع كوبوناتِ أكواده القائمة** — والدفعُ يسعّر بالجديد، وصفحتُه تقوله (`myPercentOff`)، وبأثرٍ يقول كم ومن أيٍّ إلى أيّ.
      وكودُ بلاك فرايدي المنسوبُ إليه بقناته لا يُمسّ، ولا ما استُعمل كلُّه.
   ② **وخفضُه لا يخفض** — القائمُ يبقى بأعلاه، والجديدُ يأخذ الأقلّ.
   ③ **والعاملُ يلحق مرّةً ما سبق القرار** — كودٌ قديمٌ دون خصم مؤثّره يرتفع، ولا يجري ثانية. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { GrantLandingService } from '../../services/grant-landing.service'
import {
  INFLUENCER_CODES_CATCHUP_REASON, InfluencerService, applyInfluencerCodesCatchUp,
} from '../../services/influencer.service'
import { approvedTrainerPlan } from '../helpers/approved-trainer'
import { BLACK_FRIDAY_GRANT_SLUG, INFLUENCER_GRANT_SLUG } from '../../../src/application/commerce/grant'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let infLanding: GrantLandingService
let bfLanding: GrantLandingService
let influencers: InfluencerService
let ownerId = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()

async function openCohort(price = 100) {
  const courseId = pool.shift()
  if (!courseId) throw new Error('نفدت الدورات المنشورة')
  return (await prisma.cohort.create({
    data: {
      plans: { create: await approvedTrainerPlan(prisma) },
      courseId, title: `شعبة رفع الخصم ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() + 30 * 86_400_000),
    } as never,
  })).id
}
const person = (over: Record<string, unknown> = {}) => ({
  fullName: `متابع ${++seq}`, phone: `+962797${String(400000 + seq)}`, email: `raise-visitor-${seq}-${STAMP}@test.local`,
  workField: 'الموارد البشرية', ...over,
})
async function addInfluencer(code: string, percentOff: number | null) {
  return (await influencers.create({
    nameAr: `مؤثر ${code}`, code, commissionPercent: 5, percentOff, email: `${code.toLowerCase()}-raise-${STAMP}@test.local`,
  }, ownerId)).id
}
const couponPct = async (code: string) => (await prisma.coupon.findUniqueOrThrow({ where: { code } })).percentOff

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  infLanding = new GrantLandingService(prisma, INFLUENCER_GRANT_SLUG)
  bfLanding = new GrantLandingService(prisma, BLACK_FRIDAY_GRANT_SLUG)
  influencers = new InfluencerService(prisma)
  ownerId = (await auth.register(`raise-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  await new GrantService(prisma, INFLUENCER_GRANT_SLUG).update({ active: true, maxCodes: null, closesAt: null, percentOff: 45, maxCourses: 4 }, ownerId)
  /* وبلاك فرايدي بخمسين — دون خصم المؤثّر الجديد، فإن مسّها الرفعُ ظهر */
  await new GrantService(prisma, BLACK_FRIDAY_GRANT_SLUG).update({ active: true, maxCodes: null, closesAt: null, percentOff: 50 }, ownerId)
  const all = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'desc' } })).map((c) => c.id)
  pool = all.slice(Math.floor(all.length / 6))
}, 240_000)

describe('① رفع خصمه يرفع أكواد متابعيه القائمة', () => {
  it('⚠️ من 40% إلى 65%: كوده القائم 65%، والدفع يسعر بها، وصفحته تقولها، وبأثر — وكود بلاك فرايدي بقناته لا يمس', async () => {
    const id = await addInfluencer('RAISEK', 40)
    const old = await infLanding.apply(person({ influencerCode: 'RAISEK' }))
    expect(old.grant?.percentOff).toBe(40)
    const bf = await bfLanding.apply(person({ channel: 'raisek' }))
    expect(await prisma.grantCode.findUniqueOrThrow({ where: { leadId: bf.ref } }), 'لم ينسب كود بلاك فرايدي إليه').toMatchObject({ influencerId: id })
    expect(await couponPct(bf.grant!.code!)).toBe(50)

    await influencers.update(id, { percentOff: 65 }, ownerId)
    expect(await couponPct(old.grant!.code!), 'بقي كوده القائم على خصمه القديم').toBe(65)
    expect(await couponPct(bf.grant!.code!), 'رفع كود بلاك فرايدي معه').toBe(50)

    const q = await commerce.preview(null, [await openCohort(100)], old.grant!.code!)
    expect(q, 'الدفع لا يسعر بخصمه الجديد').toMatchObject({ subtotal: 100, grantPct: 65, total: 35, couponError: null })
    const page = await infLanding.influencerView('RAISEK', new Date(), old.ref)
    expect(page.myPercentOff, 'صفحته لا تقول نسبة كوده الآن').toBe(65)

    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'influencer.codes.raise', entityId: id } })
    expect(audit).toMatchObject({ actorId: ownerId, before: { percentOff: [40] }, after: { percentOff: 65 }, meta: { raised: 1, from: [40], to: 65 } })
  })

  it('⚠️ وما استعمل كله لا يمس', async () => {
    const id = await addInfluencer('RAISEUSED', 40)
    const used = await infLanding.apply(person({ influencerCode: 'RAISEUSED' }))
    const buyer = (await auth.register(`raise-buyer-${STAMP}@test.local`, 'Learner#12345', 'مشتر')).userId
    const out = await commerce.checkout(buyer, [await openCohort(), await openCohort(), await openCohort(), await openCohort()], used.grant!.code!)
    await commerce.payOrder(out.orderId, buyer, `raise-${out.orderId}`)
    const fresh = await infLanding.apply(person({ influencerCode: 'RAISEUSED' }))
    await influencers.update(id, { percentOff: 65 }, ownerId)
    expect(await couponPct(used.grant!.code!), 'رفع كودا استعمل كله').toBe(40)
    expect(await couponPct(fresh.grant!.code!)).toBe(65)
  })
})

describe('② وخفضه لا يخفض', () => {
  it('⚠️ من 65% إلى 50%: القائم يبقى 65%، والجديد 50%', async () => {
    const id = await addInfluencer('LOWERK', 40)
    const first = await infLanding.apply(person({ influencerCode: 'LOWERK' }))
    await influencers.update(id, { percentOff: 65 }, ownerId)
    await influencers.update(id, { percentOff: 50 }, ownerId)
    expect(await couponPct(first.grant!.code!), 'خفض كودا أعطي قبله').toBe(65)
    const next = await infLanding.apply(person({ influencerCode: 'LOWERK' }))
    expect(next.grant?.percentOff).toBe(50)
    expect(await couponPct(next.grant!.code!)).toBe(50)
  })
})

describe('③ والعامل يلحق مرة ما سبق القرار', () => {
  it('⚠️ كود قديم دون خصم مؤثره يرتفع مرة بأثر — ولا يجري ثانية', async () => {
    const id = await addInfluencer('CATCHK', 65)
    const old = await infLanding.apply(person({ influencerCode: 'CATCHK' }))
    /* كما وقع قبل القرار: خصمُه 65% وكودُه القديمُ على 40% */
    await prisma.coupon.update({ where: { code: old.grant!.code! }, data: { percentOff: 40 } })

    const first = await applyInfluencerCodesCatchUp(prisma)
    expect(first?.raised).toBeGreaterThanOrEqual(1)
    expect(await couponPct(old.grant!.code!), 'لم يلحق العامل كوده القديم').toBe(65)
    expect(await prisma.auditEvent.findFirst({
      where: { action: 'influencer.codes.raise', entityId: id, actorId: null, reason: INFLUENCER_CODES_CATCHUP_REASON },
    }), 'رفعه بلا أثر').not.toBeNull()

    await prisma.coupon.update({ where: { code: old.grant!.code! }, data: { percentOff: 40 } })
    expect(await applyInfluencerCodesCatchUp(prisma), 'جرى العامل ثانية').toBeNull()
    expect(await couponPct(old.grant!.code!)).toBe(40)
  })
})
