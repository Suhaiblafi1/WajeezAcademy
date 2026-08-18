/* اختبار E2E لتذاكر الدعم:
   إنشاء برسالة أولى → إسناد لوكيل → رد داخلي مخفي عن العميل ورد علني →
   تحويلات حالة مشروعة فقط ومسجلة بسابق ولاحق → أولوية →
   العميل يرد ويعيد الفتح بعد الإغلاق. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { SupportService } from '../../services/support.service'

let prisma: PrismaClient
let support: SupportService
let userId: string
let agentId: string
let managerId: string
let ticketId: string

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  support = new SupportService(prisma)

  const u = await auth.register('sup-user@test.local', 'User#12345', 'صاحب التذكرة')
  userId = u.userId
  const a = await auth.register('sup-agent@test.local', 'Agent#12345', 'وكيل الدعم')
  agentId = a.userId
  await auth.setRoles(agentId, ['support'])
  const m = await auth.register('sup-manager@test.local', 'Manager#12345', 'مدير الدعم')
  managerId = m.userId
  await auth.setRoles(managerId, ['operations_manager'])
}, 240_000)

describe('دورة حياة تذكرة الدعم', () => {
  it('1) إنشاء تذكرة برسالة أولى وسجل حالة افتتاحي', async () => {
    const t = await support.createTicket(userId, { subject: 'لا أستطيع فتح التسجيل', category: 'تقني', body: 'تظهر صفحة بيضاء' })
    ticketId = t.id
    expect(t.status).toBe('open')
    const history = await prisma.ticketStatusHistory.findMany({ where: { ticketId } })
    expect(history.some((h) => h.toStatus === 'open')).toBe(true)
  })

  it('2) الإسناد لوكيل — والوكيل يجب أن يحمل دور support', async () => {
    await expect(support.assign(ticketId, userId, managerId))
      .rejects.toMatchObject({ code: 'not_agent' })
    await support.assign(ticketId, agentId, managerId)
    const list = await support.listTickets({ agentId })
    expect(list.some((t) => t.id === ticketId)).toBe(true)
  })

  it('3) رد داخلي لا يظهر للعميل والرد العلني يظهر', async () => {
    await support.replyAsAgent(agentId, ticketId, 'ملاحظة داخلية: تحقق من السجل', true)
    await support.replyAsAgent(agentId, ticketId, 'جارٍ التحقق من المشكلة', false)
    const mine = await support.myTickets(userId)
    const mineTicket = mine.find((t) => t.id === ticketId)!
    const bodies = mineTicket.messages.map((m) => m.body)
    expect(bodies).toContain('جارٍ التحقق من المشكلة')
    expect(bodies).not.toContain('ملاحظة داخلية: تحقق من السجل')
    const full = await support.ticketDetail(ticketId)
    expect(full.messages.some((m) => m.internal)).toBe(true)
  })

  it('4) تحويل غير مشروع مرفوض والمشروع مسجل بسابق ولاحق', async () => {
    await expect(support.transition(ticketId, 'reopened', agentId))
      .rejects.toMatchObject({ code: 'bad_transition' })
    await support.transition(ticketId, 'pending', agentId, 'بانتظار رد العميل')
    await support.transition(ticketId, 'resolved', agentId)
    const history = await prisma.ticketStatusHistory.findMany({ where: { ticketId, toStatus: 'resolved' } })
    expect(history[0]?.fromStatus).toBe('pending')
  })

  it('5) الأولوية تتغير وتوثق', async () => {
    await support.setPriority(ticketId, 'high', agentId)
    const t = await prisma.supportTicket.findUnique({ where: { id: ticketId } })
    expect(t?.priority).toBe('high')
  })

  it('6) العميل يرد ثم يعيد الفتح بعد الإغلاق', async () => {
    await support.replyAsOwner(userId, ticketId, 'جرّبت الحل ولم ينجح')
    await support.transition(ticketId, 'closed', agentId)
    const reopened = await support.reopenAsOwner(userId, ticketId, 'المشكلة ما زالت قائمة')
    expect(reopened.status).toBe('reopened')
  })
})
