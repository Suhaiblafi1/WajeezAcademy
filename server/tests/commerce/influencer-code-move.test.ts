/* من أخذ كودا من مؤثّرٍ ثمّ عبّأ صفحةَ غيره (٢٣ نوفمبر ٢٠٢٦) — والعلّةُ في `moveInfluencerCode` (`influencer.service.ts`).

   رأى صاحبُ المنصّة: سجّل في صفحة ChatTree (60%) ثمّ في صفحة كاسيت (70%)، فرأى شعارَ كاسيت و«منحة ChatTree تغطي 60%».
   وقرارُه «Move to the new one»:
   ① **كودٌ لم يُستعمل ينتقل إلى الجديد** — الكودُ نفسُه، بمؤثّره وعمولته وخصمه، وعميلُه وقناتُه، وأثرٌ وجرسٌ لمن يدير التجارة.
      والجوابُ باسم الجديد ونسبته، وعمولةُ ما يُشترى به بعدُ له.
   ② **وما استُعمل يبقى لصاحبه** — والجوابُ باسمه هو، بلا أثر نقل.
   ③ **وبلاك فرايدي كما هي** — من جاءها برابط مؤثّرٍ ثمّ برابط غيره يبقى للأوّل. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { GrantLandingService } from '../../services/grant-landing.service'
import { InfluencerService } from '../../services/influencer.service'
import { approvedTrainerPlan } from '../helpers/approved-trainer'
import { BLACK_FRIDAY_GRANT_SLUG, INFLUENCER_GRANT_SLUG } from '../../../src/application/commerce/grant'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let landing: GrantLandingService
let influencers: InfluencerService
let ownerId = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()

async function openCohort(price = 100) {
  const courseId = pool.shift()
  if (!courseId) throw new Error('نفدت الدوراتُ المنشورة')
  return (await prisma.cohort.create({
    data: {
      plans: { create: await approvedTrainerPlan(prisma) },
      courseId, title: `شعبة نقل الكود ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() + 30 * 86_400_000),
    } as never,
  })).id
}
const person = (over: Record<string, unknown> = {}) => ({
  fullName: `متابع نقل ${++seq}`, phone: `+962793${String(700000 + seq)}`, email: `move-${seq}-${STAMP}@test.local`,
  workField: 'الموارد البشرية', ...over,
})
async function addInfluencer(code: string, percentOff: number, commissionPercent: number) {
  return (await influencers.create({ nameAr: `مؤثر ${code}`, code, commissionPercent, percentOff, email: `${code.toLowerCase()}-mv-${STAMP}@test.local` }, ownerId)).id
}
const moves = (grantCodeId: string) => prisma.auditEvent.findMany({
  where: { action: 'influencer.follower.move', meta: { path: ['grantCodeId'], equals: grantCodeId } },
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  landing = new GrantLandingService(prisma, INFLUENCER_GRANT_SLUG)
  influencers = new InfluencerService(prisma)
  ownerId = (await auth.register(`move-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  await new GrantService(prisma, INFLUENCER_GRANT_SLUG).update({ active: true }, ownerId)
  await new GrantService(prisma, BLACK_FRIDAY_GRANT_SLUG).update({ active: true }, ownerId)
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'desc' } }))
    .map((c) => c.id)
}, 240_000)

describe('① كود لم يستعمل ينتقل إلى الجديد', () => {
  it('⚠️ ChatTree 60% ثم كاسيت 70%: الكود نفسه لكاسيت بخصمها وعمولتها، والجواب باسمها — وأثر يسمي ما تغير', async () => {
    const tree = await addInfluencer('TREEMV', 60, 15)
    const kas = await addInfluencer('KASMV', 70, 5)
    const p = person({ influencerCode: 'TREEMV' })
    const first = await landing.apply(p)
    const code = first.grant!.code!
    expect(first.grant?.percentOff).toBe(60)

    const again = await landing.apply({ ...p, influencerCode: 'KASMV' })
    expect(again.ref).toBe(first.ref)
    expect(again.influencer, 'الجواب باسم المؤثر الأول').toMatchObject({ nameAr: 'مؤثر KASMV', code: 'KASMV' })
    expect(again.grant?.percentOff, 'النسبة نسبة الأول').toBe(70)
    expect(again.campaign.percentOff).toBe(70)

    const g = await prisma.grantCode.findUniqueOrThrow({ where: { leadId: first.ref }, include: { coupon: true } })
    expect(g.coupon.code, 'صنع كودا جديدا بدل نقله').toBe(code)
    expect(g).toMatchObject({ influencerId: kas, commissionPercent: 5 })
    expect(g.coupon.percentOff).toBe(70)
    expect(await prisma.lead.findUniqueOrThrow({ where: { id: first.ref } })).toMatchObject({ influencerId: kas, channel: 'kasmv' })

    const [ev] = await moves(g.id)
    expect(ev, 'لا أثر للنقل').toBeTruthy()
    expect(ev).toMatchObject({ entityType: 'influencer', entityId: kas })
    expect(ev.before).toMatchObject({ influencerId: tree, commissionPercent: 15, percentOff: 60 })
    expect(ev.after).toMatchObject({ influencerId: kas, commissionPercent: 5, percentOff: 70 })

    /* وعمولةُ ما يُشترى به بعدُ لكاسيت لا لـChatTree */
    const buyer = (await auth.register(p.email as string, 'Learner#12345', 'متابع')).userId
    const cohortId = await openCohort(100)
    const out = await commerce.checkout(buyer, [cohortId], code)
    await commerce.payOrder(out.orderId, buyer, `mv-${out.orderId}`)
    const [kasStmt, treeStmt] = await Promise.all([influencers.statement(kas), influencers.statement(tree)])
    expect(kasStmt.rows.find((r) => r.orderId === out.orderId)?.commission, 'عمولة الطلب ليست لكاسيت بنسبتها').toBe(5)
    expect(treeStmt.rows.some((r) => r.orderId === out.orderId), 'عمولة الطلب بقيت لـChatTree').toBe(false)
    expect(kasStmt.totals.signups).toBe(1)
    expect(treeStmt.totals.signups, 'بقي المتابع في «سجلوا» عند ChatTree').toBe(0)
  })
})

