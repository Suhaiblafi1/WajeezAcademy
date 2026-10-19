/* الطالبُ يعرف مستشارَه (١٩ أكتوبر ٢٠٢٦) — قرارُ صاحب المنصّة: «a»، والعلّةُ في `advisor-message.ts`.

   المستشارُ صاحبُ الإسناد النشط على حالة الطالب — والمسجَّلةُ منها معها. لا من نُقلت عنه، ولا
   الموقوف، ولا حالةٌ مغلقةٌ أو «غير مهتمّ»، ولا حالةُ غيره. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorService } from '../../services/advisor.service'

let prisma: PrismaClient
let auth: AuthService
let advisors: AdvisorService
let managerId = ''
let advA = ''
let advB = ''
let seq = 0

/** طالبٌ أنهى التشخيص فصارت له حالة — يُسندها إداريٌّ إلى `advisorId` */
async function learnerWithAdvisor(advisorId: string) {
  const { userId } = await auth.register(`my-advisor-${++seq}@test.local`, 'Learner#12345', `طالب ${seq}`)
  const { case: kase } = await advisors.attachDiagnostic(userId, { top: { id: 'PW-X', name: 'مسار' } })
  await advisors.assign(kase!.id, advisorId, managerId)
  return { userId, caseId: kase!.id }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  advisors = new AdvisorService(prisma)
  managerId = (await auth.register('my-advisor-manager@test.local', 'Manager#12345', 'مدير')).userId
  await auth.setRoles(managerId, ['operations_manager'])
  advA = (await auth.register('my-advisor-a@test.local', 'Advisor#12345', 'سارة المستشارة')).userId
  advB = (await auth.register('my-advisor-b@test.local', 'Advisor#12345', 'خالد المستشار')).userId
  for (const id of [advA, advB]) await auth.setRoles(id, ['advisor'])
}, 240_000)

describe('مستشارُ الطالب', () => {
  it('⚠️ صاحبُ الإسناد النشط — وبعد النقل المستشارُ الجديد', async () => {
    const { userId, caseId } = await learnerWithAdvisor(advA)
    expect(await advisors.myAdvisorOf(userId)).toEqual({ displayName: 'سارة المستشارة' })
    await advisors.assign(caseId, advB, managerId)
    expect(await advisors.myAdvisorOf(userId), 'بقي اسمُ من نُقلت عنه').toEqual({ displayName: 'خالد المستشار' })
  })

  it('⚠️ وإسنادٌ رُفع بلا بديل لا يُقال اسمُ صاحبه', async () => {
    /* لا بابَ اليومَ يرفع إسنادا بلا بديل (`assign` يُنشئ أحدثَ منه) — والحارسُ لمن يبنيه غدا */
    const { userId, caseId } = await learnerWithAdvisor(advA)
    await prisma.advisorAssignment.updateMany({ where: { caseId, unassignedAt: null }, data: { unassignedAt: new Date() } })
    expect(await advisors.myAdvisorOf(userId), 'قيل اسمُ من رُفع إسنادُه').toBeNull()
  })

  it('⚠️ ولا يرى طالبٌ مستشارَ غيره', async () => {
    await learnerWithAdvisor(advA)
    const { userId: other } = await auth.register('my-advisor-none@test.local', 'Learner#12345', 'بلا حالة')
    expect(await advisors.myAdvisorOf(other)).toBeNull()
  })

  it('⚠️ والمسجَّلُ يبقى له مستشارُه — والمغلقةُ و«غير مهتمّ» لا', async () => {
    const enrolled = await learnerWithAdvisor(advA)
    await prisma.advisorCase.update({ where: { id: enrolled.caseId }, data: { status: 'enrolled' } })
    expect(await advisors.myAdvisorOf(enrolled.userId), 'سقط مستشارُ من سجّل').not.toBeNull()

    for (const status of ['closed', 'not_interested']) {
      const done = await learnerWithAdvisor(advA)
      await prisma.advisorCase.update({ where: { id: done.caseId }, data: { status } })
      expect(await advisors.myAdvisorOf(done.userId), `ظهر مستشارُ حالةٍ «${status}»`).toBeNull()
    }
  })

  it('⚠️ والموقوفُ لا يُقال اسمُه — يُرسَل إليه ما لن يقرأه', async () => {
    const { userId } = await learnerWithAdvisor(advB)
    await prisma.user.update({ where: { id: advB }, data: { status: 'suspended' } })
    try {
      expect(await advisors.myAdvisorOf(userId)).toBeNull()
    } finally {
      await prisma.user.update({ where: { id: advB }, data: { status: 'active' } })
    }
  })

  it('وحالتُه بعميله المحتمل وحدَه تُقرأ أيضا', async () => {
    const { userId, caseId } = await learnerWithAdvisor(advA)
    await prisma.advisorCase.update({ where: { id: caseId }, data: { clientId: null } })
    expect(await advisors.myAdvisorOf(userId)).toEqual({ displayName: 'سارة المستشارة' })
  })
})
