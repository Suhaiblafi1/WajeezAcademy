/* مولّد تراكبات V2.1 — يبني من مصدر الحقيقة (maps.ts + البنك الأصلي):
   1) src/data/catalog/v2_1/questions-b2c.v2_1.ar.json — أسئلة القرار الجديدة + إعادة صياغة M4 بمقياس الدليل
   2) src/data/overlays/option-effects.v2_1.json — تأثيرات خيارات الأسئلة الجديدة
   3) src/data/catalog/v2_1/question-plan.v2_1.json — خطة كل سؤال: السطح/الطبقة/الفعل/الأثر القراري
   4) docs/QUESTION_DECISION_CARDS_AR.md — بطاقة قرار لكل سؤال (192 + 6)
   القاعدة الصارمة: سؤال لا نستطيع إكمال جملته «هذا السؤال موجود لأن إجابة أ مقابل ب تغيّر ___» يصبح retire_candidate.
   شغّل: npm run build:v2_1-overlays */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import bankJson from '../src/data/catalog/questions.v1.ar.json' with { type: 'json' }
import pathwayDomainsJson from '../src/data/catalog/v2/pathway-domains.v2.json' with { type: 'json' }
import templatesJson from '../src/data/catalog/composite-templates.v1.json' with { type: 'json' }
import {
  GOALS_V21,
  NEEDS_V21,
  Q,
  type CareerStage,
  type QuestionLayerV21,
  type QuestionSurface,
} from '../src/domain/diagnostic/v2_1/maps'

