/* ملفُّ قراراتِ دوراتِ المدرّبين — يُعرض قبل أن يُطبَّق، ولا يُطبَّق مرّتين.

   ═══ السؤالُ الذي وُضع له (٢٩ سبتمبر ٢٠٢٦) ═══

   راجع صاحبُ المنصّة اقتراحاتِ المدرّبين المقبولين بندا بندا — أنسخةٌ من رمزٍ
   قائمٍ هي أم دورةٌ جديدة، أم يُسأل صاحبُها — وقرّر تأهيلَ كلٍّ منهم لما
   يدرّس. فخرجت عشراتُ القرارات على عشرين مدرّبا، وكلُّ قرارٍ زرٌّ في شاشة
   التصنيف أو شاشة الإسناد. وطلبُه: ألّا يضغطها واحدا واحدا.

   فتُكتب القراراتُ في ملفّ، ويُرفع الملفُّ في شاشة التصنيف: تُعرض خطواتُه
   كلُّها بأحوالها — «ستُطبَّق» · «طُبّقت من قبل» · «لا تُطبَّق» وسببُها —
   ثمّ تُطبَّق بنقرة. وكلُّ خطوةٍ تمرّ من **باب زرّها نفسِه** (الخدمةُ التي
   يناديها الزرّ)، فيُكتب أثرُها ويُشعَر صاحبُها كما لو ضُغط الزرّ. وهذا
   الملفُّ يقرأ الملفَّ ويرسم الخطوات؛ والتنفيذُ في
   `server/services/course-decisions.service.ts`.

   ═══ وقراراتٌ مكتوبةٌ كيلا تُخمَّن ═══

   · **وقراراتُ المدرّب الواحد تُطبَّق معا أو تُترك معا.** تأهيلُه وربطُ
     اقتراحاته وحالُه قرارٌ واحدٌ فيه: من رأى في المعاينة ربطا سيقع وتأهيلا
     لن يقع ثمّ طبّق، لم يطبّق ما قرّره. **ولا يمسك مدرّبٌ غيرَه**: ورقةٌ
     تغيّرت عند واحدٍ من عشرين لا تؤخّر تسعةَ عشر — يُطبَّق ما سلم، ويبقى هو
     كما كان حتّى يُصلَح بندُه في الملفّ.
   · **وما طُبّق يُعرف فلا يُعاد.** كلُّ خطوةٍ تُقاس على القاعدة قبل أن تُفعل:
     المربوطُ بالرمز نفسِه «طُبّق من قبل». فرفعُ الملفّ مرّتين لا يضاعف شيئا،
     ومن انقطع تطبيقُه في منتصفه رفعه ثانيةً فأكمل من حيث وقف.
   · **وقرارٌ قائمٌ غيرُ ما في الملفّ يُحترم.** اقتراحٌ بُتّ فيه بغير ما في الملفّ
     — رُبط برمزٍ آخر أو رُفض — «لا يُطبَّق»: الملفُّ لا يكتب فوق قرارِ إنسان،
     ومن أراد نقضَه نقضه في شاشته ثمّ رفع الملفّ.
   · **والاسمُ يُطابَق مع المرجع.** مرجعٌ خاطئٌ برقمٍ يقع على مدرّبٍ آخر؛ والاسمُ
     معه يمسك ذلك قبل أن يُربط اقتراحُ أحدٍ باسم غيره.
   · **والترتيبُ للمدرّب الواحد:** الاقتراحاتُ الجديدةُ وتصحيحُ نصوصها أوّلا،
     ثمّ التأهيل، ثمّ القرارات، ثمّ حالُه. والتأهيلُ قبل الربط بقصد: الربطُ
     يفتح مهمّةَ «أهِّله لها» — ولا معنى لمهمّةٍ أُنجز ما فيها قبل أن تُفتح.
     وحالُه آخرا: الموقوفُ لا يُؤهَّل. */

import { normalizeAr } from '../text/search-ar'

export const DECISIONS_KIND = 'wajeez.trainer-course-decisions'
export const DECISIONS_VERSION = 1

