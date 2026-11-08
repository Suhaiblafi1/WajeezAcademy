/* ردُّ صاحب التذكرة يعود إلى الفريق (٨ نوفمبر ٢٠٢٦) — والعلّةُ في `SupportService.replyAsOwner`.

   كان ردُّه على تذكرةٍ محلولةٍ يُكتب ولا يتغيّر شيء: تبقى «محلولة» فلا تظهر فيما ينتظر الفريق، ولا يتقدّم «آخرُ تحديث»،
   ولا يُخبَر أحد. فهنا:
   ① المحلولةُ تعود «أعيد فتحها» بسجلّ حالتها، وتعلو القائمة، ويُخبَر وكيلُها المسنَد وحدَه.
   ② وقيدُ المعالجة تعود «مفتوحة» — وبلا وكيلٍ يُخبَر الفريقُ كلُّه.
   ③ والمفتوحةُ تبقى مفتوحة — بلا سجلّ انتقالٍ لم يقع. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { SupportService } from '../../services/support.service'

let prisma: PrismaClient
let support: SupportService
let auth: AuthService
let learnerId = ''
let agentId = ''
let otherAgentId = ''
let managerId = ''

const bells = (userId: string) => prisma.notification.count({ where: { userId, templateKey: 'admin.support_reply', channel: 'in_app' } })
const ticket = async (subject: string) => (await support.createTicket(learnerId, { subject, body: 'لم يصلني الإيصال' })).id

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  support = new SupportService(prisma)
  learnerId = (await auth.register('or-learner@test.local', 'Learn#12345', 'صاحب التذكرة')).userId
  agentId = (await auth.register('or-agent@test.local', 'Agent#12345', 'وكيل مسند')).userId
  otherAgentId = (await auth.register('or-agent2@test.local', 'Agent#12345', 'وكيل آخر')).userId
  managerId = (await auth.register('or-manager@test.local', 'Manager#12345', 'مدير الأكاديمية')).userId
  await auth.setRoles(agentId, ['support'])
  await auth.setRoles(otherAgentId, ['support'])
  await auth.setRoles(managerId, ['academic_manager'])
}, 240_000)

describe('① المحلولة تعود إلى الفريق', () => {
  it('⚠️ «أعيد فتحها» بسجلها، وتعلو القائمة، ويخبر وكيلها وحده', async () => {
    const id = await ticket('مشكلة دفع')
    await support.assign(id, agentId, managerId)
    await support.replyAsAgent(agentId, id, 'أرسلناه، تأكد')
    await support.transition(id, 'resolved', agentId)
    const before = await prisma.supportTicket.findUniqueOrThrow({ where: { id } })
    const [mine, other] = [await bells(agentId), await bells(otherAgentId)]
    await new Promise((r) => setTimeout(r, 15))

    await support.replyAsOwner(learnerId, id, 'ما زال لم يصل، والمبلغ خصم مرتين')

    const after = await prisma.supportTicket.findUniqueOrThrow({ where: { id } })
    expect(after.status, 'بقيت «محلولة» فلا يراها الفريق').toBe('reopened')
    expect(after.updatedAt > before.updatedAt, 'لم تعل القائمة').toBe(true)
    expect(await prisma.ticketStatusHistory.count({ where: { ticketId: id, fromStatus: 'resolved', toStatus: 'reopened', changedBy: learnerId } })).toBe(1)
    expect(await bells(agentId) - mine, 'لم يخبر وكيلها').toBe(1)
    expect(await bells(otherAgentId) - other, 'أخبر من ليست له').toBe(0)
  })
})

describe('② وقيد المعالجة تعود مفتوحة', () => {
  it('⚠️ وبلا وكيل يخبر الفريق كله', async () => {
    const id = await ticket('لا أدخل الدرس')
    await support.transition(id, 'pending', agentId)
    const [a, b, m] = [await bells(agentId), await bells(otherAgentId), await bells(managerId)]
    await support.replyAsOwner(learnerId, id, 'جربت ولم ينجح')
    expect((await prisma.supportTicket.findUniqueOrThrow({ where: { id } })).status).toBe('open')
    expect([await bells(agentId) - a, await bells(otherAgentId) - b, await bells(managerId) - m], 'لم يخبر الفريق').toEqual([1, 1, 1])
  })
})

describe('③ والمفتوحة تبقى مفتوحة', () => {
  it('بلا سجل انتقال لم يقع — وتعلو القائمة', async () => {
    const id = await ticket('سؤال')
    const before = await prisma.supportTicket.findUniqueOrThrow({ where: { id } })
    await new Promise((r) => setTimeout(r, 15))
    await support.replyAsOwner(learnerId, id, 'وأضيف تفصيلا')
    const after = await prisma.supportTicket.findUniqueOrThrow({ where: { id } })
    expect(after.status).toBe('open')
    expect(after.updatedAt > before.updatedAt).toBe(true)
    expect(await prisma.ticketStatusHistory.count({ where: { ticketId: id } })).toBe(1)
  })
})