const root = dirname(fileURLToPath(import.meta.url)) + '/..'
const out = (rel: string, data: unknown) => {
  const p = `${root}/${rel}`
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8')
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
const effects: Record<string, Record<string, Record<string, string>>> = {
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
    let topic = q.text_ar.replace(/^قيّم مستواك الحالي في\s*/, '')
    const colon = topic.indexOf(':')
    if (colon > 0) topic = topic.slice(0, colon)
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
type Action = 'keep' | 'rewrite' | 'replaced' | 'move_post' | 'retire' | 'out_of_scope'
interface PlanEntry {
  surface: QuestionSurface
  layer21: QuestionLayerV21 | null
  phase: 'core' | 'adaptive' | 'confirmation' | 'none'
  action: Action
  stages: CareerStage[] | 'all'
  domains: string[]
  impact_ar: string
  why_ar: string
  replaced_by?: string
  measures: string[]
}

const EMPLOYED: CareerStage[] = ['early_career', 'experienced', 'manager', 'senior_manager', 'trainer_ld']
const STUDENTISH: CareerStage[] = ['university_student', 'fresh_graduate', 'early_career']
const FOUNDERS: CareerStage[] = ['founder', 'freelancer']

/* افتراضيات الوحدات */
const moduleDefault: Record<string, Pick<PlanEntry, 'surface' | 'layer21' | 'phase' | 'action' | 'stages' | 'why_ar'>> = {
  M0: { surface: 'retired_b2c', layer21: null, phase: 'none', action: 'retire', stages: [], why_ar: 'وحدة الاستقبال المؤسسي أُخرجت من محرك B2C.' },
  M3D: { surface: 'retired_b2c', layer21: null, phase: 'none', action: 'out_of_scope', stages: [], why_ar: 'الوحدة الأسرية خارج نطاق أكاديمية B2C — الأبوة ليست شخصية تعليمية هنا.' },
  M9: { surface: 'b2b_b2g', layer21: null, phase: 'none', action: 'out_of_scope', stages: [], why_ar: 'أسئلة مؤسسية — تعيش في مسار B2B/B2G المستقل.' },
  M5: { surface: 'b2c', layer21: 'domain_differentiation', phase: 'adaptive', action: 'keep', stages: 'all', why_ar: 'ميول RIASEC تُستخدم فقط عند غموض الهدف/الاحتياج لفصل المجالات.' },
  M6: { surface: 'post_recommendation', layer21: null, phase: 'none', action: 'move_post', stages: [], why_ar: 'أسلوب العمل يخصّص المتابعة والالتزام بعد التوصية — لا يحدد ماذا يتعلم الشخص.' },
  M8: { surface: 'b2c', layer21: 'confirmation_deep', phase: 'confirmation', action: 'keep', stages: 'all', why_ar: 'أسئلة تحقق وتعميق — تُدار من جولة التأكيد المشروطة.' },
}

/* استثناءات صريحة لكل سؤال محفوظ/مُعاد/مستبدل */
const overrides: Record<string, Partial<PlanEntry>> = {
  'QB-M0-001': { surface: 'b2b_b2g', action: 'out_of_scope', why_ar: 'صاحب القرار المؤسسي — مسار B2B/B2G فقط. في B2C المتعلم هو صاحب القرار دائمًا.', impact_ar: 'خارج B2C — في مسار المؤسسات يغيّر لغة الرحلة كلها.' },
  'QB-M0-002': { surface: 'ui_ack', action: 'move_post', why_ar: 'العمر لم يعد مطلوبًا: المرحلة المهنية صريحة، وأمان القاصرين يُعالج بإقرار الواجهة.', impact_ar: 'لا أثر قراري في B2C.' },
  'QB-M0-003': { surface: 'post_recommendation', action: 'move_post', why_ar: 'الدولة تخصيص عرض/تسعير لاحقًا — لا تغيّر التوصية التعليمية.', impact_ar: 'لا أثر على المسار.' },
  'QB-M0-004': { surface: 'retired_b2c', action: 'retire', why_ar: 'الأكاديمية عربية حاليًا — سؤال اللغة غير قابل للاستخدام منتجيًا.', impact_ar: 'لا أثر — محذوف من B2C.' },
  'QB-M0-005': { surface: 'ui_ack', action: 'move_post', why_ar: 'الحفظ ميزة واجهة قائمة — ليس سؤالًا تشخيصيًا.', impact_ar: 'لا أثر قراري.' },
  'QB-M0-006': { surface: 'ui_ack', action: 'move_post', why_ar: 'الموافقة إقرار واجهة قبل البدء (موجودة في صفحة التشخيص) — لا تُحسب سؤالًا ولا تدخل الثقة.', impact_ar: 'لا تغيّر التوصية — إجراء قانوني فقط.' },
  'QB-M0-007': { surface: 'ui_ack', action: 'move_post', why_ar: 'الموافقة التسويقية قانونية مستقلة — تُدار بالواجهة عند الحاجة.', impact_ar: 'لا أثر قراري.' },
  'QB-M0-008': { surface: 'ui_ack', action: 'move_post', why_ar: 'سن 18+ يُذكر في إقرار الواجهة؛ لا سؤال قاصر داخل المحرك.', impact_ar: 'لا أثر قراري في B2C.' },
  'QB-M0-009': { surface: 'b2b_b2g', action: 'out_of_scope', why_ar: 'الجهة الدافعة سؤال مبيعات/عروض — يعالج في Checkout لا في التشخيص التعليمي.', impact_ar: 'خارج B2C.' },
  'QB-M0-010': { surface: 'retired_b2c', action: 'retire', why_ar: 'الارتياح للخصوصية لا يستطيع المنتج استخدام إجابته.', impact_ar: 'لا أثر — محذوف.' },

  'QB-M1-001': { action: 'replaced', replaced_by: Q.STAGE, why_ar: 'استُبدل بسؤال المرحلة المهنية الدقيق (10 أوصاف) — الفصل بين المرحلة وحالة العمل.', impact_ar: 'خليفته يحدد المرحلة ويفلتر كل ما بعدها.' },
  'QB-M1-002': { action: 'replaced', replaced_by: Q.STAGE, why_ar: 'المرحلة التعليمية اندمجت في سؤال المرحلة المهنية — لا حاجة لسؤالين.', impact_ar: 'لا أثر مستقل بعد الدمج.' },
  'QB-M1-003': { action: 'replaced', replaced_by: Q.EMPLOYMENT, why_ar: 'استُبدل بسؤال حالة العمل المنفصل (5 حالات) — يُسأل فقط عندما لا تحسمه المرحلة.', impact_ar: 'خليفته يفصل أول وظيفة عن ترقية.' },
  'QB-M1-005': { surface: 'retired_b2c', action: 'retire', why_ar: 'نص حر بلا consequence حتمي — سؤال الاحتياج QC-N3-001 يكتشف المجال بخيارات مؤثرة موثقة.', impact_ar: 'لا أثر قابل للحسم — محذوف من B2C.' },
  'QB-M1-007': { surface: 'retired_b2c', action: 'retire', why_ar: 'نص حر بلا consequence حتمي — سؤال الاحتياج QC-N3-001 يغطي الإشارة بخيارات مؤثرة.', impact_ar: 'لا أثر قابل للحسم — محذوف من B2C.' },
  'QB-M1-011': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: 'all', why_ar: 'وجود دليل مهاري (مشروع/شهادة) يرفع جودة الأدلة ويغيّر درجة الثقة.', impact_ar: '«لدي ملف أعمال» مقابل «لا دليل» يغيّر قوة التوصية وربما جولة التأكيد.' },

  'QB-M2-001': { action: 'replaced', replaced_by: Q.GOAL, why_ar: 'استُبدل بسؤال هدف تُفلتر خياراته حسب المرحلة المهنية — لا هدف واحد للجميع.', impact_ar: 'خليفته يحدد فضاء المشكلة.' },
  'QB-M2-005': { surface: 'b2c', layer21: 'goal_need', phase: 'core', action: 'keep', stages: 'all', why_ar: 'وضوح الهدف يقرر: انتقال سريع للأدلة أم استكشاف أعمق — ويدخل الثقة.', impact_ar: '«واضح تمامًا» مقابل «غامض» يغيّر مسار الجلسة والثقة النهائية.' },
  'QB-M2-010': { action: 'replaced', replaced_by: Q.MASTERY, why_ar: '«توسع أفقي/تعمق عمودي» مصطلح داخلي — استُبدل بسؤال إتقان مقابل منظومة بلغة المستخدم، ولا يُسأل إلا عند غموض قياسي/مركب.', impact_ar: 'خليفته يفصل بين مسار واحد وخطة مركبة.' },
  'QB-M2-015': { surface: 'b2c', layer21: 'feasibility', phase: 'adaptive', action: 'keep', stages: 'all', why_ar: 'الاستعداد للتطبيق العملي يضبط طبيعة الخطة (مشاريع مقابل محتوى نظري).', impact_ar: '«جاهز للتطبيق» مقابل «أفضل النظرية» يغيّر مكون الخطة لا المسار.' },
  'QB-M2-016': { surface: 'post_recommendation', action: 'move_post', why_ar: 'تفضيل التعامل مع مهارة غير متوفرة يُعرض بعد التوصية لا قبلها.', impact_ar: 'لا أثر على اختيار المسار.' },

  'QB-M3A-003': { surface: 'b2c', layer21: 'goal_need', phase: 'adaptive', action: 'keep', stages: STUDENTISH, why_ar: 'وضوح تصور أول وظيفة يفصل «جاهزية توظيف» عن «استكشاف اتجاه».', impact_ar: 'يغيّر المجال المتصدر لطالب/خريج.' },
  'QB-M3A-004': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: STUDENTISH, why_ar: 'وجود سيرة/ملف أصول مهنية دليل مباشر على جاهزية التوظيف.', impact_ar: 'يفصل مسارات الجاهزية عن بناء الأساس.' },
  'QB-M3A-005': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: [...STUDENTISH, 'freelancer'], why_ar: 'ملف الأعمال دليل مهارة قابل للعرض — يدعم أهداف بناء الهوية المهنية.', impact_ar: 'يغيّر قوة الأدلة وترتيب مسارات العلامة الشخصية.' },
  'QB-M3A-006': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: STUDENTISH, why_ar: 'الثقة بالمقابلات بصياغة دليلية تقيس فجوة جاهزية حقيقية.', impact_ar: 'تغيّر فجوة المهارات المقيسة لمسارات التوظيف.' },
  'QB-M3A-007': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: STUDENTISH, why_ar: 'التعرض العملي (تدريب/تطوع) دليل خبرة يفرّق بين مسارين متقاربين.', impact_ar: 'يرفع جودة الأدلة وقد يحسم الترتيب.' },

  'QB-M3B-001': { surface: 'b2c', layer21: 'domain_differentiation', phase: 'core', action: 'keep', stages: EMPLOYED, why_ar: 'القطاع (عام/خاص) يفلتر مسارات حكومية بأكملها — استبعاد صارم.', impact_ar: '«حكومي» مقابل «خاص» يفتح/يغلق مسارات حكومية ومجال الخدمات الحكومية.' },
  'QB-M3B-003': { surface: 'b2c', layer21: 'domain_differentiation', phase: 'adaptive', action: 'keep', stages: [...EMPLOYED, ...FOUNDERS], why_ar: 'الاحتكاك بالجمهور يفصل مسارات التواصل/المبيعات عن الداخلية.', impact_ar: 'يغيّر أهلية مسارات الاحتكاك الخارجي.' },
  'QB-M3B-010': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: EMPLOYED, why_ar: 'إدارة أصحاب المصلحة مهارة دالة على جاهزية القيادة والمشاريع.', impact_ar: 'تقيس مهارة متطلبة لمسارات القيادة — تغيّر الفجوة المقيسة.' },
  'QB-M3B-011': { surface: 'b2c', layer21: 'domain_differentiation', phase: 'adaptive', action: 'keep', stages: EMPLOYED, why_ar: 'التخصص الوظيفي (مشتريات/مالية/تسويق…) يربط المجال بالوظيفة الفعلية.', impact_ar: 'كل وظيفة ترفع مجالها — تغيّر ترتيب المسارات.' },
  'QB-M3B-012': { surface: 'b2c', layer21: 'domain_differentiation', phase: 'adaptive', action: 'keep', stages: ['early_career', 'experienced', 'trainer_ld'], why_ar: 'القيادة الفعلية (غير المعلنة في المرحلة) تفصل مسار الموظف عن المدير.', impact_ar: '«أدير أشخاصًا» يفتح مسارات القيادة ويغيّر الأهلية.' },
  'QB-M3B-013': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: EMPLOYED, why_ar: 'تحسين الإجراءات مهارة دالة لمسارات العمليات.', impact_ar: 'تغيّر الفجوة المقيسة لمسارات العمليات.' },
  'QB-M3B-014': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: EMPLOYED, why_ar: 'الحاجة للفهم المالي/الاقتصادي دليل داعم لمجال المالية.', impact_ar: 'يرفع مجال المالية عند التقارب.' },
  'QB-M3B-015': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: 'all', why_ar: 'الجاهزية لتعلم AI دليل داعم لمجال الذكاء الاصطناعي.', impact_ar: 'يرفع مجال AI عند التقارب.' },

  'QB-M3C-001': { surface: 'b2c', layer21: 'domain_differentiation', phase: 'core', action: 'rewrite', stages: 'all', why_ar: 'مرحلة المشروع تحسم «إطلاق أم نمو» — حاسمة لهدف المشروع.', impact_ar: '«فكرة» مقابل «مشروع قائم» يغيّر الهدف المحسوم والمسار.' },
  'QB-M3C-002': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: FOUNDERS, why_ar: 'وضوح العرض دليل نضج يفصل مسارات الإطلاق عن النمو.', impact_ar: 'يغيّر الترتيب بين مسارات الريادة.' },
  'QB-M3C-004': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: FOUNDERS, why_ar: 'وجود عملاء/مبيعات دليل مرحلة قاطع.', impact_ar: 'يحسم مرحلة المشروع والمسار.' },
  'QB-M3C-007': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: FOUNDERS, why_ar: 'التحدث مع العملاء دليل ممارسة يفصل عن الريادة النظرية.', impact_ar: 'يقيس مهارة اكتشاف العميل — تغيّر الفجوة.' },
  'QB-M3C-008': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: FOUNDERS, why_ar: 'إغلاق البيع مهارة دالة للمسارات التجارية.', impact_ar: 'تغيّر الفجوة المقيسة لمسارات المبيعات/النمو.' },
  'QB-M3C-009': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: FOUNDERS, why_ar: 'معرفة الأرقام دليل على النضج المالي للمشروع.', impact_ar: 'تغيّر فجوة المالية لمسارات الريادة.' },
  'QB-M3C-010': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: FOUNDERS, why_ar: 'انتظام العمليات دليل نضج تشغيلي.', impact_ar: 'تغيّر فجوة العمليات لمسارات الريادة.' },
  'QB-M3C-011': { surface: 'b2c', layer21: 'domain_differentiation', phase: 'adaptive', action: 'keep', stages: FOUNDERS, why_ar: 'العمل منفردًا أم مع فريق يفصل مسارات القيادة عن الإتقان الفردي.', impact_ar: 'يغيّر أهلية مسارات قيادة الفرق للمؤسسين.' },

  'QB-M3E-002': { surface: 'b2c', layer21: 'domain_differentiation', phase: 'adaptive', action: 'keep', stages: 'all', why_ar: 'قائمة الميول المختصرة تكتشف المجال عندما يكون الهدف والاحتياج غير محسومين.', impact_ar: 'تفتح مجالات لم تظهر من الهدف — تغيّر المرشحين.' },
  'QB-M3E-004': { surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'keep', stages: 'all', why_ar: 'التجربة العملية السابقة دليل يفصل الاستكشاف الجاد عن الفضول.', impact_ar: 'تغيّر نوع المخرج (استكشافي مقابل تطابق).' },

  'QB-M7-001': { action: 'replaced', replaced_by: Q.TIME, why_ar: 'استُبدل بسؤال الوقت الجديد (4 فئات واضحة) — القديم كرّر «7+» مرتين.', impact_ar: 'خليفته يحدد الجدوى فقط.' },
  'QB-M7-002': { surface: 'post_recommendation', action: 'move_post', why_ar: 'صيغة التعلم قيد منتج (Cohort) — لا تغيّر ماذا يتعلم.', impact_ar: 'لا أثر على المسار.' },
  'QB-M7-003': { surface: 'post_recommendation', action: 'move_post', why_ar: 'تفضيل الدفعة قيد منتج — يُستخدم في العرض لا في التوصية.', impact_ar: 'لا أثر على المسار.' },
  'QB-M7-004': { surface: 'retired_b2c', action: 'retire', why_ar: 'لغة المحتوى — الأكاديمية عربية حاليًا.', impact_ar: 'محذوف من B2C.' },
  'QB-M7-005': { surface: 'retired_b2c', action: 'retire', why_ar: 'الميزانية ليست إشارة ملاءمة أكاديمية — تعالج في العرض/الدفع.', impact_ar: 'محذوف من B2C.' },
  'QB-M7-006': { surface: 'post_recommendation', action: 'move_post', why_ar: 'الحاجة لمدرب تخصيص متابعة بعد التوصية.', impact_ar: 'لا أثر على المسار.' },
  'QB-M7-007': { surface: 'post_recommendation', action: 'move_post', why_ar: 'قبول الواجبات يخصّص الخطة بعد التوصية.', impact_ar: 'لا أثر على المسار.' },
  'QB-M7-008': { surface: 'post_recommendation', action: 'move_post', why_ar: 'وقت التعلم المفضل جدولة لاحقة.', impact_ar: 'لا أثر على المسار.' },
  'QB-M7-009': { surface: 'post_recommendation', action: 'move_post', why_ar: 'أهمية الشهادة عرض لاحق.', impact_ar: 'لا أثر على المسار.' },
  'QB-M7-010': { surface: 'post_recommendation', action: 'move_post', why_ar: 'احتياج الوصول يخصص التجربة — لا يغيّر المسار.', impact_ar: 'لا أثر على المسار.' },
  'QB-M7-011': { surface: 'post_recommendation', action: 'move_post', why_ar: 'الجهاز تخصيص تجربة.', impact_ar: 'لا أثر على المسار.' },
  'QB-M7-012': { surface: 'post_recommendation', action: 'move_post', why_ar: 'عوامل الإكمال متابعة بعد التوصية.', impact_ar: 'لا أثر على المسار.' },
}

