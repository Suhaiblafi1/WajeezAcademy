/* Golden Suite V2.1 — بند 16: لكل كيان نشط من الـ31 بحث شامل عن توليفة إشارات
   منتِجة (مرحلة × هدف × احتياج × وظيفة × إتقان) تجعله يفوز — الحالة canonical.
   من لا تفوز له أي توليفة → needs_academic_review موثقًا بأفضل محاولة.
   لكل كيان أيضًا: near-miss + حالة سلبية. ثم variants حتمية (≥900 جلسة)،
   ثم Monte Carlo بذرة مزروعة (--montecarlo [seed] [sessions]).
   الناتج: docs/diagnostic-v2_1/golden-reachability.json + montecarlo-v2_1.json
   الاستخدام: npx tsx scripts/v2_1/golden-suite.ts [--montecarlo] [--debug=<entityId>] */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createEngineV21, type RecommendationV21 } from '../../src/domain/diagnostic/v2_1'
import { GOALS_V21, NEEDS_V21, Q, type CareerStage } from '../../src/domain/diagnostic/v2_1/maps'
import type { DomainId } from '../../src/domain/diagnostic/v2/types'
import { recommendationUniverse, type RecommendationEntity } from '../../src/domain/diagnostic/v2_1/universe'
import type { CompetitionResult } from '../../src/domain/diagnostic/v2_1/compete'
import { functionDomainsV2 } from '../../src/domain/diagnostic/v2/data'
import { optionEffects, questionById } from '../../src/domain/diagnostic/catalog'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const outDir = join(root, 'docs', 'diagnostic-v2_1')

/** حقائق آخر جلسة — للتفكيك فقط */
let lastFacts: Record<string, unknown> = {}

/* ─── جلسة حتمية بإجابات نصية ─── */
interface Journey {
  stage: CareerStage
  employment?: string
  goal?: string
  need?: string
  mastery?: string
  interest?: string
  answers?: Record<string, string>
  skillLevel?: number
}

const STAGE_LABEL: Record<CareerStage, string> = {
  university_student: 'طالب جامعي',
  fresh_graduate: 'خريج حديث',
  early_career: 'موظف في بداية مساري المهني',
  experienced: 'موظف ذو خبرة',
  manager: 'مدير / قائد فريق',
  senior_manager: 'مدير أول / تنفيذي',
  founder: 'مؤسس / صاحب عمل',
  freelancer: 'مستقل — أعمل لحسابي',
  trainer_ld: 'مدرب / معلم / مختص تعلم وتطوير',
  other_unsure: 'غير ذلك / غير متأكد',
}
const ALL_STAGES = Object.keys(STAGE_LABEL) as CareerStage[]

const MASTERY_ONE = 'أن أتقن مهارة أو تخصصًا واحدًا بعمق'
const MASTERY_SET = 'أن أبني مجموعة مهارات مترابطة لتحقيق هدف'
const MASTERY_UNSURE = 'غير متأكد'

/** خيارات سؤال الميول QB-M3E-002 → مجالاتها (من option-effects الموثق) */
const INTEREST_DOMAINS: Record<string, DomainId[]> = {
  تقنية: ['ai_productivity', 'data_decision', 'cyber_risk'],
  أعمال: ['entrepreneurship', 'operations', 'project_management'],
  تسويق: ['marketing_growth', 'sales'],
  تعليم: ['learning_design'],
  'صناعة محتوى': ['communication_influence', 'marketing_growth'],
  قيادة: ['people_leadership'],
  'حكومة/سياسات': ['gov_services'],
  مالية: ['finance_mgmt'],
  'لا أعرف': [],
}

/** خيارات سؤال الوظيفة QB-M3B-011 → رمز الوظيفة ومجالاتها */
const FN_Q = 'QB-M3B-011'
const FN_OPTIONS: { label: string; domains: DomainId[] }[] = (questionById.get(FN_Q)?.options_ar ?? []).map(
  (label, i) => {
    const code = (optionEffects[FN_Q]?.[`o${i + 1}`] as { function_specialization?: string } | undefined)
      ?.function_specialization
    return { label, domains: code ? (functionDomainsV2[code] ?? []) : [] }
  },
)

interface RunOutcome {
  asked: string[]
  rec: RecommendationV21
  comp: CompetitionResult
  trace?: { kind: string; summary_ar: string }[]
}