/** قراراتُ الطابور الأربعة — أبوابُ شاشة التصنيف نفسُها */
export const PROPOSAL_VERDICTS = ['link', 'became_course', 'ask', 'reject'] as const
export type ProposalVerdict = (typeof PROPOSAL_VERDICTS)[number]

export const TRAINER_STATUS_ACTIONS = ['withdraw', 'suspend'] as const
export type TrainerStatusAction = (typeof TRAINER_STATUS_ACTIONS)[number]

/** بندٌ في الطابور: اقتراحٌ قائمٌ بمعرّفه، أو جديدٌ بعنوانه */
export interface ProposalEntry {
  /** `null` = اقتراحٌ جديدٌ يُنشأ في الطابور بعنوانه — كفكرةٍ كُتبت في فقرةٍ حرّة */
  proposalId: string | null
  /** للقائم: العنوانُ بعد تصحيحه — وللجديد: عنوانُه */
  titleAr: string | null
  summaryAr: string | null
  verdict: ProposalVerdict | null
  courseId: string | null
  questionAr: string | null
  noteAr: string | null
}

export interface TrainerEntry {
  reference: string
  fullName: string
  proposals: ProposalEntry[]
  /** رموزُ الدورات التي يُؤهَّل لها — ويشمل ما اختاره في طلبه فينتظر قرارا */
  qualify: string[]
  status: TrainerStatusAction | null
  statusNoteAr: string | null
}

export interface DecisionsFile {
  titleAr: string
  trainers: TrainerEntry[]
}

export type ParseResult = { ok: true; file: DecisionsFile } | { ok: false; errorsAr: string[] }

const TEXT_MAX = 2000
const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

/** نصٌّ اختياريّ: غائبٌ أو `null` أو نصّ — وما سواه خطأ */
function optText(o: Record<string, unknown>, k: string, where: string, errs: string[]): string | null {
  const v = o[k]
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') {
    errs.push(`${where}: «${k}» ليس نصّا`)
    return null
  }
  const t = v.trim()
  if (t.length > TEXT_MAX) errs.push(`${where}: «${k}» أطولُ من ${TEXT_MAX} حرف`)
  return t || null
}

