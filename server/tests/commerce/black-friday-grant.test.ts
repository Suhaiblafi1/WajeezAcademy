/* «بلاك فرايدي وجيز» وخصمُ كلّ مؤثّرٍ وكودُه الذي يتغيّر (١٥ نوفمبر ٢٠٢٦) — والعلّةُ في رأس `influencer.service.ts`.

   قرارُ صاحب المنصّة: «create link for such grant "black friday" … use my link as مؤثر في الموقع واسمح لي تغيير الكود
   هناك وقيمه الخصم للمؤثر كلا على حدا»، بسبعين وكودِه `Suhaib`. واختار منحةً وحدَها لا منحةَ المؤثّرين نفسَها.

   ① **حملةٌ رابعةٌ بصفّها** — تبدأ موقوفةً بسبعين وألفِ كودٍ وأربعِ دورات، ولا تمسّ منحةَ المؤثّرين.
   ② **وصفحتُها تقول ما يأخذه المتابع** — نسبتَها، أو خصمَ المؤثّر إن كُتب له.
   ③ **ونموذجُها نموذجُ المؤثّرين** — كودُ المؤثّر لازم، وكودُ المنحة بخصمه وعمولتِه، وبريدُه وهديّتُه إلى رابطه فيها،
      والشراءُ بخصمه وعمولتُه في كشفه.
   ④ **وخصمُ المؤثّر في منحة المؤثّرين أيضا** — على ما يُعطى بعد الحفظ، وبأثرٍ يسمّي من غيّره.
   ⑤ **والكودُ يتغيّر ورابطُه القديمُ يعمل** — والقديمُ لا يأخذه مؤثّرٌ غيرُه، ويعود إلى صاحبه إن أراده.
   ⑥ **ومنحةٌ واحدةٌ لكلّ متعلّم على الحملات الأربع.**
   ⑦ **والمتابعةُ والتذكيرُ كمنحة المؤثّرين** — حالةٌ تسمّيها، وتذكيرٌ بنهايتها يعيد إلى رابط مؤثّره فيها.
   ⑧ **ورابطُ صاحب المنصّة مزروعٌ بالترحيل** — SUHAIB بسبعين وبلا عمولة وبلا حساب. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { GrantLandingService } from '../../services/grant-landing.service'
import { InfluencerService } from '../../services/influencer.service'
import { recordGrantVisit } from '../../services/grant-visit.service'
import { openGrantFollowups, sendGrantReminders } from '../../services/grant-followup.service'
import { approvedTrainerPlan } from '../helpers/approved-trainer'
import {
  BLACK_FRIDAY_GRANT_SLUG, GRANT_ONCE_AR, INFLUENCER_GRANT_SLUG, MEMBER_GRANT_SLUG, OPEN_GRANT_SLUG, grantKindOf,
} from '../../../src/application/commerce/grant'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let bf: GrantService
let infGrant: GrantService
let landing: GrantLandingService
let infLanding: GrantLandingService
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
      courseId: nextCourse(), title: `شعبة بلاك فرايدي ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() + 30 * 86_400_000),
    } as never,
  })).id
}
async function learner() {
  seq += 1
  return (await auth.register(`bf-${seq}-${STAMP}@test.local`, 'Learner#12345', `متعلم ${seq}`)).userId
}
const emailOf = async (userId: string) => (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } })).email
const person = (over: Record<string, unknown> = {}) => ({
  fullName: `متابع ${++seq}`, phone: `0796${String(300000 + seq)}`, email: `bf-visitor-${seq}-${STAMP}@test.local`,
  workField: 'الموارد البشرية', ...over,
})
async function pay(userId: string, cohortIds: string[], code: string) {
  const out = await commerce.checkout(userId, cohortIds, code)
  await commerce.payOrder(out.orderId, userId, `bf-${out.orderId}`)
  return out.orderId
}
async function addInfluencer(code: string, percentOff: number | null = null, commissionPercent = 15) {
  return (await influencers.create({ nameAr: `مؤثر ${code}`, code, commissionPercent, percentOff }, ownerId)).id
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  bf = new GrantService(prisma, BLACK_FRIDAY_GRANT_SLUG)
  infGrant = new GrantService(prisma, INFLUENCER_GRANT_SLUG)
  landing = new GrantLandingService(prisma, BLACK_FRIDAY_GRANT_SLUG)
  infLanding = new GrantLandingService(prisma, INFLUENCER_GRANT_SLUG)
  influencers = new InfluencerService(prisma)
  ownerId = (await auth.register(`bf-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  /* من ثلثيها الأخيرين معكوسةً — فلا تأخذ دوراتِ ملفّات المنح الأخرى من طرفيها */
  const all = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'desc' } })).map((c) => c.id)
  pool = all.slice(Math.floor(all.length / 6))
}, 240_000)