function runJourney(name: string, script: Journey): RunOutcome {
  const engine = createEngineV21(`golden-${name}`)
  const asked: string[] = []
  for (let i = 0; i < 20; i++) {
    const step = engine.nextQuestion()
    if (step.stop.shouldStop || !step.question) break
    const q = step.question
    asked.push(q.question_id)
    const byLabel = (l?: string): number => (l ? q.options_ar.indexOf(l) : -1)
    let idx = -1
    const explicit = script.answers?.[q.question_id]
    if (explicit !== undefined) idx = byLabel(explicit)
    if (idx < 0) {
      if (q.question_id === Q.STAGE) idx = byLabel(STAGE_LABEL[script.stage])
      else if (q.question_id === Q.EMPLOYMENT) idx = byLabel(script.employment ?? 'أعمل لدى جهة')
      else if (q.question_id === Q.GOAL) idx = byLabel(script.goal ?? '')
      else if (q.question_id === Q.NEED) idx = byLabel(script.need ?? '')
      else if (q.question_id === Q.MASTERY) idx = byLabel(script.mastery ?? MASTERY_UNSURE)
      else if (q.question_id === 'QB-M3E-002') idx = byLabel(script.interest ?? 'لا أعرف')
      else if (q.answer_type === 'skill_level_5' || q.answer_type === 'likert_5') idx = (script.skillLevel ?? 3) - 1
      else idx = 0
      if (idx < 0) idx = 0
    }
    const label = q.options_ar[idx]
    const realId = q.active_option_ids?.[idx] ?? `o${idx + 1}`
    engine.answer({ questionId: q.question_id, value: label, optionIds: [realId] })
  }
  const facts = engine.getState().facts
  lastFacts = Object.fromEntries(
    ['career_stage', 'primary_goal', 'goal_code_v21', 'need_id', 'interest_domains', 'function_specialization', 'weekly_load', 'mastery_portfolio_pref', 'sector']
      .filter((k) => facts[k] !== undefined)
      .map((k) => [k, facts[k].value]),
  )
  return { asked, rec: engine.recommend(), comp: engine.competeSnapshot(), trace: engine.getState().trace.map((t) => ({ kind: t.kind, summary_ar: t.summary_ar })) }
}

/** الفائز الفعلي — يُقرأ الكيان المرفق حتى لو وُسم التوصية بمراجعة مستشار */
function winnerOf(rec: RecommendationV21): string | null {
  if (rec.composite) return rec.composite.templateId
  if (rec.primaryPathway) return rec.primaryPathway.pathwayId
  return null
}

