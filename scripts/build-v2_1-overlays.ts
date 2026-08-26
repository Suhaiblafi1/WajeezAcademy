/* مولّد تراكبات V2.1 — يبني من مصدر الحقيقة (maps.ts + البنك الأصلي):
   1) src/data/catalog/v2_1/questions-b2c.v2_1.ar.json — أسئلة القرار الجديدة + إعادة صياغة M4 بمقياس الدليل
   2) src/data/overlays/option-effects.v2_1.json — تأثيرات خيارات الأسئلة الجديدة
   3) src/data/catalog/v2_1/question-plan.v2_1.json — خطة كل سؤال: السطح/الطبقة/الفعل/الأثر القراري
   4) docs/QUESTION_DECISION_CARDS_AR.md — بطاقة قرار لكل سؤال (192 + 6)
   القاعدة الصارمة: سؤال لا نستطيع إكمال جملته «هذا السؤال موجود لأن إجابة أ مقابل ب تغيّر ___» يصبح retire_candidate.
   شغّل: npm run build:v2_1-overlays */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import bankJson from '../src/data/catalog/questions.v1.ar.json' with { type: 'json' }
import pathwayDomainsJson from '../src/data/catalog/v2/pathway-domains.v2.json' with { type: 'json' }
import templatesJson from '../src/data/catalog/composite-templates.v1.json' with { type: 'json' }
import { GOALS_V21, NEEDS_V21, Q, type CareerStage } from '../src/domain/diagnostic/v2_1/maps'
import { buildQuestionPlan, keepSentence, type FinalStatus } from '../src/application/catalog/overlays/question-plan'
import { sourceFromCatalogFiles } from '../src/application/catalog/overlays/from-files'

const root = dirname(fileURLToPath(import.meta.url)) + '/..'
/* --check: يتحقق أن الملفات المُلتزَمة تطابق المولّد بلا كتابة (ج-٢).
   الملفات تقول «مولَّدة — لا تُحرر يدويًا» ولم يكن هناك ما يفرضه. */
const CHECK = process.argv.includes('--check')
let drift = 0
const out = (rel: string, data: unknown) => {
  const p = `${root}/${rel}`
  const text = JSON.stringify(data, null, 2) + '\n'
  if (CHECK) {
    if (readFileSync(p, 'utf8') !== text) {
      drift++
      console.error(`✗ ${rel} يخالف المولّد — حُرّر يدويا أو تغيّر المولّد بلا إعادة توليد.`)
    }
    return
  }
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, text, 'utf8')
  console.log('✍️ ', rel)
}
const outText = (rel: string, text: string) => {
  const p = `${root}/${rel}`
  if (CHECK) {
    if (readFileSync(p, 'utf8') !== text) {
      drift++
      console.error(`✗ ${rel} يخالف المولّد.`)
    }
    return
  }
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, text, 'utf8')
  console.log('✍️ ', rel)
}

interface BankQ {
  question_id: string
  module_id: string
  module_name?: string
  text_ar: string
  answer_type: string
  options_ar: string[]
  options_key: string | null
  persona_scope: string[]
  trigger_condition: string
  measures: string[]
  decision_impact: string
  sensitivity_level: string
  required_level: string
  weight: number
  active: boolean
  version?: string
  /** سؤال M4 مؤلَّف بصياغة موقفية نهائية — يمر بلا إعادة كتابة بالقالب العام */
  v2_1_authored?: boolean
}

const bank = (bankJson as unknown as { questions: BankQ[] }).questions
const pathwayDomains: Record<string, string[]> = pathwayDomainsJson.pathway_domains as Record<string, string[]>
const templates = templatesJson.templates as unknown as { template_id: string; plan?: { represented_pathway_ids?: string[] } }[]

/* ═══ ١) أسئلة القرار الجديدة ═══ */
const qcBase = {
  module_id: 'QC',
  module_name: 'أسئلة القرار — V2.1',
  answer_type: 'single_choice',
  options_key: null,
  persona_scope: ['all'],
  trigger_condition: 'always',
  sensitivity_level: 'low',
  required_level: 'core',
  weight: 1.5,
  active: true,
  version: '2.1',
}

