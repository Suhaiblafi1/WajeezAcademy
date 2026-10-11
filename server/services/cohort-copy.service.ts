/* ═══ «انسخ من شعبةٍ أخرى» — والعلّةُ والمحضُ في `src/application/trainer/plan-copy.ts` ═══

   (١١ أكتوبر ٢٠٢٦، ملفُّ صاحب المنصّة «تحسينات بوابة مدرّب وجيز»)

   ما يُنسخ: الخطّةُ كلُّها (النبذةُ والمستوى والجمهورُ والمحاورُ ومتونُها ومواعيدُها
   والكرّاساتُ والمصادر) بتواريخَ مُزاحةٍ إلى بدءٍ يختاره، ومهامُّ الشعبة المنسوخ منها
   بمواعيدها مُزاحةً كذلك. وما لا يُنسخ: اللقاءاتُ المباشرة (لها اعتمادٌ واجتماع)،
   والتسليماتُ والمتعلّمون.

   والأحكام:
   · الشعبتان له، ولدورةٍ واحدة — «صاحبُ عدّة شعبٍ لنفس الدورة».
   · والمنسوخُ إليها في يده (مسوّدةٌ أو مردودة) ولم تُعتمَد له خطّةٌ قطّ: النسخُ يحلّ
     محلَّ ما فيها، وبعد الاعتماد ما يتغيّر مراجعةٌ تُقرأ بفرقها — لا نسخٌ يمحو.
   · والملفّاتُ تُنسخ بمفاتيحَ جديدةٍ لشعبتها: ملفُّ الشعبة يُقرأ بصلاحيّة شعبته.
   · والمهمّةُ التي بعنوانها في المنسوخ إليها لا تُكرَّر — فنسخٌ ثانٍ لا يضاعفها.
   · والحفظُ بـ`savePlan` نفسِه: ما يردّه حفظُ المدرّب (مدّةٌ مضت مثلا) يردّ النسخ. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { getObject, getObjectMeta, putObject } from './object-store'
import { newStorageKey } from './storage.service'
import { CohortPlanService, type TrainerPlanContent } from './cohort-plan.service'
import { planFileKeys, remapFileKeys, shiftInstant, shiftPlan } from '../../src/application/trainer/plan-copy'
import { readTypedLinks } from '../../src/application/trainer/plan-overlay'

export class CohortCopyService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  private async mine(userId: string, cohortId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId }, select: { id: true } })
    if (!profile) throw new AuthError('no_profile', 'لا ملفَّ مدرّبٍ مرتبطا بهذا الحساب', 404)
    const link = await this.prisma.cohortTrainer.findFirst({
      where: { cohortId, profileId: profile.id }, select: { cohort: { select: { id: true, courseId: true, title: true } } },
    })
    if (!link) throw new AuthError('not_your_cohort', 'هذه الشعبة ليست مُسنَدةً إليك', 403)
    return link.cohort
  }

  private latestPlan(cohortId: string) {
    return this.prisma.cohortDeliveryPlan.findFirst({
      where: { cohortId, trainerId: { not: null } }, orderBy: { createdAt: 'desc' }, select: { status: true, content: true },
    })
  }

  /** ينسخ ملفّاتِ الخطّة إلى الشعبة الجديدة — ويُعيد خريطةَ القديم إلى الجديد */
  private async copyFiles(userId: string, fromCohort: string, toCohort: string, keys: readonly string[]) {
    const map = new Map<string, string>()
    for (const key of keys) {
      const row = await this.prisma.cohortFile.findUnique({ where: { storageKey: key } })
      if (!row || row.cohortId !== fromCohort) continue
      const body = await getObject(key)
      if (!body) continue
      const meta = await getObjectMeta(key)
      const next = newStorageKey()
      const size = await putObject(next, body, { mime: meta?.mime || row.mime, originalName: meta?.originalName || row.originalName })
      await this.prisma.cohortFile.create({
        data: {
          cohortId: toCohort, purpose: row.purpose, refId: row.refId, storageKey: next,
          originalName: row.originalName, mime: row.mime, sizeBytes: size, uploadedBy: userId,
        },
      })
      map.set(key, next)
    }
    return map
  }

  async copyFrom(userId: string, targetId: string, input: { sourceCohortId: string; startsOn: string }) {
    if (input.sourceCohortId === targetId) throw new AuthError('same_cohort', 'اختر شعبةً غيرَ هذه', 400)
    const [target, source] = await Promise.all([this.mine(userId, targetId), this.mine(userId, input.sourceCohortId)])
    if (target.courseId !== source.courseId) {
      throw new AuthError('other_course', 'يُنسخ من شعبةٍ لنفس الدورة وحدَها', 400)
    }
    const [targetPlan, sourcePlan, approvedBefore] = await Promise.all([
      this.latestPlan(targetId),
      this.latestPlan(source.id),
      this.prisma.cohortDeliveryPlan.count({ where: { cohortId: targetId, trainerId: { not: null }, status: { in: ['approved', 'published'] } } }),
    ])
    if (targetPlan && targetPlan.status !== 'draft' && targetPlan.status !== 'changes_requested') {
      throw new AuthError('plan_locked', 'خطّةُ هذه الشعبة ليست في يدك الآن — لا يُنسخ إليها', 409)
    }
    if (approvedBefore > 0) {
      throw new AuthError('approved_once', 'اعتُمدت لهذه الشعبة خطّةٌ من قبل — عدّلها في خطواتها، فالنسخُ يمحو ما فيها', 409)
    }
    const content = sourcePlan?.content as TrainerPlanContent | null | undefined
    if (!content || !Array.isArray(content.modules)) {
      throw new AuthError('nothing_to_copy', `لا خطّةَ في «${source.title}» تُنسخ بعد`, 404)
    }
    const shifted = shiftPlan(content as unknown as Parameters<typeof shiftPlan>[0], input.startsOn)
    if (!shifted) throw new AuthError('no_period', `لا مدّةَ لـ«${source.title}» — لا يُعرف من أين تُزاح التواريخ`, 400)

    /* الملفّاتُ: الخطّةُ ومرفقاتُ المهامّ — مرّةً واحدةً لكلّ مفتاح */
    const tasks = await this.prisma.cohortAssessment.findMany({
      where: { cohortId: source.id, status: { not: 'closed' } }, orderBy: { createdAt: 'asc' },
      select: { title: true, type: true, moduleId: true, briefAr: true, maxScore: true, passScore: true, dueAt: true, attachments: true },
    })
    const keys = [...planFileKeys(shifted.plan), ...tasks.flatMap((t) => planFileKeys({ a: t.attachments }))]
    const map = await this.copyFiles(userId, source.id, targetId, [...new Set(keys)])
    const plan = remapFileKeys(shifted.plan, map) as unknown as TrainerPlanContent

    await new CohortPlanService(this.prisma).savePlan(userId, targetId, plan)

    const { AssessmentService } = await import('./assessment.service')
    const assessments = new AssessmentService(this.prisma)
    const existing = new Set((await this.prisma.cohortAssessment.findMany({
      where: { cohortId: targetId, status: { not: 'closed' } }, select: { title: true },
    })).map((a) => a.title.trim()))
    let copiedTasks = 0
    for (const t of tasks) {
      if (existing.has(t.title.trim())) continue
      const due = shiftInstant(t.dueAt, shifted.days)
      await assessments.createAssessment(userId, {
        cohortId: targetId, title: t.title, type: t.type as 'assignment' | 'quiz' | 'project',
        moduleId: t.moduleId ?? undefined, briefAr: t.briefAr ?? undefined, maxScore: t.maxScore,
        passScore: t.passScore ?? undefined, dueAt: due ? new Date(due) : undefined,
        attachments: remapFileKeys(readTypedLinks(t.attachments), map),
      }, { byTrainer: true })
      copiedTasks += 1
    }

    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.plan.copy', entityType: 'cohort', entityId: targetId,
      meta: { sourceCohortId: source.id, days: shifted.days, files: map.size, tasks: copiedTasks },
    })
    return { copiedTasks, files: map.size, days: shifted.days }
  }
}
