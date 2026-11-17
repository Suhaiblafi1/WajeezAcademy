/* كاسيت — مؤثّرٌ بصفحته ورأسه المشترك، تُنشأ في الإنتاج مرّةً بلا نقرةٍ في الإدارة (١٧ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «Influencer page + logo» — كودُها KASEET كما أُرسل لها، وعمولتُها ٥٪، ورقمُها وبريدُها. والعلّةُ في
   `applyInfluencerLaunch` (`server/services/influencer.service.ts`) و`channelView` و`apply` (`grant-landing.service.ts`).

   ① **تُنشأ مرّةً من طريق إضافة المدير** — بدورة العامل: حسابٌ ببريدها مدعوٌّ ودعوتُه وبريدُ الترحيب، وأثرٌ بسببه بلا فاعل.
      ومن عبّأ بلاك فرايدي برابطها قبلها يُنسب إليها بعمولةٍ صفر. ورقمُ واتساب صفحتها يُكتب مرّةً.
   ② **والثانيةُ لا شيء** — ولا تمسّ ما غيّره صاحبُ المنصّة بعدُ.
   ③ **صفحتُها** — اسمُها ورأسُها (بلا شعارٍ حتى يصل) ورسالةُ واتساب، وبكودها السابق KASSET، وفي بلاك فرايدي برابطها `?ch=kaseet`.
      ومؤثّرٌ بلا رأسٍ تبقى صفحتُه كما كانت.
   ④ **عمولتُها ٥٪** على شراءٍ بكودٍ جاء بكودها في منحة المؤثّرين.
   ⑤ **ومن جاء بلاك فرايدي برابطها يُنسب إليها — بلا عمولة**: بلاك فرايدي ليست حملةَ مؤثّرين (١٦ نوفمبر ٢٠٢٦)، وكودُ مؤثّرٍ
      يُكتب في نموذجها لا يُحسب له (حارسُه ③ في `black-friday-grant.test.ts`) — فالقناةُ وحدَها. */

import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'

const outbox = vi.hoisted(() => [] as { to: string; subject: string; text: string }[])
vi.mock('../../services/notification.service', async (orig) => {
  const real = await orig<typeof import('../../services/notification.service')>()
  return {
    ...real,
    sendDirectEmail: async (_p: unknown, input: { to: string; subject: string; text: string }) => {
      outbox.push({ to: input.to, subject: input.subject, text: input.text })
      return { status: 'sent' as const }
    },
  }
})

import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { GrantLandingService } from '../../services/grant-landing.service'
import { InfluencerService, KASEET_LAUNCH_REASON, applyInfluencerLaunch } from '../../services/influencer.service'
import { getWhatsAppNumbers } from '../../services/integrations.service'
import { runJob } from '../../worker/jobs'
import { approvedTrainerPlan } from '../helpers/approved-trainer'
import { BLACK_FRIDAY_GRANT_SLUG, INFLUENCER_GRANT_SLUG } from '../../../src/application/commerce/grant'
import { KASEET_INFLUENCER } from '../../../src/application/commerce/influencer'

const KASEET_TEXT = 'مرحبا، أحتاج مساعدتكم في اختيار الدورات المناسبة لي - كاسيت'

let prisma: PrismaClient
let app: FastifyInstance
let auth: AuthService
let commerce: CommerceService
let influencers: InfluencerService
let ownerId = ''
let pool: string[] = []
let seq = 0
let earlyLead = ''
const STAMP = Date.now()

