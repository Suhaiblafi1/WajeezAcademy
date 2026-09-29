/* دوراتُ المدرّبين المقبولين — جردُ ما يتّصل بكلّ مدرّبٍ من دورات، صفّا لكلّ بند.

   ═══ السؤالُ الذي وُضع له (٢٨ سبتمبر ٢٠٢٦) ═══

   طلب صاحبُ المنصّة أن يرى ما اقترحه المدرّبون المقبولون داخليّا من دورات،
   ليقرّر في كلٍّ منها — أنسخةٌ من دورةٍ قائمةٍ هي أم دورةٌ جديدة — ثمّ
   يؤهّلهم لها.

   وطابورُ التصنيف (`/admin/course-proposals`) يقول بعضَ ذلك لا كلَّه:

   · **الفقرةُ الحرّةُ القديمة** (`teachableOther` — طلباتُ ٣١ أغسطس إلى ١٣
     سبتمبر ٢٠٢٦) لم تدخل الطابورَ قطّ: ترحيلُ
     `20260914100000_trainer_course_proposals` بذر من `teachableProposals`
     وحدَه. ووقع ذلك على أوّل مدرّبةٍ حقيقيّةٍ في المنصّة — ثماني دوراتٍ في
     فقرتها (انظر `teachableCountAr`) ولا صفَّ لها في الطابور.
   · **واقتراحاتُ الطلب بعد إنشاء الملفّ**: محرّرُ الإدارة
     (`saveTeachableProposals`) يكتب في عمود الطلب وحدَه، والبذرُ يقع مرّةً عند
     ميلاد الملفّ. فمن سمّى دوراتِ الفقرة الحرّة في المحرّر بعد القبول الداخليّ
     كتبها حيث لا يقرؤها الطابور.
   · **ودوراتُ الكتالوج التي اختارها في طلبه** (`teachableCourseIds`) ليست
     اقتراحاتٍ فلا يعرضها — وقد صارت عند قبوله الداخليّ تأهيلا معلَّقا
     (`syncQualificationsFromApplication`) ينتظر قرارا.
   · **والتأهيلُ القائم** في شاشةٍ ثالثة (`/admin/assign-by-trainer`).

   فتُجمع هنا، ولكلّ بندٍ حالُه وما صار إليه.

   ═══ وما لا يُبتلَع ═══

   مقبولٌ لا بندَ له — لم يقترح ولم يختر ولم يُؤهَّل — **صفٌّ يقول ذلك** لا
   غيابٌ عن الجدول: الغيابُ يُقرأ «لا شيءَ هنا»، والصفُّ يُقرأ «هنا مدرّبٌ لا
   يُسنَد إليه شيءٌ بعد».

   ═══ وقراراتٌ مكتوبةٌ كيلا تُخمَّن ═══

   · **اقتراحُ الطلب يُعرض ما لم يكن له مقابلٌ في الطابور** — لا كلُّه ولا
     لا شيءَ منه. الطابورُ بُذر منه ثمّ حيي وحدَه: فعرضُه كلِّه يكرّر كلَّ
     مبذور، وإسقاطُه كلِّه يبتلع ما لم يُبذَر. والمقابلةُ بالعنوان مطبَّعا،
     وعلى **كلّ عنوانٍ حمله اقتراحٌ في الطابور يوما** (`pastQueueTitles`: ما
     قبل تسميته، وما حذفه صاحبُه من بوّابته) — وإلّا عاد ما أعاد صاحبُه
     تسميتَه كأنّه لم يُبذَر، وعاد ما حذفه كأنّه لم يُحذف.
   · **والفقرةُ الحرّةُ صفٌّ واحدٌ كما كُتبت** لا تُقسَم أسطرا: كان تلميحُها
     «عنوانا لكلّ سطر، ولمن هو»، فالسطرُ قد يكون عنوانا وقد يكون جمهورَ ما
     قبله. وقسمتُها تخمينٌ يُكتب في جدولٍ على أنّه قولُه.
   · **وأقربُ رمزٍ لما لم يُبتّ فيه وحدَه**، يحسبه المُنادي بـ`suggestCourses`
     نفسِها التي ترشّح في شاشة التصنيف — فلا يرى قارئُ الجدول رمزا غيرَ الذي
     يراه هناك. والمبتوتُ قد قيل فيه، وخانةُ «الدورة» تقول ما صار إليه.
   · **ولا بريدَ ولا هاتف.** الجدولُ يُصدَّر ويُرسَل، والقرارُ فيه يكفيه الاسمُ
     والمرجع. */

import { normalizeAr } from '../text/search-ar'
import { STATUS_LABELS } from './application-status'
import { QUALIFICATION_LABELS } from './qualification-labels'
import { readProposals } from './teachable-proposals'

