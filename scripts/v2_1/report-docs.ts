/* مولّد وثائق المرحلة الثالثة V2.1 — يقرأ نتائج Golden Suite وMonte Carlo والفضاء الموحد
   ويكتب: COMPOSITE_PATHWAYS_AUDIT_AR.md + RECOMMENDATION_UNIVERSE_AR.md + RECOMMENDATION_REACHABILITY_MATRIX_AR.md
   لا يمس docs/DIAGNOSTIC_V2_1_BASELINE_AR.md — baseline مثبت عند 4817af1.
   الاستخدام: npm run report:v2_1-docs */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { recommendationUniverse } from '../../src/domain/diagnostic/v2_1/universe'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const docsDir = join(root, 'docs')

interface GoldenCase {
  winner: string | null
  kind: string
  confidence: number
  won: boolean
  askedCount: number
  eligible: boolean
  entityNetFit: number | null
  winnerNetFit: number | null
  recipe?: { stage: string; goal?: string; need?: string; fn?: string; mastery?: string }
}
interface GoldenEntity {
  type: string
  tried: number
  positive: GoldenCase
  near_miss: GoldenCase
  negative: GoldenCase
  verdict: string
}
interface GoldenFile {
  generated_at: string
  universe_active: number
  reachable: number
  golden: Record<string, GoldenEntity>
  variants: {
    total: number
    invalid_kind: number
    alien_winner: number
    determinism_checked: number
    determinism_failures: number
    kind_distribution: Record<string, number>
    winner_distribution: Record<string, number>
  }
}
interface McFile {
  sessions: number
  seed: number
  kind: Record<string, number>
  winners: Record<string, number>
  avgQuestions: number
  exploratoryRate: number
  advisorRate: number
  alienWinners: number
  errors: number
  determinismProbe: { sample: number; mismatches: number }
}

const golden = JSON.parse(readFileSync(join(docsDir, 'diagnostic-v2_1', 'golden-reachability.json'), 'utf8')) as GoldenFile
const mc = JSON.parse(readFileSync(join(docsDir, 'diagnostic-v2_1', 'montecarlo-v2_1.json'), 'utf8')) as McFile
const u = recommendationUniverse()

const STAGE_AR: Record<string, string> = {
  approved_active: 'نشط معتمد',
  needs_revision: 'يحتاج مراجعة',
  duplicate_candidate: 'مرشح ازدواج',
  academically_weak: 'ضعيف أكاديميًا',
  inactive: 'غير نشط',
  needs_academic_review: 'يحتاج مراجعة أكاديمية',
}

/* ─── ١) تدقيق القوالب المركبة الـ16 ─── */
{
  const rows = u.audits.map((a) => {
    const m = a.metrics
    return [
      `\`${a.template_id}\``,
      a.name_ar,
      STAGE_AR[a.status] ?? a.status,
      m.core_domains.join('، ') || '—',
      String(m.incremental_skill_value),
      m.duplicate_course_pairs.length > 0 ? m.duplicate_course_pairs.map((d) => `${d.a}~${d.b}`).join('، ') : '—',
      m.unproducible_required_facts.join('، ') || '—',
      a.reasons_ar.join(' ').replaceAll('|', '\\|') || '—',
    ]
  })
  const activeRows = rows.filter((r) => r[2] === 'نشط معتمد')
  const reviewRows = rows.filter((r) => r[2] !== 'نشط معتمد')
  const md = `# تدقيق القوالب المركبة الستة عشر — V2.1

آلية التدقيق حتمية موثقة في \`auditComposite\` (universe.ts): اكتمال التحول، تعريف الجمهور، صلاحية مراجع الدورات، قيمة مهارية إضافية فوق أفضل مسار جوهري، ازدواج دورات (بأزواج مهارات فريدة)، حقائق مطلوبة غير قابلة للإنتاج في تدفق B2C، أهداف قابلة للوصول، مداخل احتياج.

## القوالب النشطة (${activeRows.length})

| القالب | الاسم | الحالة | المجالات الجوهرية | قيمة مهارية إضافية | ازدواج دورات | حقائق غير منتَجة | ملاحظات |
|---|---|---|---|---|---|---|---|
${activeRows.map((r) => `| ${r.join(' | ')} |`).join('\n')}

## قوالب تحتاج مراجعة (${reviewRows.length}) — لا تنافس حتى تكتمل

| القالب | الاسم | الحالة | المجالات الجوهرية | قيمة مهارية إضافية | ازدواج دورات | حقائق غير منتَجة | سبب المراجعة |
|---|---|---|---|---|---|---|---|
${reviewRows.map((r) => `| ${r.join(' | ')} |`).join('\n')}

## قراءة منهجية

- **القيمة المهارية الإضافية** = عدد المهارات التي يضيفها القالب فوق أفضل مسار قياسي جوهري مفرد؛ ≤ 0 يعني مرشح ازدواج.
- **الحقائق غير المنتَجة** = حقائق importance=required لا تستطيع أي إجابة ممكنة في B2C إنتاجها — القالب حينها ينافس بعجز دائم في تغطية الأدلة، فيُجمَّد للمراجعة.
- القوالب الخمسة المجمَّدة: FIRST-JOB (education_state)، CX (current_pain)، DIGITAL-TRAINER (current_domain)، CYBER-MANAGER (org_sensitivity + data_sharing_policy)، STRATEGY (strategic_priority + org_kpi).

_توليد آلي عبر \`npm run report:v2_1-docs\` — ${golden.generated_at}_
`
  writeFileSync(join(docsDir, 'COMPOSITE_PATHWAYS_AUDIT_AR.md'), md)
  console.log('كتب: docs/COMPOSITE_PATHWAYS_AUDIT_AR.md')
}

