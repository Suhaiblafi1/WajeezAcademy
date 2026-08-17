/* التفسير الكامل V2 — كل توصية تُشرح: ماذا فهمنا، لماذا المجال، لماذا المسار،
   ماذا قسنا (المقاس فقط)، ماذا لم نعرف، لماذا لم نختر الثاني، وما الذي قد يغيّر النتيجة. */

import { launchPathways, pathwaySkills } from '../catalog'
import type { FactBag } from '../types'
import { domainLabelAr, layersOfSkill } from './data'
import { personaLabelAr } from './personas'
import type { ConfidenceV2, DecisionContext, PathwayEligibility, V2Candidate, V2Explanation } from './types'

const FACT_SENTENCES_AR: Record<string, (v: unknown, raw?: string) => string | null> = {
  primary_goal: (v) =>
    ({
      employment_advancement: 'هدفك: وظيفة أو ترقية.',
      first_job: 'هدفك: أول فرصة مهنية.',
      promotion: 'هدفك: ترقية في عملك الحالي.',
      business_launch: 'هدفك: مشروع أو دخل مستقل.',
      revenue_growth: 'هدفك: تنمية إيراد مشروع قائم.',
      career_direction: 'هدفك: تغيير أو حسم اتجاهك المهني.',
      personal_growth: 'هدفك: نمو شخصي وثقافة عامة.',
      family_wellbeing: 'هدفك: أسرة ورفاه.',
      lead_team: 'هدفك: قيادة وتأثير.',
      explore: 'أنت في طور الاستكشاف — لم تحسم هدفًا بعد.',
    })[v as string] ?? null,
  weekly_load: (_v, raw) => (raw ? `وقتك الأسبوعي الواقعي: ${raw}.` : null),
  goal_clarity: (v) =>
    v === 'low' ? 'هدفك ما زال غير واضح تمامًا.' : v === 'high' ? 'هدفك واضح لديك.' : null,
  employment_state: (_v, raw) => (raw ? `وضعك العملي: ${raw}.` : null),
  business_stage: (v) =>
    ({
      idea: 'مشروعك ما زال فكرة.',
      validation: 'مشروعك في طور التحقق.',
      pre_revenue: 'مشروعك قبل أول إيراد.',
      early_revenue: 'مشروعك بدأ يبيع فعلًا.',
      growing: 'مشروعك ينمو.',
      established: 'مشروعك مستقر وقائم.',
    })[v as string] ?? null,
  sector: (v) => (v === 'public' ? 'تعمل في القطاع الحكومي.' : v === 'private' ? 'تعمل في القطاع الخاص.' : null),
  leadership_context: (v) => (v && v !== 'none' ? 'لديك سياق قيادي فعلي.' : null),
  application_readiness: (v) =>
    v === 'high' ? 'استعدادك للتطبيق العملي مرتفع.' : v === 'low' ? 'تفضّل وتيرة نظرية هادئة.' : null,
}

