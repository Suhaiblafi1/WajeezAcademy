/* «منحة وجيز العامة» على الخادم (١ نوفمبر ٢٠٢٦) — والعلّةُ في رأس `src/application/commerce/grant.ts`.

   قرارُ صاحب المنصّة: «منحةٌ أخرى عامّةٌ بـ٥٠٪.. مطابقةٌ تماما لمنحة وجيز الأولى ولكن عامّة».

   ① **حملةٌ ثالثةٌ بصفّها** — تبدأ موقوفةً بخمسين، وعددِ الأولى وحدِّ دوراتها، ولا تمسّ الأولى.
   ② **ونموذجُها نموذجُ الأولى** — بلا كود مؤثّر، وكودٌ فوريٌّ بنسبتها، وبريدٌ باسمها يعيده إلى صفحتها لا إلى `/grant`،
      وبلا شكرٍ لقرّاء وجيز: هي للجميع.
   ③ **وهديّتُها إلى صفحتها هي** — رابطٌ قصيرٌ بوسم الهديّة.
   ④ **والشراءُ بنسبتها.**
   ⑤ **ومنحةٌ واحدةٌ لكلّ متعلّم على الحملات كلِّها.**
   ⑥ **ونتائجُها وحدَها، ومن عبّأها في قائمة من عبّأ.**
   ⑦ **والمتابعةُ والتذكيرُ كالأولى** — حالةٌ تقول اسمَها، وتذكيرٌ بنهايتها هي يعيد إلى صفحتها، ولا يذكّره تذكيرُ الأولى. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { GrantLandingService, grantResults } from '../../services/grant-landing.service'
import { grantRegistrants, openGrantFollowups, sendGrantReminders } from '../../services/grant-followup.service'
import { approvedTrainerPlan } from '../helpers/approved-trainer'
import { GRANT_ONCE_AR, OPEN_GRANT_SLUG } from '../../../src/application/commerce/grant'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let members: GrantService
let grant: GrantService
let landing: GrantLandingService
let ownerId = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()

const nextCourse = () => {
  const id = pool.shift()
  if (!id) throw new Error('نفدت الدوراتُ المنشورة')
  return id
}
async function openCohort(price = 100) {
  return (await prisma.cohort.create({
    data: {
      plans: { create: await approvedTrainerPlan(prisma) },
      courseId: nextCourse(), title: `شعبة المنحة العامة ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() + 30 * 86_400_000),
    } as never,
  })).id
}
async function learner() {
  seq += 1
  return (await auth.register(`open-${seq}-${STAMP}@test.local`, 'Learner#12345', `متعلم ${seq}`)).userId
}
const person = (over: Record<string, unknown> = {}) => ({
  fullName: `زائر ${++seq}`, phone: `0794${String(800000 + seq)}`, email: `open-visitor-${seq}-${STAMP}@test.local`,
  workField: 'الموارد البشرية', ...over,
})
async function pay(userId: string, cohortIds: string[], code: string) {
  const out = await commerce.checkout(userId, cohortIds, code)
  await commerce.payOrder(out.orderId, userId, `open-${out.orderId}`)
  return out.orderId
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  members = new GrantService(prisma)
  grant = new GrantService(prisma, OPEN_GRANT_SLUG)
  landing = new GrantLandingService(prisma, OPEN_GRANT_SLUG)
  ownerId = (await auth.register(`open-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  /* من وسط القائمة — فلا تأخذ دوراتِ ملفّي المنحتين الأخريين من طرفيها */
  const all = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'asc' } })).map((c) => c.id)
  pool = all.slice(Math.floor(all.length / 3))
}, 240_000)

describe('① حملة ثالثة بصفها', () => {
  it('⚠️ تبدأ موقوفة بخمسين وعدد الأولى وحد دوراتها — ولا تمس الأولى', async () => {
    const s = await grant.settings()
    expect(s).toMatchObject({ nameAr: 'منحة وجيز العامة', percentOff: 50, maxCodes: 1000, maxCourses: 4, active: false })
    const m = await members.settings()
    expect(m.id).not.toBe(s.id)
    expect(m.nameAr).toBe('منحة وجيز')
    const memberActive = m.active
    await grant.update({ active: true, maxCodes: null, closesAt: null }, ownerId)
    expect((await members.settings()).active, 'تشغيل المنحة العامة غير الأولى').toBe(memberActive)
  })
})

describe('② نموذجها نموذج الأولى', () => {
  it('⚠️ بلا كود مؤثر: كود فوري بنسبتها، وعميل بحملتها، وبريد باسمها يعيده إلى صفحتها', async () => {
    const p = person({ channel: 'opentag' })
    const out = await landing.apply(p)
    expect(out.grant?.code).toMatch(/^WG-/)
    expect(out.grant?.percentOff).toBe(50)
    expect(out).not.toHaveProperty('influencer')
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: out.ref } })
    expect(lead).toMatchObject({ campaign: OPEN_GRANT_SLUG, channel: 'opentag', influencerId: null })
    const mail = await prisma.outboxMail.findFirstOrThrow({ where: { to: p.email, purpose: 'grant.code' }, orderBy: { createdAt: 'desc' } })
    expect(mail.subject).toBe('كود منحة وجيز العامة الخاص بك')
    expect(mail.text).toContain(out.grant!.code!)
    expect(mail.text, 'زره لا يعيده إلى صفحتها').toContain('/grant/open')
    expect(mail.text, 'شكر قارئا ليس من قراء وجيز').not.toContain('قراء وجيز')
  })
})