/* ─── توليد التوليفات canonical لكيان ─── */
function* combosFor(e: RecommendationEntity): Generator<Journey> {
  const stages = e.career_stages.length > 0 ? e.career_stages : ALL_STAGES
  /* بناء قوائم كل مرحلة أولًا */
  const perStage = stages.map((stage) => {
    const ok = (s: CareerStage[] | 'all') => s === 'all' || s.includes(stage)
    const goals = GOALS_V21.filter((g) => ok(g.stages) && e.reachable_goals.includes(g.legacy_goal))
    /* المرحلة 4: كيان يدخل من الاحتياج/المجال قد يفوز لمستخدم هدفه مختلف —
       نجرّب أيضًا أهدافًا مجالاتها تتقاطع مع مجالات الكيان وإن لم تكن في قائمته */
    const crossGoals = GOALS_V21.filter(
      (g) => ok(g.stages) && !e.reachable_goals.includes(g.legacy_goal) && g.domains.some((d) => e.domains.includes(d)),
    )
    /* المرحلة 4 (STRATEGY): قالب يدخل من الاحتياج/المجال قد يفوز لمستخدم هدفه
       محايد مجاليًا (لا مجالات له فيُحرم المسار القياسي من إشارة هدفه) — نجرّب
       الأهداف المحايدة بعد المتقاطعة وإن لم تتقاطع مع مجالات الكيان */
    const neutralGoals =
      e.entity_type === 'composite'
        ? GOALS_V21.filter(
            (g) => ok(g.stages) && !e.reachable_goals.includes(g.legacy_goal) && g.domains.length === 0 && g.legacy_goal !== 'explore',
          )
        : []
    /* أهداف بتقاطع مجالات أولًا، ثم المحايدة (للقوالب)، ثم بقية الأهداف، ثم بلا هدف محدد */
    const goalList: (string | undefined)[] = [
      ...goals.filter((g) => g.domains.some((d) => e.domains.includes(d))).map((g) => g.label_ar),
      ...goals.filter((g) => !g.domains.some((d) => e.domains.includes(d))).map((g) => g.label_ar),
      ...crossGoals.map((g) => g.label_ar),
      ...neutralGoals.map((g) => g.label_ar),
      undefined,
    ]
    const needs = NEEDS_V21.filter((n) => ok(n.stages) && e.needs.includes(n.code))
    /* احتياج subset من مجالات الكيان أولًا */
    const needList: (string | undefined)[] = [
      ...needs.filter((n) => n.domains.length > 0 && n.domains.every((d) => e.domains.includes(d))).map((n) => n.label_ar),
      ...needs.filter((n) => !(n.domains.length > 0 && n.domains.every((d) => e.domains.includes(d)))).map((n) => n.label_ar),
      undefined,
    ]
    return { stage, goalList, needList }
  })
  /* تخلّل هدف-خارجي: الهدف الأول لكل المراحل، ثم الثاني... — وصفة قالب قد تتطلب
     مرحلة متأخرة في القائمة (ECOM يفوز لمستقل لا لمؤسس) فلا يستنزف سقف البحث */
  const stageGoalPairs: { stage: CareerStage; goal?: string; needList: (string | undefined)[] }[] = []
  const maxGoals = Math.max(...perStage.map((p) => p.goalList.length))
  for (let gi = 0; gi < maxGoals; gi++)
    for (const p of perStage)
      if (gi < p.goalList.length) stageGoalPairs.push({ stage: p.stage, goal: p.goalList[gi], needList: p.needList })
  /* وظيفة بمجالات داخل مجالات الكيان (تُستخدم فقط إن سُئلت) */
  const fnChoices: (string | undefined)[] = [
    undefined,
    ...FN_OPTIONS.filter((f) => f.domains.some((d) => e.domains.includes(d))).map((f) => f.label),
  ]
  const masteries = e.entity_type === 'composite' ? [MASTERY_SET, MASTERY_UNSURE] : [MASTERY_ONE, MASTERY_UNSURE]
  /* القوالب تشترط استعدادًا تطبيقيًا مرتفعًا في إشاراتها المعلنة — البحث يجرّب
     مستخدمًا جادًا فعلًا (readiness=high) وإلا حُكم على القالب بإجابة افتراضية لا شخصية حقيقية */
  const readinessChoices: (string | undefined)[] = e.entity_type === 'composite' ? ['عالية', undefined] : [undefined]
  /* المرحلة 4: بعد تفعيل حد الدليل الأدنى تدخل أسئلة المهارات الرحلة فعلًا،
     فيُجرَّب المستخدم المتقدم (4) لا المتدني (2) فقط — قالب يفترض أهلية مكوّناته
     يفوز لمستخدم يتقن بعضها وينقصه التركيب، لا لمن ينقصه كل شيء */
  const skillLevels = e.entity_type === 'composite' ? [2, 4] : [2]
  for (const { stage, goal, needList } of stageGoalPairs)
    for (const need of needList)
      for (const fn of fnChoices)
        for (const mastery of masteries)
          for (const readiness of readinessChoices)
            for (const skillLevel of skillLevels) {
              const answers: Record<string, string> = {}
              /* كيان يضم مجال الخدمات الحكومية يُجرَّب بقطاع عام (CX يدخل من gov_services + operations) */
              if (e.entity_id === 'PW-GOV-002' || e.domains.includes('gov_services')) answers['QB-M3B-001'] = 'حكومي'
              if (fn) answers[FN_Q] = fn
              if (readiness) answers['QB-M2-015'] = readiness
              /* اتساق الشخصية: مستقل/مؤسس لا «يعمل لدى جهة» — التناقض يبدّل persona_type
                 ويحرم قوالب ريادة الأعمال من إشاراتها (ECOM فُقدت بهذا السبب) */
              const employment =
                stage === 'freelancer' ? 'أعمل لحسابي (عمل حر)' : stage === 'founder' ? 'لدي مشروعي الخاص' : undefined
              yield { stage, goal, need, mastery, answers, skillLevel, employment }
            }
}