export function buildExplanation(
  facts: FactBag,
  ctx: DecisionContext,
  candidates: V2Candidate[],
  eligibility: PathwayEligibility[],
  confidence: ConfidenceV2,
  options: { catalogGap_ar: string | null; personalizationNotes_ar: string[] },
): V2Explanation {
  /* ما فهمناه — ٣ إلى ٥ حقائق بأعلى جودة دليل */
  const ordered = Object.entries(facts)
    .filter(([k, f]) => FACT_SENTENCES_AR[k] && f.evidenceQuality >= 0.6)
    .sort((a, b) => b[1].evidenceQuality - a[1].evidenceQuality)
  const understood = ordered
    .map(([k, f]) => FACT_SENTENCES_AR[k](f.value, f.raw))
    .filter((s): s is string => Boolean(s))
    .slice(0, 5)
  understood.unshift(`وصفك: ${personaLabelAr(ctx.persona.key)}.`)

  const top = candidates[0] ?? null
  const second = candidates[1] ?? null

  const domainReason = ctx.domains.top
    ? `المجال الأقرب: ${domainLabelAr(ctx.domains.top)} — بناءً على هدفك${
        facts['function_specialization'] ? ' وتخصصك الوظيفي' : ''
      }${facts['sector']?.value === 'public' ? ' وقطاعك الحكومي' : ''}.`
    : 'لم يُحسم مجال بعد — الأدلة غير كافية.'

  const pathwayReasons = top ? top.reasons_ar.slice(0, 3) : []

  /* المقاس فقط — مهارة مجهولة لا تظهر هنا أبدًا */
  const measured = top
    ? assessMeasured(top.pathwayId, ctx)
    : []
  const unknown = top
    ? pathwaySkills(top.pathwayId)
        .filter((s) => !ctx.skillStates.has(s.slug) && (layersOfSkill(s.slug)?.active ?? true))
        .map((s) => ({ slug: s.slug, name_ar: s.nameAr }))
    : []

  const notKnown: string[] = []
  if (!facts['weekly_load']) notKnown.push('وقتك الأسبوعي المتاح')
  if (!facts['goal_clarity']) notKnown.push('مدى وضوح هدفك')
  if (unknown.length > 0) notKnown.push(`${unknown.length} من مهارات المسار لم تُقس بدليل مباشر`)
  if (confidence.strongBlockers_ar.length > 0) notKnown.push(...confidence.strongBlockers_ar)

  const whyNotSecond =
    top && second
      ? `لم نختر «${pathwayTitle(second.pathwayId)}» لأن ${second.pathwayId === top.pathwayId ? '—' : secondReason(facts, second, eligibility)}`
      : null

  const changeMakers: string[] = []
  if (second) changeMakers.push('إجابات مختلفة عن وضعك العملي أو هدفك قد تنقلك إلى المسار الثاني.')
  if (ctx.domains.contested) changeMakers.push('سؤال فاصل عن مجال عملك قد يبدّل المجال المتصدر.')
  if (top && top.measuredSkillCoverage < 1) changeMakers.push('قياس بقية مهارات المسار قد يرفع أو يخفض ترتيبه.')
  if (!facts['weekly_load']) changeMakers.push('تحديد وقتك الأسبوعي قد يغيّر جدوى المسار.')

  const confidenceHuman = {
    strong_match: 'أدلة قوية ومتسقة — هذه التوصية مفسَّرة ومطمئنة.',
    best_current_match: 'هذا أفضل تطابق بما عرفناه حتى الآن — جولة تدقيق قصيرة ترفع اليقين.',
    exploratory_direction: 'الاتجاه استكشافي — نرشدك لبداية آمنة لا لحسم نهائي.',
    advisor_review: 'الصورة تحتاج عينًا بشرية — مستشار يراجع إجاباتك معك.',
  }[confidence.outputKind]

  return {
    persona_key: ctx.persona.key,
    persona_label_ar: personaLabelAr(ctx.persona.key),
    understood_facts_ar: understood.slice(0, 5),
    domain_top: ctx.domains.top,
    domain_label_ar: ctx.domains.top ? domainLabelAr(ctx.domains.top) : null,
    domain_reason_ar: domainReason,
    pathway_reasons_ar: pathwayReasons,
    measured_skills: measured,
    unknown_skills: unknown,
    not_known_ar: [...new Set(notKnown)],
    why_not_second_ar: whyNotSecond,
    change_makers_ar: changeMakers,
    confidence_human_ar: confidenceHuman,
    output_kind: confidence.outputKind,
    catalog_gap_ar: options.catalogGap_ar,
    personalization_notes_ar: options.personalizationNotes_ar,
  }
}

function assessMeasured(pathwayId: string, ctx: DecisionContext) {
  return pathwaySkills(pathwayId)
    .filter((s) => ctx.skillStates.get(s.slug)?.state === 'measured')
    .map((s) => ({ slug: s.slug, name_ar: s.nameAr, level: ctx.skillStates.get(s.slug)!.level! }))
}

function pathwayTitle(id: string): string {
  return launchPathways.find((p) => p.id === id)?.title ?? id
}

function secondReason(_facts: FactBag, second: V2Candidate, eligibility: PathwayEligibility[]): string {
  const ex = eligibility.find((e) => e.pathwayId === second.pathwayId)
  if (ex && !ex.eligible && ex.excludedReasons_ar.length > 0) return ex.excludedReasons_ar[0]
  if (second.breakdown.goal < 0.5) return 'هدفك المعلن أقرب للمسار الأول.'
  if (second.breakdown.persona < 0.5) return 'وصفك الحالي أقرب لجمهور المسار الأول.'
  if (second.breakdown.domain < 0.5) return 'مجالك الظاهر من إجاباتك يخدم المسار الأول.'
  if (second.breakdown.feasibility < 0.5) return 'وقتك المتاح يناسب المسار الأول أكثر.'
  return 'الفارق التراكمي بينهما صغير لكنه ثابت لصالح الأول.'
}