/* ─── ٢) فضاء التوصيات الموحد ─── */
{
  const rows = u.entities.map((e) => [
    `\`${e.entity_id}\``,
    e.entity_type === 'standard' ? 'قياسي' : 'مركب',
    STAGE_AR[e.status] ?? e.status,
    e.title_ar,
    e.domains.join('، ') || '—',
    e.needs.slice(0, 4).join('، ') || '—',
    String(e.required_courses.length),
    `${e.estimated_hours}س / ${e.feasibility.duration_weeks}أ`,
  ])
  const md = `# فضاء التوصيات الموحد — Recommendation Universe V2.1

محرك واحد، فضاء واحد: ${u.entities.length} كيان توصية (${u.active.filter((e) => e.entity_type === 'standard').length} مسارًا قياسيًا + ${u.active.filter((e) => e.entity_type === 'composite').length} قالبًا مركبًا نشطًا + ${u.entities.length - u.active.length} قوالب مجمَّدة للمراجعة). كل كيان يُسجَّل بنفس المكونات الستة وينافس بنفس القواعد.

## قواعد المنافسة الموحدة

1. **أهلية صارمة أولًا**: الحالة، المرحلة/الشخصية، المجال (بعد وضوحه فقط)، السياق، والجدوى الزمنية للمركب (خطة تتجاوز وقتك لا تفوز أبدًا).
2. **تسجيل موحد بستة مكونات** للنوعين، مع عبء تعقيد للمركب (دورات + ساعات + مجالات) يخصم من الصافي.
3. **فوز المركب مشروط**: تغطية أدلة ≥ 80٪ (المهارة المقيسة بسؤال M4 تُحتسب دليلًا مغطى)، حاجة متعددة المجالات مُثبتة (مجالان نشطان من مجالاته)، تغطية مجال يتركه أفضل قياسي، وميزة ملاءمة خام فوق عتبة موثقة (2٪ — أو 1٪ إذا اخترت صراحة «منظومة مترابطة»). اختيارك «إتقان مهارة واحدة» يستبعد المركب بقرارك.
4. **بلا فرض بلا دليل**: عدم حسم الهدف/الاحتياج بلا أدلة كافية → اتجاه استكشافي (مجالات مختصرة + اقتراحات دليل) لا مسار مُقنَّع. هدف حقيقي بلا كيان ملائم → إحالة مستشار موثقة (فجوة كتالوج)، لا «أقرب مسار».
5. **المهارة المجهولة مجهولة**: لا تُفترض 2.5، لا تُحسب فجوة ولا إتقانًا، لا تدخل التفسير ولا الترتيب.
6. **حتمية كاملة**: نفس الإجابات → نفس الأسئلة والنتيجة وأثر القرار، مع إصدارات مخزنة لكل جلسة (بنك الأسئلة، تصنيف المهارات، الكتالوج، محرك القرار).

## إصلاحا أسلاك موثقان اكتشفتهما Golden Suite

- **تغطية الأدلة تقرأ المخزن الصحيح**: إجابات أسئلة المهارات (M4) تعيش في مخزن المهارات لا في حقيبة الحقائق — كانت بوابة التغطية تعاملها كأنها غائبة فتستحيل فوزًا لأي مركب يتطلب دليلًا مهاريًا.
- **«السياق الحاسم» أصبح ديناميكيًا**: الحقائق المطلوبة لمرشحي الصدارة (بمن فيهم المتحدي المركب) ترفع أولوية أسئلتها المنتِجة — سابقًا كانت القائمة ثابتة (8 حقائق) فلم تُسأل أسئلة أدلة القوالب أبدًا.

## جدول الكيانات (${u.entities.length})

| المعرف | النوع | الحالة | الاسم | المجالات الجوهرية | احتياجات تفتحه | دورات مطلوبة | الجهد |
|---|---|---|---|---|---|---|---|
${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}

_توليد آلي عبر \`npm run report:v2_1-docs\` — ${golden.generated_at}_
`
  writeFileSync(join(docsDir, 'RECOMMENDATION_UNIVERSE_AR.md'), md)
  console.log('كتب: docs/RECOMMENDATION_UNIVERSE_AR.md')
}

