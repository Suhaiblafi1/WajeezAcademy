/* لا تنتظر حالةٌ مستشارا لا يكلّمها (١٩ أكتوبر ٢٠٢٦) — قرارُ صاحب المنصّة: «a».

   ① **يومٌ بلا تواصلٍ مسجَّل = يُذكَّر المستشار** — مرّةً لكلّ إسناد، و«التواصل» ما سجّله هو بعد إسناده.
   ② **يومان = يُبلَّغ من يُسند، وتظهر الحالةُ في قائمته** — ولا تنتقل وحدَها.
   ③ **ومتابعةٌ حلّ موعدُها تُذكّر مستشارَ الحالة** — مرّةً، وقبل موعدها بدورة لا قبل ذلك.

   والوقتُ يُرجَع في الإسناد لا يُقدَّم في الساعة: كلُّ حالةٍ هنا تُختم في اختبارها، فلا تتسرّب
   إلى ما بعده. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorService } from '../../services/advisor.service'
import { runJob } from '../../worker/jobs'

let prisma: PrismaClient
let auth: AuthService
let advisors: AdvisorService
let managerId = ''
let advA = ''
let advB = ''

const HOUR = 3_600_000
let phoneSeq = 0
const nextPhone = () => `07940000${String(++phoneSeq).padStart(2, '0')}`

/** حالةٌ يُسندها إداريٌّ إلى `advisorId` — وإسنادُها كأنّه قبل `hoursAgo` ساعة */
async function caseWith(advisorId: string, hoursAgo: number, name = 'عميل ينتظر') {
  const phone = nextPhone()
  await advisors.requestContactAsGuest({ fullName: name, phone })
  const kase = await prisma.advisorCase.findFirstOrThrow({ where: { lead: { phone } } })
  await advisors.assign(kase.id, advisorId, managerId)
  await backdate(kase.id, hoursAgo)
  return kase
}
async function backdate(caseId: string, hoursAgo: number) {
  await prisma.advisorAssignment.updateMany({
    where: { caseId, unassignedAt: null }, data: { assignedAt: new Date(Date.now() - hoursAgo * HOUR) },
  })
}
/** أجراسُ مفتاحٍ لإنسانٍ عن حالةٍ بعينها */
async function bells(userId: string, templateKey: string, caseId: string) {
  const rows = await prisma.notification.findMany({ where: { userId, templateKey } })
  return rows.filter((n) => (n.data as { caseId?: string } | null)?.caseId === caseId).length
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  advisors = new AdvisorService(prisma)
  managerId = (await auth.register('remind-manager@test.local', 'Manager#12345', 'مدير العمليات')).userId
  await auth.setRoles(managerId, ['operations_manager'])
  advA = (await auth.register('remind-a@test.local', 'Advisor#12345', 'مستشار أ')).userId
  advB = (await auth.register('remind-b@test.local', 'Advisor#12345', 'مستشار ب')).userId
  for (const id of [advA, advB]) await auth.setRoles(id, ['advisor'])
  await prisma.user.updateMany({
    where: { roles: { some: { roleId: 'advisor' } }, id: { notIn: [advA, advB] } },
    data: { status: 'suspended' },
  })
}, 240_000)

describe('① يومٌ بلا تواصلٍ مسجَّل — يُذكَّر المستشار', () => {
  it('⚠️ بعد يومٍ يُذكَّر مرّةً — لا قبله، ولا مرّتين', async () => {
    const early = await caseWith(advA, 20)
    const due = await caseWith(advA, 25)
    await advisors.remindDue()
    await advisors.remindDue()
    expect(await bells(advA, 'advisor.case.no_contact', early.id), 'ذُكّر قبل يوم').toBe(0)
    expect(await bells(advA, 'advisor.case.no_contact', due.id), 'لم يُذكَّر — أو ذُكّر مرّتين').toBe(1)
  })

  it('⚠️ ومن سجّل تواصلا لا يُذكَّر — وتواصلُ من سبقه لا يُحسب له', async () => {
    const done = await caseWith(advA, 25)
    await advisors.addContactEvent(advA, done.id, { channel: 'whatsapp', summary: 'تواصلت معه' })

    const moved = await caseWith(advA, 30)
    await advisors.addContactEvent(advA, moved.id, { channel: 'whatsapp', summary: 'تواصل من سبقه' })
    await advisors.assign(moved.id, advB, managerId)
    await backdate(moved.id, 25)

    await advisors.remindDue()
    expect(await bells(advA, 'advisor.case.no_contact', done.id), 'ذُكّر من سجّل تواصله').toBe(0)
    expect(await bells(advB, 'advisor.case.no_contact', moved.id), 'حُسب له تواصلُ من سبقه').toBe(1)
  })

  it('⚠️ وما أدخله المستشارُ بنفسه لا يُذكَّر به — هو من جاء بالعميل', async () => {
    const own = await advisors.createOwnCase(advA, { fullName: 'عميل أحضره', phone: nextPhone() })
    await backdate(own.id, 25)
    await advisors.remindDue()
    expect(await bells(advA, 'advisor.case.no_contact', own.id)).toBe(0)
  })

  it('⚠️ وإسنادٌ أقدمُ من أسبوع لا جرسَ له — ويبقى في قائمة الإدارة', async () => {
    const old = await caseWith(advA, 8 * 24)
    await advisors.remindDue()
    expect(await bells(advA, 'advisor.case.no_contact', old.id), 'أوقظ الجرسُ بحالةٍ قديمة').toBe(0)
    expect(await bells(managerId, 'advisor.case.uncontacted', old.id)).toBe(0)
    expect((await advisors.listUncontacted()).some((c) => c.id === old.id), 'غابت القديمةُ عن القائمة').toBe(true)
  })
})