/* قاعدة «الجملة الحاسمة»: لا سبب واضح = مرشح تقاعد */
function keepSentence(p: PlanEntry): string | null {
  if (p.surface !== 'b2c') return null
  if (p.impact_ar && !p.impact_ar.startsWith('لا أثر') && !p.impact_ar.startsWith('خارج')) {
    return `هذا السؤال موجود لأن إجابة مقابل أخرى تغيّر: ${p.impact_ar.replace(/\.$/, '')}.`
  }
  return null
}

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

/* بناء الخطة */
const plan: Record<string, PlanEntry> = {}
const retiredNoReason: string[] = []
for (const q of bank) {
  const mod = q.module_id
  const base = moduleDefault[mod]
  let entry: PlanEntry
  if (base) {
    entry = {
      ...base,
      domains: [],
      impact_ar: base.action === 'keep' ? q.decision_impact : base.why_ar,
      measures: q.measures,
    } as PlanEntry
  } else if (mod === 'M4') {
    entry = {
      surface: 'b2c', layer21: 'evidence_skill', phase: 'adaptive', action: 'rewrite', stages: 'all',
      domains: [], impact_ar: `يقيس مهارة «${q.measures[0]}» بمقياس الدليل — تغيّر الفجوة المقيسة والثقة لكل مسار يتطلبها.`,
      why_ar: 'سؤال دليل مهاري — يُطرح فقط عندما تكون المهارة متطلبة لمرشح متصدر وقادرة على تغيير الترتيب.',
      measures: q.measures,
    }
  } else {
    /* أي سؤال M1/M2/M3 لم يُستعرض صراحة في V2.1 = مرشح تقاعد —
       الإبقاء استثناء موثق لا افتراض (§14/§15: الاستخدام الكثيف ≠ قيمة قرارية) */
    entry = {
      surface: 'retired_b2c',
      layer21: null,
      phase: 'none',
      action: 'retire',
      stages: [],
      domains: [],
      impact_ar: q.decision_impact || 'لا أثر قراري موثق.',
      why_ar: 'لم يُستعرض صراحة في V2.1 — سؤال بلا أثر قراري موثق يصبح مرشح تقاعد.',
      measures: q.measures,
    }
  }
  const ov = overrides[q.question_id]
  if (ov) entry = { ...entry, ...ov } as PlanEntry
  /* سؤال B2C نشط بلا جملة حاسمة = تقاعد إجباري */
  if (entry.surface === 'b2c' && entry.action !== 'replaced' && !keepSentence(entry)) {
    entry = {
      ...entry,
      surface: 'retired_b2c', layer21: null, phase: 'none', action: 'retire', stages: [],
      why_ar: `${entry.why_ar} — سقطت قاعدة الجملة الحاسمة.`,
    }
    retiredNoReason.push(q.question_id)
  }
  plan[q.question_id] = entry
}

