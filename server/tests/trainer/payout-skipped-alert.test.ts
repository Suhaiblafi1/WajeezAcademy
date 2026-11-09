/* شعبةٌ اكتملت ولم يولد كشفُ مدرّبها — يُخبَر من يصرف (٩ نوفمبر ٢٠٢٦).

   كان التخطّي يُكتب في الأثر وحدَه (`trainer_payout.generate_skipped`)، ولا عاملَ يعيد التوليد: مدرّبٌ بلا قاعدة أتعاب
   تكتمل شعبتُه فلا يُدفع له ما لم يضغط أحدٌ «ولّد» صدفة. وجُرّب فمرّ: صفرُ كشوفٍ وصفرُ أجراس. فجرسٌ للماليّة والمدير
   الأكاديميّ والسوبر أدمن (`cohort.service.ts#transition`)، والشعبةُ التي وُلّد كشفُها لا جرسَ لها. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { EarningsService } from '../../services/earnings.service'
import { CohortService } from '../../services/cohort.service'
import { approvedPlanBy } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
const STAMP = Date.now()
const staff: Record<string, string> = {}

const bells = (role: string, cohortId: string) => prisma.notification.count({
  where: { userId: staff[role], templateKey: 'admin.payout_skipped', channel: 'in_app', data: { path: ['cohortId'], equals: cohortId } },
})

async function activeCohort(tag: string) {
  const user = await prisma.user.create({ data: { email: `skip-${tag}-${STAMP}@wajeez.test`, displayName: `مدرب ${tag}`, passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-SKIP-${tag}-${STAMP}`, fullName: `مدرب ${tag}`, email: user.email, status: 'active' },
  })
  const profileId = (await prisma.trainerProfile.create({ data: { userId: user.id, applicationId: application.id } })).id
  const courseId = (await prisma.course.findFirstOrThrow({ select: { id: true } })).id
  const cohort = await prisma.cohort.create({
    data: {
      plans: { create: approvedPlanBy(profileId) }, courseId, title: `شعبة التخطي ${tag}`,
      status: 'active', financialReady: true, price: 100, currency: 'USD', capacity: 20,
    } as never,
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId, role: 'lead', assignedBy: staff.finance } })
  return { profileId, cohortId: cohort.id }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  for (const role of ['super_admin', 'finance', 'academic_manager', 'support']) {
    staff[role] = (await auth.register(`skip-${role}-${STAMP}@test.local`, 'Staff#12345', `موظف ${role}`)).userId
    await auth.setRoles(staff[role], [role])
  }
}, 240_000)

describe('شعبة اكتملت بلا كشف', () => {
  it('⚠️ مدرب بلا قاعدة أتعاب: جرس لمن يصرف ويضبط الأجر — لا للدعم', async () => {
    const { profileId, cohortId } = await activeCohort('norule')
    await new CohortService(prisma).transition(cohortId, 'completed', staff.finance)

    expect(await prisma.trainerPayout.count({ where: { profileId } })).toBe(0)
    for (const role of ['super_admin', 'finance', 'academic_manager']) {
      expect(await bells(role, cohortId), `لم يصل ${role} أن الكشف لم يولد`).toBe(1)
    }
    expect(await bells('support', cohortId), 'وصل الدعمَ جرس المال').toBe(0)
  })

  it('وله قاعدة: يولد كشفه ولا جرس', async () => {
    const { profileId, cohortId } = await activeCohort('rule')
    await new EarningsService(prisma).setRule(staff.finance, { profileId, type: 'fixed_per_cohort', rate: 300 })
    await new CohortService(prisma).transition(cohortId, 'completed', staff.finance)

    expect(await prisma.trainerPayout.count({ where: { profileId } })).toBe(1)
    expect(await bells('finance', cohortId)).toBe(0)
  })
})
