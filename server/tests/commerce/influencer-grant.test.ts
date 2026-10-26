/* «منحة مؤثرين وجيز» على الخادم (٢٦ أكتوبر ٢٠٢٦) — والعلّةُ في رأس `influencer.service.ts`.

   ① **حملةٌ ثانيةٌ بصفّها** — تبدأ موقوفةً بخمسةٍ وأربعين، ولا تمسّ الأولى.
   ② **كودُ المؤثّر لازم** — بلا كودٍ أو بكود موقوفٍ يُردّ ولا يُحفظ أحد.
   ③ **والكودُ يحمل مؤثّرَه وعمولتَه يومَ أُعطي** — والأوّلُ يبقى لمن عبّأ بكودين.
   ④ **والعمولةُ ١٥٪ من سعر الدورات قبل المنحة** — ولو أهدى صاحبُ الكود كودَه لغيره.
   ⑤ **وما رُدّ ينقصها بنسبته**، والمردودُ كلُّه لا عمولةَ له.
   ⑥ **وتغييرُ العمولة على ما بعده.**
   ⑦ **ومنحةٌ واحدةٌ لكلّ متعلّم على الحملتين معا.**
   ⑧ **والرصيدُ ما استحقّه ناقصا ما دُفع له** — ويراه المؤثّرُ في حسابه وحدَه.
   ⑨ **وحسابُه بدعوة** — بريدٌ جديدٌ يُنشأ له حسابٌ بدوره، وقائمٌ يُربط ويُضاف له الدور.
   ⑩ **وفحصُ الهامش يطرح عمولتَه.**
   ⑪ **والمتابعةُ والتذكيرُ كالأولى** — حالةٌ عند مستشارٍ تقول كودَ المؤثّر، وتذكيرٌ بنهايتها هي يعيد إلى رابط مؤثّره. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { GrantLandingService } from '../../services/grant-landing.service'
import { InfluencerService } from '../../services/influencer.service'
import { openGrantFollowups, sendGrantReminders } from '../../services/grant-followup.service'
import { approvedTrainerPlan } from '../helpers/approved-trainer'
import { INFLUENCER_GRANT_SLUG } from '../../../src/application/commerce/grant'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let members: GrantService
let grant: GrantService
let landing: GrantLandingService
let influencers: InfluencerService
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
      courseId: nextCourse(), title: `شعبة منحة المؤثرين ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() + 30 * 86_400_000),
    } as never,
  })).id
}
async function learner(name = `متابعة ${seq} مؤثر`) {
  seq += 1
  return (await auth.register(`inf-${seq}-${STAMP}@test.local`, 'Learner#12345', name)).userId
}
const person = (over: Record<string, unknown> = {}) => ({
  fullName: `متابع ${++seq}`, phone: `0792${String(600000 + seq)}`, email: `follower-${seq}-${STAMP}@test.local`,
  workField: 'الموارد البشرية', ...over,
})
async function pay(userId: string, cohortIds: string[], code: string) {
  const out = await commerce.checkout(userId, cohortIds, code)
  await commerce.payOrder(out.orderId, userId, `inf-${out.orderId}`)
  return out.orderId
}
async function addInfluencer(code: string, commissionPercent = 15) {
  return (await influencers.create({ nameAr: `مؤثر ${code}`, code, commissionPercent }, ownerId)).id
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  members = new GrantService(prisma)
  grant = new GrantService(prisma, INFLUENCER_GRANT_SLUG)
  landing = new GrantLandingService(prisma, INFLUENCER_GRANT_SLUG)
  influencers = new InfluencerService(prisma)
  ownerId = (await auth.register(`inf-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'asc' } }))
    .map((c) => c.id)
}, 240_000)

describe('① حملة ثانية بصفها', () => {
  it('⚠️ تبدأ موقوفة بخمسة وأربعين — ولا تمس الأولى', async () => {
    const s = await grant.settings()
    expect(s).toMatchObject({ nameAr: 'منحة مؤثرين وجيز', percentOff: 45, maxCodes: 1000, maxCourses: 4, active: false })
    const m = await members.settings()
    expect(m.id).not.toBe(s.id)
    expect(m.nameAr).toBe('منحة وجيز')
    await grant.update({ active: true }, ownerId)
    expect((await members.settings()).active, 'تشغيل منحة المؤثرين شغل الأولى').toBe(false)
  })
})

describe('② كود المؤثر لازم', () => {
  it('⚠️ بلا كود أو بكود لا يطابق أو موقوف — يرد ولا يحفظ أحد', async () => {
    const id = await addInfluencer('STOPPED')
    await influencers.update(id, { active: false }, ownerId)
    for (const influencerCode of [undefined, 'NOPE123', 'stopped']) {
      const p = person({ influencerCode })
      await expect(landing.apply(p)).rejects.toMatchObject({ code: 'bad_influencer_code' })
      expect(await prisma.lead.count({ where: { email: p.email } }), 'حفظ من جاء بلا كود صحيح').toBe(0)
    }
    await expect(influencers.create({ nameAr: 'آخر', code: 'stopped', commissionPercent: 15 }, ownerId))
      .rejects.toMatchObject({ code: 'code_taken' })
    await expect(influencers.create({ nameAr: 'آخر', code: 'a b', commissionPercent: 15 }, ownerId))
      .rejects.toMatchObject({ code: 'bad_code' })
  })
})

describe('③ والكود يحمل مؤثره وعمولته — والأول يبقى', () => {
  it('⚠️ العميل بمؤثره وقناته، وكوده بعمولته — ومن عبأ بكود غيره ثانية يبقى للأول', async () => {
    const sara = await addInfluencer('SARA')
    await addInfluencer('OMAR')
    const p = person({ influencerCode: ' sara ' })
    const out = await landing.apply(p)
    expect(out.grant?.code).toMatch(/^WG-/)
    expect(out.grant?.percentOff).toBe(45)
    expect(out).toMatchObject({ influencer: { nameAr: 'مؤثر SARA', code: 'SARA' } })
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: out.ref } })
    expect(lead).toMatchObject({ campaign: INFLUENCER_GRANT_SLUG, influencerId: sara, channel: 'sara' })
    const code = await prisma.grantCode.findFirstOrThrow({ where: { leadId: lead.id } })
    expect(code).toMatchObject({ influencerId: sara, commissionPercent: 15 })
    const mail = await prisma.outboxMail.findFirst({ where: { to: p.email, purpose: 'grant.code' }, orderBy: { createdAt: 'desc' } })
    expect(mail?.text, 'بريد الكود لا يعيده إلى صفحة مؤثره').toContain('/grant/i/SARA')

    const again = await landing.apply({ ...p, influencerCode: 'OMAR' })
    expect(again.ref).toBe(out.ref)
    expect(again.influencer?.code, 'حسب لمؤثر ثان من جاء به الأول').toBe('SARA')
    expect(await prisma.grantCode.count({ where: { leadId: lead.id } })).toBe(1)
  })
})

describe('④ العمولة من سعر الدورات قبل المنحة', () => {
  it('⚠️ ١٥٪ من ٢٠٠ = ٣٠ — والمشتري يدفع ١١٠، ولو أهدي الكود لغير صاحبه', async () => {
    const id = await addInfluencer('LINA')
    const out = await landing.apply(person({ influencerCode: 'LINA' }))
    /* أهداه صاحبُه لصديق — والعمولةُ لمن جاء بالكود أصلا */
    const friend = await learner('ريم أحمد العلي')
    const orderId = await pay(friend, [await openCohort(100), await openCohort(100)], out.grant!.code!)
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    expect(Number(order.subtotal)).toBe(200)
    expect(Number(order.total)).toBe(110)
    const st = await influencers.statement(id)
    expect(st.totals).toMatchObject({ signups: 1, codes: 1, buyers: 1, sales: 200, earned: 30, paid: 0, balance: 30 })
    expect(st.rows[0]).toMatchObject({ buyerAr: 'ريم ا.', courses: 2, listTotal: 200, percent: 15, commission: 30, stateAr: 'مستحقة' })
  })
})

