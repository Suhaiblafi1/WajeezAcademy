/* مستشارٌ أُغلق حسابُه — تنتقل حالاتُه المفتوحةُ وحدَها، وتقف عمولتُه (١٠ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة «a»).

   كان إيقافُه أو أرشفتُه لا يمسّ حالاتِه: تبقى عنده حتّى يضغط إداريٌّ «وزّع»، ولا يتابع عملاءَه أحد، وتُحسب له عمولةُ ما
   يشترونه وهو موقوف. والعلّةُ في `AdvisorService.releaseIfClosed`، وتُنادى من `AuthService.suspend`/`archive` ومن العامل. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorService, attributedOrders } from '../../services/advisor.service'

let prisma: PrismaClient
let auth: AuthService
let advisors: AdvisorService
const STAMP = Date.now()
let seq = 0

async function advisor(tag: string) {
  const userId = (await auth.register(`closed-adv-${tag}-${STAMP}@test.local`, 'Advisor#12345', `مستشار ${tag}`)).userId
  await auth.setRoles(userId, ['advisor'])
  await prisma.advisorProfile.create({ data: { userId, commissionPct: 10 } })
  return userId
}
/** حالةٌ لعميلٍ له حساب، مسندةٌ بيد إداريّ (فنوبتُه من ساعة الإسناد) */
async function caseFor(advisorId: string, status = 'contacted') {
  const clientId = (await auth.register(`closed-client-${++seq}-${STAMP}@test.local`, 'Learner#12345', `عميل ${seq}`)).userId
  const kase = await prisma.advisorCase.create({ data: { clientId, status } })
  await prisma.advisorAssignment.create({ data: { caseId: kase.id, advisorId, assignedBy: advisorId, automatic: false, assignedAt: new Date(Date.now() - 86_400_000) } })
  return { caseId: kase.id, clientId }
}
const holder = async (caseId: string) =>
  (await prisma.advisorAssignment.findFirst({ where: { caseId, unassignedAt: null } }))?.advisorId

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  advisors = new AdvisorService(prisma)
}, 240_000)

describe('مستشار أغلق حسابه', () => {
  it('⚠️ الإيقاف: تنتقل حالاته المفتوحة لغيره — والمغلقة تبقى شاهدا — وتقف عمولته', async () => {
    const [gone, other] = [await advisor('suspended'), await advisor('other')]
    const open = await caseFor(gone)
    const done = await caseFor(gone, 'closed')

    await auth.suspend(gone)
    expect(await holder(open.caseId), 'بقيت الحالة المفتوحة عند الموقوف').toBe(other)
    expect(await holder(done.caseId), 'نقلت حالة مغلقة').toBe(gone)

    /* وشراءٌ بعد الإيقاف لا يُحسب له */
    await prisma.order.create({ data: { userId: open.clientId, status: 'paid', subtotal: 100, total: 100, currency: 'USD', paidAt: new Date() } })
    expect((await attributedOrders(prisma, gone)).filter((o) => o.userId === open.clientId), 'حسبت للموقوف عمولة شراء بعد إيقافه').toHaveLength(0)
  })

  it('⚠️ والأرشفة كذلك', async () => {
    const [gone] = [await advisor('archived'), await advisor('other-2')]
    const open = await caseFor(gone)
    await auth.archive(gone, gone, 'غادر الفريق نهائيا بقرار الإدارة')
    expect(await holder(open.caseId), 'بقيت الحالة عند المؤرشف').not.toBe(gone)
  })

  it('⚠️ والعامل يلحق من أغلق حسابه بغير بابه', async () => {
    const gone = await advisor('direct')
    const open = await caseFor(gone)
    await prisma.user.update({ where: { id: gone }, data: { status: 'suspended' } })
    expect(await holder(open.caseId)).toBe(gone)

    const out = await advisors.sweepClosedAdvisors()
    expect(out.moved).toBeGreaterThanOrEqual(1)
    expect(await holder(open.caseId), 'لم ينقل العامل حالة الموقوف').not.toBe(gone)
  })
})
