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
   ⑧ **ورابطُ صاحب المنصّة مزروعٌ بالترحيل** — SUHAIB بسبعين وبلا عمولة وبلا حساب.
   ⑨ **ودوراتُ صفحتها بقائمتها هي** (#941): دوراتُ المؤثّر فيها قائمتُه داخلَ قائمة بلاك فرايدي لا قائمةِ منحة المؤثّرين،
      وإن لم يقع منها فيها شيءٌ فقائمتُها كلُّها. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { GrantLandingService } from '../../services/grant-landing.service'
import { InfluencerService } from '../../services/influencer.service'
import { recordGrantVisit } from '../../services/grant-visit.service'
import { campaignScope, influencerScope } from '../../services/grant-scope.service'
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
/* والبريدُ لازمٌ في الإضافة — لكلّ مؤثّرٍ حسابٌ وصفحة (#941، ١٥ نوفمبر ٢٠٢٦) */
const infEmail = (code: string) => `${code.toLowerCase()}-bf-${STAMP}@test.local`
async function addInfluencer(code: string, percentOff: number | null = null, commissionPercent = 15) {
  return (await influencers.create({ nameAr: `مؤثر ${code}`, code, commissionPercent, percentOff, email: infEmail(code) }, ownerId)).id
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

describe('③ نموذجها منحة وجيز بلا كود مؤثر (١٦ نوفمبر ٢٠٢٦)', () => {
  /* كانت حملةَ مؤثّرين وكودُ المؤثّر لازمٌ فيها. ثمّ صارت إليها «منحة وجيز» و«العامة» ووُقف المؤثّرون («delete all influencers
     links»)، فنموذجُها بلا كود مؤثّر، وكودُها بنسبتها، ولا عمولةَ ولا مؤثّرَ يُحسب له — وبريدُه إلى صفحتها لا إلى رابط مؤثّر */
  it('⚠️ بلا كود مؤثر: كود بنسبتها، بلا مؤثر ولا عمولة، وبريده إلى /grant/bf', async () => {
    const p = person()
    const out = await landing.apply(p)
    expect(out.grant?.percentOff).toBe(70)
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: out.ref } })
    expect(lead).toMatchObject({ campaign: BLACK_FRIDAY_GRANT_SLUG, influencerId: null })
    const gc = await prisma.grantCode.findFirstOrThrow({ where: { leadId: lead.id } })
    expect(gc).toMatchObject({ influencerId: null, commissionPercent: null })
    const mail = await prisma.outboxMail.findFirstOrThrow({ where: { to: p.email, purpose: 'grant.code' }, orderBy: { createdAt: 'desc' } })
    expect(mail.text).toContain('/grant/bf')
    expect(mail.text, 'بريده إلى رابط مؤثر').not.toMatch(/\/grant\/bf\/[A-Z]/)
  })

  it('⚠️ وكود مؤثر يكتب في النموذج لا يحسب له — لا عمولة ولا خصمه', async () => {
    await addInfluencer('BFSEVENTY', 75, 15)
    const out = await landing.apply(person({ influencerCode: 'BFSEVENTY' }))
    expect(out.grant?.percentOff, 'أخذ خصم المؤثر').toBe(70)
    const gc = await prisma.grantCode.findFirstOrThrow({ where: { leadId: out.ref } })
    expect(gc, 'حسبت عمولة لمؤثر').toMatchObject({ influencerId: null, commissionPercent: null })
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
    await expect(influencers.create({ nameAr: 'خطأ', code: 'BADPCT2', commissionPercent: 15, percentOff: 120, email: infEmail('BADPCT2') }, ownerId))
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

    const old = await infLanding.influencerView('BFOLD')
    expect(old.influencer, 'الرابط القديم لا يعمل').toEqual({ nameAr: 'مؤثر BFOLD', code: 'BFNEW' })
    expect(old.campaign.percentOff).toBe(75)
    const applied = await infLanding.apply(person({ influencerCode: 'bfold' }))
    expect(applied.influencer?.code).toBe('BFNEW')
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: applied.ref } })).influencerId).toBe(id)
    expect((await prisma.grantCode.findFirstOrThrow({ where: { leadId: applied.ref } })).influencerId).toBe(id)
    expect((await infLanding.influencerView('BFNEW')).influencer?.code).toBe('BFNEW')
    /* وفي منحة المؤثّرين كذلك — الكودُ للمؤثّر لا للحملة */
    expect((await infLanding.influencerView('BFOLD')).influencer?.code).toBe('BFNEW')

    const visitorId = crypto.randomUUID()
    await recordGrantVisit(prisma, INFLUENCER_GRANT_SLUG, { visitorId, code: 'BFOLD' })
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

