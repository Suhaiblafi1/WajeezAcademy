/* محاكاة Monte Carlo مزروعة البذرة — 10,000 جلسة حتمية التكرار.
   بذرة ثابتة = نفس النتائج في كل تشغيل (لا عشوائية غير موثقة).
   الاستخدام: npx tsx scripts/simulate-v2-montecarlo.ts [seed] [sessions] */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runSession, type PersonaSpec, type SessionResult } from './v2/sim-lib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/* مولّد أرقام شبه عشوائية مزروع — mulberry32 */
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

const GOALS = ['employment_advancement', 'business_launch', 'career_direction', 'personal_growth', 'family_wellbeing', 'lead_team', 'explore']
const CLARITY = ['high', 'medium', 'low']
const LOADS = ['lt_3', '3_4', '5_6', '7_plus']
const READINESS = ['high', 'medium', 'low']
const STAGE_TEXTS: [string, string][] = [
  ['عندي فكرة ولم أبدأ', 'idea'],
  ['أتحقق وأختبر', 'validation'],
  ['لم أبع بعد', 'pre_revenue'],
  ['بدأت أبيع وأول مبيعات', 'early_revenue'],
  ['ينمو ويتوسع', 'growing'],
  ['مستقر وقائم منذ سنوات', 'established'],
]
const SKILL_POOL = ['analytical_thinking', 'creative_thinking', 'ai_literacy', 'digital_literacy', 'data_literacy', 'digital_marketing', 'sales', 'project_management', 'leadership_influence', 'public_speaking', 'financial_literacy', 'learning_agility', 'focus_management']

function randomSpec(rng: () => number): PersonaSpec {
  const archetype = pick(rng, ['school', 'university', 'graduate', 'job_seeker', 'junior', 'experienced', 'manager', 'gov', 'founder_idea', 'founder_op', 'freelancer', 'parent', 'unsure', 'b2b', 'b2g'] as const)
  const facts: Record<string, string> = {
    decision_owner: 'self',
    diagnostic_consent: 'yes',
    goal_clarity: pick(rng, CLARITY),
    weekly_load: pick(rng, LOADS),
    application_readiness: pick(rng, READINESS),
  }
  const optionText: Record<string, string> = {}
  const textAnswers: Record<string, string> = {}
  switch (archetype) {
    case 'school':
      Object.assign(facts, { persona_type: 'student', education_state: 'school', primary_goal: pick(rng, ['career_direction', 'personal_growth', 'explore', 'business_launch']) })
      optionText['QB-M1-001'] = 'طالب مدرسة'
      break
    case 'university':
      Object.assign(facts, { persona_type: 'student', education_state: 'university', employment_state: pick(rng, ['not_working', 'employed'] as const), primary_goal: pick(rng, GOALS.filter((g) => g !== 'family_wellbeing')) })
      optionText['QB-M1-001'] = 'طالب جامعة'
      break
    case 'graduate':
      Object.assign(facts, { persona_type: 'early_career', education_state: 'graduate', employment_state: pick(rng, ['not_working', 'employed'] as const), primary_goal: pick(rng, GOALS) })
      optionText['QB-M1-001'] = 'خريج جديد'
      break
    case 'job_seeker':
      Object.assign(facts, { persona_type: 'early_career', education_state: 'university', employment_state: 'not_working', primary_goal: pick(rng, ['employment_advancement', 'career_direction', 'explore']) })
      optionText['QB-M1-001'] = 'باحث عن عمل'
      break
    case 'junior':
    case 'experienced':
      Object.assign(facts, { persona_type: 'employee', employment_state: 'employed', sector: 'private', leadership_context: 'none', primary_goal: pick(rng, GOALS.filter((g) => g !== 'family_wellbeing')) })
      optionText['QB-M1-001'] = 'موظف'
      break
    case 'manager':
      Object.assign(facts, { persona_type: 'employee', employment_state: 'employed', sector: 'private', leadership_context: 'informal', primary_goal: pick(rng, ['lead_team', 'employment_advancement', 'personal_growth']) })
      optionText['QB-M1-001'] = 'موظف'
      break
    case 'gov':
      Object.assign(facts, { persona_type: 'employee', employment_state: 'employed', sector: 'public', leadership_context: pick(rng, ['none', 'informal'] as const), primary_goal: pick(rng, ['employment_advancement', 'lead_team', 'personal_growth']) })
      optionText['QB-M1-001'] = 'موظف'
      break
    case 'founder_idea':
    case 'founder_op':
      Object.assign(facts, { persona_type: 'founder', employment_state: 'business_owner', primary_goal: pick(rng, ['business_launch', 'personal_growth']) })
      optionText['QB-M1-001'] = 'رائد أعمال/مستقل'
      textAnswers['QB-M3C-001'] = archetype === 'founder_idea' ? pick(rng, STAGE_TEXTS.slice(0, 3))[0] : pick(rng, STAGE_TEXTS.slice(3))[0]
      break
    case 'freelancer':
      Object.assign(facts, { persona_type: 'freelancer', employment_state: 'self_employed', primary_goal: pick(rng, ['business_launch', 'personal_growth', 'career_direction']) })
      optionText['QB-M1-001'] = 'رائد أعمال/مستقل'
      textAnswers['QB-M3C-001'] = 'أعمل بمشروعي الحر وبدأت أبيع'
      break
    case 'parent':
      Object.assign(facts, { persona_branch: 'family', primary_goal: 'family_wellbeing' })
      optionText['QB-M1-001'] = 'أب/أم'
      break
    case 'unsure':
      Object.assign(facts, { persona_branch: 'unsure', primary_goal: 'explore', goal_clarity: 'low' })
      optionText['QB-M1-001'] = 'غير متأكد'
      break
    case 'b2b':
      Object.assign(facts, { decision_owner: 'employer', payer_type: 'employer', sector: 'private' })
      optionText['QB-M1-001'] = 'موظف'
      break
    case 'b2g':
      Object.assign(facts, { decision_owner: 'employer', payer_type: 'employer', sector: 'public' })
      optionText['QB-M1-001'] = 'موظف'
      break
  }
  const skillLevels: Record<string, number> = {}
  for (const s of SKILL_POOL) skillLevels[s] = 1 + Math.floor(rng() * 5)
  return {
    id: `mc-${archetype}`,
    category: archetype === 'school' || archetype === 'university' || archetype === 'graduate' ? 'students' : archetype.startsWith('founder') || archetype === 'freelancer' ? 'business' : archetype === 'parent' || archetype === 'unsure' || archetype.startsWith('b2') ? 'other' : 'employees',
    label_ar: archetype,
    facts,
    optionText,
    textAnswers,
    skillLevels,
    likertDefault: 1 + Math.floor(rng() * 5),
  }
}

