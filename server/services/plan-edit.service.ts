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
      ببنوده وأسبابها — لا يصل المدرّبَ تعديلٌ لا يقع. وما رُفع قبلُ بعينه ليس ساقطا: يُتجاهَل،
      والأحدثُ يحلّ محلّ ما لم يُقرَّر فيه (٢٦ أكتوبر ٢٠٢٦، `upload`).
   ④ **ولا يصل المدرّبَ ما لم تعتمده الإدارة (١٠ أكتوبر ٢٠٢٦).** المرفوعُ مسوّدةٌ
      (`proposed`) يراجعها من يملك `cohort.plan.edits.review` — المديرُ والمديرُ
      الأكاديميّ — فيعتمد كلَّ بندٍ للمدرّب أو يحذفه. والمدرّبُ لا يرى المسوّدةَ ولا
      يقرّر فيها، ولا تُعدّ في رسالة الردّ.
   ⑤ **ويبقى ما اعتمدته الإدارةُ له بعد اعتماد خطّته — اقتراحا (١٧ أكتوبر ٢٠٢٦).** «when I press اعتمدها, the
      changes still appear for the trainer… from my side it's already معتمدة» (صاحب المنصّة). فيقبله على
      خطّته المعتمدة فيُكتب فيها مباشرةً (`OnApproved`)، أو يرفضه فلا يتغيّر شيء — ولا اعتمادَ ثانٍ.

   والقاعدةُ والعرضُ في `src/application/trainer/plan-edits.ts`. */

import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { readReviewNotes } from '../../src/application/trainer/review-notes'
import { recordAudit } from './audit'
import { AssessmentService } from './assessment.service'
import { CohortService } from './cohort.service'
import { CohortPlanService, resolvePeriod, type PlanStatus, type TrainerPlanContent } from './cohort-plan.service'
import { proposeSchedule, type ScheduleEdit } from '../../src/application/trainer/schedule-proposal'
import { MOVE_UNDONE, moveWhy, type MoveWhy } from '../../src/application/learning/session-move'
import { PLAN_VISIBLE_STATUSES } from '../../src/application/trainer/plan-overlay'
import {
  applyContentEdit, attachmentSnapshot, attachmentsAfter, contentBefore, editsContent, noteItemsFrom, planEditStep, planEditView, rowEditProblem, sameEdit, sameSnapshot, scheduleChainProblem, schedulePlanContent, scheduleSnapshot,
  sessionMoveChainProblem,
  sessionSnapshot, taskSnapshot, type Checked, type EditContext, type EditSnapshot, type EditView, type PlanEdit,
  type PlanEditStatus, type PlanEditsUploadCounts, PLAN_EDITS_MAX, TASK_EDIT_FIELDS, TRAINER_VISIBLE_EDIT_STATUSES,
} from '../../src/application/trainer/plan-edits'

/** بندٌ في الملفّ المرفوع: التعديلُ نفسُه، ولماذا، وأمطلوبٌ هو */
export type PlanEditInput = PlanEdit & { required?: boolean; reasonAr: string; basedOn?: Record<string, unknown> | null }

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
/** خطّتُه معتمدة، والبطاقةُ اعتمدتها الإدارةُ قبل أن يقبلها (⑤) — فتُكتب فيها بلا انتظارٍ ثانٍ.
    `by` من اعتمدها للمدرّب: باسمه يُعتمد لقاءٌ جديدٌ فيها */
interface OnApproved { planId: string; by: string | null }
/** خطّةٌ يُقترح عليها: في يده أو بانتظار القرار */
const OPEN = ['draft', 'submitted', 'changes_requested'] as const
/** ما سحب البندَ (`withdrawnVia`): بيده، أو نسخةٌ أحدثُ رُفعت على موضعه */
const WITHDRAWN_VIA = { manual: 'manual', replace: 'replace' } as const

