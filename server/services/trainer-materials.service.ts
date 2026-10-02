/* موادُّ الدورات في طور العرض المشروط — يكتبها المدرّب، وتقرؤها الإدارة.

   ═══ لماذا ═══

   العقدُ يَعِد بخمسة أيّامٍ يضع فيها المدرّبُ محاورَ دوراته ومواردَها
   وواجباتها في بوّابته (البند 2-8)، ولم يكن للوعد موضع. والقاعدةُ والبنيةُ
   في `src/application/trainer/course-materials.ts`.

   ═══ وحدودُه ═══

   · **البابُ بابُ الموادّ** (`portal-access.ts`): يُفتح لمن اعتُمد توقيعُه
     ولمن هو نشط، ويُغلق للموقوف.
   · **والكتابةُ لدورةٍ قيد الإعداد وحدَها** (`pending`): ما اعتُمدت موادُّه
     صار مؤهَّلا (`qualified`) ويُقرأ ولا يُعدَّل — تعديلُه بعدها في مساحة
     الشعبة، حيث يراه المتعلّمون.
   · **والمحفوظُ ما نُظّف**: `cleanCourseMaterials` قبل الكتابة، فلا يصل
     القاعدةَ حقلٌ لا يُعرف. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { portalDoorProblemAr } from '../../src/application/trainer/portal-access'
import {
  cleanCourseMaterials, materialsMissingAr, type CourseMaterials,
} from '../../src/application/trainer/course-materials'

/** ما يُعرض لكلّ دورة — للمدرّب في «مؤهّلاتي»، وللإدارة في مراجعة العقد */
export interface CourseMaterialsRow {
  courseId: string
  titleAr: string
  status: string
  /** محاورُ الكتالوج — تبدأ منها الموادُّ فلا تُكتب من فراغ */
  catalogModules: { titleAr: string; outcomeAr: string }[]
  materials: CourseMaterials | null
  materialsAt: Date | null
  missingAr: string[]
}

const LIVE = ['pending', 'qualified'] as const

export class TrainerMaterialsService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  private async profileForUser(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { userId }, include: { application: { select: { status: true } } },
    })
    if (!profile) throw new AuthError('no_profile', 'لا ملفَّ مدرّبٍ مرتبطا بهذا الحساب', 404)
    const problem = portalDoorProblemAr('materials', {
      status: profile.application.status, suspendedAt: profile.suspendedAt,
    })
    if (problem) throw new AuthError('suspended', problem, 403)
    return profile
  }

  /** دوراتُ الملفّ قيد الإعداد والمعتمدة، بموادّها ومحاور كتالوجها */
  async forProfile(profileId: string): Promise<CourseMaterialsRow[]> {
    const rows = await this.prisma.trainerCourseQualification.findMany({
      where: { profileId, status: { in: [...LIVE] } },
      orderBy: { createdAt: 'asc' },
      include: {
        course: {
          select: {
            currentVersion: true,
            versions: { select: { version: true, titleAr: true } },
            modules: {
              where: { status: { not: 'archived' } },
              select: { versions: { orderBy: { version: 'desc' }, take: 1, select: { sequence: true, titleAr: true, outcomeAr: true } } },
            },
          },
        },
      },
    })
    return rows.map((q) => {
      const materials = q.materials ? cleanCourseMaterials(q.materials) : null
      return {
        courseId: q.courseId,
        titleAr: q.course.versions.find((v) => v.version === q.course.currentVersion)?.titleAr ?? q.courseId,
        status: q.status,
        catalogModules: q.course.modules
          .map((m) => m.versions[0])
          .filter((v): v is NonNullable<typeof v> => Boolean(v))
          .sort((a, b) => a.sequence - b.sequence)
          .map((v) => ({ titleAr: v.titleAr, outcomeAr: v.outcomeAr ?? '' })),
        materials,
        materialsAt: q.materialsAt,
        missingAr: materialsMissingAr(materials),
      }
    })
  }

  /** وحالُ الطور معها: ما أُعلن اكتمالُه يُقرأ ولا يُعدَّل حتّى يُردّ */
  async mine(userId: string) {
    const profile = await this.profileForUser(userId)
    const paused = await this.prisma.trainerContract.findFirst({
      where: { profileId: profile.id, conditionPausedAt: { not: null }, conditionMetAt: null },
      select: { id: true },
    })
    return { courses: await this.forProfile(profile.id), underReview: Boolean(paused) }
  }

  async save(userId: string, courseId: string, raw: unknown) {
    const profile = await this.profileForUser(userId)
    const qual = await this.prisma.trainerCourseQualification.findUnique({
      where: { profileId_courseId: { profileId: profile.id, courseId } },
    })
    if (!qual || !(LIVE as readonly string[]).includes(qual.status)) {
      throw new AuthError('not_found', 'هذه الدورةُ ليست من دوراتك', 404)
    }
    if (qual.status !== 'pending') {
      throw new AuthError('bad_state', 'اعتُمدت موادُّ هذه الدورة — وما تغيّره بعدها في مساحة شعبتك', 409)
    }
    /* ولا يُكتب أثناء التقييم: ما أُعلن اكتمالُه يُقرأ كما أُعلن حتّى يُردّ */
    const paused = await this.prisma.trainerContract.findFirst({
      where: { profileId: profile.id, conditionPausedAt: { not: null }, conditionMetAt: null },
      select: { id: true },
    })
    if (paused) {
      throw new AuthError('under_review', 'موادُّك عندنا للتقييم — تُعدَّل إن أعدناها إليك بملاحظات', 409)
    }
    const materials = cleanCourseMaterials(raw)
    const at = new Date()
    await this.prisma.trainerCourseQualification.update({
      where: { id: qual.id },
      data: { materials: materials as unknown as Prisma.InputJsonValue, materialsAt: at },
    })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.materials.save',
      entityType: 'trainer_profile', entityId: profile.id,
      meta: { courseId, modules: materials.modules.length, missing: materialsMissingAr(materials) },
    })
    return { materialsAt: at, missingAr: materialsMissingAr(materials) }
  }

  /** ما ينقص قبل الإعلان — دورةً دورة. فارغٌ إن لا دورةَ قيد الإعداد أو اكتملت كلُّها */
  /* ═══ ومنذ ٢ أكتوبر ٢٠٢٦ تُكتب الموادُّ في شعبة الإعداد ═══
     فالدورةُ مكتملةٌ إن أُرسلت خطّةُ شعبتها للاعتماد — أو كانت موادُّها في
     اللوح القديم كاملةً (من أتمّها قبل اليوم لا يُطالَب بها ثانيةً). والعلّةُ
     في `trainer-prep.service.ts`. */
  async declareGapsAr(profileId: string): Promise<string[]> {
    const rows = await this.forProfile(profileId)
    const gaps: string[] = []
    for (const r of rows.filter((x) => x.status === 'pending')) {
      if (r.missingAr.length === 0) continue
      const plan = await this.prisma.cohortDeliveryPlan.findFirst({
        where: {
          trainerId: { not: null }, status: { in: ['submitted', 'approved', 'published'] },
          cohort: { courseId: r.courseId, status: 'draft', trainers: { some: { profileId, role: 'lead' } } },
        },
        select: { id: true },
      })
      if (plan) continue
      gaps.push(`«${r.titleAr}»: لم تُرسَل خطّةُ شعبتها للاعتماد بعد`)
    }
    return gaps
  }
}
