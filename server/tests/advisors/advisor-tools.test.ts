/* أدواتُ الإدارة حول الطلبة والمستشارين (١٩ أكتوبر ٢٠٢٦) — قرارُ صاحب المنصّة: «do all».

   ① **من أنشأ حسابَه ولم يسجّل يظهر في قائمة الطلبة** — للإدارة وحدَها، ولا يظهر فيها موظّف.
   ② **يُبحث في كلّ حالةٍ مفتوحةٍ ويُغيَّر مستشارُها** — لا ما أُسند تلقائيّا وحدَه.
   ③ **وحالاتُ مستشارٍ غادر تُوزَّع على غيره** — المفتوحةُ وحدَها، لأقلّهم حالات.
   ④ **ولا مستشارَ نشطا = يُبلَّغ من يُسند** — مرّةً، لا مع كلّ حالة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorService } from '../../services/advisor.service'
import { LearnersService } from '../../services/learners.service'

let prisma: PrismaClient
let auth: AuthService
let advisors: AdvisorService
let learners: LearnersService
let managerId = ''
let advA = ''
let advB = ''
let advC = ''

let phoneSeq = 0
const nextPhone = () => `07930000${String(++phoneSeq).padStart(2, '0')}`
const activeOf = async (caseId: string) =>
  prisma.advisorAssignment.findFirst({ where: { caseId, unassignedAt: null } })

async function guestCase(name: string, email?: string) {
  const phone = nextPhone()
  await advisors.requestContactAsGuest({ fullName: name, phone, ...(email ? { email } : {}) })
  return prisma.advisorCase.findFirstOrThrow({ where: { lead: { phone } } })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  advisors = new AdvisorService(prisma)
  learners = new LearnersService(prisma)
  managerId = (await auth.register('tools-manager@test.local', 'Manager#12345', 'مدير العمليات')).userId
  await auth.setRoles(managerId, ['operations_manager'])
  advA = (await auth.register('tools-a@test.local', 'Advisor#12345', 'مستشار أ')).userId
  advB = (await auth.register('tools-b@test.local', 'Advisor#12345', 'مستشار ب')).userId
  advC = (await auth.register('tools-c@test.local', 'Advisor#12345', 'مستشار ج')).userId
  for (const id of [advA, advB, advC]) await auth.setRoles(id, ['advisor'])
  /* مستشارو البذر — إن وُجدوا — خارج القياس */
  await prisma.user.updateMany({
    where: { roles: { some: { roleId: 'advisor' } }, id: { notIn: [advA, advB, advC] } },
    data: { status: 'suspended' },
  })
}, 240_000)

describe('① من أنشأ حسابَه ولم يسجّل يظهر في قائمة الطلبة', () => {
  it('⚠️ يظهر للإدارة بلا شعب — ولا يظهر فيها موظّف', async () => {
    const { userId } = await auth.register('signed.only@test.local', 'Learner#12345', 'سجّل حسابا فقط')
    const all = await learners.list({ kind: 'all' })
    const row = all.find((r) => r.user.id === userId)
    expect(row, 'من أنشأ حسابه لا يظهر في قائمة الطلبة').toBeDefined()
    expect(row!.enrollments).toEqual([])
    expect(all.some((r) => r.user.id === advA), 'ظهر مستشارٌ بين الطلبة').toBe(false)
    expect(all.some((r) => r.user.id === managerId), 'ظهر موظّفٌ بين الطلبة').toBe(false)
  })

  it('⚠️ والبحثُ يجده باسمه — ولا يجده بحثٌ لا يطابقه', async () => {
    const hit = await learners.list({ kind: 'all' }, { q: 'سجّل حسابا' })
    expect(hit.some((r) => r.user.email === 'signed.only@test.local')).toBe(true)
    const miss = await learners.list({ kind: 'all' }, { q: 'لا-يطابق-أحدا' })
    expect(miss.some((r) => r.user.email === 'signed.only@test.local')).toBe(false)
  })

  it('ولا يظهر في نطاق المستشار — نطاقُه يُحرس بالتسجيلات', async () => {
    const mine = await learners.list({ kind: 'advisor', userId: advA })
    expect(mine.some((r) => r.user.email === 'signed.only@test.local')).toBe(false)
  })
})