interface CaseResult {
  winner: string | null
  kind: string
  confidence: number
  won: boolean
  askedCount: number
  eligible: boolean
  excludedReasons_ar: string[]
  entityNetFit: number | null
  winnerNetFit: number | null
  recipe?: { stage: string; goal?: string; need?: string; fn?: string; mastery?: string }
}

function toCaseResult(e: RecommendationEntity, out: RunOutcome, j?: Journey): CaseResult {
  const winner = winnerOf(out.rec)
  const elig = out.comp.eligibility.find((x) => x.entityId === e.entity_id)
  const self = out.comp.candidates.find((c) => c.entity.entity_id === e.entity_id)
  const win = out.comp.candidates.find((c) => c.entity.entity_id === winner)
  return {
    winner,
    kind: out.rec.kind,
    confidence: Math.round(out.rec.confidence.total * 100) / 100,
    won: winner === e.entity_id,
    askedCount: out.asked.length,
    eligible: elig?.eligible ?? false,
    excludedReasons_ar: elig?.excludedReasons_ar ?? [],
    entityNetFit: self ? Math.round(self.netFit * 1000) / 1000 : null,
    winnerNetFit: win ? Math.round(win.netFit * 1000) / 1000 : null,
    recipe: j
      ? { stage: STAGE_LABEL[j.stage], goal: j.goal, need: j.need, fn: j.answers?.[FN_Q], mastery: j.mastery }
      : undefined,
  }
}

const MAX_COMBOS = 6000

/** بحث شامل: أول توليفة تفوز = canonical. وإلا أفضل محاولة (أصغر هامش خسارة) */
function findCanonical(e: RecommendationEntity): { journey: Journey; result: CaseResult; tried: number; won: boolean } {
  let tried = 0
  let best: { journey: Journey; result: CaseResult } | null = null
  for (const j of combosFor(e)) {
    if (tried >= MAX_COMBOS) break
    tried++
    const out = runJourney(`${e.entity_id}-s${tried}`, j)
    const res = toCaseResult(e, out, j)
    if (res.won) return { journey: j, result: res, tried, won: true }
    if (!best) {
      best = { journey: j, result: res }
    } else {
      const margin = (r: CaseResult) =>
        r.entityNetFit !== null && r.winnerNetFit !== null ? r.winnerNetFit - r.entityNetFit : Number.POSITIVE_INFINITY
      if (margin(res) < margin(best.result)) best = { journey: j, result: res }
    }
  }
  return { journey: best!.journey, result: best!.result, tried, won: false }
}

/** near-miss: نفس التوليفة الفائزة لكن بلا تفضيل منظومة وبمستوى مهاري متوسط */
function nearMissOf(j: Journey): Journey {
  return { ...j, mastery: MASTERY_UNSURE, skillLevel: 3 }
}

/** حالة سلبية: احتياج بعيد المجال تمامًا (نفس المرحلة) */
function negativeOf(e: RecommendationEntity, j: Journey): Journey {
  const ok = (s: CareerStage[] | 'all') => s === 'all' || s.includes(j.stage)
  const farNeed = NEEDS_V21.find(
    (n) => ok(n.stages) && n.domains.length > 0 && !n.domains.some((d) => e.domains.includes(d)),
  )
  const farGoal = GOALS_V21.find(
    (g) => ok(g.stages) && g.domains.length > 0 && !g.domains.some((d) => e.domains.includes(d)),
  )
  return { ...j, goal: farGoal?.label_ar ?? j.goal, need: farNeed?.label_ar, mastery: MASTERY_UNSURE, answers: {}, skillLevel: 4 }
}

/* ─── التشغيل الرئيس ─── */
const universe = recommendationUniverse()
const active = universe.active

