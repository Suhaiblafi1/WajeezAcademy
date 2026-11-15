/* دوراتُ كلّ منحةٍ يختارها المدير (١٥ نوفمبر ٢٠٢٦) — والعلّةُ في رأس `src/application/commerce/grant-scope.ts`.

   ① **حملةٌ بلا اختيارٍ كما كانت** — تُعرض كلُّ دورةٍ متاحة، ويخصم الكودُ على السلّة كلِّها.
   ② **وباختيارٍ: لا يُعرض ولا يُخصم إلّا عليها** — دورةٌ مختارةٌ ودورةٌ غيرُها في سلّةٍ واحدة: الخصمُ على الأولى وحدَها،
      والثانيةُ بسعرها كاملا، ولا تُعدّ من حدّ الكود. وسلّةٌ بلا دورةٍ منها يُقال سببُها.
   ③ **والمؤثّرُ بعضُ قائمة حملته** — صفحتُه وكودُ من جاء به على دوراته، والتقاطعُ إن ضاقت قائمةُ الحملة، ولا يُختار له
      ما ليس فيها.
   ④ **والكودُ الذي دُفع به يثبت على دوراته يومَ أوّل شراء** — والذي لم يُدفع به يتبع القائمةَ الجديدة، والتلقائيُّ يثبت تلقائيّا.
   ⑤ **وكلُّ تغييرٍ أثرُه بمن غيّر وما كان وما صار** — وبابُه بصلاحيّة إعدادات المنحة، يردّ غيرَ المدير. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { GrantLandingService } from '../../services/grant-landing.service'
import { InfluencerService } from '../../services/influencer.service'
import { GrantCourseChoiceService } from '../../services/grant-scope.service'
import { approvedPlanBy } from '../helpers/approved-trainer'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { INFLUENCER_GRANT_SLUG, MEMBER_GRANT_SLUG, OPEN_GRANT_SLUG, type GrantSlug } from '../../../src/application/commerce/grant'

let prisma: PrismaClient
let app: FastifyInstance
let auth: AuthService
let commerce: CommerceService
let choice: GrantCourseChoiceService
let ownerId = ''
let profileId = ''
let boss = ''
let learnerCookie = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()
const DAY = 86_400_000

const nextCourse = () => {
  const id = pool.shift()
  if (!id) throw new Error('نفدت الدوراتُ المنشورة')
  return id
}
/** دورةٌ منشورةٌ بشعبةٍ تُشترى ومدرّبٍ منشور — فتظهر في صفحة المنحة */
async function course(price = 100): Promise<{ courseId: string; cohortId: string }> {
  const courseId = nextCourse()
  const c = await prisma.cohort.create({
    data: {
      plans: { create: approvedPlanBy(profileId) }, courseId, title: `شعبة دورات المنحة المختارة ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price, currency: 'USD', capacity: 50, startsAt: new Date(Date.now() + 30 * DAY),
    } as never,
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: ownerId } })
  return { courseId, cohortId: c.id }
}
async function learner() {
  seq += 1
  return (await auth.register(`gcc-${seq}-${STAMP}@test.local`, 'Learner#12345', `متعلم ${seq}`)).userId
}
async function codeOf(slug: typeof MEMBER_GRANT_SLUG | typeof OPEN_GRANT_SLUG | typeof INFLUENCER_GRANT_SLUG, influencer: { id: string; commissionPercent: number } | null = null) {
  return (await new GrantService(prisma, slug).issue({ influencer })).code
}
async function pay(userId: string, cohortIds: string[], code: string) {
  const out = await commerce.checkout(userId, cohortIds, code)
  await commerce.payOrder(out.orderId, userId, `gcc-${out.orderId}`)
  return out
}
const shown = async (slug: GrantSlug = MEMBER_GRANT_SLUG) => (await new GrantLandingService(prisma, slug).view()).openCourses.map((c) => c.courseId)
async function coursesLeft(code: string) {
  const coupon = await prisma.coupon.findUniqueOrThrow({
    where: { code }, include: { grantCode: { select: { campaign: { select: { id: true, active: true, closesAt: true, maxCourses: true } } } } },
  })
  return new GrantService(prisma).coursesLeft(coupon)
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  choice = new GrantCourseChoiceService(prisma)
  ownerId = (await auth.register(`gcc-owner-${STAMP}@test.local`, 'Owner#123456', 'صاحب المنصة')).userId
  await auth.setRoles(ownerId, ['super_admin'])
  boss = `${SESSION_COOKIE}=${(await auth.login(`gcc-owner-${STAMP}@test.local`, 'Owner#123456')).token}`
  await auth.register(`gcc-learner-${STAMP}@test.local`, 'Learner#123456', 'متعلم')
  learnerCookie = `${SESSION_COOKIE}=${(await auth.login(`gcc-learner-${STAMP}@test.local`, 'Learner#123456')).token}`
  const user = await prisma.user.create({ data: { email: `gcc-tr-${STAMP}@wajeez.test`, displayName: 'مدرب المنحة', passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-GCC-${STAMP}`, fullName: 'مدرب المنحة', email: user.email, status: 'active' },
  })
  profileId = (await prisma.trainerProfile.create({
    data: { userId: user.id, applicationId: application.id, publicVisibility: true, isVerified: true, publishApprovedAt: new Date() },
  })).id
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'asc' } })).map((c) => c.id)
  const closesAt = new Date(Date.now() + 20 * DAY)
  for (const slug of [MEMBER_GRANT_SLUG, OPEN_GRANT_SLUG, INFLUENCER_GRANT_SLUG] as const) {
    await new GrantService(prisma, slug).update({ active: true, percentOff: 60, maxCodes: null, maxCourses: 4, closesAt }, ownerId)
  }
}, 240_000)

