/* مسارٌ يبنيه مدرّبٌ من دوراته — من مسوّدته إلى الرفّ العامّ (ن-١ … ن-٨).

   ═══ ما يفصل هذا عن رابط الدعوة (و-١) ═══

   رابطُ الدعوة تسويقٌ خاصّ. وهذا **إدراجٌ على الرفّ نفسِه** الذي تقف عليه
   مساراتُك المنسَّقة، يحمل اسمَ إنسان. وكلُّ ما تحته يتبع هذا الفرق.

   ═══ أربعُ قواعدَ تُفرَض هنا لا في شاشة ═══

   ① **لا نشرَ لمن لم يُعتمد ظهورُه** (ن-٢) — وهي قاعدةُ المستودَع نفسُها:
      «لا اسمَ مدرّبٍ يُعرض حقيقةً قبل توثيقه واعتمادِ نشره». والبوّابةُ
      `trainer-visibility.ts` وحدَها لا نسخةٌ منها هنا.
   ② **والإيقافُ يُغلق البيعَ لا الالتزام** (ن-٤) — الرفُّ يُقرأ بترشيحٍ وقتَ
      القراءة، فالموقوفُ يختفي منه في اللحظة. **ولا شيءَ يتتالى على من
      التحق**: لا تسجيلٌ يُلغى ولا موسمٌ يُشطب. «الرفُّ آليٌّ والعقدُ ليس».
   ③ **ولا يزاحم في التشخيص** (ن-٥) — بالجدول المستقلّ، فلا رايةَ تُطفأ.
   ④ **ولا سعرَ** (ن-٦) — لا عمودَ في المخطّط، فلا شيءَ يُكتب.

   ═══ وترتيبُ الحالات ═══

   `draft` ⇄ `rejected` ← يملكهما صاحبُهما · `submitted` عند الإدارة ·
   `published` على الرفّ · `retired` سُحب منه. */

import type { PrismaClient, Prisma } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { trainerPubliclyVisible, TRAINER_VISIBILITY_SELECT } from './trainer-visibility'
import { slugifyName, uniqueSlug } from '../../src/application/trainer/public-slug'
import {
  canTrainerEdit, pathBlockersAr, MAX_PATH_BLURB, MAX_PATH_COURSES, MAX_PATH_TITLE,
} from '../../src/application/trainer/path-rules'
import { portalDoorProblemAr } from '../../src/application/trainer/portal-access'

export interface PathInput {
  titleAr: string
  blurbAr?: string | null
  termId?: string | null
  courseIds: string[]
}

/* عنوانُ الدورة يسكن إصدارَها الجاري — لا `[0]` ولا الأحدثَ رقما. وهو عينُ
   ما أُصلح في ك-٢: الشهادةُ كانت تقرأ أوّلَ إصدارٍ تجده فتُعاد تسميتُها. */
const COURSE_TITLE = {
  select: { id: true, currentVersion: true, versions: { select: { version: true, titleAr: true } } },
} as const

function titleOf(c: { id: string; currentVersion: number; versions: { version: number; titleAr: string }[] }): string {
  return c.versions.find((v) => v.version === c.currentVersion)?.titleAr ?? c.id
}

