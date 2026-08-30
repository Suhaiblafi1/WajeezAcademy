/* خدمة التقييم (١و) — المدرّب والمستشار والدورة.

   ثلاث قواعد، كلٌّ منها وُضعت لعطبٍ محدّد يمكن أن يقع بلا أن يشتكي أحد:

   ١) **إخفاء الهوية عتبةٌ لا وعد.** في شعبة من ثلاثة، «التقييم بلا اسم» جملةٌ
      لا تحمي أحدا: يعرف المدرّب من حضر ومن غاب فيستنتج. فلا يرى المدرّب شيئا
      حتى تبلغ التقييمات عنه ثلاثةً، وحينها يراها مجمّعةً بلا ما يربط تعليقا
      بشخص. والإدارة ترى فورا — هي طرفٌ محايد وعليها واجب التدخّل.

   ٢) **المعدّل المعلَن يُحسب على كل التقييمات.** الاعتماد الإداريّ يحكم
      **التعليق المكتوب** وحده: يُحجب المسيء وما فيه بيانات شخصية. أمّا لو
      اختِيرت الدرجات التي تدخل المعدّل لصار الرقم دعايةً لا قياسا.

   ٣) **لا تقييم بلا تسجيل حقيقيّ وشعبةٍ بدأت.** ورأيٌ واحد لكل تسجيل لكل هدف:
      raterId يُحفظ لتثبيت ذلك، ولا يخرج في أيّ قراءة تصل المدرّب أو العامّة. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'

/** لا يرى المدرّب ولا العامّة شيئا تحت هذا العدد — عتبة إخفاء الهوية */
export const MIN_RATINGS_TO_REVEAL = 3

export const SUBJECT_TYPES = ['trainer', 'advisor', 'course'] as const
export type SubjectType = (typeof SUBJECT_TYPES)[number]

const SUBJECT_AR: Record<SubjectType, string> = {
  trainer: 'المدرّب',
  advisor: 'المستشار',
  course: 'الدورة',
}

export interface RateableSubject {
  subjectType: SubjectType
  subjectId: string
  nameAr: string
  enrollmentId: string
  /** درجة المتعلّم السابقة إن قيّم — الواجهة تعرضها بدل نموذج فارغ */
  myScore: number | null
  myComment: string | null
}

