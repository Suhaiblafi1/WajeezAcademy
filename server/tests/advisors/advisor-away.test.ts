/* إجازةُ المستشار ومن يغطّيه فيها (١٩ أكتوبر ٢٠٢٦) — قرارُ صاحب المنصّة: «B»، والعلّةُ في رأس
   `advisor-away.service.ts`.

   ① **لا يُسند إليه في إجازته** — وقبلها يُسند كما كان.
   ② **ومن ينتظر أوّلَ تواصلٍ منه يُنقل** — ومن تواصل معه يبقى، وما أُسند إليه في إجازته يبقى، والمغلقةُ تبقى.
   ③ **وإجازةٌ تبدأ الآن تُغطّى ساعتَها** — لا بعد ربع ساعة.
   ④ **ولا تُكتب إجازةٌ نهايتُها قبل بدايتها، ولا منقضية، ولا أطولُ من حدّها، ولا لغير مستشار.**
   ⑤ **ولا أحدَ يغطّيه = تبقى عنده.**
   ⑥ **والعاملُ يغطّي مع التذكيرات — ويُكتب الأثر.**
   ⑦ **ومن يوزّع يرى من في إجازته.** */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorService } from '../../services/advisor.service'
import { AdvisorAwayService, MAX_AWAY_DAYS } from '../../services/advisor-away.service'
import { runJob } from '../../worker/jobs'

let prisma: PrismaClient
let auth: AuthService
let advisors: AdvisorService
let away: AdvisorAwayService
let managerId = ''
let seq = 0

const HOUR = 3_600_000
const DAY = 24 * HOUR
const at = (ms: number) => new Date(Date.now() + ms)

async function advisor() {
  const { userId } = await auth.register(`away-adv-${++seq}@test.local`, 'Advisor#12345', `مستشار الإجازة ${seq}`)
  await auth.setRoles(userId, ['advisor'])
  return userId
}
/** حالةٌ عند `advisorId` أُسندت قبل `daysAgo` يوما */
async function caseOf(advisorId: string, daysAgo = 3, status = 'new') {
  const lead = await prisma.lead.create({ data: { fullName: `طالب ${++seq}`, phone: `0797${String(300000 + seq)}` } })
  const kase = await prisma.advisorCase.create({ data: { leadId: lead.id, status } })
  await prisma.advisorAssignment.create({ data: { caseId: kase.id, advisorId, assignedAt: at(-daysAgo * DAY), assignedBy: managerId } })
  return kase.id
}
const holder = async (caseId: string) =>
  (await prisma.advisorAssignment.findFirst({ where: { caseId, unassignedAt: null } }))?.advisorId
const goAway = (advisorId: string, fromMs: number, untilMs: number) =>
  prisma.advisorProfile.upsert({
    where: { userId: advisorId },
    create: { userId: advisorId, awayFrom: at(fromMs), awayUntil: at(untilMs) },
    update: { awayFrom: at(fromMs), awayUntil: at(untilMs) },
  })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  advisors = new AdvisorService(prisma)
  away = new AdvisorAwayService(prisma)
  managerId = (await auth.register('away-manager@test.local', 'Manager#12345', 'مدير')).userId
  await auth.setRoles(managerId, ['operations_manager'])
}, 240_000)

describe('① لا يُسند إليه في إجازته', () => {
  it('⚠️ في إجازته يتخطّاه الإسنادُ التلقائيّ — وإجازتُه القادمةُ لا تمنعه اليوم', async () => {
    const a = await advisor()
    await advisor()
    await goAway(a, -HOUR, 5 * DAY)
    for (let i = 0; i < 4; i++) {
      const lead = await prisma.lead.create({ data: { fullName: `جديد ${++seq}` } })
      const k = await prisma.advisorCase.create({ data: { leadId: lead.id } })
      expect(await advisors.autoAssign(k.id), 'أُسند إلى من في إجازته').not.toBe(a)
    }

    /* وغيرُه مستثنون — فلا يُختبر إلّا أهو متاحٌ أم لا، لا من أقلُّهم حالاتٍ في قاعدةٍ قد يشاركها غيرُ هذا الملفّ */
    const b = await advisor()
    await goAway(b, 2 * DAY, 5 * DAY)
    const others = (await prisma.user.findMany({ where: { id: { not: b }, roles: { some: { roleId: 'advisor' } } }, select: { id: true } })).map((u) => u.id)
    const lead = await prisma.lead.create({ data: { fullName: `جديد ${++seq}` } })
    const k = await prisma.advisorCase.create({ data: { leadId: lead.id } })
    expect(await advisors.autoAssign(k.id, { exclude: others }), 'منعته إجازةٌ لم تبدأ').toBe(b)
    await goAway(b, -HOUR, 5 * DAY)
    const lead2 = await prisma.lead.create({ data: { fullName: `جديد ${++seq}` } })
    const k2 = await prisma.advisorCase.create({ data: { leadId: lead2.id } })
    expect(await advisors.autoAssign(k2.id, { exclude: others }), 'أُسند إليه في إجازته').toBeNull()
  })
})

