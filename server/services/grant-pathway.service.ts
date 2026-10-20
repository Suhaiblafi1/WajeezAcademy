/* مساراتُ المنحة — يُعدّها صاحبُ المنصّة من شاشة المنحة (٢٠ أكتوبر ٢٠٢٦).

   قرارُه: «المسارات التي تحدّثتَ عنها ستكون نحن من أعددناها وتظهر له … اختر إحدى المسارات التالية
   … يحقّ لك فقط ٤ دورات»، ثمّ اختار أن تُبنى **جديدةً من شاشة المنحة** لا من المسارات المنشورة:
   اسمٌ ودوراتٌ يختارها، فيرى هامشَ المسار ساعتَها.

   ═══ ما يقع ═══

   ١) **لا دورةَ في مسارٍ بلا شعبةٍ تُشترى اليوم** — يُفحص عند الحفظ: مفتوحةٌ للتسجيل بسعرٍ ومقاعد.
      وما أُغلقت شعبتُه بعد الحفظ يُقال في الشاشة («بلا شعبة مفتوحة»)، ولا يُعرض للمشتري.
   ١ب) **ولا دورةَ بلا مدرّبٍ منشور، ولا دورةَ غيرُ منشورة** — قرارُ صاحب المنصّة (٢٠ أكتوبر ٢٠٢٦): «لا
      أريد أن يظهر له أيُّ دورةٍ أو أيُّ مسارٍ لم يكن له مدرّبٌ ومنشور». فالشعبةُ لا تُحسب إلّا ودورتُها
      منشورةٌ ومدرّبُها (أصيلُها أو إسنادُه النشط) معتمَدُ النشر بالبوّابة نفسِها التي تعرض المدرّبين
      للعامّة (`PUBLIC_TRAINER_WHERE`). ومنه: «إذا أضفتُ دورةً جديدةً ومدرّبا جديدا يظهر تلقائيّا» — فكلُّ
      ما يُقرأ هنا يُقرأ ساعةَ الطلب، لا قائمةٌ تُحفظ: شعبةٌ تُفتح تظهر، وشعبةٌ تُغلق تختفي.
   ١ج) **ومن الفصل القادم القريب وحدَه** — قرارُ صاحب المنصّة (٢٠ أكتوبر ٢٠٢٦): «اجعل الافتراضيَّ كلَّ الدورات
      المفعّلة ولها مدرّبٌ ولها شعبةٌ مفتوحةٌ للفصل القادم القريب». وكانت القائمةُ تخلط شعبا تبدأ من أكتوبر
      ٢٠٢٦ إلى نوفمبر ٢٠٢٧. فالفصلُ فصلُ أقرب شعبةٍ تُشترى ولم تبدأ بعد، ويُحسب **من يوم بدئها في عمّان**
      لا من `termId` — فشعبُ الإنتاج كلُّها بلا فصلٍ مربوط (`trainer-visibility.ts`)، وشعبةٌ تبدأ أوّلَ نوفمبر
      في عمّان تُخزَّن ٣١ أكتوبر بتوقيت غرينتش. ويدخل من ذلك الفصل ما بدأ وما زال يقبل التسجيل. فإن لم تبقَ
      شعبةٌ لم تبدأ، عُرض ما يُشترى كلُّه لا صفحةٌ فارغة.
   ٢) **ولا يتجاوز حدَّ دورات المنحة** (`maxCourses`).
   ٣) **وهامشُ المسار كلِّه** — أقربُ شعبةٍ لكلّ دورة: سعرُها، وما يدفعه صاحبُ المنحة عن المسار كلِّه،
      وأجورُ مقاعدها للمدرّبين، والفرق. ومعه سعرُ الباقة بلا منحة ليُرى ما توفّره.

   والحارس: `server/tests/commerce/grant-pathways.test.ts`. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { GrantService } from './grant.service'
import { cohortAcceptsRegistration, PLAN_GATE_SELECT, TERM_WINDOW_SELECT } from './registration-window'
import { PUBLIC_TRAINER_WHERE } from './trainer-visibility'
import { LEDGER_CURRENCY } from '../../src/application/commerce/presentment'
import { bundlePayable, money } from '../../src/application/commerce/discount-policy'
import { grantPrice } from '../../src/application/commerce/grant'
import { termOf, termTitleAr } from '../../src/application/terms/season'
import { zonedDay } from '../../src/application/trainer/cohort-period'

/** أقربُ شعبةٍ تُشترى اليوم لدورة */
export interface BuyableCohort {
  cohortId: string
  courseId: string
  courseTitleAr: string
  cohortTitle: string
  price: number
  currency: string
  startsAt: Date | null
  seatsLeft: number | null
}

