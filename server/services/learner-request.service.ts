/* طلباتُ المتعلّم في آخر رحلته — شهادةُ دورة، وشهادةُ مسارٍ كاملا، وتوصيةٌ مهنيّة.

   بكلام صاحب المنصّة: «وفي نهاية كل دورة يظهر له طلب شهادة للدورة، وفي نهاية
   المسار يظهر له طلب شهادة المسار كاملا وتوصية لعمله أو لجماعته وغيرها من
   الأمور المهمّة لحياته المهنيّة».

   وثلاثةُ قراراتٍ في هذه الخدمة:

   ١) **لا طلبَ قبل الاستحقاق.** الأهليّةُ تُفحَص بالقواعد نفسِها التي يفحصها
      الإصدارُ (`evaluateCompletion`) لا بقاعدةٍ ثانية تُشبهها — وإلّا صار في
      البوابة زرٌّ يُرسل طلبا يُعتذَر عنه دائما، وطابورٌ عند الإدارة لا يُنفَّذ.
      ومن لم يستوفِ تُقال له أسبابُه بالنصّ لا يُطفأ زرُّه بلا كلمة.

   ٢) **الطلبُ ليس إصدارا.** الشهادةُ تبقى بيد الإدارة (`CertificateService`)
      لأنّها وثيقةٌ تُنسَب إلى الأكاديميّة وتُتحقَّق علنا برقمها. فهذا الجدولُ
      طابورُ عملٍ لا مصنعُ وثائق: يُشعِر المسؤولَ، ويُقرأ عند صاحبه بحالته.

   ٣) **طلبٌ واحدٌ معلَّق لكلّ شيء.** الضغطُ مرّتين لا يصنع طلبين: يُعاد الطلبُ
      القائم. فلا يقرأ المسؤولُ خمسةَ طلباتٍ لشهادةٍ واحدة. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { notifyRole, safeNotify } from './notification.service'
import { ProgressService } from './progress.service'

export const LEARNER_REQUEST_KINDS = ['course_certificate', 'pathway_certificate', 'recommendation'] as const
export type LearnerRequestKind = (typeof LEARNER_REQUEST_KINDS)[number]

export const KIND_AR: Record<LearnerRequestKind, string> = {
  course_certificate: 'شهادة دورة',
  pathway_certificate: 'شهادة مسار كامل',
  recommendation: 'توصية مهنيّة',
}

const OPEN_STATUSES = ['pending', 'in_review']

export interface CreateRequestInput {
  kind: LearnerRequestKind
  enrollmentId?: string
  pathwayId?: string
  audienceAr?: string
  noteAr?: string
}

/** ما يمنع الطلبَ الآن — بالنصّ لا بزرٍّ مطفأ */
export interface Eligibility {
  eligible: boolean
  reasonsAr: string[]
  percent: number
}

