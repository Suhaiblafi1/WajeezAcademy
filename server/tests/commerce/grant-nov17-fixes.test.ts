/* إصلاحاتُ ١٧ نوفمبر ٢٠٢٦ في المنح والمؤثّرين — قرارُ صاحب المنصّة (١٧ نوفمبر ٢٠٢٦): Fix all 6، و«Keep their picks».

   ① **رابطُ المؤثّر في بلاك فرايدي من حسابه يحمل كودَه قناةً، ونسبتُها نسبةُ الحملة** — كان `/grant/bf/<كوده>` والموقعُ يُسقط
      الكودَ في تحويله، فلا يُنسب إليه من جاء به. وكان يُقال لمتابعه خصمُ المؤثّر، وأكوادُ بلاك فرايدي تُعطى بنسبة الحملة.
   ② **آخرُ يومِ المؤثّر في منحة المؤثّرين وحدَها** — كان الدفعُ يقرؤه على كود بلاك فرايدي جاء برابطه، فيُردّ «انتهت المنحة»
      وهي مفتوحة. وكودُ منحة المؤثّرين يُغلق بيومه كما كان (`withInfluencerEnd`).
   ③ **`myCode` لا يعطي كودَ حملةٍ مغلقة** — كان يقرأ تشغيلَها ونهايتَها ولا يسأل عنهما (`grantCouponOpen`).
   ④ **تذكيرُ متابع المؤثّر بيوم مؤثّره** — كانت الرسائلُ تقرأ نهايةَ الحملة وحدَها (`deadlineGroups`).
   ⑤ **ما اختاره صاحبُ الكود يبقى له إن أخرجه المديرُ من القائمة** («Keep their picks»): حفظُه التالي لا يمحوه، وصفحتُه
      تعرضه، وبريدُ تذكيره يذكره — والاختيارُ الجديدُ من القائمة وحدَها (`withKeptPicks`). */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { GrantLandingService } from '../../services/grant-landing.service'
import { InfluencerService } from '../../services/influencer.service'
import { sendGrantReminders } from '../../services/grant-followup.service'
import { publicSiteUrl } from '../../services/site-url'
import { approvedPlanBy } from '../helpers/approved-trainer'
import { BLACK_FRIDAY_GRANT_SLUG, INFLUENCER_GRANT_SLUG } from '../../../src/application/commerce/grant'
import { fmtDateLong } from '../../../src/application/text/format-ar'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let influencers: InfluencerService
let inf: GrantService
let bf: GrantService
let ownerId = ''
let profileId = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()
const HOUR = 3_600_000
const DAY = 24 * HOUR

/** دورةٌ منشورةٌ بشعبةٍ تُشترى ومدرّبٍ منشور — فتظهر في صفحة المنحة */
async function openCohort(price = 100) {
  const courseId = pool.shift()
  if (!courseId) throw new Error('نفدت الدوراتُ المنشورة')
  const c = await prisma.cohort.create({
    data: {
      plans: { create: approvedPlanBy(profileId) },
      courseId, title: `شعبة إصلاحات ${++seq}`, status: 'open', registrationOpen: true, financialReady: true,
      price, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() + 30 * DAY),
    } as never,
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: ownerId } })
  return { cohortId: c.id, courseId }
}
const person = (over: Record<string, unknown> = {}) => ({
  fullName: `متابع ${++seq}`, phone: `+962795${String(600000 + seq)}`, email: `n17-${seq}-${STAMP}@test.local`,
  workField: 'الموارد البشرية', ...over,
})
async function addInfluencer(code: string) {
  return (await influencers.create({ nameAr: `مؤثر ${code}`, code, commissionPercent: 15, email: `${code.toLowerCase()}-n17-${STAMP}@test.local` }, ownerId)).id
}

let had: { enabled: boolean; config: unknown } | null = null

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  influencers = new InfluencerService(prisma)
  inf = new GrantService(prisma, INFLUENCER_GRANT_SLUG)
  bf = new GrantService(prisma, BLACK_FRIDAY_GRANT_SLUG)
  ownerId = (await auth.register(`n17-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  const user = await prisma.user.create({ data: { email: `n17-tr-${STAMP}@wajeez.test`, displayName: 'مدرب الإصلاحات', passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-N17-${STAMP}`, fullName: 'مدرب الإصلاحات', email: user.email, status: 'active' },
  })
  profileId = (await prisma.trainerProfile.create({
    data: { userId: user.id, applicationId: application.id, publicVisibility: true, isVerified: true, publishApprovedAt: new Date() },
  })).id
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'asc' } })).map((c) => c.id)
  await inf.update({ active: true, maxCodes: null, closesAt: null }, ownerId)
  await bf.update({ active: true, maxCodes: null, closesAt: null }, ownerId)
  had = await prisma.integrationSetting.findUnique({ where: { provider: 'email' }, select: { enabled: true, config: true } })
  const config = { apiKey: 'test-key', fromEmail: 'no-reply@test.local' }
  await prisma.integrationSetting.upsert({ where: { provider: 'email' }, update: { enabled: true, config }, create: { provider: 'email', enabled: true, config } })
}, 240_000)

