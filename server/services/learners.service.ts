/* الطلبةُ المسجَّلون — قائمةٌ واحدة، ونطاقُ كلِّ دورٍ يُشتقّ من صلاحيّاته.

   قرارُ صاحب المنصّة: «أضف لبوابات السوبر، والمدير الأكاديميّ، والمدرّب
   (طلابه فقط)، والمستشار (حالاته فقط) وصولا لقائمة الطلبة المسجَّلين مع
   صلاحية حذف/إضافة طالب أو تعديل حسابه — كلُّ دورٍ يرى نطاقَه فقط».

   ─────────── لماذا يُشتقّ النطاقُ ولا يُمرَّر ───────────

   البابُ واحد لأربعة أدوار، ولو أخذ معامِلا يقول «أرِني طلبةَ فلان» لصار
   حدُّ كلِّ دورٍ في يد العميل: يكفي أن يبدّل المدرّبُ معرّفا في الطلب ليرى
   طلبةَ غيره. فالنطاقُ يُقرأ من صلاحيّات صاحب الجلسة نفسِها، ولا شيءَ في
   الطلب يوسّعه.

   وثلاثةُ نطاقات لا أربعة:

   · `enrollment.manage` — الكلّ. وهي صلاحيةُ من يسجّل ويحذف أصلا.
   · `trainer.cohort.operate` — طلبةُ شعبه هو، مقروءةً من `CohortTrainer`.
   · `advisor.cases.view` — عملاءُ حالاته المسندة إليه وحدَها، وهي التي لم
     يُلغَ تعيينُها (`unassignedAt: null`).

   والكتابةُ (إضافةٌ وحذفٌ وتعديلُ حساب) لأصحاب النطاق الأوّل وحدَهم: المدرّبُ
   يرى طلبتَه ولا يسجّل أحدا ولا يحذفه، والمستشارُ يتابع ولا يعدّل حسابا.
   ولو جاز غيرُ ذلك لصار من يرى قادرا على أن يغيّر.

   الحارس: server/tests/learning/learner-access.test.ts */

import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { EnrollmentService } from './enrollment.service'

/** نطاقُ الرؤية — مشتقٌّ من صلاحيّات الجلسة لا من الطلب */
export type LearnerScope =
  | { kind: 'all' }
  | { kind: 'trainer'; userId: string }
  | { kind: 'advisor'; userId: string }

export interface Caller {
  userId: string
  permissions: string[]
}

/** يُشتقّ النطاقُ من الصلاحيّات — والأوسعُ يغلب */
export function scopeFor(caller: Caller): LearnerScope | null {
  if (caller.permissions.includes('enrollment.manage')) return { kind: 'all' }
  if (caller.permissions.includes('trainer.cohort.operate')) return { kind: 'trainer', userId: caller.userId }
  if (caller.permissions.includes('advisor.cases.view')) return { kind: 'advisor', userId: caller.userId }
  return null
}

/** أيملك صاحبُ النطاق أن يكتب؟ الرؤيةُ لا تُعطي التعديل */
export const canWrite = (scope: LearnerScope) => scope.kind === 'all'