/** يقرأ الملفَّ ويردّ أخطاءه كلَّها معا — لا أوّلَها وحدَه، فيُصلَح مرّةً لا مرّات */
export function parseDecisionsFile(raw: unknown): ParseResult {
  const errs: string[] = []
  if (!isObj(raw)) return { ok: false, errorsAr: ['الملفُّ ليس كائنَ JSON'] }
  if (raw.kind !== DECISIONS_KIND) {
    return { ok: false, errorsAr: [`ليس ملفَّ قراراتِ دورات — «kind» يجب أن يكون «${DECISIONS_KIND}»`] }
  }
  if (raw.version !== DECISIONS_VERSION) {
    return { ok: false, errorsAr: [`إصدارُ الملفّ «${String(raw.version)}» غيرُ مقروء — المقروءُ ${DECISIONS_VERSION}`] }
  }
  const titleAr = optText(raw, 'titleAr', 'الملفّ', errs) ?? 'ملفُّ قرارات'
  if (!Array.isArray(raw.trainers) || raw.trainers.length === 0) {
    return { ok: false, errorsAr: ['لا مدرّبين في الملفّ («trainers» فارغة)'] }
  }

  const refs = new Set<string>()
  const trainers: TrainerEntry[] = []
  raw.trainers.forEach((t: unknown, i: number) => {
    const at = `المدرّب ${i + 1}`
    if (!isObj(t)) { errs.push(`${at}: ليس كائنا`); return }
    const reference = typeof t.reference === 'string' ? t.reference.trim() : ''
    const fullName = typeof t.fullName === 'string' ? t.fullName.trim() : ''
    if (!reference) errs.push(`${at}: بلا «reference»`)
    if (!fullName) errs.push(`${at}: بلا «fullName» — الاسمُ يُطابَق مع المرجع`)
    const where = reference || at
    if (reference && refs.has(reference)) errs.push(`${where}: مكرَّرٌ في الملفّ — تُجمع قراراتُه في بندٍ واحد`)
    refs.add(reference)

    const proposals: ProposalEntry[] = []
    const seenIds = new Set<string>()
    const seenTitles = new Set<string>()
    const rawProposals = t.proposals === undefined ? [] : t.proposals
    if (!Array.isArray(rawProposals)) errs.push(`${where}: «proposals» ليست قائمة`)
    else rawProposals.forEach((p: unknown, j: number) => {
      const pat = `${where} · البند ${j + 1}`
      if (!isObj(p)) { errs.push(`${pat}: ليس كائنا`); return }
      const proposalId = optText(p, 'proposalId', pat, errs)
      const entry: ProposalEntry = {
        proposalId,
        titleAr: optText(p, 'titleAr', pat, errs),
        summaryAr: optText(p, 'summaryAr', pat, errs),
        verdict: null,
        courseId: optText(p, 'courseId', pat, errs),
        questionAr: optText(p, 'questionAr', pat, errs),
        noteAr: optText(p, 'noteAr', pat, errs),
      }
      /* القرارُ المجهولُ خطأٌ واحدٌ يُسمّى — لا يُقرأ «بندا بلا قرار» فيُقال خطآن */
      const verdictGiven = p.verdict !== undefined && p.verdict !== null
      if (verdictGiven) {
        if (!(PROPOSAL_VERDICTS as readonly unknown[]).includes(p.verdict)) {
          errs.push(`${pat}: قرارٌ مجهول «${String(p.verdict)}» — المعروف: ${PROPOSAL_VERDICTS.join(' · ')}`)
        } else entry.verdict = p.verdict as ProposalVerdict
      }
      if (entry.titleAr !== null && entry.titleAr.length < 3) errs.push(`${pat}: العنوانُ ثلاثةُ أحرفٍ فأكثر`)
      if (proposalId) {
        if (seenIds.has(proposalId)) errs.push(`${pat}: الاقتراحُ نفسُه مكرَّر`)
        seenIds.add(proposalId)
        if (entry.titleAr === null && entry.summaryAr === null && !verdictGiven) {
          errs.push(`${pat}: بندٌ لا يطلب شيئا`)
        }
      } else if (!entry.titleAr) {
        errs.push(`${pat}: اقتراحٌ جديدٌ بلا عنوان`)
      } else {
        const k = normalizeAr(entry.titleAr)
        if (seenTitles.has(k)) errs.push(`${pat}: اقتراحٌ جديدٌ مكرَّرُ العنوان`)
        seenTitles.add(k)
      }
      if ((entry.verdict === 'link' || entry.verdict === 'became_course') && !entry.courseId) {
        errs.push(`${pat}: «${entry.verdict}» بلا «courseId»`)
      }
      if (entry.verdict === 'ask' && (entry.questionAr ?? '').length < 5) {
        errs.push(`${pat}: السؤالُ خمسةُ أحرفٍ فأكثر — سطرٌ غامضٌ يُعيد الاقتراحَ كما هو`)
      }
      if (entry.verdict === 'reject' && (entry.noteAr ?? '').length < 5) {
        errs.push(`${pat}: الرفضُ بسببٍ يُقرأ — خمسةُ أحرفٍ فأكثر`)
      }
      proposals.push(entry)
    })

    const qualify: string[] = []
    const rawQualify = t.qualify === undefined ? [] : t.qualify
    if (!Array.isArray(rawQualify)) errs.push(`${where}: «qualify» ليست قائمة`)
    else for (const q of rawQualify) {
      if (typeof q !== 'string' || !q.trim()) { errs.push(`${where}: رمزُ دورةٍ فارغٌ في «qualify»`); continue }
      if (!qualify.includes(q.trim())) qualify.push(q.trim())
    }

    let status: TrainerStatusAction | null = null
    if (t.status !== undefined && t.status !== null) {
      if (!(TRAINER_STATUS_ACTIONS as readonly unknown[]).includes(t.status)) {
        errs.push(`${where}: حالٌ مجهولة «${String(t.status)}» — المعروف: ${TRAINER_STATUS_ACTIONS.join(' · ')}`)
      } else status = t.status as TrainerStatusAction
    }
    const statusNoteAr = optText(t, 'statusNoteAr', where, errs)
    if (status && (statusNoteAr ?? '').length < 5) {
      errs.push(`${where}: تغييرُ الحال بسببٍ يُقرأ في سجلّه — «statusNoteAr» خمسةُ أحرفٍ فأكثر`)
    }
    if (proposals.length === 0 && qualify.length === 0 && !status) {
      errs.push(`${where}: لا قرارَ له في الملفّ`)
    }
    trainers.push({ reference, fullName, proposals, qualify, status, statusNoteAr })
  })

  return errs.length > 0 ? { ok: false, errorsAr: errs } : { ok: true, file: { titleAr, trainers } }
}

