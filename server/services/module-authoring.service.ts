/* تأليف متن الوحدة — الكتابةُ ثم المراجعةُ ثم النشر.

   الحاجة بالأرقام: ٤٠٤ وحدة في الكتالوج، منها ٤ فقط لها متن، و٤ لها تمرين،
   وواحدةٌ لها سيناريو، ولا واحدةَ لها فيديو. والعرضُ للمتعلّم مبنيٌّ منذ
   البند ح: `LessonBody` و`ModuleCheck` و`ModuleVideo` و`DecisionScenario`
   كلُّها تعمل وتنتظر نصّا. وما كان ناقصا هو الكتابةُ نفسها: `bodyAr` لم يكن
   يُكتب إلّا لحظةَ إنشاء دورةٍ جديدة، فالوحداتُ الأربعمائة القائمة لا سبيل
   إلى ملئها أصلا.

   ── لماذا مسوّدةٌ واحدةٌ تُحرَّر في مكانها، لا إصدارٌ لكلِّ حفظ ──

   الجدول يعاقب على الإسراف: `@@unique([moduleId, version])` وسجلُّ إصدارات
   يقرؤه مراجعٌ بشريّ. فلو أنشأ كلُّ «حفظ» إصدارا لصار السجلُّ مئةَ صفٍّ
   لدرسٍ واحد، ولا يُقرأ. فالمسوّدة صفٌّ واحدٌ بحالة `draft` يُحدَّث حتى
   تُرفع، ثمّ تصير إصدارا في السجلّ حين تُنشر.

   ── ولماذا لا يعتمد أحدٌ ما كتبه ──

   القاعدة نفسها في اقتراحات المدربين (`trainer-change.service.ts`): من كتب
   لا يراجع. وهنا تُنفَّذ بـ`createdBy` على الإصدار — يُسجَّل للحاكمية لا
   للعرض: المحتوى يُنشر **باسم الأكاديمية** لا باسم كاتبه، وهو ما اتُّفق عليه.

   ── والمستورِد لا يدهس ما نكتب ──

   `catalog:import` يعمل في كلِّ نشر، وهو يكتب `version: 1` وحده. فالتأليف
   إصدارا ثانيا فأعلى محفوظٌ من الدهس بنية لا باتّفاق. */

import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { READABLE_MODULE_VERSION_STATUSES, readableVersionOf } from '../catalog/module-version-visibility'
import { validateChecks } from '../../src/application/content/module-checks'
import { validateScenario } from '../../src/application/content/scenario'
import { validateVideo } from '../../src/application/content/module-video'

/** حالاتُ التأليف — والمقروءتان في `module-version-visibility` */
export const DRAFT = 'draft'
export const IN_REVIEW = 'in_review'
/* الحلقةُ الوسطى: اعتُمد أكاديميّا وينتظر الموافقة النهائية.

   وهي حالةٌ لا يراها متعلّم: `READABLE_MODULE_VERSION_STATUSES` تقتصر على
   `published` و`approved`. فالمعتمَدُ أكاديميّا محجوبٌ حتّى يوقّع الأخير. */
export const AWAITING_FINAL = 'awaiting_final'
export const PUBLISHED = 'published'

/** الحالاتُ المفتوحة — مسوّدةٌ أو في الطريق، وواحدةٌ لا أكثر لكلّ وحدة */
export const OPEN_STATUSES = [DRAFT, IN_REVIEW, AWAITING_FINAL] as const

/** ما يملك المؤلِّف تغييره — ولا شيء غيره */
export interface ModuleContentPatch {
  bodyAr?: string | null
  checksAr?: string | null
  videoAr?: string | null
  scenarioAr?: string | null
}

const CONTENT_FIELDS = ['bodyAr', 'checksAr', 'videoAr', 'scenarioAr'] as const

/* سقفٌ للمتن: حمايةٌ من لصقِ كتابٍ كاملا في حقلٍ يُنشر في لقطةٍ واحدة
   يقرؤها كلُّ زائر. اللقطة تُبنى كاملةً في كلِّ نشر، فحجمُها ثمنٌ مشترك. */
export const MAX_BODY_CHARS = 40_000