const seed = Number(process.argv[2] ?? 20260816)
const sessions = Number(process.argv[3] ?? 10000)
const rng = mulberry32(seed)

const byPathway = new Map<string, number>()
const byPathwayTop3 = new Map<string, number>()
const byDomain = new Map<string, number>()
const byOutput = new Map<string, number>()
const questionCounts: number[] = []
let invalid = 0
let unmeasured = 0
let dupes = 0
let advisor = 0
const violations: string[] = []

for (let i = 0; i < sessions; i++) {
  const spec = randomSpec(rng)
  const r: SessionResult = runSession(spec, `mc-${i}`)
  questionCounts.push(r.answersCount)
  if (r.topPathwayId) {
    byPathway.set(r.topPathwayId, (byPathway.get(r.topPathwayId) ?? 0) + 1)
  }
  for (const pid of r.top3PathwayIds) byPathwayTop3.set(pid, (byPathwayTop3.get(pid) ?? 0) + 1)
  if (r.compositeTemplateId) byPathway.set(`template:${r.compositeTemplateId}`, (byPathway.get(`template:${r.compositeTemplateId}`) ?? 0) + 1)
  if (r.domainTop) byDomain.set(r.domainTop, (byDomain.get(r.domainTop) ?? 0) + 1)
  if (r.outputKind) byOutput.set(r.outputKind, (byOutput.get(r.outputKind) ?? 0) + 1)
  if (r.kind === 'advisor_referral') advisor++
  invalid += r.invalidPersonaQuestions.length
  unmeasured += r.unmeasuredInfluence.length
  dupes += r.duplicateQuestions.length
  if (r.invalidPersonaQuestions.length > 0 && violations.length < 20) {
    violations.push(`${spec.id}#${i}: ${r.invalidPersonaQuestions.join(', ')}`)
  }
}

questionCounts.sort((a, b) => a - b)
const sum = questionCounts.reduce((a, b) => a + b, 0)
const total = sessions

const report = {
  seed,
  sessions,
  questions: {
    avg: +(sum / total).toFixed(2),
    median: questionCounts[Math.floor(total / 2)],
    max: questionCounts[total - 1],
  },
  advisorReferralRate: +(advisor / total).toFixed(4),
  pathwayDistribution: Object.fromEntries([...byPathway.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / total).toFixed(4)])),
  pathwayTop3Distribution: Object.fromEntries([...byPathwayTop3.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / total).toFixed(4)])),
  domainDistribution: Object.fromEntries([...byDomain.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / total).toFixed(4)])),
  outputKindDistribution: Object.fromEntries([...byOutput.entries()].map(([k, v]) => [k, +(v / total).toFixed(4)])),
  invariants: {
    invalidPersonaQuestions: invalid,
    unmeasuredSkillInfluence: unmeasured,
    duplicateQuestions: dupes,
  },
  sampleViolations: violations,
}

const outDir = join(root, 'docs/diagnostic-v2')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'montecarlo-report.json'), JSON.stringify(report, null, 2))

console.log(`بذرة: ${seed} | جلسات: ${sessions}`)
console.log(`أسئلة: متوسط ${report.questions.avg} | وسيط ${report.questions.median} | أقصى ${report.questions.max}`)
console.log(`إحالة مستشار: ${(report.advisorReferralRate * 100).toFixed(1)}٪`)
console.log('الثوابت:', JSON.stringify(report.invariants))
console.log('توزيع المسارات (%):', JSON.stringify(report.pathwayDistribution, null, 1))
console.log('توزيع المخرجات:', JSON.stringify(report.outputKindDistribution))

/* فوز غير طبيعي = تحذير: أي مسار يتجاوز 35٪ من الجلسات */
const dominant = Object.entries(report.pathwayDistribution).filter(([, v]) => (v as number) > 0.35)
if (dominant.length > 0) console.warn('⚠️ مسارات فائقة الهيمنة:', JSON.stringify(dominant))
if (invalid > 0 || unmeasured > 0 || dupes > 0) {
  console.error('❌ كسر ثوابت صارمة')
  process.exit(1)
}
console.log('✅ كل الثوابت الصارمة = 0')
