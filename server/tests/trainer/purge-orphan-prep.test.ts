/* حذفُ مدرّبٍ لا يترك خطّتَه في طابور الاعتماد (٣ أكتوبر ٢٠٢٦).

   بلاغُ صاحب المنصّة: «حذفتُ مدرّبا نهائيّا ومازالت دورتُه هنا — لماذا لا
   يمكنني حذفها؟». فالحذفُ كان يمحو الملفَّ (أو يفكّ الحساب) ويترك شعبةَ الإعداد
   المسوّدةَ وخطّتَها المرسَلة، والطابورُ يعدّ كلَّ `submitted`.

   ═══ وما يُحرَس ═══
   ١) حذفُ الطلب نهائيّا يُلغي شعبةَ إعداده — وتخرج خطّتُها من الطابور وشارته.
   ٢) ومحوُ الحساب بسجلّه كذلك — والملفُّ يبقى مفكوكا كما كان.
   ٣) وشعبةٌ فيها متعلّمٌ لا تُمسّ — ذاك طريقُه الرحيل.
   ٤) والطابورُ نفسُه لا يعرض خطّةً بلا صاحبٍ يعمل، ولو بقيت من قبل الإصلاح.

   ═══ وكيف رُئي ساقطا ═══ في رسالة الالتزام. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerApplicationService } from '../../services/trainer-application.service'
import { CohortPlanService } from '../../services/cohort-plan.service'
import { purgeAccountWithHistory } from '../../services/account-purge.service'

let prisma: PrismaClient
let review: TrainerReviewService
let plans: CohortPlanService
let courseId = ''
const ACTOR = '00000000-0000-0000-0000-000000000009'
let seq = 0

async function trainerWithPrep() {
  seq += 1
  const t = await review.createTrainerDirectly(ACTOR, { fullName: `مدرّبٌ يُحذَف ${seq}`, email: `purge-prep-${seq}@test.local` })
  const cohort = await prisma.cohort.create({ data: { courseId, title: `شعبةُ إعدادٍ ${seq}`, status: 'draft' } })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId: t.profileId, role: 'lead' } })
  const plan = await prisma.cohortDeliveryPlan.create({
    data: { cohortId: cohort.id, trainerId: t.profileId, status: 'submitted', submittedAt: new Date(), content: { kind: 'trainer', modules: [], resources: [] } },
  })
  return { ...t, cohortId: cohort.id, planId: plan.id }
}

const inQueue = async (planId: string) => (await plans.pending()).some((p) => p.id === planId)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  review = new TrainerReviewService(prisma)
  plans = new CohortPlanService(prisma)
  courseId = (await prisma.course.findFirstOrThrow({ select: { id: true } })).id
}, 240_000)

describe('حذفُ مدرّبٍ يُخرج خطّتَه من طابور الاعتماد', () => {
  it('الخطّةُ في الطابور قبل الحذف — فلا يخضرّ الحارسُ على فراغ', async () => {
    const t = await trainerWithPrep()
    expect(await inQueue(t.planId)).toBe(true)
  })

  it('⚠️ ① حذفُ الطلب نهائيّا: تُلغى شعبتُه، وتخرج خطّتُها ويقلّ العدّاد', async () => {
    const t = await trainerWithPrep()
    const before = await plans.pendingCount()
    await prisma.trainerApplication.update({ where: { id: t.applicationId }, data: { status: 'withdrawn' } })
    await new TrainerApplicationService(prisma).purge(t.reference, ACTOR, 'حذفُ مدرّبِ تجربة')
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: t.cohortId } })).status).toBe('cancelled')
    expect(await inQueue(t.planId)).toBe(false)
    expect(await plans.pendingCount()).toBe(before - 1)
  })

  it('⚠️ ② محوُ الحساب بسجلّه: تُلغى شعبتُه وتخرج خطّتُها — والملفُّ يبقى مفكوكا', async () => {
    const t = await trainerWithPrep()
    await purgeAccountWithHistory(prisma, t.userId)
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: t.cohortId } })).status).toBe('cancelled')
    expect(await inQueue(t.planId)).toBe(false)
    expect((await prisma.trainerProfile.findUniqueOrThrow({ where: { id: t.profileId } })).userId).toBeNull()
  })

  it('③ وشعبةٌ فيها متعلّمٌ لا تُلغى بالحذف — طريقُها الرحيل', async () => {
    const t = await trainerWithPrep()
    const learner = await prisma.user.create({ data: { email: `purge-learner-${seq}@test.local`, displayName: 'متعلّم', passwordHash: 'x' } })
    await prisma.enrollment.create({ data: { userId: learner.id, cohortId: t.cohortId } })
    await purgeAccountWithHistory(prisma, t.userId)
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: t.cohortId } })).status).toBe('draft')
  })

  it('④ والطابورُ لا يعرض خطّةً بلا صاحبٍ يعمل — ولو بقيت من قبل الإصلاح', async () => {
    const t = await trainerWithPrep()
    /* ما كان يقع قبل الإصلاح: يُفكّ الحسابُ والشعبةُ باقيةٌ مسوّدة */
    await prisma.trainerProfile.update({ where: { id: t.profileId }, data: { userId: null } })
    expect(await inQueue(t.planId)).toBe(false)
  })
})