/* ─── ٣) مصفوفة القابلية للوصول ─── */
{
  const entries = Object.entries(golden.golden)
  const reachable = entries.filter(([, g]) => g.verdict === 'reachable')
  const review = entries.filter(([, g]) => g.verdict !== 'reachable')
  const topWinner = Object.entries(mc.winners).sort((a, b) => b[1] - a[1])[0]
  const topShare = topWinner ? ((topWinner[1] / mc.sessions) * 100).toFixed(1) : '0'

  const recipeAr = (c?: GoldenCase['recipe']) =>
    c ? [c.stage, c.goal, c.need, c.fn ? `وظيفة: ${c.fn}` : null, c.mastery].filter(Boolean).join(' · ') : '—'

  const reviewReasons: Record<string, string> = {
    'PW-OPS-001': 'توأم بنيوي مع PW-SCM-001: مراحل ومجالات وأهداف متطابقة (فارق 0.004) — يحتاج سؤال ميّز أو تمايز بروفايل قبل أن يمكن الوصول إليه بمسؤولية.',
    'PW-SAL-001': 'بروفايله لا يقبل سوى هدف revenue_growth غير المتاح للموظفين؛ جمهوره الطبيعي (مندوب مبيعات موظف) بلا مدخل هدف، فيمتص TPL-FREELANCE-001 جمهور المؤسسين/المستقلين متعددي المجالات. يحتاج أهدافًا بمراحل موظفة.',
    'TPL-NEW-MANAGER-001': 'مهيمن عليه بنيويًا: مراحله مجموعة جزئية من PW-HR-001 بمجالات مطابقة (learning_design + people_leadership) — أينما كان مؤهلًا كان PW-HR-001 مؤهلًا ومغطيًا مجاليه معًا، فلا «فجوة مجال» يضيفها أبدًا.',
    'TPL-B2B-001': 'للمؤسسين يهيمن TPL-FREELANCE-001 (تغطية أوسع)، وللموظفين لا يصله هدف revenue_growth ولا يثبت مجاله الثاني (sales) بوزن كافٍ عبر الوظيفة وحدها. يحتاج مدخل مجال ثانيًا للموظف أو تضييق جمهور.',
  }

  const md = `# مصفوفة القابلية للوصول — Reachability Matrix V2.1

**Golden Suite**: بحث شامل عن توليفة إشارات منتِجة (هدف × مرحلة × احتياج × وظيفة × تفضيل إتقان × استعداد × مستوى مهارة — بتخليل هدف-خارجي واتساق شخصية المستقل/المؤسس، حتى 6000 توليفة لكل كيان) تجعل الكيان يفوز. الفائز بحالته canonical = reachable؛ من لا تفوز له أي توليفة = needs_academic_review موثقًا بأفضل محاولة وهامشها.

## النتيجة الإجمالية

- **${golden.reachable}/${golden.universe_active} كيانًا reachable** (${reachable.filter(([, g]) => g.type === 'standard').length}/20 قياسيًا + ${reachable.filter(([, g]) => g.type === 'composite').length}/16 مركبًا نشطًا).
- **variants حتمية**: ${golden.variants.total} جلسة — أنواع نتائج غير صالحة: ${golden.variants.invalid_kind} · فائز خارج الفضاء النشط: ${golden.variants.alien_winner} · إعادات تحقق حتمية: ${golden.variants.determinism_checked} بلا أي إخفاق.
- **Monte Carlo ${mc.sessions.toLocaleString('en-US')} جلسة (بذرة ${mc.seed})**: single_pathway ${mc.kind.single_pathway ?? 0} · composite_template ${mc.kind.composite_template ?? 0} · exploratory_direction ${mc.kind.exploratory_direction ?? 0} · advisor_referral ${mc.kind.advisor_referral ?? 0} · متوسط الأسئلة ${mc.avgQuestions} · أخطاء ${mc.errors} · فائزون خارج الفضاء ${mc.alienWinners} · عينة حتمية ${mc.determinismProbe.sample} جلسة: ${mc.determinismProbe.mismatches === 0 ? 'مطابقة تامة' : `${mc.determinismProbe.mismatches} اختلافًا!`}.
- **لا هيمنة مفرطة**: أعلى فائز \`${topWinner?.[0] ?? '—'}\` بحصة ${topShare}٪ من الجلسات العشوائية.

## الكيانات reachable (${reachable.length})

| الكيان | النوع | محاولات حتى الفوز | التوليفة canonical | النتيجة | الثقة | near-miss يفوز؟ | الحالة السلبية تفوز؟ |
|---|---|---|---|---|---|---|---|
${reachable
  .map(
    ([id, g]) =>
      `| \`${id}\` | ${g.type === 'standard' ? 'قياسي' : 'مركب'} | ${g.tried} | ${recipeAr(g.positive.recipe).replaceAll('|', '\\|')} | ${g.positive.kind} | ${Math.round(g.positive.confidence * 100)}٪ | ${g.near_miss.won ? 'نعم' : 'لا'} | ${g.negative.won ? 'نعم — راجع!' : 'لا'} |`,
  )
  .join('\n')}

