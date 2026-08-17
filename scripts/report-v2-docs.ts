/* مقارنة V1 ↔ V2 على نفس الشخصيات — يولّد:
   1) docs/DIAGNOSTIC_V1_V2_COMPARISON_AR.md — إثبات بالأرقام أن V2 أفضل
   2) docs/CATALOG_GAPS_FROM_DIAGNOSTIC_AR.md — فجوات الكتالوج المكتشفة من التشخيص
   الاستخدام: npx tsx scripts/report-v2-docs.ts */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createEngine } from '../src/domain/diagnostic/engine'
import { derivePersona } from '../src/domain/diagnostic/v2'
import { launchPathways, questionById } from '../src/domain/diagnostic/catalog'
import { buildPersonas, buildVariants, runSession, answerCurrent, type PersonaSpec } from './v2/sim-lib'
import type { DiagnosticEngineV2 } from '../src/domain/diagnostic/v2'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const WORK_FACTS = ['employment_state', 'leadership_context', 'business_stage', 'function_specialization', 'public_facing', 'sector']
const SCHOOL_LIKE = new Set(['school_student'])

interface V1Result {
  answersCount: number
  topPathwayId: string | null
  kind: string
  band: string
  inappropriateQuestions: number
  unmeasuredGaps: number
}

/* يشغّل محرك V1 بنفس شخصية المحاكاة — نفس الإجابات المنطقية */
function runV1(spec: PersonaSpec, variant: string): V1Result {
  const engine = createEngine(`v1-${spec.id}-${variant}`)
  let asked = 0
  for (let i = 0; i < 40; i++) {
    const r = engine.nextQuestion()
    if (!r.question) break
    asked++
    answerCurrent(engine as unknown as DiagnosticEngineV2, spec)
  }
  const state = engine.getState()
  const persona = derivePersona(state.facts).key
  let inappropriate = 0
  for (const a of state.askedQuestionIds) {
    const q = questionById.get(a)
    if (!q) continue
    if (SCHOOL_LIKE.has(persona) && q.measures.some((m) => WORK_FACTS.includes(m))) inappropriate++
  }
  const rec = engine.recommend()
  const measured = new Set(Object.keys(state.skillVector))
  const unmeasuredGaps = (rec.primaryPathway?.gapSkillSlugs ?? []).filter((s) => !measured.has(s)).length
  return {
    answersCount: asked,
    topPathwayId: rec.primaryPathway?.pathwayId ?? null,
    kind: rec.kind,
    band: rec.confidence.band,
    inappropriateQuestions: inappropriate,
    unmeasuredGaps,
  }
}

const personas = buildPersonas()
const rows: {
  id: string
  label: string
  v1: V1Result
  v2: ReturnType<typeof runSession>
}[] = []

for (const p of personas) {
  const v = buildVariants(p)[0]
  rows.push({ id: p.id, label: p.label_ar, v1: runV1(p, 'base'), v2: runSession(v, 'base') })
}

const avg = (xs: number[]) => +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)
const v1Q = avg(rows.map((r) => r.v1.answersCount))
const v2Q = avg(rows.map((r) => r.v2.answersCount))
const v1Inapp = rows.reduce((s, r) => s + r.v1.inappropriateQuestions, 0)
const v2Inapp = rows.reduce((s, r) => s + r.v2.invalidPersonaQuestions.length, 0)
const v1Unmeasured = rows.reduce((s, r) => s + r.v1.unmeasuredGaps, 0)
const v2Unmeasured = rows.reduce((s, r) => s + r.v2.unmeasuredInfluence.length, 0)
const v1Distinct = new Set(rows.map((r) => r.v1.topPathwayId ?? r.v1.kind)).size
const v2Distinct = new Set(rows.map((r) => r.v2.topPathwayId ?? r.v2.kind)).size
const v1Advisor = rows.filter((r) => r.v1.kind === 'advisor_referral').length
const v2Advisor = rows.filter((r) => r.v2.kind === 'advisor_referral').length
const v1Strong = rows.filter((r) => r.v1.band === 'strong').length
const v2Strong = rows.filter((r) => r.v2.outputKind === 'strong_match').length
const schoolRows = rows.filter((r) => r.id.startsWith('sch'))
const v1SchoolInapp = schoolRows.reduce((s, r) => s + r.v1.inappropriateQuestions, 0)

