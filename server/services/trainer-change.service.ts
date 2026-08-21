/* خدمة اقتراحات المدربين لتعديل الدورات —
   المدرب يقترح فقط على دورة مؤهل لها أو مسندة إليه. لا يعدّل المنشور مباشرة.
   maker-checker: المدرب لا يوافق على اقتراحه، والمراجع لا يعتمد اقتراحا بريده هو.
   نطاقان: شعبة واحدة (CohortDeliveryPlan) أو الكتالوج (إصدار CourseVersion جديد).
   حقول محظورة على المدرب: السعر، قواعد التشخيص، الأوزان، المهارات الأساسية،
   حالة النشر، المخرج الإلزامي، المسارات المرتبطة. */

import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'

export const CHANGE_TYPES = [
  'module_title_edit', 'module_add', 'module_reorder', 'explanation_improve',
  'material_add', 'activity_add', 'assignment_add', 'assessment_improve',
  'examples_update', 'duration_propose', 'project_propose', 'outcome_propose',
] as const
export type ChangeType = (typeof CHANGE_TYPES)[number]

/* مفاتيح محظورة داخل afterValue — حماية عميقة فوق حصر أنواع التغيير */
const FORBIDDEN_PAYLOAD_KEYS = [
  'priceUsd', 'price', 'status', 'publish', 'published', 'skills', 'skillIds', 'coreSkills',
  'weights', 'scoring', 'diagnostic', 'pathways', 'pathwayIds', 'mandatoryOutcome',
]

export interface ChangeItemInput {
  changeType: ChangeType
  targetKey?: string
  beforeValue?: unknown
  afterValue?: unknown
  note?: string
}

interface ModuleShape {
  id: string
  sequence: number
  titleAr: string
  outcomeAr?: string | null
  activityAr?: string | null
  artifactAr?: string | null
  /** متن الدرس (ح-١) — يُنقل مع النسخة */
  bodyAr?: string | null
  /** تمرين الاسترجاع (ح-٣) — يُنقل مع النسخة */
  checksAr?: string | null
  /** فيديو الوحدة (ح-٢) — يُنقل مع النسخة */
  videoAr?: string | null
  scenarioAr?: string | null
  hours: number
}