describe('⑤ وما رد ينقصها بنسبته', () => {
  it('⚠️ رد نصف الثمن ينصف العمولة، ورده كله يسقطها', async () => {
    const id = await addInfluencer('HADI')
    const out = await landing.apply(person({ influencerCode: 'HADI' }))
    const buyer = await learner()
    const orderId = await pay(buyer, [await openCohort(100)], out.grant!.code!)
    const payment = await prisma.payment.findFirstOrThrow({ where: { invoice: { orderId } } })
    expect(Number(payment.amount)).toBe(55)
    const half = await commerce.requestRefund(payment.id, ownerId, { amount: 27.5, reason: 'انسحاب جزئي موثق' })
    await commerce.processRefund(half.id, ownerId, true)
    let st = await influencers.statement(id)
    expect(st.rows[0]).toMatchObject({ commission: 7.5, stateAr: 'رد جزء منه' })
    const rest = await commerce.requestRefund(payment.id, ownerId, { amount: 27.5, reason: 'استكمال الاسترداد' })
    await commerce.processRefund(rest.id, ownerId, true)
    st = await influencers.statement(id)
    expect(st.rows[0]).toMatchObject({ commission: 0, stateAr: 'رد المبلغ' })
    expect(st.totals).toMatchObject({ buyers: 0, earned: 0 })
  })
})

