/* بوّابةُ فتح الشعبة — خطّةُ مدرّبٍ معتمَدة، والزرُّ الجماعيُّ تقاعد.

   ── ① لا شعبةَ تُفتح بلا مدرّبٍ اعتُمدت خطّتُه (١٢ أكتوبر ٢٠٢٦) ──

   قرارُ صاحب المنصّة: «أريد أن يظهر للعوامّ فقط الدورات التي لها مدرّبٌ
   واعتمدتُها أنا». وكان المدرّبُ قد خرج من شروط الفتح على قرارٍ أقدم («تُفتح
   الشعبُ كلُّها ويُسنَد المدرّبون لاحقا») — فعاد بصيغة القرار الجديد: خطّةُ
   مدرّبٍ **معتمَدة**، لا اسمٌ مُسنَدٌ ولا خطّةٌ أساسيّةٌ يكتبها المدير.

   والنقصُ يُسمّى بما يُوفى به: «لا مدرّبَ معتمَد» لشعبةٍ لا خطّةَ لمدرّبها،
   و«خطّةُ المدرّب لم تُعتمَد بعد» لمن كتب ولم يُعتمَد له. فالمديرُ يعرف أيبحث
   عن مدرّبٍ أم يقرأ خطّةً تنتظره.

   ── ② والزرُّ الجماعيُّ «شعبةٌ لكلّ دورة» تقاعد ──

   `openAllCohorts` كان يفتح للبيع شعبا بلا مدرّب. وبعد هذا الشرط لا يفتح
   شيئا، فخرج هو ومساره وسكربته (`catalog-readiness.service.ts`).

   والحارسُ هنا على الأثر لا على السطر: تُسأل الخدمةُ نفسُها وتُفتح الشعبةُ
   فعلا، ثمّ يُسأل عمّا في القاعدة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortService } from '../../services/cohort.service'
import { OPEN_GAP } from '../../../src/application/learning/open-gaps'
import { approvedTrainerPlan, fixtureTrainerId } from '../helpers/approved-trainer'

let prisma: PrismaClient
let cohorts: CohortService
let actorId = ''
let courseId = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  cohorts = new CohortService(prisma)
  const auth = new AuthService(prisma)
  const admin = await auth.register('cohort-gate@test.local', 'Admin#12345', 'مدير')
  actorId = admin.userId
  await auth.setRoles(actorId, ['academic_manager'])
  /* منشورةٌ — فلا يُخلَط نقصُ المدرّب بنقص النشر */
  courseId = (await prisma.course.findFirstOrThrow({ where: { status: 'published' }, orderBy: { id: 'asc' } })).id
}, 180_000)

/** شعبةٌ مسوّدةٌ استوفت كلَّ شرطٍ إلّا مدرّبَها — جلسةٌ وسعةٌ وسعر */
async function readyButTrainer(title: string) {
  return prisma.cohort.create({
    data: {
      courseId, title, status: 'draft', capacity: 10, price: 100, currency: 'USD', financialReady: true,
      sessions: { create: { title: 'الجلسة 1', startsAt: new Date(Date.now() + 30 * 86_400_000) } },
    },
  })
}

describe('لا شعبةَ تُفتح بلا مدرّبٍ اعتُمدت خطّتُه', () => {
  it('⚠️ شعبةٌ لا مدرّبَ لها تُعلن نقصَها باسمه — ولا تُفتح', async () => {
    const c = await readyButTrainer('شعبةٌ بلا مدرّب')
    const check = await cohorts.openChecklist(c.id)
    expect(check.ready, 'فُتحت شعبةٌ لا مدرّبَ لها').toBe(false)
    expect(check.missing).toEqual([OPEN_GAP.noTrainer])
    await expect(cohorts.open(c.id, actorId)).rejects.toMatchObject({ code: 'open_blocked' })
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('draft')
  })

  it('⚠️ وخطّةٌ أساسيّةٌ يكتبها المديرُ لا تقوم مقامَ المدرّب', async () => {
    /* كانت الخطّةُ الأساسيّةُ تُوفي شرطَ «خطّة التقديم» فتُفتح بها شعبةٌ بلا
       مدرّب — وبها فُتحت الشعبُ الافتراضيّة كلُّها */
    const c = await readyButTrainer('شعبةٌ بخطّةٍ أساسيّة')
    await cohorts.setDeliveryPlan(c.id, actorId, {
      notesAr: 'تقديمٌ عن بُعد عبر Zoom، الثلاثاء والخميس السادسة مساءً بتوقيت عمّان، ثماني جلسات.',
    })
    expect((await cohorts.openChecklist(c.id)).missing).toEqual([OPEN_GAP.noTrainer])
  })

  it('ومدرّبٌ كتب ولم يُعتمَد له يُسمّى نقصُه غيرَ ذلك — خطّةٌ تنتظرك لا مدرّبٌ يُبحث عنه', async () => {
    const c = await readyButTrainer('شعبةٌ خطّتُها تنتظر')
    await prisma.cohortDeliveryPlan.create({
      data: { cohortId: c.id, trainerId: await fixtureTrainerId(prisma), status: 'submitted', content: { kind: 'trainer' } },
    })
    expect((await cohorts.openChecklist(c.id)).missing).toEqual([OPEN_GAP.trainerPlan])
  })

  it('وباعتماد خطّة مدرّبها تُفتح — والتسجيلُ معها', async () => {
    const c = await readyButTrainer('شعبةٌ اعتُمدت خطّةُ مدرّبها')
    await prisma.cohortDeliveryPlan.create({ data: { cohortId: c.id, ...(await approvedTrainerPlan(prisma)) } })
    expect((await cohorts.openChecklist(c.id)).ready).toBe(true)
    await cohorts.open(c.id, actorId)
    const after = await prisma.cohort.findUniqueOrThrow({ where: { id: c.id } })
    expect(after.status).toBe('open')
    expect(after.registrationOpen).toBe(true)
  })
})

