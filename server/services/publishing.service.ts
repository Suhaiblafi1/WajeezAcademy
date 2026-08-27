/* خدمة النشر المحكوم — دورة حياة إصدار الكتالوج:
   draft → validated → impact_analyzed → published (أو rollback لإصدار سابق).
   قواعد صارمة:
   - لا نشر لكيان «approved» بلا طلب تغيير معتمد يغطيه (maker-checker سابق).
   - النشر ذري: معاملة واحدة ترفع الكيانات وتبني اللقطة وتخزنها وتسجل الحدث.
   - الرجوع rollback ينشر لقطة إصدار سابق كإصدار جديد — لا حذف ولا تعديل بأثر رجعي. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { buildSnapshotFromDb } from '../catalog/snapshot-builder'
import { CatalogAdminService } from './catalog-admin.service'
import { recordAudit } from './audit'

export class PublishingService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async listVersions() {
    return this.prisma.catalogVersion.findMany({
      orderBy: { createdAt: 'desc' },
      include: { snapshots: { select: { payloadHash: true, createdAt: true } }, events: { select: { action: true, createdAt: true } } },
    })
  }

  async createDraftVersion(label: string, actorId?: string) {
    if (!/^[\w.-]{3,40}$/.test(label)) throw new AuthError('invalid_label', 'تسمية الإصدار: أحرف وأرقام ونقاط فقط (3-40)')
    const dup = await this.prisma.catalogVersion.findUnique({ where: { label } })
    if (dup) throw new AuthError('duplicate_label', 'تسمية الإصدار مستخدمة', 409)
    return this.prisma.catalogVersion.create({ data: { label, status: 'draft', createdBy: actorId } })
  }

  /** حذف مسودة معلّقة — نشرٌ أخفق بعد إنشاء الإصدار يترك تسميتها محجوزة للأبد،
      واللوحة لا تعرض لها زر نشر لأنها بلا لقطة، فتبقى تمنع إعادة استعمال التسمية
      بلا وسيلة لإزالتها.

      الشرطان يجعلان الحذف غير قادر على إتلاف تاريخ: مسودة فقط — فلا يمسّ منشورا
      ولا متجاوَزا؛ وبلا لقطة واحدة — فلا يمحو هدف رجوع محتملا. وما عدا ذلك يُرفض
      برسالة تقول أي الشرطين تخلّف. والحذف نفسه يُسجَّل في AuditEvent لا في
      CatalogPublishEvent، لأن أحداث الإصدار تُحذف معه بالتتالي — فيبقى أثر الحذف
      بعد زوال المحذوف. */
  async deleteDraftVersion(versionId: string, actorId: string, reasonAr?: string) {
    const v = await this.prisma.catalogVersion.findUnique({
      where: { id: versionId },
      include: { snapshots: { select: { id: true } } },
    })
    if (!v) throw new AuthError('not_found', 'الإصدار غير موجود', 404)
    if (v.status !== 'draft') {
      throw new AuthError('not_draft', `لا يُحذف إلا إصدار مسودة — حالة «${v.label}»: ${v.status}`, 409)
    }
    if (v.snapshots.length > 0) {
      throw new AuthError('has_snapshot', `الإصدار «${v.label}» يحمل لقطة — قد يكون هدف رجوع، فلا يُحذف`, 409)
    }
    await recordAudit(this.prisma, {
      actorId, action: 'catalog.version.delete_draft', entityType: 'CatalogVersion', entityId: v.id,
      reason: reasonAr, before: { label: v.label, status: v.status, createdAt: v.createdAt },
    })
    await this.prisma.catalogVersion.delete({ where: { id: v.id } })
    return { deleted: true, label: v.label }
  }

  /** الكيانات المرشحة للنشر: كل ما هو «approved» */
  private async approvedEntities() {
    const [pathways, courses, skills, questions, templates] = await Promise.all([
      this.prisma.pathway.findMany({ where: { status: 'approved' }, select: { id: true } }),
      this.prisma.course.findMany({ where: { status: 'approved' }, select: { id: true } }),
      this.prisma.skill.findMany({ where: { status: 'approved' }, select: { id: true } }),
      this.prisma.question.findMany({ where: { status: 'approved' }, select: { id: true } }),
      this.prisma.compositeTemplate.findMany({ where: { status: 'approved' }, select: { id: true } }),
    ])
    return { pathways, courses, skills, questions, templates }
  }

  /** تحقق بنيوي صارم قبل النشر — يفشل برسائل عربية مفصلة */
  async validateDrafts(): Promise<{ ok: boolean; errors: string[] }> {
    const errors: string[] = []
    const approved = await this.approvedEntities()
    const admin = new CatalogAdminService(this.prisma)

    /* كل كيان معتمد يجب أن يغطيه طلب تغيير معتمد */
    for (const [type, rows] of Object.entries({ pathway: approved.pathways, course: approved.courses, skill: approved.skills, question: approved.questions, template: approved.templates })) {
      for (const r of rows) {
        const cr = await this.prisma.contentChangeRequest.findFirst({ where: { entityType: type, entityId: r.id, status: 'approved' } })
        if (!cr) errors.push(`${type} ${r.id}: معتمد بلا طلب تغيير موثق — مخالفة maker-checker`)
      }
    }

    /* المسارات المعتمدة: دورة واحدة على الأقل، وكل دوراتها موجودة ومنشورة أو معتمدة */
    for (const p of approved.pathways) {
      const links = await this.prisma.pathwayCourse.findMany({ where: { pathwayId: p.id }, orderBy: { sequence: 'asc' } })
      if (links.length === 0) { errors.push(`pathway ${p.id}: بلا دورات`); continue }
      for (const l of links) {
        const c = await this.prisma.course.findUnique({ where: { id: l.courseId } })
        if (!c) errors.push(`pathway ${p.id}: مرجع دورة مفقود ${l.courseId}`)
        else if (!['published', 'approved'].includes(c.status)) errors.push(`pathway ${p.id}: الدورة ${l.courseId} بحالة ${c.status} — ليست جاهزة للنشر`)
      }
    }

    /* جاهزية المسار (ج-١ · ج-٣) — **نفس التعريف** الذي يعرضه معالج إضافة المسار،
       لا نسخة ثانية منه: تعريفان للجاهزية يتباعدان دائما. يُستثنى «فحص الأثر»
       لأن هذه الشاشة تشغّله بنفسها في خطوة مستقلة قبل النشر.
       والحاجز وقت النشر لا في أهلية التوصية: لا يُخرج منشورا قائما، ويمنع دخول
       محتوى جديد أعمى. المصدر الملفي مغطى ببوابة validate-source. */
    for (const p of approved.pathways) {
      const readiness = await admin.pathwayReadiness(p.id)
      for (const step of readiness.steps) {
        if (step.key === 'impact' || step.ok) continue
        errors.push(`pathway ${p.id} · ${step.labelAr}: ${step.reasonAr}`)
      }
    }

    /* الدورات المعتمدة: وحدة واحدة على الأقل، ومهاراتها موجودة */
    for (const c of approved.courses) {
      const modules = await this.prisma.courseModule.count({ where: { courseId: c.id, status: { in: ['approved', 'published'] } } })
      if (modules === 0) errors.push(`course ${c.id}: بلا وحدات`)
      const links = await this.prisma.courseSkillLink.findMany({ where: { courseId: c.id } })
      for (const l of links) {
        const s = await this.prisma.skill.findUnique({ where: { id: l.skillId } })
        if (!s) errors.push(`course ${c.id}: مرجع مهارة مفقود ${l.skillId}`)
      }
    }

    /* القوالب المعتمدة: كل دوراتها موجودة */
    for (const t of approved.templates) {
      const links = await this.prisma.templateCourse.findMany({ where: { templateId: t.id } })
      if (links.length === 0) errors.push(`template ${t.id}: بلا دورات`)
      for (const l of links) {
        const c = await this.prisma.course.findUnique({ where: { id: l.courseId } })
        if (!c) errors.push(`template ${t.id}: مرجع دورة مفقود ${l.courseId}`)
      }
    }

    return { ok: errors.length === 0, errors }
  }

  /** النشر الذري — يرفض إن بقي نقص، ولا ينشر شيئا جزئيا أبدا */
  async publish(versionId: string, actorId: string) {
    const version = await this.prisma.catalogVersion.findUnique({ where: { id: versionId } })
    if (!version) throw new AuthError('not_found', 'الإصدار غير موجود', 404)
    if (version.status !== 'draft') throw new AuthError('bad_state', `الإصدار بحالة ${version.status} — النشر من draft فقط`, 409)

    const validation = await this.validateDrafts()
    if (!validation.ok) throw new AuthError('validation_failed', `فشل التحقق: ${validation.errors.join(' | ')}`, 422)

    const approved = await this.approvedEntities()
    const admin = new CatalogAdminService(this.prisma)

    return this.prisma.$transaction(async (tx) => {
      /* 1) رفع كل الكيانات المعتمدة إلى published */
      for (const p of approved.pathways) await admin.promoteEntity(tx, 'pathway', p.id, 'approved', 'published')
      for (const c of approved.courses) await admin.promoteEntity(tx, 'course', c.id, 'approved', 'published')
      for (const s of approved.skills) await admin.promoteEntity(tx, 'skill', s.id, 'approved', 'published')
      for (const q of approved.questions) await admin.promoteEntity(tx, 'question', q.id, 'approved', 'published')
      for (const t of approved.templates) await admin.promoteEntity(tx, 'template', t.id, 'approved', 'published')

      /* 2) طلبات التغيير المعتمدة تصبح «applied» */
      await tx.contentChangeRequest.updateMany({ where: { status: 'approved' }, data: { status: 'applied' } })

      /* 3) الإصدار المنشور السابق → superseded */
      await tx.catalogVersion.updateMany({ where: { status: 'published' }, data: { status: 'superseded' } })

      /* 4) بناء اللقطة من الصفوف المنشورة الآن وتخزينها مجمدة */
      const snap = await buildSnapshotFromDb(tx as unknown as PrismaClient)
      await tx.catalogSnapshot.create({
        data: { catalogVersionId: versionId, payload: snap.payload as object, payloadHash: snap.hash },
      })

      /* 5) نشر الإصدار + حدث التدقيق */
      const published = await tx.catalogVersion.update({
        where: { id: versionId },
        data: { status: 'published', publishedAt: new Date(), publishedBy: actorId },
      })
      await tx.catalogPublishEvent.create({
        data: {
          catalogVersionId: versionId, actorId, action: 'publish',
          details: { promoted: {
            pathways: approved.pathways.map((x) => x.id), courses: approved.courses.map((x) => x.id),
            skills: approved.skills.map((x) => x.id), questions: approved.questions.map((x) => x.id),
            templates: approved.templates.map((x) => x.id),
          }, snapshotHash: snap.hash, counts: snap.counts },
        },
      })
      return { version: published, snapshotHash: snap.hash, counts: snap.counts }
    })
  }

  /** الرجوع إلى إصدار سابق: ينشر لقطته المجمدة كإصدار جديد — بلا حذف وبلا أثر رجعي */
  async rollback(targetVersionId: string, actorId: string, reasonAr?: string) {
    const target = await this.prisma.catalogVersion.findUnique({
      where: { id: targetVersionId },
      include: { snapshots: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })
    if (!target || !target.snapshots[0]) throw new AuthError('not_found', 'الإصدار الهدف أو لقطته غير موجود', 404)
    const snapshot = target.snapshots[0]

    return this.prisma.$transaction(async (tx) => {
      await tx.catalogVersion.updateMany({ where: { status: 'published' }, data: { status: 'superseded' } })
      const newVersion = await tx.catalogVersion.create({
        data: { label: `rollback-${Date.now().toString(36)}`, status: 'published', publishedAt: new Date(), publishedBy: actorId, createdBy: actorId },
      })
      await tx.catalogSnapshot.create({
        data: { catalogVersionId: newVersion.id, payload: snapshot.payload as object, payloadHash: snapshot.payloadHash },
      })
      await tx.catalogPublishEvent.create({
        data: {
          catalogVersionId: newVersion.id, actorId, action: 'rollback',
          details: { restoredFrom: target.label, restoredSnapshotHash: snapshot.payloadHash, reasonAr: reasonAr ?? null },
        },
      })
      return { version: newVersion, restoredFrom: target.label, snapshotHash: snapshot.payloadHash }
    })
  }
}