/** المقبولُ داخليّا فما بعده. والموقوفُ خارجُها بقصد: لا يُجهَّز موقوف،
    وإيقافُه قرارٌ قائمٌ يُقرأ في شاشته. */
export const ACCEPTED_TRAINER_STATUSES = [
  'conditionally_approved', 'contract_pending', 'onboarding', 'active',
] as const

/* ═══ ومقبولٌ حالُه غيرُ حالات القبول (٢٩ سبتمبر ٢٠٢٦) ═══

   كانت القائمةُ أعلاه هي الحدَّ كلَّه، فغاب عن الجدول مقبولٌ طُلبت منه
   معلومات: طلبُ المعلومات يُفتح من كلّ حالةٍ حيّةٍ منذ ٢٢ سبتمبر — ومنها ما
   بعد القبول الداخليّ — فيصير حالُه `information_requested` وموضعُه محفوظٌ في
   `infoRequestedFrom` ليعود إليه حين يجيب. وهو مقبولٌ في كلّ معنى: ملفُّه
   قائم، ومؤهّلاتُه مبذورة، وينتظر ورقةً لا قرارا. وكذا كلُّ حالةٍ حيّةٍ
   يُنقَل إليها مقبول — فكلُّها تصل كلَّها منذ ذلك اليوم.

   فالحدُّ **ملفُّ المدرّب** لا اسمُ الحالة: الملفُّ لا يولد إلّا بقبول
   (القبولُ الداخليّ، والنقرةُ الواحدة، والتعيينُ الداخليّ) — إلّا من انتهى
   أمرُه أو وقف، وهي هذه. والقائمةُ أعلاه باقيةٌ حدّا ثانيا: حالُ قبولٍ بلا
   ملفٍّ طلبٌ قديمٌ سبق الملفّات، والجدولُ يقول «لا ملفَّ له بعد» ولا يُسقطه. */
export const ENDED_TRAINER_STATUSES = ['rejected', 'withdrawn', 'suspended'] as const

/** حالُ المدرّب كما يُقرأ في الجدول — ويقول لمَ هو فيه حين لا تقوله الحالة */
export function trainerStatusCell(t: Pick<AcceptedTrainerIn, 'status' | 'infoRequestedFrom' | 'profile'>): string {
  const label = STATUS_LABELS[t.status] ?? t.status
  if (t.status === 'information_requested' && t.infoRequestedFrom) {
    return `${label} — طُلبت منه في «${STATUS_LABELS[t.infoRequestedFrom] ?? t.infoRequestedFrom}»، ويعود إليها حين يجيب`
  }
  if (t.profile && !(ACCEPTED_TRAINER_STATUSES as readonly string[]).includes(t.status)) {
    return `${label} — وله ملفُّ مدرّبٍ من قبولٍ سابق`
  }
  return label
}

/** ما لم يُبتّ فيه من الاقتراحات — ويُقابَل بـ`OPEN_PROPOSAL` في الخادم
    في اختبارٍ واحد، فلا تفترق قائمتان. */
export const OPEN_PROPOSAL_STATUSES: readonly string[] = ['draft', 'submitted', 'info_requested']

/** حالُ الاقتراح بلغة من يقرأ — والثلاثُ المبتوتةُ بألفاظ شاشة التصنيف نفسِها */
export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  draft: 'مسوّدة',
  submitted: 'ينتظر التصنيف',
  info_requested: 'سُئل صاحبُه — ينتظر جوابَه',
  linked: 'نسخةٌ من رمزٍ قائم',
  became_course: 'صارت دورةً في الكتالوج',
  rejected: 'لم تُقبل',
}

/** من أين جاء البند — وهو أوّلُ ما يُقرأ في الصفّ */
export const SOURCE_LABELS = {
  queue: 'اقتراحٌ في طابور التصنيف',
  application: 'اقتراحٌ في طلبه لم يدخل الطابور',
  freeText: 'فقرةٌ حرّةٌ في طلبه — لم تدخل الطابور',
  ticked: 'اختارها من الكتالوج في طلبه',
  qualification: 'تأهيلٌ قائم',
  nothing: 'لا دورةَ في ملفّه',
} as const

/** اقتراحٌ في الطابور كما يُقرأ من القاعدة */
export interface QueueProposalIn {
  id: string
  titleAr: string
  summaryAr: string | null
  status: string
  courseId: string | null
  questionAr: string | null
  answerAr: string | null
  decisionNoteAr: string | null
}

