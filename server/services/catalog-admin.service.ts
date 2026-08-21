/* خدمة إدارة الكتالوج — إنشاء كيانات كمسودات وطلبات تغيير محكومة بـ maker-checker.
   دورة حياة الكيان: draft → (طلب تغيير معتمد) approved → (نشر) published.
   لا تعديل بأثر رجعي على المنشور — كل تعديل إصدار جديد. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { assessSkillSelection, skillStateOf } from '../../src/application/catalog/skill-measurement'

export class CatalogAdminService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** نظرة عامة: عدادات الحالات لكل نوع كيان */
  async overview() {
    const groupCount = (rows: { status: string }[]) => {
      const out: Record<string, number> = {}
      for (const r of rows) out[r.status] = (out[r.status] ?? 0) + 1
      return out
    }
    const [p, c, s, t, q, crs] = await Promise.all([
      this.prisma.pathway.findMany({ select: { status: true } }),
      this.prisma.course.findMany({ select: { status: true } }),
      this.prisma.skill.findMany({ select: { status: true } }),
      this.prisma.compositeTemplate.findMany({ select: { status: true } }),
      this.prisma.question.findMany({ select: { status: true } }),
      this.prisma.contentChangeRequest.findMany({ select: { status: true } }),
    ])
    return {
      pathways: groupCount(p), courses: groupCount(c), skills: groupCount(s),
      templates: groupCount(t), questions: groupCount(q), changeRequests: groupCount(crs),
    }
  }

  async listPathways() {
    const rows = await this.prisma.pathway.findMany({
      orderBy: { id: 'asc' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 }, courses: true },
    })
    return rows.map((p) => ({
      id: p.id, status: p.status, currentVersion: p.currentVersion,
      title: p.versions[0]?.title ?? '', courseCount: p.courses.length,
    }))
  }

  async listCourses() {
    const rows = await this.prisma.course.findMany({
      orderBy: { id: 'asc' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 }, skillLinks: true, pathwayLinks: true },
    })
    return rows.map((c) => ({
      id: c.id, status: c.status, title: c.versions[0]?.titleAr ?? '',
      hours: c.versions[0]?.totalHours ?? 0, skillCount: c.skillLinks.length,
      pathways: c.pathwayLinks.map((l) => l.pathwayId),
    }))
  }

  /**
   * كل المهارات وحالة قياسها (البند ب-٤).
   * الحالة تُحسب من المحرك نفسه (بنك الأسئلة وخطة سطح B2C) لا من عمود في
   * القاعدة — فما يراه المؤلّف هو ما يحدث في جلسة التشخيص فعلا.
   */
  async listSkills() {
    const rows = await this.prisma.skill.findMany({ orderBy: { id: 'asc' } })
    return rows.map((s) => {
      const st = skillStateOf(s.slug, s.nameAr)
      return {
        id: s.id, status: s.status, slug: s.slug, nameAr: s.nameAr, familyId: s.familyId,
        measureState: st.state,
        measuredBy: st.measuredBy,
        decisionRoleAr: st.decisionRoleAr,
        measureNoteAr: st.noteAr,
      }
    })
  }

  async listTemplates() {
    const rows = await this.prisma.compositeTemplate.findMany({
      orderBy: { id: 'asc' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 }, courses: true },
    })
    return rows.map((t) => ({
      id: t.id, status: t.status, name: t.versions[0]?.nameAr ?? '', courseCount: t.courses.length,
    }))
  }

  async listQuestions() {
    const rows = await this.prisma.question.findMany({
      orderBy: { id: 'asc' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 }, options: true },
    })
    return rows.map((q) => ({
      id: q.id, status: q.status, active: q.active, module: q.moduleName ?? q.moduleId ?? '',
      text: q.versions[0]?.textAr ?? '', optionCount: q.options.length,
    }))
  }

  /** إنشاء مهارة جديدة كمسودة — المعرف بصيغة SK-X-* للامتدادات */
  async createSkill(input: { id: string; slug: string; nameAr: string; familyId?: string }, actorId?: string) {
    if (!/^SK-[A-Z0-9-]+$/.test(input.id)) throw new AuthError('invalid_id', 'معرف المهارة بصيغة SK-XXX-000')
    const dup = await this.prisma.skill.findUnique({ where: { id: input.id } })
    if (dup) throw new AuthError('duplicate_id', 'معرف المهارة موجود مسبقا', 409)
    if (input.familyId) {
      const known = await this.prisma.skill.findFirst({ where: { familyId: input.familyId }, select: { id: true } })
      if (!known) throw new AuthError('unknown_family', 'رمز عائلة المهارة غير معروف في القاموس')
    }
    return this.prisma.skill.create({
      data: {
        id: input.id, slug: input.slug, nameAr: input.nameAr, familyId: input.familyId ?? null,
        status: 'draft',
        versions: { create: { version: 1, nameAr: input.nameAr, status: 'draft', createdBy: actorId } },
      },
    })
  }

  /** إنشاء دورة كمسودة مع وحداتها وروابط مهاراتها */
  async createCourse(input: {
    id: string; pathwayId: string; sequence: number; titleAr: string; shortPromiseAr?: string
    levelAr?: string; totalHours: number; skillIds: string[]
    modules: { sequence: number; titleAr: string; outcomeAr?: string; activityAr?: string; artifactAr?: string; bodyAr?: string; checksAr?: string; videoAr?: string; scenarioAr?: string; hours: number }[]
  }, actorId?: string) {
    if (!/^C-[A-Z0-9-]+$/.test(input.id)) throw new AuthError('invalid_id', 'معرف الدورة بصيغة C-XXX-000')
    if (await this.prisma.course.findUnique({ where: { id: input.id } })) {
      throw new AuthError('duplicate_id', 'معرف الدورة موجود مسبقا', 409)
    }
    const pathway = await this.prisma.pathway.findUnique({ where: { id: input.pathwayId } })
    if (!pathway) throw new AuthError('unknown_pathway', 'المسار الأم غير موجود')
    const skills = await this.prisma.skill.findMany({ where: { id: { in: input.skillIds } } })
    if (skills.length !== input.skillIds.length) throw new AuthError('unknown_skill', 'مهارة واحدة أو أكثر غير موجودة')
    if (input.modules.length === 0) throw new AuthError('no_modules', 'الدورة بلا وحدات غير مقبولة')

    /* البند ب-٤: تقييم جودة القياس يُحسب ويُعاد مع الردّ — لا يمنع الحفظ.
       المؤلّف يرى أثر اختياره لحظة الحفظ لا بعد أسبوع في ترشيح باهت. */
    const skillAssessment = assessSkillSelection(skills.map((sk) => sk.slug))

    const created = await this.prisma.course.create({
      data: {
        id: input.id, status: 'draft', createdBy: actorId,
        versions: {
          create: {
            version: 1, titleAr: input.titleAr, shortPromiseAr: input.shortPromiseAr,
            levelAr: input.levelAr, totalHours: input.totalHours, status: 'draft', createdBy: actorId,
          },
        },
        skillLinks: { create: input.skillIds.map((skillId) => ({ skillId })) },
        pathwayLinks: { create: { pathwayId: input.pathwayId, sequence: input.sequence } },
        modules: {
          create: input.modules.map((m) => ({
            id: `${input.id}-M${m.sequence}`, status: 'draft',
            versions: {
              create: [{
                version: 1, sequence: m.sequence, titleAr: m.titleAr, outcomeAr: m.outcomeAr,
                activityAr: m.activityAr, artifactAr: m.artifactAr, bodyAr: m.bodyAr ?? null,
                checksAr: m.checksAr ?? null, videoAr: m.videoAr ?? null, scenarioAr: m.scenarioAr ?? null,
                hours: m.hours, status: 'draft',
              }],
            },
          })),
        },
      },
    })
    return { ...created, skillAssessment }
  }

  /** إنشاء مسار كمسودة مرتبط بدورات موجودة */
  async createPathway(input: {
    id: string; title: string; shortTitle?: string; audience?: string; beforeText?: string
    afterText?: string; durationWeeks?: number; weeklyHours?: string; level?: string
    capstone?: string; courseIds: string[]
  }, actorId?: string) {
    if (!/^PW-[A-Z0-9-]+$/.test(input.id)) throw new AuthError('invalid_id', 'معرف المسار بصيغة PW-XXX-000')
    if (await this.prisma.pathway.findUnique({ where: { id: input.id } })) {
      throw new AuthError('duplicate_id', 'معرف المسار موجود مسبقا', 409)
    }
    const courses = await this.prisma.course.findMany({ where: { id: { in: input.courseIds } } })
    if (courses.length !== input.courseIds.length) throw new AuthError('unknown_course', 'دورة واحدة أو أكثر غير موجودة')
    return this.prisma.pathway.create({
      data: {
        id: input.id, status: 'draft', createdBy: actorId,
        versions: {
          create: {
            version: 1, title: input.title, shortTitle: input.shortTitle, audience: input.audience,
            beforeText: input.beforeText, afterText: input.afterText, durationWeeks: input.durationWeeks,
            weeklyHours: input.weeklyHours, level: input.level, capstone: input.capstone,
            status: 'draft', createdBy: actorId,
          },
        },
        courses: { create: input.courseIds.map((courseId, i) => ({ courseId, sequence: i + 1 })) },
      },
    })
  }

  /** تقديم طلب تغيير (maker) — لا يُطبَّق شيء قبل الاعتماد */
  async submitChangeRequest(entityType: string, entityId: string, payload: unknown, actorId: string) {
    if (!['pathway', 'course', 'skill', 'question', 'template'].includes(entityType)) {
      throw new AuthError('invalid_entity', 'نوع كيان غير مدعوم')
    }
    return this.prisma.contentChangeRequest.create({
      data: { entityType, entityId, payload: payload as object, status: 'in_review', createdBy: actorId },
    })
  }

  async listChangeRequests(status?: string) {
    const rows = await this.prisma.contentChangeRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { decisions: { orderBy: { createdAt: 'desc' } } },
    })
    return rows
  }

  /** قرار مراجعة (checker) — ممنوع أن يعتمد صانعُ الطلب طلبَه بنفسه */
  async decide(changeRequestId: string, decision: 'approve' | 'request_changes' | 'reject', noteAr: string | undefined, actorId: string) {
    const cr = await this.prisma.contentChangeRequest.findUnique({ where: { id: changeRequestId } })
    if (!cr) throw new AuthError('not_found', 'طلب التغيير غير موجود', 404)
    if (cr.status !== 'in_review') throw new AuthError('bad_state', 'الطلب ليس قيد المراجعة', 409)
    if (cr.createdBy === actorId) throw new AuthError('maker_checker', 'لا يجوز اعتماد طلب أنشأته بنفسك (maker-checker)', 403)

    const newStatus = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'changes_requested'
    return this.prisma.$transaction(async (tx) => {
      await tx.contentApprovalDecision.create({ data: { changeRequestId, actorId, decision, noteAr } })
      const updated = await tx.contentChangeRequest.update({ where: { id: changeRequestId }, data: { status: newStatus, reviewedBy: actorId, reviewedAt: new Date() } })
      /* الاعتماد يرفع الكيان المسودة إلى «approved» استعدادا للنشر */
      if (decision === 'approve') await this.promoteEntity(tx, cr.entityType, cr.entityId, 'draft', 'approved')
      return updated
    })
  }

  /** رفع حالة كيان وإصداره الحالي معا — داخل معاملة القرار أو النشر */
  async promoteEntity(tx: Prisma.TransactionClient, entityType: string, entityId: string, from: string, to: string) {
    if (entityType === 'pathway') {
      const e = await tx.pathway.update({ where: { id: entityId }, data: { status: to } })
      await tx.pathwayVersion.updateMany({ where: { pathwayId: entityId, version: e.currentVersion, status: from }, data: { status: to } })
    } else if (entityType === 'course') {
      const e = await tx.course.update({ where: { id: entityId }, data: { status: to } })
      await tx.courseVersion.updateMany({ where: { courseId: entityId, version: e.currentVersion, status: from }, data: { status: to } })
      /* الوحدات تتبع دورتها */
      await tx.courseModule.updateMany({ where: { courseId: entityId, status: from }, data: { status: to } })
      await tx.courseModuleVersion.updateMany({ where: { module: { courseId: entityId }, status: from }, data: { status: to } })
    } else if (entityType === 'skill') {
      const e = await tx.skill.update({ where: { id: entityId }, data: { status: to } })
      await tx.skillVersion.updateMany({ where: { skillId: entityId, version: e.currentVersion, status: from }, data: { status: to } })
    } else if (entityType === 'question') {
      const e = await tx.question.update({ where: { id: entityId }, data: { status: to } })
      await tx.questionVersion.updateMany({ where: { questionId: entityId, version: e.currentVersion, status: from }, data: { status: to } })
    } else if (entityType === 'template') {
      const e = await tx.compositeTemplate.update({ where: { id: entityId }, data: { status: to } })
      await tx.compositeTemplateVersion.updateMany({ where: { templateId: entityId, version: e.currentVersion, status: from }, data: { status: to } })
    }
  }
}