afterAll(async () => { await app?.close() })

describe('① حملة بلا اختيار كما كانت', () => {
  it('⚠️ تعرض كل دورة متاحة، ويخصم الكود على السلة كلها', async () => {
    const [a, b] = [await course(100), await course(200)]
    const ids = await shown()
    expect(ids).toEqual(expect.arrayContaining([a.courseId, b.courseId]))
    const code = await codeOf(MEMBER_GRANT_SLUG)
    const out = await pay(await learner(), [a.cohortId, b.cohortId], code)
    expect(out.couponDiscount, 'لم تعم المنحة السلة').toBe(180)
    expect(out.total).toBe(120)
    expect(await coursesLeft(code)).toBe(2)
  })
})

describe('② وباختيار: لا يعرض ولا يخصم إلا عليها', () => {
  it('⚠️ الصفحة تعرض المختارة وحدها — والخصم على المختارة وحدها، والأخرى بسعرها كاملا ولا تعد من حد الكود', async () => {
    const [a, b] = [await course(100), await course(200)]
    await choice.setCampaignCourses(MEMBER_GRANT_SLUG, [a.courseId], ownerId)
    try {
      const ids = await shown()
      expect(ids).toContain(a.courseId)
      expect(ids, 'عرضت دورة لم تختر').not.toContain(b.courseId)

      const code = await codeOf(MEMBER_GRANT_SLUG)
      const userId = await learner()
      const q = await commerce.quote(userId, [a.cohortId, b.cohortId], code)
      expect(q.items.find((i) => i.cohortId === a.cohortId)?.couponApplies).toBe(true)
      expect(q.items.find((i) => i.cohortId === b.cohortId)?.couponApplies, 'خصمت دورة لم تختر').toBe(false)
      const out = await pay(userId, [a.cohortId, b.cohortId], code)
      expect(out.couponDiscount, 'خصم المنحة على غير دوراتها').toBe(60)
      /* والمنحةُ بدلُ الباقة: لا سلّمَ على ما خرج عنها */
      expect(out.bundleDiscount).toBe(0)
      expect(out.total).toBe(240)
      const items = await prisma.orderItem.findMany({ where: { orderId: out.orderId } })
      expect(items.find((i) => i.refId === b.cohortId)?.outsideGrant).toBe(true)
      expect(items.find((i) => i.refId === a.cohortId)?.outsideGrant).toBe(false)
      expect(await coursesLeft(code), 'عدت الدورة التي دفعت كاملة من حد الكود').toBe(3)

      /* وسلّةٌ بلا دورةٍ من دوراتها يُقال سببُها — لا تُسعَّر صامتةً بلا خصم */
      await expect(commerce.quote(await learner(), [b.cohortId], code)).rejects.toMatchObject({ code: 'grant_not_applicable' })
    } finally {
      await choice.setCampaignCourses(MEMBER_GRANT_SLUG, [], ownerId)
    }
    expect(await shown(), 'لم تعد تلقائية بالقائمة الفارغة').toContain(b.courseId)
  })

  it('⚠️ مختارة بلا شعبة تشترى لا تظهر — ولا تظهر دورة جديدة وحدها', async () => {
    const a = await course(100)
    const bare = nextCourse()
    await choice.setCampaignCourses(OPEN_GRANT_SLUG, [a.courseId, bare], ownerId)
    try {
      const fresh = await course(100)
      const ids = await shown(OPEN_GRANT_SLUG)
      expect(ids).toEqual([a.courseId])
      expect(ids, 'ظهرت دورة جديدة لم تضف').not.toContain(fresh.courseId)
      const c = await choice.campaignChoice(OPEN_GRANT_SLUG)
      expect(c.auto).toBe(false)
      expect(c.courses.find((x) => x.courseId === bare)?.shown).toBe(false)
      /* ولا تمسّ الحملتين الأخريين */
      expect(await shown(MEMBER_GRANT_SLUG)).toContain(fresh.courseId)
    } finally {
      await choice.setCampaignCourses(OPEN_GRANT_SLUG, [], ownerId)
    }
  })
})