describe('③ وهديتها إلى صفحتها هي', () => {
  it('⚠️ رابط قصير بوسم الهدية إلى /grant/open — لا إلى صفحة الأولى', async () => {
    const v = await landing.view()
    expect(v.sharePath).toMatch(/^\/s\/[A-Za-z0-9]+$/)
    const row = await prisma.shortLink.findUniqueOrThrow({ where: { code: v.sharePath!.slice('/s/'.length) } })
    expect(row).toMatchObject({ target: '/grant/open?ch=share', purpose: 'grant.share' })
  })
})

describe('④ والشراء بنسبتها', () => {
  it('⚠️ دورة بمئة تدفع بخمسين', async () => {
    const out = await landing.apply(person())
    const buyer = await learner()
    const orderId = await pay(buyer, [await openCohort(100)], out.grant!.code!)
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    expect(Number(order.total)).toBe(50)
  })
})

describe('⑤ منحة واحدة لكل متعلم على الحملات كلها', () => {
  it('⚠️ من اشترى بمنحة وجيز لا يأخذ كود العامة ولا يشتري بها', async () => {
    await members.update({ active: true, maxCodes: null, closesAt: null }, ownerId)
    const buyer = await learner()
    const lead = (await prisma.lead.create({ data: { fullName: 'قارئ', phone: `0795${String(900000 + ++seq)}` } })).id
    await pay(buyer, [await openCohort(100)], (await members.issue({ leadId: lead })).code)

    const code = (await landing.apply(person())).grant!.code!
    await expect(commerce.checkout(buyer, [await openCohort(100)], code)).rejects.toMatchObject({ code: 'grant_once' })

    const email = (await prisma.user.findUniqueOrThrow({ where: { id: buyer }, select: { email: true } })).email
    const again = await landing.apply(person({ email }))
    expect(again.grant, 'أعطي كود المنحة العامة لمن اشترى بالأولى').toBeNull()
    expect(again.reasonAr).toBe(GRANT_ONCE_AR)
  })
})

describe('⑥ نتائجها وحدها، ومن عبأها في القائمة', () => {
  it('⚠️ نتائج العامة بقناتها ولا تظهر في نتائج الأولى — ومن عبأها في قائمة من عبأ بحملتها', async () => {
    const out = await landing.apply(person({ channel: 'onlyopen' }))
    const open = await grantResults(prisma, OPEN_GRANT_SLUG)
    expect(open.rows.find((r) => r.channel === 'onlyopen')?.leads).toBe(1)
    const first = await grantResults(prisma)
    expect(first.rows.find((r) => r.channel === 'onlyopen'), 'اختلطت نتائج العامة بالأولى').toBeUndefined()
    const row = (await grantRegistrants(prisma)).find((r) => r.id === out.ref)
    expect(row, 'لم يظهر في قائمة من عبأ').toBeTruthy()
    expect(row).toMatchObject({ campaign: OPEN_GRANT_SLUG, influencer: false })
  })
})

describe('⑦ المتابعة والتذكير كالأولى', () => {
  it('⚠️ من لم يشتر بعد ساعة: حالة عند مستشار تقول اسمها', async () => {
    const out = await landing.apply(person())
    await prisma.lead.update({ where: { id: out.ref }, data: { createdAt: new Date(Date.now() - 2 * 3_600_000) } })
    await openGrantFollowups(prisma)
    const kase = await prisma.advisorCase.findFirst({ where: { leadId: out.ref } })
    expect(kase, 'لم تفتح له حالة').not.toBeNull()
    expect(kase!.nextAction).toContain('منحة وجيز العامة')
  })

  it('⚠️ تذكير بنهايتها هي — يعيده إلى صفحتها، ولا يذكره تذكير الأولى', async () => {
    const HOUR = 3_600_000
    const T = new Date(Date.now() + 5 * 24 * HOUR)
    const at = (hoursBefore: number) => new Date(T.getTime() - hoursBefore * HOUR)
    const had = await prisma.integrationSetting.findUnique({ where: { provider: 'email' }, select: { enabled: true, config: true } })
    const cfg = { apiKey: 'test-key', fromEmail: 'no-reply@test.local' }
    await prisma.integrationSetting.upsert({ where: { provider: 'email' }, update: { enabled: true, config: cfg }, create: { provider: 'email', enabled: true, config: cfg } })
    const memberClose = (await members.settings()).closesAt
    try {
      await grant.update({ closesAt: T }, ownerId)
      await members.update({ closesAt: null }, ownerId)
      const p = person()
      const out = await landing.apply(p)
      const mails = () => prisma.outboxMail.findMany({ where: { to: p.email, purpose: 'grant.reminder' } })
      await sendGrantReminders(prisma, at(62.9))
      expect(await mails(), 'ذكره تذكير منحة وجيز').toHaveLength(0)
      const r = await sendGrantReminders(prisma, at(62.9), OPEN_GRANT_SLUG)
      expect(r.stage).toBe('3d')
      const m = await mails()
      expect(m, 'لم يذكر من لم يشتر').toHaveLength(1)
      expect(m[0].text).toContain(out.grant!.code!)
      expect(m[0].text).toContain('/grant/open')
      expect(m[0].text).toContain('50%')
    } finally {
      await grant.update({ closesAt: null }, ownerId)
      await members.update({ closesAt: memberClose }, ownerId)
      if (had) await prisma.integrationSetting.update({ where: { provider: 'email' }, data: { enabled: had.enabled, config: had.config as never } })
      else await prisma.integrationSetting.delete({ where: { provider: 'email' } })
    }
  })
})
