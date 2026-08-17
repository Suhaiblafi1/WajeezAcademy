/* الأهلية الصارمة في V2 — Hard Exclude لا خفض Utility.
   سؤال لا يناسب المرحلة لا يُطرح أبدًا. مسار خارج الأهلية لا يدخل السباق أصلًا. */

import { launchPathways, pathwayProfiles } from '../catalog'
import { evaluateTrigger, type TriggerContext } from '../triggers'
import type { BankQuestion, FactBag } from '../types'
import { questionMetaV2 } from './data'
import { pathwayInActiveDomains, DOMAIN_CONFIDENCE_MIN } from './domains'
import { basePersonaCode } from './personas'
import type { DecisionContext, PathwayEligibility, PersonaKey, QuestionPhase } from './types'

/* ─── أهلية السؤال ─── */
export interface QuestionEligibilityCtx extends TriggerContext {
  askedIds: Set<string>
  phase: QuestionPhase
  persona: PersonaKey
}

export function isQuestionEligible(q: BankQuestion, ctx: QuestionEligibilityCtx): boolean {
  if (ctx.askedIds.has(q.question_id)) return false
  const meta = questionMetaV2[q.question_id]
  /* سؤال بلا ميتا = لم يُراجع في V2 — لا يُطرح (التدقيق يلتقط الحالة) */
  if (!meta) return false
  /* مرشحو التقاعد لا يُطرحون في V2 — سؤال بلا أثر قرار لا يُسأل */
  if (meta.layer === 'retire_candidate') return false
  /* أهلية الشخصية — استبعاد صارم */
  const allowed = meta.allowed_personas
  if (allowed !== 'all' && !allowed.includes(ctx.persona) && ctx.persona !== 'unknown') return false
  if (meta.excluded_personas.includes(ctx.persona)) return false
  /* بوابة الموافقة: قبل معرفة موقف الموافقة لا يُسأل إلا الاستقبال M0 */
  const consentKnown = ctx.facts['diagnostic_consent'] !== undefined
  if (!consentKnown && q.module_id !== 'M0') return false
  /* مرحلة السؤال */
  if (ctx.phase === 'core' && meta.phase !== 'core') return false
  if (ctx.phase === 'adaptive' && meta.phase === 'core') return false // النواة تُدار بتسلسلها
  if (ctx.phase === 'confirmation' && meta.phase !== 'confirmation' && meta.layer !== 'verification') {
    /* جولة التأكيد تقبل أيضًا أسئلة مهارات/شخصنة لم تُطرح — تُدار من خطة الجولة لا من هنا */
    return false
  }
  return evaluateTrigger(q.trigger_condition, ctx)
}

export function eligibleQuestionsV2(bank: BankQuestion[], ctx: QuestionEligibilityCtx): BankQuestion[] {
  return bank.filter((q) => isQuestionEligible(q, ctx))
}

/* ─── أهلية المسار الصارمة ─── */

/** المسارات المرتبطة بمجال حكومي تتطلب قطاعًا عامًا مؤكدًا */
const GOV_DOMAIN_PATHWAYS = new Set(['PW-GOV-002'])

export function assessPathwayEligibility(
  facts: FactBag,
  ctx: DecisionContext,
): PathwayEligibility[] {
  const personaKey = ctx.persona.key
  const base = basePersonaCode(personaKey)
  const goal = facts['primary_goal']?.value as string | undefined
  const stage = facts['business_stage']?.value as string | undefined
  const leadership = facts['leadership_context']?.value as string | undefined
  const publicFacing = facts['public_facing']?.value as string | undefined
  const sector = facts['sector']?.value as string | undefined

  /* المجالات النشطة: لا فلترة بالمجال قبل ثقة كافية — نمنع الاستبعاد المبكر المتسرع */
  const domainReady = ctx.domains.confidence >= DOMAIN_CONFIDENCE_MIN && goal !== undefined
  const activeDomains = domainReady
    ? ctx.domains.ranked.filter((d) => (ctx.domains.scores[d] ?? 0) >= 0.25)
    : []

  const results: PathwayEligibility[] = []
  for (const p of launchPathways) {
    const profile = pathwayProfiles[p.id]
    const reasons: string[] = []

    /* ١) الشخصية — صارمة عندما تُعرف والبروفايل يحدد جمهورًا */
    if (base && profile?.personas?.length && !profile.personas.includes(base)) {
      reasons.push('جمهور هذا المسار لا يشمل وصفك الحالي.')
    }

    /* ٢) المجال — صارم بعد وضوحه فقط */
    if (domainReady && activeDomains.length > 0 && !pathwayInActiveDomains(p.id, activeDomains)) {
      reasons.push('المسار خارج مجال حاجتك التي ظهرت من إجاباتك.')
    }

    /* ٣) السياق: مرحلة المشروع / القيادة / الاحتكاك بالجمهور */
    if (profile?.business_stages?.length && stage && !profile.business_stages.includes(stage)) {
      reasons.push('مرحلة مشروعك لا تناسب ما صُمم له هذا المسار.')
    }
    if (profile?.leadership_fit?.length && leadership && !profile.leadership_fit.includes(leadership)) {
      reasons.push('المسار مصمم لسياق قيادي مختلف عن واقعك.')
    }
    if (profile?.public_facing_fit?.length && publicFacing && !profile.public_facing_fit.includes(publicFacing)) {
      reasons.push('المسار مصمم لمن يخاطب جمهورًا خارجيًا أكثر من واقعك.')
    }

    /* ٤) المسارات الحكومية تتطلب قطاعًا عامًا مؤكدًا */
    if (GOV_DOMAIN_PATHWAYS.has(p.id) && sector && sector !== 'public') {
      reasons.push('هذا المسار مخصص للقطاع الحكومي.')
    }

    results.push({ pathwayId: p.id, eligible: reasons.length === 0, excludedReasons_ar: reasons })
  }
  return results
}