describe('② من ينتظر أوّلَ تواصلٍ منه يُنقل', () => {
  it('⚠️ ينتظر فيُنقل — وتواصل فيبقى، وأُسند في إجازته فيبقى، ومغلقٌ فيبقى', async () => {
    const a = await advisor()
    await advisor()
    const waiting = await caseOf(a)
    const talked = await caseOf(a)
    await prisma.contactEvent.create({ data: { caseId: talked, channel: 'whatsapp', summary: 'تواصل', createdBy: a, createdAt: at(-2 * DAY) } })
    const closed = await caseOf(a, 3, 'closed')
    await goAway(a, -HOUR, 5 * DAY)
    const duringLeave = await caseOf(a, 0)

    await away.coverAway()
    const moved = await holder(waiting)
    expect(moved, 'بقي من ينتظر عند الغائب').not.toBe(a)
    expect(moved).toBeTruthy()
    expect(await holder(talked), 'نُقل من تواصل معه').toBe(a)
    expect(await holder(duringLeave), 'نُقل ما أسنده إداريٌّ في إجازته').toBe(a)
    expect(await holder(closed)).toBe(a)
    const link = await prisma.advisorAssignment.findFirstOrThrow({ where: { caseId: waiting, unassignedAt: null } })
    expect(link.automatic, 'عمولةُ من غطّاه لا تبدأ إلّا بتواصل').toBe(true)
    expect(await prisma.auditEvent.count({ where: { action: 'advisor.case.away_cover', entityId: waiting } })).toBe(1)
  })
})

describe('③ إجازةٌ تبدأ الآن تُغطّى ساعتَها', () => {
  it('⚠️ ومن ينتظر يُنقل ساعةَ تُكتب — وإجازةٌ قادمةٌ لا تنقل شيئا بعدُ', async () => {
    const a = await advisor()
    await advisor()
    const waiting = await caseOf(a)
    const later = await away.set(a, { from: at(DAY), until: at(3 * DAY) }, a)
    expect(later.moved).toBe(0)
    expect(await holder(waiting)).toBe(a)
    const now = await away.set(a, { from: at(-HOUR), until: at(3 * DAY) }, a)
    expect(now.moved).toBe(1)
    expect(await holder(waiting)).not.toBe(a)
    expect(await prisma.auditEvent.count({ where: { action: 'advisor.away.set', entityId: a } })).toBe(2)
  })
})

describe('④ ما لا يُكتب', () => {
  it('⚠️ نهايتُها قبل بدايتها، ومنقضية، وأطولُ من حدّها، ولغير مستشار', async () => {
    const a = await advisor()
    await expect(away.set(a, { from: at(2 * DAY), until: at(DAY) }, a)).rejects.toMatchObject({ code: 'bad_dates' })
    await expect(away.set(a, { from: at(-3 * DAY), until: at(-DAY) }, a)).rejects.toMatchObject({ code: 'bad_dates' })
    await expect(away.set(a, { from: at(0), until: at((MAX_AWAY_DAYS + 1) * DAY) }, a)).rejects.toMatchObject({ code: 'bad_dates' })
    await expect(away.set(managerId, { from: at(0), until: at(DAY) }, managerId)).rejects.toMatchObject({ code: 'not_advisor' })
    expect((await away.get(a)).away).toBeNull()
  })

  it('والإلغاءُ يمحوها ويُكتب', async () => {
    const a = await advisor()
    await away.set(a, { from: at(DAY), until: at(2 * DAY) }, managerId)
    expect((await away.get(a)).away).not.toBeNull()
    await away.clear(a, managerId)
    expect((await away.get(a)).away).toBeNull()
    expect(await prisma.auditEvent.count({ where: { action: 'advisor.away.clear', entityId: a } })).toBe(1)
  })
})

describe('⑤ ولا أحدَ يغطّيه', () => {
  it('⚠️ تبقى عنده — لا تُرفع إلى لا أحد', async () => {
    const a = await advisor()
    const waiting = await caseOf(a)
    /* كلُّ مستشارٍ غيرُه يوقَف لهذا الاختبار وحدَه — ثمّ يعود */
    const others = (await prisma.user.findMany({
      where: { id: { not: a }, status: 'active', roles: { some: { roleId: 'advisor' } } }, select: { id: true },
    })).map((u) => u.id)
    await prisma.user.updateMany({ where: { id: { in: others } }, data: { status: 'suspended' } })
    try {
      await goAway(a, -HOUR, DAY)
      expect(await away.coverAway()).toMatchObject({ moved: 0, stayed: 1 })
      expect(await holder(waiting)).toBe(a)
    } finally {
      await prisma.user.updateMany({ where: { id: { in: others } }, data: { status: 'active' } })
    }
  })
})

describe('⑥ والعامل', () => {
  it('⚠️ يغطّي مع التذكيرات', async () => {
    const a = await advisor()
    await advisor()
    const waiting = await caseOf(a)
    await goAway(a, -HOUR, DAY)
    await runJob(prisma, 'advisor_reminders')
    expect(await holder(waiting), 'لم يغطّه العامل').not.toBe(a)
  })
})

describe('⑦ ومن يوزّع يرى من في إجازته', () => {
  it('⚠️ في قائمة الإسناد وفي حِمل المستشارين', async () => {
    const a = await advisor()
    await goAway(a, -HOUR, DAY)
    const row = (await advisors.assignableAdvisors()).find((x) => x.id === a)
    expect(row?.awayUntil, 'لم يُقل إنّه في إجازة').not.toBeNull()
    expect((await advisors.advisorLoads()).find((x) => x.id === a)?.away).not.toBeNull()
  })
})