describe('③ والمؤثر بعض قائمة حملته', () => {
  it('⚠️ صفحته وكود من جاء به على دوراته — والتقاطع إن ضاقت قائمة الحملة، ولا يختار له ما ليس فيها', async () => {
    const [a, b, c, d] = [await course(100), await course(100), await course(100), await course(100)]
    const influencers = new InfluencerService(prisma)
    const inf = await influencers.create({ nameAr: 'مؤثر الدورات', code: 'PICKS', commissionPercent: 15 }, ownerId)
    await choice.setCampaignCourses(INFLUENCER_GRANT_SLUG, [a.courseId, b.courseId, c.courseId], ownerId)
    try {
      await expect(choice.setInfluencerCourses(inf.id, [a.courseId, d.courseId], ownerId), 'اختير للمؤثر ما ليس في حملته')
        .rejects.toMatchObject({ code: 'bad_course' })
      await choice.setInfluencerCourses(inf.id, [a.courseId, c.courseId], ownerId)
      const landing = new GrantLandingService(prisma, INFLUENCER_GRANT_SLUG)
      const page = (await landing.influencerView('PICKS')).openCourses.map((x) => x.courseId).sort()
      expect(page, 'صفحة المؤثر بغير دوراته').toEqual([a.courseId, c.courseId].sort())
      /* وصفحةُ الحملة بلا مؤثّرٍ قائمتُها كلُّها */
      expect((await landing.view()).openCourses.map((x) => x.courseId).sort()).toEqual([a.courseId, b.courseId, c.courseId].sort())

      const code = await codeOf(INFLUENCER_GRANT_SLUG, { id: inf.id, commissionPercent: 15 })
      await expect(commerce.quote(await learner(), [b.cohortId], code), 'خصم كود المؤثر على غير دوراته')
        .rejects.toMatchObject({ code: 'grant_not_applicable' })

      /* والحملةُ تُسقط ج — فلا يبقى له إلّا أ */
      await choice.setCampaignCourses(INFLUENCER_GRANT_SLUG, [a.courseId, b.courseId], ownerId)
      expect((await landing.influencerView('PICKS')).openCourses.map((x) => x.courseId), 'زاد المؤثر على قائمة حملته').toEqual([a.courseId])
      const q = await commerce.quote(await learner(), [a.cohortId, c.cohortId], code)
      expect(q.items.find((i) => i.cohortId === c.cohortId)?.couponApplies, 'خصم كود المؤثر دورة أسقطتها الحملة').toBe(false)
      expect(q.couponDiscount).toBe(60)
      expect((await choice.influencerChoice(inf.id)).courseIds).toEqual([a.courseId])
    } finally {
      await choice.setInfluencerCourses(inf.id, [], ownerId)
      await choice.setCampaignCourses(INFLUENCER_GRANT_SLUG, [], ownerId)
    }
  })
})

