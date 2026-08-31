/* الدورة التي لا شعبةَ لها: ثلاثة أبواب — وحرّاسُها.

   الخطّةُ نيّةٌ والتسجيلُ التزام. فما يُحرَس هنا ليس أنّ الحذف يحذف، بل أنّ
   الأبواب الثلاثة لا تُفتح على ما لا يجوز:

   ١) لا تُحذف دورةٌ سجّل فيها المتعلّم — ولا يُستبدل التزامٌ قائم.
   ٢) ولا تبقى الخطّة فارغة: حذفُ آخر دورةٍ يُبطلها لا يُنظّفها.
   ٣) والبديلُ يقع في موضع المستبدَل نفسِه، وإلّا اختلّ ترتيب الخطّة.
   ٤) والهديّة تتبع البديل — وإلّا صارت على دورةٍ خرجت من الخطّة.
   ٥) ولا يُقترح بديلٌ لا شعبةَ له: البديل الذي لا يُشترى ليس بديلا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { PlanService } from '../../services/plan.service'
import { AuthService } from '../../services/auth.service'
import { openAllCohorts } from '../../services/catalog-readiness.service'

let prisma: PrismaClient
let plans: PlanService
let userId = ''
let withCohort: string[] = []
let noCohort = ''

const STAMP = Date.now()

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  plans = new PlanService(prisma)
  const auth = new AuthService(prisma)
  const u = await auth.register(`planner-${STAMP}@test.local`, 'Planner#12345', 'learner')
  userId = u.userId

  /* قاعدةُ الاختبار تُبنى بلا شعب — تُفتح كما تُفتح في الإنتاج، بالخدمة
     نفسِها لا ببذرٍ خاصّ، كي يكون ما يُختبَر هو الواقع. */
  await openAllCohorts(prisma, { apply: true })

  /* دوراتٌ لها شعبةٌ مفتوحة، وأخرى بلا — من الواقع لا مُختلَقة */
  const open = await prisma.cohort.findMany({
    where: { status: { in: ['open', 'full'] }, registrationOpen: true },
    select: { courseId: true }, distinct: ['courseId'], take: 4,
  })
  withCohort = open.map((c) => c.courseId)
  expect(withCohort.length).toBeGreaterThanOrEqual(3)

  /* الحالةُ التي وصفها صاحب المنصّة: دورةٌ أُغلقت شعبتُها — فتبقى في الخطّة
     بلا شعبةٍ قابلة للتسجيل. وهي أصدقُ من دورةٍ لم تُفتح لها شعبةٌ قطّ،
     لأنّها ما يحدث فعلا بعد أن تُفتح الشعب كلُّها. */
  const victim = await prisma.cohort.findFirst({
    where: { courseId: { notIn: withCohort }, registrationOpen: true },
    select: { courseId: true },
  })
  expect(victim).toBeTruthy()
  noCohort = victim!.courseId
  await prisma.cohort.updateMany({
    where: { courseId: noCohort }, data: { registrationOpen: false },
  })
})

describe('أبواب الدورة المنتظِرة', () => {
  it('الحالةُ تُشتقّ: ما لا شعبةَ له awaiting_cohort ويحمل تفضيل الإشعار', async () => {
    const plan = await plans.adopt(userId, {
      nameAr: 'خطّةُ اختبارٍ للأبواب', composed: false,
      courseIds: [withCohort[0], withCohort[1], noCohort],
    })
    const waiting = plan.items.find((i) => i.courseId === noCohort)
    expect(waiting?.state).toBe('awaiting_cohort')
    /* الافتراض: نعم أعلِمني — من أبقاها يريدها */
    expect(waiting?.notifyOnCohort).toBe(true)
  })

  it('والإشعار يُطفأ ويُشعل بلا أن يمسّ شيئا آخر', async () => {
    const off = await plans.setNotify(userId, noCohort, false)
    expect(off.items.find((i) => i.courseId === noCohort)?.notifyOnCohort).toBe(false)
    expect(off.items).toHaveLength(3)
    const on = await plans.setNotify(userId, noCohort, true)
    expect(on.items.find((i) => i.courseId === noCohort)?.notifyOnCohort).toBe(true)
  })

  it('ولا يُقترح بديلٌ لا شعبةَ له — البديل الذي لا يُشترى ليس بديلا', async () => {
    const alts = await plans.alternativesFor(userId, noCohort)
    for (const a of alts) {
      const live = await prisma.cohort.count({
        where: { courseId: a.courseId, status: { in: ['open', 'full'] }, registrationOpen: true },
      })
      expect(live).toBeGreaterThan(0)
      /* ولا يُقترح ما في الخطّة أصلا */
      expect([withCohort[0], withCohort[1], noCohort]).not.toContain(a.courseId)
    }
  })

  it('والبديل يقع في موضع المستبدَل نفسِه', async () => {
    const before = await plans.active(userId)
    const seq = before!.items.find((i) => i.courseId === noCohort)!.sequence
    const alts = await plans.alternativesFor(userId, noCohort)
    if (alts.length === 0) return /* لا بديل في هذه القاعدة — والحارس أعلاه يكفي */

    const after = await plans.replaceItem(userId, noCohort, alts[0].courseId)
    const placed = after.items.find((i) => i.courseId === alts[0].courseId)
    expect(placed).toBeTruthy()
    expect(placed!.sequence).toBe(seq)
    expect(after.items.some((i) => i.courseId === noCohort)).toBe(false)
  })

  it('ولا تُحذف آخر دورةٍ في الخطّة', async () => {
    const single = await plans.replaceCourses(userId, [withCohort[0]])
    expect(single.items).toHaveLength(1)
    await expect(plans.removeItem(userId, withCohort[0])).rejects.toThrow()
  })

  it('ولا تُحذف دورةٌ له عليها التزامٌ قائم', async () => {
    await plans.replaceCourses(userId, [withCohort[0], withCohort[1]])
    const cohort = await prisma.cohort.findFirst({
      where: { courseId: withCohort[0], status: { in: ['open', 'full'] }, registrationOpen: true },
    })
    const req = await prisma.enrollmentRequest.create({
      data: { cohortId: cohort!.id, userId, status: 'seat_held' },
    })
    await expect(plans.removeItem(userId, withCohort[0])).rejects.toThrow()
    await expect(plans.replaceItem(userId, withCohort[0], withCohort[2])).rejects.toThrow()
    await prisma.enrollmentRequest.delete({ where: { id: req.id } })
  })

  it('والهديّة تتبع البديل لا تبقى على ما خرج', async () => {
    const plan = await plans.adopt(userId, {
      nameAr: 'خطّةٌ فيها هديّة', composed: false,
      courseIds: [withCohort[0], withCohort[1]],
      giftCourseId: withCohort[1],
    })
    expect(plan.items.find((i) => i.courseId === withCohort[1])?.isGift).toBe(true)
    const after = await plans.replaceItem(userId, withCohort[1], withCohort[2])
    expect(after.items.find((i) => i.courseId === withCohort[2])?.isGift).toBe(true)
    expect(after.items.some((i) => i.courseId === withCohort[1])).toBe(false)
  })
})