describe('① حملة رابعة بصفها', () => {
  it('⚠️ تبدأ موقوفة بسبعين وألف كود وأربع دورات — ولا تمس منحة المؤثرين', async () => {
    const s = await bf.settings()
    expect(s).toMatchObject({ nameAr: 'بلاك فرايدي وجيز', percentOff: 70, maxCodes: 1000, maxCourses: 4, active: false })
    const i = await infGrant.settings()
    expect(i.id).not.toBe(s.id)
    const infActive = i.active
    await bf.update({ active: true, maxCodes: null, closesAt: null }, ownerId)
    expect((await infGrant.settings()).active, 'تشغيل بلاك فرايدي شغل منحة المؤثرين').toBe(infActive)
    expect(grantKindOf(BLACK_FRIDAY_GRANT_SLUG)).toBe('blackfriday')
  })
})

describe('② صفحتها تقول ما يأخذه المتابع', () => {
  it('⚠️ سبعون بلا خصم للمؤثر، وخصمه إن كتب له — ولا مؤثر لكود لا يطابق', async () => {
    await addInfluencer('BFPLAIN')
    await addInfluencer('BFOWN', 80)
    const plain = await landing.influencerView('BFPLAIN')
    expect(plain.influencer).toEqual({ nameAr: 'مؤثر BFPLAIN', code: 'BFPLAIN' })
    expect(plain.campaign.percentOff).toBe(70)
    const own = await landing.influencerView('bfown')
    expect(own.campaign.percentOff, 'الصفحة لا تقول خصم المؤثر').toBe(80)
    const nobody = await landing.influencerView('NOBODYBF')
    expect(nobody.influencer).toBeNull()
    expect(nobody.campaign.percentOff).toBe(70)
  })
})

describe('③ نموذجها نموذج المؤثرين', () => {
  it('⚠️ كود المؤثر لازم — بلا كود يرد ولا يحفظ أحد', async () => {
    const p = person()
    await expect(landing.apply(p)).rejects.toMatchObject({ code: 'bad_influencer_code' })
    expect(await prisma.lead.count({ where: { email: p.email } })).toBe(0)
  })

  it('⚠️ مؤثر خصمه ٧٠ والحملة ٦٠: كود بسبعين وعمولته — وبريده وهديته إلى رابطه فيها، والشراء بخصمه وعمولته في كشفه', async () => {
    await bf.update({ percentOff: 60 }, ownerId)
    try {
      const id = await addInfluencer('BFSEVENTY', 70, 15)
      const p = person({ influencerCode: 'BFSEVENTY' })
      const out = await landing.apply(p)
      expect(out.grant?.percentOff, 'أخذ نسبة الحملة لا خصم مؤثره').toBe(70)
      expect(out.campaign.percentOff, 'الصفحة بعد النموذج لا تقول خصم مؤثره').toBe(70)
      expect(out).toMatchObject({ influencer: { code: 'BFSEVENTY' } })
      const lead = await prisma.lead.findUniqueOrThrow({ where: { id: out.ref } })
      expect(lead).toMatchObject({ campaign: BLACK_FRIDAY_GRANT_SLUG, influencerId: id, channel: 'bfseventy' })
      const gc = await prisma.grantCode.findFirstOrThrow({ where: { leadId: lead.id }, include: { coupon: true } })
      expect(gc).toMatchObject({ influencerId: id, commissionPercent: 15 })
      expect(gc.coupon.percentOff).toBe(70)
      const mail = await prisma.outboxMail.findFirstOrThrow({ where: { to: p.email, purpose: 'grant.code' }, orderBy: { createdAt: 'desc' } })
      expect(mail.subject).toBe('كود بلاك فرايدي وجيز الخاص بك')
      expect(mail.text, 'بريد الكود لا يعيده إلى رابط مؤثره فيها').toContain('/grant/bf/BFSEVENTY')
      const view = await landing.influencerView('BFSEVENTY')
      expect((await prisma.shortLink.findUniqueOrThrow({ where: { code: view.sharePath!.slice('/s/'.length) } })).target).toBe('/grant/bf/BFSEVENTY')

      const buyer = await learner()
      const orderId = await pay(buyer, [await openCohort(100)], out.grant!.code!)
      expect(Number((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).total), 'دفع غير خصم مؤثره').toBe(30)
      const st = await influencers.statement(id)
      expect(st.rows).toHaveLength(1)
      expect(st.rows[0]).toMatchObject({ listTotal: 100, percent: 15, commission: 15 })
    } finally {
      await bf.update({ percentOff: 70 }, ownerId)
    }
  })

  it('⚠️ ومؤثر بلا خصم: نسبة الحملة', async () => {
    const out = await landing.apply(person({ influencerCode: 'BFPLAIN' }))
    expect(out.grant?.percentOff).toBe(70)
  })
})

