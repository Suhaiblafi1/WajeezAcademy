/* «افتح الفصل» — التوزيعُ ثمّ الفتح، بمعاينةٍ قبل التطبيق (البندان ٤٨ · ٤٩).

   ─────────── ما يحلّه ───────────

   «افتح كلَّ الشعب» يفتحها **كلَّها في تاريخٍ واحد**: أسابيعُ من اليوم، ثمّ
   ثمانون شعبةً تبدأ في اليوم نفسِه. فتقع دورتا مسارٍ واحدٍ معا، ويتزاحم
   ما يتشابه، ولا يُوزَّع حملٌ على أشهر الفصل الثلاثة.

   وهذا يستبدل التاريخَ الواحدَ بجدولٍ محسوب: لكلّ شعبةٍ أسبوعُها، وشهرُها
   داخل الفصل، **وأعلى تزاحمٍ قبِله المخطِّط** — فيرى الإنسانُ المقايضةَ.

   ─────────── والمعاينةُ قبل التطبيق عقدٌ قائم ───────────

   الافتراضيُّ **ألّا يُطبَّق**: يُعرض الجدولُ أوّلا، فإن رضيه الإنسانُ طبّقه.
   وهذا عقدُ المنصّة في كلّ إجراءٍ جماعيّ، لا استثناءَ هنا.

   ─────────── والفتحُ يمرّ بالبوّابة نفسِها ───────────

   لا بابَ خلفيّ: تُنشأ الشعبةُ مسوّدةً بجلساتها وخطّتها، ثمّ تُعرَض على
   شروط الفتح الستّة. وما نقصه شيءٌ يبقى مسوّدةً **ونقصُه مكتوبٌ في صفّه**. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { CohortService } from './cohort.service'
import { planTerm, type PlannableCourse, type PlannerSlot } from '../../src/application/terms/planner'
import { monthWithinTerm } from '../../src/application/terms/season'
import type { TrainingSeason } from '../../src/application/trainer/application-options'

/* الشعبُ الحيّةُ أو المهيّأةُ لا تُكرَّر — النمطُ نفسُه في «افتح كلَّ الشعب» */
const EXISTING = ['open', 'full', 'active', 'completed', 'draft'] as const
const SESSION_WEEKS = 6
const DEFAULT_CAPACITY = 20

export interface TermPlanRow {
  courseId: string
  titleAr: string
  week: number
  startsAt: string
  monthWithinTerm: number
  price: number
  currency: string
  worstCollisionAr: string | null
  orderBreachAr: string | null
  pinned: boolean
  /** ما منع فتحَها بعد التهيئة — تبقى مسوّدةً ونقصُها مكتوب */
  blocked?: string[]
}

export interface TermPlanResult {
  applied: boolean
  termId: string
  termTitleAr: string
  rows: TermPlanRow[]
  unplaced: { courseId: string; titleAr: string; whyAr: string }[]
  skipped: { courseId: string; titleAr: string; whyAr: string }[]
  loadByMonth: Record<number, number>
  totalPenalty: number
  opened: number
  prepared: number
}

