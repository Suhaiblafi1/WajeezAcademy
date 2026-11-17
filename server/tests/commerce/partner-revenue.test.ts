/* حصّةُ الشريك من الإيراد (١٦ نوفمبر ٢٠٢٦) — والعلّةُ في رأس `server/services/partner-revenue.service.ts`.

   ① **الشريكُ الجديدُ بخصم ٥٠٪ وحصّة ٥٠٪** — قرارُ صاحب المنصّة («ok»).
   ② **الحصّةُ تُكتب في الكود يومَ يُعطى** — فتغييرُها يقع على ما بعده، والشريكُ بلا حصّةٍ لا يُحسب له شيء.
   ③ **وتُحسب ممّا دفعه المستفيدُ فعلا** — «% of what the student paid» — لا من سعر القائمة، ويراها ممثّلُه في لوحته وحدَه.
   ④ **والصرفُ يُسجَّل بأثرٍ، وما زاد على الرصيد يُسأل عنه**.
   ⑤ **والهامشُ يطرح حصّةَ الشريك** كما يطرح عمولةَ المؤثّر. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService } from '../../services/grant.service'
import { PartnerGrantService } from '../../services/partner-grant.service'
import { PartnerRevenueService } from '../../services/partner-revenue.service'
import { approvedPlanBy } from '../helpers/approved-trainer'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { STUDENT_SUGGESTED_COURSES, partnerCampaignSlug } from '../../../src/application/commerce/partner-grant'

let prisma: PrismaClient
let app: FastifyInstance
let auth: AuthService
let commerce: CommerceService
let partners: PartnerGrantService
let revenue: PartnerRevenueService
let ownerId = ''
let profileId = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()
const DAY = 86_400_000
const PASS = 'Partner#12345'

async function cohort(price = 100) {
  const courseId = pool.shift()
  if (!courseId) throw new Error('نفدت الدوراتُ المنشورة')
  const c = await prisma.cohort.create({
    data: {
      plans: { create: approvedPlanBy(profileId) }, courseId, title: `شعبة حصة الشريك ${++seq}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price, currency: 'USD', capacity: 50, startsAt: new Date(Date.now() + 30 * DAY),
    } as never,
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: ownerId } })
  return c.id
}
async function lastToken(email: string) {
  const mail = await prisma.outboxMail.findFirst({ where: { to: email, purpose: 'grant.partner_link' }, orderBy: { createdAt: 'desc' } })
  return decodeURIComponent(/confirm\?token=([A-Za-z0-9_\-%]+)/.exec(mail?.text ?? '')![1])
}
/** طالبٌ يؤكّد بريدَه فيأخذ كودَه، ثمّ حسابٌ ببريده يشتري به */
async function studentBuys(slug: string, price = 100) {
  const email = `rev-${++seq}-${STAMP}@std.hu.edu.jo`
  await partners.requestLink(slug, { fullName: `سارة ${seq}`, email, phone: '+962791234567' })
  const out = await partners.confirm(slug, await lastToken(email))
  const userId = (await auth.register(email, PASS, `سارة ${seq}`)).userId
  const o = await commerce.checkout(userId, [await cohort(price)], out.grant!.code)
  await commerce.payOrder(o.orderId, userId, `rev-${o.orderId}`)
  return { code: out.grant!.code, orderId: o.orderId }
}
const login = async (email: string) => `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}`

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  partners = new PartnerGrantService(prisma)
  revenue = new PartnerRevenueService(prisma)
  ownerId = (await auth.register(`rev-owner-${STAMP}@test.local`, PASS, 'صاحب المنصة')).userId
  await auth.setRoles(ownerId, ['super_admin'])
  const user = await prisma.user.create({ data: { email: `rev-tr-${STAMP}@wajeez.test`, displayName: 'مدرب', passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({ data: { reference: `WJ-TR-REV-${STAMP}`, fullName: 'مدرب', email: user.email, status: 'active' } })
  profileId = (await prisma.trainerProfile.create({
    data: { userId: user.id, applicationId: application.id, publicVisibility: true, isVerified: true, publishApprovedAt: new Date() },
  })).id
  pool = (await prisma.course.findMany({
    where: { status: 'published', id: { notIn: [...STUDENT_SUGGESTED_COURSES] } }, select: { id: true }, orderBy: { id: 'desc' },
  })).map((c) => c.id)
}, 240_000)
afterAll(async () => { await app?.close() })

describe('① الشريك الجديد بخصم 50% وحصة 50%', () => {
  it('⚠️ بلا نسبة ولا حصة مكتوبتين يأخذ القيم الأولى', async () => {
    const p = await partners.create({ slug: 'rev-def', nameAr: 'جامعة القيم', domains: ['hu.edu.jo'], active: true }, ownerId)
    expect(p.percentOff).toBe(50)
    expect(p.sharePercent).toBe(50)
  })
})

describe('② و③ الحصة في الكود يوم يعطى، ومما دفعه المستفيد فعلا', () => {
  let id = ''
  it('⚠️ دورة بـ100 بخصم 50%: دفع 50، وحصة الشريك 25 — لا 50 من سعر القائمة', async () => {
    id = (await partners.create({ slug: 'rev-a', nameAr: 'جامعة أ', domains: ['hu.edu.jo'], active: true }, ownerId)).id
    const { code, orderId } = await studentBuys('rev-a', 100)
    const g = await prisma.grantCode.findFirstOrThrow({ where: { coupon: { code } } })
    expect(g.partnerSharePercent, 'لم تكتب الحصة في الكود').toBe(50)
    const st = await revenue.statement(id)
    const row = st.rows.find((r) => r.orderId === orderId)!
    expect(row.paid).toBe(50)
    expect(row.share, 'الحصة ليست نصف ما دفع').toBe(25)
    expect(st.totals).toMatchObject({ signups: 1, buyers: 1, sales: 50, earned: 25, paidOut: 0, balance: 25 })
    expect(st.signups[0].email, 'البريد كاملا للشريك').toMatch(/•/)
  })

  it('⚠️ وتغيير الحصة يقع على ما بعده — والكود القديم بحصته', async () => {
    await partners.update(id, { sharePercent: 20 }, ownerId)
    const { orderId } = await studentBuys('rev-a', 100)
    const st = await revenue.statement(id)
    expect(st.rows.find((r) => r.orderId === orderId)!.share, 'الكود الجديد بحصته الجديدة').toBe(10)
    expect(st.totals.earned, 'غير التغيير حصة الكود القديم').toBe(35)
    const audit = await prisma.auditEvent.findFirst({ where: { action: 'coupon.partner_update', entityId: id }, orderBy: { createdAt: 'desc' } })
    expect(audit?.after, 'لم يكتب الأثر الحصة').toMatchObject({ sharePercent: 20 })
  })

  it('⚠️ والشريك بلا حصة لا يحسب له شيء', async () => {
    const p = await partners.create({ slug: 'rev-none', nameAr: 'جامعة بلا حصة', domains: ['hu.edu.jo'], active: true, sharePercent: null }, ownerId)
    await studentBuys('rev-none', 100)
    expect((await revenue.statement(p.id)).totals.earned).toBe(0)
  })

  it('⚠️ وممثله يرى كشف شريكه وحده — ومتعلم لا يبلغ اللوحة', async () => {
    const email = `rev-rep-${STAMP}@hu.edu.jo`
    await auth.register(email, PASS, 'ممثل الجامعة')
    await revenue.attachAccount(id, email, ownerId)
    const me = await app.inject({ method: 'GET', url: '/api/partner/me', headers: { cookie: await login(email) } })
    expect(me.statusCode, me.body).toBe(200)
    expect(me.json()).toMatchObject({ nameAr: 'جامعة أ', totals: { earned: 35 } })
    const csv = await app.inject({ method: 'GET', url: '/api/partner/me.csv', headers: { cookie: await login(email) } })
    expect(csv.statusCode).toBe(200)
    expect(csv.body).toContain('حصة الشريك')
    const other = `rev-learner-${STAMP}@test.local`
    await auth.register(other, PASS, 'متعلم')
    expect((await app.inject({ method: 'GET', url: '/api/partner/me', headers: { cookie: await login(other) } })).statusCode).toBe(403)
    expect(await prisma.auditEvent.count({ where: { action: 'partner.account', entityId: id } })).toBe(1)
  })

  it('⚠️ والصرف يسجل بأثر، وما زاد على الرصيد يسأل عنه أولا', async () => {
    await expect(revenue.recordPayout(id, { amount: 100 }, ownerId)).rejects.toMatchObject({ code: 'payout_exceeds_balance' })
    const st = await revenue.recordPayout(id, { amount: 30, noteAr: 'حوالة نوفمبر' }, ownerId)
    expect(st.totals).toMatchObject({ earned: 35, paidOut: 30, balance: 5 })
    expect(await prisma.auditEvent.count({ where: { action: 'partner.payout', entityId: id } })).toBe(1)
  })
})

describe('⑤ والهامش يطرح حصة الشريك', () => {
  it('⚠️ سعر 100 بخصم 50% وحصة 50%: يطرح 25 من كل مقعد', async () => {
    const p = await partners.create({ slug: 'rev-m', nameAr: 'جامعة الهامش', domains: ['hu.edu.jo'], active: true }, ownerId)
    await cohort(100)
    const m = await new GrantService(prisma, partnerCampaignSlug('rev-m')).margins()
    expect(m.sharePercent).toBe(50)
    const row = m.rows.find((r) => r.listPrice === 100)!
    expect(row.partnerShare).toBe(25)
    if (row.seatCost !== null) expect(row.margin).toBe(Math.round((50 - row.seatCost - 25) * 100) / 100)
    expect(p.sharePercent).toBe(50)
  })
})
