/* محمّل بيانات V2.1 — خطة الأسئلة + أسئلة القرار الجديدة + الخرائط. */

import planJson from '../../../data/catalog/v2_1/question-plan.v2_1.json'
import type { DomainId } from '../v2/types'
import type { CareerStage, QuestionLayerV21, QuestionSurface } from './maps'

export interface QuestionPlanV21 {
  surface: QuestionSurface
  layer21: QuestionLayerV21 | null
  phase: 'core' | 'adaptive' | 'confirmation' | 'none'
  action: 'keep' | 'rewrite' | 'replaced' | 'move_post' | 'retire' | 'out_of_scope'
  /** الحالة النهائية — كل سؤال محسوب مرة واحدة، مشتقة حتميًا من (surface, phase, action) */
  final_status: 'active_b2c' | 'deep_only' | 'post_recommendation' | 'institutional' | 'retired' | 'out_of_scope'
  stages: CareerStage[] | 'all'
  domains: DomainId[]
  impact_ar: string
  why_ar: string
  replaced_by?: string
  measures: string[]
}

const file = planJson as unknown as { version: string; plan: Record<string, QuestionPlanV21> }

export const QUESTION_PLAN_VERSION = file.version
export const questionPlanV21: Record<string, QuestionPlanV21> = file.plan

export function planOf(questionId: string): QuestionPlanV21 | undefined {
  return questionPlanV21[questionId]
}