export interface GrantPathwayInput {
  titleAr: string
  blurbAr?: string | null
  courseIds: string[]
  sortOrder?: number
  active?: boolean
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** فصلُ الشعبة بيوم بدئها في عمّان — مفتاحُه وعنوانُه */
function termAt(at: Date): { key: string; titleAr: string } {
  const t = termOf(new Date(`${zonedDay(at)}T00:00:00Z`))
  return { key: `${t.year}-${t.season}`, titleAr: termTitleAr(t.year, t.season) }
}

/** ما يُعرض في المنحة: فصلُه، وأقربُ شعبةٍ تُشترى لكلّ دورةٍ فيه */
export interface GrantPool {
  termAr: string | null
  byCourse: Map<string, BuyableCohort>
}

export class GrantPathwayService {
  private prisma: PrismaClient
  private grants: GrantService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.grants = new GrantService(prisma)
  }

  /** ما يُعرض في المنحة — كلُّ دورةٍ منشورةٍ لها شعبةٌ تُشترى في الفصل القادم القريب، بالشروط التي يشتري
      بها لوحُ الدفع: مفتوحةٌ للتسجيل (`cohortAcceptsRegistration`)، بسعرٍ بعملة الدفتر، ومدرّبُها منشور، وفيها
      مقعد. ويُقرأ كلُّه ساعةَ الطلب: شعبةٌ تُفتح تظهر، وشعبةٌ تُغلق تختفي. */
  async pool(now = new Date()): Promise<GrantPool> {
    const cohorts = await this.prisma.cohort.findMany({
      where: {
        status: { in: ['open', 'active'] }, price: { gt: 0 }, currency: LEDGER_CURRENCY,
        course: { status: 'published' },
        /* ومدرّبُها منشور: أصيلُها، أو إسنادُه النشطُ فيها (قاعدةُ `cohort-lead.ts`) */
        OR: [
          { trainers: { some: { role: 'lead', profile: PUBLIC_TRAINER_WHERE } } },
          { assignments: { some: { status: 'active', profile: PUBLIC_TRAINER_WHERE } } },
        ],
      },
      include: {
        course: { select: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
        term: TERM_WINDOW_SELECT,
        plans: PLAN_GATE_SELECT,
      },
      orderBy: [{ startsAt: 'asc' }, { title: 'asc' }],
    })
    const open = cohorts.filter((c) => cohortAcceptsRegistration(c, now).open)
    const ids = open.map((c) => c.id)
    const [enrolled, held] = await Promise.all([
      this.prisma.enrollment.groupBy({ by: ['cohortId'], where: { cohortId: { in: ids }, status: 'enrolled' }, _count: true }),
      this.prisma.enrollmentRequest.groupBy({ by: ['cohortId'], where: { cohortId: { in: ids }, status: 'seat_held' }, _count: true }),
    ])
    const taken = new Map<string, number>()
    for (const g of [...enrolled, ...held]) taken.set(g.cohortId, (taken.get(g.cohortId) ?? 0) + g._count)
    const seatsOf = (c: (typeof open)[number]) => (c.capacity ? c.capacity - (taken.get(c.id) ?? 0) : null)
    const withSeat = open.filter((c) => { const n = seatsOf(c); return n === null || n > 0 })

    /* الفصلُ القادمُ القريب: فصلُ أقرب شعبةٍ لم تبدأ — مرتّبةٌ بيوم بدئها، فأوّلُها أقربُها */
    const next = withSeat.find((c) => c.startsAt !== null && c.startsAt > now)
    const term = next ? termAt(next.startsAt!) : null
    const inTerm = term ? withSeat.filter((c) => c.startsAt !== null && termAt(c.startsAt).key === term.key) : withSeat

    const byCourse = new Map<string, BuyableCohort>()
    for (const c of inTerm) {
      if (byCourse.has(c.courseId)) continue
      byCourse.set(c.courseId, {
        cohortId: c.id, courseId: c.courseId, courseTitleAr: c.course.versions[0]?.titleAr ?? c.courseId,
        cohortTitle: c.title, price: Number(c.price), currency: c.currency, startsAt: c.startsAt, seatsLeft: seatsOf(c),
      })
    }
    return { termAr: term?.titleAr ?? null, byCourse }
  }

  /** أقربُ شعبةٍ تُشترى في المنحة لكلّ دورة — من `pool`، وبلا قائمةٍ كلُّ دوراته */
  async buyable(courseIds?: readonly string[], now = new Date()): Promise<Map<string, BuyableCohort>> {
    const { byCourse } = await this.pool(now)
    if (!courseIds) return byCourse
    const want = new Set(courseIds)
    return new Map([...byCourse].filter(([id]) => want.has(id)))
  }

  /** الدوراتُ التي تُختار في المنحة وفصلُها — ما له شعبةٌ تُشترى في الفصل القادم القريب */
  async openCourses(now = new Date()): Promise<{ termAr: string | null; courses: BuyableCohort[] }> {
    const { termAr, byCourse } = await this.pool(now)
    return { termAr, courses: [...byCourse.values()].sort((a, b) => a.courseTitleAr.localeCompare(b.courseTitleAr, 'ar')) }
  }

  /** المساراتُ بدوراتها وأقرب شعبةٍ لكلٍّ وهامشِها — بنسبةٍ تُمرَّر لتُجرَّب، وبلا قيمةٍ نسبةُ الحملة */
  async list(opts: { percentOff?: number; activeOnly?: boolean; withCosts?: boolean } = {}, now = new Date()) {
    const c = await this.grants.campaign()
    const pct = opts.percentOff ?? c.percentOff
    const rows = await this.prisma.grantPathway.findMany({
      where: { campaignId: c.id, ...(opts.activeOnly ? { active: true } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    const allCourses = [...new Set(rows.flatMap((p) => p.courseIds))]
    const [buy, titles] = await Promise.all([
      this.buyable(allCourses, now),
      this.prisma.courseVersion.findMany({
        where: { courseId: { in: allCourses } }, orderBy: { version: 'desc' }, select: { courseId: true, titleAr: true },
      }),
    ])
    const titleOf = new Map<string, string>()
    for (const t of titles) if (!titleOf.has(t.courseId)) titleOf.set(t.courseId, t.titleAr)
    const cohorts = [...buy.values()]
    /* وأجورُ المدرّبين لا تُقرأ لصفحة الحملة — لا تخرج من الإدارة (`grant-landing.service.ts`) */
    const costs = opts.withCosts === false
      ? new Map<string, { seatCost: number | null }>()
      : await this.grants.seatCosts(cohorts.map((b) => ({ id: b.cohortId, courseId: b.courseId, price: b.price })))

    return {
      percentOff: pct,
      maxCourses: c.maxCourses,
      pathways: rows.map((p) => {
        const courses = p.courseIds.map((courseId) => {
          const b = buy.get(courseId) ?? null
          return {
            courseId, titleAr: b?.courseTitleAr ?? titleOf.get(courseId) ?? courseId, cohort: b,
            seatCost: b ? costs.get(b.cohortId)?.seatCost ?? null : null,
          }
        })
        const live = courses.filter((x) => x.cohort !== null)
        const listTotal = money(live.reduce((s, x) => s + x.cohort!.price, 0))
        const grantTotal = grantPrice(listTotal, pct)
        const costKnown = live.every((x) => x.seatCost !== null)
        const seatCostTotal = costKnown ? r2(live.reduce((s, x) => s + (x.seatCost ?? 0), 0)) : null
        return {
          id: p.id, titleAr: p.titleAr, blurbAr: p.blurbAr, sortOrder: p.sortOrder, active: p.active,
          courses,
          /* دوراتٌ أُغلقت شعبُها بعد الحفظ — تُقال لصاحب المنصّة، ولا تُعرض للمشتري */
          missing: courses.length - live.length,
          listTotal,
          /* ما يدفعه بلا منحة: سلّمُ الباقة وسقفُها — ليُرى ما توفّره المنحة */
          bundleTotal: bundlePayable(listTotal, live.length),
          grantTotal,
          seatCostTotal,
          margin: seatCostTotal === null ? null : r2(grantTotal - seatCostTotal),
        }
      }),
    }
  }

  /** يُحفظ مسارٌ جديدٌ أو يُعدَّل — ولا دورةَ فيه بلا شعبةٍ تُشترى اليوم */
  async save(id: string | null, input: GrantPathwayInput, actorId: string, now = new Date()) {
    const c = await this.grants.campaign()
    const titleAr = input.titleAr.trim()
    if (titleAr.length < 3) throw new AuthError('bad_title', 'اكتب اسما للاقتراح', 400)
    const courseIds = [...new Set(input.courseIds)]
    if (courseIds.length === 0) throw new AuthError('no_courses', 'اختر دورة واحدة على الأقل', 400)
    if (courseIds.length > c.maxCourses) {
      throw new AuthError('too_many', `الاقتراح ${c.maxCourses} دورات بحد أقصى، مثل حد المنحة`, 400)
    }
    const buy = await this.buyable(courseIds, now)
    const closed = courseIds.filter((x) => !buy.has(x))
    if (closed.length > 0) throw new AuthError('no_cohort', `${closed.length} من الدورات ليست من دورات المنحة: بلا شعبة مفتوحة بمدرب منشور في فصلها`, 409)
    const data = {
      titleAr, blurbAr: input.blurbAr?.trim() || null, courseIds,
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    }
    const row = id
      ? await this.prisma.grantPathway.update({ where: { id, campaignId: c.id }, data })
      : await this.prisma.grantPathway.create({ data: { ...data, campaignId: c.id } })
    await recordAudit(this.prisma, {
      actorId, action: 'coupon.grant_pathway_save', entityType: 'grant_campaign', entityId: c.id,
      meta: { pathwayId: row.id, titleAr, courseIds, active: row.active },
    })
    return row
  }

  async remove(id: string, actorId: string) {
    const c = await this.grants.campaign()
    const row = await this.prisma.grantPathway.delete({ where: { id, campaignId: c.id } })
    await recordAudit(this.prisma, {
      actorId, action: 'coupon.grant_pathway_remove', entityType: 'grant_campaign', entityId: c.id,
      meta: { pathwayId: row.id, titleAr: row.titleAr },
    })
  }
}