const newQuestions: BankQ[] = [
  {
    ...qcBase,
    question_id: Q.STAGE,
    text_ar: 'أي وصف يقترب أكثر من وضعك الحالي؟',
    options_ar: [
      'طالب جامعي',
      'خريج حديث',
      'موظف في بداية مساري المهني',
      'موظف ذو خبرة',
      'مدير / قائد فريق',
      'مدير أول / تنفيذي',
      'مؤسس / صاحب عمل',
      'مستقل — أعمل لحسابي',
      'مدرب / معلم / مختص تعلم وتطوير',
      'غير ذلك / غير متأكد',
    ],
    measures: ['career_stage'],
    decision_impact: 'يحدد المرحلة المهنية — أساس فلترة الأهداف والاحتياجات وأهلية المسارات. كل خيار يغيّر مجموعة الأسئلة التالية كاملة.',
  },
  {
    ...qcBase,
    question_id: Q.EMPLOYMENT,
    text_ar: 'وماذا عن وضعك العملي الآن؟',
    options_ar: ['لا أعمل حاليًا', 'أبحث عن عمل', 'أعمل لدى جهة', 'أعمل لحسابي (عمل حر)', 'لدي مشروعي الخاص'],
    measures: ['employment_state'],
    decision_impact: 'يفصل «أول وظيفة» عن «ترقية» ويضبط واقعية التوصية — مرحلة مهنية + حالة عمل = صورة أدق من أي وصف مدمج.',
  },
  {
    ...qcBase,
    question_id: Q.GOAL,
    text_ar: 'ما الذي تريد تحقيقه؟',
    options_ar: GOALS_V21.map((g) => g.label_ar),
    measures: ['primary_goal'],
    decision_impact: 'الهدف يحدد فضاء المشكلة — الخيارات تُفلتر حسب المرحلة فلا يُعرض هدف لا يناسب وضعك.',
  },
  {
    ...qcBase,
    question_id: Q.NEED,
    text_ar: 'أي جانب لو تحسّن لديك سيصنع أكبر فرق الآن؟',
    options_ar: NEEDS_V21.map((n) => n.label_ar),
    measures: ['need_id'],
    decision_impact: 'الاحتياج الحقيقي هو محرك اكتشاف المجال — إجابة «المبيعات» مقابل «القيادة» تغيّر المجال والمسار والقالب المركب المحتمل.',
  },
  {
    ...qcBase,
    question_id: Q.TIME,
    text_ar: 'كم ساعة واقعية تستطيع تخصيصها أسبوعيًا للتعلم؟',
    options_ar: ['أقل من ساعتين أسبوعيًا', '٢–٤ ساعات', '٥–٧ ساعات', '٨ ساعات أو أكثر'],
    measures: ['weekly_load'],
    decision_impact: 'الوقت إشارة جدوى فقط: يحدد طول الخطة وصلاحية المسار/المركب — لا يدخل في تحديد المجال أبدًا.',
  },
  {
    ...qcBase,
    question_id: Q.MASTERY,
    text_ar: 'ما الذي تحتاجه أكثر الآن؟',
    options_ar: ['أن أتقن مهارة أو تخصصًا واحدًا بعمق', 'أن أبني مجموعة مهارات مترابطة لتحقيق هدف', 'غير متأكد'],
    measures: ['mastery_portfolio_pref'],
    decision_impact: 'يفصل بين مسار قياسي واحد وخطة مركبة — لا يُسأل إلا عند غموض فعلي بين الاثنين.',
  },
]

