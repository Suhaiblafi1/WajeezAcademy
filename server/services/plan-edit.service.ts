/* ═══ تعديلاتٌ تقترحها الإدارةُ على خطّة المدرّب — يقبل كلًّا أو يرفضه (٨ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «التعديلُ معقّدٌ وقد يطول على المدرّب… ألا تكون التعديلاتُ منّا
   مباشرةً على المنصّة وهو يوافق أو يرفض لكلّ تعديل؟» — واختار: نكتبها نحن ويختار هو.

   ── ثلاثةُ حدود ──

   ① **القبولُ حفظٌ منه بأبوابه.** محتوى الخطّة يُحفظ بـ`savePlan`، والمهامُّ ببابَي
      المهامّ، واللقاءاتُ ببابَي النقل والحذف — بمعرّف المدرّب نفسِه. فكلُّ فحصٍ يمرّ به
      حفظُه يمرّ به التعديل (المدّة، ونافذةُ الجدولة، والتعارض، وما سُلّم فيه لا يُحذف…)،
      ولا بابَ خلفيٌّ تكتب منه الإدارةُ في خطّته.
   ② **لا يُكتب فوق ما كتبه بيده بلا علمه.** يُحفظ مع كلّ بندٍ ما كان في موضعه لحظةَ
      الرفع؛ فإن تغيّر قيل له، ويختار: يقبله فوقه أو يرفضه (قرارُ ٢ أكتوبر: لا إجبار).
   ③ **لا يُقبل نصفُ ملفّ.** يُفحص الملفُّ كلُّه لحظةَ الرفع، فإن سقط بندٌ رُدّ كلُّه
      ببنوده وأسبابها — لا يصل المدرّبَ تعديلٌ لا يقع.
   ④ **ولا يصل المدرّبَ ما لم تعتمده الإدارة (١٠ أكتوبر ٢٠٢٦).** المرفوعُ مسوّدةٌ
      (`proposed`) يراجعها من يملك `cohort.plan.edits.review` — المديرُ والمديرُ
      الأكاديميّ — فيعتمد كلَّ بندٍ للمدرّب أو يحذفه. والمدرّبُ لا يرى المسوّدةَ ولا
      يقرّر فيها، ولا تُعدّ في رسالة الردّ.

   والقاعدةُ والعرضُ في `src/application/trainer/plan-edits.ts`. */

import { randomUUID } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { AssessmentService } from './assessment.service'
import { CohortService } from './cohort.service'
import { CohortPlanService, type TrainerPlanContent } from './cohort-plan.service'
import {
  applyContentEdit, contentBefore, editsContent, planEditStep, planEditView, rowEditProblem, sameSnapshot,
  sessionSnapshot, taskSnapshot, type Checked, type EditContext, type EditSnapshot, type EditView, type PlanEdit,
  type PlanEditStatus, PLAN_EDITS_MAX, TRAINER_VISIBLE_EDIT_STATUSES,
} from '../../src/application/trainer/plan-edits'

/** بندٌ في الملفّ المرفوع: التعديلُ نفسُه، ولماذا، وأمطلوبٌ هو */
export type PlanEditInput = PlanEdit & { required?: boolean; reasonAr: string }

export interface PlanEditItem {
  id: string
  seq: number
  kind: string
  step: string
  required: boolean
  reasonAr: string
  status: PlanEditStatus
  decidedAt: Date | null
  /** متى اعتمدته الإدارةُ للمدرّب أو حذفته */
  reviewedAt: Date | null
  noteAr: string | null
  view: EditView
  /** تغيّر موضعُه منذ الرفع — لما لم يُقرَّر فيه بعد */
  stale: boolean
  /** لم يبقَ موضعُه أصلا (مصدرٌ حُذف، مهمّةٌ حُذفت) — بلغة المدرّب */
  goneAr: string | null
}

/** خطّةٌ في يد مدرّبها — يُحفظ فيها */
const IN_HAND = ['draft', 'changes_requested'] as const
/** خطّةٌ يُقترح عليها: في يده أو بانتظار القرار */
const OPEN = ['draft', 'submitted', 'changes_requested'] as const

interface Rows {
  content: TrainerPlanContent
  tasks: { id: string; title: string; briefAr: string | null; dueAt: Date | null; moduleId: string | null; maxScore: number }[]
  sessions: { id: string; title: string; startsAt: Date; endsAt: Date | null; placeholder: boolean }[]
}