describe('② يومان بلا تواصل — يُبلَّغ من يُسند', () => {
  it('⚠️ لا يُبلَّغ قبل يومين — وبعدهما يُبلَّغ مرّةً وتظهر في القائمة', async () => {
    const day = await caseWith(advA, 25)
    await advisors.remindDue()
    expect(await bells(managerId, 'advisor.case.uncontacted', day.id), 'بُلّغت الإدارةُ بعد يومٍ واحد').toBe(0)
    expect((await advisors.listUncontacted()).some((c) => c.id === day.id)).toBe(false)

    const two = await caseWith(advA, 49)
    await advisors.remindDue()
    await advisors.remindDue()
    expect(await bells(managerId, 'advisor.case.uncontacted', two.id), 'لم تُبلَّغ — أو بُلّغت مرّتين').toBe(1)
    const row = (await advisors.listUncontacted()).find((c) => c.id === two.id)
    expect(row?.assignments[0]?.advisorId).toBe(advA)
    expect((await prisma.advisorAssignment.findFirst({ where: { caseId: two.id, unassignedAt: null } }))?.advisorId,
      'انتقلت الحالةُ وحدَها — والقرارُ أن تنتقل بيد إنسان').toBe(advA)

    await advisors.addContactEvent(advA, two.id, { channel: 'phone', summary: 'كلّمته أخيرا' })
    expect((await advisors.listUncontacted()).some((c) => c.id === two.id), 'بقيت في القائمة بعد التواصل').toBe(false)
  })

  it('⚠️ والموقوفُ لا يُذكَّر — وحالتُه تُبلَّغ لتُنقل', async () => {
    const kase = await caseWith(advB, 49)
    await prisma.user.update({ where: { id: advB }, data: { status: 'suspended' } })
    try {
      await advisors.remindDue()
      expect(await bells(advB, 'advisor.case.no_contact', kase.id), 'ذُكّر من لا يرى جرسه').toBe(0)
      expect(await bells(managerId, 'advisor.case.uncontacted', kase.id)).toBe(1)
    } finally {
      await prisma.user.update({ where: { id: advB }, data: { status: 'active' } })
    }
  })
})

describe('③ متابعةٌ حلّ موعدُها', () => {
  it('⚠️ تُذكّر مستشارَ الحالة مرّةً — وما بعد ساعتين لا يُذكَّر به بعد، ولا ما أُنجز', async () => {
    const kase = await caseWith(advA, 1)
    await advisors.addContactEvent(advA, kase.id, { channel: 'whatsapp', summary: 'أوّل تواصل' })
    const now = await advisors.addFollowUp(advA, kase.id, { scheduledAt: new Date(Date.now() + 5 * 60_000) })
    await advisors.addFollowUp(advA, kase.id, { scheduledAt: new Date(Date.now() + 2 * HOUR) })
    const done = await advisors.addFollowUp(advA, kase.id, { scheduledAt: new Date(Date.now() - 10 * 60_000) })
    await advisors.completeFollowUp(advA, done.id, 'reached')

    await advisors.remindDue()
    await advisors.remindDue()
    expect(await bells(advA, 'advisor.followup.due', kase.id), 'لم يُذكَّر — أو ذُكّر مرّتين أو بما لم يحن').toBe(1)
    expect((await prisma.followUp.findUniqueOrThrow({ where: { id: now.id } })).remindedAt).not.toBeNull()
  })

  it('ولمن صارت إليه الحالةُ لا لمن جدولها', async () => {
    const kase = await caseWith(advA, 1)
    await advisors.addFollowUp(advA, kase.id, { scheduledAt: new Date(Date.now() + 60_000) })
    await advisors.assign(kase.id, advB, managerId)
    await advisors.remindDue()
    expect(await bells(advB, 'advisor.followup.due', kase.id)).toBe(1)
    expect(await bells(advA, 'advisor.followup.due', kase.id)).toBe(0)
  })
})

describe('والعاملُ يشغّلها', () => {
  it('بوظيفةٍ لها خبرٌ عربيٌّ وأثر', async () => {
    await caseWith(advA, 26)
    const out = await runJob(prisma, 'advisor_reminders')
    expect(out.done).toBeGreaterThanOrEqual(1)
    expect(out.summaryAr).toContain('تذكير بالتواصل')
    expect(await prisma.auditEvent.findFirst({ where: { action: 'worker.advisor_reminders' } })).not.toBeNull()
  })
})