/* ═══ ٢) تأثيرات خيارات الأسئلة الجديدة ═══ */
const stageCodes: CareerStage[] = [
  'university_student', 'fresh_graduate', 'early_career', 'experienced', 'manager',
  'senior_manager', 'founder', 'freelancer', 'trainer_ld', 'other_unsure',
]
const stagePersona: Record<CareerStage, Record<string, string>> = {
  university_student: { persona_type: 'student' },
  fresh_graduate: { persona_type: 'early_career' },
  early_career: { persona_type: 'employee' },
  experienced: { persona_type: 'employee' },
  manager: { persona_type: 'manager' },
  senior_manager: { persona_type: 'manager' },
  founder: { persona_type: 'founder', employment_state: 'business_owner' },
  freelancer: { persona_type: 'freelancer', employment_state: 'self_employed' },
  trainer_ld: { persona_type: 'trainer' },
  other_unsure: { persona_branch: 'unsure' },
}
const effects: Record<string, Record<string, Record<string, string | string[]>>> = {
  [Q.STAGE]: Object.fromEntries(
    stageCodes.map((s, i) => [`o${i + 1}`, { career_stage: s, ...stagePersona[s] }]),
  ),
  [Q.EMPLOYMENT]: {
    o1: { employment_state: 'not_working' },
    o2: { employment_state: 'job_seeking' },
    o3: { employment_state: 'employed' },
    o4: { employment_state: 'self_employed' },
    o5: { employment_state: 'business_owner' },
  },
  [Q.GOAL]: Object.fromEntries(
    GOALS_V21.map((g, i) => {
      const eff: Record<string, string> = { primary_goal: g.legacy_goal, goal_code_v21: g.code }
      if (g.code === 'unsure_goal') eff.goal_clarity = 'low'
      return [`o${i + 1}`, eff]
    }),
  ),
  [Q.NEED]: Object.fromEntries(NEEDS_V21.map((n, i) => [`o${i + 1}`, { need_id: n.code }])),
  [Q.TIME]: {
    o1: { weekly_load: 'lt_3' },
    o2: { weekly_load: '3_4' },
    o3: { weekly_load: '5_6' },
    o4: { weekly_load: '7_plus' },
  },
  [Q.MASTERY]: {
    o1: { mastery_portfolio_pref: 'master_one' },
    o2: { mastery_portfolio_pref: 'skill_set' },
    o3: { mastery_portfolio_pref: 'unsure' },
  },
}

/* ═══ ٣) إعادة صياغة أسئلة المهارات M4 بمقياس الدليل (§١١) ═══ */
const EVIDENCE_OPTIONS = [
  'لم أتعامل معها عمليًا',
  'أعرف أساسياتها نظريًا',
  'شاركت في مهمة أو مشروع استخدمها',
  'أستخدمها بانتظام في عملي أو دراستي',
  'قدت عملًا بها ولدي نتيجة واضحة',
]
const m4Overrides: BankQ[] = bank
  .filter((q) => q.module_id === 'M4')
  .map((q) => {
    /* سؤال مؤلَّف بصياغة موقفية خاصة: نصه وخياراته نهائية في البنك، فيمر كما هو.
       القالب العام أدناه يصف المهارة بمصطلحها، والمؤلَّف يصف موقفًا يتعرّف
       المتعلم على نفسه فيه — فلا يُعاد كتابته. */
    if (q.v2_1_authored) return { ...q }
    let topic = q.text_ar.replace(/^قيّم مستواك الحالي في\s*/, '')
    const colon = topic.indexOf(':')
    if (colon > 0) topic = topic.slice(0, colon)
    /* بلا هذا التشذيب ينتج «...بطريقة واضحة.؟» في كل سؤال بلا نقطتين في نصه */
    topic = topic.replace(/[\s.،؟!]+$/, '')
    return {
      ...q,
      text_ar: `أي وصف يقترب أكثر من خبرتك العملية في ${topic}؟`,
      options_ar: EVIDENCE_OPTIONS,
      options_key: 'evidence_5',
      version: '1.1',
      decision_impact: `${q.decision_impact} — صياغة V2.1 تقيس الدليل العملي لا الثقة بالنفس.`,
    }
  })

/* سؤال مرحلة المشروع: من نص حر بمصنف كلمات إلى خيارات صريحة بتأثير موثق — أوضح للمستخدم وأدق حتميًا */
const coreRewrites: BankQ[] = [
  (() => {
    const orig = bank.find((q) => q.question_id === 'QB-M3C-001')!
    return {
      ...orig,
      answer_type: 'single_choice',
      options_ar: [
        'فكرة — لم أبدأ التنفيذ',
        'أتحقق من الفكرة وأختبرها',
        'بدأت ولم أبع بعد',
        'مبيعات أولى — بدأت أبيع',
        'نمو — لدي مبيعات متكررة',
        'مشروع مستقر منذ سنوات',
      ],
      options_key: null,
      version: '1.1',
      decision_impact: `${orig.decision_impact} — صياغة V2.1 بخيارات صريحة بدل مصنف الكلمات.`,
    }
  })(),
]
effects['QB-M3C-001'] = {
  o1: { business_stage: 'idea' },
  o2: { business_stage: 'validation' },
  o3: { business_stage: 'pre_revenue' },
  o4: { business_stage: 'early_revenue' },
  o5: { business_stage: 'growing' },
  o6: { business_stage: 'established' },
}