describe('④ والكود الذي دفع به يثبت على دوراته', () => {
  it('⚠️ اشتري به قبل التضييق: يبقى بقائمته يومها — ولم يشتر به: يتبع القائمة الجديدة', async () => {
    const [a, b] = [await course(100), await course(100)]
    await choice.setCampaignCourses(MEMBER_GRANT_SLUG, [a.courseId, b.courseId], ownerId)
    try {
      const used = await codeOf(MEMBER_GRANT_SLUG)
      const fresh = await codeOf(MEMBER_GRANT_SLUG)
      const buyer = await learner()
      await pay(buyer, [a.cohortId], used)
      const row = await prisma.grantCode.findFirstOrThrow({ where: { coupon: { code: used } } })
      expect(row.firstPaidAt, 'لم يثبت الكود مع أول دفع').not.toBeNull()
      expect(row).toMatchObject({ allCoursesAtFirstPaid: false })
      expect([...row.courseIdsAtFirstPaid].sort()).toEqual([a.courseId, b.courseId].sort())

      await choice.setCampaignCourses(MEMBER_GRANT_SLUG, [a.courseId], ownerId)
      const later = await commerce.quote(buyer, [b.cohortId], used)
      expect(later.couponDiscount, 'ضاق كود اشتري به قبل التضييق').toBe(60)
      await expect(commerce.quote(await learner(), [b.cohortId], fresh), 'كود لم يستعمل لم يتبع القائمة الجديدة')
        .rejects.toMatchObject({ code: 'grant_not_applicable' })
      expect((await prisma.grantCode.findFirstOrThrow({ where: { coupon: { code: fresh } } })).firstPaidAt).toBeNull()
    } finally {
      await choice.setCampaignCourses(MEMBER_GRANT_SLUG, [], ownerId)
    }
  })

  it('⚠️ والتلقائي يثبت تلقائيا — فلا يضيق بعد أول شراء', async () => {
    const [a, b] = [await course(100), await course(100)]
    const code = await codeOf(OPEN_GRANT_SLUG)
    const buyer = await learner()
    await pay(buyer, [a.cohortId], code)
    expect(await prisma.grantCode.findFirstOrThrow({ where: { coupon: { code } } })).toMatchObject({ allCoursesAtFirstPaid: true })
    await choice.setCampaignCourses(OPEN_GRANT_SLUG, [a.courseId], ownerId)
    try {
      expect((await commerce.quote(buyer, [b.cohortId], code)).couponDiscount, 'ضاق كود تلقائي اشتري به').toBe(60)
    } finally {
      await choice.setCampaignCourses(OPEN_GRANT_SLUG, [], ownerId)
    }
  })
})

describe('⑤ الأثر والصلاحية', () => {
  it('⚠️ كل تغيير أثره بمن غير وما كان وما صار — وما لم يتغير لا أثر له', async () => {
    const a = await course(100)
    const s = await new GrantService(prisma).settings()
    const before = await prisma.auditEvent.count({ where: { action: 'coupon.grant_courses', entityId: s.id } })
    await choice.setCampaignCourses(MEMBER_GRANT_SLUG, [a.courseId], ownerId)
    await choice.setCampaignCourses(MEMBER_GRANT_SLUG, [a.courseId], ownerId)
    await choice.setCampaignCourses(MEMBER_GRANT_SLUG, [], ownerId)
    const rows = await prisma.auditEvent.findMany({
      where: { action: 'coupon.grant_courses', entityId: s.id }, orderBy: { createdAt: 'asc' }, skip: before,
    })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ actorId: ownerId, entityType: 'grant_campaign', before: { courseIds: [] }, after: { courseIds: [a.courseId] } })
    expect(rows[1]).toMatchObject({ before: { courseIds: [a.courseId] }, after: { courseIds: [] } })

    const inf = await new InfluencerService(prisma).create({ nameAr: 'مؤثر الأثر', code: 'TRAIL', commissionPercent: 15 }, ownerId)
    await choice.setInfluencerCourses(inf.id, [a.courseId], ownerId)
    expect(await prisma.auditEvent.findFirst({ where: { action: 'influencer.courses', entityId: inf.id } }))
      .toMatchObject({ actorId: ownerId, entityType: 'influencer', before: { courseIds: [] }, after: { courseIds: [a.courseId] } })
  })

  it('⚠️ بابها بصلاحية إعدادات المنحة — يرد غير المدير', async () => {
    const a = await course(100)
    const inf = await new InfluencerService(prisma).create({ nameAr: 'مؤثر الباب', code: 'GATE', commissionPercent: 15 }, ownerId)
    for (const [method, url] of [
      ['GET', '/api/admin/grant-courses/member'], ['PUT', '/api/admin/grant-courses/open'],
      ['GET', `/api/admin/influencers/${inf.id}/courses`], ['PUT', `/api/admin/influencers/${inf.id}/courses`],
    ] as const) {
      const res = await app.inject({ method, url, headers: { cookie: learnerCookie }, ...(method === 'PUT' ? { payload: { courseIds: [a.courseId] } } : {}) })
      expect(res.statusCode, `${method} ${url} لغير المدير`).toBe(403)
    }
    expect((await prisma.grantCampaign.findUniqueOrThrow({ where: { slug: OPEN_GRANT_SLUG } })).courseIds).toEqual([])

    const ok = await app.inject({ method: 'PUT', url: '/api/admin/grant-courses/open', headers: { cookie: boss }, payload: { courseIds: [a.courseId] } })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toMatchObject({ auto: false, courseIds: [a.courseId] })
    const back = await app.inject({ method: 'PUT', url: '/api/admin/grant-courses/open', headers: { cookie: boss }, payload: { courseIds: [] } })
    expect(back.json()).toMatchObject({ auto: true, courseIds: [] })
    const listed = await app.inject({ method: 'GET', url: '/api/admin/member-grant/open-courses?grant=open', headers: { cookie: boss } })
    expect(listed.statusCode).toBe(200)
  })
})
