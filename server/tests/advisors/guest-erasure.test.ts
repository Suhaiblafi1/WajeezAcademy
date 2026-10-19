/* بياناتُ من لم يسجّل تُمحى بعد ستة أشهر بلا نشاط (١٩ أكتوبر ٢٠٢٦) — قرارُ صاحب المنصّة: «B»،
   والعلّةُ في رأس `guest-erasure.service.ts`.

   ① **يُمحى اسمُه ورقمُه وبريدُه ونتيجتُه، وكلُّ نصٍّ حرٍّ في حالته، وأجراسُها** — وتُغلق.
   ② **ويبقى عددُه**: التواصلُ والإسنادُ صفوفٌ كما كانت.
   ③ **وكلُّ نشاطٍ في الستة أشهر يُبقيه** — صنفا صنفا.
   ④ **ومن له حسابٌ لا يُمسّ.**
   ⑤ **ودورتان معا لا تمحوان مرّتين** — والعاملُ يسجّل أثرَه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { eraseIdleGuests, ERASED_NAME_AR, ERASED_TEXT_AR } from '../../services/guest-erasure.service'
import { runJob } from '../../worker/jobs'

let prisma: PrismaClient
let auth: AuthService
let advisorId = ''
let seq = 0

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY)
const OLD = 200 // أكثرُ من ستة أشهر

/** زائرٌ ترك بياناتِه قبل `days` يوما، وحالتُه عند مستشار — وكلُّ ما فيها بعمرها */
async function guest(days = OLD, opts: { userId?: string; clientId?: string } = {}) {
  const n = ++seq
  const at = ago(days)
  const phone = `+96279${String(1000000 + n)}`
  const email = `guest-${n}@test.local`
  const lead = await prisma.lead.create({
    data: {
      fullName: `زائر ${n}`, phone, email, source: 'diagnostic', consentAr: 'بخصوص نتيجتك فقط',
      diagnosticSnapshot: { recommendation: { id: 'P-1' } }, createdAt: at, ...(opts.userId ? { userId: opts.userId } : {}),
    },
  })
  const kase = await prisma.advisorCase.create({
    data: {
      leadId: lead.id, status: 'contacted', nextAction: `اتصل بـ زائر ${n}`, diagnosticSnapshot: { recommendation: { id: 'P-1' } },
      createdAt: at, ...(opts.clientId ? { clientId: opts.clientId } : {}),
    },
  })
  await prisma.advisorAssignment.create({ data: { caseId: kase.id, advisorId, assignedAt: at } })
  await prisma.contactEvent.create({
    data: { caseId: kase.id, channel: 'in_app', direction: 'in', summary: `عاد يطلب — الاسم: زائر ${n} · واتساب: ${phone}`, createdAt: at },
  })
  await prisma.advisorNote.create({ data: { caseId: kase.id, authorId: advisorId, body: `رقمه الثاني ${phone}`, createdAt: at } })
  await prisma.followUp.create({ data: { caseId: kase.id, scheduledAt: at, note: `كلم زائر ${n}`, createdBy: advisorId, createdAt: at } })
  await prisma.advisorTask.create({ data: { caseId: kase.id, title: `أرسل لـ زائر ${n} الخطة`, createdAt: at } })
  await prisma.advisorRequest.create({ data: { caseId: kase.id, advisorId, kind: 'discount', percentOff: 10, reasonAr: `زائر ${n} طالب`, createdAt: at } })
  await prisma.$executeRaw`UPDATE "AdvisorRequest" SET "updatedAt" = ${at} WHERE "caseId" = ${kase.id}::uuid`
  await prisma.notification.create({
    data: { userId: advisorId, audience: 'staff', templateKey: 'advisor.case.assigned', title: `عميل جديد: زائر ${n}`, body: '', data: { caseId: kase.id }, queuedAt: at },
  })
  await age(kase.id, at)
  return { leadId: lead.id, caseId: kase.id, phone, email }
}
/** `updatedAt` يضعه Prisma بنفسه — فيُعاد إلى عمر الحالة بيدٍ */
const age = (caseId: string, at: Date) =>
  prisma.$executeRaw`UPDATE "AdvisorCase" SET "updatedAt" = ${at} WHERE id = ${caseId}::uuid`