const kaseet = () => prisma.influencer.findUniqueOrThrow({ where: { code: 'KASEET' } })
const person = (over: Record<string, unknown> = {}) => ({
  fullName: `متابع كاسيت ${++seq}`, phone: `+962793${String(600000 + seq)}`, email: `kaseet-f-${seq}-${STAMP}@test.local`,
  workField: 'الموارد البشرية', ...over,
})
async function openCohort(price = 100) {
  const courseId = pool.shift()
  if (!courseId) throw new Error('نفدت الدورات المنشورة')
  return (await prisma.cohort.create({
    data: {
      plans: { create: await approvedTrainerPlan(prisma) },
      courseId, title: `شعبة كاسيت ${++seq}`, status: 'open', registrationOpen: true, financialReady: true,
      price, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() + 30 * 86_400_000),
    } as never,
  })).id
}
async function buyer() {
  seq += 1
  return (await auth.register(`kaseet-b-${seq}-${STAMP}@test.local`, 'Learner#12345', `مشتري ${seq}`)).userId
}
async function pay(userId: string, cohortIds: string[], code: string) {
  const out = await commerce.checkout(userId, cohortIds, code)
  await commerce.payOrder(out.orderId, userId, `kaseet-${out.orderId}`)
  return out.orderId
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  await app.ready()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  influencers = new InfluencerService(prisma)
  ownerId = (await auth.register(`kaseet-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'asc' } })).map((c) => c.id)
}, 240_000)

describe('① تنشأ مرة من طريق إضافة المدير — بدورة العامل', () => {
  it('⚠️ كودها وعمولتها ورقمها وحسابها ودعوتها وترحيبها وأثرها — ومن سبقها برابطها ينسب إليها', async () => {
    /* من عبّأ بلاك فرايدي برابطها قبل أن تُنشأ — قناتُه وحدَها */
    const bf = new GrantLandingService(prisma, BLACK_FRIDAY_GRANT_SLUG)
    expect(await prisma.influencer.count({ where: { code: KASEET_INFLUENCER.code } })).toBe(0)
    await new GrantService(prisma, BLACK_FRIDAY_GRANT_SLUG).update({ active: true, closesAt: null }, ownerId)
    const early = await bf.apply(person({ channel: 'kaseet' }))
    earlyLead = early.ref
    /* وبقناة كودها السابق `?ch=kasset` — كان العاملُ لا ينسبه إليها (١٧ نوفمبر ٢٠٢٦، Fix all 6) */
    const earlyOld = await bf.apply(person({ channel: 'kasset' }))
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: early.ref } })).influencerId).toBeNull()
    outbox.length = 0

    await runJob(prisma, 'grant_reminders')
    const k = await kaseet()
    expect(k).toMatchObject({ nameAr: 'كاسيت', code: 'KASEET', formerCodes: ['KASSET'], commissionPercent: 5, phone: '+962781010288', percentOff: null, active: true, createdBy: null })
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'jameelzatara@kaseet.com' }, include: { roles: true } })
    expect(k.userId).toBe(user.id)
    expect(user.status).toBe('invited')
    expect(user.roles.map((r) => r.roleId)).toContain('influencer')
    expect(await prisma.passwordResetToken.count({ where: { userId: user.id, purpose: 'invite', usedAt: null } })).toBeGreaterThan(0)
    const mails = outbox.filter((m) => m.to === 'jameelzatara@kaseet.com')
    expect(mails.map((m) => m.subject), 'لم يصلها بريد الترحيب').toContain('أضفناك مؤثرا في منحة مؤثرين وجيز')
    expect(mails.find((m) => m.subject === 'أضفناك مؤثرا في منحة مؤثرين وجيز')!.text).toContain('KASEET')
    expect(mails.length, 'لم تصلها الدعوة مع الترحيب').toBeGreaterThanOrEqual(2)
    const made = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'influencer.create', entityId: k.id } })
    expect(made).toMatchObject({ actorId: null, reason: KASEET_LAUNCH_REASON })

    /* ومن سبقها برابطها نُسب إليها — بعمولةٍ صفر، فبلاك فرايدي بلا عمولة */
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: earlyLead } })).influencerId, 'من سبقها برابطها لم ينسب إليها').toBe(k.id)
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: earlyOld.ref } })).influencerId, 'من سبقها بقناة كودها السابق لم ينسب إليها').toBe(k.id)
    expect(await prisma.grantCode.findUniqueOrThrow({ where: { leadId: earlyOld.ref } })).toMatchObject({ influencerId: k.id, commissionPercent: 5 })
    /* ومن جاء برابطها قبل زرعها يأخذ كودُه عمولتَها — «Yes, 5% on Black Friday» */
    expect(await prisma.grantCode.findUniqueOrThrow({ where: { leadId: earlyLead } })).toMatchObject({ influencerId: k.id, commissionPercent: 5 })

    expect((await getWhatsAppNumbers(prisma)).influencer_page, 'رقم واتساب صفحتها لم يكتب').toBe('962794050524')
  })
})

describe('② والثانية لا شيء', () => {
  it('⚠️ لا تنشئها ثانية ولا تمس ما غيره صاحب المنصة', async () => {
    const k = await kaseet()
    await influencers.update(k.id, { commissionPercent: 7 }, ownerId)
    expect(await applyInfluencerLaunch(prisma)).toBeNull()
    await runJob(prisma, 'grant_reminders')
    expect((await kaseet()).commissionPercent, 'أعادت عمولتها إلى 5').toBe(7)
    expect(await prisma.influencer.count({ where: { OR: [{ code: 'KASEET' }, { formerCodes: { has: 'KASEET' } }] } })).toBe(1)
    expect(await prisma.auditEvent.count({ where: { action: 'influencer.create', reason: KASEET_LAUNCH_REASON } })).toBe(1)
    await influencers.update(k.id, { commissionPercent: 5 }, ownerId)
  })
})

describe('③ صفحتها برأسها ورسالة واتساب', () => {
  it('⚠️ اسمها ورأسها بلا شعار حتى يصل، ورسالتها — وبكودها السابق، وفي بلاك فرايدي برابطها', async () => {
    const face = { nameAr: 'كاسيت', code: 'KASEET', brand: { logoUrl: null }, whatsAppText: KASEET_TEXT }
    for (const code of ['KASEET', 'kaseet', 'KASSET']) {
      const res = await app.inject({ method: 'GET', url: `/api/public/grant/influencer?code=${code}` })
      expect(res.statusCode).toBe(200)
      expect(res.json().influencer, code).toEqual(face)
    }
    const bf = await app.inject({ method: 'GET', url: '/api/public/grant/bf?ch=kaseet' })
    expect(bf.json().influencer, 'بلاك فرايدي برابطها بلا رأسها').toEqual(face)
    expect((await app.inject({ method: 'GET', url: '/api/public/grant/bf' })).json().influencer ?? null).toBeNull()
    /* ومؤثّرٌ بلا رأسٍ تبقى صفحتُه كما كانت — لا رأسَ له في بلاك فرايدي */
    await influencers.create({ nameAr: 'مؤثر عادي', code: 'PLAINK', commissionPercent: 15, email: `plaink-${STAMP}@test.local` }, ownerId)
    expect((await app.inject({ method: 'GET', url: '/api/public/grant/bf?ch=plaink' })).json().influencer).toBeNull()
    expect((await app.inject({ method: 'GET', url: '/api/public/grant/influencer?code=PLAINK' })).json().influencer)
      .toEqual({ nameAr: 'مؤثر عادي', code: 'PLAINK' })
  })
})

describe('④ عمولتها 5% في منحة المؤثرين', () => {
  it('⚠️ 5% من 200 = 10', async () => {
    await new GrantService(prisma, INFLUENCER_GRANT_SLUG).update({ active: true, closesAt: null }, ownerId)
    const out = await new GrantLandingService(prisma, INFLUENCER_GRANT_SLUG).apply(person({ influencerCode: 'KASEET' }))
    const k = await kaseet()
    expect(await prisma.grantCode.findUniqueOrThrow({ where: { leadId: out.ref } })).toMatchObject({ influencerId: k.id, commissionPercent: 5 })
    await pay(await buyer(), [await openCohort(100), await openCohort(100)], out.grant!.code!)
    const st = await influencers.statement(k.id)
    const row = st.rows.find((r) => r.listTotal === 200)
    expect(row).toMatchObject({ percent: 5, commission: 10 })
  })
})

describe('⑤ وفي بلاك فرايدي برابطها تنسب إليها بعمولتها — «Yes, 5% on Black Friday»', () => {
  it('⚠️ عميلها وكودها لها في لوحها — وعمولتها 5% (١٧ نوفمبر ٢٠٢٦)', async () => {
    const bf = new GrantLandingService(prisma, BLACK_FRIDAY_GRANT_SLUG)
    const k = await kaseet()
    const byLink = await bf.apply(person({ channel: 'kaseet' }))
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: byLink.ref } })).influencerId, 'لم ينسب إليها').toBe(k.id)
    expect(await prisma.grantCode.findUniqueOrThrow({ where: { leadId: byLink.ref } }), 'كودها بلا عمولتها').toMatchObject({ influencerId: k.id, commissionPercent: 5 })
    /* ومن جاء بلا رابطها لا يُنسب لأحد */
    const plain = await bf.apply(person({ channel: 'whatsapp' }))
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: plain.ref } })).influencerId).toBeNull()
    const orderId = await pay(await buyer(), [await openCohort(100)], byLink.grant!.code!)
    const row = (await influencers.statement(k.id)).rows.find((r) => r.orderId === orderId)
    expect(row, 'لا يظهر في لوحها بعمولتها').toMatchObject({ percent: 5, commission: 5, listTotal: 100 })
  })

  it('⚠️ ومؤثر ليس في القائمة يأتي برابطه في بلاك فرايدي: ينسب إليه بلا عمولة كما كان', async () => {
    const other = await prisma.influencer.create({ data: { nameAr: 'مؤثر آخر', code: `OTHERBF${STAMP % 100000}`, commissionPercent: 15 } })
    const out = await new GrantLandingService(prisma, BLACK_FRIDAY_GRANT_SLUG).apply(person({ channel: other.code.toLowerCase() }))
    expect(await prisma.grantCode.findUniqueOrThrow({ where: { leadId: out.ref } })).toMatchObject({ influencerId: other.id, commissionPercent: 0 })
  })
})

/* ═══ ⑥ وتغييرُ كودها لا يُسقط عمولتَها ولا رأسَها (قرارُ صاحب المنصّة (١٧ نوفمبر ٢٠٢٦): Fix all 6) ═══
   العلّة: `blackFridayCommission` و`influencerBrand` كانا يُطابقان كودَها الحاليَّ وحدَه بالقائمتين، فإن غيّر المديرُ كودَها
   سقطت عمولتُها ٥٪ على بلاك فرايدي ورأسُ صفحتها بلا أثر. والكودُ القديمُ ينتقل إلى `formerCodes`، فتُعرف به. */
describe('⑥ وتغيير كودها لا يسقط عمولتها ولا رأسها', () => {
  it('⚠️ بكودها الجديد: عمولتها 5% على بلاك فرايدي برابطها، ورأسها في صفحتها وفي بلاك فرايدي', async () => {
    const k = await kaseet()
    await influencers.update(k.id, { code: 'KASEETNEW' }, ownerId)
    try {
      const out = await new GrantLandingService(prisma, BLACK_FRIDAY_GRANT_SLUG).apply(person({ channel: 'kaseetnew' }))
      expect(await prisma.grantCode.findUniqueOrThrow({ where: { leadId: out.ref } }), 'سقطت عمولتها بتغيير كودها')
        .toMatchObject({ influencerId: k.id, commissionPercent: 5 })
      const face = { nameAr: 'كاسيت', code: 'KASEETNEW', brand: { logoUrl: null }, whatsAppText: KASEET_TEXT }
      expect((await app.inject({ method: 'GET', url: '/api/public/grant/bf?ch=kaseetnew' })).json().influencer, 'سقط رأسها').toEqual(face)
      expect((await app.inject({ method: 'GET', url: '/api/public/grant/influencer?code=KASEETNEW' })).json().influencer).toEqual(face)
    } finally {
      await influencers.update(k.id, { code: 'KASEET' }, ownerId)
    }
  })
})
