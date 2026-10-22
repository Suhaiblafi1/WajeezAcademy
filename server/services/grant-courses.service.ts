/* دوراتُ المنحة — ما يختار منه صاحبُ المنحة (٢٠ أكتوبر ٢٠٢٦).

   ═══ القرارات ═══

   · **دوراتٌ فقط** — قرارُ صاحب المنصّة (٢٠ أكتوبر ٢٠٢٦): «ألم نتّفق أن يظهر له دوراتٌ فقط، وتخبره كم السعرُ قبل
     المنحة وبعدها، ويختار ما شاء منها: واحدةً أو الحدَّ الأعلى». وخُيّر في «الاقتراحات» التي كانت فوق القائمة
     (مجموعاتُ دوراتٍ يُعدّها هو)، فاختار **حذفَها** من الصفحة ومن شاشته. فلا مجموعاتٍ تُحفظ، ولا جدولَ لها.
   · **ولا دورةَ بلا مدرّبٍ منشور، ولا دورةَ غيرُ منشورة** — قرارُه: «لا أريد أن يظهر له أيُّ دورةٍ لم يكن لها
     مدرّبٌ ومنشور». فالشعبةُ لا تُحسب إلّا ودورتُها منشورةٌ ومدرّبُها (أصيلُها أو إسنادُه النشط) معتمَدُ النشر
     بالبوّابة نفسِها التي تعرض المدرّبين للعامّة (`PUBLIC_TRAINER_WHERE`). ومنه: «إذا أضفتُ دورةً جديدةً ومدرّبا
     جديدا يظهر تلقائيّا» — فكلُّ ما هنا يُقرأ ساعةَ الطلب، لا قائمةٌ تُحفظ: شعبةٌ تُفتح تظهر، وشعبةٌ تُغلق تختفي.
   · **ومن الفصل القادم القريب وحدَه** — قرارُه: «اجعل الافتراضيَّ كلَّ الدورات المفعّلة ولها مدرّبٌ ولها شعبةٌ
     مفتوحةٌ للفصل القادم القريب». وكانت القائمةُ تخلط شعبا تبدأ من أكتوبر ٢٠٢٦ إلى نوفمبر ٢٠٢٧. فالفصلُ فصلُ
     أقرب شعبةٍ تُشترى ولم تبدأ بعد، ويُحسب **من يوم بدئها في عمّان** لا من `termId` — فشعبُ الإنتاج كلُّها بلا
     فصلٍ مربوط (`trainer-visibility.ts`)، وشعبةٌ تبدأ أوّلَ نوفمبر في عمّان تُخزَّن ٣١ أكتوبر بتوقيت غرينتش.
     ويدخل من ذلك الفصل ما بدأ وما زال يقبل التسجيل. فإن لم تبقَ شعبةٌ لم تبدأ، عُرض ما يُشترى كلُّه لا صفحةٌ
     فارغة.
   · **ومدرّبُها باسمه وصورته** — قرارُ صاحب المنصّة (٢١ أكتوبر ٢٠٢٦) في أفكار «الاستحواذ على العميل»: «المدرّب على كلّ
     دورة». والبوّابةُ بوّابةُ صندوق الشعبة في الكتالوج نفسُها (`trainerPubliclyVisible` على مدرّبها الأصيل،
     `public-catalog.service.ts#openCohorts`) — فلا اسمَ ولا صورةَ إلّا لمن اعتُمد نشرُه ولم يوقَف.

   والحارس: `server/tests/commerce/grant-courses.test.ts`. */

import type { PrismaClient } from '@prisma/client'
import { cohortAcceptsRegistration, PLAN_GATE_SELECT, TERM_WINDOW_SELECT } from './registration-window'
import { PUBLIC_TRAINER_WHERE, TRAINER_VISIBILITY_SELECT, trainerPubliclyVisible } from './trainer-visibility'
import { photoPublicUrl } from './storage.service'
import { LEDGER_CURRENCY } from '../../src/application/commerce/presentment'
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
  /** مدرّبُها الأصيلُ المنشور — اسمُه وصورتُه ومعرّفُه (مرساةُ بطاقته في `/trainers`) */
  trainer: { id: string; name: string; photoUrl: string | null } | null
}

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

export class GrantCoursesService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
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
        trainers: {
          where: { role: 'lead' },
          select: { profile: { select: { id: true, photoUrl: true, ...TRAINER_VISIBILITY_SELECT, application: { select: { fullName: true } } } } },
        },
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
      const lead = c.trainers.map((t) => t.profile).find(trainerPubliclyVisible)
      byCourse.set(c.courseId, {
        cohortId: c.id, courseId: c.courseId, courseTitleAr: c.course.versions[0]?.titleAr ?? c.courseId,
        cohortTitle: c.title, price: Number(c.price), currency: c.currency, startsAt: c.startsAt, seatsLeft: seatsOf(c),
        trainer: lead ? { id: lead.id, name: lead.application.fullName, photoUrl: photoPublicUrl(lead.photoUrl) } : null,
      })
    }
    return { termAr: term?.titleAr ?? null, byCourse }
  }

  /** دوراتُ المنحة وفصلُها — مرتّبةً بأسمائها */
  async openCourses(now = new Date()): Promise<{ termAr: string | null; courses: BuyableCohort[] }> {
    const { termAr, byCourse } = await this.pool(now)
    return { termAr, courses: [...byCourse.values()].sort((a, b) => a.courseTitleAr.localeCompare(b.courseTitleAr, 'ar')) }
  }
}
