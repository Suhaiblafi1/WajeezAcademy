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
import { Prisma, type PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { readReviewNotes } from '../../src/application/trainer/review-notes'
import { recordAudit } from './audit'
import { AssessmentService } from './assessment.service'
import { CohortService } from './cohort.service'
import { CohortPlanService, resolvePeriod, type PlanStatus, type TrainerPlanContent } from './cohort-plan.service'
import { proposeSchedule } from '../../src/application/trainer/schedule-proposal'
import {
  applyContentEdit, contentBefore, editsContent, noteItemsFrom, planEditStep, planEditView, rowEditProblem, sameSnapshot, scheduleChainProblem, scheduleSnapshot,
  sessionMoveChainProblem,
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
/** بندٌ من هذه جاء بعد المسحوب على موضعه يحجبه أن يعود (`restore`) — والمحذوفُ عمدا منها */
const RESTORE_BLOCKERS: readonly string[] = ['proposed', 'pending', 'accepted', 'rejected', 'dropped']
/** ما لم يأتِ في ملفٍّ رفعه المعتمِد: ملاحظاتُ الردّ، والجدولُ الذي تبنيه المنصّة — فلا يُعدّ «آخرَ ملفّ» ولا يُسحب مكرّرا */
const NOT_A_FILE: readonly string[] = ['note', 'schedule']

interface Rows {
  content: TrainerPlanContent
  tasks: { id: string; title: string; type: string; briefAr: string | null; dueAt: Date | null; moduleId: string | null; maxScore: number }[]
  sessions: { id: string; title: string; startsAt: Date; endsAt: Date | null; placeholder: boolean; moduleIds: string[] }[]
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
        select: { id: true, title: true, type: true, briefAr: true, dueAt: true, moduleId: true, maxScore: true },
      }),
      this.prisma.cohortSession.findMany({
        where: { cohortId, status: { not: 'cancelled' } },
        select: { id: true, title: true, startsAt: true, endsAt: true, placeholder: true, moduleIds: true },
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
      case 'task_add': case 'note': return { ok: true, value: null }
      case 'schedule': return scheduleSnapshot(edit, r.sessions, r.tasks)
      case 'task_change': {
        const t = r.tasks.find((x) => x.id === edit.assessmentId)
        if (!t) return { ok: false, problemAr: 'لا مهمّة بهذا المعرّف في هذه الشعبة — لعلّها حذفت' }
        return { ok: true, value: taskSnapshot(t as unknown as Record<string, unknown>, Object.keys(edit.set)) }
      }
      case 'session_move': case 'session_remove': {
        const s = r.sessions.find((x) => x.id === edit.sessionId)
        if (!s) return { ok: false, problemAr: 'لا لقاء بهذا المعرّف في هذه الشعبة — لعلّه حذف' }
        if (s.placeholder) return { ok: false, problemAr: 'هذا موعد تحجزه الإدارة لا لقاء للمدرّب' }
        return { ok: true, value: sessionSnapshot(s) }
      }
      default: return { ok: false, problemAr: 'نوع تعديل غير معروف' }
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

  /* ═══ جدولٌ ثابتٌ مقترحٌ بسلسلته — تبنيه المنصّة (١١ أكتوبر ٢٠٢٦، `schedule-proposal.ts`) ═══
     من لقاءات الشعبة ومهامّها كما هي الآن، فيولد مسوّدةً (`proposed`) تراها الإدارةُ في بطاقتها وتعتمدها قبل
     أن تصل المدرّب — كأيّ بندٍ مرفوع. وما لا يُقترح يُقال لماذا ولا يُحفظ شيء. */
  async proposeSchedule(actorId: string, planId: string) {
    const plan = await this.prisma.cohortDeliveryPlan.findUnique({
      where: { id: planId },
      select: { id: true, cohortId: true, status: true, trainerId: true, content: true, cohort: { select: { startsAt: true, endsAt: true } } },
    })
    if (!plan || !plan.trainerId) throw new AuthError('not_found', 'الخطّة غير موجودة', 404)
    const [sessions, tasks] = await Promise.all([
      this.prisma.cohortSession.findMany({
        where: { cohortId: plan.cohortId },
        select: { id: true, startsAt: true, endsAt: true, moduleIds: true, status: true, placeholder: true },
      }),
      this.prisma.cohortAssessment.findMany({
        where: { cohortId: plan.cohortId },
        select: { id: true, title: true, type: true, dueAt: true, moduleId: true, briefAr: true, maxScore: true, status: true },
      }),
    ])
    const r = proposeSchedule({
      period: resolvePeriod(plan.content as TrainerPlanContent | null, plan.cohort, plan.status as PlanStatus),
      content: plan.content,
      sessions: sessions.map((s) => ({ ...s, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt?.toISOString() ?? null })),
      tasks: tasks.map((t) => ({ ...t, dueAt: t.dueAt?.toISOString() ?? null })),
    })
    if (!r.ok) throw new AuthError('no_schedule', r.reasonAr, 422)
    /* ولا جدولان معا، ولا جدولٌ فوق بندٍ لم يُقرَّر فيه على لقاءاته أو مهامّه — يُقال بلغة الزرّ لا الملفّ */
    const open = (await this.prisma.planEditSuggestion.findMany({
      where: { planId, status: { in: ['proposed', 'pending'] } }, select: { edit: true },
    })).map((o) => o.edit as unknown as PlanEdit)
    if (open.some((o) => o.kind === 'schedule')) {
      throw new AuthError('schedule_open', 'في البطاقة جدول مقترح لم يقرّر فيه — راجعه أو احذفه قبل أن يجهّز غيره', 409)
    }
    const taken = new Set(open.flatMap(openKeysOf))
    if (openKeysOf(r.edit).some((k) => taken.has(k))) {
      throw new AuthError('schedule_overlaps', 'على بعض هذه اللقاءات أو المهامّ بند مقترح لم يقرّر فيه — قرّر فيه أو احذفه أوّلا، ثمّ جهّز الجدول', 409)
    }
    return this.propose(actorId, planId, [{ ...r.edit, required: false, reasonAr: r.reasonAr }])
  }

  /** يرفعه المعتمِد: يُفحص كلُّه، ويُحفظ كلُّه أو يُردّ كلُّه ببنوده */
  async propose(actorId: string, planId: string, items: readonly PlanEditInput[]) {
    const { cohortId } = await this.upload(actorId, planId, items, 'none')
    return this.forCohort(cohortId)
  }

  /* ═══ ويُرفع ملفٌّ جديدٌ مكانَ مسوّداتٍ لم تُعتمد (١٠ أكتوبر ٢٠٢٦) ═══
     قرارُ صاحب المنصّة: صيغةٌ جديدةٌ لملفّات التعديلات تُرفع مرّةً واحدةً من صندوق الرفع دفعةً،
     والقديمةُ ما زالت مسوّداتٍ عليها. فيُفحص الجديدُ كلُّه أوّلا، ثمّ تُسحب المسوّداتُ ويُحفظ الجديدُ في
     معاملةٍ واحدة: إن رُدّ الملفُّ بقيت المسوّداتُ كما هي. وما اعتُمد للمدرّب (`pending`) لا يُمسّ —
     وبندٌ جديدٌ على موضعه يُردّ كما يُردّ في كلّ رفع. */
  async replaceDrafts(actorId: string, planId: string, items: readonly PlanEditInput[]) {
    const { cohortId, replaced } = await this.upload(actorId, planId, items, 'drafts')
    return { edits: await this.forCohort(cohortId), replacedDrafts: replaced }
  }

  /* ═══ «ابدأ من جديد»: يُسحب كلُّ ما لم يقرّر فيه المدرّب ويُرفع الملفُّ مكانه (١٢ أكتوبر ٢٠٢٦) ═══
     قال صاحبُ المنصّة وقد رُدّت ملفّاتُه لأنّ نسخَها السابقة وصلت المدرّبين: «أريد أن أعيد كلَّ شيءٍ من
     البداية.. اسحب كلَّ شيءٍ وارفق كلَّ شيءٍ من جديد، وساعدني أن أفعل هذا بسهولة». وكان طريقُه بطاقةً
     بطاقة: «اسحب ما لم يقرّر» ثمّ الرفع — تسعٌ وعشرون مرّة. فالاستبدالُ الثالث يسحب المسوّداتِ وما
     وصل المدرّبَ ولم يقرّر فيه معا، ويرفع الجديدَ مكانها، في معاملةٍ واحدة: إن رُدّ الملفُّ لم يُسحب شيء.
     وما قرّر فيه المدرّبُ (قبله أو رفضه) لا يُمسّ — ذلك قرارُه. وما سُحب يُعاد بـ«أعد ما سحبته» ما لم
     يقع على موضعه بندٌ جديد (`restore`). */
  async replaceAll(actorId: string, planId: string, items: readonly PlanEditInput[]) {
    const { cohortId, replaced } = await this.upload(actorId, planId, items, 'all')
    return { edits: await this.forCohort(cohortId), withdrawn: replaced }
  }

  /** `none` يُضاف إلى ما هو قائم · `drafts` مكانَ المسوّدات · `all` مكانَ كلِّ ما لم يقرّر فيه المدرّب */
  private async upload(actorId: string, planId: string, items: readonly PlanEditInput[], replace: 'none' | 'drafts' | 'all') {
    const plan = await this.prisma.cohortDeliveryPlan.findUnique({
      where: { id: planId }, select: { id: true, cohortId: true, status: true, trainerId: true, content: true },
    })
    if (!plan || !plan.trainerId) throw new AuthError('not_found', 'الخطّة غير موجودة', 404)
    if (!(OPEN as readonly string[]).includes(plan.status)) {
      throw new AuthError('plan_closed', 'هذه خطّة اعتمدت — التعديلات تقترح على خطّة بانتظار القرار أو في يد مدرّبها', 409)
    }
    if (items.length === 0) throw new AuthError('bad_edits', 'الملفّ بلا تعديلات', 422)
    if (items.length > PLAN_EDITS_MAX) throw new AuthError('bad_edits', `في الملفّ ${items.length} تعديلا — الحدّ ${PLAN_EDITS_MAX}. قسّمه ملفّين`, 422)

    const r = await this.rows(plan.cohortId, plan.content)
    /* ═══ ولا يُرفع ما رُفع ولم يُقرَّر فيه (١٠ أكتوبر ٢٠٢٦) ═══
       الرفعُ دفعةً واحدةً من «خططٌ تنتظر اعتمادك» يجعل إعادةَ الملفّ نفسِه أيسرَ — فتتكرّر
       بنودُه على المعتمِد ثمّ على المدرّب. فما وقع على موضعِ بندٍ لم يُقرَّر فيه يُردّ،
       كما يُردّ بندان على موضعٍ واحدٍ في ملفٍّ واحد. */
    /* وفي «ابدأ من جديد» لا قائمَ يُحسب: كلُّ ما لم يقرّر فيه يُسحب مع الرفع */
    const open = replace === 'all' ? [] : await this.prisma.planEditSuggestion.findMany({
      where: { planId, status: { in: replace === 'drafts' ? ['pending'] : ['proposed', 'pending'] } }, select: { edit: true, status: true },
    })
    /* ولكلّ موضعٍ حالُ ما عليه: مسوّدةٌ لم تُعتمد، أو بندٌ وصل المدرّب — والعلاجُ غيرُ العلاج */
    const takenBy = new Map<string, string>()
    for (const o of open) {
      for (const k of openKeysOf(o.edit as unknown as PlanEdit)) if (takenBy.get(k) !== 'pending') takenBy.set(k, o.status)
    }
    const taken = new Set(takenBy.keys())
    /* والملفُّ كلُّه مرفوعٌ من قبل — سطرٌ واحدٌ يقول ذلك، لا سطرٌ لكلّ بند */
    if (taken.size > 0 && items.every((item) => openKeysOf(editOf(item)).some((k) => taken.has(k)))) {
      throw new AuthError('edits_already_uploaded', replace === 'drafts'
        ? 'رفع هذا الملفّ قبل واعتمدت بنوده للمدرّب — فلا يستبدل ما اعتمد. اسحبه من بطاقة خطّته أوّلا إن أردت'
        : 'رفع هذا الملفّ قبل ولم يقرّر في بنوده — فلا يرفع مرّتين. وإن أردت رفعه من جديد فاختر استبدال المسوّدات عند الرفع، أو اسحبها من بطاقة خطّته أوّلا', 409)
    }
    const problems: string[] = []
    const onDraft: number[] = []
    const onTrainer: number[] = []
    const seen = new Map<string, number>()
    const snaps = items.map((item, i) => {
      const edit = editOf(item)
      const snap = this.snapshotNow(edit, r)
      if (!snap.ok) { problems.push(`البند ${i + 1}: ${snap.problemAr}`); return null }
      /* ونقلُ لقاءٍ وحدَه لا يكسر ما حوله — وإلّا كُتب جدولا واحدا بسلسلته (`sessionMoveChainProblem`) */
      if (edit.kind === 'session_move') {
        const chain = sessionMoveChainProblem(edit, r.sessions.filter((x) => !x.placeholder), r.tasks)
        if (chain) problems.push(`البند ${i + 1}: نقل هذا اللقاء وحده يمسّ توقيتات أخرى — ${chain}. اكتبه وما يمسّه جدولا واحدا (schedule)`)
      }
      if (edit.kind === 'schedule') {
        const chain = scheduleChainProblem(edit, r.sessions.filter((x) => !x.placeholder), r.tasks)
        if (chain) problems.push(`البند ${i + 1}: الجدول لا يكتمل بسلسلته — ${chain}`)
      }
      /* وبندان على موضعٍ واحدٍ لا يُرفعان معا: قبولُ أحدهما يجعل «قبل» الآخر غيرَ ما فيه */
      for (const key of targetsOf(edit)) {
        const prior = seen.get(key)
        if (prior !== undefined) problems.push(`البند ${i + 1}: يقع على ما يقع عليه البند ${prior + 1} — اجمعهما بندا واحدا`)
        else seen.set(key, i)
      }
      const hits = openKeysOf(edit).map((k) => takenBy.get(k)).filter((x): x is string => x !== undefined)
      if (hits.includes('pending')) onTrainer.push(i + 1)
      else if (hits.length) onDraft.push(i + 1)
      return snap.value
    })
    /* ═══ وما وقع على نسخةٍ سابقةٍ يُقال بسببه — لا سطرٌ واحدٌ يتكرّر لكلّ بند (١٠ أكتوبر ٢٠٢٦) ═══
       رُدّت ملفّاتُ صاحب المنصّة الثمانية بثلاثة عشر سطرا متطابقا لكلّ ملفّ، ولا يُعرف منها
       أهي مسوّداتٌ لم يعتمدها (فيكفي الاستبدال) أم بنودٌ وصلت المدرّبين (فتُسحب أوّلا). */
    if (onDraft.length) problems.push(`${itemsAr(onDraft)}: نسختها السابقة مسوّدة لم تعتمدها بعد — اختر «استبدل المسودات التي لم تعتمدها بعد» وارفع الملفّ من جديد`)
    if (onTrainer.length) problems.push(`${itemsAr(onTrainer)}: نسختها السابقة اعتمدتها فوصلت المدرّب ولم يقرّر فيها بعد — فلا تستبدل. إن أردت الجديدة فاسحب القديمة بـ«اسحب ما لم يقرّر» في بطاقة الخطّة ثمّ ارفع الملفّ`)
    if (problems.length) throw new AuthError('bad_edits', `لم يرفع شيء — في الملفّ ما لا يقع:\n${problems.join('\n')}`, 422)

    const batchId = randomUUID()
    const replaced = await this.prisma.$transaction(async (tx) => {
      const gone = replace === 'none' ? 0
        : (await tx.planEditSuggestion.updateMany({
          where: { planId, status: { in: replace === 'all' ? ['proposed', 'pending'] : ['proposed'] } },
          data: { status: 'withdrawn', decidedAt: new Date(), decidedBy: actorId },
        })).count
      await tx.planEditSuggestion.createMany({
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
      return gone
    })
    if (replaced > 0) {
      await recordAudit(this.prisma, {
        actorId, action: 'cohort.plan.edits.withdraw', entityType: 'cohort', entityId: plan.cohortId,
        meta: { planId, count: replaced, replacedBy: batchId },
      })
    }
    const required = items.filter((x) => x.required === true).length
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.plan.edits.propose', entityType: 'cohort', entityId: plan.cohortId,
      meta: { planId, batchId, count: items.length, required },
    })
    return { cohortId: plan.cohortId, replaced }
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

  /* ═══ وما سُحب يُعاد كما كان — «أعِد ما سحبته» (١٢ أكتوبر ٢٠٢٦) ═══

     سحب صاحبُ المنصّة تعديلاتِ خطّةٍ بـ«اسحب ما لم يقرّر» ثمّ سأل: «أين التعديلات؟ كانت موجودةً
     وأعتقد أنّي سحبتها.. كيف أعيدها؟». ولم يكن لها بابُ رجعة: `withdrawn` تخفى من البطاقة ومن المدرّب.
     فاختار زرّا يعيدها كما كانت.

     ① **كما كانت**: ما اعتمده للمدرّب (`reviewedAt` مكتوب) يعود `pending`، والمسوّدةُ مسوّدة.
     ② **ولا يعود ما جاء بعده على موضعه بندٌ** — مسوّدةٌ أو بندٌ عند المدرّب أو ما قرّر فيه أو ما حذفه
        المعتمِدُ عمدا (`dropped`): فملفٌّ رُفع ثانيةً بعد السحب لا يتكرّر، ومسوّدةٌ استُبدلت لا تعود
        فوق بديلها. وما سُحب مرّتين على موضعٍ واحدٍ يعود أحدثُه.
     ③ **وعلى خطّةٍ مفتوحةٍ وحدَها** — المعتمَدةُ سقط ما عليها (`lapsed`). */
  private async restorable(planId: string) {
    const rows = await this.prisma.planEditSuggestion.findMany({
      where: { planId },
      select: { id: true, status: true, edit: true, reviewedAt: true },
      orderBy: [{ createdAt: 'desc' }, { seq: 'desc' }],
    })
    /* من الأحدث إلى الأقدم: ما يحجب موضعا هو ما جاء **بعد** المسحوب — رفعٌ جديدٌ أو حذفٌ أو قرار.
       وما كان قبله لا يحجبه: مسوّدةٌ حذفها المعتمِدُ ثمّ رفع غيرَها وسحبها، تعود الأخيرة */
    const taken = new Set<string>()
    const take: { id: string; toTrainer: boolean }[] = []
    let skipped = 0
    for (const r of rows) {
      const keys = openKeysOf(r.edit as unknown as PlanEdit)
      if (RESTORE_BLOCKERS.includes(r.status)) { for (const k of keys) taken.add(k); continue }
      if (r.status !== 'withdrawn') continue
      if (keys.some((k) => taken.has(k))) { skipped++; continue }
      for (const k of keys) taken.add(k)
      take.push({ id: r.id, toTrainer: r.reviewedAt !== null })
    }
    return { take, skipped }
  }

  /** كم يعود لو ضُغط «أعِد ما سحبته» — للزرّ وعددِه. ومعه كم يُسحب بـ«احذف المكرر» (`older`) */
  async withdrawnFor(cohortId: string) {
    const latest = await this.latestTrainerPlan(cohortId)
    if (!latest || !(OPEN as readonly string[]).includes(latest.status)) return { planId: latest?.id ?? null, count: 0, skipped: 0, older: 0 }
    const { take, skipped } = await this.restorable(latest.id)
    return { planId: latest.id, count: take.length, skipped, older: (await this.olderCopies(latest.id)).length }
  }

  /* ═══ «احذف المكرر» — يبقى آخرُ ملفٍّ رُفع، ويُسحب ما بقي من الأقدم (١٢ أكتوبر ٢٠٢٦) ═══

     رفع صاحبُ المنصّة الملفَّ الجديد ثمّ ضغط «أعد ما سحبته»، فعادت بنودٌ من رفعاتٍ سابقةٍ لم يقع عليها
     الجديد — وصارت خطّةٌ بخمسين بندا عند مدرّبها وملفُّها خمسةَ عشر. وقال: «give me a button to remove
     duplication». فالمكرّرُ **ما لم يقرّر فيه المدرّبُ من ملفٍّ أقدمَ من آخر ملفٍّ رُفع على الخطّة**:
     ① وآخرُ ملفٍّ أحدثُ رفعةٍ بقي منها بند — قرّر فيه المدرّبُ أو لم يقرّر. والمسحوبةُ كلُّها والمحذوفةُ
        ليست «آخرَ ملفّ».
     ② وملاحظاتُ الردّ والجدولُ الذي تبنيه المنصّة (`NOT_A_FILE`) ليست ملفّا: لا تُعدّ ولا تُسحب.
     ③ والسحبُ سحب: ما قرّر فيه المدرّبُ لا يُمسّ، والمسحوبُ يعود بـ«أعد ما سحبته». */
  private async olderCopies(planId: string): Promise<string[]> {
    const rows = await this.prisma.planEditSuggestion.findMany({
      where: { planId, kind: { notIn: [...NOT_A_FILE] }, status: { in: ['proposed', 'pending', 'accepted', 'rejected'] } },
      select: { id: true, batchId: true, status: true },
      orderBy: [{ createdAt: 'desc' }, { seq: 'desc' }],
    })
    const latest = rows[0]?.batchId
    return rows.filter((r) => r.batchId !== latest && (r.status === 'proposed' || r.status === 'pending')).map((r) => r.id)
  }

  async keepLatest(actorId: string, planId: string) {
    const plan = await this.prisma.cohortDeliveryPlan.findUnique({ where: { id: planId }, select: { cohortId: true, status: true } })
    if (!plan) throw new AuthError('not_found', 'الخطّة غير موجودة', 404)
    if (!(OPEN as readonly string[]).includes(plan.status)) {
      throw new AuthError('plan_closed', 'اعتمدت هذه الخطّة — لا يسحب منها شيء', 409)
    }
    const ids = await this.olderCopies(planId)
    if (ids.length === 0) throw new AuthError('no_duplicates', 'لا مكرر على هذه الخطة — كل ما لم يقرر فيه من آخر ملف رفعته', 409)
    const { count } = await this.prisma.planEditSuggestion.updateMany({
      where: { id: { in: ids }, status: { in: ['proposed', 'pending'] } },
      data: { status: 'withdrawn', decidedAt: new Date(), decidedBy: actorId },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.plan.edits.withdraw', entityType: 'cohort', entityId: plan.cohortId,
      meta: { planId, count, older: true },
    })
    return { edits: await this.forCohort(plan.cohortId), withdrawn: count }
  }

  async restore(actorId: string, planId: string) {
    const plan = await this.prisma.cohortDeliveryPlan.findUnique({ where: { id: planId }, select: { cohortId: true, status: true } })
    if (!plan) throw new AuthError('not_found', 'الخطّة غير موجودة', 404)
    if (!(OPEN as readonly string[]).includes(plan.status)) {
      throw new AuthError('plan_closed', 'اعتمدت هذه الخطّة — ما سحب منها لا يعود عليها', 409)
    }
    const { take, skipped } = await this.restorable(planId)
    if (take.length === 0) {
      throw new AuthError('nothing_withdrawn', skipped > 0
        ? 'ما سحب على مواضعه بنود أحدث — فلا يعود فوقها'
        : 'لا شيء مسحوب على هذه الخطّة', 409)
    }
    const back = (toTrainer: boolean) => take.filter((x) => x.toTrainer === toTrainer).map((x) => x.id)
    await this.prisma.$transaction([
      this.prisma.planEditSuggestion.updateMany({
        where: { id: { in: back(true) }, status: 'withdrawn' }, data: { status: 'pending', decidedAt: null, decidedBy: null },
      }),
      this.prisma.planEditSuggestion.updateMany({
        where: { id: { in: back(false) }, status: 'withdrawn' }, data: { status: 'proposed', decidedAt: null, decidedBy: null },
      }),
    ])
    const toTrainer = back(true).length
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.plan.edits.restore', entityType: 'cohort', entityId: plan.cohortId,
      meta: { planId, count: take.length, toTrainer, drafts: take.length - toTrainer, skipped },
    })
    return { edits: await this.forCohort(plan.cohortId), restored: take.length, toTrainer, skipped }
  }

  /* ─────────── الإدارة: تعتمد كلَّ بندٍ للمدرّب أو تحذفه (④) ─────────── */

  /** يعتمده للمدرّب (`pending`) أو يحذفه (`dropped`) — والمسوّدةُ وحدَها تُراجَع */
  async review(actorId: string, id: string, approve: boolean) {
    const row = await this.prisma.planEditSuggestion.findUnique({ where: { id }, select: { id: true, cohortId: true, planId: true, kind: true } })
    if (!row) throw new AuthError('not_found', 'هذا التعديل غير موجود', 404)
    const done = await this.prisma.planEditSuggestion.updateMany({
      where: { id, status: 'proposed' },
      data: { status: approve ? 'pending' : 'dropped', reviewedBy: actorId, reviewedAt: new Date() },
    })
    if (done.count !== 1) throw new AuthError('edit_reviewed', 'روجع هذا التعديل من قبل', 409)
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

  /* ─────────── ملاحظاتُ الردّ بنودا (١١ أكتوبر ٢٠٢٦، `note` في `plan-edits.ts`) ─────────── */

  /** ملاحظاتُ الردّ الأخير بنودٌ في «المراجعة» — تولد مرّةً لكلّ ردّ، معتمَدةً (`pending`) فهي من
      الإدارة أصلا. ويُنادى من الردّ نفسِه، ومن القراءة لخطّةٍ رُدّت قبل هذا. والقفلُ يمنع قراءتين معا
      من أن تولّدها مرّتين. */
  async ensureNoteItems(planId: string): Promise<number> {
    const plan = await this.prisma.cohortDeliveryPlan.findUnique({
      where: { id: planId },
      select: { id: true, cohortId: true, status: true, reviewedAt: true, reviewedBy: true, reviewerNotes: true, reviewerNote: true },
    })
    if (!plan || plan.status !== 'changes_requested' || !plan.reviewedAt || !plan.reviewedBy) return 0
    const items = noteItemsFrom(readReviewNotes(plan))
    if (items.length === 0) return 0
    const { reviewedAt, reviewedBy } = plan
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${planId}))`
      const had = await tx.planEditSuggestion.count({ where: { planId, kind: 'note', createdAt: { gte: reviewedAt } } })
      if (had > 0) return 0
      const batchId = randomUUID()
      const at = new Date()
      await tx.planEditSuggestion.createMany({
        data: items.map((x, i) => ({
          cohortId: plan.cohortId, planId, batchId, seq: i + 1, kind: 'note', step: x.edit.step, required: x.required,
          reasonAr: '', edit: x.edit as unknown as Prisma.InputJsonValue, before: Prisma.DbNull,
          status: 'pending', reviewedBy, reviewedAt, createdBy: reviewedBy, createdAt: at,
        })),
      })
      return items.length
    })
  }

  /* ─────────── القراءة — للبطاقة ولصفحة المدرّب ─────────── */

  /** ما اقتُرح على آخر خطّةٍ للشعبة — بعرضه، وبحال كلّ منتظِرٍ الآن */
  async forCohort(cohortId: string): Promise<PlanEditItem[]> {
    const latest = await this.latestTrainerPlan(cohortId)
    if (!latest) return []
    /* وخطّةٌ رُدّت قبل أن تصير الملاحظاتُ بنودا تُستدرَك بنودُها هنا — مرّةً (`ensureNoteItems`).
       والقراءةُ لا تسقط إن تعذّر: تُعرض بلا البنود الجديدة */
    if (latest.status === 'changes_requested') await this.ensureNoteItems(latest.id).catch(() => undefined)
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
    if (!link) throw new AuthError('not_your_cohort', 'هذه الشعبة ليست مسندة إليك', 403)
  }

  private async pendingOf(userId: string, id: string) {
    const row = await this.prisma.planEditSuggestion.findUnique({ where: { id } })
    if (!row) throw new AuthError('not_found', 'هذا التعديل غير موجود', 404)
    await this.assertTrainer(userId, row.cohortId)
    /* وما لم تعتمده الإدارةُ لا وجودَ له عنده — لا «قُرِّر فيه» ولا غيرُه (④) */
    if (!TRAINER_VISIBLE_EDIT_STATUSES.includes(row.status as PlanEditStatus)) {
      throw new AuthError('not_found', 'هذا التعديل غير موجود', 404)
    }
    if (row.status !== 'pending') throw new AuthError('edit_decided', 'قرّر في هذا التعديل من قبل', 409)
    return row
  }

  /** يقبله: يُكتب في خطّته بأبوابه هو. و`force` حين تغيّر موضعُه فاختار أن يُكتب فوقه */
  async accept(userId: string, id: string, opts: { force?: boolean } = {}) {
    const row = await this.pendingOf(userId, id)
    const latest = await this.latestTrainerPlan(row.cohortId)
    if (!latest || !(IN_HAND as readonly string[]).includes(latest.status)) {
      throw new AuthError('plan_submitted', 'خطّتك بانتظار الاعتماد — تقبل التعديلات حين تعود إليك', 409)
    }
    const edit = row.edit as unknown as PlanEdit
    const r = await this.rows(row.cohortId, latest.content)
    const now = this.snapshotNow(edit, r)
    if (!now.ok) throw new AuthError('edit_gone', `لا يقع هذا التعديل الآن: ${now.problemAr}. لك أن ترفضه`, 409)
    const stale = !sameSnapshot((row.before ?? null) as EditSnapshot, now.value)
    if (stale && !opts.force) {
      throw new AuthError('edit_stale', 'تغيّر هذا الموضع منذ اقترح التعديل — عدّلته أنت بعده. اقبله فوق ما كتبت، أو ارفضه', 409)
    }

    /* يُحجَز قبل أن يُطبَّق — نقرتان معا لا تكتبانه مرّتين — ويُعاد منتظِرا إن سقط تطبيقُه */
    const claimed = await this.prisma.planEditSuggestion.updateMany({
      where: { id, status: 'pending' }, data: { status: 'accepted', decidedAt: new Date(), decidedBy: userId },
    })
    if (claimed.count !== 1) throw new AuthError('edit_decided', 'قرّر في هذا التعديل من قبل', 409)
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
      /* والملاحظةُ لا تكتب شيئا — موافقتُه قرارُه، وما تطلبه يعدّله هو في خطوتها */
      case 'note':
        return
      case 'schedule':
        await this.applySchedule(userId, edit, r)
        return
    }
  }

  /* ═══ الجدولُ كلُّه أو لا شيء (١١ أكتوبر ٢٠٢٦) ═══
     «يجب أن يكون التعديلُ كاملا بسلسلة، لكي لا نخرّب بدلَ ما نُصلح» (صاحب المنصّة). فكلُّ لقاءٍ فيه يُفحص
     أوّلا بفحص باب النقل نفسِه (`assertTrainerMove`: موعدُ الشعبة، وتعارضُه مع شعبه الأخرى) — فإن لم يصحّ
     واحدٌ لم يُنقل شيء. ثمّ تُنقل بالباب (واجتماعُها معها)، ثمّ مواعيدُ المهامّ ببابها. وإن سقط شيءٌ بعد
     ذلك لعطبٍ لا يُفحص قبله أُعيد ما نُقل قبله إلى ما كان — فلا يبقى نصفُ جدول. */
  private async applySchedule(userId: string, edit: Extract<PlanEdit, { kind: 'schedule' }>, r: Rows) {
    const done: (() => Promise<unknown>)[] = []
    try {
      for (const m of edit.moves) {
        await this.cohorts.assertTrainerMove(userId, m.sessionId, { startsAt: new Date(m.startsAt), endsAt: new Date(m.endsAt) })
      }
      for (const m of edit.moves) {
        const was = r.sessions.find((x) => x.id === m.sessionId)!
        await this.cohorts.trainerMoveSession(userId, m.sessionId, { startsAt: new Date(m.startsAt), endsAt: new Date(m.endsAt) })
        done.push(() => this.cohorts.trainerMoveSession(userId, m.sessionId, {
          startsAt: new Date(was.startsAt), ...(was.endsAt ? { endsAt: new Date(was.endsAt) } : {}),
        }))
      }
      for (const t of edit.tasks) {
        const was = r.tasks.find((x) => x.id === t.assessmentId)!
        await this.assessments.updateAssessment(userId, t.assessmentId, { dueAt: new Date(t.dueAt) } as Parameters<AssessmentService['updateAssessment']>[2])
        done.push(() => this.assessments.updateAssessment(userId, t.assessmentId, { dueAt: was.dueAt } as Parameters<AssessmentService['updateAssessment']>[2]))
      }
    } catch (e) {
      for (const undo of done.reverse()) await undo().catch(() => undefined)
      throw e instanceof AuthError
        ? new AuthError(e.code, `لم ينقل شيء من الجدول — ${e.message}`, e.status)
        : e
    }
  }

  /** يرفضه — وله أن يقول لماذا */
  async reject(userId: string, id: string, noteAr?: string | null) {
    const row = await this.pendingOf(userId, id)
    const note = noteAr?.trim() || null
    const done = await this.prisma.planEditSuggestion.updateMany({
      where: { id, status: 'pending' }, data: { status: 'rejected', decidedAt: new Date(), decidedBy: userId, noteAr: note },
    })
    if (done.count !== 1) throw new AuthError('edit_decided', 'قرّر في هذا التعديل من قبل', 409)
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
/** «البند 3» أو «البنود 1، 2، 5» — أرقامُ الملفّ كما يراها رافعُه */
function itemsAr(nums: readonly number[]): string {
  return nums.length === 1 ? `البند ${nums[0]}` : `البنود ${nums.join('، ')}`
}

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
    case 'note': return [`note:${edit.step}`]
    case 'schedule': return [
      ...edit.moves.map((m) => `session:${m.sessionId}`),
      ...edit.tasks.map((t) => `task:${t.assessmentId}:dueAt`),
    ]
  }
}