/* ─────────── حالُ القاعدة كما يقرؤها المنفِّذ ─────────── */

export interface ProposalState {
  id: string
  titleAr: string
  summaryAr: string | null
  status: string
  courseId: string | null
  questionAr: string | null
}

export interface TrainerState {
  reference: string
  fullName: string
  applicationId: string
  status: string
  profile: {
    id: string
    /** حسابُه — و`null` لملفٍّ لم يُفعَّل حسابُه بعد */
    userId: string | null
    suspended: boolean
    proposals: readonly ProposalState[]
    qualifications: readonly { courseId: string; status: string }[]
  } | null
}

export interface DecisionsWorld {
  trainers: ReadonlyMap<string, TrainerState>
  /** رمزُ الدورة ← حالُها، لكلّ دورةٍ يذكرها الملفّ وهي في القاعدة */
  courses: ReadonlyMap<string, string>
  /** من يطبّق — لا يوقف نفسَه من هنا كما لا يوقفها من قائمة المدرّبين */
  actorUserId: string
  /** صلاحيّاتُه — والخطوةُ التي لا يملك صلاحيّتها لا تُطبَّق */
  permissions: ReadonlySet<string>
  /** اسمُ الصلاحيّة بلغة من يقرأ — من فهرس الصلاحيّات في الخادم */
  permissionLabelAr: (key: string) => string
  /** حالاتُ الطلب التي يُؤهَّل فيها صاحبُها (`QUALIFIABLE_STATUSES` في الخادم) */
  qualifiableStatuses: readonly string[]
  /** سببُ امتناع الانتقال إلى «مسحوب» من حاله — و`null` حين يجوز */
  withdrawProblem: (fromStatus: string) => string | null
}

/* ─────────── الخطوات ─────────── */

export const STEP_KINDS = [
  'create_proposal', 'edit_proposal', 'qualify', 'link', 'became_course', 'ask', 'reject', 'withdraw', 'suspend',
] as const
export type StepKind = (typeof STEP_KINDS)[number]

/** صلاحيّةُ كلّ خطوة — هي صلاحيّةُ الزرّ الذي تنوب عنه، لا أوسعُ منها */
export const STEP_PERMISSION: Record<StepKind, string> = {
  create_proposal: 'trainer.change.review',
  edit_proposal: 'trainer.change.review',
  link: 'trainer.change.review',
  became_course: 'trainer.change.review',
  ask: 'trainer.change.review',
  reject: 'trainer.change.review',
  qualify: 'trainer.qualify',
  withdraw: 'trainer.applications.decide',
  suspend: 'trainer.suspend',
}

export type StepState = 'todo' | 'done' | 'blocked'

export const STEP_STATE_LABELS: Record<StepState, string> = {
  todo: 'ستُطبَّق',
  done: 'طُبّقت من قبل',
  blocked: 'لا تُطبَّق',
}

export interface PlannedStep {
  /** ترتيبُها في التنفيذ — من ١ */
  n: number
  reference: string
  trainer: string
  kind: StepKind
  labelAr: string
  state: StepState
  /** لمَ «طُبّقت من قبل» أو «لا تُطبَّق» — و`null` لما سيُطبَّق */
  reasonAr: string | null
  applicationId: string | null
  profileId: string | null
  /** الاقتراحُ الذي تقع عليه — و`null` لاقتراحٍ تنشئه خطوةٌ قبلها */
  proposalId: string | null
  /** رقمُ الخطوة التي تنشئ الاقتراحَ حين لم يكن قائما بعد */
  createdByStep: number | null
  courseId: string | null
  titleAr: string | null
  summaryAr: string | null
  questionAr: string | null
  noteAr: string | null
}

