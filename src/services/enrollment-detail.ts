/* تفصيلُ التسجيل الواحد — شكلُ ما يصل من `/api/learner/enrollments/:id`.

   كان هذا الشكلُ معلَنا داخل صفحةٍ واحدة (`MyLearning.tsx`)، فلمّا احتاجته
   صفحةُ الرحلة لزم أن يُنسخ — ونسختان من شكلِ ردٍّ واحد تفترقان عند أوّل
   تغييرٍ في الخادم. فصار مصدرا واحدا يُستورد. */

import { apiGet } from './api'
import type { LearnerPlanView } from '@/application/trainer/plan-overlay'
import { submitVerdict, type AccessState } from '@/application/learning/cohort-gate'

export interface EnrollmentCertificate {
  id: string
  number: string
  status: string
}

export interface CohortSession {
  id: string
  title: string
  startsAt: string
  endsAt: string | null
  status: string
  zoom: { joinUrl: string; learnerUrl: string | null; meetingId: string | null; passcode: string | null } | null
  recordings: { id: string; title: string; durationSec: number | null; readUrl: string | null; externalUrl: string | null }[]
}

export interface CohortMaterial {
  id: string
  title: string
  kind: string
  externalUrl: string | null
  readUrl: string | null
}

export interface CohortAssessment {
  id: string
  title: string
  /** محورُها — به تُجمع تحت موعده في خطّ الشعبة */
  moduleId?: string | null
  /* ٢(ب-٢): لم تُفتح بعد — تُفتح بعد أوّل لقاءٍ لمحورها. والمحجوبةُ تصل
     بعنوانها وموعدها وحدَهما: لا تعليماتِ ولا مرفقاتِ ولا أسئلة. */
  locked?: boolean
  /** متى تُفتح — `null`: مفتوحةٌ بلا بوّابة، أو انتهى الوصول */
  opensAt?: string | null
  /* تعليماتُ التكليف — ما يفعله المتعلّم. كانت تُكتب ولا تُعرض له. */
  briefAr: string | null
  /* مرفقاتُه — عمودُ JSON، فيُقرأ بـ`readTypedLinks` لا يُصدَّق كما هو */
  attachments: unknown
  type: string
  dueAt: string | null
  maxScore: number
  items: { id: string; prompt: string; kind?: string; maxScore?: number }[]
  rubric?: { id: string; title: string; criteria: { id: string; title: string; maxScore: number; sequence: number }[] } | null
}

export interface MySubmission {
  id: string
  assessmentId: string
  status: string
  reviewNote: string | null
  submittedAt: string
  /** سُلّم بعد آخر موعده — «المتأخّرُ يُقبل ويُعلَّم» */
  late?: boolean
  grades: {
    score: string
    maxScore: string
    rubricScores?: { criterionId: string; score: number }[] | null
    history?: { oldScore: string | null; newScore: string | null; createdAt?: string }[] | null
  }[]
  feedback: { body: string; createdAt: string }[]
}

export interface EnrollmentDetail {
  id: string
  status: string
  cohort: {
    id: string
    title: string
    startsAt: string | null
    course: { id: string; versions: { titleAr: string }[] }
    trainers: { profile: { application: { fullName: string } } }[]
    sessions: CohortSession[]
    materials: CohortMaterial[]
    assessments: CohortAssessment[]
    /* خطّةُ مدرّب الشعبة المعتمَدة، مشروعةً — تعلو وحداتِ الكتالوج في
       شاشة الدروس، ومصادرُها تنضمّ إلى «مصادر هذه المرحلة». `null` حين لا
       خطّةَ معتمَدة. انظر `src/application/trainer/plan-overlay.ts`. */
    trainerPlan: LearnerPlanView | null
  }
  /* ٢(ب-٢): وقتُه في الشعبة — مفتوحة، ثمّ للقراءة ستّةَ أشهرٍ بعد انتهائها،
     ثمّ انتهى الوصول. `closesAt` فارغٌ لما اعتُمد بلا مواعيد: لا أجلَ له. */
  access?: { state: AccessState; closesAt: string | null; accessEndsAt: string | null }
  attendance: { sessionId: string; status: string }[]
  submissions: MySubmission[]
  moduleProgress: { moduleId: string; status: string; completedAt: string | null }[]
  courseProgress: { percent: number } | null
  certificates: EnrollmentCertificate[]
}

export function fetchEnrollmentDetail(id: string): Promise<EnrollmentDetail> {
  return apiGet<EnrollmentDetail>(`/api/learner/enrollments/${id}`)
}

/** آخرُ تسليمٍ لتقييمٍ بعينه — الأحدثُ أوّلا، فهو الحكمُ القائم */
export function latestSubmission(detail: EnrollmentDetail, assessmentId: string): MySubmission | null {
  return (
    detail.submissions
      .filter((s) => s.assessmentId === assessmentId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0] ?? null
  )
}

/** ما لم يُسلَّم بعد أو طُلبت إعادتُه — عددٌ يُعرض على التبويب.
    وما لا يُسلَّم الآن لا يُعدّ عليه (٢(ب-٢)): مهمّةٌ لم تُفتح، أو شعبةٌ انتهت. */
export function pendingAssessmentCount(detail: EnrollmentDetail, now = new Date()): number {
  return detail.cohort.assessments.filter((a) => canSubmitNow(detail, a, now)).length
}

/** أيستطيع أن يسلّمها الآن؟ — بـ`submitVerdict` نفسِها التي يحكم بها الخادم،
    فلا تعرض الشاشةُ نموذجا يردّه الخادم، ولا تُخفي نموذجا يقبله. */
export function canSubmitNow(detail: EnrollmentDetail, a: CohortAssessment, now = new Date()): boolean {
  if (a.locked) return false
  const mine = latestSubmission(detail, a.id)
  const resubmitRequested = mine?.status === 'resubmit_requested'
  /* سلّم وينتظر حكمَ مدرّبه — لا تسليمَ ثانيا بلا طلب */
  if (mine && !resubmitRequested) return false
  const acc = detail.access
  const window = acc?.closesAt && acc.accessEndsAt
    ? { closesAt: new Date(acc.closesAt), accessEndsAt: new Date(acc.accessEndsAt) }
    : null
  return submitVerdict({
    opensAt: a.opensAt ? new Date(a.opensAt) : null,
    dueAt: a.dueAt,
    window,
    now,
    resubmitRequested,
  }).ok
}
