/* ردُّ الدعم يصل صاحبَ التذكرة — في جرسه وبريده (٢٠ أكتوبر ٢٠٢٦).

   كان `replyAsAgent` يكتب الرسالةَ ولا يُخبِر أحدا: لا يرى المتعلّمُ الردَّ حتّى يفتح صفحةَ الدعم بنفسه.
   واختار صاحبُ المنصّة الجرسَ والبريدَ معا. فيُحرس هنا:

   ① الردُّ العلنيُّ يكتب صفَّين لصاحب التذكرة — جرسا وبريدا — بمفتاح `support.reply` وبابٍ إلى تذكرته.
   ② والملحوظةُ الداخليّةُ بين الفريق لا تُخبِر أحدا.
   ③ والردُّ الطويلُ يُنقل مقتطَفا — والكاملُ في صفحة الدعم. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { SupportService } from '../../services/support.service'

let prisma: PrismaClient
let support: SupportService
let ownerId = ''
let agentId = ''
let ticketId = ''

const rowsOf = (userId: string) => prisma.notification.findMany({
  where: { userId, templateKey: 'support.reply' }, orderBy: [{ channel: 'asc' }, { queuedAt: 'asc' }],
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  support = new SupportService(prisma)
  ownerId = (await auth.register('reply-owner@test.local', 'Owner#12345', 'صاحب السؤال')).userId
  agentId = (await auth.register('reply-agent@test.local', 'Agent#12345', 'وكيل الدعم')).userId
  await auth.setRoles(agentId, ['support'])
  ticketId = (await support.createTicket(ownerId, { subject: 'لا تفتح الدورة', body: 'تظهر صفحة بيضاء عند الفتح' })).id
}, 240_000)

describe('ردُّ الدعم يصل صاحبَ التذكرة', () => {
  it('⚠️ ② الملحوظةُ الداخليّةُ لا تُخبِر أحدا', async () => {
    await support.replyAsAgent(agentId, ticketId, 'ملحوظة للفريق: جرّب على متصفّح آخر', true)
    expect(await rowsOf(ownerId), 'أُخبِر المتعلّمُ بملحوظةٍ داخليّة').toEqual([])
  })

  it('⚠️ ① والردُّ العلنيُّ يصله جرسا وبريدا — وبابُه تذكرتُه', async () => {
    await support.replyAsAgent(agentId, ticketId, 'جرّب الآن بعد تحديث الصفحة — أصلحناها.')
    const rows = await rowsOf(ownerId)
    expect(rows.map((r) => r.channel)).toEqual(['email', 'in_app'])
    const bell = rows.find((r) => r.channel === 'in_app')!
    expect(bell.audience).toBe('learner')
    expect(bell.title).toContain('لا تفتح الدورة')
    expect(bell.body).toContain('أصلحناها')
    expect(bell.data).toMatchObject({ ticketId })
  })

  it('③ والطويلُ يُنقل مقتطَفا', async () => {
    await support.replyAsAgent(agentId, ticketId, 'س'.repeat(2_000))
    const bell = (await rowsOf(ownerId)).filter((r) => r.channel === 'in_app').at(-1)!
    expect(bell.body.length).toBeLessThanOrEqual(601)
    expect(bell.body.endsWith('…')).toBe(true)
  })
})
