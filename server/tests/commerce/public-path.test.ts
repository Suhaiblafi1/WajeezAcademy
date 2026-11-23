/* «مسارٌ عامّ» `/go/BF80` — الدوراتُ الثلاث برابطٍ واحدٍ للجميع (٢٢ نوفمبر ٢٠٢٦). والعلّةُ في `private-path.service.ts`.

   طلبُ صاحب المنصّة: «اجعل الرابط عامّا: يسجّل دخوله أو ينشئ حسابا إن لم يكن له، فيظهر المسارُ باسمه»، ومن لا كودَ له في
   بلاك فرايدي **«Give code instantly»**: يُعطى كودَها على حسابه بلا هاتف.

   ① **بلا حساب يرى كلَّ شيءٍ إلّا اسمَه** — قرارُ صاحب المنصّة (٢٣ نوفمبر ٢٠٢٦): «They should see everything, and once they
      click to pay, then create account or sign in»، نسخا لـ«بلا سعرٍ و"سجل دخولك"». فدوراتُه الثلاث بسعرها بنسبة الحملة الآن
      ومجموعِها، و«أضف دورة» بحدّها، وكلُّ اختيارٍ يُسعَّر كذلك (`/api/public/go/:code/preview`) — بلا كودٍ ولا اسم. ونداءُ
      المتعلّم بلا جلسةٍ ٤٠١.
   ② **وبحسابٍ لا كودَ له**: يُعطى كودَ بلاك فرايدي بنسبتها (80%) فورا، بأثره، وباسمه — والثلاثُ مسعّرةٌ به.
   ③ **ومن له كودُها يأخذه نفسَه** — ولا يُعطى ثانيا.
   ④ **والحملةُ المغلقة**: لا كود، ويُقال «المنحة مغلقة الآن».
   ⑤ **ومن اشترى بمنحةٍ غيرِها يأخذ كودَها على كلّ حال** — قرارُ صاحب المنصّة (٢٣ نوفمبر ٢٠٢٦): «They get 80% anyway, even if
      their code is linked to another grant»، نسخا لـ«لا يُعطى كودَها». فيُعطى كودا بـ80% من نموذجٍ بقناة المسار، وتسعّره المعاينةُ
      ويقبله الطلب (`grantOnceExempt`). و«منحةٌ واحدةٌ لكلّ متعلّم» باقيةٌ فيما سواه: كودُ منحةٍ ثانيةٍ غيرِه يُردّ.
   ⑥ **و«أضف دورة» من دورات بلاك فرايدي وحدَها** — قرارُ صاحب المنصّة (٢٢ نوفمبر ٢٠٢٦): «اسمح لهم بإضافة دورات، لكن من
      الدورات الباقية في منحة بلاك فرايدي فقط». فجوابُ المتعلّم يحمل قائمةَ صفحة الحملة (`grantCourseIds`) وما بقي على كوده
      ناقصا الثلاث (`coursesLeft`) بلا حدٍّ عند الصفر — ومن اشترى بكوده قبلُ نقص ما بقي له. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { approvedPlanBy } from '../helpers/approved-trainer'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { pageCourses } from '../../services/grant-scope.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { BLACK_FRIDAY_GRANT_SLUG, GRANT_CLOSED_AR, INFLUENCER_GRANT_SLUG, OPEN_GRANT_SLUG, grantClosesAt } from '../../../src/application/commerce/grant'

const THREE = ['C-JOB-104', 'C-MGR-107', 'C-BIZ-107']
const STAMP = Date.now()
let prisma: PrismaClient
let auth: AuthService
let bf: GrantService
let app: FastifyInstance
let ownerId = ''
let profileId = ''
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
  profileId = (await prisma.trainerProfile.create({
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
  it('⚠️ دوراته الثلاث بسعرها بنسبة الحملة ومجموعها — بلا اسم ولا كود، ورمزه بحروف صغيرة يفتح', async () => {
    const res = await get('/api/public/go/bf80')
    expect(res.statusCode).toBe(200)
    const v = res.json()
    expect(v.courses.map((c: { courseId: string }) => c.courseId)).toEqual(THREE)
    expect(v.publicPath).toEqual({ code: 'BF80', signIn: true, noteAr: null })
    expect([v.firstName, v.nameAr, v.couponCode]).toEqual(['', '', null])
    expect(v.price).toEqual({ currency: 'USD', before: 300, grant: 240, grantNameAr: 'بلاك فرايدي وجيز', grantPct: 80, total: 60 })
    expect(v.priceProblemAr).toBeNull()
    expect(v.lastDay).toBe('2098-12-31')
    /* و«أضف دورة» بحدّ الحملة (أربع) ناقصا الثلاث، ومن قائمة صفحتها */
    expect(v.coursesLeft).toBe(1)
    expect(v.grantCourseIds).toEqual(expect.arrayContaining(THREE))
    expect(await prisma.coupon.count({ where: { grantCode: { campaign: { slug: BLACK_FRIDAY_GRANT_SLUG } } } })).toBe(0)
  })

  it('⚠️ وكل اختيار يسعر بنسبتها — وما فوق حدها يقال سببه', async () => {
    const ids = (await prisma.cohort.findMany({ where: { courseId: { in: THREE }, status: 'open' }, select: { id: true } })).map((c) => c.id)
    const one = (await app.inject({ method: 'POST', url: '/api/public/go/BF80/preview', payload: { cohortIds: ids.slice(0, 1) } })).json()
    expect([one.subtotal, one.total, one.grantPct, one.couponError]).toEqual([100, 20, 80, null])
    expect(one.items).toHaveLength(1)
    /* وحدُّ الحملة دورتان: الثلاثُ فوقه — يقال سببه ويعرض بلا منحة */
    await bf.update({ maxCourses: 2 }, ownerId)
    try {
      const over = (await app.inject({ method: 'POST', url: '/api/public/go/BF80/preview', payload: { cohortIds: ids } })).json()
      expect(over.couponError?.code).toBe('grant_max_courses')
      expect(over.total).toBe(over.subtotal - over.bundleDiscount - over.capDiscount)
    } finally {
      await bfOpen()
    }
    expect((await app.inject({ method: 'POST', url: '/api/public/go/XX99/preview', payload: { cohortIds: ids } })).statusCode).toBe(404)
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

describe('⑤ من اشترى بمنحة غيرها يأخذ كودها على كل حال', () => {
  /* متعلّمٌ اشترى بكود «منحة مؤثرين وجيز» — ومعه نموذجٌ في بلاك فرايدي من صفحتها (لا من المسار) */
  async function usedInfluencer() {
    const inf = new GrantService(prisma, INFLUENCER_GRANT_SLUG)
    await inf.update({ active: true, percentOff: 45, maxCourses: 4, maxCodes: null, closesAt: new Date(grantClosesAt('2098-12-31')) }, ownerId)
    const l = await learner()
    const lead = await prisma.lead.create({ data: { fullName: 'ليلى', email: l.email, phone: '+962790000002', campaign: INFLUENCER_GRANT_SLUG, source: 'campaign' } })
    const { code } = await inf.issue({ leadId: lead.id })
    const cohorts = await prisma.cohort.findMany({ where: { courseId: { in: THREE }, status: 'open' }, select: { id: true, courseId: true } })
    const byCourse = (id: string) => cohorts.find((c) => c.courseId === id)!.id
    const commerce = new CommerceService(prisma)
    const out = await commerce.checkout(l.userId, [byCourse(THREE[0])], code)
    await commerce.payOrder(out.orderId, l.userId, `pub-${out.orderId}`)
    return { l, code, byCourse, commerce }
  }

  it('⚠️ يعطى كود بلاك فرايدي 80% من المسار — وتسعره المعاينة ويقبله الطلب', async () => {
    const { l, code, byCourse, commerce } = await usedInfluencer()
    const v = (await get('/api/learner/go/BF80', l.cookie)).json()
    expect(v.couponCode).toMatch(/^WG-/)
    expect(v.couponCode).not.toBe(code)
    expect(v.publicPath.noteAr).toBeNull()
    const coupon = await prisma.coupon.findUniqueOrThrow({
      where: { code: v.couponCode }, select: { percentOff: true, grantCode: { select: { campaign: { select: { slug: true } }, lead: { select: { channel: true } } } } },
    })
    expect(coupon).toEqual({ percentOff: 80, grantCode: { campaign: { slug: BLACK_FRIDAY_GRANT_SLUG }, lead: { channel: 'go' } } })
    /* والمعاينةُ بحسابه — لا ترده «منحة واحدة لكل متعلم» */
    const rest = [byCourse(THREE[1]), byCourse(THREE[2])]
    const p = await commerce.preview(l.userId, rest, v.couponCode)
    expect(p.couponError).toBeNull()
    expect([p.subtotal, p.total, p.grantPct]).toEqual([200, 40, 80])
    /* والطلبُ يقبله بالسعر نفسِه */
    const out = await commerce.checkout(l.userId, rest, v.couponCode)
    const order = await prisma.order.findUniqueOrThrow({ where: { id: out.orderId }, select: { total: true, coupon: { select: { code: true } } } })
    expect([Number(order.total), order.coupon?.code]).toEqual([40, v.couponCode])
    /* ونقرةٌ ثانيةٌ بعد الطلب: كودُه نفسُه بما بقي عليه */
    expect((await get('/api/learner/go/BF80', l.cookie)).json().couponCode).toBe(v.couponCode)
  })

  it('⚠️ ونموذجه في بلاك فرايدي من صفحتها لا يعطى — كوده يرده الدفع', async () => {
    const { l } = await usedInfluencer()
    const form = await prisma.lead.create({ data: { fullName: 'ليلى', email: l.email, phone: '+962790000003', campaign: BLACK_FRIDAY_GRANT_SLUG, source: 'campaign' } })
    const { code: formCode } = await bf.issue({ leadId: form.id })
    const v = (await get('/api/learner/go/BF80', l.cookie)).json()
    expect(v.couponCode).toMatch(/^WG-/)
    expect(v.couponCode).not.toBe(formCode)
    expect(v.priceProblemAr).toBeNull()
    expect(v.price.grantPct).toBe(80)
  })

  it('⚠️ و«منحة واحدة لكل متعلم» باقية فيما سواه: كود منحة أخرى بعد شرائه يرد', async () => {
    const { l, byCourse, commerce } = await usedInfluencer()
    const member = new GrantService(prisma, OPEN_GRANT_SLUG)
    await member.update({ active: true, percentOff: 50, maxCourses: 4, maxCodes: null, closesAt: new Date(grantClosesAt('2098-12-31')) }, ownerId)
    const lead = await prisma.lead.create({ data: { fullName: 'ليلى', email: l.email, phone: '+962790000004', campaign: OPEN_GRANT_SLUG, source: 'campaign' } })
    const { code } = await member.issue({ leadId: lead.id })
    const p = await commerce.preview(l.userId, [byCourse(THREE[1])], code)
    expect(p.couponError?.code).toBe('grant_once')
    await expect(commerce.checkout(l.userId, [byCourse(THREE[1])], code)).rejects.toMatchObject({ code: 'grant_once' })
    /* ومن اشترى بكود المسار وحدَه: كودُ منحةٍ أخرى بعده يُردّ — الاستثناءُ لكود المسار لا عليه */
    const solo = await learner()
    const go = (await get('/api/learner/go/BF80', solo.cookie)).json().couponCode as string
    const bought = await commerce.checkout(solo.userId, [byCourse(THREE[0])], go)
    await commerce.payOrder(bought.orderId, solo.userId, `pub-solo-${bought.orderId}`)
    const soloLead = await prisma.lead.create({ data: { fullName: 'ليلى', email: solo.email, phone: '+962790000005', campaign: OPEN_GRANT_SLUG, source: 'campaign' } })
    const other = (await member.issue({ leadId: soloLead.id })).code
    expect((await commerce.preview(solo.userId, [byCourse(THREE[1])], other)).couponError?.code).toBe('grant_once')
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

describe('⑥ «أضف دورة» من دورات بلاك فرايدي وحدها', () => {
  const bfList = async () => [...new Set((await pageCourses(prisma, BLACK_FRIDAY_GRANT_SLUG, null)).courses.map((c) => c.courseId))]

  it('⚠️ قائمة صفحة الحملة نفسها — وكود لأربع ناقصا الثلاث: 1', async () => {
    const l = await learner()
    const v = (await get('/api/learner/go/BF80', l.cookie)).json()
    expect(v.couponCode).toMatch(/^WG-/)
    const list = await bfList()
    expect(list.length).toBeGreaterThan(0)
    expect(v.grantCourseIds).toEqual(list)
    expect(v.coursesLeft).toBe(1)
  })

  it('⚠️ ومن اشترى بكوده دورتين قبل: −1 — لا حد عند الصفر، فإن أزال واحدة من الثلاث أضاف واحدة', async () => {
    const l = await learner()
    const first = (await get('/api/learner/go/BF80', l.cookie)).json()
    /* دورتان من خارج المسار بكوده — بشعبتين مفتوحتين لهما */
    const outside = await prisma.course.findMany({ where: { id: { notIn: THREE } }, select: { id: true }, orderBy: { id: 'asc' }, take: 2 })
    expect(outside).toHaveLength(2)
    const extra: string[] = []
    for (const { id: courseId } of outside) {
      const c = await prisma.cohort.create({
        data: {
          plans: { create: approvedPlanBy(profileId) }, courseId, title: `شعبة خارج المسار ${courseId}`,
          status: 'open', registrationOpen: true, financialReady: true, price: 100, currency: 'USD', capacity: 20,
          startsAt: new Date(Date.now() + 30 * 86_400_000),
        } as never,
      })
      await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: ownerId } })
      extra.push(c.id)
    }
    const commerce = new CommerceService(prisma)
    const out = await commerce.checkout(l.userId, extra, first.couponCode)
    await commerce.payOrder(out.orderId, l.userId, `pub-left-${out.orderId}`)
    const v = (await get('/api/learner/go/BF80', l.cookie)).json()
    expect(v.couponCode).toBe(first.couponCode)
    expect(v.coursesLeft).toBe(-1)
    expect(v.grantCourseIds).toEqual(await bfList())
  })

  it('⚠️ وبلا كود (الحملة مغلقة) لا إضافة', async () => {
    await bfOpen(false)
    try {
      const l = await learner()
      const v = (await get('/api/learner/go/BF80', l.cookie)).json()
      expect([v.coursesLeft, v.grantCourseIds]).toEqual([null, null])
    } finally {
      await bfOpen()
    }
  })
})