/* وضع التفكيك: --debug=<entityId> */
const debugArg = process.argv.find((a) => a.startsWith('--debug='))
if (debugArg) {
  const id = debugArg.split('=')[1]
  const e = universe.byId.get(id)
  if (!e) {
    console.error(`كيان غير معروف: ${id}`)
    process.exit(1)
  }
  const found = findCanonical(e)
  console.log(`\n═══ تفكيك ${id} [${e.entity_type}] ═══`)
  console.log('فاز؟', found.won, '| محاولات:', found.tried)
  console.log('التوليفة:', JSON.stringify(found.result.recipe, null, 1))
  const out = runJourney(`${id}-debug`, found.journey)
  console.log('الأسئلة:', out.asked.join(' '))
  console.log('حقائق:', JSON.stringify(lastFacts, null, 1))
  for (const c of out.comp.candidates.slice(0, 8)) {
    console.log(`  ${c.entity.entity_id} [${c.entity.entity_type}] fit=${c.fit.toFixed(3)} burden=${c.burden.toFixed(3)} net=${c.netFit.toFixed(3)}`)
  }
  console.log('bestStandard:', out.comp.bestStandard?.entity.entity_id, '| challenger:', out.comp.bestComposite?.entity.entity_id ?? '—')
  console.log('victory:', JSON.stringify(out.comp.compositeVictory, null, 1))
  console.log('النتيجة:', out.rec.kind, '| primary:', out.rec.primaryPathway?.pathwayId ?? '—', '| composite:', out.rec.composite?.templateId ?? '—')
  process.exit(0)
}

const golden: Record<
  string,
  { type: string; tried: number; positive: CaseResult; near_miss: CaseResult; negative: CaseResult; verdict: string }
> = {}
let reachableCount = 0

for (const e of active) {
  const found = findCanonical(e)
  const nm = toCaseResult(e, runJourney(`${e.entity_id}-nm`, nearMissOf(found.journey)), nearMissOf(found.journey))
  const negJ = negativeOf(e, found.journey)
  const neg = toCaseResult(e, runJourney(`${e.entity_id}-neg`, negJ), negJ)
  const verdict = found.won ? 'reachable' : 'needs_academic_review'
  if (found.won) reachableCount++
  golden[e.entity_id] = { type: e.entity_type, tried: found.tried, positive: found.result, near_miss: nm, negative: neg, verdict }
}

console.log(`\n═══ Golden Suite — ${active.length} كيانًا ═══`)
console.log(`reachable: ${reachableCount}/${active.length}`)
for (const [id, g] of Object.entries(golden)) {
  const mark = g.verdict === 'reachable' ? '✓' : '✗'
  console.log(
    `${mark} ${id} [${g.type}] tried=${g.tried} pos=${g.positive.winner ?? '—'} (${g.positive.kind}) | nearMiss won=${g.near_miss.won} | neg won=${g.negative.won}`,
  )
}

/* ─── variants حتمية — انطلاقًا من التوليفة canonical لكل كيان ─── */
const variantRuns: { id: string; winner: string | null; kind: string }[] = []
let determinismChecked = 0
let determinismFailures = 0
const determinismLog: string[] = []

for (const e of active) {
  const g = golden[e.entity_id]
  const base = g.positive.recipe
  const baseJourney: Journey = {
    stage: (Object.keys(STAGE_LABEL) as CareerStage[]).find((s) => STAGE_LABEL[s] === base?.stage) ?? e.career_stages[0] ?? 'experienced',
    goal: base?.goal,
    need: base?.need,
    mastery: base?.mastery,
    answers: base?.fn ? { [FN_Q]: base.fn } : e.entity_id === 'PW-GOV-002' ? { 'QB-M3B-001': 'حكومي' } : {},
    skillLevel: 2,
  }
  const masteries = e.entity_type === 'composite' ? [MASTERY_SET, MASTERY_UNSURE] : [MASTERY_ONE, MASTERY_UNSURE]
  for (const skillLevel of [1, 2, 3, 4, 5]) {
    /* بُعد الوقت الأسبوعي أُسقط من التوليفات مع تقاعد سؤاله: كان يضاعف كل
       تشغيل أربع مرات بنتائج متطابقة حرفيًا. */
    {
      for (const mastery of masteries) {
        const variant: Journey = { ...baseJourney, skillLevel, mastery }
        const name = `${e.entity_id}-v${skillLevel}-${mastery}`
        const out = runJourney(name, variant)
        const winner = winnerOf(out.rec)
        variantRuns.push({ id: name, winner, kind: out.rec.kind })
        if (variantRuns.length % 9 === 0) {
          const again = runJourney(name, variant)
          determinismChecked++
          const f1 = JSON.stringify([out.asked, winner, out.rec.kind, out.rec.confidence.total])
          const f2 = JSON.stringify([again.asked, winnerOf(again.rec), again.rec.kind, again.rec.confidence.total])
          if (f1 !== f2) {
            determinismFailures++
            determinismLog.push(`${name}: ${f1} ≠ ${f2}`)
          }
        }
      }
    }
  }
}