export class LearnerRequestService {
  private prisma: PrismaClient
  private progress: ProgressService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.progress = new ProgressService(prisma)
  }

  /** طلباتُ صاحبها — الأحدثُ أوّلا */
  async mine(userId: string) {
    return this.prisma.learnerRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, kind: true, enrollmentId: true, pathwayId: true, audienceAr: true,
        status: true, decisionAr: true, decidedAt: true, createdAt: true,
      },
    })
  }

  /* ─────────── الأهليّة ─────────── */

  /** أهليّةُ شهادةِ دورةٍ لتسجيلٍ بعينه — قواعدُ الإكمال وحاجزُ توثيق البريد */
  async courseEligibility(userId: string, enrollmentId: string): Promise<Eligibility> {
    const e = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, userId },
      include: { certificates: { where: { status: 'active' } }, user: { select: { emailVerifiedAt: true } } },
    })
    if (!e) throw new AuthError('not_found', 'التسجيل غير موجود أو ليس لك', 404)
    if (e.certificates.length > 0) {
      return { eligible: false, reasonsAr: ['صدرت شهادتك لهذه الدورة'], percent: 100 }
    }

    const reasonsAr: string[] = []
    let percent = 0
    try {
      const check = await this.progress.evaluateCompletion(enrollmentId)
      percent = check.percent
      if (!check.complete) reasonsAr.push(...this.failuresAr(check.failures))
    } catch {
      /* تعذّرُ التقييم لا يجعله مؤهَّلا — يُقال ولا يُخفى */
      reasonsAr.push('تعذّر تقييم قواعد الإكمال الآن — أعد المحاولة بعد قليل')
    }
    /* الشهادةُ تُنسب إلى شخص، فلا تصدر لعنوانٍ لم يثبت أنّه يصل صاحبَه */
    if (!e.user.emailVerifiedAt) reasonsAr.push('وثّق بريدك أولا — الشهادة تُنسب إلى شخص')

    return { eligible: reasonsAr.length === 0, reasonsAr, percent }
  }

  /** أهليّةُ شهادةِ المسار كاملا — كلُّ دوراته منجَزة، لا أكثرُها */
  async pathwayEligibility(userId: string, pathwayId: string): Promise<Eligibility & { done: number; total: number }> {
    /* الدوراتُ المطلوبةُ وحدَها تُحسب: المساندةُ والهديّةُ والاختياريّةُ زياداتٌ
       على المسار لا شرطٌ فيه — فاشتراطُها يجعل شهادةَ المسار مستحيلةً على من
       أنجز تصميمَه كاملا. والحدُّ نفسُه هو ما يعرضه الكتالوجُ للعامّة
       (`course_ids` في لقطة النشر). */
    const courses = await this.prisma.pathwayCourse.findMany({
      where: { pathwayId, kind: 'required' },
      select: { courseId: true },
      orderBy: { sequence: 'asc' },
    })
    if (courses.length === 0) throw new AuthError('not_found', 'المسار غير موجود', 404)

    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId, cohort: { courseId: { in: courses.map((c) => c.courseId) } } },
      include: {
        cohort: { select: { courseId: true } },
        certificates: { where: { status: 'active' }, select: { id: true } },
        courseProgress: { select: { percent: true } },
      },
    })

    const doneCourses = new Set<string>()
    for (const e of enrollments) {
      const finished = e.status === 'completed' || e.certificates.length > 0 || (e.courseProgress?.percent ?? 0) >= 100
      if (finished) doneCourses.add(e.cohort.courseId)
    }
    const total = courses.length
    const done = doneCourses.size
    const reasonsAr = done >= total ? [] : [`أنجزت ${done} من ${total} دورات المسار — تبقى ${total - done}`]
    return {
      eligible: reasonsAr.length === 0,
      reasonsAr,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
      done,
      total,
    }
  }

  /* الأسبابُ بلغةٍ تُقرأ: كان `evaluateCompletion` يُعيد «attendance_pct:
     المطلوب 80 والمتحقق 55» — وهي رسالةٌ للإدارة لا للمتعلّم. */
  private failuresAr(failures: string[]): string[] {
    const NAME_AR: Record<string, string> = {
      attendance_pct: 'نسبة حضورك للجلسات',
      modules_completed: 'الدروس المكتملة',
      assignment_accepted: 'الواجبات المقبولة',
      project_accepted: 'مشروع الدورة المقبول',
      assessment_passed: 'التقييمات المجتازة',
    }
    return failures.map((f) => {
      const m = /^(\w+):\s*المطلوب\s*(\d+)\s*والمتحقق\s*(\d+)$/.exec(f)
      if (!m) return f
      const [, type, need, have] = m
      return `${NAME_AR[type] ?? type}: المطلوب ${need} والمتحقق ${have}`
    })
  }

  /* ─────────── الإنشاء ─────────── */

  async create(userId: string, input: CreateRequestInput) {
    /* طلبٌ معلَّقٌ قائم يُعاد ولا يُضاعَف */
    const existing = await this.prisma.learnerRequest.findFirst({
      where: {
        userId,
        kind: input.kind,
        status: { in: OPEN_STATUSES },
        ...(input.enrollmentId ? { enrollmentId: input.enrollmentId } : {}),
        ...(input.pathwayId ? { pathwayId: input.pathwayId } : {}),
      },
    })
    if (existing) return existing

    let subjectAr = ''
    if (input.kind === 'course_certificate') {
      if (!input.enrollmentId) throw new AuthError('bad_request', 'طلب شهادة الدورة يحتاج تسجيلها', 400)
      const check = await this.courseEligibility(userId, input.enrollmentId)
      if (!check.eligible) throw new AuthError('not_eligible', check.reasonsAr.join(' — '), 409)
      const e = await this.prisma.enrollment.findUnique({
        where: { id: input.enrollmentId },
        include: { cohort: { include: { course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } } } },
      })
      subjectAr = e?.cohort.course.versions[0]?.titleAr ?? e?.cohort.title ?? 'دورة'
    } else {
      if (!input.pathwayId) throw new AuthError('bad_request', 'الطلب يحتاج معرّف المسار', 400)
      const check = await this.pathwayEligibility(userId, input.pathwayId)
      if (!check.eligible) throw new AuthError('not_eligible', check.reasonsAr.join(' — '), 409)
      if (input.kind === 'recommendation' && !(input.audienceAr ?? '').trim()) {
        throw new AuthError('bad_request', 'اذكر لأيّ جهةٍ تريد التوصية — تُكتب باسمها', 400)
      }
      const version = await this.prisma.pathwayVersion.findFirst({
        where: { pathwayId: input.pathwayId },
        orderBy: { version: 'desc' },
        select: { title: true },
      })
      subjectAr = version?.title ?? input.pathwayId
    }

    const created = await this.prisma.learnerRequest.create({
      data: {
        userId,
        kind: input.kind,
        enrollmentId: input.enrollmentId ?? null,
        pathwayId: input.pathwayId ?? null,
        audienceAr: input.audienceAr?.trim() || null,
        noteAr: input.noteAr?.trim() || null,
      },
    })

    await recordAudit(this.prisma, {
      actorId: userId,
      action: 'learner.request.create',
      entityType: 'learner_request',
      entityId: created.id,
      after: { kind: input.kind, subjectAr },
    })
    await notifyRole(this.prisma, ['super_admin', 'academic_manager'], {
      channel: 'in_app',
      title: `طلب ${KIND_AR[input.kind]}`,
      body: `طلب متعلّم ${KIND_AR[input.kind]} عن «${subjectAr}» — بانتظار المراجعة في «طلبات المتعلّمين».`,
      templateKey: 'admin.learner_request',
      data: { requestId: created.id, kind: input.kind },
    })
    return created
  }

  /* ─────────── المراجعة الإداريّة ─────────── */

  /** الطلباتُ المفتوحة — الأقدمُ أوّلا، فمن انتظر أطولَ يُخدَم أوّلا */
  async queue(status?: string) {
    return this.prisma.learnerRequest.findMany({
      where: status ? { status } : { status: { in: OPEN_STATUSES } },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, displayName: true, email: true } },
        enrollment: {
          select: {
            id: true,
            cohort: { select: { id: true, title: true, courseId: true } },
          },
        },
      },
    })
  }

  /** قرارٌ على طلب — بسببٍ يُكتب ويُقرأ عند صاحبه */
  async decide(id: string, actorId: string, status: 'in_review' | 'fulfilled' | 'declined', decisionAr?: string) {
    const req = await this.prisma.learnerRequest.findUnique({ where: { id } })
    if (!req) throw new AuthError('not_found', 'الطلب غير موجود', 404)
    if (status === 'declined' && !(decisionAr ?? '').trim()) {
      throw new AuthError('bad_request', 'الاعتذار يحتاج سببا يُقرأ عند صاحبه', 400)
    }
    const updated = await this.prisma.learnerRequest.update({
      where: { id },
      data: {
        status,
        decisionAr: decisionAr?.trim() || null,
        ...(status === 'in_review' ? {} : { decidedAt: new Date(), decidedById: actorId }),
      },
    })
    await recordAudit(this.prisma, {
      actorId,
      action: `learner.request.${status}`,
      entityType: 'learner_request',
      entityId: id,
      before: { status: req.status },
      after: { status },
    })
    /* صاحبُ الطلب يُبلَّغ بالقرار — طلبٌ يُقرَّر بصمتٍ كأنّه لم يُقدَّم */
    if (status !== 'in_review') {
      const kind = KIND_AR[req.kind as LearnerRequestKind] ?? req.kind
      await safeNotify(this.prisma, {
        userId: req.userId,
        channel: 'in_app',
        title: status === 'fulfilled' ? `أُنجز طلبك: ${kind}` : `اعتذارٌ عن طلبك: ${kind}`,
        body: decisionAr?.trim() || (status === 'fulfilled' ? 'تجده في «خزانتي».' : 'تواصل معنا للتفاصيل.'),
        templateKey: 'learner.request_decided',
        data: { requestId: id, status },
      })
    }
    return updated
  }
}
