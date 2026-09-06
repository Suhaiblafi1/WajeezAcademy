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
import { termWindowVerdict, cohortAcceptsRegistration } from '../../services/registration-window'

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

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  plans = new PlanService(prisma)
  commerce = new CommerceService(prisma)
  enrollments = new EnrollmentService(prisma)
  publicCatalog = new PublicCatalogService(prisma)
  cart = new CartService(prisma)
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
    const off = cohortAcceptsRegistration({ registrationOpen: false, title: 'شعبتي', term: open })
    expect(off.open).toBe(false)
    expect(off.open === false && off.code).toBe('flag_off')
    expect(off.open === false && off.reasonAr).toContain('شعبتي')
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