const validKinds = new Set(['single_pathway', 'composite_template', 'exploratory_direction', 'advisor_referral'])
const activeIds = new Set(active.map((e) => e.entity_id))
const invalidVariant = variantRuns.filter((r) => !validKinds.has(r.kind))
const alienWinner = variantRuns.filter((r) => r.winner !== null && !activeIds.has(r.winner))
console.log(`\n═══ variants: ${variantRuns.length} جلسة ═══`)
console.log(`أنواع نتائج غير صالحة: ${invalidVariant.length} · فائز خارج الفضاء النشط: ${alienWinner.length}`)
console.log(`حتمية: ${determinismChecked} إعادة تحقق · إخفاقات: ${determinismFailures}`)

/* ─── Monte Carlo مزروع البذرة ─── */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T,>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]

interface McStats {
  sessions: number
  seed: number
  kind: Record<string, number>
  /* توزيع نطاقات الثقة (البند: Confidence Calibration) — معايرة إغلاق منطق V2.1:
     لا «قوية» إلا بدليل مكتمل، ولا تضخيم في السباقات الحية الناقصة */
  confidenceBands: Record<string, number>
  winners: Record<string, number>
  avgQuestions: number
  exploratoryRate: number
  advisorRate: number
  alienWinners: number
  errors: number
  determinismProbe: { sample: number; mismatches: number }
  /* تغطية الدليل المهاري للفائز (البند: Skill Evidence Coverage) —
     المهارة المجهولة لا تُحتسب دليلًا؛ التوصية الصامتة بلا أي مهارة حاسمة مقاسة
     ممنوعة (يجب 0)؛ الموسومة بمراجعة مستشار تُعدّ معلنة لا صامتة */
  skillEvidence: {
    sessionsWithWinner: number
    zeroSkillEvidence: number
    decisiveSessions: number
    decisiveNoneMeasuredSilent: number
    decisiveNoneMeasuredAdvisorFlagged: number
    with1PlusDecisive: number
    with2PlusDecisive: number
    avgDecisiveCoverage: number
    avgMeasuredCoverage: number
  }
}

