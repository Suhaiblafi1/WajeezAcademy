/* ═══ المعتمَدةُ خلف المراجعة — ليُقرأ ما تغيّر عنها (٣ج-٤) ═══

   بعد الاعتماد يُنشئ حفظُ المدرّب صفَّ خطّةٍ جديدا، ويبقى المعتمَدُ نافذا حتّى
   تُعتمَد المراجعة. فتُعاد المعتمَدةُ مع المراجعة — في بطاقة المعتمِد وورشة
   المدرّب — ومنها تقرأ الشاشتان «ما تغيّر» (`plan-diff.ts`). ولا تُعاد حين تكون
   أحدثُ خطّةٍ هي المعتمَدة، ولا قبل أوّل اعتماد، ولا تُعاد نسخةٌ قديمةٌ نزلت. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CohortPlanService } from '../../services/cohort-plan.service'

let prisma: PrismaClient
let plans: CohortPlanService
let trainerUserId = ''
let profileId = ''
const STAMP = Date.now()
const content = (tag: string) => ({ kind: 'trainer', summaryAr: tag, modules: [], resources: [] })

async function makeCohort(tag: string) {
  const course = await prisma.course.findFirst({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: { courseId: course!.id, title: `شعبةُ المراجعة ${tag}`, status: 'active', capacity: 20, price: 100, currency: 'USD', timezone: 'Asia/Amman' },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId, role: 'lead' } })
  return cohort.id
}
const plan = (cohortId: string, status: string, tag: string, createdAt: Date) =>
  prisma.cohortDeliveryPlan.create({
    data: { cohortId, trainerId: profileId, status, content: content(tag), createdAt, reviewedAt: status === 'draft' ? null : createdAt },
  })
const at = (minutes: number) => new Date(Date.UTC(2027, 0, 1, 12, minutes))
const summaryOf = (p: { content: unknown } | null | undefined) => (p?.content as { summaryAr?: string } | undefined)?.summaryAr ?? null

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  plans = new CohortPlanService(prisma)
  const tUser = await prisma.user.create({ data: { email: `prd-trainer-${STAMP}@wajeez.test`, displayName: 'مدرّبُ المراجعة', passwordHash: 'x' } })
  trainerUserId = tUser.id
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-PRD-${STAMP}`, fullName: 'مدرّبُ المراجعة', email: tUser.email, status: 'active' },
  })
  profileId = (await prisma.trainerProfile.create({ data: { userId: tUser.id, applicationId: application.id } })).id
}, 240_000)

describe('المعتمَدةُ تُعاد مع المراجعة وحدَها', () => {
  it('⚠️ أحدثُها المعتمَدةُ نفسُها — لا شيءَ خلفها يُقارَن', async () => {
    const id = await makeCohort('معتمَدة')
    await plan(id, 'approved', 'المعتمَدة', at(1))
    expect((await plans.latestForCohort(id))?.approvedPlan).toBeNull()
    expect((await plans.workspace(trainerUserId, id)).approvedPlan).toBeNull()
  })

  it('⚠️ ومراجعةٌ مرسَلة — تُعاد معها المعتمَدةُ النافذة، لا نسخةٌ قديمةٌ نزلت', async () => {
    const id = await makeCohort('مراجعة')
    await plan(id, 'superseded', 'نسخةٌ قديمة', at(1))
    await plan(id, 'approved', 'المعتمَدة النافذة', at(2))
    await plan(id, 'submitted', 'المراجعة', at(3))
    const card = await plans.latestForCohort(id)
    expect(summaryOf(card)).toBe('المراجعة')
    expect(summaryOf(card?.approvedPlan)).toBe('المعتمَدة النافذة')
    expect(card?.approvedPlan?.reviewedAt?.toISOString()).toBe(at(2).toISOString())
    expect(summaryOf((await plans.workspace(trainerUserId, id)).approvedPlan)).toBe('المعتمَدة النافذة')
  })

  it('⚠️ والمراجعةُ المسودّةُ عند المدرّب كذلك — يقرأ ما غيّره قبل أن يرسل', async () => {
    const id = await makeCohort('مسودّة')
    await plan(id, 'published', 'المنشورة', at(1))
    await plan(id, 'draft', 'مراجعةٌ لم تُرسَل', at(2))
    expect(summaryOf((await plans.workspace(trainerUserId, id)).approvedPlan)).toBe('المنشورة')
  })

  it('وقبل أوّل اعتمادٍ لا شيءَ خلفها', async () => {
    const id = await makeCohort('قبل')
    await plan(id, 'submitted', 'أوّلُ إرسال', at(1))
    expect((await plans.latestForCohort(id))?.approvedPlan).toBeNull()
    expect((await plans.workspace(trainerUserId, id)).approvedPlan).toBeNull()
  })
})
