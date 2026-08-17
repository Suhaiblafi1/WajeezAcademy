/* نقطة دخول حزمة تشخيص B2C — V2.1 */
export {
  DiagnosticEngineV21,
  createEngineV21,
  assessDomainsV21,
  derivePersonaV21,
  CORE_FLOW_V21,
  V21_STOP,
  isQuestionEligibleV21,
  rankAdaptiveQuestionsV21,
  CONFIRMATION_MIN_QUESTIONS,
  CONFIRMATION_MAX_QUESTIONS,
  engineVersions,
} from './engine'
export type { RecommendationV21, AdaptiveScoreV21, QuestionEligibilityCtxV21 } from './engine'
export { questionPlanV21, planOf, QUESTION_PLAN_VERSION } from './data'
export type { QuestionPlanV21 } from './data'
export * from './maps'