function monteCarloRun(seed: number, sessions: number, offset = 0): { stats: McStats; fingerprints: string[] } {
  const rng = mulberry32(seed + offset)
  const stats: McStats = {
    sessions,
    seed: seed + offset,
    kind: {},
    confidenceBands: {},
    winners: {},
    avgQuestions: 0,
    exploratoryRate: 0,
    advisorRate: 0,
    alienWinners: 0,
    errors: 0,
    determinismProbe: { sample: 0, mismatches: 0 },
    skillEvidence: {
      sessionsWithWinner: 0,
      zeroSkillEvidence: 0,
      decisiveSessions: 0,
      decisiveNoneMeasuredSilent: 0,
      decisiveNoneMeasuredAdvisorFlagged: 0,
      with1PlusDecisive: 0,
      with2PlusDecisive: 0,
      avgDecisiveCoverage: 0,
      avgMeasuredCoverage: 0,
    },
  }
  const fingerprints: string[] = []
  let totalQuestions = 0
  let sumDecisiveCoverage = 0
  let sumMeasuredCoverage = 0
  for (let i = 0; i < sessions; i++) {
    try {
      const stage = pick(rng, ALL_STAGES)
      const goals = GOALS_V21.filter((g) => g.stages === 'all' || g.stages.includes(stage))
      const needs = NEEDS_V21.filter((n) => n.stages === 'all' || n.stages.includes(stage))
      const script: Journey = {
        stage,
        employment: pick(rng, ['أعمل لدى جهة', 'لا أعمل حاليًا', 'لدي مشروعي الخاص']),
        goal: pick(rng, goals).label_ar,
        need: pick(rng, needs).label_ar,
        mastery: pick(rng, [MASTERY_ONE, MASTERY_SET, MASTERY_UNSURE]),
        interest: pick(rng, Object.keys(INTEREST_DOMAINS)),
        skillLevel: 1 + Math.floor(rng() * 5),
        answers: rng() < 0.15 ? { 'QB-M3B-001': 'حكومي' } : undefined,
      }
      const out = runJourney(`mc-${seed + offset}-${i}`, script)
      const winner = winnerOf(out.rec)
      stats.kind[out.rec.kind] = (stats.kind[out.rec.kind] ?? 0) + 1
      const band = out.rec.confidence.band
      stats.confidenceBands[band] = (stats.confidenceBands[band] ?? 0) + 1
      if (winner) {
        stats.winners[winner] = (stats.winners[winner] ?? 0) + 1
        if (!activeIds.has(winner)) stats.alienWinners++
      }
      if (out.rec.kind === 'exploratory_direction') stats.exploratoryRate++
      if (out.rec.kind === 'advisor_referral') stats.advisorRate++
      totalQuestions += out.asked.length
      /* تغطية الدليل المهاري للكيان الفائز — «الاعتماد على حاسمة مجهولة» يُحسب
         في السباقات الحية فقط (هامش أول اثنين < 0.15): هناك كان يمكن للدليل أن
         يقلب النتيجة. السباق المريح فوزه مبني على هدف/مجال/سياق لا على مهارات */
      const wCand = winner ? out.comp.candidates.find((c) => c.entity.entity_id === winner) : undefined
      if (wCand) {
        const se = stats.skillEvidence
        se.sessionsWithWinner++
        if (wCand.skills.measuredCoverage === 0) se.zeroSkillEvidence++
        sumMeasuredCoverage += wCand.skills.measuredCoverage
        const decisive = wCand.entity.skill_roles.decisive
        const liveMargin = out.comp.candidates.length >= 2 ? out.comp.candidates[0].netFit - out.comp.candidates[1].netFit : 1
        if (decisive.length > 0 && liveMargin < 0.15) {
          const unknownSet = new Set(wCand.skills.unknownSkillSlugs)
          const measuredDecisive = decisive.filter((s) => !unknownSet.has(s)).length
          se.decisiveSessions++
          sumDecisiveCoverage += measuredDecisive / decisive.length
          if (measuredDecisive === 0) {
            if (out.rec.kind === 'advisor_referral') se.decisiveNoneMeasuredAdvisorFlagged++
            else {
              se.decisiveNoneMeasuredSilent++
              if (process.argv.includes('--debug-silent')) {
                console.error(`صامتة #${se.decisiveNoneMeasuredSilent}: winner=${winner} margin=${liveMargin.toFixed(3)} asked=${out.asked.length} kind=${out.rec.kind}`)
                console.error(`  decisive=${decisive.join(',')} unknown=${wCand.skills.unknownSkillSlugs.filter((s) => decisive.includes(s)).join(',')}`)
                console.error(`  asked: ${out.asked.join(' ')}`)
                console.error(`  facts: ${JSON.stringify(lastFacts)}`)
                console.error(`  trace: ${(out.trace ?? []).map((t) => t.summary_ar.split('—')[0].split(':')[0].trim()).join(' | ')}`)
              }
            }
          }
          if (measuredDecisive >= 1) se.with1PlusDecisive++
          if (measuredDecisive >= 2) se.with2PlusDecisive++
        }
      }
      if (i < 200) fingerprints.push(JSON.stringify([out.asked, winner, out.rec.kind, Math.round(out.rec.confidence.total * 1000)]))
    } catch (err) {
      stats.errors++
      console.error(`خطأ في جلسة mc-${i}:`, (err as Error).message)
    }
  }
  stats.avgQuestions = Math.round((totalQuestions / sessions) * 100) / 100
  stats.exploratoryRate = Math.round((stats.exploratoryRate / sessions) * 10000) / 10000
  stats.advisorRate = Math.round((stats.advisorRate / sessions) * 10000) / 10000
  const se = stats.skillEvidence
  se.avgDecisiveCoverage = se.decisiveSessions > 0 ? Math.round((sumDecisiveCoverage / se.decisiveSessions) * 10000) / 10000 : 1
  se.avgMeasuredCoverage = se.sessionsWithWinner > 0 ? Math.round((sumMeasuredCoverage / se.sessionsWithWinner) * 10000) / 10000 : 1
  return { stats, fingerprints }
}