describe('⑥ وتغيير العمولة على ما بعده', () => {
  it('⚠️ عشرون على الكود الجديد، والقديم بخمسة عشر', async () => {
    const id = await addInfluencer('NOOR')
    const before = await landing.apply(person({ influencerCode: 'NOOR' }))
    await influencers.update(id, { commissionPercent: 20 }, ownerId)
    const after = await landing.apply(person({ influencerCode: 'NOOR' }))
    const pct = async (code: string) => (await prisma.grantCode.findFirstOrThrow({ where: { coupon: { code } } })).commissionPercent
    expect(await pct(before.grant!.code!)).toBe(15)
    expect(await pct(after.grant!.code!)).toBe(20)
    expect(await prisma.auditEvent.count({ where: { action: 'influencer.update', entityId: id } })).toBe(1)
  })
})

describe('⑦ منحة واحدة لكل متعلم على الحملتين', () => {
  it('⚠️ من اشترى بمنحة وجيز لا يشتري بمنحة المؤثرين', async () => {
    await members.update({ active: true, maxCodes: null, closesAt: null }, ownerId)
    const buyer = await learner()
    const lead = (await prisma.lead.create({ data: { fullName: 'عضو', phone: `0793${String(700000 + ++seq)}` } })).id
    const memberCode = (await members.issue({ leadId: lead })).code
    await pay(buyer, [await openCohort(100)], memberCode)
    await addInfluencer('ONCE')
    const out = await landing.apply(person({ influencerCode: 'ONCE' }))
    await expect(commerce.checkout(buyer, [await openCohort(100)], out.grant!.code!)).rejects.toMatchObject({ code: 'grant_once' })
  })
})

describe('⑧ الرصيد وحساب المؤثر', () => {
  it('⚠️ دفعة تنقص الرصيد — ويراه في حسابه، ومن لا ملف له لا يرى شيئا', async () => {
    const id = await addInfluencer('PAYME')
    const out = await landing.apply(person({ influencerCode: 'PAYME' }))
    await pay(await learner(), [await openCohort(100)], out.grant!.code!)
    await expect(influencers.recordPayout(id, { amount: 0 }, ownerId)).rejects.toMatchObject({ code: 'bad_amount' })
    const st = await influencers.recordPayout(id, { amount: 10, noteAr: 'تحويل بنكي' }, ownerId)
    expect(st.totals).toMatchObject({ earned: 15, paid: 10, balance: 5 })

    const acc = await influencers.attachAccount(id, `payme-${STAMP}@test.local`, ownerId)
    const me = await influencers.portal(acc.userId)
    expect(me).toMatchObject({ code: 'PAYME', commissionPercent: 15, grant: { percentOff: 45 } })
    expect(me.link).toMatch(/\/grant\/i\/PAYME$/)
    expect(me.totals.balance).toBe(5)
    expect(me.payouts[0]).toMatchObject({ amount: 10, noteAr: 'تحويل بنكي' })
    /* وما يمسّ مالَه يصله بريدا — بعد أن صار له حساب */
    await influencers.recordPayout(id, { amount: 5 }, ownerId)
    await influencers.update(id, { commissionPercent: 18 }, ownerId)
    const mails = await prisma.outboxMail.findMany({ where: { to: `payme-${STAMP}@test.local`, purpose: 'influencer.notice' }, orderBy: { createdAt: 'asc' } })
    expect(mails.map((m) => m.subject)).toEqual(['سجلنا دفعة من عمولتك — أكاديمية وجيز', 'تغيير في كودك أو عمولتك — أكاديمية وجيز'])
    expect(mails[0].text).toContain('رصيدك الآن:')
    expect(mails[1].text).toContain('عمولتك صارت 18%')
    await expect(influencers.portal(await learner())).rejects.toMatchObject({ code: 'not_influencer' })
  })
})