export class RatingService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** ما يستطيع هذا المتعلّم تقييمه: مدرّبو شعبه ودوراتها ومستشاره.
      الشرط: تسجيل قائم أو مكتمل، وشعبةٌ بدأت فعلا — لا يُقيَّم ما لم يُجرَّب. */
  async rateableFor(userId: string): Promise<RateableSubject[]> {
    const now = new Date()
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId, status: { in: ['enrolled', 'completed'] } },
      include: {
        cohort: {
          include: {
            course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } },
            trainers: { include: { profile: { include: { application: { select: { fullName: true } } } } } },
          },
        },
      },
    })
    const started = enrollments.filter((e) => !e.cohort.startsAt || e.cohort.startsAt <= now)
    if (started.length === 0) return []

    const mine = await this.prisma.rating.findMany({ where: { raterId: userId } })
    const key = (t: string, id: string, enrollmentId: string) => `${enrollmentId}|${t}|${id}`
    const byKey = new Map(mine.map((r) => [key(r.subjectType, r.subjectId, r.enrollmentId), r]))

    const out: RateableSubject[] = []
    for (const e of started) {
      const courseTitle = e.cohort.course.versions[0]?.titleAr ?? e.cohort.courseId
      const push = (subjectType: SubjectType, subjectId: string, nameAr: string) => {
        const prev = byKey.get(key(subjectType, subjectId, e.id))
        out.push({
          subjectType, subjectId, nameAr, enrollmentId: e.id,
          myScore: prev?.score ?? null, myComment: prev?.commentAr ?? null,
        })
      }
      push('course', e.cohort.courseId, courseTitle)
      for (const t of e.cohort.trainers) {
        push('trainer', t.profileId, t.profile.application.fullName)
      }
    }

    /* المستشار — من الحالة النشطة إن وُجدت. وقد لا يكون للمتعلّم مستشار أصلا،
       فلا يُعرض هدفٌ لا وجود له. ويُعلَّق بأوّل تسجيل: التقييم يخصّ الشخص لا الشعبة. */
    const advisor = await this.activeAdvisorFor(userId)
    if (advisor && started[0]) {
      const prev = byKey.get(key('advisor', advisor.id, started[0].id))
      out.push({
        subjectType: 'advisor', subjectId: advisor.id, nameAr: advisor.displayName,
        enrollmentId: started[0].id, myScore: prev?.score ?? null, myComment: prev?.commentAr ?? null,
      })
    }
    return out
  }

  /** مستشار المتعلّم النشط — عبر حالته وتعيينٍ لم يُلغَ. null حين لا مستشار. */
  async activeAdvisorFor(userId: string): Promise<{ id: string; displayName: string } | null> {
    const assignment = await this.prisma.advisorAssignment.findFirst({
      where: { unassignedAt: null, case: { clientId: userId } },
      orderBy: { assignedAt: 'desc' },
      include: { advisor: { select: { id: true, displayName: true } } },
    })
    return assignment?.advisor ?? null
  }

  /** إرسال تقييم أو تعديله — تقييم واحد لكل تسجيل لكل هدف.
      التعديل يُعيد التعليق إلى «بانتظار المراجعة»: نصٌّ اعتُمد ثم غُيّر لم يُراجَع. */
  async submit(
    userId: string,
    input: { enrollmentId: string; subjectType: SubjectType; subjectId: string; score: number; commentAr?: string },
  ) {
    if (!SUBJECT_TYPES.includes(input.subjectType)) throw new AuthError('bad_subject', 'نوع الهدف غير معروف')
    if (!Number.isInteger(input.score) || input.score < 1 || input.score > 5) {
      throw new AuthError('bad_score', 'الدرجة من ١ إلى ٥')
    }
    const comment = input.commentAr?.trim() || null
    if (comment && comment.length > 1500) throw new AuthError('too_long', 'التعليق أطول من ١٥٠٠ حرف')

    /* الهدف يجب أن يكون مما يستطيع هذا المتعلّم تقييمه فعلا — لا تقييم بمعرّف
       يُرسَل من الخارج. القائمة نفسها هي الحارس، فلا يتفرّق الشرطان. */
    const allowed = await this.rateableFor(userId)
    const match = allowed.find(
      (a) => a.enrollmentId === input.enrollmentId && a.subjectType === input.subjectType && a.subjectId === input.subjectId,
    )
    if (!match) throw new AuthError('not_rateable', 'لا تستطيع تقييم هذا — تحقّق من تسجيلك وأن الشعبة بدأت', 403)

    const data = {
      score: input.score, commentAr: comment,
      publishStatus: 'pending', moderatedBy: null, moderatedAt: null, moderationReason: null,
    }
    const row = await this.prisma.rating.upsert({
      where: {
        enrollmentId_subjectType_subjectId: {
          enrollmentId: input.enrollmentId, subjectType: input.subjectType, subjectId: input.subjectId,
        },
      },
      update: data,
      create: {
        enrollmentId: input.enrollmentId, raterId: userId,
        subjectType: input.subjectType, subjectId: input.subjectId, ...data,
      },
    })
    /* الأثر بلا معرّف المُقيِّم: سجلّ التدقيق يُقرأ من الإدارة، وربطُ الاسم
       بالتقييم فيه ينقض إخفاء الهوية من باب خلفيّ. */
    await recordAudit(this.prisma, {
      actorId: null, action: 'rating.submit', entityType: 'rating', entityId: row.id,
      meta: { subjectType: input.subjectType, subjectId: input.subjectId },
    })
    if (input.subjectType === 'trainer') await this.recomputeTrainerAggregate(input.subjectId)
    return { id: row.id, subjectAr: SUBJECT_AR[input.subjectType] }
  }

  /** التجميعة الخام لهدف — تُستعمل داخليا وتُغلَّف قبل أن تصل أحدا */
  private async aggregate(subjectType: SubjectType, subjectId: string) {
    const rows = await this.prisma.rating.findMany({ where: { subjectType, subjectId }, select: { score: true } })
    const count = rows.length
    const avg = count ? rows.reduce((s, r) => s + r.score, 0) / count : null
    return { count, avg: avg == null ? null : Math.round(avg * 10) / 10 }
  }

  /** يكتب متوسّط المدرّب وعدده في ملفه — العمودان اللذان ترسمهما صفحة المدرّبين.
      دون العتبة يُكتب null: صفحة عامّة تعرض «٥٫٠ من تقييم واحد» تبيع وهما. */
  async recomputeTrainerAggregate(profileId: string) {
    const { count, avg } = await this.aggregate('trainer', profileId)
    const reveal = count >= MIN_RATINGS_TO_REVEAL
    await this.prisma.trainerProfile.update({
      where: { id: profileId },
      data: { ratingAvg: reveal ? avg : null, ratingCount: reveal ? count : null },
    })
    return { count, avg, revealed: reveal }
  }

  /** ما يراه صاحب الشأن عن نفسه — مجمّعا، وبلا مُقيِّم، ودون العتبة لا شيء. */
  async forSubject(subjectType: SubjectType, subjectId: string) {
    const { count, avg } = await this.aggregate(subjectType, subjectId)
    if (count < MIN_RATINGS_TO_REVEAL) {
      return {
        revealed: false as const, count: 0, avg: null,
        noticeAr: `لا تُعرض التقييمات حتى تبلغ ${MIN_RATINGS_TO_REVEAL} — في العدد القليل يُستدلّ على أصحابها.`,
      }
    }
    const rows = await this.prisma.rating.findMany({
      where: { subjectType, subjectId, commentAr: { not: null } },
      orderBy: { createdAt: 'desc' },
      /* لا raterId ولا enrollmentId ولا createdAt دقيقا: كلها تدلّ على الشخص */
      select: { score: true, commentAr: true },
    })
    const dist = [1, 2, 3, 4, 5].map((n) => ({ score: n, count: 0 }))
    const all = await this.prisma.rating.findMany({ where: { subjectType, subjectId }, select: { score: true } })
    for (const r of all) dist[r.score - 1].count += 1
    return {
      revealed: true as const, count, avg, distribution: dist,
      comments: rows.map((r) => ({ score: r.score, commentAr: r.commentAr as string })),
    }
  }

  /** طابور المراجعة — الإدارة ترى فورا وبلا عتبة، ومعها اسم المُقيِّم؟ لا.
      حتى الإدارة تراه مجهولا: واجبُها الحكم على النصّ لا على قائله. */
  async moderationQueue(status: string = 'pending') {
    const rows = await this.prisma.rating.findMany({
      where: { publishStatus: status, commentAr: { not: null } },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: {
        id: true, subjectType: true, subjectId: true, score: true, commentAr: true,
        publishStatus: true, createdAt: true, moderationReason: true,
      },
    })
    return rows
  }

  /** اعتماد تعليقٍ للنشر أو رفضه — الدرجة لا تتأثّر بهذا القرار أبدا */
  async moderate(ratingId: string, actorId: string, approve: boolean, reason?: string) {
    const row = await this.prisma.rating.findUnique({ where: { id: ratingId } })
    if (!row) throw new AuthError('not_found', 'التقييم غير موجود', 404)
    if (!approve && !reason?.trim()) throw new AuthError('reason_required', 'الرفض يحتاج سببا مكتوبا')
    const updated = await this.prisma.rating.update({
      where: { id: ratingId },
      data: {
        publishStatus: approve ? 'approved' : 'rejected',
        moderatedBy: actorId, moderatedAt: new Date(), moderationReason: reason?.trim() || null,
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: approve ? 'rating.approve' : 'rating.reject', entityType: 'rating', entityId: ratingId,
      reason: reason?.trim(), meta: { subjectType: row.subjectType, subjectId: row.subjectId },
    })
    return { id: updated.id, publishStatus: updated.publishStatus }
  }

  /** ما يُعرض للعامّة عن هدف: المعدّل من **كل** التقييمات، والتعليقات
      المعتمدة وحدها. تحت العتبة لا يُعرض شيء. */
  async publicFor(subjectType: SubjectType, subjectId: string) {
    const { count, avg } = await this.aggregate(subjectType, subjectId)
    if (count < MIN_RATINGS_TO_REVEAL) return { revealed: false as const, count: 0, avg: null, comments: [] }
    const approved = await this.prisma.rating.findMany({
      where: { subjectType, subjectId, publishStatus: 'approved', commentAr: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { score: true, commentAr: true },
    })
    return {
      revealed: true as const, count, avg,
      comments: approved.map((r) => ({ score: r.score, commentAr: r.commentAr as string })),
    }
  }
}
