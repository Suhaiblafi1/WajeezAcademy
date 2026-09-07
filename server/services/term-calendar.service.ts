/* تقويمُ الفصل — ما يُعرض للزائر وما يُضاف للطالب (البند ٥٠).

   ─────────── ما ينقص اليوم ───────────

   الرئيسةُ **لا تعرض بياناتِ شعبٍ إطلاقا**، والطالبُ **ليس عنده تقويمٌ في
   بوّابته أصلا**. والشاشةُ الزمنيّةُ الوحيدةُ في المنصّة كلِّها جدولُ المدرّب.

   ─────────── وما لا يُعرض ───────────

   · **قبل نشر التقويم**: الفصلُ المخطَّطُ ليس وعدا. فما لم يُنشَر تقويمُه
     لا تُعرض شعبُه للزائر — وهذا حقلٌ صريحٌ في الفصل لا اجتهاد.
   · **أسماءُ المدرّبين**: من اعتُمد نشرُه وحدَه. وهذه قاعدةُ المنصّة
     المعلَنة: «لا اسمَ مدرّبٍ يُعرض كحقيقة قبل اعتماده».
   · **الجلسات**: لا تُعرض للزائر. مواعيدُ الجلسات تفصيلُ من اشترى. */

import type { PrismaClient } from '@prisma/client'
import { TermService } from './term.service'

export interface CalendarEntry {
  cohortId: string
  courseId: string
  titleAr: string
  domainAr: string | null
  pathwayId: string | null
  startsAt: string | null
  monthWithinTerm: number | null
  daysOfWeek: string[]
  startTime: string | null
  price: string | null
  currency: string
  seatsLeft: number | null
  /** اسمُ المدرّب — لمن اعتُمد نشرُه وحدَه */
  trainerNameAr: string | null
  /** أمسجَّلٌ فيها صاحبُ الجلسة؟ — للنسخة المُشخصَنة وحدَها */
  enrolled?: boolean
}

export interface TermCalendar {
  termId: string
  titleAr: string
  startsOn: string
  endsOn: string
  registrationOpen: boolean
  registrationOpensAt: string | null
  months: { month: number; entries: CalendarEntry[] }[]
  total: number
}

export class TermCalendarService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** تقويمُ الفصل — عامٌّ افتراضا، ومُشخصَنٌ إن مُرِّر صاحبُ جلسة */
  async calendar(options: { termId?: string; userId?: string } = {}): Promise<TermCalendar | null> {
    const terms = new TermService(this.prisma)
    const term = options.termId
      ? await this.prisma.term.findUnique({ where: { id: options.termId } })
      : await terms.upcoming()
    if (!term) return null
    /* الفصلُ المخطَّطُ ليس وعدا — ولا تقويمَ قبل نشره */
    if (!term.calendarPublishedAt) return null

    const cohorts = await this.prisma.cohort.findMany({
      where: { termId: term.id, status: { in: ['open', 'full', 'active'] } },
      include: {
        course: {
          select: {
            id: true, domainAr: true, homePathwayId: true,
            versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } },
          },
        },
        trainers: {
          where: { role: 'lead' },
          include: {
            profile: {
              select: {
                publicVisibility: true, publishApprovedAt: true,
                application: { select: { fullName: true } },
              },
            },
          },
        },
        _count: { select: { enrollments: true } },
        enrollments: options.userId
          ? { where: { userId: options.userId }, select: { id: true } }
          : false,
      },
      orderBy: [{ plannedMonth: 'asc' }, { startsAt: 'asc' }],
    })

    const entries: CalendarEntry[] = cohorts.map((c) => {
      const lead = c.trainers[0]?.profile
      /* «لا اسمَ مدرّبٍ يُعرض كحقيقة قبل اعتماد نشره» — قاعدةٌ لا استثناء */
      const named = lead?.publicVisibility && lead.publishApprovedAt !== null
      return {
        cohortId: c.id,
        courseId: c.courseId,
        titleAr: c.course.versions[0]?.titleAr ?? c.courseId,
        domainAr: c.course.domainAr,
        pathwayId: c.course.homePathwayId,
        startsAt: c.startsAt?.toISOString() ?? null,
        monthWithinTerm: c.plannedMonth,
        daysOfWeek: c.daysOfWeek,
        startTime: c.startTime,
        price: c.price?.toString() ?? null,
        currency: c.currency,
        seatsLeft: c.capacity === null ? null : Math.max(0, c.capacity - c._count.enrollments),
        trainerNameAr: named ? lead.application.fullName : null,
        ...(options.userId ? { enrolled: (c.enrollments as { id: string }[]).length > 0 } : {}),
      }
    })

    const months = [1, 2, 3].map((month) => ({
      month,
      entries: entries.filter((e) => e.monthWithinTerm === month),
    }))
    /* وما لا شهرَ له — شعبةٌ أُنشئت يدويّا في الفصل بلا تخطيط — يُلحق بالأوّل
       ولا يُحذف: الغيابُ من التقويم أسوأُ من موضعٍ تقريبيّ. */
    const orphan = entries.filter((e) => e.monthWithinTerm === null)
    if (orphan.length > 0) months[0].entries.push(...orphan)

    return {
      termId: term.id,
      titleAr: term.titleAr,
      startsOn: term.startsOn.toISOString(),
      endsOn: term.endsOn.toISOString(),
      registrationOpen: TermService.registrationOpen(term),
      registrationOpensAt: term.registrationOpensAt?.toISOString() ?? null,
      months,
      total: entries.length,
    }
  }
}