interface Rows {
  content: TrainerPlanContent
  tasks: { id: string; title: string; type: string; briefAr: string | null; dueAt: Date | null; moduleId: string | null; maxScore: number; attachments: unknown }[]
  sessions: { id: string; title: string; startsAt: Date; endsAt: Date | null; placeholder: boolean; moduleIds: string[]; noteAr: string | null }[]
  /** عنوانُ الشعبة — «قبلُ» بطاقة `cohort_title` */
  cohortTitle: string
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
    const [tasks, sessions, cohort] = await Promise.all([
      this.prisma.cohortAssessment.findMany({
        where: { cohortId },
        select: { id: true, title: true, type: true, briefAr: true, dueAt: true, moduleId: true, maxScore: true, attachments: true },
      }),
      this.prisma.cohortSession.findMany({
        where: { cohortId, status: { not: 'cancelled' } },
        select: { id: true, title: true, startsAt: true, endsAt: true, placeholder: true, moduleIds: true, noteAr: true },
      }),
      this.prisma.cohort.findUnique({ where: { id: cohortId }, select: { title: true } }),
    ])
    const c = (content ?? {}) as TrainerPlanContent
    return { content: { ...c, modules: c.modules ?? [], resources: c.resources ?? [] }, tasks, sessions, cohortTitle: cohort?.title ?? '' }
  }

  /** ما في موضع التعديل الآن — أو لماذا لا موضعَ له */
  private snapshotNow(edit: PlanEdit, r: Rows): Checked<EditSnapshot> {
    if (editsContent(edit)) return contentBefore(edit, r.content)
    const p = rowEditProblem(edit, r.content)
    if (p) return { ok: false, problemAr: p }
    switch (edit.kind) {
      case 'task_add': case 'note': return { ok: true, value: null }
      case 'cohort_title': return { ok: true, value: { titleAr: r.cohortTitle } }
      case 'task_remove': {
        const t = r.tasks.find((x) => x.id === edit.assessmentId)
        if (!t) return { ok: false, problemAr: 'لا مهمّة بهذا المعرّف في هذه الشعبة — لعلّها حذفت' }
        return { ok: true, value: taskSnapshot(t as unknown as Record<string, unknown>, ['title', 'type', 'dueAt', 'maxScore']) }
      }
      case 'session_add': {
        /* ولقاءٌ جديدٌ لا يقع على لقاءٍ قائم — كما لا يقع عليه المنقول */
        const start = Date.parse(edit.session.startsAt)
        const end = Date.parse(edit.session.endsAt)
        const clash = r.sessions.find((x) => x.startsAt.getTime() < end && (x.endsAt ? x.endsAt.getTime() : x.startsAt.getTime() + 2 * 3_600_000) > start)
        if (clash) return { ok: false, problemAr: `يقع اللقاء الجديد على لقاء «${clash.title}» في الوقت نفسه` }
        return { ok: true, value: null }
      }
      case 'session_change': {
        const s = r.sessions.find((x) => x.id === edit.sessionId)
        if (!s) return { ok: false, problemAr: 'لا لقاء بهذا المعرّف في هذه الشعبة — لعلّه حذف' }
        if (s.placeholder) return { ok: false, problemAr: 'هذا موعد تحجزه الإدارة لا لقاء للمدرّب' }
        return { ok: true, value: { title: s.title, noteAr: s.noteAr } }
      }
      case 'schedule': return scheduleSnapshot(edit, r.sessions, r.tasks, r.content)
      case 'task_change': {
        const t = r.tasks.find((x) => x.id === edit.assessmentId)
        if (!t) return { ok: false, problemAr: 'لا مهمّة بهذا المعرّف في هذه الشعبة — لعلّها حذفت' }
        return { ok: true, value: taskSnapshot(t as unknown as Record<string, unknown>, Object.keys(edit.set)) }
      }
      case 'task_attachment': {
        const t = r.tasks.find((x) => x.id === edit.assessmentId)
        if (!t) return { ok: false, problemAr: 'لا مهمّة بهذا المعرّف في هذه الشعبة — لعلّها حذفت' }
        return attachmentSnapshot(t.attachments, edit)
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
    return (await this.propose(actorId, planId, [{ ...r.edit, required: false, reasonAr: r.reasonAr }])).edits
  }

  /* ═══ موعدٌ بلا تعارض — ترسله الإدارةُ من «مواعيد بلا تعارض» (٢٢ أكتوبر ٢٠٢٦، `schedule-clash.ts`) ═══
     الجدولُ نفسُه بسلسلته، لكنّ يومَه وساعتَه اختيرا ليفكّا تعارضا مع دورةٍ قريبة. وإرسالُه من شاشة الفصل هو
     اعتمادُ الإدارة له، فيصل المدرّبَ مباشرةً (`pending`) — ويصل كذلك خطّتَه المعتمَدة، فيُكتب فيها إن قبله (⑤).
     ولا يُرسل فوق جدولٍ مقترحٍ لم يُقرَّر فيه، ولا فوق بندٍ على لقاءاته أو مهامّه. */
  async proposeClashFree(actorId: string, planId: string, edit: ScheduleEdit, reasonAr: string): Promise<void> {
    const open = (await this.prisma.planEditSuggestion.findMany({
      where: { planId, status: { in: ['proposed', 'pending'] } }, select: { edit: true },
    })).map((o) => o.edit as unknown as PlanEdit)
    if (open.some((o) => o.kind === 'schedule')) {
      throw new AuthError('schedule_open', 'عليها جدول مقترح لم يقرر فيه', 409)
    }
    const taken = new Set(open.flatMap(openKeysOf))
    if (openKeysOf(edit).some((k) => taken.has(k))) {
      throw new AuthError('schedule_overlaps', 'على بعض لقاءاتها أو مهامها بند مقترح لم يقرر فيه', 409)
    }
    await this.upload(actorId, planId, [{ ...edit, required: false, reasonAr }], { onApproved: true, reviewed: true })
  }

  /** يرفعه المعتمِد: يُفحص كلُّه، ويُحفظ جديدُه أو يُردّ كلُّه ببنوده — ويُقال ما وقع بالرفع (`upload`) */
  async propose(actorId: string, planId: string, items: readonly PlanEditInput[]): Promise<{ edits: PlanEditItem[] } & PlanEditsUploadCounts> {
    const { cohortId, ...counts } = await this.upload(actorId, planId, items)
    return { edits: await this.forCohort(cohortId), ...counts }
  }

  /* ═══ وما رُفع قبلُ لا يُرفع ثانية، والأحدثُ مكانَ ما لم يُقرَّر فيه (٢٦ أكتوبر ٢٠٢٦) ═══

     قال صاحبُ المنصّة في «خطط تنتظر اعتمادك»: «فقط تحميل ورفع.. باقي الأمور كانت لحلّ مشكلةٍ ظهرت في وقتها».
     وكان الملفُّ يُردّ كلُّه إن وقع بندٌ منه على بندٍ لم يُقرَّر فيه، ويُدلّ على «استبدل المسودات» و«ابدأ من جديد»
     و«اسحب ما لم يقرّر» — ثمّ بُني لما تكرّر «احذف المكرر» و«أعد ما سحبته». فصار الرفعُ يقضي في ذلك وحدَه:

     ① **البطاقةُ نفسُها** (`sameEdit`) على الخطّة تُتجاهَل قبل كلّ فحص — لم يُقرَّر فيها بعد، أو قُضي فيها: قبلها
        المدرّبُ أو رفضها، أو حذفتَها قبل أن تصله. لا تُكتب ثانيةً ولا يُردّ لها الملفّ، فالملفُّ نفسُه يُرفع مرّتين
        بلا أثر. وما سحبتَه بيدك ليس منها: يعود برفع ملفّه (`withdraw`).
     ② **ونسخةٌ أحدثُ على موضعه** تحلّ محلّه: يُسحب القديمُ (`replace`) ويُكتب الجديدُ مسوّدةً، في معاملةٍ واحدة.
        والقديمُ عند المدرّب يغيب عنه كذلك، وتصله الأحدثُ حين تعتمدها — فآخرُ مراجعةٍ هي ما يراه.
     ③ **وما قرّر فيه المدرّبُ** — قبله أو رفضه — لا يُمسّ ولا يحجب: ذلك قرارُه.

     وما يُردّ له الملفُّ كلُّه باقٍ (③ في رأس الملفّ): بندٌ لا يقع، أو بندان فيه على موضعٍ واحد. */
  private async upload(
    actorId: string, planId: string, items: readonly PlanEditInput[],
    opts: { onApproved?: boolean; reviewed?: boolean } = {},
  ): Promise<PlanEditsUploadCounts & { cohortId: string }> {
    const plan = await this.prisma.cohortDeliveryPlan.findUnique({
      where: { id: planId }, select: { id: true, cohortId: true, status: true, trainerId: true, content: true },
    })
    if (!plan || !plan.trainerId) throw new AuthError('not_found', 'الخطّة غير موجودة', 404)
    const allowed: readonly string[] = opts.onApproved ? [...IN_HAND, ...PLAN_VISIBLE_STATUSES] : OPEN
    if (!allowed.includes(plan.status)) {
      throw new AuthError('plan_closed', 'هذه خطّة اعتمدت — التعديلات تقترح على خطّة بانتظار القرار أو في يد مدرّبها', 409)
    }
    if (items.length === 0) throw new AuthError('bad_edits', 'الملفّ بلا تعديلات', 422)
    if (items.length > PLAN_EDITS_MAX) throw new AuthError('bad_edits', `في الملفّ ${items.length} تعديلا — الحدّ ${PLAN_EDITS_MAX}. قسّمه ملفّين`, 422)

    const r = await this.rows(plan.cohortId, plan.content)
    /* بطاقاتُ الخطّة: ما لم يُقرَّر فيه — مسوّدةٌ لم تُعتمد (`proposed`) أو بطاقةٌ عند المدرّب (`pending`) — وما قُضي فيه */
    const cards = (await this.prisma.planEditSuggestion.findMany({
      where: { planId, status: { in: ['proposed', 'pending', 'accepted', 'rejected', 'dropped'] } }, select: { id: true, edit: true, status: true },
    })).map((o) => ({ id: o.id, status: o.status, edit: o.edit as unknown as PlanEdit }))
    const open = cards.filter((o) => o.status === 'proposed' || o.status === 'pending')
    const problems: string[] = []
    /* وبندان على موضعٍ واحدٍ لا يُرفعان معا — ولو كان أحدُهما مرفوعا قبلُ: قبولُ أحدهما يجعل «قبل» الآخر غيرَ ما فيه */
    const seen = new Map<string, number>()
    items.forEach((item, i) => {
      for (const key of targetsOf(editOf(item))) {
        const prior = seen.get(key)
        if (prior !== undefined) problems.push(`البند ${i + 1}: يقع على ما يقع عليه البند ${prior + 1} — اجمعهما بندا واحدا`)
        else seen.set(key, i)
      }
    })
    /* ① والبطاقةُ نفسُها تُتجاهَل قبل فحصها — ما رُفع قبلُ لا يُردّ له الملفّ */
    const fresh = items.map((item, i) => ({ item, i, edit: editOf(item) }))
      .filter((x) => !cards.some((o) => sameEdit(o.edit, x.edit)))
    /* ═══ والكرّاسةُ الجديدةُ ملفُّ هذه الشعبة — رُفع لها وبقيت بايتاتُه (١٢ أكتوبر ٢٠٢٦) ═══
       المفتاحُ في البند نصٌّ؛ فلو قُبل مفتاحٌ لملفّ شعبةٍ أخرى لصار بابا يُقرأ به ملفُّها. والمرفقُ الجديدُ كذلك
       (١٧ أكتوبر ٢٠٢٦، `task_attachment`): يُرفع مع الملفّ من الباب نفسِه (`/edit-files`) */
    const fileOf = (x: PlanEditInput) => (x.kind === 'workbook_replace' || x.kind === 'task_attachment' ? x.file : undefined)
    const wbKeys = fresh.flatMap(({ item }) => (fileOf(item)?.key ? [fileOf(item)!.key] : []))
    const owned = new Set(wbKeys.length === 0 ? [] : (await this.prisma.cohortFile.findMany({
      where: { cohortId: plan.cohortId, purpose: 'workbook', storageKey: { in: wbKeys } }, select: { storageKey: true },
    })).map((f) => f.storageKey))
    fresh.forEach(({ item: x, i }) => {
      if (x.kind === 'workbook_replace' && !owned.has(x.file?.key)) problems.push(`البند ${i + 1}: ملفّ الكرّاسة لم يرفع لهذه الشعبة — ارفعه مع الملفّ دفعة واحدة`)
      if (x.kind === 'task_attachment' && x.file !== undefined && !owned.has(x.file?.key)) problems.push(`البند ${i + 1}: ملفّ المرفق لم يرفع لهذه الشعبة — ارفعه مع الملفّ دفعة واحدة`)
    })
    /* ② وما وقع الجديدُ على موضعه ممّا لم يُقرَّر فيه يحلّ محلَّه */
    const replace = new Set<string>()
    const snaps = fresh.map(({ item, i, edit }) => {
      const snap = this.snapshotNow(edit, r)
      if (!snap.ok) { problems.push(`البند ${i + 1}: ${snap.problemAr}`); return null }
      /* ═══ ولا يُكتب على خطّةٍ تغيّرت بعد أن نُزّلت (١٢ أكتوبر ٢٠٢٦) ═══
         «كيف ننزّل الخطط وهم يعدّلونها بعد اقتراحاتي؟» (صاحب المنصّة). اللقطةُ تُؤخذ لحظةَ الرفع، فبندٌ كُتب
         على تنزيلٍ أقدم كان يأخذ «قبلَه» ممّا كتبه المدرّبُ بعده — ويكتب فوقه إن قُبل. فما يحمل ما كُتب عليه
         (`basedOn`) يُقابَل بالموضع الآن، وما تغيّر يُردّ باسمه ولا يُرفع شيء */
      if (item.basedOn !== undefined && !sameSnapshot(item.basedOn as EditSnapshot, snap.value)) {
        problems.push(`البند ${i + 1}: عدّل المدرب هذا الموضع بعد تنزيل الخطة — نزّلها من جديد واكتب البند على ما فيها الآن`)
      }
      /* ونقلُ لقاءٍ وحدَه لا يكسر ما حوله — وإلّا كُتب جدولا واحدا بسلسلته (`sessionMoveChainProblem`) */
      if (edit.kind === 'session_move') {
        const chain = sessionMoveChainProblem(edit, r.sessions.filter((x) => !x.placeholder), r.tasks)
        if (chain) problems.push(`البند ${i + 1}: نقل هذا اللقاء وحده يمسّ توقيتات أخرى — ${chain}. اكتبه وما يمسّه جدولا واحدا (schedule)`)
      }
      if (edit.kind === 'schedule') {
        const chain = scheduleChainProblem(edit, r.sessions.filter((x) => !x.placeholder), r.tasks)
        if (chain) problems.push(`البند ${i + 1}: الجدول لا يكتمل بسلسلته — ${chain}`)
      }
      const keys = new Set(openKeysOf(edit))
      for (const o of open) if (openKeysOf(o.edit).some((k) => keys.has(k))) replace.add(o.id)
      return snap.value
    })
    if (problems.length) throw new AuthError('bad_edits', `لم يرفع شيء — في الملفّ ما لا يقع:\n${problems.join('\n')}`, 422)

    const repeated = items.length - fresh.length
    if (fresh.length === 0) return { cohortId: plan.cohortId, added: 0, required: 0, repeated, replaced: 0, fromTrainer: 0 }
    const gone = open.filter((o) => replace.has(o.id))
    const batchId = randomUUID()
    const withdrawn = await this.prisma.$transaction(async (tx) => {
      const n = gone.length === 0 ? 0 : (await tx.planEditSuggestion.updateMany({
        where: { id: { in: gone.map((o) => o.id) }, status: { in: ['proposed', 'pending'] } },
        data: { status: 'withdrawn', decidedAt: new Date(), decidedBy: actorId, withdrawnVia: WITHDRAWN_VIA.replace },
      })).count
      await tx.planEditSuggestion.createMany({
        data: fresh.map(({ item, i, edit }, at) => ({
          cohortId: plan.cohortId, planId, batchId, seq: i + 1, kind: edit.kind, step: planEditStep(edit),
          required: item.required === true, reasonAr: item.reasonAr.trim(),
          edit: edit as unknown as Prisma.InputJsonValue,
          before: (snaps[at] ?? undefined) as Prisma.InputJsonValue | undefined,
          /* مسوّدةٌ لا يراها المدرّبُ حتّى تعتمدها الإدارة (④) — إلّا ما اعتمدته وهي ترسله (`reviewed`) */
          status: opts.reviewed ? 'pending' : 'proposed',
          ...(opts.reviewed ? { reviewedBy: actorId, reviewedAt: new Date() } : {}),
          createdBy: actorId,
        })),
      })
      return n
    })
    if (withdrawn > 0) {
      await recordAudit(this.prisma, {
        actorId, action: 'cohort.plan.edits.withdraw', entityType: 'cohort', entityId: plan.cohortId,
        meta: { planId, count: withdrawn, replacedBy: batchId },
      })
    }
    const required = fresh.filter(({ item }) => item.required === true).length
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.plan.edits.propose', entityType: 'cohort', entityId: plan.cohortId,
      meta: { planId, batchId, count: fresh.length, required, ...(repeated > 0 ? { repeated } : {}) },
    })
    return {
      cohortId: plan.cohortId, added: fresh.length, required, repeated,
      replaced: gone.filter((o) => o.status === 'proposed').length,
      fromTrainer: gone.filter((o) => o.status === 'pending').length,
    }
  }

  /** يسحب المعتمِدُ ما لم يُقرَّر بعد — ملفٌّ رُفع خطأً لا يبقى ينتظر المدرّب. ويعود برفع ملفّه ثانية: المسحوبُ
      ليس ممّا لم يُقرَّر فيه، فيُكتب من جديد مسوّداتٍ تراجعها (`upload` ①) */
  async withdraw(actorId: string, planId: string) {
    const plan = await this.prisma.cohortDeliveryPlan.findUnique({ where: { id: planId }, select: { cohortId: true } })
    if (!plan) throw new AuthError('not_found', 'الخطّة غير موجودة', 404)
    const { count } = await this.prisma.planEditSuggestion.updateMany({
      where: { planId, status: { in: ['proposed', 'pending'] } },
      data: { status: 'withdrawn', decidedAt: new Date(), decidedBy: actorId, withdrawnVia: WITHDRAWN_VIA.manual },
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
    const onApproved: OnApproved | null = latest && latest.id === row.planId && (PLAN_VISIBLE_STATUSES as readonly string[]).includes(latest.status)
      ? { planId: latest.id, by: row.reviewedBy }
      : null
    if (!latest || (!onApproved && !(IN_HAND as readonly string[]).includes(latest.status))) {
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
      await this.apply(userId, row.cohortId, edit, r, onApproved, moveWhy('accepted', row.reasonAr))
    } catch (e) {
      await this.prisma.planEditSuggestion.update({ where: { id }, data: { status: 'pending', decidedAt: null, decidedBy: null } })
      throw e
    }
    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.plan.edit.accept', entityType: 'cohort', entityId: row.cohortId,
      meta: {
        planId: row.planId, suggestionId: id, kind: row.kind,
        ...(stale ? { overwrote: true } : {}), ...(onApproved ? { onApprovedPlan: true } : {}),
      },
    })
    return { status: 'accepted' as const }
  }

  /** يكتب محتوى الخطّة: في المعتمدة مباشرةً (⑤)، وإلّا بحفظه هو */
  private writeContent(userId: string, cohortId: string, content: TrainerPlanContent, onApproved: OnApproved | null) {
    return onApproved
      ? this.plans.writeApprovedContent(userId, cohortId, onApproved.planId, content)
      : this.plans.savePlan(userId, cohortId, content)
  }

  /** `why`: سببُ البطاقة بقلم من كتبها — يقرؤه المتعلّمون مع موعد ما تنقله (`session-move.ts`) */
  private async apply(userId: string, cohortId: string, edit: PlanEdit, r: Rows, onApproved: OnApproved | null, why: MoveWhy) {
    const preApproved = onApproved !== null
    if (editsContent(edit)) {
      const next = applyContentEdit(r.content, edit)
      if (!next.ok) throw new AuthError('edit_gone', next.problemAr, 409)
      await this.writeContent(userId, cohortId, next.value, onApproved)
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
        }, { byTrainer: true, preApproved })
        return
      case 'task_change': {
        const { dueAt, ...rest } = edit.set
        await this.assessments.updateAssessment(userId, edit.assessmentId, {
          ...rest, ...(dueAt !== undefined ? { dueAt: at(dueAt) as Date | null } : {}),
        } as Parameters<AssessmentService['updateAssessment']>[2], { preApproved })
        return
      }
      case 'session_move':
        await this.cohorts.trainerMoveSession(userId, edit.sessionId, { startsAt: new Date(edit.startsAt), endsAt: new Date(edit.endsAt) }, { preApproved, why })
        return
      /* ومرفقُ المهمّة بباب تعديلها نفسِه — فبعد أوّل اعتمادٍ طلبٌ ينتظر الإدارة، إلّا على خطّته المعتمدة (⑤) */
      case 'task_attachment': {
        const next = attachmentsAfter(r.tasks.find((x) => x.id === edit.assessmentId)?.attachments, edit)
        if (!next.ok) throw new AuthError('edit_gone', next.problemAr, 409)
        await this.assessments.updateAssessment(userId, edit.assessmentId, {
          attachments: next.value,
        } as Parameters<AssessmentService['updateAssessment']>[2], { preApproved })
        return
      }
      case 'session_remove':
        await this.cohorts.trainerDeleteSession(userId, edit.sessionId)
        return
      /* وبعد الاعتماد حذفُ المنشورة طلبٌ ينتظر الإدارة (`deleteAssessment`) — يُقبل البندُ ويبقى الحذفُ في طابورها.
         إلّا على خطّته المعتمدة (⑤): الإدارةُ اعتمدت الحذفَ في البطاقة، فيُحذف */
      case 'task_remove':
        await this.assessments.deleteAssessment(userId, edit.assessmentId, { preApproved })
        return
      case 'cohort_title':
        await this.plans.updateCohort(userId, cohortId, { title: edit.titleAr.trim() })
        return
      case 'session_add': {
        const added = await this.cohorts.trainerAddSessionWithMeeting(userId, cohortId, {
          title: edit.session.title.trim(), startsAt: new Date(edit.session.startsAt), endsAt: new Date(edit.session.endsAt),
          ...(edit.session.moduleIds?.length ? { moduleIds: edit.session.moduleIds } : {}),
          ...(edit.session.noteAr ? { noteAr: edit.session.noteAr } : {}),
        })
        /* وعلى خطّته المعتمدة يُعتمد باسم من اعتمد البطاقة — بالمسلك الذي تعتمد به الخطّةُ لقاءاتِها: اجتماعُه
           ودعوتُه لمسجَّليه. وإن سقط إنشاءُ الاجتماع بقي منتظِرا عند الإدارة كما يبقى لقاءٌ لم يُنشأ اجتماعُه */
        if (onApproved?.by) {
          await this.cohorts.decideSession(onApproved.by, added.session.id, true, undefined, { quiet: true }).catch(() => undefined)
        }
        return
      }
      case 'session_change':
        await this.cohorts.trainerUpdateSessionDetails(userId, edit.sessionId, edit.set)
        return
      /* والملاحظةُ لا تكتب شيئا — موافقتُه قرارُه، وما تطلبه يعدّله هو في خطوتها */
      case 'note':
        return
      case 'schedule':
        await this.applySchedule(userId, cohortId, edit, r, onApproved, why)
        return
    }
  }

  /* ═══ الجدولُ كلُّه أو لا شيء (١١ أكتوبر ٢٠٢٦) ═══
     «يجب أن يكون التعديلُ كاملا بسلسلة، لكي لا نخرّب بدلَ ما نُصلح» (صاحب المنصّة). فكلُّ لقاءٍ فيه يُفحص
     أوّلا بفحص باب النقل نفسِه (`assertTrainerMove`: موعدُ الشعبة، وتعارضُه مع شعبه الأخرى) — فإن لم يصحّ
     واحدٌ لم يُنقل شيء. ثمّ تُنقل بالباب (واجتماعُها معها)، ثمّ مواعيدُ المهامّ ببابها. وإن سقط شيءٌ بعد
     ذلك لعطبٍ لا يُفحص قبله أُعيد ما نُقل قبله إلى ما كان — فلا يبقى نصفُ جدول. */
  private async applySchedule(userId: string, cohortId: string, edit: Extract<PlanEdit, { kind: 'schedule' }>, r: Rows, onApproved: OnApproved | null, why: MoveWhy) {
    const done: (() => Promise<unknown>)[] = []
    const preApproved = onApproved !== null
    let tell: Parameters<CohortService['tellLearnersScheduleMoved']>[1] | null = null
    /** ما رجع من المنقول إلى مراجعة الإدارة — يُقال في الرسالة الواحدة */
    let pending = 0
    try {
      /* وحدودُ الخطّة أوّلا — آخرُ يومٍ في المدّة ومواعيدُ المحاور (`schedulePlanContent`): حفظُها يمدّ نافذةَ
         الجدولة معها (`savePlan`)، فيصحّ النقلُ بعدها. وتعود الخطّةُ كما كانت إن سقط شيء */
      if (edit.plan) {
        const next = schedulePlanContent(r.content, edit)
        if (!next.ok) throw new AuthError('edit_gone', next.problemAr, 409)
        await this.writeContent(userId, cohortId, next.value, onApproved)
        done.push(() => this.writeContent(userId, cohortId, r.content, onApproved))
      }
      for (const m of edit.moves) {
        await this.cohorts.assertTrainerMove(userId, m.sessionId, { startsAt: new Date(m.startsAt), endsAt: new Date(m.endsAt) })
      }
      /* بهدوء: لا يُخبَر المتعلّمون بكلّ لقاءٍ وحدَه — يُخبَرون بالجدول كلِّه مرّةً بعده (٢٤ أكتوبر ٢٠٢٦) */
      for (const m of edit.moves) {
        const was = r.sessions.find((x) => x.id === m.sessionId)!
        const moved = await this.cohorts.trainerMoveSession(userId, m.sessionId, { startsAt: new Date(m.startsAt), endsAt: new Date(m.endsAt) }, { preApproved, quiet: true, why })
        if (moved.approvalState !== 'approved') pending += 1
        /* والعائدُ إلى موعده لا يُنسب نقلُه إلى سبب البطاقة — سقط الجدولُ فعاد (`MOVE_UNDONE`) */
        done.push(() => this.cohorts.trainerMoveSession(userId, m.sessionId, {
          startsAt: new Date(was.startsAt), ...(was.endsAt ? { endsAt: new Date(was.endsAt) } : {}),
        }, { preApproved, quiet: true, why: MOVE_UNDONE }))
      }
      tell = edit.moves.length === 0 ? null : {
        weekday: edit.weekday, clock: edit.clock, ...(edit.days ? { days: edit.days } : {}), pending,
        firstAt: new Date(Math.min(...edit.moves.map((m) => Date.parse(m.startsAt)))),
      }
      for (const t of edit.tasks) {
        const was = r.tasks.find((x) => x.id === t.assessmentId)!
        await this.assessments.updateAssessment(userId, t.assessmentId, { dueAt: new Date(t.dueAt) } as Parameters<AssessmentService['updateAssessment']>[2], { preApproved })
        done.push(() => this.assessments.updateAssessment(userId, t.assessmentId, { dueAt: was.dueAt } as Parameters<AssessmentService['updateAssessment']>[2], { preApproved }))
      }
    } catch (e) {
      for (const undo of done.reverse()) await undo().catch(() => undefined)
      throw e instanceof AuthError
        ? new AuthError(e.code, `لم ينقل شيء من الجدول — ${e.message}`, e.status)
        : e
    }
    /* وانتقل الجدولُ كلُّه — فيُخبَر متعلّموه مرّةً واحدة، ومعه سببُه */
    if (tell) await this.cohorts.tellLearnersScheduleMoved(cohortId, { ...tell, whyAr: why.learnerAr })
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
  delete edit.basedOn
  return edit as unknown as PlanEdit
}

