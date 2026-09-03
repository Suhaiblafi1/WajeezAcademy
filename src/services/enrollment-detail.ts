/* تفصيلُ التسجيل الواحد — شكلُ ما يصل من `/api/learner/enrollments/:id`.

   كان هذا الشكلُ معلَنا داخل صفحةٍ واحدة (`MyLearning.tsx`)، فلمّا احتاجته
   صفحةُ الرحلة لزم أن يُنسخ — ونسختان من شكلِ ردٍّ واحد تفترقان عند أوّل
   تغييرٍ في الخادم. فصار مصدرا واحدا يُستورد. */

import { apiGet } from './api'

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
  recordings: { id: string; title: string; durationSec: number | null; readUrl: string | null }[]
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
  }
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

/** ما لم يُسلَّم بعد أو طُلبت إعادتُه — عددٌ يُعرض على التبويب */
export function pendingAssessmentCount(detail: EnrollmentDetail): number {
  return detail.cohort.assessments.filter((a) => {
    const mine = latestSubmission(detail, a.id)
    return !mine || mine.status === 'resubmit_requested'
  }).length
}