describe('② يُبحث في كلّ حالةٍ مفتوحةٍ ويُغيَّر مستشارُها', () => {
  it('⚠️ بالاسم والبريد والرقم — ويُستثنى المغلق', async () => {
    const kase = await guestCase('عميل يبحث عنه', 'findme@test.local')
    await advisors.assign(kase.id, advA, managerId)
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: kase.leadId! } })

    for (const q of ['يبحث عنه', 'findme@', lead.phone!.slice(-5)]) {
      expect((await advisors.searchOpenCases(q)).some((c) => c.id === kase.id), `لم يُوجد بـ«${q}»`).toBe(true)
    }
    await prisma.advisorCase.update({ where: { id: kase.id }, data: { status: 'closed' } })
    expect((await advisors.searchOpenCases('يبحث عنه')).some((c) => c.id === kase.id), 'ظهرت حالةٌ مغلقة').toBe(false)
  })

  it('وبحثٌ أقصرُ من حرفين لا يعيد شيئا', async () => {
    expect(await advisors.searchOpenCases('ع')).toEqual([])
  })
})

describe('③ وحالاتُ مستشارٍ غادر تُوزَّع على غيره', () => {
  it('⚠️ المفتوحةُ تنتقل لأقلّ الآخرين حالاتٍ — والمغلقةُ تبقى له', async () => {
    const open1 = await guestCase('مفتوحة ١')
    const open2 = await guestCase('مفتوحة ٢')
    const closed = await guestCase('مغلقة')
    for (const c of [open1, open2, closed]) await advisors.assign(c.id, advA, managerId)
    await prisma.advisorCase.update({ where: { id: closed.id }, data: { status: 'closed' } })

    const out = await advisors.redistribute(advA, managerId)
    expect(out.moved).toBeGreaterThanOrEqual(2)
    for (const c of [open1, open2]) {
      const link = await activeOf(c.id)
      expect([advB, advC], 'بقيت حالةٌ مفتوحةٌ عند من غادر').toContain(link?.advisorId)
      expect(link?.automatic, 'عمولةُ المستشار الجديد تبدأ من يوم النقل لا من أوّل تواصل').toBe(true)
      expect(link?.assignedBy).toBe(managerId)
    }
    expect((await activeOf(open1.id))?.advisorId, 'أخذهما مستشارٌ واحدٌ — لا لأقلّهم حالات')
      .not.toBe((await activeOf(open2.id))?.advisorId)
    expect((await activeOf(closed.id))?.advisorId, 'نُقلت حالةٌ مغلقةٌ هي شاهدُ عمله').toBe(advA)
    expect(await prisma.auditEvent.findFirst({ where: { action: 'advisor.cases.redistribute', entityId: advA } })).not.toBeNull()
  })

  it('⚠️ ولا مستشارَ غيرُه نشطا — تبقى عنده ويُقال ذلك', async () => {
    const kase = await guestCase('لا بديل')
    await advisors.assign(kase.id, advA, managerId)
    await prisma.user.updateMany({ where: { id: { in: [advB, advC] } }, data: { status: 'suspended' } })
    try {
      const out = await advisors.redistribute(advA, managerId)
      expect(out.stayed).toBeGreaterThanOrEqual(1)
      expect((await activeOf(kase.id))?.advisorId).toBe(advA)
    } finally {
      await prisma.user.updateMany({ where: { id: { in: [advB, advC] } }, data: { status: 'active' } })
    }
  })

  it('والموقوفُ يُرى بحالاته ليُنقل ما عنده', async () => {
    await prisma.user.update({ where: { id: advC }, data: { status: 'suspended' } })
    try {
      const loads = await advisors.advisorLoads()
      expect(loads.find((l) => l.id === advC)?.status).toBe('suspended')
    } finally {
      await prisma.user.update({ where: { id: advC }, data: { status: 'active' } })
    }
  })
})

describe('④ ولا مستشارَ نشطا — يُبلَّغ من يُسند', () => {
  it('⚠️ حالةٌ لا يستلمها أحد تُبلغ من يملك الإسناد — مرّةً لا مع كلّ حالة', async () => {
    await prisma.user.updateMany({ where: { id: { in: [advA, advB, advC] } }, data: { status: 'suspended' } })
    try {
      await guestCase('بلا مستشار ١')
      await guestCase('بلا مستشار ٢')
      const bells = await prisma.notification.count({ where: { userId: managerId, templateKey: 'advisor.case.no_advisor' } })
      expect(bells, 'لم يُبلَّغ من يُسند — أو بُلّغ مع كلّ حالة').toBe(1)
    } finally {
      await prisma.user.updateMany({ where: { id: { in: [advA, advB, advC] } }, data: { status: 'active' } })
    }
  })

  it('ومع مستشارٍ نشطٍ لا جرس', async () => {
    await prisma.notification.deleteMany({ where: { templateKey: 'advisor.case.no_advisor' } })
    await guestCase('له مستشار')
    expect(await prisma.notification.count({ where: { templateKey: 'advisor.case.no_advisor' } })).toBe(0)
  })
})
