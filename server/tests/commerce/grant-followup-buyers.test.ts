/* من اشترى لا يسدّ الطابورَ على من بعده (١٣ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة «Look past buyers»).

   `openGrantFollowups` يفتح حالةً عند مستشارٍ ومكالمةً لمن عبّأ نموذجَ المنحة ولم يشترِ. ومن اشترى يُتخطّى ولا تُفتح له
   حالة، فيبقى في أوّل الطابور أبدا. وكانت الدورةُ تقرأ أقدمَ مئتين وحدَهم: فإذا اشترى مئتان من الأوائل لم يُتّصل بعدهم
   بأحد. ويُصنع هنا مئتان وخمسةٌ أقدمُ ممّن اشتروا، وواحدٌ بعدهم لم يشترِ. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { GRANT_FOLLOWUP_HOURS, openGrantFollowups } from '../../services/grant-followup.service'
import { MEMBER_GRANT_SLUG } from '../../../src/application/commerce/grant'

let prisma: PrismaClient
const STAMP = Date.now()
const HOUR = 3_600_000

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 240_000)

describe('متابعة المنحة بعد المشترين', () => {
  it('⚠️ مئتان وخمسة اشتروا قبله — ومن لم يشتر بعدهم تفتح له حالته', async () => {
    const buyerEmail = `gfb-buyer-${STAMP}@test.local`
    const { userId } = await new AuthService(prisma).register(buyerEmail, 'Buyer#12345', 'مشتر')
    await prisma.order.create({ data: { userId, status: 'paid', subtotal: 10, total: 10, paidAt: new Date() } })

    /* أقدمُ من كلّ ما في القاعدة — فهم أوّلُ الطابور */
    const base = Date.UTC(2020, 0, 1)
    await prisma.lead.createMany({
      data: Array.from({ length: 205 }, (_, i) => ({
        fullName: `مشتر ${i}`, email: buyerEmail, source: 'campaign', campaign: MEMBER_GRANT_SLUG,
        createdAt: new Date(base + i * 1000),
      })),
    })
    const waiting = await prisma.lead.create({
      data: {
        fullName: 'لم يشتر', email: `gfb-waiting-${STAMP}@test.local`, source: 'campaign', campaign: MEMBER_GRANT_SLUG,
        createdAt: new Date(base + 300 * 1000),
      },
    })

    await openGrantFollowups(prisma, new Date(Date.now() + (GRANT_FOLLOWUP_HOURS + 1) * HOUR))

    expect(await prisma.advisorCase.count({ where: { leadId: waiting.id } }), 'سد المشترون الطابور فلم يتصل به أحد').toBe(1)
    expect(await prisma.advisorCase.count({ where: { lead: { email: buyerEmail } } }), 'فتحت حالة لمن اشترى').toBe(0)
  }, 120_000)
})