/* الأسئلة الجديدة في الخطة */
const newPlan: Record<string, PlanEntry> = {
  [Q.STAGE]: { surface: 'b2c', layer21: 'orientation', phase: 'core', action: 'keep', stages: 'all', domains: [], impact_ar: 'يحدد المرحلة المهنية ويفلتر الأهداف والاحتياجات والأهلية.', why_ar: 'أول حقيقة حاسمة — كل جلسة تبدأ هنا.', measures: ['career_stage'] },
  [Q.EMPLOYMENT]: { surface: 'b2c', layer21: 'orientation', phase: 'core', action: 'keep', stages: 'all', domains: [], impact_ar: 'يفصل أول وظيفة عن ترقية ويضبط واقعية التوصية.', why_ar: 'حالة العمل منفصلة عن المرحلة — تُسأل عند الحاجة فقط.', measures: ['employment_state'] },
  [Q.GOAL]: { surface: 'b2c', layer21: 'goal_need', phase: 'core', action: 'keep', stages: 'all', domains: [], impact_ar: 'يحدد فضاء المشكلة بخيارات مفلترة حسب المرحلة.', why_ar: 'الهدف قبل المجال قبل المسار.', measures: ['primary_goal'] },
  [Q.NEED]: { surface: 'b2c', layer21: 'goal_need', phase: 'core', action: 'keep', stages: 'all', domains: NEEDS_V21.flatMap((n) => n.domains), impact_ar: 'يكتشف المجال — محرك التمييز الرئيس بين المسارات والقوالب.', why_ar: 'الاحتياج الحقيقي لا اسم المسار.', measures: ['need_id'] },
  [Q.TIME]: { surface: 'b2c', layer21: 'feasibility', phase: 'core', action: 'keep', stages: 'all', domains: [], impact_ar: 'يحدد الجدوى وطول الخطة فقط.', why_ar: 'إشارة جدوى حقيقية.', measures: ['weekly_load'] },
  [Q.MASTERY]: { surface: 'b2c', layer21: 'confirmation_deep', phase: 'confirmation', action: 'keep', stages: 'all', domains: [], impact_ar: 'يفصل قياسيًا عن مركبًا عند الغموض.', why_ar: 'لا يُسأل إلا عند غموض فعلي.', measures: ['mastery_portfolio_pref'] },
}
Object.assign(plan, newPlan)

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

