/* خدمة التقارير — تقاريرُ تشغيليّة، لكلّ مؤشّرٍ طريقةُ حسابٍ معلنةٌ بالعربية.
   (ولا يُكتب عددُها هنا رقما: كُتب فبلي مرّتين. تُعَدُّ من `defs()`.)
   الفلاتر: نطاق تاريخ + معرف دورة/شعبة حيث ينطبق.
   التصدير CSV/XLSX محكوم بصلاحية reports.export في طبقة المسارات. */

import type { PrismaClient } from '@prisma/client'
import ExcelJS from 'exceljs'
import { NO_SHOW, interviewHeld } from '../../src/application/trainer/interview-outcome'
import {
  ACCEPTED_TRAINER_STATUSES, ENDED_TRAINER_STATUSES, PAST_TITLE_ACTIONS, acceptedCourseRows, pastTitleFromAudit,
} from '../../src/application/trainer/accepted-courses'
import { suggestCourses } from '../../src/application/trainer/proposal-match'
import { readMatchableCourses } from './course-proposal.service'

export interface ReportFilter {
  from?: Date
  to?: Date
  cohortId?: string
  courseId?: string
}

export interface ReportDefinition {
  key: string
  titleAr: string
  methodAr: string // طريقة حساب المؤشر — معلنة ومراجعة
  run: (f: ReportFilter) => Promise<Record<string, unknown>[]>
}

const dayRange = (f: ReportFilter) => ({
  ...(f.from ? { gte: f.from } : {}),
  ...(f.to ? { lte: f.to } : {}),
})
const hasRange = (f: ReportFilter) => f.from || f.to

/* عناوين الأعمدة بالعربية — تُعرض في الجدول وتُصدَّر في CSV/XLSX بدل مفاتيح قاعدة البيانات الخام */
const COLUMN_AR: Record<string, string> = {
  day: 'اليوم', diagnostics: 'نتائج التشخيص',
  entity: 'العنصر', status: 'الحالة', count: 'العدد',
  recommendation: 'التوصية', learners: 'المتعلمون',
  advisor: 'المستشار', activeCases: 'حالات نشطة', enrolled: 'سجّلوا', followUpsDone: 'متابعات منجزة',
  trainer: 'المدرب', cohort: 'الشعبة', sessionsDone: 'جلسات منجزة', submissionsReviewed: 'تسليمات مراجعة', avgScorePct: 'متوسط الدرجة ٪',
  monthCurrency: 'الشهر والعملة', revenue: 'الإيراد',
  kind: 'النوع', provider: 'المزود', total: 'الإجمالي',
  session: 'الجلسة', bucket: 'الفئة',
  course: 'الدورة', capacity: 'السعة',
  month: 'الشهر', issued: 'مصدرة', revoked: 'ملغاة',
  minutes: 'الدقائق', mb: 'الحجم (م.ب)',
  priority: 'الأولوية', category: 'التصنيف',
  stage: 'المرحلة', users: 'أجهزة فريدة', events: 'الأحداث',
  pct: 'النسبة ٪', base: 'الأساس', medianDays: 'وسيط الأيام',
  reference: 'المرجع', email: 'البريد', state: 'الحال', activeSince: 'نشطٌ منذ',
  lastContract: 'آخرُ عقد', nextStepAr: 'الخطوةُ التالية',
  trainerStatus: 'حالُ المدرّب', source: 'المصدر', title: 'العنوان', summary: 'النبذة',
  itemStatus: 'حالُ البند', qualification: 'التأهيل', nearest: 'أقربُ دورةٍ في الكتالوج',
  note: 'ملحوظة', proposalId: 'معرّفُ الاقتراح',
}
const colAr = (k: string) => COLUMN_AR[k] ?? k

/* ═══ جدولٌ فيه قيدُ `CHECK` معلَّقٌ ← التقريرُ الذي يقرأ توزيعَ عموده ═══

   قيدٌ يُضاف `NOT VALID` يُنفِذ ما وُضع له — كلُّ كتابةٍ جديدةٍ تُفحَص — ويؤجّل
   فحصَ ما مضى. والتأجيلُ لا يُرفَع إلّا بمعرفةِ توزيعِ القيم في الإنتاج، ولا
   سبيلَ إلى استعلامٍ مباشرٍ من حاويةِ تطوير. فهذه التقاريرُ هي السبيل.

   وليس التصديقُ هو المقصودَ الأوّل، بل: أفي الإنتاج صفٌّ يحمل حالةً **لم تعد
   موجودةً في الشيفرة**؟ فمن فُوِّت من صفوف حالةٍ حُذفت يجلس في حالٍ لا تعرضها
   شاشةٌ ولا ينقله انتقال — لا يبدو معطوبا، بل لا يبدو أصلا.

   ويحرس الاقترانَ `server/tests/schema/unvalidated-checks-are-readable.test.ts`:
   قيدٌ معلَّقٌ بلا تقريرٍ يُسقِط البوّابة. */
export const STATUS_DISTRIBUTION_REPORTS: Record<string, string> = {
  TrainerApplication: 'trainer-applications',
  TrainerChangeRequest: 'trainer-change-requests',
  AssignmentSubmission: 'assignment-submissions',
}