describe('⑦ المتابعة والتذكير بلا مؤثر (١٦ نوفمبر ٢٠٢٦)', () => {
  it('⚠️ من لم يشتر بعد ساعة: حالة تسمي بلاك فرايدي', async () => {
    const out = await landing.apply(person())
    await prisma.lead.update({ where: { id: out.ref }, data: { createdAt: new Date(Date.now() - 2 * 3_600_000) } })
    await openGrantFollowups(prisma)
    const kase = await prisma.advisorCase.findFirst({ where: { leadId: out.ref } })
    expect(kase, 'لم تفتح له حالة').not.toBeNull()
    expect(kase!.nextAction).toContain('بلاك فرايدي وجيز')
  })

  it('⚠️ تذكير بنهايتها هي — إلى صفحتها بنسبتها', async () => {
    const HOUR = 3_600_000
    const T = new Date(Date.now() + 5 * 24 * HOUR)
    const at = (hoursBefore: number) => new Date(T.getTime() - hoursBefore * HOUR)
    const had = await prisma.integrationSetting.findUnique({ where: { provider: 'email' }, select: { enabled: true, config: true } })
    const cfg = { apiKey: 'test-key', fromEmail: 'no-reply@test.local' }
    await prisma.integrationSetting.upsert({ where: { provider: 'email' }, update: { enabled: true, config: cfg }, create: { provider: 'email', enabled: true, config: cfg } })
    try {
      await bf.update({ closesAt: T }, ownerId)
      const p = person()
      const out = await landing.apply(p)
      const mails = () => prisma.outboxMail.findMany({ where: { to: p.email, purpose: 'grant.reminder' } })
      const r = await sendGrantReminders(prisma, at(62.9), BLACK_FRIDAY_GRANT_SLUG)
      expect(r.stage).toBe('3d')
      const m = await mails()
      expect(m, 'لم يذكر من لم يشتر').toHaveLength(1)
      expect(m[0].text).toContain(out.grant!.code!)
      expect(m[0].text).toContain('/grant/bf')
      expect(m[0].text).toContain('70%')
    } finally {
      await bf.update({ closesAt: null }, ownerId)
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

describe('⑨ دورات صفحتها بقائمتها هي', () => {
  it('⚠️ دورات المؤثر فيها قائمته داخل قائمة بلاك فرايدي — وإن لم يقع منها شيء فقائمتها كلها', async () => {
    const [a, b, c] = [nextCourse(), nextCourse(), nextCourse()]
    const sorted = (x: ReadonlySet<string> | null) => (x ? [...x].sort() : null)
    const infCamp = (await infGrant.settings()).id
    const bfCamp = (await bf.settings()).id
    const infBefore = (await prisma.grantCampaign.findUniqueOrThrow({ where: { id: infCamp } })).courseIds
    try {
      await prisma.grantCampaign.update({ where: { id: bfCamp }, data: { courseIds: [a, b] } })
      await prisma.grantCampaign.update({ where: { id: infCamp }, data: { courseIds: [] } })
      const id = await addInfluencer('BFSCOPE')
      await prisma.influencer.update({ where: { id }, data: { courseIds: [a, c] } })
      expect(sorted(await influencerScope(prisma, id, BLACK_FRIDAY_GRANT_SLUG)), 'خرج المؤثر عن قائمة بلاك فرايدي').toEqual([a])
      expect(sorted(await influencerScope(prisma, id, INFLUENCER_GRANT_SLUG)), 'منحة المؤثرين تغيرت').toEqual([a, c].sort())
      await prisma.influencer.update({ where: { id }, data: { courseIds: [c] } })
      expect(sorted(await influencerScope(prisma, id, BLACK_FRIDAY_GRANT_SLUG)), 'لم يرجع إلى قائمتها كلها')
        .toEqual(sorted(await campaignScope(prisma, BLACK_FRIDAY_GRANT_SLUG)))
    } finally {
      await prisma.grantCampaign.update({ where: { id: bfCamp }, data: { courseIds: [] } })
      await prisma.grantCampaign.update({ where: { id: infCamp }, data: { courseIds: infBefore } })
    }
  })
})

/* ═══ ⑩ «منحة وجيز» و«العامة» تصيران بلاك فرايدي بـ70%، ويوقف المؤثرون (١٦ نوفمبر ٢٠٢٦) — `grant-merge.service.ts` ═══
   «اريد ان تتحول منحة وجيز ٦٠٪ الى بلاك فرايدي وتتغير لكل طالب لديه كود فيها… وايضا منحة وجيز العامة تتغير كلها وتصبح ٧٠٪»،
   و«Lower them to 70%» لأكواد الثمانين مع بريدٍ يشرح، و«delete all influencers links… keep the option to the admin». */
describe('⑩ الدمج في بلاك فرايدي', () => {
  it('⚠️ أكواد الحملتين تنتقل بكودها نفسه بسبعين، والثمانون تنزل ببريد، والقديمتان والمؤثرون يوقفون — مرة واحدة', async () => {
    const { applyBlackFridayMerge } = await import('../../services/grant-merge.service')
    await new GrantService(prisma, MEMBER_GRANT_SLUG).update({ active: true, percentOff: 60, maxCodes: null, closesAt: null }, ownerId)
    await new GrantService(prisma, OPEN_GRANT_SLUG).update({ active: true, percentOff: 50, maxCodes: null, closesAt: null }, ownerId)
    const m = person()
    const mOut = await new GrantLandingService(prisma, MEMBER_GRANT_SLUG).apply(m)
    const o = person()
    const oOut = await new GrantLandingService(prisma, OPEN_GRANT_SLUG).apply(o)
    await bf.update({ percentOff: 80 }, ownerId)
    const e = person()
    const eOut = await landing.apply(e)
    await bf.update({ percentOff: 70 }, ownerId)
    await addInfluencer('BFSTOP')

    const r = await applyBlackFridayMerge(prisma)
    expect(r, 'لم يدمج').not.toBeNull()
    const bfId = (await bf.settings()).id
    for (const [out, pct] of [[mOut, 60], [oOut, 50], [eOut, 80]] as const) {
      const gc = await prisma.grantCode.findFirstOrThrow({ where: { leadId: out.ref }, include: { coupon: true } })
      expect(gc.campaignId, `كود ${pct}% لم ينتقل`).toBe(bfId)
      expect(gc.coupon.code, 'تغير الكود').toBe(out.grant!.code)
      expect(gc.coupon.percentOff, `كود ${pct}% لم يصر سبعين`).toBe(70)
      expect((await prisma.lead.findUniqueOrThrow({ where: { id: out.ref } })).campaign).toBe(BLACK_FRIDAY_GRANT_SLUG)
    }
    expect(await prisma.outboxMail.count({ where: { to: e.email, purpose: 'grant.notice' } }), 'لم يخبر من نزل كوده').toBe(1)
    expect(await prisma.outboxMail.count({ where: { to: m.email, purpose: 'grant.notice' } }), 'أخبر من ارتفع كوده بنزول').toBe(0)
    expect((await new GrantService(prisma, MEMBER_GRANT_SLUG).settings()).active).toBe(false)
    expect((await new GrantService(prisma, OPEN_GRANT_SLUG).settings()).active).toBe(false)
    expect(await prisma.influencer.count({ where: { active: true } }), 'بقي مؤثر نشط').toBe(0)
    expect(await prisma.influencer.count({ where: { code: 'BFSTOP' } }), 'حذف ملف المؤثر').toBe(1)

    /* ومن عبأ نموذج بلاك فرايدي ببريده القديم يجد كوده نفسه */
    const again = await landing.apply({ ...m, phone: m.phone })
    expect(again.ref).toBe(mOut.ref)
    expect(await applyBlackFridayMerge(prisma), 'دمج مرتين').toBeNull()
  })
})
