/* «مسارٌ عامّ» `/go/BF80` — الدوراتُ الثلاث برابطٍ واحدٍ للجميع (٢٢ نوفمبر ٢٠٢٦). والعلّةُ في `private-path.service.ts`.

   طلبُ صاحب المنصّة: «اجعل الرابط عامّا: يسجّل دخوله أو ينشئ حسابا إن لم يكن له، فيظهر المسارُ باسمه»، ومن لا كودَ له في
   بلاك فرايدي **«Give code instantly»**: يُعطى كودَها على حسابه بلا هاتف.

   ① **بلا حساب**: دوراتُه الثلاث بلا اسمٍ ولا سعرٍ ولا كود، و«سجل دخولك» — ونداءُ المتعلّم بلا جلسةٍ ٤٠١.
   ② **وبحسابٍ لا كودَ له**: يُعطى كودَ بلاك فرايدي بنسبتها (80%) فورا، بأثره، وباسمه — والثلاثُ مسعّرةٌ به.
   ③ **ومن له كودُها يأخذه نفسَه** — ولا يُعطى ثانيا.
   ④ **والحملةُ المغلقة**: لا كود، ويُقال «المنحة مغلقة الآن».
   ⑤ **ومن اشترى بمنحةٍ غيرِها** لا يُعطى كودَها — منحةٌ واحدةٌ لكلّ متعلّم. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { approvedPlanBy } from '../helpers/approved-trainer'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { BLACK_FRIDAY_GRANT_SLUG, GRANT_CLOSED_AR, OPEN_GRANT_SLUG, grantClosesAt } from '../../../src/application/commerce/grant'

const THREE = ['C-JOB-104', 'C-MGR-107', 'C-BIZ-107']
const STAMP = Date.now()
let prisma: PrismaClient
let auth: AuthService
let bf: GrantService
let app: FastifyInstance
let ownerId = ''
let seq = 0

async function learner(name = 'ليلى سامي الحسن') {
  const email = `pub-${++seq}-${STAMP}@test.local`
  const { userId } = await auth.register(email, 'Learner#12345', name)
  return { userId, email, cookie: `${SESSION_COOKIE}=${(await auth.login(email, 'Learner#12345')).token}` }
}
const get = (url: string, cookie?: string) => app.inject({ method: 'GET', url, ...(cookie ? { headers: { cookie } } : {}) })
const bfOpen = (active = true) => bf.update({ active, percentOff: 80, maxCourses: 4, maxCodes: null, closesAt: new Date(grantClosesAt('2098-12-31')) }, ownerId)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  bf = new GrantService(prisma, BLACK_FRIDAY_GRANT_SLUG)
  ownerId = (await learner('صاحب المنصة')).userId
  await auth.setRoles(ownerId, ['super_admin'])
  /* مدرّبٌ منشور يقود الشعب الثلاث — فتظهر في صفحة الحملة (`GrantCoursesService.pool`) */
  const tu = await prisma.user.create({ data: { email: `pub-tr-${STAMP}@wajeez.test`, displayName: 'مدرب المسار', passwordHash: 'x' } })
  const ta = await prisma.trainerApplication.create({ data: { reference: `WJ-TR-PUB-${STAMP}`, fullName: 'مدرب المسار', email: tu.email, status: 'active' } })
  const profileId = (await prisma.trainerProfile.create({
    data: { userId: tu.id, applicationId: ta.id, publicVisibility: true, isVerified: true, publishApprovedAt: new Date() },
  })).id
  for (const courseId of THREE) {
    const c = await prisma.cohort.create({
      data: {
        plans: { create: approvedPlanBy(profileId) }, courseId, title: `شعبة عامة ${courseId}`,
        status: 'open', registrationOpen: true, financialReady: true, price: 100, currency: 'USD', capacity: 20,
        startsAt: new Date(Date.now() + 30 * 86_400_000),
      } as never,
    })
    await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: ownerId } })
  }
  await bfOpen()
  app = await buildApp(prisma)
}, 240_000)
afterAll(async () => { await app?.close() })

describe('① بلا حساب', () => {
  it('⚠️ دوراته الثلاث بلا اسم ولا سعر ولا كود — ورمزه بحروف صغيرة يفتح', async () => {
    const res = await get('/api/public/go/bf80')
    expect(res.statusCode).toBe(200)
    const v = res.json()
    expect(v.courses.map((c: { courseId: string }) => c.courseId)).toEqual(THREE)
    expect(v.publicPath).toMatchObject({ code: 'BF80', signIn: true })
    expect([v.firstName, v.nameAr, v.price, v.couponCode]).toEqual(['', '', null, null])
  })

  it('⚠️ ونداء المتعلم بلا جلسة 401', async () => {
    expect((await get('/api/learner/go/BF80')).statusCode).toBe(401)
  })
})

