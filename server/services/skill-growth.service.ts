/* خدمة القياس البعديّ للمهارة (البند ح-٧) — إعادة القياس بعد إتمام الدورة وحفظ الفرق.

   الحدود التي تفرضها هذه الخدمة، وهي كل قيمتها:
   ١) لا يُفتح القياس إلا بإتمام حقيقي — البوابة نقية ومختبرة في
      src/application/student/skill-growth.ts، وتُطبّق هنا على وقائع من القاعدة.
   ٢) مهارات القياس تُقرأ من القاعدة (CourseSkillLink) لا من حزمة العميل، فتعديل
      المدرب المعتمد على مهارات دورته ينعكس فورا على ما يُقاس.
   ٣) beforeLevel لقطة تُكتب مرة: يُقرأ من لقطة التشخيص وقت القياس ثم يُثبَّت.
   ٤) القيد الفريد (enrollmentId, skillSlug) يجعل القياس مرة واحدة — محاولة ثانية
      تُرفض بـ 409 لا تُعدّل الرقم. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { ProgressService } from './progress.service'
import { safeNotify } from './notification.service'
import { skillVectorFromSnapshot } from '../../src/application/student/skills-profile'
import {
  buildRemeasureForm,
  remeasureGate,
  validateRemeasure,
  type RemeasureRow,
} from '../../src/application/student/skill-growth'

export class SkillGrowthService {
  private prisma: PrismaClient
  private progress: ProgressService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.progress = new ProgressService(prisma)
  }

  /** تسجيل المتعلم نفسه أو خطأ — لا يقرأ أحد تسجيل أحد */
  private async myEnrollment(userId: string, enrollmentId: string) {
    const e = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { cohort: true, certificates: true },
    })
    if (!e) throw new AuthError('not_found', 'التسجيل غير موجود', 404)
    if (e.userId !== userId) throw new AuthError('forbidden', 'هذا التسجيل ليس لك', 403)
    return e
  }

  /** متجه القياس قبل الدورة — من لقطة التشخيص المرفقة بالحساب */
  private async baselineVector(userId: string): Promise<Record<string, number>> {
    const profile = await this.prisma.learnerProfile.findUnique({
      where: { userId }, select: { diagnosticSnapshot: true },
    })
    return skillVectorFromSnapshot(profile?.diagnosticSnapshot ?? null)
  }

  /**
   * مهارات الدورة من القاعدة؛ وعند غياب روابط المهارات نرجع للكتالوج المضمّن
   * حتى لا تُحجب ميزة بسبب ثغرة بيانات — والمصدر يُعلن في الرد.
   */
  private async courseSkills(courseId: string, baseline: Record<string, number>): Promise<{
    rows: RemeasureRow[]; source: 'db' | 'catalog'; courseTitleAr: string | null
  }> {
    const links = await this.prisma.courseSkillLink.findMany({
      where: { courseId },
      include: { skill: { select: { slug: true, nameAr: true } } },
      orderBy: [{ weight: 'desc' }, { skillId: 'asc' }],
    })
    const fallback = buildRemeasureForm(courseId, baseline)
    if (links.length === 0) return { rows: fallback.rows, source: 'catalog', courseTitleAr: fallback.courseTitleAr }
    const rows: RemeasureRow[] = links.map((l) => {
      const before = baseline[l.skill.slug]
      return {
        slug: l.skill.slug,
        nameAr: l.skill.nameAr,
        beforeLevel: typeof before === 'number' && Number.isFinite(before) && before >= 1 ? Math.min(5, Math.round(before)) : null,
      }
    })
    return { rows, source: 'db', courseTitleAr: fallback.courseTitleAr }
  }

  /** هل يُفتح القياس البعديّ لهذا التسجيل، وما الاستمارة، وهل قِيس سابقا */
  async eligibility(userId: string, enrollmentId: string) {
    const e = await this.myEnrollment(userId, enrollmentId)
    const existing = await this.prisma.skillRemeasure.findMany({
      where: { enrollmentId }, orderBy: { skillSlug: 'asc' },
    })

    /* تقييم القواعد لا يُستدعى على تسجيل منسحب — البوابة تحسمه بلا حساب */
    let rulesChecked = 0
    let rulesMet = false
    let percent = 0
    if (e.status !== 'dropped' && e.status !== 'waitlisted') {
      const c = await this.progress.evaluateCompletion(enrollmentId)
      rulesChecked = c.rulesChecked
      rulesMet = c.complete
      percent = c.percent
    }

    const gate = remeasureGate({
      enrollmentStatus: e.status,
      hasCertificate: e.certificates.some((c) => c.status === 'active'),
      rulesChecked,
      rulesMet,
      percent,
    })

    const baseline = await this.baselineVector(userId)
    const { rows, source, courseTitleAr } = await this.courseSkills(e.cohort.courseId, baseline)

    return {
      enrollmentId,
      courseId: e.cohort.courseId,
      courseTitleAr,
      cohortTitle: e.cohort.title,
      gate,
      /* الاستمارة تُرسل دائما ليعرف المتعلم ما سيُقاس قبل أن يستحقه */
      form: { rows, measurable: rows.length > 0, skillsSource: source },
      measuredAt: existing[0]?.measuredAt ?? null,
      alreadyMeasured: existing.length > 0,
      measured: existing.map((r) => ({
        skillSlug: r.skillSlug, beforeLevel: r.beforeLevel, afterLevel: r.afterLevel,
      })),
    }
  }

  /** يكتب القياس البعديّ — مرة واحدة، بعد إتمام حقيقي، على مهارات الدورة فقط */
  async submit(userId: string, enrollmentId: string, levels: Record<string, unknown>) {
    const e = await this.myEnrollment(userId, enrollmentId)
    const already = await this.prisma.skillRemeasure.count({ where: { enrollmentId } })
    if (already > 0) {
      throw new AuthError('already_measured', 'قِيس نموك في هذه الدورة مرة واحدة — الفرق سجل لا يُعدَّل', 409)
    }

    let rulesChecked = 0
    let rulesMet = false
    let percent = 0
    if (e.status !== 'dropped' && e.status !== 'waitlisted') {
      const c = await this.progress.evaluateCompletion(enrollmentId)
      rulesChecked = c.rulesChecked
      rulesMet = c.complete
      percent = c.percent
    }
    const gate = remeasureGate({
      enrollmentStatus: e.status,
      hasCertificate: e.certificates.some((c) => c.status === 'active'),
      rulesChecked, rulesMet, percent,
    })
    if (!gate.open) throw new AuthError('not_complete', gate.reasonAr, 403)

    const baseline = await this.baselineVector(userId)
    const { rows } = await this.courseSkills(e.cohort.courseId, baseline)
    if (rows.length === 0) throw new AuthError('not_measurable', 'لا مهارات مصنّفة لهذه الدورة — لا قياس بعديّ لها', 400)

    const check = validateRemeasure(levels, rows.map((r) => r.slug))
    if (!check.ok) throw new AuthError('bad_levels', `قياس غير مقبول: ${check.errorsAr.join(' · ')}`, 400)

    const beforeBySlug = new Map(rows.map((r) => [r.slug, r.beforeLevel]))
    const measuredAt = new Date()
    const data = Object.entries(check.clean).map(([skillSlug, afterLevel]) => ({
      userId,
      enrollmentId,
      courseId: e.cohort.courseId,
      skillSlug,
      /* لقطة: لا تُشتق لاحقا فلا يتغير الفرق بتغير التشخيص */
      beforeLevel: beforeBySlug.get(skillSlug) ?? null,
      afterLevel,
      measuredAt,
    }))
    /* skipDuplicates يجعل الكتابة آمنة أمام نقرتين متزامنتين — والقيد الفريد هو الحاكم */
    await this.prisma.skillRemeasure.createMany({ data, skipDuplicates: true })

    const written = await this.prisma.skillRemeasure.findMany({ where: { enrollmentId } })
    const improved = written.filter((r) => r.beforeLevel !== null && r.afterLevel > r.beforeLevel).length
    await recordAudit(this.prisma, {
      actorId: userId, action: 'skill.remeasure', entityType: 'enrollment', entityId: enrollmentId,
      meta: { courseId: e.cohort.courseId, skills: written.length, improved },
    })
    await safeNotify(this.prisma, {
      userId, channel: 'in_app',
      title: 'سُجّل قياس نموك',
      body: `قِيست ${written.length} مهارة بعد إتمامك «${e.cohort.title}» — ارتفعت ${improved} منها. النتيجة في ملف مهاراتك.`,
      data: { kind: 'skill_remeasure', enrollmentId, courseId: e.cohort.courseId },
    })

    return {
      enrollmentId,
      courseId: e.cohort.courseId,
      measuredAt: measuredAt.toISOString(),
      records: written.map((r) => ({
        courseId: r.courseId, skillSlug: r.skillSlug, beforeLevel: r.beforeLevel,
        afterLevel: r.afterLevel, measuredAt: r.measuredAt.toISOString(),
      })),
    }
  }

  /** كل قياساتي البعدية — سجلات خام مع أسماء المهارات، والاشتقاق في العميل */
  async myGrowth(userId: string) {
    const rows = await this.prisma.skillRemeasure.findMany({
      where: { userId }, orderBy: [{ measuredAt: 'desc' }, { skillSlug: 'asc' }],
    })
    const slugs = [...new Set(rows.map((r) => r.skillSlug))]
    const skills = slugs.length
      ? await this.prisma.skill.findMany({ where: { slug: { in: slugs } }, select: { slug: true, nameAr: true } })
      : []
    return {
      records: rows.map((r) => ({
        courseId: r.courseId, skillSlug: r.skillSlug, beforeLevel: r.beforeLevel,
        afterLevel: r.afterLevel, measuredAt: r.measuredAt.toISOString(),
      })),
      nameBySlug: Object.fromEntries(skills.map((s) => [s.slug, s.nameAr])),
    }
  }

  /** التسجيلات المؤهَّلة للقياس ولم تُقس — لدعوة واحدة في بوابة المتعلم */
  async pendingInvites(userId: string) {
    const rows = await this.prisma.enrollment.findMany({
      where: { userId, status: { notIn: ['dropped', 'waitlisted'] } },
      include: { cohort: { select: { courseId: true, title: true } }, certificates: true },
      orderBy: { createdAt: 'desc' },
    })
    const measured = new Set(
      (await this.prisma.skillRemeasure.findMany({
        where: { userId }, select: { enrollmentId: true },
      })).map((r) => r.enrollmentId),
    )
    const out: { enrollmentId: string; courseId: string; cohortTitle: string }[] = []
    for (const e of rows) {
      if (measured.has(e.id)) continue
      const hasCertificate = e.certificates.some((c) => c.status === 'active')
      /* الاختصار مقصود: بلا شهادة ولا حالة مكتمل لا نُقيّم قواعد كل تسجيل في نداء قائمة */
      if (!hasCertificate && e.status !== 'completed') continue
      out.push({ enrollmentId: e.id, courseId: e.cohort.courseId, cohortTitle: e.cohort.title })
    }
    return out
  }
}