export class PlanEditService {
  private prisma: PrismaClient
  private plans: CohortPlanService
  private assessments: AssessmentService
  private cohorts: CohortService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.plans = new CohortPlanService(prisma)
    this.assessments = new AssessmentService(prisma)
    this.cohorts = new CohortService(prisma)
  }

  /* ─────────── ما في الشعبة الآن ─────────── */

  private latestTrainerPlan(cohortId: string) {
    return this.prisma.cohortDeliveryPlan.findFirst({
      where: { cohortId, trainerId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, content: true },
    })
  }

  private async rows(cohortId: string, content: unknown): Promise<Rows> {
    const [tasks, sessions] = await Promise.all([
      this.prisma.cohortAssessment.findMany({
        where: { cohortId },
        select: { id: true, title: true, briefAr: true, dueAt: true, moduleId: true, maxScore: true },
      }),
      this.prisma.cohortSession.findMany({
        where: { cohortId, status: { not: 'cancelled' } },
        select: { id: true, title: true, startsAt: true, endsAt: true, placeholder: true },
      }),
    ])
    const c = (content ?? {}) as TrainerPlanContent
    return { content: { ...c, modules: c.modules ?? [], resources: c.resources ?? [] }, tasks, sessions }
  }

  /** ما في موضع التعديل الآن — أو لماذا لا موضعَ له */
  private snapshotNow(edit: PlanEdit, r: Rows): Checked<EditSnapshot> {
    if (editsContent(edit)) return contentBefore(edit, r.content)
    const p = rowEditProblem(edit, r.content)
    if (p) return { ok: false, problemAr: p }
    switch (edit.kind) {
      case 'task_add': return { ok: true, value: null }
      case 'task_change': {
        const t = r.tasks.find((x) => x.id === edit.assessmentId)
        if (!t) return { ok: false, problemAr: 'لا مهمّةَ بهذا المعرّف في هذه الشعبة — لعلّها حُذفت' }
        return { ok: true, value: taskSnapshot(t as unknown as Record<string, unknown>, Object.keys(edit.set)) }
      }
      case 'session_move': case 'session_remove': {
        const s = r.sessions.find((x) => x.id === edit.sessionId)
        if (!s) return { ok: false, problemAr: 'لا لقاءَ بهذا المعرّف في هذه الشعبة — لعلّه حُذف' }
        if (s.placeholder) return { ok: false, problemAr: 'هذا موعدٌ تحجزه الإدارة لا لقاءٌ للمدرّب' }
        return { ok: true, value: sessionSnapshot(s) }
      }
      default: return { ok: false, problemAr: 'نوعُ تعديلٍ غيرُ معروف' }
    }
  }

  private context(r: Rows): EditContext {
    return {
      moduleIds: r.content.modules.map((m) => m.moduleId),
      taskTitle: (id) => r.tasks.find((t) => t.id === id)?.title ?? null,
      sessionTitle: (id) => r.sessions.find((s) => s.id === id)?.title ?? null,
    }
  }

  /* ─────────── الإدارة: رفعٌ وسحب ─────────── */

  /** يرفعه المعتمِد: يُفحص كلُّه، ويُحفظ كلُّه أو يُردّ كلُّه ببنوده */
  async propose(actorId: string, planId: string, items: readonly PlanEditInput[]) {
    const plan = await this.prisma.cohortDeliveryPlan.findUnique({
      where: { id: planId }, select: { id: true, cohortId: true, status: true, trainerId: true, content: true },
    })
    if (!plan || !plan.trainerId) throw new AuthError('not_found', 'الخطّة غير موجودة', 404)
    if (!(OPEN as readonly string[]).includes(plan.status)) {
      throw new AuthError('plan_closed', 'هذه خطّةٌ اعتُمدت — التعديلاتُ تُقترح على خطّةٍ بانتظار القرار أو في يد مدرّبها', 409)
    }
    if (items.length === 0) throw new AuthError('bad_edits', 'الملفُّ بلا تعديلات', 422)
    if (items.length > PLAN_EDITS_MAX) throw new AuthError('bad_edits', `في الملفّ ${items.length} تعديلا — الحدُّ ${PLAN_EDITS_MAX}. قسّمه ملفّين`, 422)

    const r = await this.rows(plan.cohortId, plan.content)
    /* ═══ ولا يُرفع ما رُفع ولم يُقرَّر فيه (١٠ أكتوبر ٢٠٢٦) ═══
       الرفعُ دفعةً واحدةً من «خططٌ تنتظر اعتمادك» يجعل إعادةَ الملفّ نفسِه أيسرَ — فتتكرّر
       بنودُه على المعتمِد ثمّ على المدرّب. فما وقع على موضعِ بندٍ لم يُقرَّر فيه يُردّ،
       كما يُردّ بندان على موضعٍ واحدٍ في ملفٍّ واحد. */
    const open = await this.prisma.planEditSuggestion.findMany({
      where: { planId, status: { in: ['proposed', 'pending'] } }, select: { edit: true },
    })
    const taken = new Set(open.flatMap((o) => openKeysOf(o.edit as unknown as PlanEdit)))
    /* والملفُّ كلُّه مرفوعٌ من قبل — سطرٌ واحدٌ يقول ذلك، لا سطرٌ لكلّ بند */
    if (taken.size > 0 && items.every((item) => openKeysOf(editOf(item)).some((k) => taken.has(k)))) {
      throw new AuthError('edits_already_uploaded', 'رُفع هذا الملفُّ قبلُ ولم يُقرَّر في بنوده — فلا يُرفع مرّتين. وإن أردتَ رفعه من جديد فاسحب ما لم يُقرَّر في بطاقة خطّته أوّلا', 409)
    }
    const problems: string[] = []
    const seen = new Map<string, number>()
    const snaps = items.map((item, i) => {
      const edit = editOf(item)
      const snap = this.snapshotNow(edit, r)
      if (!snap.ok) { problems.push(`البند ${i + 1}: ${snap.problemAr}`); return null }
      /* وبندان على موضعٍ واحدٍ لا يُرفعان معا: قبولُ أحدهما يجعل «قبل» الآخر غيرَ ما فيه */
      for (const key of targetsOf(edit)) {
        const prior = seen.get(key)
        if (prior !== undefined) problems.push(`البند ${i + 1}: يقع على ما يقع عليه البند ${prior + 1} — اجمعهما بندا واحدا`)
        else seen.set(key, i)
      }
      if (openKeysOf(edit).some((k) => taken.has(k))) {
        problems.push(`البند ${i + 1}: على موضعه تعديلٌ رُفع قبلُ ولم يُقرَّر فيه — إن أردتَ رفعَه من جديد فاسحب ما لم يُقرَّر أوّلا`)
      }
      return snap.value
    })
    if (problems.length) throw new AuthError('bad_edits', `لم يُرفع شيء — في الملفّ ما لا يقع:\n${problems.join('\n')}`, 422)

    const batchId = randomUUID()
    await this.prisma.planEditSuggestion.createMany({
      data: items.map((item, i) => {
        const edit = editOf(item)
        return {
          cohortId: plan.cohortId, planId, batchId, seq: i + 1, kind: edit.kind, step: planEditStep(edit),
          required: item.required === true, reasonAr: item.reasonAr.trim(),
          edit: edit as unknown as Prisma.InputJsonValue,
          before: (snaps[i] ?? undefined) as Prisma.InputJsonValue | undefined,
          /* مسوّدةٌ لا يراها المدرّبُ حتّى تعتمدها الإدارة (④) */
          status: 'proposed',
          createdBy: actorId,
        }
      }),
    })
    const required = items.filter((x) => x.required === true).length
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.plan.edits.propose', entityType: 'cohort', entityId: plan.cohortId,
      meta: { planId, batchId, count: items.length, required },
    })
    return this.forCohort(plan.cohortId)
  }

  /** يسحب المعتمِدُ ما لم يُقرَّر بعد — ملفٌّ رُفع خطأً لا يبقى ينتظر المدرّب */
  async withdraw(actorId: string, planId: string) {
    const plan = await this.prisma.cohortDeliveryPlan.findUnique({ where: { id: planId }, select: { cohortId: true } })
    if (!plan) throw new AuthError('not_found', 'الخطّة غير موجودة', 404)
    const { count } = await this.prisma.planEditSuggestion.updateMany({
      where: { planId, status: { in: ['proposed', 'pending'] } }, data: { status: 'withdrawn', decidedAt: new Date(), decidedBy: actorId },
    })
    if (count > 0) {
      await recordAudit(this.prisma, {
        actorId, action: 'cohort.plan.edits.withdraw', entityType: 'cohort', entityId: plan.cohortId, meta: { planId, count },
      })
    }
    return this.forCohort(plan.cohortId)
  }

  /* ─────────── الإدارة: تعتمد كلَّ بندٍ للمدرّب أو تحذفه (④) ─────────── */

  /** يعتمده للمدرّب (`pending`) أو يحذفه (`dropped`) — والمسوّدةُ وحدَها تُراجَع */
  async review(actorId: string, id: string, approve: boolean) {
    const row = await this.prisma.planEditSuggestion.findUnique({ where: { id }, select: { id: true, cohortId: true, planId: true, kind: true } })
    if (!row) throw new AuthError('not_found', 'هذا التعديلُ غير موجود', 404)
    const done = await this.prisma.planEditSuggestion.updateMany({
      where: { id, status: 'proposed' },
      data: { status: approve ? 'pending' : 'dropped', reviewedBy: actorId, reviewedAt: new Date() },
    })
    if (done.count !== 1) throw new AuthError('edit_reviewed', 'رُوجع هذا التعديلُ من قبل', 409)
    await recordAudit(this.prisma, {
      actorId, action: approve ? 'cohort.plan.edit.approve' : 'cohort.plan.edit.drop', entityType: 'cohort', entityId: row.cohortId,
      meta: { planId: row.planId, suggestionId: id, kind: row.kind },
    })
    return this.forCohort(row.cohortId)
  }

  /** يعتمد كلَّ ما بقي مسوّدةً في الخطّة للمدرّب */
  async reviewAll(actorId: string, planId: string) {
    const plan = await this.prisma.cohortDeliveryPlan.findUnique({ where: { id: planId }, select: { cohortId: true } })
    if (!plan) throw new AuthError('not_found', 'الخطّة غير موجودة', 404)
    const { count } = await this.prisma.planEditSuggestion.updateMany({
      where: { planId, status: 'proposed' }, data: { status: 'pending', reviewedBy: actorId, reviewedAt: new Date() },
    })
    if (count > 0) {
      await recordAudit(this.prisma, {
        actorId, action: 'cohort.plan.edits.approve_all', entityType: 'cohort', entityId: plan.cohortId, meta: { planId, count },
      })
    }
    return this.forCohort(plan.cohortId)
  }

  /* ─────────── القراءة — للبطاقة ولصفحة المدرّب ─────────── */

  /** ما اقتُرح على آخر خطّةٍ للشعبة — بعرضه، وبحال كلّ منتظِرٍ الآن */
  async forCohort(cohortId: string): Promise<PlanEditItem[]> {
    const latest = await this.latestTrainerPlan(cohortId)
    if (!latest) return []
    const rows = await this.prisma.planEditSuggestion.findMany({
      where: { planId: latest.id, status: { not: 'withdrawn' } },
      orderBy: [{ createdAt: 'asc' }, { seq: 'asc' }],
    })
    if (rows.length === 0) return []
    const r = await this.rows(cohortId, latest.content)
    const ctx = this.context(r)
    return rows.map((row) => {
      const edit = row.edit as unknown as PlanEdit
      const before = (row.before ?? null) as EditSnapshot
      let stale = false
      let goneAr: string | null = null
      if (row.status === 'pending' || row.status === 'proposed') {
        const now = this.snapshotNow(edit, r)
        if (!now.ok) goneAr = now.problemAr
        else stale = !sameSnapshot(before, now.value)
      }
      return {
        id: row.id, seq: row.seq, kind: row.kind, step: row.step, required: row.required, reasonAr: row.reasonAr,
        status: row.status as PlanEditStatus, decidedAt: row.decidedAt, reviewedAt: row.reviewedAt, noteAr: row.noteAr,
        view: planEditView(edit, before, ctx), stale, goneAr,
      }
    })
  }

  /** للمدرّب: ما اعتمدته الإدارةُ له وما قرّر فيه — لا مسوّدةٌ ولا محذوفٌ ولا ساقط (④) */
  async forTrainer(userId: string, cohortId: string): Promise<PlanEditItem[]> {
    await this.assertTrainer(userId, cohortId)
    return (await this.forCohort(cohortId)).filter((x) => TRAINER_VISIBLE_EDIT_STATUSES.includes(x.status))
  }

  /* ─────────── المدرّب: يقبل أو يرفض ─────────── */

  private async assertTrainer(userId: string, cohortId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId }, select: { id: true, suspendedAt: true } })
    if (!profile || profile.suspendedAt) throw new AuthError('not_trainer', 'لا ملف مدرب نشطا لهذا الحساب', 403)
    const link = await this.prisma.cohortTrainer.findFirst({ where: { cohortId, profileId: profile.id }, select: { cohortId: true } })
    if (!link) throw new AuthError('not_your_cohort', 'هذه الشعبة ليست مُسنَدةً إليك', 403)
  }

  private async pendingOf(userId: string, id: string) {
    const row = await this.prisma.planEditSuggestion.findUnique({ where: { id } })
    if (!row) throw new AuthError('not_found', 'هذا التعديلُ غير موجود', 404)
    await this.assertTrainer(userId, row.cohortId)
    /* وما لم تعتمده الإدارةُ لا وجودَ له عنده — لا «قُرِّر فيه» ولا غيرُه (④) */
    if (!TRAINER_VISIBLE_EDIT_STATUSES.includes(row.status as PlanEditStatus)) {
      throw new AuthError('not_found', 'هذا التعديلُ غير موجود', 404)
    }
    if (row.status !== 'pending') throw new AuthError('edit_decided', 'قُرِّر في هذا التعديل من قبل', 409)
    return row
  }

  /** يقبله: يُكتب في خطّته بأبوابه هو. و`force` حين تغيّر موضعُه فاختار أن يُكتب فوقه */
  async accept(userId: string, id: string, opts: { force?: boolean } = {}) {
    const row = await this.pendingOf(userId, id)
    const latest = await this.latestTrainerPlan(row.cohortId)
    if (!latest || !(IN_HAND as readonly string[]).includes(latest.status)) {
      throw new AuthError('plan_submitted', 'خطّتك بانتظار الاعتماد — تُقبل التعديلاتُ حين تعود إليك', 409)
    }
    const edit = row.edit as unknown as PlanEdit
    const r = await this.rows(row.cohortId, latest.content)
    const now = this.snapshotNow(edit, r)
    if (!now.ok) throw new AuthError('edit_gone', `لا يقع هذا التعديلُ الآن: ${now.problemAr}. لك أن ترفضه`, 409)
    const stale = !sameSnapshot((row.before ?? null) as EditSnapshot, now.value)
    if (stale && !opts.force) {
      throw new AuthError('edit_stale', 'تغيّر هذا الموضعُ منذ اقتُرح التعديل — عدّلتَه أنت بعده. اقبله فوق ما كتبتَ، أو ارفضه', 409)
    }

    /* يُحجَز قبل أن يُطبَّق — نقرتان معا لا تكتبانه مرّتين — ويُعاد منتظِرا إن سقط تطبيقُه */
    const claimed = await this.prisma.planEditSuggestion.updateMany({
      where: { id, status: 'pending' }, data: { status: 'accepted', decidedAt: new Date(), decidedBy: userId },
    })
    if (claimed.count !== 1) throw new AuthError('edit_decided', 'قُرِّر في هذا التعديل من قبل', 409)
    try {
      await this.apply(userId, row.cohortId, edit, r)
    } catch (e) {
      await this.prisma.planEditSuggestion.update({ where: { id }, data: { status: 'pending', decidedAt: null, decidedBy: null } })
      throw e
    }
    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.plan.edit.accept', entityType: 'cohort', entityId: row.cohortId,
      meta: { planId: row.planId, suggestionId: id, kind: row.kind, ...(stale ? { overwrote: true } : {}) },
    })
    return { status: 'accepted' as const }
  }

  private async apply(userId: string, cohortId: string, edit: PlanEdit, r: Rows) {
    if (editsContent(edit)) {
      const next = applyContentEdit(r.content, edit)
      if (!next.ok) throw new AuthError('edit_gone', next.problemAr, 409)
      await this.plans.savePlan(userId, cohortId, next.value)
      return
    }
    const at = (v: string | null | undefined) => (v == null ? v : new Date(v))
    switch (edit.kind) {
      case 'task_add':
        await this.assessments.createAssessment(userId, {
          cohortId, title: edit.task.title.trim(), type: edit.task.type,
          ...(edit.task.moduleId ? { moduleId: edit.task.moduleId } : {}),
          ...(edit.task.briefAr ? { briefAr: edit.task.briefAr } : {}),
          ...(edit.task.maxScore ? { maxScore: edit.task.maxScore } : {}),
          ...(edit.task.dueAt ? { dueAt: new Date(edit.task.dueAt) } : {}),
        }, { byTrainer: true })
        return
      case 'task_change': {
        const { dueAt, ...rest } = edit.set
        await this.assessments.updateAssessment(userId, edit.assessmentId, {
          ...rest, ...(dueAt !== undefined ? { dueAt: at(dueAt) as Date | null } : {}),
        } as Parameters<AssessmentService['updateAssessment']>[2])
        return
      }
      case 'session_move':
        await this.cohorts.trainerMoveSession(userId, edit.sessionId, { startsAt: new Date(edit.startsAt), endsAt: new Date(edit.endsAt) })
        return
      case 'session_remove':
        await this.cohorts.trainerDeleteSession(userId, edit.sessionId)
        return
    }
  }

  /** يرفضه — وله أن يقول لماذا */
  async reject(userId: string, id: string, noteAr?: string | null) {
    const row = await this.pendingOf(userId, id)
    const note = noteAr?.trim() || null
    const done = await this.prisma.planEditSuggestion.updateMany({
      where: { id, status: 'pending' }, data: { status: 'rejected', decidedAt: new Date(), decidedBy: userId, noteAr: note },
    })
    if (done.count !== 1) throw new AuthError('edit_decided', 'قُرِّر في هذا التعديل من قبل', 409)
    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.plan.edit.reject', entityType: 'cohort', entityId: row.cohortId,
      meta: { planId: row.planId, suggestionId: id, kind: row.kind, ...(note ? { note } : {}) },
    })
    return { status: 'rejected' as const }
  }

  /** يقبل ما ينتظر كلَّه — ما تغيّر موضعُه أو لا يقع يبقى منتظِرا ويُسمّى، لا يُكتب فوقه */
  async acceptAll(userId: string, cohortId: string) {
    await this.assertTrainer(userId, cohortId)
    const pending = (await this.forCohort(cohortId)).filter((x) => x.status === 'pending')
    let accepted = 0
    const skipped: { id: string; titleAr: string; problemAr: string }[] = []
    for (const item of pending) {
      try {
        await this.accept(userId, item.id)
        accepted += 1
      } catch (e) {
        skipped.push({ id: item.id, titleAr: item.view.titleAr, problemAr: e instanceof AuthError ? e.message : 'خطأ غير متوقّع' })
      }
    }
    return { accepted, skipped }
  }
}