describe('② بحساب لا كود له', () => {
  it('⚠️ يعطى كود بلاك فرايدي 80% فورا بأثره — وباسمه، والثلاث مسعرة به', async () => {
    const l = await learner()
    const res = await get('/api/learner/go/BF80', l.cookie)
    expect(res.statusCode).toBe(200)
    const v = res.json()
    expect(v.couponCode).toMatch(/^WG-/)
    const coupon = await prisma.coupon.findUniqueOrThrow({
      where: { code: v.couponCode }, select: { percentOff: true, grantCode: { select: { campaign: { select: { slug: true } }, lead: { select: { email: true, phone: true, userId: true } } } } },
    })
    expect(coupon.percentOff).toBe(80)
    expect(coupon.grantCode?.campaign.slug).toBe(BLACK_FRIDAY_GRANT_SLUG)
    expect(coupon.grantCode?.lead).toEqual({ email: l.email, phone: null, userId: l.userId })
    expect(await prisma.auditEvent.count({ where: { action: 'coupon.grant_issue', meta: { path: ['code'], equals: v.couponCode } } })).toBe(1)
    expect(v.nameAr).toBe('ليلى الحسن')
    expect(v.publicPath).toEqual({ code: 'BF80', signIn: false, noteAr: null })
    expect(v.courses.map((c: { courseId: string }) => c.courseId)).toEqual(THREE)
    expect(v.price.grantPct).toBe(80)
    expect(v.price.total).toBeCloseTo(v.price.before * 0.2, 2)
    /* ولا استبدال ولا إضافة — قرار صاحب المنصة */
    expect([v.coursesLeft, v.grantCourseIds]).toEqual([null, null])
  })

  it('⚠️ ونقرتان معا كود واحد', async () => {
    const l = await learner()
    const [a, b] = await Promise.all([get('/api/learner/go/BF80', l.cookie), get('/api/learner/go/BF80', l.cookie)])
    expect(a.json().couponCode).toMatch(/^WG-/)
    expect(b.json().couponCode).toBe(a.json().couponCode)
  })
})

describe('③ من له كودها يأخذه نفسه', () => {
  it('⚠️ كوده من نموذجها ببريده — لا كود ثان', async () => {
    const l = await learner()
    const lead = await prisma.lead.create({ data: { fullName: 'ليلى', email: l.email, phone: '+962790000001', campaign: BLACK_FRIDAY_GRANT_SLUG, source: 'campaign' } })
    const { code } = await bf.issue({ leadId: lead.id })
    const before = await prisma.grantCode.count()
    const v = (await get('/api/learner/go/BF80', l.cookie)).json()
    expect(v.couponCode).toBe(code)
    expect(await prisma.grantCode.count()).toBe(before)
  })
})

describe('⑤ من اشترى بمنحة غيرها', () => {
  it('⚠️ لا يعطى كودها — يبقى كوده', async () => {
    const open = new GrantService(prisma, OPEN_GRANT_SLUG)
    await open.update({ active: true, percentOff: 50, maxCourses: 4, maxCodes: null, closesAt: new Date(grantClosesAt('2098-12-31')) }, ownerId)
    const l = await learner()
    const lead = await prisma.lead.create({ data: { fullName: 'ليلى', email: l.email, phone: '+962790000002', campaign: OPEN_GRANT_SLUG, source: 'campaign' } })
    const { code } = await open.issue({ leadId: lead.id })
    const cohort = await prisma.cohort.findFirstOrThrow({ where: { courseId: THREE[0], status: 'open' }, select: { id: true } })
    const commerce = new CommerceService(prisma)
    const out = await commerce.checkout(l.userId, [cohort.id], code)
    await commerce.payOrder(out.orderId, l.userId, `pub-${out.orderId}`)
    const v = (await get('/api/learner/go/BF80', l.cookie)).json()
    expect(v.couponCode).toBe(code)
    expect(await prisma.lead.count({ where: { email: l.email, campaign: BLACK_FRIDAY_GRANT_SLUG } })).toBe(0)
  })
})

describe('④ الحملة المغلقة', () => {
  it('⚠️ لا كود ويقال «المنحة مغلقة الآن»', async () => {
    await bfOpen(false)
    try {
      const l = await learner()
      const v = (await get('/api/learner/go/BF80', l.cookie)).json()
      expect(v.couponCode).toBeNull()
      expect(v.publicPath.noteAr).toBe(GRANT_CLOSED_AR)
      expect(await prisma.lead.count({ where: { email: l.email } })).toBe(0)
    } finally {
      await bfOpen()
    }
  })
})