/* سؤال الميول المختصرة (نشط في V2.1) كان بلا تأثيرات — إجابته لم تغيّر شيئًا.
   الآن كل ميل يفتح مجالًا: interest_domains تغذي قائمة المجالات المختصرة للمستكشف (البند 10).
   القيم مصفوفات لتتجمع عبر الخيارات المتعددة (putFact يلحق القيم اللاحقة بالمصفوفة). */
effects['QB-M3E-002'] = {
  o1: { interest_domains: ['ai_productivity', 'data_decision', 'cyber_risk'] },
  o2: { interest_domains: ['entrepreneurship', 'operations', 'project_management'] },
  o3: { interest_domains: ['marketing_growth', 'sales'] },
  o4: { interest_domains: ['learning_design'] },
  o5: { interest_domains: ['communication_influence', 'marketing_growth'] },
  o6: { interest_domains: ['people_leadership'] },
  o7: { interest_domains: ['gov_services'] },
  o8: { interest_domains: ['finance_mgmt'] },
  /* o9 «لا أعرف» — بلا أثر مقصود: غياب الميل معلومة صادقة لا إشارة */
}

out('src/data/catalog/v2_1/questions-b2c.v2_1.ar.json', {
  metadata: {
    version: '2.1.0',
    doc_ar: 'أسئلة قرار B2C الجديدة + إعادة صياغة M4 بمقياس الدليل + تحويل مرحلة المشروع لخيارات صريحة — تُدمج فوق بنك V1 ولا تعدّله.',
    generated_by: 'scripts/build-v2_1-overlays.ts',
  },
  questions: newQuestions,
  overrides: [...m4Overrides, ...coreRewrites],
})
out('src/data/overlays/option-effects.v2_1.json', { version: '2.1.0', option_effects: effects })

/* ═══ ٤) خطة الأسئلة — سطح وطبقة وفعل لكل سؤال ═══ */
/* ج-٢ · الخطة تُبنى من المولّد المشترك — الجداول والقواعد انتقلت إلى
   src/application/catalog/overlays/question-plan.ts كي يستعملها باني اللقطة
   بالنتيجة نفسها. ما بقي هنا: أسئلة QC وتأثيراتها وبطاقات القرار. */
const { plan, retiredNoReason } = buildQuestionPlan(
  sourceFromCatalogFiles({
    questions: bankJson as never,
    skills: { skills: [] },
    core: { launch_pathways: [], courses: [] },
    templates: templatesJson as never,
  }),
)

/* أثر المرشحين القياسيين = مسارات مجالاتها تتقاطع مع مجالات السؤال */
function affectedStandard(domains: string[]): string[] {
  if (domains.length === 0) return []
  return Object.entries(pathwayDomains)
    .filter(([, ds]) => ds.some((d) => domains.includes(d)))
    .map(([id]) => id)
    .sort()
}
function affectedComposite(standardIds: string[]): string[] {
  if (standardIds.length === 0) return []
  return templates
    .filter((t) => (t.plan?.represented_pathway_ids ?? []).some((p) => standardIds.includes(p)))
    .map((t) => t.template_id)
    .sort()
}


/* أثر المرشحين — للبطاقات */
const impactMap: Record<string, { standard: string[]; composite: string[] }> = {}
for (const [id, p] of Object.entries(plan)) {
  const std = affectedStandard(p.domains)
  impactMap[id] = { standard: std, composite: affectedComposite(std) }
}

out('src/data/catalog/v2_1/question-plan.v2_1.json', {
  version: '2.1.0',
  doc_ar: 'خطة كل سؤال في V2.1: السطح، الطبقة الست، الفعل، المراحل المؤهلة، الأثر القراري. مولّدة — لا تُحرر يدويًا.',
  generated_by: 'scripts/build-v2_1-overlays.ts',
  plan,
})

