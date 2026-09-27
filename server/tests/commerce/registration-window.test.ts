/* نافذةُ التسجيل تُحترم في المواضع الستّة — البند ٥١.

   ─────────── ما يقيسه هذا الملفّ ───────────

   `Cohort.registrationOpen` قيمةٌ منطقيّةٌ بلا تواريخ: متى فُتحت شعبةٌ صارت
   الدعوةُ مفتوحةً إلى الأبد. فصار للفصل نافذةٌ لها بدايةٌ ونهاية
   (`Term.registrationOpensAt/ClosesAt`).

   والخطرُ ليس في كتابة الشرط بل في **تفرّقه**: ستّةُ مواضعَ في الخادم تقرأ
   `registrationOpen` وحدَها — السلّة، والتسجيل، والتبديل بين الشعب، وإنشاءُ
   الطلب، وشعبُ الخطّة، والكتالوجُ العامّ. فلو وُصل خمسةٌ وسُهي عن سادس لَعرض
   الكتالوجُ شعبةً يردّها الشراء، أو لَباعت السلّةُ مقعدا في فصلٍ لم يُفتح.

   فيسأل كلُّ اختبارٍ هنا موضعا واحدا بعينه، ويسأله سؤالين: أيردّ شعبةَ فصلٍ
   لم تُفتح نافذتُه؟ وأيقبل شعبةً بلا فصلٍ أصلا؟ — لأنّ الشرطَ الجديدَ لو
   أبطل الشعبَ القائمةَ قبل نظام الفصول لكان عطبا أكبرَ ممّا أصلح. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { PlanService } from '../../services/plan.service'
import { CommerceService } from '../../services/commerce.service'
import { EnrollmentService } from '../../services/enrollment.service'
import { PublicCatalogService } from '../../services/public-catalog.service'
import { CartService } from '../../services/commerce/cart.service'
import { termWindowVerdict, cohortAcceptsRegistration, awaitingTrainerPlan } from '../../services/registration-window'

let prisma: PrismaClient
let auth: AuthService
let plans: PlanService
let commerce: CommerceService
let enrollments: EnrollmentService
let publicCatalog: PublicCatalogService
let cart: CartService

/* دوراتٌ مختلفةٌ لكلّ اختبار — الشعبُ تتراكم في قاعدةٍ واحدة، و«أقرب شعبة»
   تختار ما وجدت، فدورةٌ استعملها اختبارٌ سابقٌ تُعطي شعبتَه لا شعبتَنا. */
const POOL: string[] = (
  JSON.parse(
    readFileSync(join(process.cwd(), 'src/data/catalog/core-catalog.v2.json'), 'utf8'),
  ) as { courses: { course_id: string }[] }
).courses.map((c) => c.course_id).sort()

let cursor = 30
const nextCourse = () => {
  const id = POOL[cursor++]
  if (!id) throw new Error(`الكتالوج فيه ${POOL.length} دورة فقط`)
  return id
}

const DAY = 86_400_000

let seq = 0
async function learner() {
  seq += 1
  const { userId } = await auth.register(`win-${seq}@test.local`, 'Learner#12345', `متعلّم ${seq}`)
  return userId
}

/** فصلٌ نافذتُه لم تُفتح بعد — يبدأ تسجيلُه بعد ثلاثين يوما */
let termSeq = 0
async function futureTerm() {
  termSeq += 1
  return prisma.term.create({
    data: {
      year: 2090 + termSeq, season: 'feb_apr', titleAr: `فصلٌ لم يُفتح ${termSeq}`,
      startsOn: new Date(Date.now() + 60 * DAY), endsOn: new Date(Date.now() + 120 * DAY),
      registrationOpensAt: new Date(Date.now() + 30 * DAY),
      registrationClosesAt: new Date(Date.now() + 55 * DAY),
      status: 'planned',
    },
  })
}

