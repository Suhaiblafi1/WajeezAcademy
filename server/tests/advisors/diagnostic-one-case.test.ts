/* إرفاقُ التشخيص لا يفتح حالةً ثانيةً لمن له حالة (١٠ نوفمبر ٢٠٢٦).

   كانت الحالةُ تُطلب عبر أوّل عميلٍ محتملٍ للمتعلّم وحدَه. وللمتعلّم أكثرُ من عميل — نموذجُ المنحة، والشراءُ، وواتساب —
   فإن وقع على عميلٍ بلا حالةٍ فُتحت ثانيةٌ عند مستشارٍ ثانٍ. والعلّةُ في `AdvisorService.attachDiagnostic`. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorService } from '../../services/advisor.service'

let prisma: PrismaClient
let auth: AuthService
let advisors: AdvisorService
const STAMP = Date.now()

const openCases = (userId: string) => prisma.advisorCase.findMany({
  where: { status: { notIn: ['closed', 'enrolled', 'not_interested'] }, OR: [{ clientId: userId }, { lead: { userId } }] },
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  advisors = new AdvisorService(prisma)
}, 240_000)

describe('التشخيص وحالة المستشار', () => {
  it('⚠️ متعلم له عميلان — نموذج منحة بلا حالة، وشراء بحالة: يرفق التشخيص بحالته ولا يفتح ثانية', async () => {
    const userId = (await auth.register(`diag-one-${STAMP}@test.local`, 'Learner#12345', 'متعلم التشخيص')).userId
    /* عميلُ نموذج المنحة — أقدم، ولُحق بحسابه، ولا حالةَ له */
    await prisma.lead.create({
      data: { fullName: 'متعلم التشخيص', email: `diag-one-${STAMP}@test.local`, source: 'campaign', userId, createdAt: new Date(Date.now() - 86_400_000) },
    })
    const buyerCase = await advisors.ensureBuyerCase(userId)
    expect(await openCases(userId)).toHaveLength(1)

    await advisors.attachDiagnostic(userId, { pathwayId: 'P-HR', confidence: 0.8 })
    const after = await openCases(userId)
    expect(after, 'فتحت حالة ثانية لمتعلم له حالة').toHaveLength(1)
    expect(after[0].id).toBe(buyerCase)
    expect(after[0].diagnosticSnapshot, 'لم تصل نتيجته حالته').toMatchObject({ pathwayId: 'P-HR' })
  })

  it('ومن لا حالة له تفتح له واحدة كما كانت', async () => {
    const userId = (await auth.register(`diag-new-${STAMP}@test.local`, 'Learner#12345', 'متعلم جديد')).userId
    await advisors.attachDiagnostic(userId, { pathwayId: 'P-FIN' })
    expect(await openCases(userId)).toHaveLength(1)
    await advisors.attachDiagnostic(userId, { pathwayId: 'P-FIN' })
    expect(await openCases(userId), 'فتح التشخيص الثاني حالة ثانية').toHaveLength(1)
  })
})