export interface AcceptedTrainerIn {
  fullName: string
  reference: string
  status: string
  /** الحالُ التي طُلبت منه فيها معلوماتٌ ويعود إليها حين يجيب — و`null` لغيره */
  infoRequestedFrom: string | null
  teachableCourseIds: readonly string[]
  teachableOther: string | null
  /** عمودُ الطلب كما هو في القاعدة — يُقرأ بـ`readProposals` */
  teachableProposals: unknown
  /** `null` = لا ملفَّ مدرّبٍ له بعد */
  profile: {
    proposals: readonly QueueProposalIn[]
    qualifications: readonly { courseId: string; status: string }[]
    /** عناوينُ حملتها اقتراحاتُه في الطابور ثمّ فارقتها — ما قبل تسميةٍ، وما
        حذفه صاحبُه. والجاري لا يلزم هنا: يُقرأ من `proposals` نفسِها. */
    pastQueueTitles: readonly string[]
  } | null
}

/** ما يعرفه المُنادي عن الكتالوج — عنوانٌ لرمز، وأقربُ رمزٍ لنصّ */
export interface CatalogLens {
  /** عنوانُ الإصدار الجاري — و`null` لرمزٍ لا دورةَ به */
  titleOf(courseId: string): string | null
  /** أقربُ رمزٍ إلى اقتراح — و`null` حين لا يشترك في كلمةٍ من عنوانه */
  nearest(proposal: { titleAr: string; summaryAr: string | null }): { courseId: string; titleAr: string } | null
}

/** صفٌّ في الجدول — وترتيبُ مفاتيحه ترتيبُ أعمدته في العرض والتصدير.
    ونوعٌ لا واجهة: صفوفُ التقارير `Record<string, unknown>`، والواجهةُ لا
    تُسنَد إليها بلا نسخ. */
export type AcceptedCourseRow = {
  trainer: string
  reference: string
  trainerStatus: string
  source: string
  title: string
  summary: string
  itemStatus: string
  course: string
  qualification: string
  nearest: string
  note: string
  /** معرّفُ الاقتراح في الطابور — فارغٌ لما ليس فيه. به يُطابَق قرارٌ
      كُتب على الجدول بصفّه في القاعدة، لا بعنوانٍ قد يتكرّر. */
  proposalId: string
}

const DASH = '—'
const titleKey = (s: string) => normalizeAr(s)

/** الأفعالُ التي تحمل عنوانا فارقه اقتراحٌ في الطابور — وموضعُه في كلٍّ منها.

    كما يكتبها `course-proposal.service.ts`: تعديلُ صاحبه (`before.titleAr`)،
    وتصحيحُ الإدارة (`meta.beforeTitleAr`)، وحذفُه من بوّابته (`meta.titleAr`
    — والصفُّ محذوف، فيُنسَب إلى صاحبه بـ`actorId` لا بمعرّفه). */
export const PAST_TITLE_ACTIONS = {
  ownerEdit: 'trainer.course_proposal.update',
  staffEdit: 'trainer.course_proposal.edit_by_staff',
  ownerDelete: 'trainer.course_proposal.delete',
} as const

const field = (v: unknown, k: string): string => {
  const x = v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined
  return typeof x === 'string' ? x.trim() : ''
}

/** العنوانُ الذي فارقه الاقتراحُ في سطر أثر — وفراغٌ لسطرٍ لا يحمله */
export function pastTitleFromAudit(e: { action: string; meta: unknown; before: unknown }): string {
  if (e.action === PAST_TITLE_ACTIONS.ownerEdit) return field(e.before, 'titleAr')
  if (e.action === PAST_TITLE_ACTIONS.staffEdit) return field(e.meta, 'beforeTitleAr')
  if (e.action === PAST_TITLE_ACTIONS.ownerDelete) return field(e.meta, 'titleAr')
  return ''
}

type Body = Partial<Omit<AcceptedCourseRow, 'trainer' | 'reference' | 'trainerStatus'>>

/** سؤالُ الإدارة وجوابُه وملحوظةُ القرار — ما يُقرأ قبل أن يُقرَّر ثانية */
function proposalNote(p: QueueProposalIn): string {
  const parts: string[] = []
  if (p.questionAr?.trim()) parts.push(`سُئل: ${p.questionAr.trim()}`)
  if (p.answerAr?.trim()) parts.push(`أجاب: ${p.answerAr.trim()}`)
  if (p.decisionNoteAr?.trim()) parts.push(`ملحوظةُ القرار: ${p.decisionNoteAr.trim()}`)
  return parts.join(' · ')
}