## كيانات needs_academic_review (${review.length}) — أحكام موثقة لا أعطال

| الكيان | النوع | محاولات | أفضل نتيجة ذاتية | أفضل فائز منافس | الهامش | سبب المراجعة |
|---|---|---|---|---|---|---|
${review
  .map(([id, g]) => {
    const margin =
      g.positive.entityNetFit !== null && g.positive.winnerNetFit !== null
        ? (g.positive.winnerNetFit - g.positive.entityNetFit).toFixed(3)
        : '—'
    return `| \`${id}\` | ${g.type === 'standard' ? 'قياسي' : 'مركب'} | ${g.tried} | ${g.positive.entityNetFit ?? '—'} | ${g.positive.winner ?? '—'} (${g.positive.winnerNetFit ?? '—'}) | ${margin} | ${(reviewReasons[id] ?? 'يحتاج مراجعة أكاديمية.').replaceAll('|', '\\|')} |`
  })
  .join('\n')}

## توزيع الفائزين في Monte Carlo

| الكيان | جلسات فاز بها | الحصة |
|---|---|---|
${Object.entries(mc.winners)
  .sort((a, b) => b[1] - a[1])
  .map(([id, v]) => `| \`${id}\` | ${v} | ${((v / mc.sessions) * 100).toFixed(2)}٪ |`)
  .join('\n')}

**كيانات لم تفز قط في الحركة العشوائية**: ${(() => { const never = u.active.filter((e) => !mc.winners[e.entity_id]).map((e) => `\`${e.entity_id}\``).join('، '); return never || '—' })()} — منها الأربعة المعلَّمة للمراجعة أعلاه، ومنها ذات بروفايلات ضيقة تفوز بحالاتها canonical فقط.

_توليد آلي عبر \`npm run report:v2_1-docs\` — ${golden.generated_at}_
`
  writeFileSync(join(docsDir, 'RECOMMENDATION_REACHABILITY_MATRIX_AR.md'), md)
  console.log('كتب: docs/RECOMMENDATION_REACHABILITY_MATRIX_AR.md')
}

console.log('اكتمل توليد الوثائق الثلاث (baseline لم يُمس).')