afterAll(async () => {
  if (had) await prisma.integrationSetting.update({ where: { provider: 'email' }, data: { enabled: had.enabled, config: had.config as never } })
  else await prisma.integrationSetting.delete({ where: { provider: 'email' } })
  await inf.update({ closesAt: null }, ownerId)
  await bf.update({ closesAt: null }, ownerId)
})

describe('① رابط المؤثر في بلاك فرايدي من حسابه', () => {
  it('⚠️ يحمل كوده قناة — ونسبته نسبة الحملة لا خصم المؤثر', async () => {
    const id = await addInfluencer('LINKBF')
    await influencers.update(id, { percentOff: 30 }, ownerId)
    const userId = (await prisma.influencer.findUniqueOrThrow({ where: { id } })).userId!
    const me = await influencers.portal(userId)
    expect(me.blackFriday.link, 'رابط يسقط فيه الكود').toBe(`${publicSiteUrl()}/grant/bf?ch=linkbf`)
    expect(me.blackFriday.percentOff, 'قيل لمتابعه خصم لا يأخذه').toBe((await bf.settings()).percentOff)
    /* والرابطُ ينسب إليه من جاء به */
    const out = await new GrantLandingService(prisma, BLACK_FRIDAY_GRANT_SLUG).apply(person({ channel: new URL(me.blackFriday.link).searchParams.get('ch') }))
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: out.ref } })).influencerId).toBe(id)
  })
})

describe('② آخر يوم المؤثر في منحة المؤثرين وحدها', () => {
  it('⚠️ كود بلاك فرايدي برابط مؤثر مضى يومه يستعمل — وكود منحة المؤثرين يغلق بيومه', async () => {
    const id = await addInfluencer('ENDBF')
    await influencers.update(id, { closesAt: new Date(Date.now() + 7 * DAY) }, ownerId)
    const own = await new GrantLandingService(prisma, INFLUENCER_GRANT_SLUG).apply(person({ influencerCode: 'ENDBF' }))
    await influencers.update(id, { closesAt: new Date(Date.now() - DAY) }, ownerId)
    const viaLink = await new GrantLandingService(prisma, BLACK_FRIDAY_GRANT_SLUG).apply(person({ channel: 'endbf' }))
    expect(await prisma.grantCode.findUniqueOrThrow({ where: { leadId: viaLink.ref } })).toMatchObject({ influencerId: id })
    const buyer = (await auth.register(`n17-buyer-${++seq}-${STAMP}@test.local`, 'Learner#12345', 'مشتري')).userId
    const x = await openCohort(100)
    const q = await commerce.quote(buyer, [x.cohortId], viaLink.grant!.code!)
    expect(q.couponDiscount, 'رد كود بلاك فرايدي بيوم المؤثر').toBeGreaterThan(0)
    await expect(commerce.quote(buyer, [x.cohortId], own.grant!.code!)).rejects.toMatchObject({ code: 'grant_closed' })
  })
})

describe('③ myCode لا يعطي كود حملة مغلقة', () => {
  it('⚠️ يعطيه وحملته مفتوحة — ولا يعطيه بعد يوم مؤثره ولا والحملة موقوفة', async () => {
    const id = await addInfluencer('MYCODE')
    await influencers.update(id, { closesAt: new Date(Date.now() + 7 * DAY) }, ownerId)
    const p = person({ influencerCode: 'MYCODE' })
    const landing = new GrantLandingService(prisma, INFLUENCER_GRANT_SLUG)
    const out = await landing.apply(p)
    const userId = (await auth.register(p.email, 'Learner#12345', 'متابع')).userId
    expect((await landing.myCode(userId)).code).toBe(out.grant!.code)
    await influencers.update(id, { closesAt: new Date(Date.now() - DAY) }, ownerId)
    expect(await landing.myCode(userId), 'أعطي كودا مضى يوم مؤثره').toEqual({ code: null })
    await influencers.update(id, { closesAt: null }, ownerId)
    await inf.update({ active: false }, ownerId)
    try {
      expect(await landing.myCode(userId), 'أعطي كود حملة موقوفة').toEqual({ code: null })
    } finally {
      await inf.update({ active: true }, ownerId)
    }
    expect((await landing.myCode(userId)).code).toBe(out.grant!.code)
  })
})