/** شعبةٌ علمُها مرفوع — و«فصلُها» اختياريّ كما في الواقع */
async function cohort(courseId: string, termId: string | null) {
  return prisma.cohort.create({
    data: {
      courseId, title: `شعبة ${courseId} ${Date.now()}-${Math.random()}`,
      status: 'open', registrationOpen: true, financialReady: true,
      price: 100, currency: 'JOD', capacity: 10,
      startsAt: new Date(Date.now() + 70 * DAY),
      termId,
    },
  })
}

/* ═══ وخطّةُ المدرّب (٣ج) ═══ — مدرّبٌ واحدٌ لكلّ ما يلي، وخطّتُه تُكتب بحالها */
let trainerProfileId = ''
async function trainerPlan(cohortId: string, status: string) {
  return prisma.cohortDeliveryPlan.create({
    data: { cohortId, trainerId: trainerProfileId, status, content: { kind: 'trainer', modules: [], resources: [] } },
  })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  plans = new PlanService(prisma)
  commerce = new CommerceService(prisma)
  enrollments = new EnrollmentService(prisma)
  publicCatalog = new PublicCatalogService(prisma)
  cart = new CartService(prisma)

  const tUser = await prisma.user.create({ data: { email: `win-trainer-${Date.now()}@test.local`, displayName: 'مدرّبُ الشعب', passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-WIN-${Date.now()}`, fullName: 'مدرّبُ الشعب', email: tUser.email, status: 'active' },
  })
  trainerProfileId = (await prisma.trainerProfile.create({ data: { userId: tUser.id, applicationId: application.id } })).id
}, 240_000)

describe('الشرطُ نفسُه — قبل أن يُوصَل بموضع', () => {
  it('الفارغُ لا يمنع: لا فصل، أو فصلٌ بلا تواريخ', () => {
    expect(termWindowVerdict(null).open).toBe(true)
    expect(
      termWindowVerdict({ titleAr: 'فصل', registrationOpensAt: null, registrationClosesAt: null }).open,
    ).toBe(true)
  })

  it('يميّز «لم يبدأ» من «أُغلق» — فمن رُدَّ يعرف أيهما', () => {
    const t = {
      titleAr: 'خريف ٢٠٩٩',
      registrationOpensAt: new Date('2099-01-10'),
      registrationClosesAt: new Date('2099-02-10'),
    }
    const before = termWindowVerdict(t, new Date('2099-01-01'))
    const during = termWindowVerdict(t, new Date('2099-01-20'))
    const after = termWindowVerdict(t, new Date('2099-03-01'))

    expect(before.open).toBe(false)
    expect(before.open === false && before.code).toBe('not_yet')
    expect(during.open).toBe(true)
    expect(after.open).toBe(false)
    expect(after.open === false && after.code).toBe('closed')
    /* والسببُ يسمّي الفصلَ لا «شعبةً ما» */
    expect(before.open === false && before.reasonAr).toContain('خريف ٢٠٩٩')
  })

  it('علمُ الشعبة يسبق نافذةَ الفصل — منعان لا يختلطان', () => {
    const open = { titleAr: 'ف', registrationOpensAt: null, registrationClosesAt: null }
    const off = cohortAcceptsRegistration({ registrationOpen: false, title: 'شعبتي', term: open, plans: [], joinClosesAt: null })
    expect(off.open).toBe(false)
    expect(off.open === false && off.code).toBe('flag_off')
    expect(off.open === false && off.reasonAr).toContain('شعبتي')
  })

  /* ═══ وشرطا خطّة المدرّب (٣ج) ═══ */
  const base = { registrationOpen: true, title: 'شعبةُ المدرّب', term: null, joinClosesAt: null }

  it('⚠️ خطّةٌ بدأها مدرّبُها ولم تُعتمَد قطّ تمنع — والعلمُ مرفوع', () => {
    for (const status of ['draft', 'submitted', 'changes_requested']) {
      const v = cohortAcceptsRegistration({ ...base, plans: [{ status }] })
      expect(v.open, `خطّةٌ «${status}» فتحت التسجيل`).toBe(false)
      expect(v.open === false && v.code).toBe('awaiting_plan')
      expect(v.open === false && v.reasonAr).toContain('حين تُعتمَد خطّةُ مدرّبها')
    }
  })

  it('⚠️ وما اعتُمد مرّةً يفتح — وإن كانت مراجعتُه مسودّةً الآن', () => {
    for (const status of ['approved', 'published', 'superseded']) {
      expect(cohortAcceptsRegistration({ ...base, plans: [{ status: 'draft' }, { status }] }).open, status).toBe(true)
    }
    /* وشعبةٌ لا خطّةَ لمدرّبها أصلا لا تُمنع — القائمُ لا يُبطَل */
    expect(cohortAcceptsRegistration({ ...base, plans: [] }).open).toBe(true)
    expect(awaitingTrainerPlan([])).toBe(false)
  })

  it('⚠️ والالتحاقُ حتّى بدء الموعد الثاني — لا بعده ولا عنده', () => {
    const at = new Date('2099-03-13T21:00:00.000Z')
    const plan = [{ status: 'approved' }]
    expect(cohortAcceptsRegistration({ ...base, plans: plan, joinClosesAt: at }, new Date(at.getTime() - 1)).open).toBe(true)
    const closed = cohortAcceptsRegistration({ ...base, plans: plan, joinClosesAt: at }, at)
    expect(closed.open).toBe(false)
    expect(closed.open === false && closed.code).toBe('late_closed')
    expect(closed.open === false && closed.reasonAr).toContain('بدأ موعدُها الثاني')
  })

  it('والعلمُ يسبقها كلَّها — «مغلق» غيرُ «بانتظار الاعتماد»', () => {
    const v = cohortAcceptsRegistration({ ...base, registrationOpen: false, plans: [{ status: 'draft' }] })
    expect(v.open === false && v.code).toBe('flag_off')
  })
})

describe('المواضعُ الستّة — شعبةُ فصلٍ لم تُفتح نافذتُه تُردّ', () => {
  it('١· السلّة: تُستبعد بسببٍ يقول متى يبدأ التسجيل', async () => {
    const u = await learner()
    const term = await futureTerm()
    const c = await cohort(nextCourse(), term.id)

    const classified = await cart.classifyCart(u, [c.id])
    expect(classified.buyable.map((b) => b.id)).not.toContain(c.id)
    expect(classified.excluded.map((e) => e.cohortId)).toContain(c.id)
    /* والسببُ يقول متى يبدأ، لا «مغلق» وحدَها */
    expect(classified.excluded.find((e) => e.cohortId === c.id)!.messageAr).toContain('يبدأ')
  })

  it('٢· التسجيل المباشر: يُرفض بـ409', async () => {
    const u = await learner()
    const term = await futureTerm()
    const c = await cohort(nextCourse(), term.id)

    await expect(enrollments.enroll(c.id, u, null)).rejects.toMatchObject({ status: 409 })
  })

  it('٣· التبديل بين الشعب: لا يُنقل إلى شعبةِ فصلٍ لم يُفتح', async () => {
    const u = await learner()
    const courseId = nextCourse()
    const from = await cohort(courseId, null)
    const term = await futureTerm()
    const to = await cohort(courseId, term.id)

    const e = await enrollments.enroll(from.id, u, null)
    await expect(enrollments.switchCohort(u, e.id, to.id)).rejects.toMatchObject({ status: 409 })
  })

  it('٤· إنشاءُ الطلب: يُرفض بـ409', async () => {
    const u = await learner()
    const term = await futureTerm()
    const c = await cohort(nextCourse(), term.id)

    await expect(commerce.requestEnrollment(u, c.id)).rejects.toMatchObject({ status: 409 })
  })

  it('٥· شعبُ الخطّة: الدورةُ تُعرض «بانتظار شعبة» لا «قابلةً للجدولة»', async () => {
    const u = await learner()
    const courseId = nextCourse()
    const term = await futureTerm()
    await cohort(courseId, term.id)
    await plans.adopt(u, { nameAr: 'خطّتي', composed: true, courseIds: [courseId] })

    const view = await plans.active(u)
    const item = view!.items.find((i) => i.courseId === courseId)
    expect(item!.state).toBe('awaiting_cohort')
    expect(item!.cohort).toBeNull()
  })

  it('٦· الكتالوجُ العامّ: لا تُعرض للزائر', async () => {
    const term = await futureTerm()
    const c = await cohort(nextCourse(), term.id)

    const rows = await publicCatalog.cohorts()
    expect(rows.map((r) => r.id)).not.toContain(c.id)
  })
})

describe('والقائمُ لا يُبطَل — شعبةٌ بلا فصلٍ تمرّ في المواضع الستّة', () => {
  it('تُشترى، وتُسجَّل، وتُعرض في الخطّة والكتالوج', async () => {
    const u = await learner()
    const courseId = nextCourse()
    const c = await cohort(courseId, null)

    const classified = await cart.classifyCart(u, [c.id])
    expect(classified.buyable.map((b) => b.id)).toContain(c.id)

    await plans.adopt(u, { nameAr: 'خطّتي', composed: true, courseIds: [courseId] })
    const view = await plans.active(u)
    expect(view!.items.find((i) => i.courseId === courseId)!.state).toBe('schedulable')

    const rows = await publicCatalog.cohorts()
    expect(rows.map((r) => r.id)).toContain(c.id)

    /* والتسجيلُ نفسُه — آخرَ ما يُقاس لأنّه يستهلك المقعد */
    const e = await enrollments.enroll(c.id, u, null)
    expect(e.status).toBe('enrolled')
  })

  it('وشعبةُ فصلٍ نافذتُه مفتوحةٌ الآن تمرّ كذلك', async () => {
    const u = await learner()
    const courseId = nextCourse()
    const term = await prisma.term.create({
      data: {
        year: 2080, season: 'feb_apr', titleAr: 'فصلٌ نافذتُه مفتوحة',
        startsOn: new Date(Date.now() + 60 * DAY), endsOn: new Date(Date.now() + 120 * DAY),
        registrationOpensAt: new Date(Date.now() - 10 * DAY),
        registrationClosesAt: new Date(Date.now() + 10 * DAY),
        status: 'open',
      },
    })
    const c = await cohort(courseId, term.id)

    const classified = await cart.classifyCart(u, [c.id])
    expect(classified.buyable.map((b) => b.id)).toContain(c.id)

    const rows = await publicCatalog.cohorts()
    expect(rows.map((r) => r.id)).toContain(c.id)
  })
})

/* ═══ وشعبةُ مدرّبٍ لم تُعتمَد خطّتُه تُردّ في المواضع الستّة (٣ج) ═══

   «التسجيلُ يُفتح بعد الاعتماد». والشرطُ يُقرأ في كائن الشعبة (السلّة والتسجيل
   والتبديل والطلب) وفي لغة الاستعلام (الخطّة والكتالوج) — ويُسأل كلٌّ بعينه: لو
   نُسي تحميلُ الخطط في موضعٍ لباع مقعدا في شعبةٍ لم يقرأ أحدٌ منهجَها. */
describe('المواضعُ الستّة — شعبةٌ خطّةُ مدرّبها لم تُعتمَد تُردّ', () => {
  const awaiting = async (courseId: string) => {
    const c = await cohort(courseId, null)
    await trainerPlan(c.id, 'submitted')
    return c
  }

  it('١· السلّة: تُستبعد بسببها', async () => {
    const u = await learner()
    const c = await awaiting(nextCourse())
    const classified = await cart.classifyCart(u, [c.id])
    expect(classified.buyable.map((b) => b.id)).not.toContain(c.id)
    const out = classified.excluded.find((e) => e.cohortId === c.id)!
    expect(out.reason).toBe('awaiting_plan')
    expect(out.messageAr).toContain('حين تُعتمَد خطّةُ مدرّبها')
  })

  it('٢· التسجيل المباشر: يُرفض بـ409', async () => {
    const u = await learner()
    const c = await awaiting(nextCourse())
    await expect(enrollments.enroll(c.id, u, null)).rejects.toMatchObject({ status: 409 })
  })

  it('٣· التبديل: لا يُنقل إليها', async () => {
    const u = await learner()
    const courseId = nextCourse()
    const from = await cohort(courseId, null)
    const to = await awaiting(courseId)
    const e = await enrollments.enroll(from.id, u, null)
    await expect(enrollments.switchCohort(u, e.id, to.id)).rejects.toMatchObject({ status: 409 })
  })

  it('٤· إنشاءُ الطلب: يُرفض بـ409', async () => {
    const u = await learner()
    const c = await awaiting(nextCourse())
    await expect(commerce.requestEnrollment(u, c.id)).rejects.toMatchObject({ status: 409 })
  })

  it('٥· شعبُ الخطّة: الدورةُ «بانتظار شعبة»', async () => {
    const u = await learner()
    const courseId = nextCourse()
    await awaiting(courseId)
    await plans.adopt(u, { nameAr: 'خطّتي', composed: true, courseIds: [courseId] })
    const item = (await plans.active(u))!.items.find((i) => i.courseId === courseId)
    expect(item!.state).toBe('awaiting_cohort')
  })

  it('٦· الكتالوجُ العامّ: لا تُعرض — وتُعرض حين تُعتمَد', async () => {
    const c = await awaiting(nextCourse())
    expect((await publicCatalog.cohorts()).map((r) => r.id)).not.toContain(c.id)
    /* والاعتمادُ يفتحها — فالشرطُ لا يحجب ما اعتُمد */
    await prisma.cohortDeliveryPlan.updateMany({ where: { cohortId: c.id }, data: { status: 'approved' } })
    expect((await publicCatalog.cohorts()).map((r) => r.id)).toContain(c.id)
  })
})

/* ═══ والالتحاقُ حتّى الموعد الثاني (٣ج) ═══ */
describe('بعد بدء الموعد الثاني — يُردّ الالتحاق، وقبله يُقبل', () => {
  const started = async (courseId: string, closesInMs: number) => {
    const c = await cohort(courseId, null)
    await trainerPlan(c.id, 'approved')
    await prisma.cohort.update({ where: { id: c.id }, data: { joinClosesAt: new Date(Date.now() + closesInMs) } })
    return c
  }

  it('⚠️ السلّةُ والتسجيل: يُردّان بعده بسببهما', async () => {
    const u = await learner()
    const c = await started(nextCourse(), -DAY)
    const out = (await cart.classifyCart(u, [c.id])).excluded.find((e) => e.cohortId === c.id)!
    expect(out.reason).toBe('late_closed')
    await expect(enrollments.enroll(c.id, u, null)).rejects.toMatchObject({ status: 409 })
  })

  it('⚠️ والخطّةُ والكتالوج: لا تُعرض بعده', async () => {
    const u = await learner()
    const courseId = nextCourse()
    const c = await started(courseId, -DAY)
    expect((await publicCatalog.cohorts()).map((r) => r.id)).not.toContain(c.id)
    await plans.adopt(u, { nameAr: 'خطّتي', composed: true, courseIds: [courseId] })
    expect((await plans.active(u))!.items.find((i) => i.courseId === courseId)!.state).toBe('awaiting_cohort')
  })

  it('⚠️ وقبله تُشترى وتُعرض — ملتحقٌ متأخّرٌ يُقبل', async () => {
    const u = await learner()
    const c = await started(nextCourse(), DAY)
    expect((await cart.classifyCart(u, [c.id])).buyable.map((b) => b.id)).toContain(c.id)
    expect((await publicCatalog.cohorts()).map((r) => r.id)).toContain(c.id)
  })
})