describe('④ خصم المؤثر في منحة المؤثرين أيضا', () => {
  it('⚠️ خصمه بدل نسبتها، وتغييره على ما يعطى بعده، وبأثر يسمي من غيره — وفارغه يعيد نسبتها', async () => {
    await infGrant.update({ active: true, maxCodes: null, closesAt: null, percentOff: 45 }, ownerId)
    const id = await addInfluencer('INFOWN', 55)
    const first = await infLanding.apply(person({ influencerCode: 'INFOWN' }))
    expect(first.grant?.percentOff, 'منحة المؤثرين تجاهلت خصم المؤثر').toBe(55)
    expect((await infLanding.influencerView('INFOWN')).campaign.percentOff).toBe(55)

    await influencers.update(id, { percentOff: 65 }, ownerId)
    const second = await infLanding.apply(person({ influencerCode: 'INFOWN' }))
    expect(second.grant?.percentOff).toBe(65)
    const firstCoupon = await prisma.coupon.findUniqueOrThrow({ where: { code: first.grant!.code! } })
    expect(firstCoupon.percentOff, 'غير الخصم الجديد كودا أعطي قبله').toBe(55)
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'influencer.discount.set', entityId: id }, orderBy: { createdAt: 'desc' } })
    expect(audit).toMatchObject({ actorId: ownerId, before: { percentOff: 55 }, after: { percentOff: 65 } })

    await influencers.update(id, { percentOff: null }, ownerId)
    expect((await infLanding.apply(person({ influencerCode: 'INFOWN' }))).grant?.percentOff).toBe(45)
  })

  it('⚠️ والخصم عدد صحيح من ٠ إلى ١٠٠', async () => {
    const id = await addInfluencer('BADPCT')
    for (const percentOff of [101, -1, 12.5]) {
      await expect(influencers.update(id, { percentOff }, ownerId)).rejects.toMatchObject({ code: 'bad_discount' })
    }
    await expect(influencers.create({ nameAr: 'خطأ', code: 'BADPCT2', commissionPercent: 15, percentOff: 120 }, ownerId))
      .rejects.toMatchObject({ code: 'bad_discount' })
  })
})