describe('④ تذكير متابع المؤثر بيوم مؤثره', () => {
  it('⚠️ يذكر قبل يوم مؤثره وبه — لا بنهاية الحملة', async () => {
    const EARLY = new Date('2031-03-01T21:00:00.000Z')
    const FAR = new Date('2031-06-01T21:00:00.000Z')
    const id = await addInfluencer('OWNDAY')
    await influencers.update(id, { closesAt: EARLY }, ownerId)
    await addInfluencer('NODAY')
    const landing = new GrantLandingService(prisma, INFLUENCER_GRANT_SLUG)
    const mine = person({ influencerCode: 'OWNDAY' })
    const other = person({ influencerCode: 'NODAY' })
    await landing.apply(mine)
    await landing.apply(other)
    await inf.update({ closesAt: FAR }, ownerId)
    try {
      await sendGrantReminders(prisma, new Date(EARLY.getTime() - 62 * HOUR), INFLUENCER_GRANT_SLUG)
      const got = await prisma.outboxMail.findMany({ where: { to: mine.email, purpose: 'grant.reminder' } })
      expect(got, 'لم يذكر قبل يوم مؤثره').toHaveLength(1)
      expect(got[0].text, 'قيل له غير يومه').toContain(fmtDateLong(new Date(EARLY.getTime() - 1)))
      expect(await prisma.outboxMail.count({ where: { to: other.email, purpose: 'grant.reminder' } }), 'ذكر من لا يوم لمؤثره بيوم غيره').toBe(0)
      /* وبنهاية الحملة يُذكَّر من لا يومَ لمؤثّره، ولا يُذكَّر متابعُه ثانيةً بنهايةٍ ليست يومه */
      await sendGrantReminders(prisma, new Date(FAR.getTime() - 62 * HOUR), INFLUENCER_GRANT_SLUG)
      expect(await prisma.outboxMail.count({ where: { to: other.email, purpose: 'grant.reminder' } })).toBe(1)
      expect(await prisma.outboxMail.count({ where: { to: mine.email, purpose: 'grant.reminder' } })).toBe(1)
    } finally {
      await inf.update({ closesAt: null }, ownerId)
      await influencers.update(id, { closesAt: null }, ownerId)
    }
  })
})

describe('⑤ ما اختاره يبقى له إن خرج من القائمة — «Keep their picks»', () => {
  it('⚠️ حفظه التالي لا يمحوه وصفحته تعرضه وبريده يذكره — والجديد من القائمة وحدها', async () => {
    const [c, d, e] = [await openCohort(100), await openCohort(100), await openCohort(100)]
    const landing = new GrantLandingService(prisma, BLACK_FRIDAY_GRANT_SLUG)
    await prisma.grantCampaign.update({ where: { slug: BLACK_FRIDAY_GRANT_SLUG }, data: { courseIds: [c.courseId, d.courseId] } })
    try {
      const out = await landing.apply(person())
      expect((await landing.savePicks(out.ref, [c.courseId])).picks).toEqual([c.courseId])
      /* المديرُ يُخرج C من القائمة */
      await prisma.grantCampaign.update({ where: { slug: BLACK_FRIDAY_GRANT_SLUG }, data: { courseIds: [d.courseId] } })
      expect((await landing.savePicks(out.ref, [c.courseId, d.courseId])).picks, 'محي ما اختاره').toEqual([c.courseId, d.courseId])
      /* والجديدُ من خارج القائمة يُردّ كما كان */
      expect((await landing.savePicks(out.ref, [c.courseId, d.courseId, e.courseId])).picks).toEqual([c.courseId, d.courseId])
      const shown = (await landing.view(new Date(), null, out.ref)).openCourses.map((x) => x.courseId)
      expect(shown, 'صفحته لا تعرض ما اختاره').toContain(c.courseId)
      expect((await landing.view()).openCourses.map((x) => x.courseId), 'عرض لغيره ما خرج من القائمة').not.toContain(c.courseId)
      /* وإن تركه هو سقط */
      expect((await landing.savePicks(out.ref, [d.courseId])).picks).toEqual([d.courseId])

      /* وبريدُ تذكيره يذكره */
      await prisma.lead.update({ where: { id: out.ref }, data: { grantPicks: [c.courseId, d.courseId], createdAt: new Date(Date.now() - 7 * DAY) } })
      await bf.update({ closesAt: new Date(Date.now() + 48 * HOUR) }, ownerId)
      await sendGrantReminders(prisma, new Date(), BLACK_FRIDAY_GRANT_SLUG)
      const told = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'coupon.grant_reminder', entityId: out.ref } })
      expect((told.meta as { picks?: number }).picks, 'بريده لا يذكر ما اختاره').toBe(2)
    } finally {
      await prisma.grantCampaign.update({ where: { slug: BLACK_FRIDAY_GRANT_SLUG }, data: { courseIds: [] } })
      await bf.update({ closesAt: null }, ownerId)
    }
  })
})
