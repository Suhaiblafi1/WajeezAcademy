/* عمولةُ ما أسنده النظام — لا تبدأ إلّا بتواصلٍ يسجّله المستشار (١٩ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة (B1): ما أُسند تلقائيّا لا يُحسب للمستشار من يوم الإسناد، بل من أوّل تواصلٍ
   سجّله هو في تلك الحالة — والسجلُّ يُصدَّق. وما أسنده إداريٌّ أو أدخله المستشارُ بيده كما كان.
   والعلّةُ عند `attributedRevenue`.

   والمقيس:
   ① **بلا تواصلٍ لا عمولة** — ولو دفع العميلُ وهو في عهدته.
   ② **والتواصلُ قبل الدفع يُحسبها** — وبعده لا يُحسب عن دفعةٍ سبقته.
   ③ **وتواصلُ غيره لا يُحسب له.**
   ④ **والإسنادُ اليدويُّ كما كان** — من يوم الإسناد بلا شرط.
   ⑤ **ورقمُ الإدارة رقمُ المستشار** — حسابٌ واحدٌ لا اثنان. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorService, attributedRevenue } from '../../services/advisor.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let advisors: AdvisorService
let app: FastifyInstance
let advisorId = ''
let otherAdvisorId = ''

const DAY = 86_400_000
const at = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY)
let seq = 0

async function client() {
  seq += 1
  return (await auth.register(`cc-client-${seq}@test.local`, 'Client#12345', `عميل ${seq}`)).userId
}

/** حالةٌ مسندةٌ إلى المستشار في وقتٍ معلوم — تلقائيّا أو بيد إداريّ */
async function assigned(clientId: string, when: Date, automatic: boolean, to = advisorId) {
  const c = await prisma.advisorCase.create({ data: { clientId, status: 'new' } })
  await prisma.advisorAssignment.create({
    data: { caseId: c.id, advisorId: to, assignedAt: when, automatic, assignedBy: automatic ? null : to },
  })
  return c.id
}

const contact = (caseId: string, when: Date, by = advisorId) =>
  prisma.contactEvent.create({ data: { caseId, channel: 'whatsapp', summary: 'تواصل', createdBy: by, createdAt: when } })

const paid = (userId: string, total: number, when: Date) =>
  prisma.order.create({ data: { userId, status: 'paid', subtotal: total, total, currency: 'USD', paidAt: when, createdAt: when } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  advisors = new AdvisorService(prisma)
  app = await buildApp(prisma)
  await app.ready()
  advisorId = (await auth.register('cc-advisor@test.local', 'Advisor#12345', 'مستشار العمولة')).userId
  otherAdvisorId = (await auth.register('cc-other@test.local', 'Advisor#12345', 'مستشار آخر')).userId
  for (const id of [advisorId, otherAdvisorId]) await auth.setRoles(id, ['advisor'])
  await prisma.advisorProfile.create({ data: { userId: advisorId, commissionPct: 10 } })
}, 240_000)

afterAll(async () => {
  await app?.close()
})

describe('عمولةُ ما أسنده النظام', () => {
  let base = 0

  it('⚠️ ① بلا تواصلٍ لا عمولة — ولو دفع وهو في عهدته', async () => {
    base = await attributedRevenue(prisma, advisorId)
    const c = await client()
    await assigned(c, at(10), true)
    await paid(c, 100, at(5))
    expect(await attributedRevenue(prisma, advisorId), 'حُسبت دفعةٌ لم يتواصل المستشارُ قبلها').toBe(base)
  })

  it('⚠️ ② التواصلُ قبل الدفع يُحسبها — وبعده لا يُحسب عن دفعةٍ سبقته', async () => {
    const before = await attributedRevenue(prisma, advisorId)
    const c = await client()
    const kase = await assigned(c, at(10), true)
    await paid(c, 50, at(8))          // قبل أيّ تواصل — ليست له
    await contact(kase, at(6))
    await paid(c, 200, at(4))         // بعد تواصله — له
    expect(await attributedRevenue(prisma, advisorId)).toBe(before + 200)
  })

  it('⚠️ ③ وتواصلُ غيره في الحالة لا يُحسب له', async () => {
    const before = await attributedRevenue(prisma, advisorId)
    const c = await client()
    const kase = await assigned(c, at(10), true)
    await contact(kase, at(9), otherAdvisorId)
    await paid(c, 70, at(3))
    expect(await attributedRevenue(prisma, advisorId)).toBe(before)
  })

  it('④ والإسنادُ اليدويُّ كما كان — من يوم الإسناد بلا شرط تواصل', async () => {
    const before = await attributedRevenue(prisma, advisorId)
    const c = await client()
    await assigned(c, at(10), false)
    await paid(c, 30, at(12))         // قبل إسناده — ليست له
    await paid(c, 40, at(2))
    expect(await attributedRevenue(prisma, advisorId)).toBe(before + 40)
  })

  it('والإسنادُ الذي يقع في `autoAssign` يُعلَّم تلقائيّا — واليدويُّ لا', async () => {
    const managerId = (await auth.register('cc-manager@test.local', 'Manager#12345', 'مدير')).userId
    await auth.setRoles(managerId, ['operations_manager'])
    const kase = await prisma.advisorCase.create({ data: { status: 'new' } })
    await advisors.autoAssign(kase.id)
    expect((await prisma.advisorAssignment.findFirstOrThrow({ where: { caseId: kase.id, unassignedAt: null } })).automatic).toBe(true)
    await advisors.assign(kase.id, advisorId, managerId)
    expect((await prisma.advisorAssignment.findFirstOrThrow({ where: { caseId: kase.id, unassignedAt: null } })).automatic).toBe(false)
  })
})

describe('⑤ ورقمُ الإدارة رقمُ المستشار', () => {
  it('⚠️ ملفُّه عند الإدارة يقرأ الحسابَ نفسَه — لا عمرَ العميل ولا النشطةَ وحدَها', async () => {
    const password = 'Super#12345'
    const sup = await auth.register('cc-super@test.local', password, 'مدير النظام')
    await auth.setRoles(sup.userId, ['super_admin'])
    const { token } = await auth.login('cc-super@test.local', password)

    /* حالةٌ أُغلقت ورُفع إسنادُها بعد بيعتها — تبقى له في الحسابين */
    const c = await client()
    const kase = await assigned(c, at(20), false)
    await paid(c, 90, at(15))
    await prisma.advisorAssignment.updateMany({ where: { caseId: kase }, data: { unassignedAt: at(14) } })

    const res = await app.inject({
      method: 'GET', url: `/api/admin/advisors/${advisorId}`, headers: { cookie: `${SESSION_COOKIE}=${token}` },
    })
    expect(res.statusCode).toBe(200)
    const admin = res.json() as { revenueFromReferrals: number; commissionOwed: number }
    const mine = await advisors.myEarnings(advisorId)
    expect(admin.revenueFromReferrals, 'الإدارةُ ترى رقما والمستشارُ آخر').toBe(mine.revenueFromReferrals)
    expect(admin.commissionOwed).toBe(mine.commissionOwed)
  })
})