/* قرارُ الحلقة الوسطى: يعتمد أكاديميّا فيرفعه إلى الأخير، أو يعيده للكاتب */
export interface AcademicDecision {
  decision: 'approve' | 'request_changes'
  noteAr?: string
}

/* قرارُ الحلقة الأخيرة: ينشر، أو يعيده إلى المدير الأكاديميّ بملاحظته */
export interface FinalDecision {
  decision: 'publish' | 'return_to_academic'
  noteAr?: string
}

function trimOrNull(v: string | null | undefined): string | null {
  if (v === undefined) return undefined as unknown as string | null
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

export class ModuleAuthoringService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** آخر إصدارٍ يراه المتعلّم — أساسُ أيّ مسوّدةٍ جديدة */
  private async publishedVersion(moduleId: string) {
    return this.prisma.courseModuleVersion.findFirst(readableVersionOf(moduleId))
  }

  /** المسوّدةُ الجارية — أو ما رُفع للمراجعة؛ واحدةٌ لا أكثر */
  private async openVersion(moduleId: string) {
    return this.prisma.courseModuleVersion.findFirst({
      where: { moduleId, status: { in: [...OPEN_STATUSES] } },
      orderBy: { version: 'desc' },
    })
  }

  /**
   * يفتح المسوّدة — ينسخها من المنشور إن لم تكن، فلا يبدأ المؤلِّف من بياض
   * ولا يفقد ما نُشر. `idempotent`: فتحُها مرّتين لا يُنشئ اثنتين.
   */
  async openDraft(moduleId: string, actorId: string) {
    const mod = await this.prisma.courseModule.findUnique({ where: { id: moduleId } })
    if (!mod) throw new AuthError('not_found', 'الوحدة غير موجودة', 404)

    const open = await this.openVersion(moduleId)
    if (open) return open

    const base = await this.publishedVersion(moduleId)
    if (!base) throw new AuthError('no_published_version', 'لا إصدار منشور لهذه الوحدة يُبنى عليه', 409)

    const next = await this.nextVersionNumber(moduleId)
    return this.prisma.courseModuleVersion.create({
      data: {
        moduleId, version: next, sequence: base.sequence, titleAr: base.titleAr,
        outcomeAr: base.outcomeAr, activityAr: base.activityAr, artifactAr: base.artifactAr,
        bodyAr: base.bodyAr, checksAr: base.checksAr, videoAr: base.videoAr, scenarioAr: base.scenarioAr,
        hours: base.hours, status: DRAFT, createdBy: actorId,
      },
    })
  }

  private async nextVersionNumber(moduleId: string): Promise<number> {
    const top = await this.prisma.courseModuleVersion.findFirst({
      where: { moduleId }, orderBy: { version: 'desc' }, select: { version: true },
    })
    return (top?.version ?? 0) + 1
  }

  /**
   * يحفظ في المسوّدة — ويتحقّق قبل الحفظ لا بعده.
   *
   * المحلّلات هي نفسُها التي يقرأ بها المتعلّم (`parseChecks` و`parseScenario`
   * و`parseVideo`)، فما يُقبل هنا يُعرض هناك بلا مفاجأة. والمتنُ لا محلّل
   * يرفضه: `lesson-markup` يعرض ما لا يفهمه نصّا كما هو، وهو سلوكٌ مقصود.
   */
  async save(moduleId: string, patch: ModuleContentPatch, actorId: string) {
    const draft = await this.openVersion(moduleId)
    if (!draft) throw new AuthError('no_draft', 'لا مسوّدة مفتوحة — افتحها أولا', 409)
    if (draft.status !== DRAFT) throw new AuthError('bad_state', 'المسوّدة قيد المراجعة — اسحبها لتعديلها', 409)

    const errorsAr = this.validate(patch)
    if (errorsAr.length > 0) throw new AuthError('invalid_content', errorsAr.join(' · '), 422)

    const data: Prisma.CourseModuleVersionUpdateInput = {}
    for (const f of CONTENT_FIELDS) {
      if (patch[f] !== undefined) data[f] = trimOrNull(patch[f])
    }
    if (Object.keys(data).length === 0) return draft

    const saved = await this.prisma.courseModuleVersion.update({ where: { id: draft.id }, data })
    await recordAudit(this.prisma, {
      actorId, action: 'module.content.save', entityType: 'module', entityId: moduleId,
      meta: { version: draft.version, fields: Object.keys(data) },
    })
    return saved
  }

  /** أخطاءُ الصيغة بالعربية — ولا يُتحقَّق ممّا لم يُرسَل */
  validate(patch: ModuleContentPatch): string[] {
    const errorsAr: string[] = []
    if (patch.bodyAr !== undefined && (patch.bodyAr ?? '').length > MAX_BODY_CHARS) {
      errorsAr.push(`المتن أطول من ${MAX_BODY_CHARS} حرفا — اقسمه على وحدتين`)
    }
    const checks = trimOrNull(patch.checksAr)
    if (patch.checksAr !== undefined && checks) {
      const r = validateChecks(checks)
      if (!r.ok) errorsAr.push(...r.errorsAr)
    }
    const scenario = trimOrNull(patch.scenarioAr)
    if (patch.scenarioAr !== undefined && scenario) {
      const r = validateScenario(scenario)
      if (!r.ok) errorsAr.push(...r.errorsAr)
    }
    const video = trimOrNull(patch.videoAr)
    if (patch.videoAr !== undefined && video) {
      const r = validateVideo(video)
      if (!r.ok) errorsAr.push(...r.errorsAr)
    }
    return errorsAr
  }

  /** يرفع المسوّدة للمراجعة — ولا تُرفع فارغةً من كلِّ محتوى */
  async submit(moduleId: string, actorId: string) {
    const draft = await this.openVersion(moduleId)
    if (!draft) throw new AuthError('no_draft', 'لا مسوّدة مفتوحة', 409)
    if (draft.status !== DRAFT) throw new AuthError('bad_state', 'المسوّدة مرفوعة أصلا', 409)
    if (!draft.bodyAr?.trim()) {
      throw new AuthError('empty_body', 'لا تُرفع وحدةٌ بلا متن — المتن هو الغرض', 422)
    }
    const updated = await this.prisma.courseModuleVersion.update({
      where: { id: draft.id },
      data: { status: IN_REVIEW, submittedAt: new Date(), reviewNoteAr: null },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'module.content.submit', entityType: 'module', entityId: moduleId,
      meta: { version: draft.version },
    })
    return updated
  }

  /** يسحبها من المراجعة ليعدّلها — لكاتبها وحده */
  async withdraw(moduleId: string, actorId: string) {
    const open = await this.openVersion(moduleId)
    if (!open || open.status !== IN_REVIEW) throw new AuthError('bad_state', 'لا مسوّدة قيد المراجعة', 409)
    if (open.createdBy && open.createdBy !== actorId) {
      throw new AuthError('not_author', 'لا تُسحب مسوّدةُ غيرك', 403)
    }
    return this.prisma.courseModuleVersion.update({
      where: { id: open.id }, data: { status: DRAFT, submittedAt: null },
    })
  }

  /**
   * قرارُ المراجع — والقاعدةُ الحاكمة: لا يعتمد أحدٌ ما كتبه.
   *
   * وهي ليست شكليّةً هنا: المديرُ الأكاديميّ يملك التأليفَ والمراجعة معا،
   * فبلا هذا الشرط يصير «ثلاثُ خطوات» خطوةً واحدةً بثلاثة أزرار.
   */
  /**
   * الحلقةُ الوسطى — اعتمادٌ أكاديميّ يرفعه إلى الأخير، أو ردٌّ إلى الكاتب.
   *
   * والقاعدةُ الحاكمة باقية: لا يعتمد أحدٌ ما كتبه. وهي ليست شكليّةً هنا:
   * المديرُ الأكاديميّ يملك التأليفَ والمراجعة معا، فبلا هذا الشرط تصير
   * السلسلةُ خطوةً واحدةً بثلاثة أزرار.
   *
   * ولا ردَّ صامت: من يُعاد إليه عملُه يستحقّ أن يعرف ما يُعدَّل.
   */
  async reviewAcademic(moduleId: string, input: AcademicDecision, reviewerId: string) {
    const pending = await this.openVersion(moduleId)
    if (!pending || pending.status !== IN_REVIEW) {
      throw new AuthError('bad_state', 'لا مسوّدة قيد المراجعة الأكاديميّة', 409)
    }
    if (pending.createdBy && pending.createdBy === reviewerId) {
      throw new AuthError('self_review', 'لا تعتمد ما كتبتَه — يراجعه غيرك', 403)
    }
    const noteAr = (input.noteAr ?? '').trim()
    if (input.decision === 'request_changes' && noteAr.length < 5) {
      throw new AuthError('reason_required', 'اكتب ما يُعدَّل — الردُّ بلا سبب لا يُفيد الكاتب', 422)
    }

    const approve = input.decision === 'approve'
    const updated = await this.prisma.courseModuleVersion.update({
      where: { id: pending.id },
      data: approve
        ? {
            status: AWAITING_FINAL,
            academicApprovedBy: reviewerId, academicApprovedAt: new Date(),
            reviewNoteAr: noteAr || null,
          }
        : {
            status: DRAFT, submittedAt: null,
            reviewedBy: reviewerId, reviewedAt: new Date(), reviewNoteAr: noteAr,
            academicApprovedBy: null, academicApprovedAt: null,
          },
    })
    await recordAudit(this.prisma, {
      actorId: reviewerId,
      action: approve ? 'module.content.academic_approve' : 'module.content.request_changes',
      entityType: 'module', entityId: moduleId,
      meta: { version: pending.version, authorId: pending.createdBy, ...(noteAr ? { noteAr } : {}) },
    })
    return updated
  }

  /**
   * الحلقةُ الأخيرة — نشرٌ، أو ردٌّ إلى المدير الأكاديميّ بملاحظته.
   *
   * وحارسان لا واحد: لا يوقّعها كاتبُها، **ولا مَن اعتمدها أكاديميّا**.
   * فسلسلةٌ يوقّعها شخصٌ واحد ثلاثَ مرّات خطوةٌ واحدة بثلاثة أزرار — وهذا
   * ما يجعل «ثلاث خطوات» ثلاثا لا اسما لواحدة.
   */
  async reviewFinal(moduleId: string, input: FinalDecision, approverId: string) {
    const pending = await this.openVersion(moduleId)
    if (!pending || pending.status !== AWAITING_FINAL) {
      throw new AuthError('bad_state', 'لا مسوّدة بانتظار الموافقة النهائية', 409)
    }
    if (pending.createdBy && pending.createdBy === approverId) {
      throw new AuthError('self_review', 'لا تعتمد ما كتبتَه — يراجعه غيرك', 403)
    }
    if (pending.academicApprovedBy && pending.academicApprovedBy === approverId) {
      throw new AuthError(
        'same_approver',
        'أنت مَن اعتمدها أكاديميّا — والموافقةُ النهائية لغيرك، وإلّا صارت الحلقتان واحدة',
        403,
      )
    }
    const noteAr = (input.noteAr ?? '').trim()
    if (input.decision === 'return_to_academic' && noteAr.length < 5) {
      throw new AuthError('reason_required', 'اكتب سببَ الإعادة — الردُّ بلا سبب لا يُفيد أحدا', 422)
    }

    const publish = input.decision === 'publish'
    const updated = await this.prisma.courseModuleVersion.update({
      where: { id: pending.id },
      data: publish
        ? { status: PUBLISHED, reviewedBy: approverId, reviewedAt: new Date(), reviewNoteAr: noteAr || null }
        : {
            /* تعود إلى الحلقة الوسطى لا إلى الكاتب: الملاحظةُ للمدير
               الأكاديميّ، وهو من يقرّر ماذا يُبلَّغ به الكاتب. */
            status: IN_REVIEW,
            reviewedBy: approverId, reviewedAt: new Date(), reviewNoteAr: noteAr,
            academicApprovedBy: null, academicApprovedAt: null,
          },
    })
    await recordAudit(this.prisma, {
      actorId: approverId,
      action: publish ? 'module.content.publish' : 'module.content.return_to_academic',
      entityType: 'module', entityId: moduleId,
      meta: {
        version: pending.version, authorId: pending.createdBy,
        academicApprovedBy: pending.academicApprovedBy, ...(noteAr ? { noteAr } : {}),
      },
    })
    return updated
  }

  /** سجلُّ الإصدارات — الأحدث أولا، بما يكفي لمقارنةٍ نصّية */
  async history(moduleId: string) {
    const rows = await this.prisma.courseModuleVersion.findMany({
      where: { moduleId }, orderBy: { version: 'desc' }, take: 30,
    })
    return rows.map((v) => ({
      id: v.id, version: v.version, status: v.status, titleAr: v.titleAr,
      bodyAr: v.bodyAr, checksAr: v.checksAr, videoAr: v.videoAr, scenarioAr: v.scenarioAr,
      createdAt: v.createdAt.toISOString(),
      submittedAt: v.submittedAt?.toISOString() ?? null,
      reviewedAt: v.reviewedAt?.toISOString() ?? null,
      reviewNoteAr: v.reviewNoteAr,
      /* لا أسماء: العرضُ باسم الأكاديمية، والمعرّفات للتدقيق لا للشاشة */
      hasAuthor: Boolean(v.createdBy),
    }))
  }

  /**
   * طابورُ التأليف — أيُّ وحدةٍ تُكتب أوّلا.
   *
   * ٤٠٠ وحدةٍ بلا متن لا تُواجَه بقائمةٍ أبجديّة: الترتيبُ نفسُه قرارٌ
   * تحريريّ. فالأسبقيّةُ لمن ينتظره متعلّمٌ الآن — وحداتُ دورةٍ فيها
   * تسجيلاتٌ قائمة، ثمّ دورةٌ لها شعبةٌ مفتوحة، ثمّ الباقي على ترتيب
   * الدورة. فمن يكتب ساعةً واحدة يكتبها حيث تُقرأ.
   *
   * وما يُحسب هنا أعدادٌ لا أسماء: كم متعلّما ينتظر، لا مَن هم.
   */
  async worklist(options: { body?: 'all' | 'missing' | 'written'; courseId?: string; limit?: number } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 200, 1), 500)

    const modules = await this.prisma.courseModule.findMany({
      where: { status: 'published' },
      include: {
        versions: {
          where: { status: { in: [...READABLE_MODULE_VERSION_STATUSES, DRAFT, IN_REVIEW] } },
          orderBy: { version: 'desc' },
        },
        course: { select: { id: true, versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
      },
    })

    /* كم متعلّما ينتظر كلَّ دورة — عدٌّ واحدٌ لا استعلامٌ لكلِّ وحدة */
    const enrolments = await this.prisma.enrollment.groupBy({
      by: ['cohortId'],
      where: { status: { in: ['enrolled', 'waitlisted'] } },
      _count: { _all: true },
    })
    const cohorts = await this.prisma.cohort.findMany({
      where: { status: { in: ['open', 'active', 'full'] } },
      select: { id: true, courseId: true },
    })
    const cohortCourse = new Map(cohorts.map((c) => [c.id, c.courseId]))
    const learnersByCourse = new Map<string, number>()
    for (const e of enrolments) {
      const courseId = cohortCourse.get(e.cohortId)
      if (!courseId) continue
      learnersByCourse.set(courseId, (learnersByCourse.get(courseId) ?? 0) + e._count._all)
    }
    const openCourses = new Set(cohorts.map((c) => c.courseId))

    const all = modules.flatMap((m) => {
      const readable = m.versions.find((v) => (READABLE_MODULE_VERSION_STATUSES as readonly string[]).includes(v.status))
      const open = m.versions.find((v) => v.status === DRAFT || v.status === IN_REVIEW)
      if (!readable) return []
      const hasBody = Boolean(readable.bodyAr?.trim())
      return [{
        moduleId: m.id,
        courseId: m.courseId,
        courseTitleAr: m.course.versions[0]?.titleAr ?? '',
        titleAr: readable.titleAr,
        sequence: readable.sequence,
        hasBody,
        hasChecks: Boolean(readable.checksAr?.trim()),
        hasVideo: Boolean(readable.videoAr?.trim()),
        hasScenario: Boolean(readable.scenarioAr?.trim()),
        draftStatus: open?.status ?? null,
        learnersWaiting: learnersByCourse.get(m.courseId) ?? 0,
        courseHasOpenCohort: openCourses.has(m.courseId),
      }]
    })

    all.sort((a, b) =>
      b.learnersWaiting - a.learnersWaiting ||
      Number(b.courseHasOpenCohort) - Number(a.courseHasOpenCohort) ||
      a.courseId.localeCompare(b.courseId) ||
      a.sequence - b.sequence)

    /* الإحصاء على الكتالوج كلِّه لا على الشريحة المعروضة.

       كان يُحسب بعد الترشيح، فمع «الناقصة فقط» يصير «لها متن: ٠» دائما —
       رقمٌ صحيحٌ عن الشريحة وكاذبٌ عن الكتالوج، وهو ما تقرؤه البطاقاتُ
       الثلاث. ومستودعٌ قاعدتُه «القياس قبل التغيير» لا يعرض عدّادا يكذب. */
    const total = all.length
    const withBody = all.filter((r) => r.hasBody).length

    /* ثلاثةُ مرشّحات لا اثنان.

       كان المرشِّحُ رايةً واحدة: «الناقصة فقط» أو الكلّ. وشكوى صاحب المنصّة:
       «التركيز على الناقص فقط يصعّب الوصول لمتنٍ مكتمل تريد تعديله» — وهو
       حقّ: من يريد مراجعةَ ما كُتب يبحث عنه وسط أربعمائةِ فارغة. */
    const byBody = options.body === 'missing'
      ? all.filter((r) => !r.hasBody)
      : options.body === 'written'
        ? all.filter((r) => r.hasBody)
        : all
    const rows = options.courseId ? byBody.filter((r) => r.courseId === options.courseId) : byBody

    /* الدوراتُ كمجموعات — الاختيارُ يبدأ بالدورة ثمّ وحداتُها تحتها بالترتيب،
       وهو ما طلبه صاحب المنصّة. والعدّادُ لكلِّ دورةٍ من الكتالوج كلِّه لا من
       الشريحة، فلا يكذب مع المرشِّح. */
    const courses = new Map<string, { courseId: string; titleAr: string; total: number; withBody: number }>()
    for (const r of all) {
      const c = courses.get(r.courseId) ?? { courseId: r.courseId, titleAr: r.courseTitleAr, total: 0, withBody: 0 }
      c.total += 1
      if (r.hasBody) c.withBody += 1
      courses.set(r.courseId, c)
    }

    return {
      total, withBody, missing: total - withBody,
      courses: [...courses.values()].sort((a, b) => a.titleAr.localeCompare(b.titleAr, 'ar')),
      rows: rows.slice(0, limit),
    }
  }

  /** طابورُ المراجعة — ما ينتظر قرارا في حلقةٍ بعينها */
  async pendingReview(stage: 'academic' | 'final' = 'academic') {
    const rows = await this.prisma.courseModuleVersion.findMany({
      where: { status: stage === 'final' ? AWAITING_FINAL : IN_REVIEW },
      orderBy: { submittedAt: 'asc' },
      include: { module: { select: { id: true, courseId: true } } },
      take: 100,
    })
    return rows.map((v) => ({
      moduleId: v.moduleId, courseId: v.module.courseId, version: v.version,
      titleAr: v.titleAr, submittedAt: v.submittedAt?.toISOString() ?? null,
      bodyChars: v.bodyAr?.length ?? 0,
      hasChecks: Boolean(v.checksAr), hasVideo: Boolean(v.videoAr), hasScenario: Boolean(v.scenarioAr),
      /* الملاحظةُ العائدة من الحلقة الأخيرة تُقرأ في طابور الوسطى — وإلّا
         عاد العملُ بلا أن يعرف مستقبِلُه لماذا. */
      reviewNoteAr: v.reviewNoteAr,
      academicApprovedAt: v.academicApprovedAt?.toISOString() ?? null,
    }))
  }
}

export { READABLE_MODULE_VERSION_STATUSES }