export class TrainerPathService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** ملفُّ صاحب الجلسة ومؤهّلاتُه وحالُ ظهوره — كلُّ ما تحتاجه القسمة */
  private async context(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { userId },
      select: {
        /* و`suspendedAt` تأتي ضمنَ بوّابة الظهور — فلا تُكرَّر فتُطمَس */
        id: true, ...TRAINER_VISIBILITY_SELECT,
        application: { select: { status: true, fullName: true } },
        qualifications: { select: { courseId: true } },
      },
    })
    if (!profile) throw new AuthError('no_profile', 'لا ملف مدرب مرتبطا بهذا الحساب', 404)
    /* بابُ الموادّ: يُفتح بتوقيع العرض المشروط لا بالاعتماد النهائيّ —
       والشرطُ مسمًّى في `portal-access.ts` يقرؤه الخادمُ والشاشةُ معا. */
    const problem = portalDoorProblemAr('materials', {
      status: profile.application.status, suspendedAt: profile.suspendedAt,
    })
    if (problem) throw new AuthError('suspended', problem, 403)
    return {
      profileId: profile.id,
      fullName: profile.application.fullName,
      qualifiedCourseIds: profile.qualifications.map((q) => q.courseId),
      publiclyVisible: trainerPubliclyVisible(profile),
    }
  }

  private async mineOrThrow(profileId: string, id: string) {
    const row = await this.prisma.trainerPath.findUnique({ where: { id }, include: { courses: true } })
    if (!row || row.profileId !== profileId) throw new AuthError('unknown_path', 'لا مسارَ بهذا المعرّف', 404)
    return row
  }

  private clean(input: PathInput) {
    const titleAr = input.titleAr.trim().slice(0, MAX_PATH_TITLE)
    const blurbAr = (input.blurbAr ?? '').trim().slice(0, MAX_PATH_BLURB) || null
    /* التكرارُ يسقط هنا لا عند الكتابة: المفتاحُ المركّبُ يرفضه بخطإ قاعدةٍ
       لا يُقرأ، والترتيبُ يبقى كما رتّبه صاحبُه. */
    const courseIds = [...new Set(input.courseIds)].slice(0, MAX_PATH_COURSES)
    return { titleAr, blurbAr, courseIds, termId: input.termId ?? null }
  }

  /* ═══ جانبُ المدرّب ═══ */

  async mine(userId: string) {
    const ctx = await this.context(userId)
    const rows = await this.prisma.trainerPath.findMany({
      where: { profileId: ctx.profileId },
      orderBy: { createdAt: 'desc' },
      include: {
        term: { select: { id: true, titleAr: true, registrationOpensAt: true, startsOn: true } },
        courses: { include: { course: COURSE_TITLE } },
      },
    })
    return rows.map((p) => ({
      id: p.id,
      titleAr: p.titleAr,
      blurbAr: p.blurbAr,
      status: p.status,
      slug: p.slug,
      reviewNoteAr: p.reviewNoteAr,
      publishedAt: p.publishedAt,
      retiredAt: p.retiredAt,
      createdAt: p.createdAt,
      term: p.term,
      courses: p.courses
        .sort((a, b) => a.sequence - b.sequence)
        .map((l) => ({ courseId: l.courseId, titleAr: titleOf(l.course), sequence: l.sequence })),
      /* وما يمنع إرسالَه يُحسب هنا لا في الشاشة — فالقسمةُ واحدة */
      blockersAr: pathBlockersAr({
        titleAr: p.titleAr,
        courseIds: p.courses.map((l) => l.courseId),
        termId: p.termId,
        qualifiedCourseIds: ctx.qualifiedCourseIds,
        trainerPubliclyVisible: ctx.publiclyVisible,
      }),
      editable: canTrainerEdit(p.status),
    }))
  }

  /** دوراتُه التي يبني منها — ومعها عناوينُها، فلا يختار رمزا */
  async myCourses(userId: string) {
    const ctx = await this.context(userId)
    if (ctx.qualifiedCourseIds.length === 0) return []
    const rows = await this.prisma.course.findMany({
      where: { id: { in: ctx.qualifiedCourseIds } },
      ...COURSE_TITLE,
    })
    return rows.map((c) => ({ courseId: c.id, titleAr: titleOf(c) }))
  }

  /** المواسمُ التي يصلح أن يُعلَن فيها مسارٌ — ما لم ينتهِ بعد (ن-٣).
   *
   *  و`/api/trainer/me/terms` يردّ المواسمَ كلَّها بما مضى منها، وهو صوابٌ
   *  هناك: المدرّبُ يرى إتاحتَه المعلَنةَ في مواسمَ سبقت. أمّا هنا فعرضُ
   *  موسمٍ انقضى فخٌّ — يُعلَن المسارُ لموسمٍ انتهى، فتقول البطاقةُ للزائر
   *  «يبدأ» عن تاريخٍ مضى. ورأيتُها في الرفّ المصيَّر قبل أن تشتكيَ. */
  async upcomingTerms() {
    const rows = await this.prisma.term.findMany({
      where: { endsOn: { gte: new Date() }, status: { notIn: ['cancelled'] } },
      orderBy: { startsOn: 'asc' },
      select: { id: true, titleAr: true, startsOn: true, registrationOpensAt: true },
    })
    return rows
  }

  async create(userId: string, input: PathInput) {
    const ctx = await this.context(userId)
    const d = this.clean(input)
    const row = await this.prisma.trainerPath.create({
      data: {
        profileId: ctx.profileId, titleAr: d.titleAr, blurbAr: d.blurbAr, termId: d.termId,
        status: 'draft',
        courses: { create: d.courseIds.map((courseId, i) => ({ courseId, sequence: i + 1 })) },
      },
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.path.create', entityType: 'trainer_path', entityId: row.id,
      meta: { titleAr: row.titleAr, courses: d.courseIds.length },
    })
    return row
  }

  async update(userId: string, id: string, input: PathInput) {
    const ctx = await this.context(userId)
    const before = await this.mineOrThrow(ctx.profileId, id)
    if (!canTrainerEdit(before.status)) {
      throw new AuthError('locked', 'خرج المسارُ من يدك — لا يُعدَّل في هذه الحال', 409)
    }
    const d = this.clean(input)
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.trainerPathCourse.deleteMany({ where: { pathId: id } })
      return tx.trainerPath.update({
        where: { id },
        data: {
          titleAr: d.titleAr, blurbAr: d.blurbAr, termId: d.termId,
          /* والمردودُ يعود مسوّدةً بالتعديل — وإلّا بقي «مردودا» وقد أُصلح */
          status: before.status === 'rejected' ? 'draft' : before.status,
          courses: { create: d.courseIds.map((courseId, i) => ({ courseId, sequence: i + 1 })) },
        },
      })
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.path.update', entityType: 'trainer_path', entityId: id,
      before: { titleAr: before.titleAr }, after: { titleAr: row.titleAr },
    })
    return row
  }

  async remove(userId: string, id: string) {
    const ctx = await this.context(userId)
    const before = await this.mineOrThrow(ctx.profileId, id)
    if (!canTrainerEdit(before.status)) {
      throw new AuthError('locked', 'خرج المسارُ من يدك — لا يُحذف في هذه الحال', 409)
    }
    await this.prisma.trainerPath.delete({ where: { id } })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.path.delete', entityType: 'trainer_path', entityId: id,
      meta: { titleAr: before.titleAr },
    })
    return { deleted: true }
  }

  /** إرسالٌ للمراجعة — ويُردّ بما ينقص لا بـ«غير صالح» */
  async submit(userId: string, id: string) {
    const ctx = await this.context(userId)
    const row = await this.mineOrThrow(ctx.profileId, id)
    if (!canTrainerEdit(row.status)) throw new AuthError('locked', 'أُرسل المسارُ من قبل', 409)

    const blockers = pathBlockersAr({
      titleAr: row.titleAr,
      courseIds: row.courses.map((c) => c.courseId),
      termId: row.termId,
      qualifiedCourseIds: ctx.qualifiedCourseIds,
      trainerPubliclyVisible: ctx.publiclyVisible,
    })
    if (blockers.length > 0) throw new AuthError('incomplete', blockers.join(' · '), 400)

    const out = await this.prisma.trainerPath.update({
      where: { id }, data: { status: 'submitted', reviewNoteAr: null },
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.path.submit', entityType: 'trainer_path', entityId: id,
      meta: { titleAr: row.titleAr },
    })
    return out
  }

  /* ═══ جانبُ الإدارة ═══ */

  async queue(scope: 'open' | 'all' = 'open') {
    const rows = await this.prisma.trainerPath.findMany({
      where: scope === 'open' ? { status: 'submitted' } : {},
      orderBy: { createdAt: 'asc' },
      include: {
        term: { select: { titleAr: true } },
        courses: { include: { course: COURSE_TITLE } },
        profile: {
          select: {
            id: true, ...TRAINER_VISIBILITY_SELECT,
            application: { select: { fullName: true, email: true } },
          },
        },
      },
    })
    return rows.map((p) => ({
      id: p.id,
      titleAr: p.titleAr,
      blurbAr: p.blurbAr,
      status: p.status,
      slug: p.slug,
      termTitleAr: p.term?.titleAr ?? null,
      trainerName: p.profile.application.fullName,
      trainerEmail: p.profile.application.email,
      /* وحالُ ظهوره تُعرض للمراجع قبل أن يضغط: الاعتمادُ سيُردّ بلا نشرٍ
         معتمَد (ن-٢)، ومعرفةُ ذلك قبل الضغط خيرٌ من رسالة خطأ بعده. */
      trainerPubliclyVisible: trainerPubliclyVisible(p.profile),
      reviewNoteAr: p.reviewNoteAr,
      publishedAt: p.publishedAt,
      retiredAt: p.retiredAt,
      createdAt: p.createdAt,
      courses: p.courses
        .sort((a, b) => a.sequence - b.sequence)
        .map((l) => ({ courseId: l.courseId, titleAr: titleOf(l.course) })),
    }))
  }

  /** الاعتماد — والاسمُ يُعتمد معه في المراجعة نفسِها (ن-٧) */
  async approve(actorId: string, id: string) {
    const row = await this.prisma.trainerPath.findUnique({
      where: { id },
      include: { profile: { select: { ...TRAINER_VISIBILITY_SELECT, application: { select: { fullName: true } } } } },
    })
    if (!row) throw new AuthError('unknown_path', 'لا مسارَ بهذا المعرّف', 404)

    /* ن-٢ — يُفرَض هنا لا في الشاشة: قاعدةُ المستودَع «لا اسمَ مدرّبٍ يُعرض
       حقيقةً قبل اعتمادِ نشره»، والمسارُ يحمل اسمَه في بطاقته. */
    if (!trainerPubliclyVisible(row.profile)) {
      throw new AuthError(
        'trainer_not_public',
        'لم يُعتمد ظهورُ هذا المدرّب للعامّة — والمسارُ يحمل اسمَه. اعتمِد ظهورَه أوّلا.',
        409,
      )
    }

    const slug = row.slug ?? await this.freshSlug(row.profile.application.fullName)
    const out = await this.prisma.trainerPath.update({
      where: { id },
      data: {
        status: 'published', slug, publishedAt: new Date(), retiredAt: null, retiredBy: null,
        reviewedBy: actorId, reviewedAt: new Date(), reviewNoteAr: null,
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.path.publish', entityType: 'trainer_path', entityId: id,
      meta: { titleAr: row.titleAr, slug },
    })
    return out
  }

  async reject(actorId: string, id: string, noteAr: string) {
    const reason = noteAr.trim()
    if (reason.length < 5) throw new AuthError('no_reason', 'اكتب سببَ الردّ — بلا سببٍ يُعاد المسارُ كما هو', 400)
    const row = await this.prisma.trainerPath.findUnique({ where: { id } })
    if (!row) throw new AuthError('unknown_path', 'لا مسارَ بهذا المعرّف', 404)

    const out = await this.prisma.trainerPath.update({
      where: { id },
      data: { status: 'rejected', reviewedBy: actorId, reviewedAt: new Date(), reviewNoteAr: reason },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.path.reject', entityType: 'trainer_path', entityId: id,
      reason, meta: { titleAr: row.titleAr },
    })
    return out
  }

  /** السحبُ من الرفّ (ن-١) — ولا يمسّ من التحق (ن-٤) */
  async retire(actorId: string, id: string, noteAr?: string | null) {
    const row = await this.prisma.trainerPath.findUnique({ where: { id } })
    if (!row) throw new AuthError('unknown_path', 'لا مسارَ بهذا المعرّف', 404)

    const out = await this.prisma.trainerPath.update({
      where: { id },
      data: {
        status: 'retired', retiredAt: new Date(), retiredBy: actorId,
        reviewNoteAr: noteAr?.trim() || row.reviewNoteAr,
      },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.path.retire', entityType: 'trainer_path', entityId: id,
      meta: { titleAr: row.titleAr },
    })
    return out
  }

  /* ═══ الرفُّ العامّ ═══ */

  /** ما يُعرض للزائر — والترشيحُ وقتَ القراءة هو ما يجعل ن-٤ آليّا.
   *
   *  فالمدرّبُ الموقوفُ يسقط من هنا في اللحظة (`PUBLIC_TRAINER_WHERE`
   *  ضمنا عبرَ `trainerPubliclyVisible`)، **ولا شيءَ يتتالى على من التحق**:
   *  لا صفَّ تسجيلٍ يُمسّ ولا موسمَ يُشطب. «الرفُّ آليٌّ والعقدُ ليس». */
  async shelf() {
    const rows = await this.prisma.trainerPath.findMany({
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' },
      include: {
        term: {
          select: {
            titleAr: true, season: true, year: true, startsOn: true,
            registrationOpensAt: true, registrationClosesAt: true, status: true,
          },
        },
        courses: { include: { course: COURSE_TITLE } },
        profile: {
          select: {
            publicSlug: true, headline: true, ...TRAINER_VISIBILITY_SELECT,
            application: { select: { fullName: true } },
          },
        },
      },
    })
    return rows
      .filter((p) => trainerPubliclyVisible(p.profile))
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        titleAr: p.titleAr,
        blurbAr: p.blurbAr,
        trainerName: p.profile.application.fullName,
        trainerHeadline: p.profile.headline,
        trainerSlug: p.profile.publicSlug,
        term: p.term,
        courses: p.courses
          .sort((a, b) => a.sequence - b.sequence)
          .map((l) => ({ courseId: l.courseId, titleAr: titleOf(l.course) })),
      }))
  }

  private async freshSlug(fullName: string): Promise<string> {
    const base = slugifyName(fullName) ?? 'path'
    const rows = await this.prisma.trainerPath.findMany({
      where: { slug: { not: null } }, select: { slug: true },
    })
    return uniqueSlug(base, new Set(rows.map((r) => r.slug as string)))
  }
}

export type TrainerPathRow = Prisma.TrainerPathGetPayload<Record<string, never>>