export class TrainerChangeService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** ملف المدرب من المستخدم الموثق — بوابة المدرب */
  async profileForUser(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { userId }, include: { application: true, qualifications: true, assignments: true },
    })
    if (!profile) throw new AuthError('no_profile', 'لا ملف مدرب مرتبطا بهذا الحساب', 404)
    if (profile.suspendedAt || profile.application.status !== 'active') {
      throw new AuthError('suspended', 'حسابك التدريبي موقوف — تواصل مع الإدارة', 403)
    }
    return profile
  }

  /** هل يحق للمدرب الاقتراح على هذه الدورة؟ — مؤهل لها أو مسندة إليه فعّال */
  private async assertCanPropose(profileId: string, courseId: string) {
    const [qual, assignment] = await Promise.all([
      this.prisma.trainerCourseQualification.findUnique({ where: { profileId_courseId: { profileId, courseId } } }),
      this.prisma.trainerCourseAssignment.findFirst({ where: { profileId, courseId, status: 'active' } }),
    ])
    const qualified = qual?.status === 'qualified'
    if (!qualified && !assignment) {
      throw new AuthError('not_qualified', 'لا يمكنك الاقتراح إلا على دورة مؤهل لها أو مسندة إليك', 403)
    }
  }

  /** تقديم اقتراح تعديل — مسودة أولا ثم submitted */
  async submit(userId: string, input: {
    courseId: string; scope: 'cohort' | 'catalog'; cohortId?: string
    reason: string; evidence?: string; items: ChangeItemInput[]
  }) {
    const profile = await this.profileForUser(userId)
    const course = await this.prisma.course.findUnique({ where: { id: input.courseId } })
    if (!course) throw new AuthError('unknown_course', 'الدورة غير موجودة', 404)
    await this.assertCanPropose(profile.id, input.courseId)
    if (input.reason.trim().length < 10) throw new AuthError('no_reason', 'سبب التعديل مطلوب بوضوح')
    if (!input.items.length) throw new AuthError('no_items', 'الاقتراح بلا عناصر تغيير')

    for (const item of input.items) {
      if (!CHANGE_TYPES.includes(item.changeType)) throw new AuthError('bad_change_type', `نوع تغيير غير مدعوم: ${item.changeType}`)
      const keys = item.afterValue && typeof item.afterValue === 'object' ? Object.keys(item.afterValue as object) : []
      for (const k of keys) {
        if (FORBIDDEN_PAYLOAD_KEYS.includes(k)) {
          throw new AuthError('forbidden_field', `لا يجوز للمدرب تعديل «${k}» — السعر وقواعد التشخيص والمهارات الأساسية والنشر والمخرجات الإلزامية والمسارات محفوظة للإدارة`, 403)
        }
      }
    }

    if (input.scope === 'cohort') {
      if (!input.cohortId) throw new AuthError('no_cohort', 'نطاق الشعبة يتطلب تحديد الشعبة')
      const cohort = await this.prisma.cohort.findUnique({ where: { id: input.cohortId } })
      if (!cohort) throw new AuthError('unknown_cohort', 'الشعبة غير موجودة', 404)
    }

    const request = await this.prisma.trainerChangeRequest.create({
      data: {
        profileId: profile.id, courseId: input.courseId, baseCourseVersion: course.currentVersion,
        scope: input.scope, cohortId: input.cohortId ?? null,
        status: 'submitted', reason: input.reason, evidence: input.evidence,
        items: {
          create: input.items.map((i) => ({
            changeType: i.changeType, targetKey: i.targetKey,
            beforeValue: i.beforeValue as Prisma.InputJsonValue, afterValue: i.afterValue as Prisma.InputJsonValue,
            note: i.note,
          })),
        },
      },
      include: { items: true },
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.change.submit', entityType: 'trainer_change_request', entityId: request.id,
      meta: { courseId: input.courseId, scope: input.scope, items: input.items.length },
    })
    return request
  }

  async listMine(userId: string) {
    const profile = await this.profileForUser(userId)
    return this.prisma.trainerChangeRequest.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'desc' },
      include: { items: true, course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } },
    })
  }

  async withdraw(userId: string, requestId: string) {
    const profile = await this.profileForUser(userId)
    const req = await this.prisma.trainerChangeRequest.findUnique({ where: { id: requestId } })
    if (!req || req.profileId !== profile.id) throw new AuthError('not_found', 'الاقتراح غير موجود', 404)
    if (!['draft', 'submitted', 'under_review', 'changes_requested'].includes(req.status)) {
      throw new AuthError('bad_state', 'لا يمكن سحب الاقتراح في هذه الحالة', 409)
    }
    return this.prisma.trainerChangeRequest.update({ where: { id: requestId }, data: { status: 'withdrawn' } })
  }

  /* ─────────── مراجعة المسؤول الأكاديمي (checker) ─────────── */

  async listForReview(status?: string) {
    return this.prisma.trainerChangeRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        profile: { include: { application: { select: { fullName: true, email: true } } } },
        course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } },
        cohort: true,
      },
    })
  }

  /** قرار المراجعة — maker-checker: لا يعتمد من بريده بريد المدرب صاحب الاقتراح */
  async decide(requestId: string, checkerId: string, action:
    | 'request_changes' | 'reject' | 'approve_for_cohort' | 'approve_for_catalog',
    comment?: string, scheduledPublishAt?: Date) {
    const req = await this.prisma.trainerChangeRequest.findUnique({
      where: { id: requestId },
      include: { profile: { include: { application: true } } },
    })
    if (!req) throw new AuthError('not_found', 'الاقتراح غير موجود', 404)
    if (!['submitted', 'under_review', 'changes_requested'].includes(req.status)) {
      throw new AuthError('bad_state', 'الاقتراح ليس قيد المراجعة', 409)
    }
    /* المدرب لا يوافق على اقتراحه — والمراجع لا يبت في اقتراح بريده هو */
    if (req.profile.userId === checkerId) {
      throw new AuthError('maker_checker', 'لا يجوز للمدرب اعتماد اقتراحه بنفسه (maker-checker)', 403)
    }
    const checker = await this.prisma.user.findUnique({ where: { id: checkerId } })
    if (checker && checker.email === req.profile.application.email) {
      throw new AuthError('self_decision', 'لا يجوز البت في اقتراح مرتبط ببريدك', 403)
    }
    if (action === 'approve_for_cohort' && req.scope !== 'cohort') {
      throw new AuthError('scope_mismatch', 'الاعتماد لشعبة يتطلب اقتراحا بنطاق شعبة', 409)
    }
    if (action === 'approve_for_catalog' && req.scope !== 'catalog') {
      throw new AuthError('scope_mismatch', 'الاعتماد للكتالوج يتطلب اقتراحا بنطاق كتالوج', 409)
    }
    if (action === 'reject' && !comment?.trim()) {
      throw new AuthError('no_reason', 'الرفض يتطلب سببا مكتوبا')
    }

    const statusMap: Record<typeof action, string> = {
      request_changes: 'changes_requested', reject: 'rejected',
      approve_for_cohort: 'approved_for_cohort', approve_for_catalog: 'approved_for_catalog',
    }
    const updated = await this.prisma.trainerChangeRequest.update({
      where: { id: requestId },
      data: {
        status: statusMap[action], reviewedBy: checkerId, reviewedAt: new Date(),
        reviewerComment: comment, scheduledPublishAt: scheduledPublishAt ?? null,
      },
    })
    await recordAudit(this.prisma, {
      actorId: checkerId, action: 'trainer.change.decide', entityType: 'trainer_change_request', entityId: requestId,
      meta: { action, comment },
    })
    return updated
  }

  /* ─────────── النشر في النطاق المعتمد ─────────── */

  /** نشر اقتراح معتمد — كتالوج: إصدار جديد للدورة؛ شعبة: خطة تنفيذ للشعبة */
  async publish(requestId: string, actorId: string) {
    const req = await this.prisma.trainerChangeRequest.findUnique({
      where: { id: requestId }, include: { items: true, course: true },
    })
    if (!req) throw new AuthError('not_found', 'الاقتراح غير موجود', 404)
    if (!['approved_for_cohort', 'approved_for_catalog'].includes(req.status)) {
      throw new AuthError('bad_state', 'الاقتراح غير معتمد للنشر', 409)
    }

    if (req.status === 'approved_for_cohort') {
      await this.publishToCohort(req, actorId)
    } else {
      await this.publishToCatalog(req, actorId)
    }

    /* إنهاء الاقتراح وإحالة ما سبقه لنفس النطاق */
    await this.prisma.$transaction(async (tx) => {
      await tx.trainerChangeRequest.update({ where: { id: requestId }, data: { status: 'published' } })
      await tx.trainerChangeRequest.updateMany({
        where: {
          courseId: req.courseId, scope: req.scope, id: { not: requestId },
          status: { in: ['approved_for_cohort', 'approved_for_catalog', 'published'] },
        },
        data: { status: 'superseded' },
      })
      await recordAudit(tx, {
        actorId, action: 'trainer.change.publish', entityType: 'trainer_change_request', entityId: requestId,
        meta: { scope: req.scope, courseId: req.courseId },
      })
    })
  }

  /** نطاق شعبة — خطة تنفيذ تعتمد لشعبة واحدة دون المساس بالكتالوج */
  private async publishToCohort(req: { id: string; cohortId: string | null; items: { changeType: string; targetKey: string | null; afterValue: unknown }[]; courseId: string }, actorId: string) {
    if (!req.cohortId) throw new AuthError('no_cohort', 'الاقتراح بلا شعبة', 409)
    const content = {
      amendments: req.items.map((i) => ({ type: i.changeType, target: i.targetKey, value: i.afterValue })),
      appliedAt: new Date().toISOString(),
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.cohortDeliveryPlan.updateMany({ where: { cohortId: req.cohortId!, status: 'published' }, data: { status: 'superseded' } })
      await tx.cohortDeliveryPlan.create({
        data: {
          cohortId: req.cohortId!, content: content as unknown as Prisma.InputJsonValue,
          status: 'published', sourceChangeRequestId: req.id, createdBy: actorId,
        },
      })
    })
  }

  /** نطاق كتالوج — إصدار CourseVersion جديد بالتعديلات البنيوية، بلا مساس بالإصدار المنشور */
  private async publishToCatalog(req: { id: string; courseId: string; items: { changeType: string; targetKey: string | null; beforeValue: unknown; afterValue: unknown }[] }, actorId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: req.courseId },
      include: {
        versions: { where: { version: { not: undefined } }, orderBy: { version: 'desc' }, take: 1 },
        modules: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } }, orderBy: { createdAt: 'asc' } },
      },
    })
    if (!course) throw new AuthError('unknown_course', 'الدورة غير موجودة', 404)
    const baseVersion = course.versions[0]
    if (!baseVersion) throw new AuthError('no_base', 'الدورة بلا إصدار أساسي', 409)

    /* نسخ الوحدات الحالية ثم تطبيق العمليات البنيوية حتميا */
    const modules: ModuleShape[] = course.modules
      .map((m) => ({
        id: m.id,
        sequence: m.versions[0]?.sequence ?? 0,
        titleAr: m.versions[0]?.titleAr ?? '',
        outcomeAr: m.versions[0]?.outcomeAr, activityAr: m.versions[0]?.activityAr,
        artifactAr: m.versions[0]?.artifactAr, bodyAr: m.versions[0]?.bodyAr,
        checksAr: m.versions[0]?.checksAr, videoAr: m.versions[0]?.videoAr,
        scenarioAr: m.versions[0]?.scenarioAr,
        hours: m.versions[0]?.hours ?? 1,
      }))
      .sort((a, b) => a.sequence - b.sequence)

    let totalHours = baseVersion.totalHours
    let durationProposed: number | null = null

    for (const item of req.items) {
      const after = (item.afterValue ?? {}) as Record<string, unknown>
      switch (item.changeType) {
        case 'module_title_edit': {
          const m = modules.find((x) => x.id === item.targetKey)
          if (m && typeof after.titleAr === 'string') m.titleAr = after.titleAr
          break
        }
        case 'module_add': {
          const seq = modules.length + 1
          modules.push({
            id: `${course.id}-M${seq}`, sequence: seq,
            titleAr: typeof after.titleAr === 'string' ? after.titleAr : 'وحدة جديدة',
            outcomeAr: (after.outcomeAr as string) ?? null, activityAr: (after.activityAr as string) ?? null,
            artifactAr: (after.artifactAr as string) ?? null, hours: (after.hours as number) ?? 2,
          })
          totalHours += (after.hours as number) ?? 2
          break
        }
        case 'module_reorder': {
          const order = Array.isArray(after.order) ? (after.order as string[]) : []
          modules.sort((a, b) => {
            const ia = order.indexOf(a.id); const ib = order.indexOf(b.id)
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
          })
          modules.forEach((m, i) => { m.sequence = i + 1 })
          break
        }
        case 'duration_propose': {
          if (typeof after.totalHours === 'number' && after.totalHours > 0) {
            durationProposed = after.totalHours
            totalHours = after.totalHours
          }
          break
        }
        case 'explanation_improve': case 'examples_update': case 'material_add': case 'activity_add': {
          const m = modules.find((x) => x.id === item.targetKey)
          const text = (after.text as string) ?? (after.activityAr as string)
          if (m && text) m.activityAr = [m.activityAr, text].filter(Boolean).join('\n— إضافة معتمدة: ')
          break
        }
        case 'assignment_add': case 'project_propose': {
          const m = modules.find((x) => x.id === item.targetKey)
          const text = (after.text as string) ?? (after.artifactAr as string)
          if (m && text) m.artifactAr = [m.artifactAr, text].filter(Boolean).join('\n— إضافة معتمدة: ')
          break
        }
        case 'assessment_improve': case 'outcome_propose': {
          const m = modules.find((x) => x.id === item.targetKey)
          const text = (after.text as string) ?? (after.outcomeAr as string)
          if (m && text) m.outcomeAr = [m.outcomeAr, text].filter(Boolean).join('\n— إضافة معتمدة: ')
          break
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const newVersion = course.currentVersion + 1
      await tx.course.update({ where: { id: course.id }, data: { currentVersion: newVersion } })
      await tx.courseVersion.create({
        data: {
          courseId: course.id, version: newVersion,
          titleAr: baseVersion.titleAr, legacyTitleAr: baseVersion.legacyTitleAr,
          shortPromiseAr: baseVersion.shortPromiseAr, descriptionAr: baseVersion.descriptionAr,
          audienceAr: baseVersion.audienceAr, prerequisitesAr: baseVersion.prerequisitesAr,
          levelAr: baseVersion.levelAr, totalHours, weeklyHours: baseVersion.weeklyHours,
          deliveryAr: baseVersion.deliveryAr, languageAr: baseVersion.languageAr,
          trainerRequirements: baseVersion.trainerRequirements ?? undefined,
          status: 'approved', createdBy: actorId,
        },
      })
      for (const m of modules) {
        await tx.courseModule.upsert({
          where: { id: m.id },
          update: {},
          create: { id: m.id, courseId: course.id, status: 'draft' },
        })
        await tx.courseModuleVersion.create({
          data: {
            moduleId: m.id, version: newVersion, sequence: m.sequence, titleAr: m.titleAr,
            outcomeAr: m.outcomeAr, activityAr: m.activityAr, artifactAr: m.artifactAr,
            /* كل محتوى الوحدة يُنقل مع النسخة — بلا هذا السطر يُمحى درس الوحدة
               وتمرينها وفيديوها وسيناريوها عند أول تعديل معتمد */
            bodyAr: m.bodyAr, checksAr: m.checksAr, videoAr: m.videoAr, scenarioAr: m.scenarioAr,
            hours: m.hours, status: 'approved',
          },
        })
      }
      await recordAudit(tx, {
        actorId, action: 'trainer.change.apply_catalog', entityType: 'course', entityId: course.id,
        meta: { newVersion, fromRequest: req.id, durationProposed },
      })
    })
  }
}