const md = `# بطاقات قرار الأسئلة — V2.1

> كل سؤال في البنك (192) + أسئلة القرار الستة الجديدة = **${allQuestions.length} بطاقة**.
> القاعدة الصارمة: سؤال B2C نشط لا تكتمل جملته «هذا السؤال موجود لأن إجابة أ مقابل ب تغيّر ___» يصبح مرشح تقاعد تلقائيًا.
> مولّد من \`scripts/build-v2_1-overlays.ts\` — لا يُحرر يدويًا. المصدر: question-plan.v2_1.json.

## ملخص القرارات

| القرار | العدد |
|---|---|
| إبقاء | ${counts.keep} |
| إعادة صياغة (M4 بمقياس الدليل) | ${counts.rewrite} |
| استبدال بسؤال جديد | ${counts.replaced} |
| نقل لما بعد التوصية | ${counts.move_post} |
| تقاعد | ${counts.retire} |
| خارج النطاق (B2B/أسري) | ${counts.out_of_scope} |
| **أسئلة B2C النشطة** | **${b2cActive}** |

${retiredNoReason.length ? `## أسئلة سقطت بقاعدة الجملة الحاسمة\n\n${retiredNoReason.map((id) => `- ${id}`).join('\n')}\n` : ''}
---

${cards.join('\n\n')}
`
writeFileSync(`${root}/docs/QUESTION_DECISION_CARDS_AR.md`, md, 'utf8')
console.log('✍️  docs/QUESTION_DECISION_CARDS_AR.md')
console.log(`\n📊 B2C نشط: ${b2cActive} · إبقاء ${counts.keep} · إعادة صياغة ${counts.rewrite} · استبدال ${counts.replaced} · نقل ${counts.move_post} · تقاعد ${counts.retire} · خارج النطاق ${counts.out_of_scope}`)
if (retiredNoReason.length) console.log('⚠️  سقطت بالقاعدة:', retiredNoReason.join(', '))