describe('خطّةُ التقديم الأساسيّة — تُكتب وتُحدَّث ولا تُكرَّر', () => {
  it('ولا تُقبل خطّةٌ أقصرُ من أن تُقرأ — الشرطُ يُوفَّى لا يُختَم', async () => {
    const c = await prisma.cohort.create({
      data: { courseId, title: 'شعبةُ الخطّة القصيرة', status: 'draft', capacity: 10 },
    })
    await expect(cohorts.setDeliveryPlan(c.id, actorId, { notesAr: 'عن بعد' }))
      .rejects.toMatchObject({ code: 'plan_too_short' })
  })

  it('والكتابةُ مرّتين تُحدِّث ولا تُكرِّر — خطّةٌ واحدةٌ أساسيّة', async () => {
    const c = await prisma.cohort.create({
      data: { courseId, title: 'شعبةُ التحديث', status: 'draft', capacity: 10 },
    })
    await cohorts.setDeliveryPlan(c.id, actorId, { notesAr: 'النصُّ الأوّل، وهو أطولُ من عشرين حرفا بيقين.' })
    await cohorts.setDeliveryPlan(c.id, actorId, { notesAr: 'النصُّ الثاني، وهو كذلك أطولُ من عشرين حرفا.' })
    const plans = await cohorts.deliveryPlans(c.id)
    expect(plans).toHaveLength(1)
    expect((plans[0].content as { notesAr: string }).notesAr).toContain('الثاني')
  })
})

/* ── ③ والإدارةُ ترى ما يراه الزائر ──

   الشعبُ الافتراضيّةُ باقيةٌ «مفتوحة للتسجيل» في القاعدة، ويخفيها الشرطُ وحدَه.
   فلو قرأت الشاشةُ الحالةَ وحدَها لقالت «مفتوحة» لما لا يعرضه الموقع. فقائمةُ
   الإدارة تحمل «اعتُمدت لمدرّبها خطّة؟» — وبه تقول «مخفيّةٌ عن الموقع» و«تنتظر فتحك». */
describe('قائمةُ الإدارة تقول أيُّ شعبةٍ يراها الزائر', () => {
  it('⚠️ مفتوحةٌ بلا مدرّبٍ معتمَد «غيرُ معتمَدة»، ومسوّدةٌ اعتُمدت خطّتُها «معتمَدة»', async () => {
    const hidden = await prisma.cohort.create({
      data: { courseId, title: 'شعبةٌ افتراضيّةٌ مفتوحة', status: 'open', registrationOpen: true, capacity: 10, price: 100, financialReady: true },
    })
    const waiting = await readyButTrainer('مسوّدةٌ اعتُمدت خطّتُها')
    await prisma.cohortDeliveryPlan.create({ data: { cohortId: waiting.id, ...(await approvedTrainerPlan(prisma)) } })

    const rows = await cohorts.list()
    expect(rows.find((r) => r.id === hidden.id)!.trainerPlanApproved, 'شعبةٌ بلا مدرّبٍ قيل إنّها معتمَدة').toBe(false)
    expect(rows.find((r) => r.id === waiting.id)!.trainerPlanApproved, 'مسوّدةٌ معتمَدةٌ لم تُعرَف').toBe(true)
  })
})