const lead = (id: string) => prisma.lead.findUniqueOrThrow({ where: { id } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  advisorId = (await auth.register('erase-advisor@test.local', 'Advisor#12345', 'مستشار المحو')).userId
  await auth.setRoles(advisorId, ['advisor'])
}, 240_000)

describe('① يُمحى ما يدلّ عليه — وتُغلق حالتُه', () => {
  it('⚠️ الاسمُ والرقمُ والبريدُ والنتيجة، والنصُّ الحرّ، والأجراس', async () => {
    const g = await guest()
    await eraseIdleGuests(prisma)

    const l = await lead(g.leadId)
    expect(l).toMatchObject({ fullName: ERASED_NAME_AR, phone: null, email: null, diagnosticSnapshot: null })
    expect(l.erasedAt).not.toBeNull()

    const k = await prisma.advisorCase.findUniqueOrThrow({
      where: { id: g.caseId }, include: { contactEvents: true, notes: true, followUps: true, tasks: true, requests: true },
    })
    expect(k).toMatchObject({ status: 'closed', diagnosticSnapshot: null, nextAction: null })
    expect(k.contactEvents.map((e) => e.summary)).toEqual([ERASED_TEXT_AR])
    expect(k.notes.map((n) => n.body)).toEqual([ERASED_TEXT_AR])
    expect(k.followUps.map((f) => f.note)).toEqual([null])
    expect(k.tasks.map((t) => t.title)).toEqual([ERASED_TEXT_AR])
    expect(k.requests.map((r) => r.reasonAr)).toEqual([ERASED_TEXT_AR])

    const bells = await prisma.notification.findMany({ where: { data: { path: ['caseId'], equals: g.caseId } } })
    expect(bells, 'بقي جرسٌ في عنوانه اسمُه').toHaveLength(0)
    expect(await prisma.auditEvent.count({ where: { action: 'advisor.case.guest_erased', entityId: g.caseId } })).toBe(1)
  })

  it('⚠️ وما يبقى من اسمه ورقمه في أيّ موضعٍ من حالته لا شيء', async () => {
    const g = await guest()
    await eraseIdleGuests(prisma)
    const k = await prisma.advisorCase.findUniqueOrThrow({
      where: { id: g.caseId }, include: { lead: true, contactEvents: true, notes: true, followUps: true, tasks: true, requests: true },
    })
    const all = JSON.stringify(k)
    expect(all.includes(g.phone), 'بقي رقمُه').toBe(false)
    expect(all.includes(g.email), 'بقي بريدُه').toBe(false)
    expect(/زائر \d/.test(all), 'بقي اسمُه').toBe(false)
  })
})

describe('② ويبقى عددُه', () => {
  it('⚠️ التواصلُ والإسنادُ صفوفٌ كما كانت', async () => {
    const g = await guest()
    await eraseIdleGuests(prisma)
    expect(await prisma.contactEvent.count({ where: { caseId: g.caseId } })).toBe(1)
    expect(await prisma.advisorAssignment.count({ where: { caseId: g.caseId, advisorId } })).toBe(1)
  })
})

