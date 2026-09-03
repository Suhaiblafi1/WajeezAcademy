/* طلباتُ آخر الرحلة كما تراها الواجهة — شهادةُ دورة، وشهادةُ مسار، وتوصية.

   والأهليّةُ تُقرأ من الخادم لا تُحسب هنا: هو من يفحص قواعدَ الإكمال عند
   الإصدار، فحسابُها ثانيةً في المتصفّح يُنتج زرّا يَعِد بما يُرفض. */

import { apiGet, apiPost } from './api'

export const LEARNER_REQUEST_KINDS = ['course_certificate', 'pathway_certificate', 'recommendation'] as const
export type LearnerRequestKind = (typeof LEARNER_REQUEST_KINDS)[number]

export const REQUEST_STATUS_AR: Record<string, { label: string; cls: string }> = {
  pending: { label: 'طلبك وصل — بانتظار المراجعة', cls: 'border-white/20 text-white/65' },
  in_review: { label: 'قيد المراجعة', cls: 'border-gold/50 text-gold-ink' },
  fulfilled: { label: 'أُنجز', cls: 'border-teal/50 text-teal-light-ink' },
  declined: { label: 'اعتُذر عنه', cls: 'border-red-500/40 text-red-400' },
}

export interface LearnerRequest {
  id: string
  kind: LearnerRequestKind
  enrollmentId: string | null
  pathwayId: string | null
  audienceAr: string | null
  status: string
  decisionAr: string | null
  decidedAt: string | null
  createdAt: string
}

/** ما يمنع الطلبَ الآن — أسبابٌ بالنصّ لا زرٌّ مطفأ بلا كلمة */
export interface Eligibility {
  eligible: boolean
  reasonsAr: string[]
  percent: number
}

export interface PathwayCompletion extends Eligibility {
  done: number
  total: number
}

export function fetchMyRequests(): Promise<LearnerRequest[]> {
  return apiGet<LearnerRequest[]>('/api/learner/requests')
}

export function fetchCourseEligibility(enrollmentId: string): Promise<Eligibility> {
  return apiGet<Eligibility>(`/api/learner/enrollments/${enrollmentId}/certificate-eligibility`)
}

export function fetchPathwayCompletion(pathwayId: string): Promise<PathwayCompletion> {
  return apiGet<PathwayCompletion>(`/api/learner/pathways/${pathwayId}/completion`)
}

export function createRequest(input: {
  kind: LearnerRequestKind
  enrollmentId?: string
  pathwayId?: string
  audienceAr?: string
  noteAr?: string
}): Promise<LearnerRequest> {
  return apiPost<LearnerRequest>('/api/learner/requests', input)
}

/** الطلبُ القائم على شيءٍ بعينه — المفتوحُ أوّلا، فهو ما يهمّ صاحبَه الآن */
export function requestFor(
  requests: readonly LearnerRequest[],
  kind: LearnerRequestKind,
  key: { enrollmentId?: string; pathwayId?: string },
): LearnerRequest | null {
  const matches = requests.filter(
    (r) =>
      r.kind === kind &&
      (key.enrollmentId ? r.enrollmentId === key.enrollmentId : true) &&
      (key.pathwayId ? r.pathwayId === key.pathwayId : true),
  )
  return matches.find((r) => r.status === 'pending' || r.status === 'in_review') ?? matches[0] ?? null
}