describe('⑤ الكود يتغير ورابطه القديم يعمل', () => {
  it('⚠️ القديم يوصل إلى المؤثر نفسه بكوده الجديد — في الصفحة والنموذج والزيارة — والجديد يعمل', async () => {
    const id = await addInfluencer('BFOLD', 75)
    await expect(influencers.update(id, { code: 'b-f' }, ownerId)).rejects.toMatchObject({ code: 'bad_code' })
    const out = await influencers.update(id, { code: 'bfnew' }, ownerId)
    expect(out.code).toBe('BFNEW')
    const row = await prisma.influencer.findUniqueOrThrow({ where: { id } })
    expect(row).toMatchObject({ code: 'BFNEW', formerCodes: ['BFOLD'] })

    const old = await landing.influencerView('BFOLD')
    expect(old.influencer, 'الرابط القديم لا يعمل').toEqual({ nameAr: 'مؤثر BFOLD', code: 'BFNEW' })
    expect(old.campaign.percentOff).toBe(75)
    const applied = await landing.apply(person({ influencerCode: 'bfold' }))
    expect(applied.influencer?.code).toBe('BFNEW')
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: applied.ref } })).influencerId).toBe(id)
    expect((await prisma.grantCode.findFirstOrThrow({ where: { leadId: applied.ref } })).influencerId).toBe(id)
    expect((await landing.influencerView('BFNEW')).influencer?.code).toBe('BFNEW')
    /* وفي منحة المؤثّرين كذلك — الكودُ للمؤثّر لا للحملة */
    expect((await infLanding.influencerView('BFOLD')).influencer?.code).toBe('BFNEW')

    const visitorId = crypto.randomUUID()
    await recordGrantVisit(prisma, BLACK_FRIDAY_GRANT_SLUG, { visitorId, code: 'BFOLD' })
    expect((await prisma.grantVisit.findFirstOrThrow({ where: { visitorId } })).influencerCode).toBe('BFNEW')

    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'influencer.code.change', entityId: id } })
    expect(audit).toMatchObject({ actorId: ownerId, meta: { from: 'BFOLD', to: 'BFNEW' } })
  })

  it('⚠️ والكود القديم لا يأخذه مؤثر غيره — إضافة ولا تغييرا — ويعود إلى صاحبه إن أراده', async () => {
    const id = await addInfluencer('BFMINE')
    await influencers.update(id, { code: 'BFMINE2' }, ownerId)
    await expect(addInfluencer('BFMINE'), 'أخذ مؤثر جديد كودا سابقا لغيره').rejects.toMatchObject({ code: 'code_taken' })
    const other = await addInfluencer('BFOTHER')
    await expect(influencers.update(other, { code: 'BFMINE' }, ownerId)).rejects.toMatchObject({ code: 'code_taken' })
    await expect(influencers.update(other, { code: 'BFMINE2' }, ownerId)).rejects.toMatchObject({ code: 'code_taken' })
    expect((await prisma.influencer.findUniqueOrThrow({ where: { id: other } })).code).toBe('BFOTHER')

    await influencers.update(id, { code: 'BFMINE' }, ownerId)
    expect(await prisma.influencer.findUniqueOrThrow({ where: { id } })).toMatchObject({ code: 'BFMINE', formerCodes: ['BFMINE2'] })
  })
})

describe('⑥ منحة واحدة لكل متعلم على الحملات الأربع', () => {
  it('⚠️ من اشترى ببلاك فرايدي لا يشتري بكود حملة أخرى — ومن اشترى بأخرى لا يأخذ كودها', async () => {
    const open = new GrantService(prisma, OPEN_GRANT_SLUG)
    const members = new GrantService(prisma, MEMBER_GRANT_SLUG)
    await open.update({ active: true, maxCodes: null, closesAt: null }, ownerId)
    await members.update({ active: true, maxCodes: null, closesAt: null }, ownerId)

    const buyer = await learner()
    const bfCode = (await landing.apply(person({ influencerCode: 'BFPLAIN' }))).grant!.code!
    await pay(buyer, [await openCohort(100)], bfCode)
    const lead = async () => (await prisma.lead.create({ data: { fullName: 'زائر', phone: `0797${String(400000 + ++seq)}` } })).id
    for (const other of [members, open, infGrant]) {
      const code = (await other.issue({ leadId: await lead() })).code
      await expect(commerce.checkout(buyer, [await openCohort(100)], code), `اشترى بكود ${other.slug} بعد بلاك فرايدي`)
        .rejects.toMatchObject({ code: 'grant_once' })
    }

    const openBuyer = await learner()
    await pay(openBuyer, [await openCohort(100)], (await open.issue({ leadId: await lead() })).code)
    const again = await landing.apply(person({ email: await emailOf(openBuyer), influencerCode: 'BFPLAIN' }))
    expect(again.grant, 'أعطي كود بلاك فرايدي لمن اشترى بالعامة').toBeNull()
    expect(again.reasonAr).toBe(GRANT_ONCE_AR)
  })
})