export interface DecisionsPlan {
  titleAr: string
  steps: PlannedStep[]
  counts: Record<StepState, number>
  /** يُطبَّق حين يبقى ما يُطبَّق — والممتنعُ يمسك صاحبَه وحدَه لا الملفَّ كلَّه */
  applicable: boolean
}

const OPEN = new Set(['draft', 'submitted', 'info_requested'])

const VERDICT_STATUS: Record<'link' | 'became_course', string> = {
  link: 'linked', became_course: 'became_course',
}

/** حالُ اقتراحٍ بلغة من يقرأ — لسبب الامتناع */
const PROPOSAL_SAID: Record<string, string> = {
  linked: 'رُبط', became_course: 'صار دورة', rejected: 'رُفض',
}

export function planDecisions(file: DecisionsFile, world: DecisionsWorld): DecisionsPlan {
  const steps: PlannedStep[] = []
  /* قرارٌ على اقتراحٍ تنشئه خطوةٌ قبله — يُربط بها بعد الترقيم */
  const madeBy = new Map<PlannedStep, PlannedStep>()

  for (const entry of file.trainers) {
    const t = world.trainers.get(entry.reference)
    const profile = t?.profile ?? null
    /* ما يمنع المدرّبَ كلَّه — ويُكتب على كلّ خطوةٍ من خطواته */
    const whole = !t
      ? `لا طلبَ بالمرجع ${entry.reference}`
      : normalizeAr(t.fullName) !== normalizeAr(entry.fullName)
        ? `المرجعُ ${entry.reference} لـ«${t.fullName}» لا لـ«${entry.fullName}» — أيُّهما المقصود؟`
        : null

    const base = {
      reference: entry.reference,
      trainer: t?.fullName ?? entry.fullName,
      applicationId: t?.applicationId ?? null,
      profileId: profile?.id ?? null,
      proposalId: null, createdByStep: null, courseId: null, titleAr: null,
      summaryAr: null, questionAr: null, noteAr: null,
    }
    const own: PlannedStep[] = []
    const add = (s: Partial<PlannedStep> & Pick<PlannedStep, 'kind' | 'labelAr' | 'state' | 'reasonAr'>) => {
      const step: PlannedStep = { ...base, ...s, n: 0 }
      own.push(step)
      return step
    }
    const noProfile = 'لا ملفَّ مدرّبٍ له بعد — القبولُ الداخليُّ أوّلا'
    const noProposal = 'لا اقتراحَ بهذا المعرّف في طابوره — حُذف أو ليس له'

    /* ① الاقتراحات: ما يُنشأ وما يُصحَّح — ويُحفظ لكلّ بندٍ اقتراحُه */
    const resolved: { proposal: ProposalState | null; createdBy: PlannedStep | null; label: string }[] = []
    for (const p of entry.proposals) {
      if (p.proposalId) {
        const found = profile?.proposals.find((x) => x.id === p.proposalId) ?? null
        const current = found?.titleAr ?? p.proposalId
        /* والقرارُ يُقرأ بالعنوان بعد تصحيحه — فهو ما سيقرؤه صاحبُه */
        resolved.push({ proposal: found, createdBy: null, label: p.titleAr ?? current })
        if (p.titleAr === null && p.summaryAr === null) continue
        const titleChanges = p.titleAr !== null && p.titleAr !== found?.titleAr.trim()
        const summaryChanges = p.summaryAr !== null && p.summaryAr !== (found?.summaryAr ?? '').trim()
        add({
          kind: 'edit_proposal',
          labelAr: p.titleAr !== null
            ? `تصحيحُ عنوانِ «${current}» إلى «${p.titleAr}»`
            : `تصحيحُ نبذةِ «${current}»`,
          state: !found ? 'blocked' : titleChanges || summaryChanges ? 'todo' : 'done',
          reasonAr: !found ? noProposal : titleChanges || summaryChanges ? null : 'النصُّ كما في الملفّ',
          proposalId: p.proposalId,
          titleAr: titleChanges ? p.titleAr : null,
          summaryAr: summaryChanges ? p.summaryAr : null,
        })
      } else {
        const title = p.titleAr ?? ''
        /* وجديدٌ أُدخل من قبل يُعرف بعنوانه — فلا يُدخَل ثانية */
        const found = profile?.proposals.find((x) => normalizeAr(x.titleAr) === normalizeAr(title)) ?? null
        const created = add({
          kind: 'create_proposal',
          labelAr: `إدخالُ «${title}» طابورَ التصنيف`,
          state: found ? 'done' : profile ? 'todo' : 'blocked',
          reasonAr: found ? 'في طابوره اقتراحٌ بهذا العنوان' : profile ? null : noProfile,
          proposalId: found?.id ?? null,
          titleAr: title,
          summaryAr: p.summaryAr,
        })
        resolved.push({ proposal: found, createdBy: found ? null : created, label: title })
      }
    }

    /* ② التأهيل — قبل القرارات، فلا تُفتح مهمّةُ «أهِّله» لما أُهِّل له */
    const quals = new Map((profile?.qualifications ?? []).map((q) => [q.courseId, q.status]))
    const live = Boolean(t && profile && !profile.suspended && world.qualifiableStatuses.includes(t.status))
    for (const courseId of entry.qualify) {
      const courseStatus = world.courses.get(courseId)
      const already = quals.get(courseId) === 'qualified'
      add({
        kind: 'qualify',
        labelAr: `تأهيلُه لـ${courseId}`,
        state: already ? 'done'
          : !courseStatus || courseStatus === 'archived' || !profile || !live ? 'blocked' : 'todo',
        reasonAr: already ? 'مؤهَّلٌ لها'
          : !courseStatus ? `لا دورةَ بالرمز ${courseId} في الكتالوج بعد`
            : courseStatus === 'archived' ? `الدورةُ ${courseId} مؤرشفة`
              : !profile ? noProfile
                : !live ? 'ملفُّه ليس في طورٍ يُؤهَّل فيه — موقوفٌ أو لم يُقبل'
                  : null,
        courseId,
      })
    }

    /* ③ القرارات */
    entry.proposals.forEach((p, i) => {
      if (!p.verdict) return
      const { proposal, createdBy, label } = resolved[i]
      const missing = !proposal && !createdBy
      /* قرارٌ قائمٌ غيرُ ما في الملفّ — يُحترم ولا يُكتب فوقه */
      const decided = proposal && !OPEN.has(proposal.status)
        ? `قُرّر فيه غيرُ ما في الملفّ: ${PROPOSAL_SAID[proposal.status] ?? proposal.status}`
          + (proposal.courseId ? ` بـ${proposal.courseId}` : '')
        : null
      let step: PlannedStep

      if (p.verdict === 'link' || p.verdict === 'became_course') {
        const courseId = p.courseId ?? ''
        const courseStatus = world.courses.get(courseId)
        const same = proposal?.status === VERDICT_STATUS[p.verdict] && proposal.courseId === courseId
        step = add({
          kind: p.verdict,
          labelAr: p.verdict === 'link'
            ? `ربطُ «${label}» بـ${courseId} — نسخةٌ من رمزٍ قائم`
            : `«${label}» صار الدورةَ ${courseId}`,
          state: missing ? 'blocked' : same ? 'done'
            : !courseStatus || courseStatus === 'archived' || decided ? 'blocked' : 'todo',
          reasonAr: missing ? noProposal
            : same ? 'قائمٌ كما في الملفّ'
              : !courseStatus ? `لا دورةَ بالرمز ${courseId} في الكتالوج بعد`
                : courseStatus === 'archived' ? `الدورةُ ${courseId} مؤرشفة`
                  : decided,
          proposalId: proposal?.id ?? null,
          courseId,
          noteAr: p.noteAr,
        })
      } else if (p.verdict === 'ask') {
        const same = proposal?.status === 'info_requested' && (proposal.questionAr ?? '').trim() === p.questionAr
        step = add({
          kind: 'ask',
          labelAr: `سؤالُه عن «${label}»: ${p.questionAr}`,
          state: missing ? 'blocked' : same ? 'done' : decided ? 'blocked' : 'todo',
          reasonAr: missing ? noProposal : same ? 'سُئل هذا السؤالَ نفسَه' : decided,
          proposalId: proposal?.id ?? null,
          questionAr: p.questionAr,
        })
      } else {
        const same = proposal?.status === 'rejected'
        step = add({
          kind: 'reject',
          labelAr: `ردُّ «${label}»: ${p.noteAr}`,
          state: missing ? 'blocked' : same ? 'done' : decided ? 'blocked' : 'todo',
          reasonAr: missing ? noProposal : same ? 'مردودٌ من قبل' : decided,
          proposalId: proposal?.id ?? null,
          noteAr: p.noteAr,
        })
      }
      if (createdBy) madeBy.set(step, createdBy)
    })

    /* ④ حالُه — آخرا */
    if (entry.status === 'withdraw') {
      const done = t?.status === 'withdrawn'
      const problem = !t || done ? null : world.withdrawProblem(t.status)
      add({
        kind: 'withdraw',
        labelAr: `سحبُ طلبه: ${entry.statusNoteAr}`,
        state: done ? 'done' : problem || !t ? 'blocked' : 'todo',
        reasonAr: done ? 'مسحوبٌ من قبل' : problem,
        noteAr: entry.statusNoteAr,
      })
    } else if (entry.status === 'suspend') {
      const done = Boolean(profile?.suspended)
      const self = Boolean(profile?.userId && profile.userId === world.actorUserId)
      add({
        kind: 'suspend',
        labelAr: `إيقافُه مدرّبا: ${entry.statusNoteAr}`,
        state: done ? 'done' : profile && !self ? 'todo' : 'blocked',
        reasonAr: done ? 'موقوفٌ من قبل'
          : !profile ? noProfile
            : self ? 'هذا ملفُّك أنت — لا توقف نفسَك من هنا' : null,
        noteAr: entry.statusNoteAr,
      })
    }

    /* وما يمنع المدرّبَ كلَّه يمنع خطواتِه كلَّها */
    if (whole) for (const s of own) { s.state = 'blocked'; s.reasonAr = whole }
    steps.push(...own)
  }

  /* الترقيم، وصلاحيّةُ ما سيُطبَّق */
  steps.forEach((s, i) => { s.n = i + 1 })
  for (const [step, maker] of madeBy) step.createdByStep = maker.n
  for (const s of steps) {
    if (s.state === 'todo' && !world.permissions.has(STEP_PERMISSION[s.kind])) {
      s.state = 'blocked'
      s.reasonAr = `يتطلّب صلاحيّة «${world.permissionLabelAr(STEP_PERMISSION[s.kind])}»`
    }
  }
  /* وقرارٌ على اقتراحٍ لم يُنشأ بعد يمتنع بامتناع إنشائه */
  for (const s of steps) {
    if (s.createdByStep === null) continue
    const maker = steps[s.createdByStep - 1]
    if (maker.state === 'blocked' && s.state !== 'blocked') {
      s.state = 'blocked'
      s.reasonAr = `يتبع الخطوةَ ${maker.n} ولا تُطبَّق`
    }
  }
  /* والمدرّبُ الواحدُ قرارٌ واحد: خطوةٌ ممتنعةٌ تُبقي خطواتِه كلَّها كما هي */
  const firstBlocked = new Map<string, number>()
  for (const s of steps) if (s.state === 'blocked' && !firstBlocked.has(s.reference)) firstBlocked.set(s.reference, s.n)
  for (const s of steps) {
    const first = firstBlocked.get(s.reference)
    if (first === undefined || s.state !== 'todo') continue
    s.state = 'blocked'
    s.reasonAr = `تُترك مع الخطوة ${first} التي لا تُطبَّق — قراراتُ المدرّب الواحد تُطبَّق معا أو تُترك معا`
  }

  const counts: Record<StepState, number> = { todo: 0, done: 0, blocked: 0 }
  for (const s of steps) counts[s.state]++
  return { titleAr: file.titleAr, steps, counts, applicable: counts.todo > 0 }
}