mkdirSync(outDir, { recursive: true })
writeFileSync(
  join(outDir, 'golden-reachability.json'),
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      universe_active: active.length,
      reachable: reachableCount,
      golden,
      variants: {
        total: variantRuns.length,
        invalid_kind: invalidVariant.length,
        alien_winner: alienWinner.length,
        determinism_checked: determinismChecked,
        determinism_failures: determinismFailures,
        determinism_log: determinismLog.slice(0, 20),
        kind_distribution: variantRuns.reduce<Record<string, number>>((m, r) => ((m[r.kind] = (m[r.kind] ?? 0) + 1), m), {}),
        winner_distribution: variantRuns.reduce<Record<string, number>>(
          (m, r) => (r.winner ? ((m[r.winner] = (m[r.winner] ?? 0) + 1), m) : m),
          {},
        ),
      },
    },
    null,
    2,
  ),
)
console.log(`\nكتب: docs/diagnostic-v2_1/golden-reachability.json`)

if (process.argv.includes('--montecarlo')) {
  const args = process.argv.filter((a) => /^\d+$/.test(a))
  const seed = Number(args[0] ?? 20260818)
  const sessions = Number(args[1] ?? 10000)
  console.log(`\n═══ Monte Carlo: ${sessions} جلسة بذرة ${seed} ═══`)
  const t0 = Date.now()
  const main = monteCarloRun(seed, sessions)
  /* حتمية MC: أعد تشغيل أول 200 جلسة بنفس البذرة — يجب تطابق البصمات */
  const probe = monteCarloRun(seed, 200)
  const mismatches = main.fingerprints.filter((f, i) => f !== probe.fingerprints[i]).length
  main.stats.determinismProbe = { sample: 200, mismatches }
  writeFileSync(join(outDir, 'montecarlo-v2_1.json'), JSON.stringify(main.stats, null, 2))
  console.log(`kind:`, main.stats.kind)
  console.log(`أعلى 10 فائزين:`, Object.entries(main.stats.winners).sort((a, b) => b[1] - a[1]).slice(0, 10))
  console.log(`نطاقات الثقة:`, main.stats.confidenceBands)
  console.log(
    `متوسط الأسئلة: ${main.stats.avgQuestions} · استكشاف: ${main.stats.exploratoryRate * 100}٪ · مستشار: ${main.stats.advisorRate * 100}٪`,
  )
  console.log(`فائزون خارج الفضاء: ${main.stats.alienWinners} · أخطاء: ${main.stats.errors} · حتمية MC (200): ${mismatches === 0 ? 'مطابقة تامة' : mismatches + ' اختلافًا!'}`)
  const se = main.stats.skillEvidence
  console.log(
    `الدليل المهاري: صفر دليل ${se.zeroSkillEvidence}/${se.sessionsWithWinner} · حاسمة بلا قياس — صامتة ${se.decisiveNoneMeasuredSilent} · موسومة بمستشار ${se.decisiveNoneMeasuredAdvisorFlagged}/${se.decisiveSessions}` +
      ` · ≥1 حاسمة ${se.with1PlusDecisive} · ≥2 حاسمتين ${se.with2PlusDecisive} · متوسط تغطية الحاسمة ${se.avgDecisiveCoverage * 100}٪ · متوسط التغطية ${se.avgMeasuredCoverage * 100}٪`,
  )
  console.log(`المدة: ${((Date.now() - t0) / 1000).toFixed(1)}ث`)
  console.log(`كتب: docs/diagnostic-v2_1/montecarlo-v2_1.json`)
  if (mismatches > 0 || main.stats.errors > 0 || main.stats.alienWinners > 0 || se.decisiveNoneMeasuredSilent > 0) {
    console.error('\nفشلت بوابة Monte Carlo')
    process.exit(1)
  }
}

/* بوابة الفشل */
const failures: string[] = []
if (invalidVariant.length > 0) failures.push(`${invalidVariant.length} variant بنوع نتيجة غير صالح`)
if (alienWinner.length > 0) failures.push(`${alienWinner.length} variant بفائز خارج الفضاء النشط`)
if (determinismFailures > 0) failures.push(`${determinismFailures} إخفاق حتمية`)
if (failures.length > 0) {
  console.error('\nفشلت البوابة: ' + failures.join(' · '))
  process.exit(1)
}