export class TermPlanningService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** يبني أسابيعَ الفصل — أسبوعٌ لكلّ إثنين داخل حدوده */
  private slotsOf(startsOn: Date, endsOn: Date, year: number, season: TrainingSeason): PlannerSlot[] {
    const slots: PlannerSlot[] = []
    const cursor = new Date(startsOn)
    let week = 0
    while (cursor <= endsOn) {
      const m = monthWithinTerm(cursor, year, season)
      if (m) slots.push({ week, startsAt: new Date(cursor), monthWithinTerm: m })
      cursor.setUTCDate(cursor.getUTCDate() + 7)
      week++
    }
    return slots
  }

  async planAndOpen(
    termId: string,
    opts: { apply: boolean; actorId?: string; weeklyCap?: number; capacity?: number },
  ): Promise<TermPlanResult> {
    const term = await this.prisma.term.findUnique({ where: { id: termId } })
    if (!term) throw new AuthError('not_found', 'الفصل غير موجود', 404)

    const courses = await this.prisma.course.findMany({
      where: { status: 'published' },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } },
        cohorts: { select: { status: true } },
        skillLinks: { select: { skillId: true } },
      },
      orderBy: { id: 'asc' },
    })

    const skipped: TermPlanResult['skipped'] = []
    const plannable: PlannableCourse[] = []
    const meta = new Map<string, { titleAr: string; price: number; currency: string }>()

    for (const c of courses) {
      const titleAr = c.versions[0]?.titleAr ?? c.id
      if (c.cohorts.some((h) => (EXISTING as readonly string[]).includes(h.status))) {
        skipped.push({ courseId: c.id, titleAr, whyAr: 'لها شعبةٌ قائمةٌ أو مهيّأة' })
        continue
      }
      if (c.listPrice === null) {
        skipped.push({ courseId: c.id, titleAr, whyAr: 'بلا سعر قائمة — لا تُفتح بسعرٍ مُختلَق' })
        continue
      }
      meta.set(c.id, { titleAr, price: Number(c.listPrice), currency: c.listCurrency ?? 'USD' })
      plannable.push({
        courseId: c.id,
        pathwayId: c.homePathwayId,
        sequence: c.homeSequence,
        domainAr: c.domainAr,
        collisionGroup: c.collisionGroup,
        skillSlugs: c.skillLinks.map((s) => s.skillId),
        /* عائلةُ المهارة من بادئة معرِّفها — إشارةٌ خشنةٌ فأقلُّ وزنا في العقوبة */
        skillFamilies: [...new Set(c.skillLinks.map((s) => s.skillId.split('-')[1] ?? s.skillId))],
        weeks: SESSION_WEEKS,
      })
    }

    /* المثبَّتُ: شعبٌ ثبّتها إنسانٌ في هذا الفصل — يُخطَّط حولَها */
    const pinnedCohorts = await this.prisma.cohort.findMany({
      where: { termId, scheduleLockedAt: { not: null }, startsAt: { not: null } },
      select: { courseId: true, startsAt: true },
    })
    const slots = this.slotsOf(term.startsOn, term.endsOn, term.year, term.season as TrainingSeason)
    const pinned: Record<string, number> = {}
    for (const p of pinnedCohorts) {
      const at = slots.find((s) => s.startsAt.getTime() >= p.startsAt!.getTime())
      if (at) pinned[p.courseId] = at.week
    }

    const plan = planTerm({
      courses: plannable, slots, pinned, weeklyCap: opts.weeklyCap,
    })

    const rows: TermPlanRow[] = plan.rows.map((r) => {
      const m = meta.get(r.courseId)!
      return {
        courseId: r.courseId, titleAr: m.titleAr,
        week: r.week, startsAt: r.startsAt.toISOString(), monthWithinTerm: r.monthWithinTerm,
        price: m.price, currency: m.currency,
        worstCollisionAr: r.worstCollision
          ? `أعلى تزاحمٍ مقبول (${r.worstCollision.penalty}) مع «${r.worstCollision.withCourseId}»: ${r.worstCollision.whyAr}`
          : null,
        orderBreachAr: r.orderBreachAr,
        pinned: r.pinned,
      }
    })

    const result: TermPlanResult = {
      applied: opts.apply, termId, termTitleAr: term.titleAr, rows,
      unplaced: plan.unplaced.map((u) => ({
        courseId: u.courseId, titleAr: meta.get(u.courseId)?.titleAr ?? u.courseId, whyAr: u.whyAr,
      })),
      skipped, loadByMonth: plan.loadByMonth, totalPenalty: plan.totalPenalty,
      opened: 0, prepared: 0,
    }

    if (!opts.apply) return result

    const service = new CohortService(this.prisma)
    const actor = opts.actorId ?? null
    const capacity = Math.min(Math.max(opts.capacity ?? DEFAULT_CAPACITY, 1), 500)

    for (const row of rows) {
      const startsAt = new Date(row.startsAt)
      startsAt.setUTCHours(15, 0, 0, 0) /* ١٨:٠٠ بتوقيت عمّان */
      const cohort = await this.prisma.cohort.create({
        data: {
          courseId: row.courseId, title: `${row.titleAr} — ${term.titleAr}`, status: 'draft',
          startsAt, termId, plannedMonth: row.monthWithinTerm,
          daysOfWeek: ['tue', 'thu'], startTime: '18:00', timezone: 'Asia/Amman',
          capacity, price: row.price, currency: row.currency,
          language: 'العربية', deliveryMode: 'remote',
          registrationOpen: false, financialReady: true,
        },
      })
      await service.generateSessions(actor, cohort.id, { weeks: SESSION_WEEKS, apply: true })
        .catch(() => undefined)
      await service.setDeliveryPlan(cohort.id, actor, {
        notesAr:
          `تقديمٌ عن بُعد بجلساتٍ أسبوعيّةٍ يومَي الثلاثاء والخميس ٦ مساءً بتوقيت عمّان، ` +
          `${SESSION_WEEKS} أسابيع، ضمن ${term.titleAr} (الشهر ${row.monthWithinTerm}). ` +
          `خطّةٌ أساسيّةٌ أُنشئت مع الشعبة، وتُحرَّر من بطاقتها.`,
        deliveryMode: 'remote',
      }).catch(() => undefined)

      const check = await service.openChecklist(cohort.id)
      if (check.ready) {
        await service.open(cohort.id, actor)
        result.opened++
      } else {
        row.blocked = check.missing
        result.prepared++
      }
    }

    /* حدثٌ واحدٌ بالخطّة كاملةً في بياناته — لا ثمانون حدثا يُقرأ منها لا شيء */
    await recordAudit(this.prisma, {
      actorId: actor, action: 'term.plan_open', entityType: 'term', entityId: termId,
      meta: {
        opened: result.opened, prepared: result.prepared,
        unplaced: result.unplaced.length, skipped: skipped.length,
        totalPenalty: plan.totalPenalty, loadByMonth: plan.loadByMonth,
        plan: rows.map((r) => ({ courseId: r.courseId, week: r.week, month: r.monthWithinTerm })),
      },
    })
    return result
  }
}