/** التعديلُ وحدَه — بلا «لماذا» و«أمطلوب» */
function editOf(item: PlanEditInput): PlanEdit {
  const edit: Record<string, unknown> = { ...item }
  delete edit.required
  delete edit.reasonAr
  return edit as unknown as PlanEdit
}

/** ما يقع عليه البندُ ممّا رُفع قبلُ — مواضعُه، والمهمّةُ الجديدةُ باسمها (فلا موضعَ لها قبل أن تُقبل) */
function openKeysOf(edit: PlanEdit): string[] {
  return edit.kind === 'task_add' ? [`task_new:${edit.task.title.trim()}`] : targetsOf(edit)
}

/** المواضعُ التي يقع عليها تعديل — بندان على موضعٍ واحدٍ لا يُرفعان معا */
function targetsOf(edit: PlanEdit): string[] {
  switch (edit.kind) {
    case 'module': return Object.keys(edit.set).map((f) => `module:${edit.moduleId}:${f}`)
    case 'plan': return Object.keys(edit.set).map((f) => `plan:${f}`)
    case 'resource_add': return [`resource:${edit.resource.title.trim()}|${edit.resource.url?.trim() ?? ''}`]
    case 'resource_change': case 'resource_remove': return [`resource:${edit.match.title.trim()}|${edit.match.url?.trim() ?? ''}`]
    case 'task_add': return []
    case 'task_change': return Object.keys(edit.set).map((f) => `task:${edit.assessmentId}:${f}`)
    case 'session_move': case 'session_remove': return [`session:${edit.sessionId}`]
  }
}
