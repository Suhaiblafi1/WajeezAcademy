/* فتحُ الشعبة ينشر اسمَ مدرّبها — والعاملُ يلحق ما فُتح قبل القرار (٢٠ أكتوبر ٢٠٢٦).

   ═══ القرار ═══

   «لماذا حفصة لا تظهر بقائمة المدرّبين؟ لها شعب» — ثمّ اختار صاحبُ المنصّة أن يُنشر الاسمُ مع فتح الشعبة لا
   بزرٍّ يُنسى. والعلّةُ في `server/services/trainer-auto-publish.ts`.

   ═══ وما يُحرَس ═══

   ١) الفتحُ (`CohortService.open`) ينشر مدرّبَها: يظهر في صفحة المدرّبين وعلى شعبته، وأثرُه وإشعارُه أثرُ
      الاعتماد اليدويّ نفسُه، وفي الأثر `auto`.
   ٢) والعاملُ (`publish_live_trainers`) ينشر مدرّبَ شعبةٍ فُتحت قبل القرار — مرّةً، ثمّ لا شيء.
   ٣) ولا يُنشر الموقوف، ولا مَن طلبُه غيرُ نشط، ولا مدرّبُ شعبةٍ في الإعداد.

   ═══ وكيف رُئي ساقطا ═══

   رُفع النداءُ من `open` فسقط الأوّل، ورُفعت الوظيفةُ من العامل فسقط الثاني، وأُسقط شرطُ الإيقاف ثمّ شرطُ
   الطلب النشط فسقط كلٌّ من حارسيهما. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { approvedPlanBy } from '../helpers/approved-trainer'
import { CohortService } from '../../services/cohort.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { PublicCatalogService } from '../../services/public-catalog.service'
import { publishCohortTrainers } from '../../services/trainer-auto-publish'
import { runJob } from '../../worker/jobs'

let prisma: PrismaClient
let cohorts: CohortService
let review: TrainerReviewService
let pub: PublicCatalogService
let courseId = ''
const ACTOR = '00000000-0000-0000-0000-000000000009'
const DAY = 86_400_000
let seq = 0

async function trainer(name: string) {
  seq++
  return review.createTrainerDirectly(ACTOR, { fullName: name, email: `auto-publish-${seq}-${Date.now()}@test.local` })
}

/** شعبةٌ استوفت شروطَ الفتح، ومدرّبُها أصيلُها */
async function cohortFor(profileId: string, status: 'draft' | 'open' = 'draft') {
  return prisma.cohort.create({
    data: {
      courseId, title: `شعبة النشر الآليّ ${++seq}`, status,
      capacity: 10, price: 100, currency: 'USD', financialReady: true,
      sessions: { create: { title: 'الجلسة 1', startsAt: new Date(Date.now() + 30 * DAY) } },
      plans: { create: approvedPlanBy(profileId) },
      trainers: { create: { profileId, role: 'lead' } },
    },
  })
}

const shown = async (profileId: string) => (await review.listPublicTrainers()).some((t) => t.id === profileId)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
  review = new TrainerReviewService(prisma)
  pub = new PublicCatalogService(prisma)
  courseId = (await prisma.course.findFirstOrThrow({ where: { status: 'published' }, select: { id: true } })).id
}, 240_000)

describe('فتح الشعبة ينشر اسم مدربها', () => {
  it('⚠️ الفتح ينشره: في صفحة المدربين وعلى شعبته — بأثر الاعتماد وإشعاره', async () => {
    const t = await trainer('مدرّبةُ الفتح')
    const c = await cohortFor(t.profileId)
    expect(await shown(t.profileId), 'ظهر قبل الفتح').toBe(false)

    await cohorts.open(c.id, ACTOR)

    expect(await shown(t.profileId), 'فتحت شعبته واسمه غائب').toBe(true)
    const onCohort = (await pub.cohorts()).find((x) => x.id === c.id)
    expect(onCohort?.trainers, 'شعبته تباع بلا اسمه').toContain('مدرّبةُ الفتح')
    const audit = await prisma.auditEvent.findFirst({ where: { action: 'trainer.publish_approve', entityId: t.profileId } })
    expect(audit?.actorId).toBe(ACTOR)
    expect(audit?.meta).toMatchObject({ auto: true, cohortIds: [c.id] })
    expect(await prisma.notification.count({ where: { userId: t.userId, title: 'اعتمد ظهورك للعامّة' } })).toBe(1)
  })

  it('⚠️ والعامل ينشر مدرب شعبة فتحت قبل القرار — مرة ثم لا شيء', async () => {
    const t = await trainer('مدرّبُ ما قبل القرار')
    await cohortFor(t.profileId, 'open')
    expect(await shown(t.profileId)).toBe(false)

    const first = await runJob(prisma, 'publish_live_trainers')
    expect(first.done).toBeGreaterThanOrEqual(1)
    expect(await shown(t.profileId), 'العامل لم يلحقه').toBe(true)

    const second = await runJob(prisma, 'publish_live_trainers')
    expect(second.done, 'نشر من نشر').toBe(0)
    expect(await prisma.notification.count({ where: { userId: t.userId, title: 'اعتمد ظهورك للعامّة' } }), 'أشعر مرتين').toBe(1)
  })

  /* والإيقافُ يُكتب على الملفّ وحدَه هنا: `suspendTrainer` ينقل الطلبَ أيضا إلى `suspended`، فيمنعه شرطُ «الطلبِ
     النشط» قبل شرط الإيقاف — وقد رُئي هذا الحارسُ أخضرَ وشرطُ الإيقاف مرفوعٌ لهذا السبب. فالملفُّ موقوفٌ وطلبُه
     نشط: لا يحميه إلّا شرطُ الإيقاف. */
  it('⚠️ ولا ينشر الموقوف — الإيقاف قرار بإخفائه', async () => {
    const t = await trainer('مدرّبٌ موقوف')
    await cohortFor(t.profileId, 'open')
    await prisma.trainerProfile.update({ where: { id: t.profileId }, data: { suspendedAt: new Date() } })
    await publishCohortTrainers(prisma, { actorId: null })
    const p = await prisma.trainerProfile.findUniqueOrThrow({ where: { id: t.profileId } })
    expect(p.publicVisibility, 'نشر الموقوف').toBe(false)
  })

  it('⚠️ ولا من طلبه غير نشط — يعد ولا ينشر', async () => {
    const t = await trainer('مدرّبةٌ لم تنشط')
    await cohortFor(t.profileId, 'open')
    await prisma.trainerApplication.update({ where: { id: t.applicationId }, data: { status: 'conditionally_approved' } })
    const r = await publishCohortTrainers(prisma, { actorId: null })
    expect(r.published).not.toContain(t.profileId)
    expect(r.notActive).toBeGreaterThanOrEqual(1)
    expect((await prisma.trainerProfile.findUniqueOrThrow({ where: { id: t.profileId } })).publishApprovedAt).toBeNull()
  })

  it('ولا مدرب شعبة في الإعداد — لم تفتح بعد', async () => {
    const t = await trainer('مدرّبُ مسوّدة')
    await cohortFor(t.profileId, 'draft')
    const r = await publishCohortTrainers(prisma, { actorId: null })
    expect(r.published).not.toContain(t.profileId)
  })
})
