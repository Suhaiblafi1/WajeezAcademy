/* من نُقل عنه طالبُه لا يقبض عنه بعد نقله (١٩ أكتوبر ٢٠٢٦) — قرارُ صاحب المنصّة: «a».

   لكلّ إسنادٍ نوبة: من بدايته (أو أوّلِ تواصلٍ إن كان تلقائيّا) إلى رفعه أو إلى إسناد الطالب نفسِه
   لمستشارٍ غيره — أيُّهما أسبق. فلا تُدفع دفعةٌ مرّتين، ولا يأخذ الأخيرُ ما قبله. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeAdvisor } from '../helpers/advisor'
import { AuthService } from '../../services/auth.service'
import { AdvisorService, attributedRevenue } from '../../services/advisor.service'

let prisma: PrismaClient
let auth: AuthService
let advisors: AdvisorService
let managerId = ''
let seq = 0

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY)

async function advisor() {
  const { userId } = await auth.register(`handover-adv-${++seq}@test.local`, 'Advisor#12345', `مستشار ${seq}`)
  await makeAdvisor(prisma, auth, userId)
  return userId
}
async function client() {
  return (await auth.register(`handover-client-${++seq}@test.local`, 'Client#12345', `عميل ${seq}`)).userId
}
async function caseFor(clientId: string) {
  return (await prisma.advisorCase.create({ data: { clientId, status: 'contacted' } })).id
}
const link = (caseId: string, advisorId: string, assignedAt: Date, extra: { unassignedAt?: Date; automatic?: boolean } = {}) =>
  prisma.advisorAssignment.create({ data: { caseId, advisorId, assignedAt, ...extra } })
const paid = (userId: string, total: number, when: Date) =>
  prisma.order.create({ data: { userId, status: 'paid', subtotal: total, total, currency: 'USD', paidAt: when, createdAt: when } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  advisors = new AdvisorService(prisma)
  managerId = (await auth.register('handover-manager@test.local', 'Manager#12345', 'مدير')).userId
  await auth.setRoles(managerId, ['operations_manager'])
}, 240_000)

describe('لكلٍّ ما كان في نوبته', () => {
  it('⚠️ قبل النقل للأوّل، وبعده للثاني — ولا دفعةَ تُعدّ مرّتين', async () => {
    const [a, b, c] = [await advisor(), await advisor(), await client()]
    const k = await caseFor(c)
    await link(k, a, ago(30), { unassignedAt: ago(10) })
    await link(k, b, ago(10))
    await paid(c, 100, ago(20))
    await paid(c, 50, ago(5))
    expect(await attributedRevenue(prisma, a), 'قبض الأوّلُ بعد نقل طالبه').toBe(100)
    expect(await attributedRevenue(prisma, b), 'قبض الثاني ما قبل نوبته').toBe(50)
  })

  it('⚠️ وبالنقل الحقيقيّ (`assign`) — ما بعده للجديد وحدَه', async () => {
    const [a, b, c] = [await advisor(), await advisor(), await client()]
    const k = await caseFor(c)
    await link(k, a, ago(30))
    await paid(c, 70, ago(20))
    await advisors.assign(k, b, managerId)
    await paid(c, 30, new Date(Date.now() + 60_000))
    expect(await attributedRevenue(prisma, a)).toBe(70)
    expect(await attributedRevenue(prisma, b)).toBe(30)
  })

  it('⚠️ والنقلُ التلقائيّ: ما بين النقل وأوّلِ تواصلِ الجديد لا يُحسب لأحد', async () => {
    const [a, b, c] = [await advisor(), await advisor(), await client()]
    const k = await caseFor(c)
    await link(k, a, ago(30), { unassignedAt: ago(10) })
    await link(k, b, ago(10), { automatic: true })
    await paid(c, 40, ago(8))
    await prisma.contactEvent.create({ data: { caseId: k, channel: 'whatsapp', summary: 'أوّل تواصل', createdBy: b, createdAt: ago(6) } })
    await paid(c, 60, ago(3))
    expect(await attributedRevenue(prisma, a)).toBe(0)
    expect(await attributedRevenue(prisma, b)).toBe(60)
  })

  it('⚠️ وحالةٌ جديدةٌ لمستشارٍ آخر تُنهي نوبةَ من أُغلقت حالتُه بلا رفع', async () => {
    const [a, b, c] = [await advisor(), await advisor(), await client()]
    const old = await caseFor(c)
    await link(old, a, ago(40))
    await prisma.advisorCase.update({ where: { id: old }, data: { status: 'closed' } })
    await link(await caseFor(c), b, ago(10))
    await paid(c, 25, ago(15))
    await paid(c, 75, ago(5))
    expect(await attributedRevenue(prisma, a), 'إتمامُ العمل محا أجرَه — أو قبض بعد أن صار لغيره').toBe(25)
    expect(await attributedRevenue(prisma, b)).toBe(75)
  })

  it('⚠️ ونوبتان له على الطالب نفسِه لا تعدّان الدفعةَ مرّتين', async () => {
    const [a, c] = [await advisor(), await client()]
    await link(await caseFor(c), a, ago(30))
    await link(await caseFor(c), a, ago(20))
    await paid(c, 80, ago(5))
    expect(await attributedRevenue(prisma, a)).toBe(80)
  })

  it('⚠️ وإسنادٌ رُفع بلا بديل تنتهي نوبتُه عند رفعه', async () => {
    /* لا بابَ اليومَ يرفع إسنادا بلا بديل (`assign` يُنشئ أحدثَ منه) — والحارسُ لمن يبنيه غدا */
    const [a, c] = [await advisor(), await client()]
    await link(await caseFor(c), a, ago(30), { unassignedAt: ago(10) })
    await paid(c, 35, ago(5))
    expect(await attributedRevenue(prisma, a)).toBe(0)
  })

  it('⚠️ وإسنادُه الثاني للطالب نفسِه لا يقطع نوبتَه الأولى', async () => {
    /* حالةٌ ثانيةٌ أسندها النظامُ إليه ولم يتواصل فيها بعد — والأولى ما زالت له */
    const [a, c] = [await advisor(), await client()]
    await link(await caseFor(c), a, ago(30))
    await link(await caseFor(c), a, ago(20), { automatic: true })
    await paid(c, 45, ago(5))
    expect(await attributedRevenue(prisma, a)).toBe(45)
  })

  it('⚠️ ومن عاد إليه طالبُه تلقائيّا لا يفتح نوبتَه تواصلُه القديم — ما دُفع في نوبة غيره لغيره', async () => {
    const [a, b, c] = [await advisor(), await advisor(), await client()]
    const k = await caseFor(c)
    await link(k, a, ago(30), { unassignedAt: ago(20) })
    await prisma.contactEvent.create({ data: { caseId: k, channel: 'phone', summary: 'تواصل قديم', createdBy: a, createdAt: ago(25) } })
    await link(k, b, ago(20), { unassignedAt: ago(10) })
    await link(k, a, ago(10), { automatic: true })
    await paid(c, 15, ago(15))
    expect(await attributedRevenue(prisma, b)).toBe(15)
    expect(await attributedRevenue(prisma, a), 'قبض العائدُ ما دُفع في نوبة غيره').toBe(0)
  })

  it('والحالةُ المغلقةُ بلا نقلٍ تبقى نوبتُها مفتوحة', async () => {
    const [a, c] = [await advisor(), await client()]
    const k = await caseFor(c)
    await link(k, a, ago(30))
    await prisma.advisorCase.update({ where: { id: k }, data: { status: 'closed' } })
    await paid(c, 90, ago(2))
    expect(await attributedRevenue(prisma, a)).toBe(90)
  })
})