export class ReportsService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  private defs(): ReportDefinition[] {
    const p = this.prisma
    return [
      {
        key: 'diagnostic-funnel', titleAr: 'قمع التشخيص وجدار التسجيل',
        methodAr: 'أجهزة فريدة عند كل مرحلة — بدأ ← أكمل ← رأى نصف النتيجة ← رأى الجدار ← أنشأ حسابا من الجدار — نسبة التحويل = أنشأ حسابا ÷ رأى الجدار (من أحداث الاستخدام المجهولة)',
        run: async (f) => {
          const rows = await p.analyticsEvent.findMany({
            where: hasRange(f) ? { createdAt: dayRange(f) } : {},
            select: { event: true, anonId: true, meta: true },
          })
          const devices = (name: string, via?: string) =>
            new Set(
              rows
                .filter((r) => r.event === name)
                .filter((r) => !via || (r.meta as Record<string, unknown> | null)?.via === via)
                .map((r) => r.anonId ?? 'جهاز مجهول')
            ).size
          const gate = devices('gate_viewed')
          const created = devices('account_created', 'result_gate')
          const pct = gate > 0 ? Math.round((created / gate) * 100) : 0
          return [
            { stage: 'بدأ التشخيص', users: devices('diagnostic_started') },
            { stage: 'أكمل التشخيص', users: devices('diagnostic_completed') },
            { stage: 'رأى نصف النتيجة', users: devices('result_teaser_viewed') },
            { stage: 'رأى جدار التسجيل', users: gate },
            { stage: 'أنشأ حسابا من الجدار', users: created },
            { stage: 'نسبة التحويل عند الجدار', users: `${pct}٪` },
          ]
        },
      },
      {
        key: 'diagnostic', titleAr: 'التشخيص',
        methodAr: 'عدد نتائج التشخيص المرفقة بالحسابات مجمعة بيوم الإرفاق — من ملفات المتعلمين',
        run: async (f) => {
          const rows = await p.learnerProfile.findMany({ where: hasRange(f) ? { attachedAt: dayRange(f) } : { attachedAt: { not: null } }, select: { attachedAt: true } })
          const byDay = new Map<string, number>()
          for (const r of rows) {
            const d = r.attachedAt!.toISOString().slice(0, 10)
            byDay.set(d, (byDay.get(d) ?? 0) + 1)
          }
          return [...byDay.entries()].map(([day, count]) => ({ day, diagnostics: count }))
        },
      },
      {
        key: 'pathways-templates', titleAr: 'المسارات والقوالب',
        methodAr: 'عدادات المسارات وقوالب التوصية المركبة بحالة النشر — من الكتالوج المنشور',
        run: async () => {
          const [pathways, templates] = await Promise.all([
            p.pathway.groupBy({ by: ['status'], _count: true }),
            p.compositeTemplate.groupBy({ by: ['status'], _count: true }),
          ])
          return [
            ...pathways.map((r) => ({ entity: 'مسار', status: r.status, count: r._count })),
            ...templates.map((r) => ({ entity: 'قالب مركب', status: r.status, count: r._count })),
          ]
        },
      },
      {
        key: 'skill-gaps', titleAr: 'فجوات المهارات',
        methodAr: 'توزيع التوصيات (مسار/قالب) في نتائج التشخيص المرفقة بالحسابات',
        run: async () => {
          const rows = await p.learnerProfile.findMany({ where: { diagnosticSnapshot: { not: undefined } }, select: { diagnosticSnapshot: true } })
          const byRec = new Map<string, number>()
          for (const r of rows) {
            const snap = r.diagnosticSnapshot as { recommendation?: { id?: string; kind?: string } } | null
            const key = snap?.recommendation?.id ? `${snap.recommendation.kind ?? 'pathway'}:${snap.recommendation.id}` : 'غير محدد'
            byRec.set(key, (byRec.get(key) ?? 0) + 1)
          }
          return [...byRec.entries()].map(([recommendation, count]) => ({ recommendation, learners: count }))
        },
      },
      {
        key: 'conversion', titleAr: 'التحويل إلى تسجيل',
        methodAr: 'طلبات التسجيل بحالتها — نسبة التحويل = ما تحوّل إلى تسجيل ÷ الكل',
        run: async (f) => {
          const rows = await p.enrollmentRequest.groupBy({
            by: ['status'], _count: true,
            where: hasRange(f) ? { createdAt: dayRange(f) } : undefined,
          })
          return rows.map((r) => ({ status: r.status, count: r._count }))
        },
      },
      {
        key: 'advisor-performance', titleAr: 'أداء المستشار',
        methodAr: 'لكل مستشار: الحالات النشطة المسندة، المتابعات المنجزة، الحالات المحولة لمسجلة — من إسنادات المستشارين وحالاتهم',
        run: async () => {
          const links = await p.advisorAssignment.findMany({
            where: { unassignedAt: null },
            include: { advisor: { select: { displayName: true } }, case: { select: { status: true, followUps: { where: { doneAt: { not: null } }, select: { id: true } } } } },
          })
          const byAdvisor = new Map<string, { advisor: string; activeCases: number; enrolled: number; followUpsDone: number }>()
          for (const l of links) {
            const cur = byAdvisor.get(l.advisorId) ?? { advisor: l.advisor.displayName, activeCases: 0, enrolled: 0, followUpsDone: 0 }
            cur.activeCases += 1
            if (l.case.status === 'enrolled') cur.enrolled += 1
            cur.followUpsDone += l.case.followUps.length
            byAdvisor.set(l.advisorId, cur)
          }
          return [...byAdvisor.values()]
        },
      },
      {
        key: 'trainer-performance', titleAr: 'أداء المدرب',
        methodAr: 'لكل مدرب: الشعب المسندة، الجلسات المنجزة، التسليمات المراجعة، متوسط الدرجات — من إسنادات الشعب والتسليمات والدرجات',
        run: async (f) => {
          const links = await p.cohortTrainer.findMany({
            where: { role: 'lead' },
            include: {
              profile: { include: { application: { select: { fullName: true } } } },
              cohort: {
                include: {
                  sessions: { where: { status: 'done' } },
                  assessments: {
                    include: {
                      submissions: { where: { status: { in: ['accepted', 'rejected', 'under_review'] } }, include: { grades: true } },
                    },
                  },
                },
              },
            },
          })
          return links
            .filter((l) => !f.cohortId || l.cohort.id === f.cohortId)
            .map((l) => {
            const subs = l.cohort.assessments.flatMap((a) => a.submissions)
            const grades = subs.flatMap((s) => s.grades)
            const avg = grades.length ? Math.round(grades.reduce((s, g) => s + Number(g.score) / Number(g.maxScore), 0) / grades.length * 100) : null
            return {
              trainer: l.profile.application.fullName, cohort: l.cohort.title,
              sessionsDone: l.cohort.sessions.length, submissionsReviewed: subs.length, avgScorePct: avg,
            }
          })
        },
      },
      {
        key: 'enrollments', titleAr: 'التسجيلات',
        methodAr: 'التسجيلات مجمعة بالشعبة والحالة',
        run: async (f) => {
          const rows = await p.enrollment.groupBy({
            by: ['cohortId', 'status'], _count: true,
            where: { ...(f.cohortId ? { cohortId: f.cohortId } : {}), ...(hasRange(f) ? { createdAt: dayRange(f) } : {}) },
          })
          const cohorts = await p.cohort.findMany({ where: { id: { in: rows.map((r) => r.cohortId) } }, select: { id: true, title: true } })
          const name = new Map(cohorts.map((c) => [c.id, c.title]))
          return rows.map((r) => ({ cohort: name.get(r.cohortId) ?? r.cohortId, status: r.status, count: r._count }))
        },
      },
      {
        key: 'revenue', titleAr: 'الإيرادات',
        methodAr: 'مجموع الفواتير المدفوعة فقط، بالعملة والشهر',
        run: async (f) => {
          const rows = await p.invoice.findMany({
            where: { status: 'paid', ...(hasRange(f) ? { paidAt: dayRange(f) } : {}) },
            select: { amount: true, currency: true, paidAt: true },
          })
          const byMonth = new Map<string, number>()
          for (const r of rows) {
            const key = `${r.paidAt!.toISOString().slice(0, 7)} ${r.currency}`
            byMonth.set(key, (byMonth.get(key) ?? 0) + Number(r.amount))
          }
          return [...byMonth.entries()].map(([monthCurrency, revenue]) => ({ monthCurrency, revenue }))
        },
      },
      {
        key: 'payments-refunds', titleAr: 'الدفعات والاسترداد',
        methodAr: 'الدفعات بالمزود والحالة، والاستردادات المنفذة بمجاميعها',
        run: async (f) => {
          const [payments, refunds] = await Promise.all([
            p.payment.groupBy({ by: ['provider', 'status'], _count: true, _sum: { amount: true }, where: hasRange(f) ? { createdAt: dayRange(f) } : undefined }),
            p.refund.groupBy({ by: ['status'], _count: true, _sum: { amount: true } }),
          ])
          return [
            ...payments.map((r) => ({ kind: 'دفعة', provider: r.provider, status: r.status, count: r._count, total: Number(r._sum.amount ?? 0) })),
            ...refunds.map((r) => ({ kind: 'استرداد', provider: '—', status: r.status, count: r._count, total: Number(r._sum.amount ?? 0) })),
          ]
        },
      },
      {
        key: 'attendance', titleAr: 'الحضور',
        methodAr: 'سجلات الحضور بحالتها لكل شعبة',
        run: async (f) => {
          const rows = await p.attendance.groupBy({ by: ['sessionId', 'status'], _count: true })
          const sessions = await p.cohortSession.findMany({ where: { id: { in: rows.map((r) => r.sessionId) } }, select: { id: true, cohortId: true, title: true } })
          const meta = new Map(sessions.map((s) => [s.id, s]))
          return rows
            .filter((r) => !f.cohortId || meta.get(r.sessionId)?.cohortId === f.cohortId)
            .map((r) => ({ session: meta.get(r.sessionId)?.title ?? r.sessionId, status: r.status, count: r._count }))
        },
      },
      {
        key: 'progress-completion', titleAr: 'التقدم والإكمال',
        methodAr: 'توزيع نسب التقدم في فئات (0-24، 25-49، 50-74، 75-99، 100) من سجلات تقدم الدورات — والإكمال المؤكد من التسجيلات المكتملة',
        run: async () => {
          const rows = await p.courseProgress.findMany({ select: { percent: true } })
          const buckets = [0, 0, 0, 0, 0]
          for (const r of rows) buckets[Math.min(4, Math.floor(r.percent / 25))] += 1
          const completed = await p.enrollment.count({ where: { status: 'completed' } })
          return [
            { bucket: '0-24٪', learners: buckets[0] }, { bucket: '25-49٪', learners: buckets[1] },
            { bucket: '50-74٪', learners: buckets[2] }, { bucket: '75-99٪', learners: buckets[3] },
            { bucket: '100٪', learners: buckets[4] }, { bucket: 'إكمال مؤكد (تسجيل مكتمل)', learners: completed },
          ]
        },
      },
      {
        key: 'courses-cohorts', titleAr: 'الدورات والشعب',
        methodAr: 'الشعب مجمعة بالدورة والحالة مع السعة والتسجيل',
        run: async (f) => {
          const rows = await p.cohort.findMany({
            where: f.courseId ? { courseId: f.courseId } : undefined,
            include: { course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } }, _count: { select: { enrollments: { where: { status: 'enrolled' } } } } },
          })
          return rows.map((c) => ({
            course: c.course.versions[0]?.titleAr ?? c.courseId, cohort: c.title, status: c.status,
            capacity: c.capacity, enrolled: c._count.enrollments,
          }))
        },
      },
      {
        key: 'certificates', titleAr: 'الشهادات',
        methodAr: 'الشهادات المصدرة والملغاة بالشهر',
        run: async (f) => {
          const rows = await p.certificate.findMany({
            where: hasRange(f) ? { issuedAt: dayRange(f) } : undefined,
            select: { status: true, issuedAt: true },
          })
          const byMonth = new Map<string, { issued: number; revoked: number }>()
          for (const r of rows) {
            const m = r.issuedAt.toISOString().slice(0, 7)
            const cur = byMonth.get(m) ?? { issued: 0, revoked: 0 }
            cur.issued += 1
            if (r.status === 'revoked') cur.revoked += 1
            byMonth.set(m, cur)
          }
          return [...byMonth.entries()].map(([month, v]) => ({ month, ...v }))
        },
      },
      {
        key: 'recordings', titleAr: 'التسجيلات المرئية',
        methodAr: 'عدد تسجيلات الجلسات وحجمها ومدتها لكل شعبة وحالتها',
        run: async (f) => {
          const rows = await p.recording.findMany({
            include: { session: { select: { cohortId: true, cohort: { select: { title: true } } } } },
          })
          const filtered = rows.filter((r) => !f.cohortId || r.session.cohortId === f.cohortId)
          const byCohort = new Map<string, { cohort: string; count: number; minutes: number; mb: number }>()
          for (const r of filtered) {
            const cur = byCohort.get(r.session.cohortId) ?? { cohort: r.session.cohort.title, count: 0, minutes: 0, mb: 0 }
            cur.count += 1
            cur.minutes += Math.round((r.durationSec ?? 0) / 60)
            cur.mb += Math.round((r.sizeBytes ?? 0) / 1024 / 1024)
            byCohort.set(r.session.cohortId, cur)
          }
          return [...byCohort.values()]
        },
      },
      /* ═══ قمعُ التوظيف — لا لقطةُ حالات ═══

         تقريرُ «طلبات المدربين» تحته يعدّ الحالاتِ الحاليّة: كم في المراجعة
         وكم نشط. وهو يجيب «أين هم الآن» ولا يجيب **«أين نفقدهم»**: كم من
         أتمّ طلبَه حجز لقاءَ تعارف؟ وكم حجز بعد أن ذُكّر؟ والسؤالان هما
         موضعُ القرار — فبلاهما يُبنى التذكيرُ ولا يُعرف أنفع أم لا.

         والأساسُ `phase2CompletedAt`: الطلبُ المكتمل هو ما يُقاس، لا مسوّدةٌ
         فُتحت وتُركت. وكلُّ صفٍّ يقول **أساسَ نسبته** بالحرف، فلا تُقرأ نسبةٌ
         على غير قاعدتها: «حجز بعد التذكير» نسبتُه من المذكَّرين لا من الكلّ. */
      /* ═══ من يعمل بلا عقدٍ نافذ ═══

         العقدُ صار بوّابةَ التفعيل في المرحلة الثالثة، لكنّ البوّابةَ تحرس
         من يمرّ بعدها لا من مرّ قبلها. ومن صار مدرّبا قبل هذه المراحل نشطٌ
         بلا عقدٍ في القاعدة، وهو **ليس مخالفةً** — بل عملٌ لم يُوثَّق بعد.

         ولذلك لا يُسرَد الاسمُ وحدَه: لكلٍّ **حالُه وخطوتُه التالية**. فقائمةُ
         أسماءٍ بلا تمييزٍ تُقرأ مرّةً وتُترك — يقرؤها الموظّفُ فلا يعرف أيُّهم
         ينتظر ضغطةً منه وأيُّهم يحتاج عقدا يُركَّب من الصفر.

         ولا تاريخَ قطعٍ مكتوبٌ بيد: «من قبل المرحلة» تُعرف بأنّه لا صفَّ عقدٍ
         له إطلاقا، لا برقمٍ يُخمَّن ويبلى. */
      {
        key: 'trainers-without-contract', titleAr: 'مدرّبون نشطون بلا عقدٍ نافذ',
        methodAr: 'كلُّ طلبٍ حالتُه active وله ملفُّ مدرّب، وليس له عقدٌ حالتُه countersigned. ولكلٍّ حالُه: لا عقدَ قطّ (سبق المرحلة) · مسوّدةٌ لم تُرسَل · أُرسل ينتظر توقيعَه · وُقّع ينتظر اعتمادَك · اعتُذر عنه · أُلغي · فُسخ. والمدى — إن ضُبط — يُقاس على تاريخ صيرورته نشطا.',
        run: async (f) => {
          const rows = await p.trainerApplication.findMany({
            where: {
              status: 'active',
              profile: { is: { contracts: { none: { status: 'countersigned' } } } },
            },
            select: {
              id: true, reference: true, fullName: true, email: true, updatedAt: true,
              statusHistory: {
                where: { toStatus: 'active' },
                orderBy: { createdAt: 'desc' }, take: 1,
                select: { createdAt: true },
              },
              profile: {
                select: {
                  createdAt: true,
                  contracts: {
                    orderBy: { createdAt: 'desc' }, take: 1,
                    select: { status: true, title: true, createdAt: true },
                  },
                },
              },
            },
            /* والسقفُ مرتفعٌ بقصد: المقيسُ «نشطٌ بلا عقد»، وهو محصورٌ بعدد
               المدرّبين النشطين لا ينمو بنموّ الاستعمال. ولو بلغ ألفين
               فالعطبُ في أنّ ألفين بلا عقدٍ لا في سقف التقرير. */
            take: 2_000,
          })

          /* الحالُ والخطوةُ معا: من يقرأ يعرف ماذا يفعل الآن */
          const SAID: Record<string, { state: string; next: string }> = {
            none: { state: 'لا عقدَ قطّ — سبق مراحلَ التعاقد', next: 'أنشئ له عقدا من شاشة العقود' },
            draft: { state: 'مسوّدةٌ مجمَّدةٌ لم تُرسَل', next: 'أرسِلْها للتوقيع' },
            sent: { state: 'أُرسل وينتظر توقيعَه', next: 'ذكّرْه أو جدّدْ رابطَه' },
            signed: { state: 'وقّعه وينتظر اعتمادَك', next: 'طابِقِ الاسمَ بوثيقته ثمّ اعتمِدْ' },
            declined: { state: 'اعتذر عنه', next: 'اقرأ سببَه ثمّ قرّرْ' },
            revoked: { state: 'أُلغي', next: 'أنشئ عقدا جديدا إن أردتَ بقاءَه' },
            terminated: { state: 'فُسخ', next: 'أوقِفْ ملفَّه أو أنشئ عقدا جديدا' },
            expired: { state: 'انتهى', next: 'أنشئ عقدا جديدا' },
          }

          return rows
            .map((a) => {
              const since = a.statusHistory[0]?.createdAt ?? a.profile?.createdAt ?? a.updatedAt
              const last = a.profile?.contracts[0] ?? null
              const said = SAID[last?.status ?? 'none'] ?? SAID.none
              return {
                trainer: a.fullName,
                reference: a.reference,
                email: a.email,
                state: said.state,
                nextStepAr: said.next,
                activeSince: since.toISOString().slice(0, 10),
                lastContract: last ? `${last.title} — ${last.createdAt.toISOString().slice(0, 10)}` : '—',
                _since: since,
              }
            })
            /* والمدى يُقاس على صيرورته نشطا: «من صار نشطا هذا الشهر ولا عقدَ له» */
            .filter((r) => (!f.from || r._since >= f.from) && (!f.to || r._since <= f.to))
            /* والأقدمُ أوّلا: من مضى عليه شهران بلا عقدٍ أولى بالنظر من أمسِ */
            .sort((x, y) => x._since.getTime() - y._since.getTime())
            /* و`_since` تُسقَط من الصفّ المعروض: هي أداةُ فرزٍ وترشيحٍ لا
               عمودٌ يُقرأ — و`activeSince` تقوله بالصيغة التي تُعرض. */
            .map((r) => {
              const out: Record<string, unknown> = { ...r }
              delete out._since
              return out
            })
        },
      },
      {
        key: 'trainer-funnel', titleAr: 'قمعُ توظيف المدرّبين',
        methodAr: 'الطلباتُ المكتملة في المدى (phase2CompletedAt): كم حجز لقاءَ تعارف، وكم جرى لقاؤه، وكم اعتُمد — ومعها أثرُ التذكير اليدويّ: كم ذُكّر وكم حجز بعده. ووسيطُ الأيّام بين المرحلة وسابقتها.',
        run: async (f) => {
          const apps = await p.trainerApplication.findMany({
            where: hasRange(f) ? { phase2CompletedAt: dayRange(f) } : { phase2CompletedAt: { not: null } },
            select: {
              id: true, status: true, phase2CompletedAt: true,
              interviews: { select: { createdAt: true, scheduledAt: true, canceledAt: true, outcome: true } },
            },
          })
          if (apps.length === 0) return []

          const ids = apps.map((a) => a.id)
          /* أوّلُ تذكيرٍ لكلّ طلب — والأثرُ مصدرُه، فلا عمودَ يُضاف للجدول */
          const reminders = await p.auditEvent.findMany({
            where: { action: 'trainer.interview.remind', entityId: { in: ids } },
            select: { entityId: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          })
          const firstReminder = new Map<string, Date>()
          for (const r of reminders) if (!firstReminder.has(r.entityId)) firstReminder.set(r.entityId, r.createdAt)

          /* لحظةُ الاعتماد من سجلّ الحالات لا من `updatedAt`: الأخيرُ يتحرّك
             مع كلّ تعديلٍ لاحقٍ على الملفّ، فيكذب الوسيط. */
          const approvals = await p.trainerStatusHistory.findMany({
            where: { applicationId: { in: ids }, toStatus: 'active' },
            select: { applicationId: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          })
          const firstApproval = new Map<string, Date>()
          for (const a of approvals) if (!firstApproval.has(a.applicationId)) firstApproval.set(a.applicationId, a.createdAt)

          const now = new Date()
          const days = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 86_400_000
          const median = (xs: number[]) => {
            if (xs.length === 0) return null
            const s = [...xs].sort((a, b) => a - b)
            const mid = Math.floor(s.length / 2)
            const v = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
            return Math.round(v * 10) / 10
          }
          const firstBooking = (a: (typeof apps)[number]) =>
            a.interviews.map((i) => i.createdAt).sort((x, y) => x.getTime() - y.getTime())[0] ?? null
          /* «جرى اللقاء» — القرارُ في `interview-outcome.ts` لا هنا: نتيجةٌ
             سُجّلت أو موعدٌ مضى ولم يُلغَ، **والغيابُ يخرج**. وكان الغيابُ
             يقع في الشقّ الثاني حرفا (موعدٌ مضى ولم يُلغَ) فيُعَدّ لقاءً وقع،
             ويُقاس التسرُّبُ صفرا وهو لا يُرى. */
          const held = (a: (typeof apps)[number]) => a.interviews.filter((i) => interviewHeld(i, now))
          const missed = (a: (typeof apps)[number]) => a.interviews.filter((i) => i.outcome === NO_SHOW)

          const submitted = apps.length
          const booked = apps.filter((a) => a.interviews.length > 0)
          const interviewed = apps.filter((a) => held(a).length > 0)
          const noShow = apps.filter((a) => missed(a).length > 0)
          const approved = apps.filter((a) => a.status === 'active')
          const reminded = apps.filter((a) => firstReminder.has(a.id))
          const bookedAfterReminder = reminded.filter((a) => {
            const booking = firstBooking(a)
            const remindedAt = firstReminder.get(a.id)
            return booking !== null && remindedAt !== undefined && booking > remindedAt
          })

          const pct = (n: number, of: number) => (of === 0 ? 0 : Math.round((n / of) * 1000) / 10)
          return [
            {
              stage: 'طلبٌ مكتمل', count: submitted, pct: 100, base: 'نفسُه',
              medianDays: null,
            },
            {
              stage: 'حجز لقاءَ التعارف', count: booked.length, pct: pct(booked.length, submitted),
              base: 'من المكتمل',
              medianDays: median(booked.flatMap((a) => {
                const b = firstBooking(a)
                return b && a.phase2CompletedAt ? [days(a.phase2CompletedAt, b)] : []
              })),
            },
            {
              stage: 'جرى اللقاء', count: interviewed.length, pct: pct(interviewed.length, submitted),
              base: 'من المكتمل',
              medianDays: median(interviewed.flatMap((a) => {
                const b = firstBooking(a)
                const h = held(a).map((i) => i.scheduledAt).sort((x, y) => x.getTime() - y.getTime())[0]
                return b && h ? [days(b, h)] : []
              })),
            },
            /* ═══ والغيابُ صفٌّ مستقلٌّ لا نقصٌ في صفٍّ آخر ═══

               «حجز ولم يجرِ لقاؤه» تسرُّبٌ من نوعٍ آخر: لا هو رفضٌ ولا هو
               انتظار، بل موعدٌ ضاع على الطرفَين. وأساسُه **من حجز** لا من
               المكتمل: من لم يحجز لا يُنسَب إليه غياب. */
            {
              stage: 'لم يحضر اللقاء', count: noShow.length, pct: pct(noShow.length, booked.length),
              base: 'من حجز',
              medianDays: null,
            },
            {
              stage: 'اعتُمد مدرّبا', count: approved.length, pct: pct(approved.length, submitted),
              base: 'من المكتمل',
              medianDays: median(approved.flatMap((a) => {
                const at = firstApproval.get(a.id)
                return at && a.phase2CompletedAt ? [days(a.phase2CompletedAt, at)] : []
              })),
            },
            {
              stage: 'ذُكّر بالحجز', count: reminded.length, pct: pct(reminded.length, submitted),
              base: 'من المكتمل', medianDays: null,
            },
            {
              stage: 'حجز بعد التذكير', count: bookedAfterReminder.length,
              pct: pct(bookedAfterReminder.length, reminded.length),
              base: 'من المذكَّرين',
              medianDays: median(bookedAfterReminder.flatMap((a) => {
                const b = firstBooking(a)
                const r = firstReminder.get(a.id)
                return b && r ? [days(r, b)] : []
              })),
            },
          ]
        },
      },
      /* ═══ دوراتُ المدرّبين المقبولين — جردٌ لا سلسلةٌ زمنيّة (٢٨ سبتمبر ٢٠٢٦) ═══

         طلب صاحبُ المنصّة أن يرى ما اقترحه كلُّ مقبولٍ من دورات ليقرّر فيها
         ويؤهّله لها. وطابورُ التصنيف يُخفي ثلاثةً ممّا يُقرَّر فيه — الفقرةَ
         الحرّةَ القديمة، واقتراحَ الطلب بعد إنشاء الملفّ، واختيارَه من الكتالوج
         — والقولُ فيها وفي قواعد الصفّ في `accepted-courses.ts`. وهذا قراءةٌ
         وتهيئةٌ لا غير.

         ولمَ تقريرٌ لا شاشة: الجدولُ يُقرأ ويُصدَّر ويُرسَل، والقرارُ فيه يقع
         في شاشتَي التصنيف والإسناد القائمتَين — ولا يُبنى لعرضه بابٌ ثالث. */
      {
        key: 'accepted-trainer-courses', titleAr: 'دوراتُ المدرّبين المقبولين',
        methodAr: 'كلُّ طلبٍ حالتُه قبولٌ داخليٌّ فما بعده (قبولٌ داخليّ · عقدٌ قيد التوقيع · تهيئة · نشط) — وكلُّ من له ملفُّ مدرّبٍ وإن تغيّرت حالُه بعد قبوله، كمن طُلبت منه معلوماتٌ بعد القبول الداخليّ، وتقول خانةُ حاله أين كان ويعود. والمردودُ والمسحوبُ والموقوفُ خارجُه. صفٌّ لكلّ دورةٍ تتّصل بالمدرّب: اقتراحُه في طابور التصنيف بحالته وما رُبط به، وأقربُ رمزٍ إليه ما لم يُبتّ فيه · واقتراحٌ في طلبه لا مقابلَ له في الطابور (لا ملفَّ له، أو أُضيف بعد إنشاء ملفّه) · والفقرةُ الحرّةُ من نموذج التقديم القديم كما كُتبت · ودوراتُ الكتالوج التي اختارها في طلبه وحالُ تأهيله لها · وكلُّ تأهيلٍ قائمٍ لم يُذكر قبله. ومن لا بندَ له صفٌّ يقول ذلك. لا بريدَ ولا هاتف، والمدى لا ينطبق: هذا جردٌ لا سلسلةٌ زمنيّة.',
        run: async () => {
          /* والحدُّ ملفُّ المدرّب لا اسمُ الحالة — والقولُ في
             `ENDED_TRAINER_STATUSES` */
          const apps = await p.trainerApplication.findMany({
            where: {
              OR: [
                { status: { in: [...ACCEPTED_TRAINER_STATUSES] } },
                { profile: { isNot: null }, status: { notIn: [...ENDED_TRAINER_STATUSES] } },
              ],
            },
            select: {
              fullName: true, reference: true, status: true, infoRequestedFrom: true,
              teachableCourseIds: true, teachableOther: true, teachableProposals: true,
              profile: {
                select: {
                  userId: true,
                  courseProposals: {
                    orderBy: { createdAt: 'asc' },
                    select: {
                      id: true, titleAr: true, summaryAr: true, status: true, courseId: true,
                      questionAr: true, answerAr: true, decisionNoteAr: true,
                    },
                  },
                  qualifications: { orderBy: { createdAt: 'asc' }, select: { courseId: true, status: true } },
                },
              },
            },
          })
          if (apps.length === 0) return []

          /* ═══ عناوينُ فارقتها اقتراحاتُ الطابور — من الأثر ═══

             بها يُعرف أيُّ اقتراحات الطلب لم يدخل الطابور: ما أُعيدت تسميتُه
             أو حذفه صاحبُه ليس «لم يُبذَر». والتعديلُ يُنسَب بمعرّف الاقتراح،
             والحذفُ بصاحبه — فالصفُّ المحذوفُ لا معرّفَ له يُسأل عنه. */
          const byProposal = new Map<string, number>()
          const byUser = new Map<string, number>()
          apps.forEach((a, i) => {
            for (const pr of a.profile?.courseProposals ?? []) byProposal.set(pr.id, i)
            if (a.profile?.userId) byUser.set(a.profile.userId, i)
          })
          const past: string[][] = apps.map(() => [])
          const events = await p.auditEvent.findMany({
            where: {
              OR: [
                {
                  entityType: 'trainer_course_proposal', entityId: { in: [...byProposal.keys()] },
                  action: { in: [PAST_TITLE_ACTIONS.ownerEdit, PAST_TITLE_ACTIONS.staffEdit] },
                },
                { action: PAST_TITLE_ACTIONS.ownerDelete, actorId: { in: [...byUser.keys()] } },
              ],
            },
            select: { action: true, actorId: true, entityId: true, meta: true, before: true },
          })
          for (const e of events) {
            const i = e.action === PAST_TITLE_ACTIONS.ownerDelete
              ? (e.actorId ? byUser.get(e.actorId) : undefined)
              : byProposal.get(e.entityId)
            const title = pastTitleFromAudit(e)
            if (i !== undefined && title) past[i].push(title)
          }

          /* العنوانُ من الإصدار الجاري ولو أُرشفت الدورة — اختيارٌ قديمٌ لرمزٍ
             مؤرشفٍ يُقرأ باسمه. والترشيحُ من المرشِّح نفسِه الذي في الطابور. */
          const [matchable, all] = await Promise.all([
            readMatchableCourses(p),
            p.course.findMany({
              select: { id: true, currentVersion: true, versions: { select: { version: true, titleAr: true } } },
            }),
          ])
          const titles = new Map(all.map((c) => [
            c.id, c.versions.find((v) => v.version === c.currentVersion)?.titleAr ?? c.id,
          ]))

          return acceptedCourseRows(
            apps.map((a, i) => ({
              fullName: a.fullName, reference: a.reference, status: a.status,
              infoRequestedFrom: a.infoRequestedFrom,
              teachableCourseIds: a.teachableCourseIds, teachableOther: a.teachableOther,
              teachableProposals: a.teachableProposals,
              profile: a.profile
                ? {
                  proposals: a.profile.courseProposals,
                  qualifications: a.profile.qualifications,
                  pastQueueTitles: past[i],
                }
                : null,
            })),
            {
              titleOf: (id) => titles.get(id) ?? null,
              nearest: (pr) => {
                const m = suggestCourses(pr, matchable, 1)[0]
                return m ? { courseId: m.courseId, titleAr: m.titleAr } : null
              },
            },
          )
        },
      },
      {
        key: 'trainer-applications', titleAr: 'طلبات المدربين',
        methodAr: 'طلبات انضمام المدربين بحالتها',
        run: async (f) => {
          const rows = await p.trainerApplication.groupBy({
            by: ['status'], _count: true,
            where: hasRange(f) ? { createdAt: dayRange(f) } : undefined,
          })
          return rows.map((r) => ({ status: r.status, count: r._count }))
        },
      },
      /* ═══ وتوزيعُ حالتَين أخريَين — لهما قيدٌ معلَّقٌ يُصدَّق بهما ═══

         ومنفعتُهما تشغيليّةٌ قبل ذلك: كم اقتراحا ينتظر مراجعةً، وكم تسليما
         ينتظر تصحيحا — سؤالان يُسألان بلا أن يُسأل عن قيد. */
      {
        key: 'trainer-change-requests', titleAr: 'اقتراحاتُ تعديل الدورات',
        methodAr: 'اقتراحاتُ المدرّبين على دوراتهم بحالتها — من `TrainerChangeRequest` بتاريخ إنشائها',
        run: async (f) => {
          const rows = await p.trainerChangeRequest.groupBy({
            by: ['status'], _count: true,
            where: hasRange(f) ? { createdAt: dayRange(f) } : undefined,
          })
          return rows.map((r) => ({ status: r.status, count: r._count }))
        },
      },
      {
        key: 'assignment-submissions', titleAr: 'تسليماتُ المهامّ',
        methodAr: 'تسليماتُ المتعلّمين للمهامّ بحالتها — والنطاقُ على `submittedAt` لا `createdAt`، فلا عمودَ إنشاءٍ في هذا الجدول',
        run: async (f) => {
          const rows = await p.assignmentSubmission.groupBy({
            by: ['status'], _count: true,
            where: hasRange(f) ? { submittedAt: dayRange(f) } : undefined,
          })
          return rows.map((r) => ({ status: r.status, count: r._count }))
        },
      },
      {
        key: 'support-tickets', titleAr: 'تذاكر الدعم',
        methodAr: 'تذاكر الدعم بالحالة والأولوية والتصنيف',
        run: async (f) => {
          const rows = await p.supportTicket.groupBy({
            by: ['status', 'priority', 'category'], _count: true,
            where: hasRange(f) ? { createdAt: dayRange(f) } : undefined,
          })
          return rows.map((r) => ({ status: r.status, priority: r.priority, category: r.category, count: r._count }))
        },
      },
    ]
  }

  listReports() {
    return this.defs().map(({ key, titleAr, methodAr }) => ({ key, titleAr, methodAr }))
  }

  async run(key: string, filter: ReportFilter = {}) {
    const def = this.defs().find((d) => d.key === key)
    if (!def) throw new Error(`unknown_report: ${key}`)
    const rows = await def.run(filter)
    /* خريطة عناوين الأعمدة العربية — الواجهة تعرضها والتصدير يعتمدها */
    const columnsAr: Record<string, string> = {}
    if (rows.length) for (const k of Object.keys(rows[0])) columnsAr[k] = colAr(k)
    return { key: def.key, titleAr: def.titleAr, methodAr: def.methodAr, rows, columnsAr }
  }

  /* ── التصدير ── */

  toCsv(rows: Record<string, unknown>[]): string {
    if (!rows.length) return ''
    const headers = Object.keys(rows[0])
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [headers.map((h) => esc(colAr(h))).join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))]
    return '﻿' + lines.join('\n') // BOM ليفتح Excel العربية سليمة
  }

  async toXlsx(titleAr: string, rows: Record<string, unknown>[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(titleAr.slice(0, 28), { views: [{ rightToLeft: true }] })
    if (rows.length) {
      ws.columns = Object.keys(rows[0]).map((k) => ({ header: colAr(k), key: k, width: 24 }))
      for (const r of rows) ws.addRow(r)
      ws.getRow(1).font = { bold: true }
    }
    return Buffer.from(await wb.xlsx.writeBuffer())
  }
}