describe('③ كلُّ نشاطٍ في الستة أشهر يُبقيه', () => {
  const recent = ago(10)
  const kinds: [string, (caseId: string) => Promise<unknown>][] = [
    ['تواصلٌ سُجّل', (caseId) => prisma.contactEvent.create({ data: { caseId, channel: 'whatsapp', summary: 'تواصل', createdAt: recent } })],
    ['ملاحظة', (caseId) => prisma.advisorNote.create({ data: { caseId, body: 'ملاحظة', createdAt: recent } })],
    ['متابعةٌ مجدولةٌ بعدُ', (caseId) => prisma.followUp.create({ data: { caseId, scheduledAt: new Date(Date.now() + 30 * DAY), createdAt: ago(OLD) } })],
    ['مهمّة', (caseId) => prisma.advisorTask.create({ data: { caseId, title: 'مهمة', createdAt: recent } })],
    ['طلب', (caseId) => prisma.advisorRequest.create({ data: { caseId, advisorId, kind: 'discount', percentOff: 10, reasonAr: 'سبب', updatedAt: recent } })],
    ['إسنادٌ لمستشار', (caseId) => prisma.advisorAssignment.create({ data: { caseId, advisorId, assignedAt: recent } })],
    ['موعدُ متابعةٍ في الحالة', (caseId) => prisma.advisorCase.update({ where: { id: caseId }, data: { nextFollowUpAt: new Date(Date.now() + DAY) } })],
    ['تغيّرت الحالة', (caseId) => age(caseId, recent)],
  ]
  it.each(kinds)('⚠️ %s', async (_label, act) => {
    const g = await guest()
    await act(g.caseId)
    if (_label !== 'تغيّرت الحالة') await age(g.caseId, ago(OLD))
    await eraseIdleGuests(prisma)
    expect((await lead(g.leadId)).phone, `مُحي وفي حالته ${_label}`).toBe(g.phone)
  })

  it('⚠️ والأجلُ من ولادته إن لم يكن في حالته شيء — خمسةُ أشهرٍ تبقى، وسبعةٌ تُمحى', async () => {
    const bare = (days: number) => prisma.lead.create({ data: { fullName: 'بلا حالة', phone: `+96278${String(1000000 + ++seq)}`, createdAt: ago(days) } })
    const young = await bare(150)
    const old = await bare(OLD)
    await eraseIdleGuests(prisma)
    expect((await lead(young.id)).phone, 'مُحي قبل ستة أشهر').toBe(young.phone)
    expect((await lead(old.id)).phone, 'بقي بعد ستة أشهر').toBeNull()
  })
})

describe('④ من له حسابٌ لا يُمسّ', () => {
  it('⚠️ عميلٌ محتملٌ مربوطٌ بحساب، أو حالتُه لصاحب حساب', async () => {
    const { userId } = await auth.register('erase-owner@test.local', 'Client#12345', 'صاحب حساب')
    const linked = await guest(OLD, { userId })
    const { userId: client } = await auth.register('erase-client@test.local', 'Client#12345', 'عميل بحساب')
    const owned = await guest(OLD, { clientId: client })
    await eraseIdleGuests(prisma)
    expect((await lead(linked.leadId)).phone, 'مُحي من له حساب').toBe(linked.phone)
    expect((await lead(owned.leadId)).phone, 'مُحي من حالتُه لصاحب حساب').toBe(owned.phone)
  })
})

describe('⑤ دورتان معا، والعامل', () => {
  it('⚠️ لا تمحوان مرّتين', async () => {
    const g = await guest()
    await Promise.all([eraseIdleGuests(prisma), eraseIdleGuests(prisma)])
    expect(await prisma.auditEvent.count({ where: { action: 'advisor.case.guest_erased', entityId: g.caseId } })).toBe(1)
  })

  it('والعاملُ يمحو ويسجّل أثرَه — والدورةُ التالية لا تجد شيئا', async () => {
    const g = await guest()
    const out = await runJob(prisma, 'erase_idle_guests')
    expect(out.done).toBeGreaterThanOrEqual(1)
    expect((await lead(g.leadId)).erasedAt).not.toBeNull()
    expect(await prisma.auditEvent.findFirst({ where: { action: 'worker.erase_idle_guests' } })).not.toBeNull()
    expect((await runJob(prisma, 'erase_idle_guests')).done).toBe(0)
  })
})
