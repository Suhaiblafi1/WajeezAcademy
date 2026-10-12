/* «أبلغني حين تفتح شعبتها» لكلّ دورة — والطلبُ على الدورات بلا شعبة (١٢ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: بريدٌ واحدٌ لكلّ دورةٍ في صفحتها العامّة، ورسالةٌ واحدةٌ حين تفتح
   لها شعبةٌ تُشترى. ومعه تقريرٌ: كم ينتظر كلَّ دورةٍ بلا شعبة — فيبحث عن مدرّبها أوّلا.

   والمقيس:
   ① **يُحفظ الانتظارُ مرّةً** — والعائدُ يُقال له إنّه مسجَّل، ولا يُقبل لدورةٍ تُباع الآن.
   ② **وتُرسَل رسالةٌ واحدةٌ حين تُباع شعبتُها** — بالفتح نفسِه، لا قبله ولا مرّتين.
   ③ **والبابُ المغلقُ يؤجّلها** — وتخرج مع «أبلغهم» يومَ يُفتح.
   ④ **والتقريرُ يعدّ من ينتظر فعلا** — لا من اشترى، ولا دورةً تُباع — والأكثرُ أوّلا. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { PlanService } from '../../services/plan.service'
import { CohortService } from '../../services/cohort.service'
import { CourseInterestService } from '../../services/course-interest.service'
import { SEASON_GATE_KEY, writeSeasonGate } from '../../services/registration-window'
import { approvedTrainerPlan, fixtureTrainerId } from '../helpers/approved-trainer'

let prisma: PrismaClient
let auth: AuthService
let plans: PlanService
let cohorts: CohortService
let interest: CourseInterestService
let managerId = ''

const PURPOSE = 'course.interest.open'
const DAY = 86_400_000

let pool: string[] = []
const nextCourse = () => {
  const id = pool.shift()
  if (!id) throw new Error('نفدت الدوراتُ المنشورة')
  return id
}

let seq = 0
const mails = (to: string) => prisma.outboxMail.count({ where: { to, purpose: PURPOSE } })

/** مسوّدةٌ تُفتح بخطّة مدرّبٍ معتمَدة — أو بحالٍ أخرى لخطّته */
async function draft(courseId: string, plan: 'approved' | 'submitted' | 'none' = 'approved') {
  seq += 1
  return prisma.cohort.create({
    data: {
      courseId, title: `شعبة ${courseId} ${seq}`, status: 'draft',
      capacity: 10, price: 100, currency: 'USD', financialReady: true,
      sessions: { create: { title: 'الجلسة 1', startsAt: new Date(Date.now() + 30 * DAY) } },
      ...(plan === 'none' ? {} : {
        plans: {
          create: plan === 'approved'
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
  interest = new CourseInterestService(prisma)
  const m = await auth.register('ci-manager@test.local', 'Admin#12345', 'مدير')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'asc' } }))
    .map((c) => c.id).slice(10)
}, 240_000)

afterAll(async () => {
  /* البابُ مفتوحٌ في قاعدة الاختبار افتراضا (لا صفّ) — فيُعاد كما كان */
  await prisma.systemSetting.deleteMany({ where: { key: SEASON_GATE_KEY } })
})

describe('① يُحفظ الانتظارُ مرّةً', () => {
  it('⚠️ البريدُ يُحفظ مرّةً للدورة — والعائدُ يُقال له إنّه مسجّل', async () => {
    const courseId = nextCourse()
    expect((await interest.record('Visitor@Example.com', courseId)).alreadyWaiting).toBe(false)
    expect((await interest.record('visitor@example.com', courseId)).alreadyWaiting).toBe(true)
    const rows = await prisma.courseInterest.findMany({ where: { courseId } })
    expect(rows).toHaveLength(1)
    expect(rows[0].email).toBe('visitor@example.com')
    expect(rows[0].consentAr).toContain('رسالة واحدة')
  })

  it('⚠️ ولا يُقبل لدورةٍ تُباع شعبتُها الآن — يُقال له احجز', async () => {
    const courseId = nextCourse()
    await cohorts.open((await draft(courseId)).id, managerId)
    await expect(interest.record('late@example.com', courseId)).rejects.toMatchObject({ code: 'cohort_open' })
  })

  it('ولا لدورةٍ لا وجودَ لها', async () => {
    await expect(interest.record('x@example.com', 'NO-SUCH-COURSE')).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('② رسالةٌ واحدةٌ حين تُباع شعبتُها', () => {
  it('⚠️ «افتح الشعبة» يكتب الرسالةَ في الطابور ويختم الانتظار — ولا يعيدها بشعبةٍ ثانية', async () => {
    const courseId = nextCourse()
    await interest.record('wait-open@example.com', courseId)
    expect(await mails('wait-open@example.com')).toBe(0)

    await cohorts.open((await draft(courseId)).id, managerId)
    expect(await mails('wait-open@example.com'), 'فُتحت الشعبةُ ولم يُكتب له').toBe(1)
    const row = await prisma.courseInterest.findFirstOrThrow({ where: { courseId } })
    expect(row.notifiedAt).not.toBeNull()

    await cohorts.open((await draft(courseId)).id, managerId)
    expect(await mails('wait-open@example.com'), 'أُعيدت الرسالةُ بشعبةٍ ثانية').toBe(1)
  })

  it('⚠️ وشعبةٌ لا تُباع لا تكتب شيئا — خطّتُها تنتظر الاعتماد', async () => {
    const courseId = nextCourse()
    await interest.record('wait-plan@example.com', courseId)
    const c = await draft(courseId, 'submitted')
    await prisma.cohort.update({ where: { id: c.id }, data: { status: 'open', registrationOpen: true } })
    const { notifyIfPurchasable } = await import('../../services/catalog-readiness.service')
    await notifyIfPurchasable(prisma, c.id)
    expect(await mails('wait-plan@example.com')).toBe(0)
  })

  it('ومن أُبلغ ثمّ عاد يطلبها يعود منتظرا', async () => {
    const courseId = nextCourse()
    await interest.record('again@example.com', courseId)
    await cohorts.open((await draft(courseId)).id, managerId)
    /* أُغلقت الشعبةُ بعدها، فعاد يطلبها */
    await prisma.cohort.updateMany({ where: { courseId }, data: { registrationOpen: false } })
    expect((await interest.record('again@example.com', courseId)).alreadyWaiting).toBe(false)
    expect((await prisma.courseInterest.findFirstOrThrow({ where: { courseId } })).notifiedAt).toBeNull()
  })
})

describe('③ والبابُ المغلقُ يؤجّلها', () => {
  it('⚠️ لا تُكتب والبابُ مغلق — وتخرج مع «أبلغهم» يومَ يُفتح', async () => {
    const courseId = nextCourse()
    await interest.record('season@example.com', courseId)
    await writeSeasonGate(prisma, { open: false, seasonKey: 'nov_jan', seasonAr: 'موسم الشتاء', messageAr: '' }, managerId)

    await cohorts.open((await draft(courseId)).id, managerId)
    expect(await mails('season@example.com'), 'كُتبت «احجز مقعدك» والبابُ مغلق').toBe(0)

    await prisma.systemSetting.deleteMany({ where: { key: SEASON_GATE_KEY } })
    const swept = await interest.notifyAllPurchasable()
    expect(swept.queued).toBeGreaterThanOrEqual(1)
    expect(await mails('season@example.com'), 'فُتح البابُ ولم يُبلَّغ').toBe(1)
  })
})

describe('④ والتقريرُ يعدّ من ينتظر فعلا', () => {
  it('⚠️ متعلّمو الخطط وزوّارُ البريد — بلا من اشترى، ولا دورةٍ تُباع، والأكثرُ أوّلا', async () => {
    const [busy, quiet, selling] = [nextCourse(), nextCourse(), nextCourse()]
    const learner = async () => {
      seq += 1
      const { userId } = await auth.register(`ci-l-${seq}@test.local`, 'Learner#12345', `متعلّم ${seq}`)
      return userId
    }
    /* الأكثرُ طلبا: متعلّمان في خطّتهما وزائران */
    for (let i = 0; i < 2; i++) await plans.adopt(await learner(), { nameAr: 'خطّتي', composed: true, courseIds: [busy] })
    await interest.record('busy-1@example.com', busy)
    await interest.record('busy-2@example.com', busy)
    /* ومتعلّمٌ اشترى الدورةَ — لا ينتظرها */
    const owner = await learner()
    await plans.adopt(owner, { nameAr: 'خطّتي', composed: true, courseIds: [busy] })
    const held = await draft(busy, 'none')
    await prisma.enrollment.create({ data: { userId: owner, cohortId: held.id, status: 'enrolled' } })

    /* والأقلُّ: زائرٌ واحد، وخطّةُ مدرّبها تنتظر اعتمادك */
    await interest.record('quiet@example.com', quiet)
    await draft(quiet, 'submitted')

    /* ودورةٌ تُباع لا تُعدّ وإن انتظرها أحد */
    await plans.adopt(await learner(), { nameAr: 'خطّتي', composed: true, courseIds: [selling] })
    await cohorts.open((await draft(selling)).id, managerId)

    const { rows } = await interest.demand()
    const b = rows.find((r) => r.courseId === busy)!
    const q = rows.find((r) => r.courseId === quiet)!
    expect(b.planWaiting, 'عُدّ من اشترى').toBe(2)
    expect(b.visitorWaiting).toBe(2)
    expect(b.total).toBe(4)
    expect(b.state).toBe('no_trainer')
    expect(q.total).toBe(1)
    expect(q.state).toBe('plan_submitted')
    expect(rows.map((r) => r.courseId), 'عُدّت دورةٌ تُباع').not.toContain(selling)
    expect(rows.indexOf(b), 'الأكثرُ طلبا ليس أوّلا').toBeLessThan(rows.indexOf(q))
  })

  it('ومسوّدةٌ اعتُمدت خطّتُها تُقال «تنتظر فتحك»', async () => {
    const courseId = nextCourse()
    await interest.record('approved@example.com', courseId)
    await draft(courseId, 'approved')
    const row = (await interest.demand()).rows.find((r) => r.courseId === courseId)!
    expect(row.state).toBe('approved_draft')
  })
})