describe('⑦ المتابعة والتذكير كمنحة المؤثرين', () => {
  it('⚠️ من لم يشتر بعد ساعة: حالة تسمي بلاك فرايدي وكود مؤثره', async () => {
    await addInfluencer('BFFOLLOW')
    const out = await landing.apply(person({ influencerCode: 'BFFOLLOW' }))
    await prisma.lead.update({ where: { id: out.ref }, data: { createdAt: new Date(Date.now() - 2 * 3_600_000) } })
    await openGrantFollowups(prisma)
    const kase = await prisma.advisorCase.findFirst({ where: { leadId: out.ref } })
    expect(kase, 'لم تفتح له حالة').not.toBeNull()
    expect(kase!.nextAction).toContain('بلاك فرايدي وجيز بكود BFFOLLOW')
  })

  it('⚠️ تذكير بنهايتها هي — يعيده إلى رابط مؤثره فيها لا إلى منحة المؤثرين', async () => {
    const HOUR = 3_600_000
    const T = new Date(Date.now() + 5 * 24 * HOUR)
    const at = (hoursBefore: number) => new Date(T.getTime() - hoursBefore * HOUR)
    const had = await prisma.integrationSetting.findUnique({ where: { provider: 'email' }, select: { enabled: true, config: true } })
    const cfg = { apiKey: 'test-key', fromEmail: 'no-reply@test.local' }
    await prisma.integrationSetting.upsert({ where: { provider: 'email' }, update: { enabled: true, config: cfg }, create: { provider: 'email', enabled: true, config: cfg } })
    const infClose = (await infGrant.settings()).closesAt
    try {
      await bf.update({ closesAt: T }, ownerId)
      await infGrant.update({ closesAt: null }, ownerId)
      await addInfluencer('BFREMIND', 72)
      const p = person({ influencerCode: 'BFREMIND' })
      const out = await landing.apply(p)
      const mails = () => prisma.outboxMail.findMany({ where: { to: p.email, purpose: 'grant.reminder' } })
      await sendGrantReminders(prisma, at(62.9), INFLUENCER_GRANT_SLUG)
      expect(await mails(), 'ذكره تذكير منحة المؤثرين').toHaveLength(0)
      const r = await sendGrantReminders(prisma, at(62.9), BLACK_FRIDAY_GRANT_SLUG)
      expect(r.stage).toBe('3d')
      const m = await mails()
      expect(m, 'لم يذكر من لم يشتر').toHaveLength(1)
      expect(m[0].text).toContain(out.grant!.code!)
      expect(m[0].text).toContain('/grant/bf/BFREMIND')
      expect(m[0].text).toContain('72%')
    } finally {
      await bf.update({ closesAt: null }, ownerId)
      await infGrant.update({ closesAt: infClose }, ownerId)
      if (had) await prisma.integrationSetting.update({ where: { provider: 'email' }, data: { enabled: had.enabled, config: had.config as never } })
      else await prisma.integrationSetting.delete({ where: { provider: 'email' } })
    }
  })
})

describe('⑧ رابط صاحب المنصة مزروع بالترحيل', () => {
  it('⚠️ SUHAIB بسبعين وبلا عمولة وبلا حساب — نشط، وصفحته تقول سبعين', async () => {
    const row = await prisma.influencer.findFirstOrThrow({ where: { OR: [{ code: 'SUHAIB' }, { formerCodes: { has: 'SUHAIB' } }] } })
    expect(row).toMatchObject({ nameAr: 'صهيب', code: 'SUHAIB', commissionPercent: 0, percentOff: 70, active: true, userId: null })
    await bf.update({ percentOff: 50 }, ownerId)
    try {
      const v = await landing.influencerView('Suhaib')
      expect(v.influencer?.code).toBe('SUHAIB')
      expect(v.campaign.percentOff, 'رابطه لا يقول سبعين').toBe(70)
    } finally {
      await bf.update({ percentOff: 70 }, ownerId)
    }
  })
})