/* ═══ ٥) بطاقات القرار ═══ */
const LAYER_AR: Record<string, string> = {
  orientation: 'التوجيه', goal_need: 'الهدف والاحتياج', domain_differentiation: 'تمييز المجال',
  evidence_skill: 'الدليل والمهارة', feasibility: 'الجدوى', confirmation_deep: 'تأكيد وتعميق',
}
const ACTION_AR: Record<string, string> = {
  keep: 'إبقاء', rewrite: 'إعادة صياغة', replaced: 'استبدال', move_post: 'نقل لما بعد التوصية', retire: 'تقاعد', out_of_scope: 'خارج النطاق',
}
const SURFACE_AR: Record<string, string> = {
  b2c: 'تشخيص B2C', b2b_b2g: 'مسار المؤسسات', ui_ack: 'إقرار واجهة', post_recommendation: 'ما بعد التوصية', retired_b2c: 'متقاعد من B2C',
}
const FINAL_STATUS_AR: Record<FinalStatus, string> = {
  active_b2c: 'نشط في تشخيص B2C',
  deep_only: 'جولة التأكيد فقط',
  post_recommendation: 'ما بعد التوصية',
  institutional: 'مسار المؤسسات (B2B/B2G)',
  retired: 'متقاعد',
  out_of_scope: 'خارج النطاق',
}

const allQuestions = [...bank, ...newQuestions]
const cards: string[] = []
for (const q of allQuestions) {
  const p = plan[q.question_id]
  const rewritten = m4Overrides.find((o) => o.question_id === q.question_id)
  const repl = p.replaced_by ? allQuestions.find((n) => n.question_id === p.replaced_by) : null
  const sentence = keepSentence(p)
  const stages = p.stages === 'all' ? 'الكل' : (p.stages as string[]).join('، ') || '—'
  const imp = impactMap[q.question_id] ?? { standard: [], composite: [] }
  cards.push(
    [
      `### ${q.question_id} — ${SURFACE_AR[p.surface]} / ${ACTION_AR[p.action]}`,
      ``,
      `- **النص الحالي**: ${q.text_ar}`,
      `- **الحالة النهائية**: \`${p.final_status}\` — ${FINAL_STATUS_AR[p.final_status!]}`,
      rewritten ? `- **النص المقترح (V2.1)**: ${rewritten.text_ar}` : null,
      repl ? `- **الخليفة**: ${p.replaced_by} — «${repl.text_ar}»` : null,
      `- **الطبقة الحالية (V2)**: ${q.module_id} · **الطبقة الجديدة**: ${p.layer21 ? LAYER_AR[p.layer21] : '—'}`,
      `- **المراحل المؤهلة**: ${stages}`,
      `- **المجالات**: ${p.domains.length ? p.domains.join('، ') : '—'}`,
      `- **يقيس**: ${q.measures.join('، ') || '—'}`,
      `- **لماذا يوجد**: ${p.why_ar}`,
      `- **الأثر القراري الدقيق**: ${p.impact_ar}`,
      sentence ? `- **الجملة الحاسمة**: ${sentence}` : `- **الجملة الحاسمة**: لا تكتمل — سقطت القاعدة.`,
      `- **المرشحون القياسيون المتأثرون**: ${imp.standard.length ? imp.standard.join('، ') : '—'}`,
      `- **المرشحون المركبون المتأثرون**: ${imp.composite.length ? imp.composite.join('، ') : '—'}`,
      `- **ربط الإجابات**: ${p.surface === 'b2c' ? 'كل خيار له أثر موثق (option effects أو مقياس ترتيبي)' : '—'}`,
    ].filter((l): l is string => l !== null).join('\n'),
  )
}

const counts = { keep: 0, rewrite: 0, replaced: 0, move_post: 0, retire: 0, out_of_scope: 0 }
for (const p of Object.values(plan)) counts[p.action]++
const b2cActive = Object.entries(plan).filter(([, p]) => p.surface === 'b2c').length