/** الجردُ كلُّه — مدرّبٌ بعد مدرّبٍ بترتيب أسمائهم، وبنودُ كلٍّ بترتيب مصادرها */
export function acceptedCourseRows(
  trainers: readonly AcceptedTrainerIn[],
  lens: CatalogLens,
): AcceptedCourseRow[] {
  const ordered = [...trainers].sort(
    (a, b) => a.fullName.localeCompare(b.fullName, 'ar') || a.reference.localeCompare(b.reference),
  )
  const out: AcceptedCourseRow[] = []

  for (const t of ordered) {
    const rows: AcceptedCourseRow[] = []
    const push = (r: Body) => rows.push({
      trainer: t.fullName,
      reference: t.reference,
      trainerStatus: trainerStatusCell(t),
      source: r.source ?? DASH,
      title: r.title ?? DASH,
      summary: r.summary?.trim() || DASH,
      itemStatus: r.itemStatus ?? DASH,
      course: r.course ?? DASH,
      qualification: r.qualification ?? DASH,
      nearest: r.nearest ?? DASH,
      note: r.note?.trim() || DASH,
      proposalId: r.proposalId ?? '',
    })

    const quals = new Map((t.profile?.qualifications ?? []).map((q) => [q.courseId, q.status]))
    const courseCell = (id: string) => `${id} — ${lens.titleOf(id) ?? 'لا دورةَ بهذا الرمز في الكتالوج'}`
    const qualCell = (id: string) => {
      const s = quals.get(id)
      return s ? (QUALIFICATION_LABELS[s] ?? s) : 'غيرُ مؤهَّلٍ بعد'
    }
    const nearestCell = (p: { titleAr: string; summaryAr: string | null }) => {
      const n = lens.nearest(p)
      return n ? `${n.courseId} — ${n.titleAr}` : DASH
    }
    /* الدوراتُ التي قيل حالُ تأهيله لها في صفٍّ قبلُ — فلا يُعاد التأهيلُ صفّا ثانيا */
    const covered = new Set<string>()

    /* ① الطابور */
    for (const p of t.profile?.proposals ?? []) {
      const open = OPEN_PROPOSAL_STATUSES.includes(p.status)
      if (p.courseId) covered.add(p.courseId)
      push({
        source: SOURCE_LABELS.queue,
        title: p.titleAr,
        summary: p.summaryAr ?? '',
        itemStatus: PROPOSAL_STATUS_LABELS[p.status] ?? p.status,
        course: p.courseId ? courseCell(p.courseId) : DASH,
        qualification: p.courseId ? qualCell(p.courseId) : DASH,
        nearest: open ? nearestCell(p) : DASH,
        note: proposalNote(p),
        proposalId: p.id,
      })
    }

    /* ② اقتراحُ الطلب بلا مقابلٍ في الطابور */
    const known = new Set(
      [...(t.profile?.proposals.map((p) => p.titleAr) ?? []), ...(t.profile?.pastQueueTitles ?? [])].map(titleKey),
    )
    for (const p of readProposals(t.teachableProposals)) {
      const k = titleKey(p.titleAr)
      if (known.has(k)) continue
      /* ومكرَّرُ الطلب نفسِه صفٌّ واحد */
      known.add(k)
      push({
        source: SOURCE_LABELS.application,
        title: p.titleAr,
        summary: p.summaryAr,
        itemStatus: 'خارجَ الطابور — لم يُصنَّف',
        nearest: nearestCell({ titleAr: p.titleAr, summaryAr: p.summaryAr || null }),
        note: t.profile
          ? 'لم يُبذَر في الطابور: أُضيف إلى طلبه بعد إنشاء ملفّه'
          : 'لا ملفَّ مدرّبٍ له بعد — يُبذَر في الطابور حين يُنشأ',
      })
    }

    /* ③ الفقرةُ الحرّةُ القديمة — كما كُتبت */
    const free = t.teachableOther?.trim()
    if (free) {
      push({
        source: SOURCE_LABELS.freeText,
        title: free,
        itemStatus: 'خارجَ الطابور — تُقرأ بعين',
        note: 'من نموذج التقديم القديم كما كتبها — وما سُمّي منها في محرّر الطلب يظهر في صفوفٍ مستقلّة',
      })
    }

    /* ④ ما اختاره من الكتالوج */
    for (const id of new Set(t.teachableCourseIds)) {
      covered.add(id)
      push({
        source: SOURCE_LABELS.ticked,
        title: lens.titleOf(id) ?? id,
        course: courseCell(id),
        qualification: qualCell(id),
      })
    }

    /* ⑤ وكلُّ تأهيلٍ لم يُقَل في صفٍّ قبله */
    for (const [courseId, status] of quals) {
      if (covered.has(courseId)) continue
      push({
        source: SOURCE_LABELS.qualification,
        title: lens.titleOf(courseId) ?? courseId,
        course: courseCell(courseId),
        qualification: QUALIFICATION_LABELS[status] ?? status,
      })
    }

    if (rows.length === 0) {
      push({
        source: SOURCE_LABELS.nothing,
        title: 'لم يقترح دورةً ولم يختر من الكتالوج، ولا تأهيلَ له',
        note: t.profile ? '' : 'ولا ملفَّ مدرّبٍ له بعد',
      })
    }
    out.push(...rows)
  }
  return out
}
