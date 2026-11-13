/* حالةٌ بلا تواصلٍ منذ يومين يُبلَّغ عنها ولو كثُر الإسنادُ بعدها (١٣ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة «Read the whole window»).

   كان `remindDue` يقرأ أحدثَ مئتي إسنادٍ في نافذة الأيّام السبعة ثمّ يترك من تُوصِل معه. ففي يومٍ كثيرِ الإسناد —
   ومتابعةُ المنحة تفتح مئتي حالةٍ في الدورة — كانت أحدثُها تملأ المئتين، ولا يُقرأ ما بلغ يومين فلا يُبلَّغ عنه أحد.
   ويُصنع هنا إسنادٌ بلا تواصلٍ منذ خمسين ساعة، ومئتان وخمسةٌ أحدثُ منه تُوصِل معها. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeAdvisor } from '../helpers/advisor'
import { AuthService } from '../../services/auth.service'
import { AdvisorService } from '../../services/advisor.service'

let prisma: PrismaClient
let advisorId = ''
let managerId = ''
const STAMP = Date.now()
const HOUR = 3_600_000

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  managerId = (await auth.register(`uw-manager-${STAMP}@test.local`, 'Manager#12345', 'مدير')).userId
  await auth.setRoles(managerId, ['operations_manager'])
  advisorId = (await auth.register(`uw-advisor-${STAMP}@test.local`, 'Advisor#12345', 'مستشار مشغول')).userId
  await makeAdvisor(prisma, auth, advisorId)
}, 240_000)

const kase = (hoursAgo: number, contacted: boolean) => prisma.advisorCase.create({
  data: {
    assignments: { create: { advisorId, assignedBy: managerId, assignedAt: new Date(Date.now() - hoursAgo * HOUR) } },
    ...(contacted ? { contactEvents: { create: { channel: 'phone', summary: 'تواصلت', createdBy: advisorId } } } : {}),
  },
})

describe('التذكير والإبلاغ في يوم كثير الإسناد', () => {
  it('⚠️ مئتان وخمسة أحدث منه تواصل معها — والحالة المنسية منذ يومين يبلغ عنها', async () => {
    const forgotten = await kase(50, false)
    for (let i = 0; i < 205; i++) await kase(26 + (i % 20) * 0.5, true)

    await new AdvisorService(prisma).remindDue()

    const a = await prisma.advisorAssignment.findFirstOrThrow({ where: { caseId: forgotten.id } })
    expect(a.contactEscalatedAt, 'لم يبلغ عن حالة بلا تواصل منذ يومين').not.toBeNull()
    expect(a.contactRemindedAt, 'لم يذكر مستشارها').not.toBeNull()
  }, 120_000)
})