/** ما يقع عليه البندُ ممّا رُفع قبلُ — مواضعُه، والمهمّةُ الجديدةُ باسمها (فلا موضعَ لها قبل أن تُقبل) */
function openKeysOf(edit: PlanEdit): string[] {
  if (edit.kind === 'task_add') return [`task_new:${edit.task.title.trim()}`]
  if (edit.kind === 'session_add') return [`session_new:${edit.session.startsAt}`]
  return targetsOf(edit)
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
    case 'session_move': return [`session:${edit.sessionId}`]
    /* والحذفُ يقع على اللقاء كلِّه — موعدِه وتفاصيلِه؛ وتعديلُ التفاصيل لا يقع على الموعد */
    case 'session_remove': return [`session:${edit.sessionId}`, `session:${edit.sessionId}:details`]
    case 'session_change': return [`session:${edit.sessionId}:details`]
    case 'session_add': return []
    /* وحذفُ المهمّة يقع على حقولها كلِّها — فلا يُرفع معه تعديلُ واحدٍ منها */
    case 'task_remove': return TASK_EDIT_FIELDS.map((f) => `task:${edit.assessmentId}:${f}`)
    case 'cohort_title': return ['cohort:title']
    case 'workbook_replace': return [`workbook:${edit.moduleId ?? 'course'}`]
    case 'workbook_change': return [
      ...(edit.set.title !== undefined ? [`workbook:${edit.moduleId ?? 'course'}:title`] : []),
      ...(edit.set.parts ?? []).map((p) => `workbook:course:part:${p.moduleId}`),
    ]
    case 'task_attachment': return [`task:${edit.assessmentId}:attachment:${edit.match.title.trim()}`]
    case 'note': return [`note:${edit.step}`]
    case 'schedule': return [
      ...edit.moves.map((m) => `session:${m.sessionId}`),
      ...edit.tasks.map((t) => `task:${t.assessmentId}:dueAt`),
      ...(edit.plan?.endsOn !== undefined ? ['plan:endsOn'] : []),
      ...(edit.plan?.slots ?? []).map((s) => `slot:${[...s.moduleIds].sort().join('+')}`),
    ]
  }
}