export class LearnersService {
  private prisma: PrismaClient
  private enrollments: EnrollmentService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.enrollments = new EnrollmentService(prisma)
  }

  /* شرطُ التسجيلات الذي يحصر النطاق — يُبنى مرّةً ويُستعمل في القراءة
     وفي حراسة الكتابة معا، فلا يفترق ما يُرى عمّا يُمَسّ. */
  private async enrollmentWhere(scope: LearnerScope): Promise<Prisma.EnrollmentWhereInput> {
    if (scope.kind === 'all') return {}
    if (scope.kind === 'trainer') {
      const profile = await this.prisma.trainerProfile.findUnique({
        where: { userId: scope.userId }, select: { id: true },
      })
      /* بلا ملفِّ مدرّبٍ لا شعبَ له — فلا طلبة. ولا يُقرأ هذا «الكلّ». */
      if (!profile) return { id: { in: [] } }
      return { cohort: { trainers: { some: { profileId: profile.id } } } }
    }
    /* المستشار: عملاءُ حالاته المسندة إليه والتي لم يُلغَ تعيينُها */
    const cases = await this.prisma.advisorCase.findMany({
      where: { assignments: { some: { advisorId: scope.userId, unassignedAt: null } }, clientId: { not: null } },
      select: { clientId: true },
    })
    const ids = cases.map((c) => c.clientId!).filter(Boolean)
    return { userId: { in: ids.length > 0 ? ids : [] } }
  }

  /** الطلبةُ في نطاق صاحب الجلسة — بتسجيلاتهم وتقدّمهم */
  async list(scope: LearnerScope, opts: { q?: string; cohortId?: string } = {}) {
    const where = await this.enrollmentWhere(scope)
    const enrollments = await this.prisma.enrollment.findMany({
      /* بـ`AND` لا بالنشر: شرطُ النطاق لا يُداس بمرشِّحٍ يشاركه مفتاحا */
      where: this.scopedFor(where, {
        status: { not: 'dropped' },
        ...(opts.cohortId ? { cohortId: opts.cohortId } : {}),
        ...(opts.q
          ? {
              user: {
                OR: [
                  { displayName: { contains: opts.q, mode: 'insensitive' } },
                  { email: { contains: opts.q, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      }),
      include: {
        user: { select: { id: true, email: true, displayName: true, status: true, createdAt: true } },
        cohort: {
          select: {
            id: true, title: true, status: true, startsAt: true, courseId: true,
            course: { select: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
          },
        },
        courseProgress: { select: { percent: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    /* الطالبُ صفٌّ واحد بتسجيلاته، لا صفٌّ لكلّ تسجيل: من له ثلاثُ شعبٍ
       شخصٌ واحد، وعرضُه ثلاثَ مرّات يجعل «كم طالبا لدينا؟» سؤالا بلا جواب. */
    const byUser = new Map<string, {
      user: (typeof enrollments)[number]['user']
      enrollments: { id: string; cohortId: string; cohortTitle: string; courseTitle: string; status: string; percent: number; startsAt: Date | null }[]
    }>()
    for (const e of enrollments) {
      const row = byUser.get(e.userId) ?? { user: e.user, enrollments: [] }
      row.enrollments.push({
        id: e.id,
        cohortId: e.cohortId,
        cohortTitle: e.cohort.title,
        courseTitle: e.cohort.course.versions[0]?.titleAr ?? e.cohort.courseId,
        status: e.status,
        percent: e.courseProgress?.percent ?? 0,
        startsAt: e.cohort.startsAt,
      })
      byUser.set(e.userId, row)
    }
    return [...byUser.values()]
  }

  /* دمجُ شرطِ النطاق بشرطِ الطالب — بـ`AND` لا بالنشر.

     كان `{ ...where, userId }`، وشرطُ نطاق المستشار نفسُه على `userId`
     (`{ userId: { in: [...] } }`). فالمفتاحُ الثاني يدوس الأوّل ويسقط النطاقُ
     كلُّه: يكفي أن ينسخ المستشارُ معرّفَ طالبٍ ليس في حالاته ليقرأه.

     ولم يظهر في نطاق المدرّب لأنّ شرطَه على `cohort` لا على `userId` — فلا
     تصادمَ بين مفتاحين. أي أنّ اختبارا يغطّي المدرّبَ وحدَه كان سيمرّ على
     الثغرة وهي قائمة. */
  private scopedFor(where: Prisma.EnrollmentWhereInput, extra: Prisma.EnrollmentWhereInput): Prisma.EnrollmentWhereInput {
    return { AND: [where, extra] }
  }

  /** يتأكّد أنّ هذا الطالب داخلَ نطاق صاحب الجلسة — قبل أيّ قراءةٍ أو كتابة */
  private async assertInScope(scope: LearnerScope, userId: string) {
    if (scope.kind === 'all') return
    const where = await this.enrollmentWhere(scope)
    const seen = await this.prisma.enrollment.findFirst({
      where: this.scopedFor(where, { userId }), select: { id: true },
    })
    if (!seen) throw new AuthError('out_of_scope', 'هذا الطالب خارج نطاقك', 403)
  }

  async detail(scope: LearnerScope, userId: string) {
    await this.assertInScope(scope, userId)
    const where = await this.enrollmentWhere(scope)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, status: true, createdAt: true, emailVerifiedAt: true },
    })
    if (!user) throw new AuthError('not_found', 'الحساب غير موجود', 404)
    const enrollments = await this.prisma.enrollment.findMany({
      where: this.scopedFor(where, { userId }),
      include: {
        cohort: {
          select: {
            id: true, title: true, status: true, startsAt: true, courseId: true,
            course: { select: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
          },
        },
        courseProgress: { select: { percent: true } },
        _count: { select: { attendance: true, submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return { user, enrollments }
  }

  /* ─────────── الكتابة: لأصحاب `enrollment.manage` وحدَهم ─────────── */

  private assertWritable(scope: LearnerScope) {
    if (!canWrite(scope)) {
      throw new AuthError('read_only', 'نطاقُك للاطّلاع لا للتعديل — التسجيلُ والحذفُ بصلاحية إدارة التسجيل', 403)
    }
  }

  /** يسجّل طالبا في شعبة — بالمسلك نفسِه الذي يسلكه الشراء، لا بكتابةٍ مباشرة */
  async addToCohort(scope: LearnerScope, userId: string, cohortId: string, actorId: string) {
    this.assertWritable(scope)
    const enrollment = await this.enrollments.enroll(cohortId, userId, actorId, {})
    await recordAudit(this.prisma, {
      actorId, action: 'learner.enroll.manual', entityType: 'enrollment', entityId: enrollment.id,
      meta: { userId, cohortId, status: enrollment.status },
      reason: 'تسجيلٌ إداريّ من شاشة الطلبة',
    })
    return enrollment
  }

  /** يُخرج طالبا من شعبة — انسحابٌ موثَّق لا محوٌ للسجلّ */
  async removeFromCohort(scope: LearnerScope, enrollmentId: string, actorId: string, note?: string) {
    this.assertWritable(scope)
    const e = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId } })
    if (!e) throw new AuthError('not_found', 'التسجيل غير موجود', 404)
    /* لا يُمحى الصفّ: الحضورُ والتسليماتُ والدرجاتُ معلَّقةٌ به، ومحوُه يمحوها
       ويمحو أثرَ من درس. `dropped` تُخرجه من كلّ شاشةٍ ويبقى السجلّ. */
    return this.enrollments.drop(enrollmentId, actorId, note)
  }

  /** تعديلُ حساب الطالب — الاسمُ والبريدُ والحالة، بأثرٍ يُقرأ */
  async updateAccount(
    scope: LearnerScope, userId: string, actorId: string,
    patch: { displayName?: string; email?: string; status?: 'active' | 'suspended' },
  ) {
    this.assertWritable(scope)
    const before = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!before) throw new AuthError('not_found', 'الحساب غير موجود', 404)

    if (patch.email && patch.email !== before.email) {
      const taken = await this.prisma.user.findUnique({ where: { email: patch.email } })
      if (taken) throw new AuthError('email_taken', 'هذا البريد مستعمَل لحسابٍ آخر', 409)
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: {
          ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
          /* تبديلُ البريد يُسقط توثيقَه: العنوانُ الجديد لم يُثبت أحدٌ ملكيّته */
          ...(patch.email !== undefined ? { email: patch.email, emailVerifiedAt: null } : {}),
          ...(patch.status !== undefined
            ? { status: patch.status, suspendedAt: patch.status === 'suspended' ? new Date() : null }
            : {}),
        },
      })
      /* الإيقافُ يُبطل الجلسات فورا — وإلّا بقي الموقوفُ داخلا حتّى تنتهي كعكته */
      if (patch.status === 'suspended') {
        await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
      }
      return u
    })

    await recordAudit(this.prisma, {
      actorId, action: 'learner.account.update', entityType: 'user', entityId: userId,
      meta: {
        ...(patch.displayName !== undefined ? { displayName: { from: before.displayName, to: patch.displayName } } : {}),
        ...(patch.email !== undefined ? { email: { from: before.email, to: patch.email } } : {}),
        ...(patch.status !== undefined ? { status: { from: before.status, to: patch.status } } : {}),
      },
    })
    return { id: updated.id, email: updated.email, displayName: updated.displayName, status: updated.status }
  }
}