describe('② ما استعمل يبقى لصاحبه', () => {
  /* وكاسيت هنا صاحبةُ الكود الأوّل — لها شعارٌ عندنا (`BUILT_IN_INFLUENCER_LOGOS`)، فيُرى أنّ الجوابَ يحمل وجهَها كلَّه:
     اسمَها وشعارَها، لا شعارَ صفحة الرابط */
  it('⚠️ اشترى بكود كاسيت ثم عبأ صفحة مؤثر آخر: الكود لكاسيت بنسبتها، والجواب باسمها وشعارها — بلا أثر نقل', async () => {
    const kas = (await prisma.influencer.findFirst({ where: { code: 'KASEET' }, select: { id: true } }))?.id
      ?? await addInfluencer('KASEET', 70, 5)
    await influencers.update(kas, { percentOff: 70, active: true }, ownerId)
    const kasRow = await prisma.influencer.findUniqueOrThrow({ where: { id: kas } })
    await addInfluencer('TREEUSED', 60, 15)
    const p = person({ influencerCode: 'KASEET' })
    const first = await landing.apply(p)
    const code = first.grant!.code!
    const buyer = (await auth.register(p.email as string, 'Learner#12345', 'متابع')).userId
    const out = await commerce.checkout(buyer, [await openCohort(100)], code)
    await commerce.payOrder(out.orderId, buyer, `used-${out.orderId}`)

    const again = await landing.apply({ ...p, influencerCode: 'TREEUSED' })
    expect(again.influencer, 'قيل له مؤثر الرابط أو بلا شعار من بقي له كوده').toEqual({
      nameAr: kasRow.nameAr, code: 'KASEET', brand: { logoUrl: '/influencers/kaseet.png' }, whatsAppText: expect.stringContaining(kasRow.nameAr),
    })
    expect(again.grant?.percentOff).toBe(70)
    const g = await prisma.grantCode.findUniqueOrThrow({ where: { leadId: first.ref }, include: { coupon: true } })
    expect(g).toMatchObject({ influencerId: kas, commissionPercent: kasRow.commissionPercent })
    expect(g.coupon.percentOff).toBe(70)
    expect(await moves(g.id)).toHaveLength(0)
  })
})

describe('③ بلاك فرايدي كما هي', () => {
  it('⚠️ برابط مؤثر ثم برابط غيره: يبقى للأول، ولا نقل', async () => {
    const first = await addInfluencer('BFFIRST', 60, 15)
    await addInfluencer('BFSECOND', 70, 5)
    const bf = new GrantLandingService(prisma, BLACK_FRIDAY_GRANT_SLUG)
    const p = person()
    const a = await bf.apply({ ...p, channel: 'BFFIRST' })
    const b = await bf.apply({ ...p, channel: 'BFSECOND' })
    expect(b.ref).toBe(a.ref)
    const g = await prisma.grantCode.findUniqueOrThrow({ where: { leadId: a.ref } })
    expect(g.influencerId).toBe(first)
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: a.ref } })).influencerId).toBe(first)
    expect(await moves(g.id)).toHaveLength(0)
  })
})