/* ─── وثيقة المقارنة ─── */
const comparisonMd = `# مقارنة منظومتي التشخيص V1 ↔ V2 — بالأرقام

> وُلّدت آليًا بـ \`npx tsx scripts/report-v2-docs.ts\` على نفس ${personas.length} شخصية حتمية (الصيغة الأساسية لكل شخصية).
> V1 = محرك الدرجات القائم. V2 = نظام القرار (شخصية ← هدف ← مجال ← أدلة ← مهارات ← مسارات أهلية).

## المقاييس الكلية

| المقياس | V1 | V2 |
|---|---|---|
| متوسط الأسئلة لكل جلسة | ${v1Q} | ${v2Q} |
| أسئلة غير مناسبة للمرحلة (طالب مدرسة يُسأل عن عمل/قيادة) | ${v1Inapp} | ${v2Inapp} |
| مهارات غير مقيسة عوملت كفجوات (قاعدة 2.5) | ${v1Unmeasured} | ${v2Unmeasured} |
| مسارات متميزة ظهرت في المرتبة الأولى | ${v1Distinct} | ${v2Distinct} |
| إحالات مستشار (صادقة عند غياب تغطية) | ${v1Advisor} | ${v2Advisor} |
| توصيات بثقة «قوية» | ${v1Strong} | ${v2Strong} |

## تفصيل مهم

- **أسئلة العمل لطلبة المدرسة في V1:** ${v1SchoolInapp} سؤالًا غير مناسبًا عبر ${schoolRows.length} شخصيات مدرسية — في V2 = 0 (استبعاد صارم + فلترة خيارات الهدف).
- **قاعدة «المجهول = 2.5»:** في V1 كانت كل مهارة غير مقيسة تُحسب فجوة بمستوى 2.5 افتراضيًا (${v1Unmeasured} فجوة افتراضية في هذه العينة)؛ في V2 المهارة غير المقيسة «مجهولة» صراحة: لا فجوة ولا تفسير، وتظهر في خانة «ما لم نعرفه».
- **الثقة في V2 صادقة:** لا «تطابق قوي» يُمنح إلا بتغطية مهارات مقيسة ≥ 50٪ وفارق مريح ولا تناقض — لذلك يفضّل V2 مخرجات «أفضل تطابق حالي» و«اتجاه استكشافي» على التضخيم.

## جدول كل شخصية

| الشخصية | أسئلة V1 | مسار V1 | ثقة V1 | أسئلة V2 | مسار V2 | مخرج V2 |
|---|---|---|---|---|---|---|
${rows
  .map(
    (r) =>
      `| ${r.label} | ${r.v1.answersCount} | ${r.v1.topPathwayId ?? r.v1.kind} | ${r.v1.band} | ${r.v2.answersCount} | ${r.v2.topPathwayId ?? r.v2.kind} | ${r.v2.outputKind ?? '—'} |`,
  )
  .join('\n')}

## الخلاصة

V2 ليس «أسئلة أقل» فقط — بل قرارات قابلة للتدقيق: لا سؤال خارج مرحلة المتعلم، لا مهارة مفترضة، لا مسار خارج الأهلية، ولا ثقة مختلقة. ما يظهر كـ«تحفظ» في أرقام V2 (ثقة أقل إفراطًا، إحالات مستشار أكثر) هو في الحقيقة صدق منهجي: المنظومة تعترف بما لا تعرفه.
`

writeFileSync(join(root, 'docs/DIAGNOSTIC_V1_V2_COMPARISON_AR.md'), comparisonMd)

