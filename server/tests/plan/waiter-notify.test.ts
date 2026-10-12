/* «نُعلمك فور فتح شعبتها» — يُعلَم من انتظر حين تصير الشعبةُ قابلةً للشراء فعلا.

   ── العطبُ الذي وُجد (١٢ أكتوبر ٢٠٢٦) ──

   الوعدُ مكتوبٌ في لوح الشراء وفي الخطّة، ومنفّذُه (`notifyPlanWaiters`) كان
   يُنادى في موضعٍ واحد: رفعُ علم التسجيل من بطاقة الشعبة. وزرُّ «افتح الشعبة» —
   الطريقُ المعتاد — لا يُعلم أحدا، ولا اعتمادُ خطّةٍ يرفع آخرَ مانعٍ عن شعبةٍ
   مفتوحة. وكان لا يقرأ `notifiedAt` فيُعيد الإشعارَ مع كلّ شعبةٍ تُفتح للدورة.

   ── وما يُحرَس ──

   ١) الفتحُ يُعلم من انتظر، مرّةً واحدة.
   ٢) والشعبةُ التي لا تُباع لا تُعلم أحدا: بلا مدرّبٍ معتمَد، أو خطّتُه تنتظر.
   ٣) واعتمادُ خطّةِ شعبةٍ مفتوحةٍ يُعلم — هو ما جعلها تُباع.
   ٤) ومن اشترى الدورةَ لا يُقال له «احجز مقعدك». */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import { plainAr } from '../../../src/application/text/plain-ar'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { PlanService } from '../../services/plan.service'
import { CohortService } from '../../services/cohort.service'
import { notifyIfPurchasable } from '../../services/catalog-readiness.service'
import { approvedTrainerPlan, fixtureTrainerId } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
let plans: PlanService
let cohorts: CohortService
let managerId = ''

const TITLE = plainAr('فُتحت شعبة دورةٍ كنت تنتظرها')
const DAY = 86_400_000

/* دوراتٌ منشورةٌ مختلفةٌ لكلّ اختبار — الإشعارُ بالدورة، فلا يختلط اختبارٌ بآخر */
let pool: string[] = []
const nextCourse = () => {
  const id = pool.shift()
  if (!id) throw new Error('نفدت الدوراتُ المنشورة')
  return id
}

let seq = 0
async function waiter(courseId: string) {
  seq += 1
  const { userId } = await auth.register(`waiter-${seq}@test.local`, 'Learner#12345', `منتظر ${seq}`)
  await plans.adopt(userId, { nameAr: 'خطّتي', composed: true, courseIds: [courseId] })
  return userId
}

const bells = (userId: string) => prisma.notification.count({ where: { userId, title: TITLE } })

/** مسوّدةٌ استوفت شروطَ الفتح كلَّها إلّا ما يُمرَّر */
async function draft(courseId: string, opts: { trainer?: 'approved' | 'submitted' | 'none' } = {}) {
  const trainer = opts.trainer ?? 'approved'
  return prisma.cohort.create({
    data: {
      courseId, title: `شعبة ${courseId} ${seq}-${Math.random()}`, status: 'draft',
      capacity: 10, price: 100, currency: 'USD', financialReady: true,
      sessions: { create: { title: 'الجلسة 1', startsAt: new Date(Date.now() + 30 * DAY) } },
      ...(trainer === 'none' ? {} : {
        plans: {
          create: trainer === 'approved'
            ? await approvedTrainerPlan(prisma)
            : { trainerId: await fixtureTrainerId(prisma), status: 'submitted', content: { kind: 'trainer' } },
        },
      }),
    },
  })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  plans = new PlanService(prisma)
  cohorts = new CohortService(prisma)
  const m = await auth.register('waiter-manager@test.local', 'Admin#12345', 'مدير')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'asc' } }))
    .map((c) => c.id)
}, 240_000)

describe('الفتحُ يُعلم من انتظر — مرّةً واحدة', () => {
  it('⚠️ «افتح الشعبة» يُعلم المنتظرَ ويختم إشعارَه', async () => {
    const courseId = nextCourse()
    const u = await waiter(courseId)
    const c = await draft(courseId)

    await cohorts.open(c.id, managerId)

    expect(await bells(u), 'فُتحت الشعبةُ ولم يُعلَم من انتظرها').toBe(1)
    const item = await prisma.learnerPlanItem.findFirstOrThrow({ where: { courseId, plan: { userId: u } } })
    expect(item.notifiedAt).not.toBeNull()
  })

  it('⚠️ وشعبةٌ ثانيةٌ للدورة نفسِها لا تُعيد الإشعار', async () => {
    const courseId = nextCourse()
    const u = await waiter(courseId)
    await cohorts.open((await draft(courseId)).id, managerId)
    await cohorts.open((await draft(courseId)).id, managerId)
    expect(await bells(u), 'أُعيد الإشعارُ مع كلّ شعبة').toBe(1)
  })

  it('ومن أطفأ الإشعارَ لا يُعلَم', async () => {
    const courseId = nextCourse()
    const u = await waiter(courseId)
    await prisma.learnerPlanItem.updateMany({ where: { courseId, plan: { userId: u } }, data: { notifyOnCohort: false } })
    await cohorts.open((await draft(courseId)).id, managerId)
    expect(await bells(u)).toBe(0)
  })
})

describe('والشعبةُ التي لا تُباع لا تُعلم أحدا', () => {
  it('⚠️ مفتوحةٌ بلا مدرّبٍ معتمَد: رفعُ علمها لا يُعلم', async () => {
    const courseId = nextCourse()
    const u = await waiter(courseId)
    const c = await prisma.cohort.create({
      data: { courseId, title: 'شعبةٌ افتراضيّة', status: 'open', registrationOpen: false, capacity: 10, price: 100, financialReady: true },
    })
    await cohorts.update(managerId, c.id, { registrationOpen: true })
    expect(await bells(u), 'أُعلم بشعبةٍ يخفيها الموقع').toBe(0)
  })

  it('⚠️ ومفتوحةٌ خطّتُها تنتظر لا تُعلم — واعتمادُها يُعلم', async () => {
    const courseId = nextCourse()
    const u = await waiter(courseId)
    const c = await draft(courseId, { trainer: 'submitted' })
    await prisma.cohort.update({ where: { id: c.id }, data: { status: 'open', registrationOpen: true } })

    await notifyIfPurchasable(prisma, c.id)
    expect(await bells(u), 'أُعلم بشعبةٍ خطّتُها لم تُعتمَد').toBe(0)

    /* ما يكتبه `decide('approve')` — ثمّ النداءُ الذي يليه فيه */
    await prisma.cohortDeliveryPlan.updateMany({ where: { cohortId: c.id }, data: { status: 'approved' } })
    await notifyIfPurchasable(prisma, c.id)
    expect(await bells(u), 'اعتُمدت فصارت تُباع ولم يُعلَم أحد').toBe(1)
  })
})

describe('ومن اشترى الدورةَ لا يُقال له «احجز مقعدك»', () => {
  it('⚠️ المسجَّلُ في شعبةٍ من الدورة لا يُعلَم بأخرى', async () => {
    const courseId = nextCourse()
    const u = await waiter(courseId)
    const first = await draft(courseId)
    await prisma.enrollment.create({ data: { userId: u, cohortId: first.id, status: 'enrolled' } })

    await cohorts.open((await draft(courseId)).id, managerId)
    expect(await bells(u), 'أُعلم من اشترى الدورةَ أصلا').toBe(0)
  })
})