describe('⑨ حسابه بدعوة', () => {
  it('⚠️ بريد جديد: حساب مدعو بدور المؤثر ودعوة — وقائم: يربط ويضاف الدور، ولا يربط بمؤثرين', async () => {
    const a = await addInfluencer('NEWACC')
    const email = `newacc-${STAMP}@test.local`
    const made = await influencers.attachAccount(a, email, ownerId)
    expect(made.created).toBe(true)
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { roles: true } })
    expect(user.status).toBe('invited')
    expect(user.roles.map((r) => r.roleId)).toContain('influencer')
    expect(await prisma.passwordResetToken.count({ where: { userId: user.id, purpose: 'invite', usedAt: null } })).toBe(1)

    const existing = await learner()
    const existingEmail = (await prisma.user.findUniqueOrThrow({ where: { id: existing } })).email
    const b = (await influencers.create({ nameAr: 'مؤثر قائم', code: 'HASACC', commissionPercent: 15, email: existingEmail }, ownerId))
    expect(b.account).toMatchObject({ userId: existing, created: false })
    const roles = (await prisma.userRole.findMany({ where: { userId: existing } })).map((r) => r.roleId)
    expect(roles, 'نزع دوره القديم').toEqual(expect.arrayContaining(['learner', 'influencer']))
    await expect(influencers.attachAccount(a, existingEmail, ownerId)).rejects.toMatchObject({ code: 'account_taken' })
  })
})

describe('⑩ فحص الهامش يطرح عمولته', () => {
  it('⚠️ شعبة بمئة: بعد المنحة ٥٥، وللمؤثر ١٥', async () => {
    const cohortId = await openCohort(100)
    const r = await grant.margins(45, 15)
    const row = r.rows.find((x) => x.cohortId === cohortId)!
    expect(row).toMatchObject({ listPrice: 100, price: 55, commission: 15 })
    if (row.seatCost !== null) expect(row.margin).toBe(Math.round((55 - row.seatCost - 15) * 100) / 100)
    expect((await members.margins(60)).rows.find((x) => x.cohortId === cohortId)!.commission, 'طرح عمولة في منحة وجيز').toBe(0)
  })
})

describe('⑪ المتابعة والتذكير كالأولى', () => {
  it('⚠️ من لم يشتر بعد ساعة: حالة عند مستشار بكود مؤثره', async () => {
    await addInfluencer('FOLLOW')
    const out = await landing.apply(person({ influencerCode: 'FOLLOW' }))
    await prisma.lead.update({ where: { id: out.ref }, data: { createdAt: new Date(Date.now() - 2 * 3_600_000) } })
    await openGrantFollowups(prisma)
    const kase = await prisma.advisorCase.findFirst({ where: { leadId: out.ref } })
    expect(kase, 'لم تفتح له حالة').not.toBeNull()
    expect(kase!.nextAction).toContain('منحة المؤثرين بكود FOLLOW')
  })

  it('⚠️ تذكير بنهايتها هي — ببريد يعيده إلى رابط مؤثره، ولا يذكره تذكير الأولى', async () => {
    const HOUR = 3_600_000
    const T = new Date(Date.now() + 5 * 24 * HOUR)
    const at = (hoursBefore: number) => new Date(T.getTime() - hoursBefore * HOUR)
    const had = await prisma.integrationSetting.findUnique({ where: { provider: 'email' }, select: { enabled: true, config: true } })
    const cfg = { apiKey: 'test-key', fromEmail: 'no-reply@test.local' }
    await prisma.integrationSetting.upsert({ where: { provider: 'email' }, update: { enabled: true, config: cfg }, create: { provider: 'email', enabled: true, config: cfg } })
    try {
      await grant.update({ closesAt: T }, ownerId)
      await addInfluencer('REMIND')
      const p = person({ influencerCode: 'REMIND' })
      const out = await landing.apply(p)
      const mails = () => prisma.outboxMail.findMany({ where: { to: p.email, purpose: 'grant.reminder' } })
      expect((await sendGrantReminders(prisma, at(62.9))).sent, 'ذكره تذكير منحة وجيز').toBe(0)
      expect(await mails()).toHaveLength(0)
      const r = await sendGrantReminders(prisma, at(62.9), INFLUENCER_GRANT_SLUG)
      expect(r.stage).toBe('3d')
      const m = await mails()
      expect(m, 'لم يذكر من لم يشتر').toHaveLength(1)
      expect(m[0].text).toContain(out.grant!.code!)
      expect(m[0].text).toContain('/grant/i/REMIND')
      expect(m[0].text).toContain('45%')
    } finally {
      await grant.update({ closesAt: null }, ownerId)
      if (had) await prisma.integrationSetting.update({ where: { provider: 'email' }, data: { enabled: had.enabled, config: had.config as never } })
      else await prisma.integrationSetting.delete({ where: { provider: 'email' } })
    }
  })
})
