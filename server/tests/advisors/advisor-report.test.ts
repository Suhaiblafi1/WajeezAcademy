/* تقريرُ «أداء المستشار» (١٩ أكتوبر ٢٠٢٦) — قرارُ صاحب المنصّة: «A»، والعلّةُ في رأس التقرير.

   حالاتٌ بأوقاتٍ معروفة، فلكلّ عمودٍ جوابٌ يُحسب باليد: المفتوحة، ووسيطُ ساعات أوّل تواصل، ونسبةُ
   «خلال يوم» ممّا مرّ عليه يوم، وما بلا تواصل منذ يومين، ومن سجّل، ودفعاتُ طلابه وهم عنده وعمولتُه.
   وما أدخله بنفسه خارج السرعة، وتواصلُ غيره لا يُحسب له. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { ReportsService } from '../../services/reports.service'

let prisma: PrismaClient
let auth: AuthService
let reports: ReportsService
let managerId = ''
let advA = ''
let advB = ''
let seq = 0

const HOUR = 3_600_000
const hoursAgo = (h: number) => new Date(Date.now() - h * HOUR)

async function caseAt(advisorId: string, assignedHoursAgo: number, opts: { by?: string; status?: string; clientId?: string } = {}) {
  const lead = await prisma.lead.create({ data: { fullName: `عميل ${++seq}`, phone: `0796${String(200000 + seq)}` } })
  const kase = await prisma.advisorCase.create({
    data: { leadId: lead.id, status: opts.status ?? 'contacted', ...(opts.clientId ? { clientId: opts.clientId } : {}) },
  })
  await prisma.advisorAssignment.create({
    data: { caseId: kase.id, advisorId, assignedAt: hoursAgo(assignedHoursAgo), assignedBy: opts.by ?? managerId },
  })
  return kase.id
}
const contact = (caseId: string, by: string, hoursAgoAt: number) =>
  prisma.contactEvent.create({ data: { caseId, channel: 'whatsapp', summary: 'تواصل', createdBy: by, createdAt: hoursAgo(hoursAgoAt) } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  reports = new ReportsService(prisma)
  managerId = (await auth.register('report-manager@test.local', 'Manager#12345', 'مدير')).userId
  advA = (await auth.register('report-a@test.local', 'Advisor#12345', 'مستشار التقرير أ')).userId
  advB = (await auth.register('report-b@test.local', 'Advisor#12345', 'مستشار التقرير ب')).userId
  for (const id of [advA, advB]) await auth.setRoles(id, ['advisor'])
  await prisma.advisorProfile.create({ data: { userId: advA, commissionPct: 10 } })

  const { userId: buyer } = await auth.register('report-buyer@test.local', 'Client#12345', 'مشتري')
  const c1 = await caseAt(advA, 50, { status: 'enrolled', clientId: buyer })
  await contact(c1, advB, 49)                       // تواصلُ غيره لا يُحسب له
  await contact(c1, advA, 48)                       // ساعتان — خلال يوم
  const c2 = await caseAt(advA, 30)
  await contact(c2, advA, 2)                        // ٢٨ ساعة — بعد يوم
  await caseAt(advA, 60)                            // بلا تواصل منذ يومين ونصف
  const own = await caseAt(advA, 100, { by: advA }) // أدخله بنفسه — خارج السرعة
  await contact(own, advA, 1)
  const fresh = await caseAt(advA, 1)               // ساعةٌ واحدة — لم يمرّ عليها يوم
  await contact(fresh, advA, 0.5)                   // نصفُ ساعة
  await prisma.order.create({
    data: { userId: buyer, status: 'paid', subtotal: 200, total: 200, currency: 'USD', paidAt: hoursAgo(40), createdAt: hoursAgo(40) },
  })
}, 240_000)

describe('أداءُ المستشار', () => {
  it('⚠️ كلُّ عمودٍ بجوابه المحسوب باليد', async () => {
    const out = await reports.run('advisor-performance')
    const a = out.rows.find((r) => r.advisor === 'مستشار التقرير أ')
    expect(a).toMatchObject({
      state: 'نشط',
      openCases: 4,                 // اثنتان مسنَدتان + ما أدخله + الطازجة — والمسجَّلةُ خارجها
      medianHoursToContact: 2,      // وسيطُ [٢، ٢٨، ٠٫٥] — وما أدخله بنفسه خارجها
      contactedWithinDayPct: 33,    // واحدةٌ من ثلاثٍ مرّ عليها يوم
      waitingOver2Days: 1,
      enrolled: 1,
      revenueInTheirTime: 200,
      commissionOwed: 20,
    })
  })

  it('⚠️ ومن لا حالاتَ له ولا نسبةَ لا يُخترع له رقم', async () => {
    const out = await reports.run('advisor-performance')
    expect(out.rows.find((r) => r.advisor === 'مستشار التقرير ب')).toMatchObject({
      openCases: 0, medianHoursToContact: '—', contactedWithinDayPct: '—', waitingOver2Days: 0, commissionOwed: '—',
    })
  })

  it('وعناوينُ الأعمدة بالعربيّة', async () => {
    const out = await reports.run('advisor-performance')
    for (const k of ['openCases', 'medianHoursToContact', 'contactedWithinDayPct', 'waitingOver2Days', 'revenueInTheirTime', 'commissionOwed']) {
      expect(out.columnsAr[k], `«${k}» بلا عنوان`).not.toBe(k)
    }
  })
})