/* ── التوفيق النهائي (Reconciliation) — كل سؤال في حالة واحدة، المجموع = عدد البطاقات ── */
const finalCounts: Record<FinalStatus, number> = { active_b2c: 0, deep_only: 0, post_recommendation: 0, institutional: 0, retired: 0, out_of_scope: 0 }
for (const p of Object.values(plan)) finalCounts[p.final_status!]++
const finalTotal = Object.values(finalCounts).reduce((a, b) => a + b, 0)
if (finalTotal !== allQuestions.length) {
  throw new Error(`فشل التوفيق: مجموع الحالات النهائية ${finalTotal} ≠ عدد البطاقات ${allQuestions.length}`)
}
const familyOutCount = Object.values(plan).filter((p) => p.surface === 'retired_b2c' && p.action === 'out_of_scope').length
const uiAckCount = Object.values(plan).filter((p) => p.surface === 'ui_ack').length

const md = `# بطاقات قرار الأسئلة — V2.1

> كل سؤال في البنك (192) + أسئلة القرار الستة الجديدة = **${allQuestions.length} بطاقة**.
> القاعدة الصارمة: سؤال B2C نشط لا تكتمل جملته «هذا السؤال موجود لأن إجابة أ مقابل ب تغيّر ___» يصبح مرشح تقاعد تلقائيًا.
> مولّد من \`scripts/build-v2_1-overlays.ts\` — لا يُحرر يدويًا. المصدر: question-plan.v2_1.json.

## التوفيق النهائي — كل Question ID محسوب مرة واحدة فقط

الحالة النهائية (\`final_status\`) مشتقة حتميًا من (السطح، المرحلة، الفعل) — لا تُكتب يدويًا، والمجموع يجب أن يساوي ${allQuestions.length} دائمًا:

| الحالة النهائية | التعريف | العدد |
|---|---|---|
| \`active_b2c\` | يُطرح في التدفق الأساسي أو التكيفي | ${finalCounts.active_b2c} |
| \`deep_only\` | سطح B2C لكنه لا يُطرح إلا في جولة التأكيد الاختيارية | ${finalCounts.deep_only} |
| \`post_recommendation\` | تخصيص ما بعد التوصية — لا أثر على اختيار المسار | ${finalCounts.post_recommendation} |
| \`institutional\` | مسار المؤسسات المستقل (B2B/B2G) — خارج رحلة المتعلم | ${finalCounts.institutional} |
| \`retired\` | متقاعد من B2C (تقاعد ${counts.retire} + مستبدَل بسؤال QC جديد ${counts.replaced}) | ${finalCounts.retired} |
| \`out_of_scope\` | خارج نطاق التشخيص كليًا (وحدة أسرية ${familyOutCount} + إقرارات واجهة ${uiAckCount}) | ${finalCounts.out_of_scope} |
| **المجموع** | | **${finalTotal}** ✓ |

## ملخص القرارات التحريرية (الفعل — قبل الحالة النهائية)

| القرار | العدد |
|---|---|
| إبقاء | ${counts.keep} |
| إعادة صياغة (M4 بمقياس الدليل) | ${counts.rewrite} |
| استبدال بسؤال جديد | ${counts.replaced} |
| نقل لما بعد التوصية | ${counts.move_post} |
| تقاعد | ${counts.retire} |
| خارج النطاق (B2B/أسري) | ${counts.out_of_scope} |
| **أسئلة سطحها B2C (نشطة + تأكيد فقط)** | **${b2cActive}** |

${retiredNoReason.length ? `## أسئلة سقطت بقاعدة الجملة الحاسمة\n\n${retiredNoReason.map((id) => `- ${id}`).join('\n')}\n` : ''}
---

${cards.join('\n\n')}
`
outText('docs/QUESTION_DECISION_CARDS_AR.md', md)
if (CHECK) {
  if (drift > 0) {
    console.error('  الإصلاح: npm run build:v2_1-overlays ثم التزم الناتج في التغيير نفسه.')
    process.exit(1)
  }
  console.log('✅ تراكبات V2.1 وبطاقات القرار مطابقة لمولّدها.')
}
console.log(`\n📊 B2C نشط: ${b2cActive} · إبقاء ${counts.keep} · إعادة صياغة ${counts.rewrite} · استبدال ${counts.replaced} · نقل ${counts.move_post} · تقاعد ${counts.retire} · خارج النطاق ${counts.out_of_scope}`)
if (retiredNoReason.length) console.log('⚠️  سقطت بالقاعدة:', retiredNoReason.join(', '))