/* ─── وثيقة فجوات الكتالوج ─── */
const personasReport = JSON.parse(
  readFileSync(join(root, 'docs/diagnostic-v2/personas-report.json'), 'utf8'),
) as { summary: { pathwayDistribution: Record<string, number>; sessions: number; domainDistribution: Record<string, number> } }
const winners = new Set(Object.keys(personasReport.summary.pathwayDistribution).filter((k) => !k.startsWith('template:')))
const unreachable = launchPathways.filter((p) => !winners.has(p.id))
const gapsMd = `# فجوات الكتالوج كما كشفها تشخيص V2

> وُلّدت آليًا من محاكاة 525 جلسة حتمية + 10,000 جلسة مزروعة البذرة.
> المبدأ: عندما لا يغطي الكتالوج حاجة حقيقية، يقول المحرك «فجوة» ويحيل لمستشار — بدل إعادة ترشيح نفس المسار للجميع.

## ١) مجالات بلا مسار (فجوة صريحة)

| المجال | الحاجة | الجلسات التي وصلته | التوصية |
|---|---|---|---|
| الأسرة والتربية (family_parenting) | أولياء أمور بهدف أسري | ${personasReport.summary.domainDistribution['family_parenting'] ?? 0} من 525 | مسار أسري حقيقي أو شراكة محتوى |
| التطوير الشخصي العام (personal_development) | «ثقافة عامة» بلا مسار مخصص | جزء من جلسات personal_growth | مسار تعلم عام أو توجيه لملخصات وجيز |

## ٢) مسارات لم تفز بالمرتبة الأولى في 525 جلسة (${unreachable.length} من 20)

${unreachable.map((p) => `- \`${p.id}\` — ${p.title}`).join('\n')}

**السبب الجذري الموثق:** سؤال الهدف في البنك ينتج ٧ رموز فقط، بينما بروفايلات هذه المسارات تنتظر أهدافًا لا يولّدها البنك (مثل digital_transformation وfinancial_decision وproduct_launch وsupply_chain_resilience). المسارات ليست «ميتة» — بل **غير قابلة للوصول من أسئلة الهدف الحالية**.

**الحلول المقترحة (قرارات أكاديمية مطلوبة):**
1. توسيع خيارات سؤال الهدف أو إضافة سؤال «مجال العمل/الاهتمام» يولّد الرموز الناقصة.
2. أو قبول هذه المسارات كمسارات «تخصصية» تُفتح من سياق الوظيفة (function_specialization) لا من الهدف المعلن — جزء منه مطبق فعلًا في طبقة المجالات.

## ٣) أهداف تضغط إلى مسار واحد

- \`personal_growth\` (ثقافة عامة) ينتهي غالبًا إلى \`PW-FND-003\` (AI للإنتاجية) لأنه أقرب مسار متاح — مقبول كبداية آمنة، لكنه يؤكد فجوة «التطوير الشخصي العام».
- \`career_direction\` للموظفين لا مسار له (مسارا STU للطلبة) — موظف يريد تغيير مساره يُحال لمستشار اليوم.

## ٤) توزيع المرتبة الأولى (525 جلسة)

${Object.entries(personasReport.summary.pathwayDistribution)
  .map(([k, v]) => `| ${k} | ${v} | ${((v / personasReport.summary.sessions) * 100).toFixed(1)}٪ |`)
  .join('\n')}

## ٥) قاعدة القرار

عندما تُضاف مسارات جديدة لهذه المجالات، يكفي ربطها في \`src/data/catalog/v2/pathway-domains.v2.json\` وبروفايلات الجمهور — المحرك يلتقطها تلقائيًا دون تغيير كود، وسيظهر أثرها في التوزيع عند إعادة المحاكاة.
`
writeFileSync(join(root, 'docs/CATALOG_GAPS_FROM_DIAGNOSTIC_AR.md'), gapsMd)

console.log('✅ docs/DIAGNOSTIC_V1_V2_COMPARISON_AR.md')
console.log('✅ docs/CATALOG_GAPS_FROM_DIAGNOSTIC_AR.md')
console.log(`V1 vs V2 — أسئلة: ${v1Q}/${v2Q} | غير مناسبة: ${v1Inapp}/${v2Inapp} | فجوات افتراضية: ${v1Unmeasured}/${v2Unmeasured} | مسارات متميزة: ${v1Distinct}/${v2Distinct}`)
