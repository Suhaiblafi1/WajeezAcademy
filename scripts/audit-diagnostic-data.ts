/* تدقيق بيانات التشخيص — يفشل (exit 1) عند أي خلل بنيوي.
   يعمل بـ tsx خارج المتصفح: يقرأ ملفات JSON مباشرة من القرص. */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'))

const questions = read('src/data/catalog/questions.v1.ar.json')
const skills = read('src/data/catalog/skills.v1.ar.json')
const core = read('src/data/catalog/core-catalog.v2.json')
const templates = read('src/data/catalog/composite-templates.v1.json')
const optionEffects = read('src/data/overlays/option-effects.v2.json')
const pathwayProfiles = read('src/data/overlays/pathway-profiles.v1.json')
const trainers = read('src/data/overlays/trainer-profiles.v1.json')

const KNOWN_TRIGGERS = new Set([
  'always',
  'organization_campaign',
  'confidence_medium_or_user_request',
  'enough_for_basic_result',
  'goal_clarity_low AND pathway_selected',
  'goal_urgent AND weekly_load_low',
  'low_confidence OR user_flagged_uncertainty',
  'many_high_skills AND low_evidence',
  'recommendation_generated',
  'recommendation_rejected',
  'sensitive_answers_present',
  'top_two_pathways_close',
])

const problems: string[] = []
const check = (cond: boolean, msg: string) => {
  if (!cond) problems.push(msg)
}

/* 1) الأعداد المرجعية */
check(questions.questions.length === 192, `عدد الأسئلة ${questions.questions.length} ≠ 192`)
check(skills.skills.length === 216, `عدد المهارات ${skills.skills.length} ≠ 216`)
check(core.launch_pathways.length === 20, `عدد المسارات ${core.launch_pathways.length} ≠ 20`)
check(core.courses.length === 100, `عدد الدورات ${core.courses.length} ≠ 100`)
check(core.modules.length === 400, `عدد الوحدات ${core.modules.length} ≠ 400`)
check(templates.templates.length === 16, `عدد القوالب ${templates.templates.length} ≠ 16`)

/* 2) عدم تكرار المعرفات */
const dup = (arr: string[], label: string) => {
  const seen = new Set<string>()
  for (const id of arr) {
    check(!seen.has(id), `${label}: معرف مكرر ${id}`)
    seen.add(id)
  }
}
dup(questions.questions.map((q: { question_id: string }) => q.question_id), 'questions')
dup(skills.skills.map((s: { skill_id: string }) => s.skill_id), 'skills')
dup(core.launch_pathways.map((p: { id: string }) => p.id), 'pathways')
dup(core.courses.map((c: { course_id: string }) => c.course_id), 'courses')
dup(templates.templates.map((t: { template_id: string }) => t.template_id), 'templates')

/* 3) سلامة المراجع */
const skillIds = new Set([
  ...skills.skills.map((s: { skill_id: string }) => s.skill_id),
  ...(core.skill_extensions ?? []).map((s: { skill_id: string }) => s.skill_id),
])
const skillSlugSet = new Set([
  ...skills.skills.map((s: { slug: string }) => s.slug),
  ...(core.skill_extensions ?? []).map((s: { slug: string }) => s.slug),
])
const courseIds = new Set(core.courses.map((c: { course_id: string }) => c.course_id))
const pathwayIds = new Set(core.launch_pathways.map((p: { id: string }) => p.id))
const questionIds = new Set(questions.questions.map((q: { question_id: string }) => q.question_id))

for (const c of core.courses as { course_id: string; pathway_id: string; skill_ids: string[]; skill_slugs: string[] }[]) {
  check(pathwayIds.has(c.pathway_id), `دورة ${c.course_id} تشير لمسار غير موجود ${c.pathway_id}`)
  for (const sid of c.skill_ids) check(skillIds.has(sid), `دورة ${c.course_id} تشير لمهارة غير موجودة ${sid}`)
  for (const slug of c.skill_slugs) check(skillSlugSet.has(slug), `دورة ${c.course_id} تشير لـslug غير موجود ${slug}`)
}
for (const p of core.launch_pathways as { id: string; course_ids: string[] }[]) {
  check(p.course_ids.length > 0, `مسار ${p.id} بلا دورات`)
  for (const cid of p.course_ids) check(courseIds.has(cid), `مسار ${p.id} يشير لدورة غير موجودة ${cid}`)
  check(pathwayProfiles.profiles[p.id] !== undefined, `مسار ${p.id} بلا ملف تعريف في pathway-profiles.v1.json`)
}

/* 4) المحفزات معروفة */
for (const q of questions.questions as { question_id: string; trigger_condition: string }[]) {
  check(KNOWN_TRIGGERS.has(q.trigger_condition), `سؤال ${q.question_id} بمحفز غير معروف: ${q.trigger_condition}`)
}

/* 5) كل خيار في سؤال اختياري يقيس حقيقة حاسمة له تأثير صريح */
const CRITICAL_FACTS = [
  'persona_type', 'primary_goal', 'goal_clarity', 'weekly_load', 'application_readiness',
  'business_stage', 'revenue_signal', 'offer_clarity', 'operations_maturity', 'team_context',
  'leadership_context', 'public_facing', 'sector', 'function_specialization', 'education_state',
  'employment_state', 'first_job_clarity', 'career_assets', 'interview_confidence', 'practical_experience',
  'practical_exposure', 'strategic_priority', 'diagnostic_consent', 'minor_flag', 'age_band',
]
const HANDLED_GENERIC = new Set(['likert_5', 'skill_level_5', 'rank_top3', 'short_text'])
for (const q of questions.questions as {
  question_id: string; answer_type: string; measures: string[]; options_ar: string[]
}[]) {
  const critical = q.measures.some((m: string) => CRITICAL_FACTS.includes(m))
  if (!critical) continue
  if (HANDLED_GENERIC.has(q.answer_type)) continue
  if (q.answer_type === 'single_choice_or_text' && q.options_ar.length === 0) {
    check(
      optionEffects.keyword_classifiers[q.question_id] !== undefined,
      `سؤال نصي حاسم ${q.question_id} بلا مصنف كلمات موثق`,
    )
    continue
  }
  const eff = optionEffects.option_effects[q.question_id]
  check(eff !== undefined, `سؤال حاسم ${q.question_id} بلا تأثيرات خيارات موثقة`)
  if (eff) {
    for (let i = 0; i < q.options_ar.length; i++) {
      check(eff[`o${i + 1}`] !== undefined, `سؤال ${q.question_id}: خيار بلا تأثير «${q.options_ar[i]}» (o${i + 1})`)
    }
  }
}

/* 6) القوالب المركبة: دوراتها موجودة وليست مسارات */
for (const t of templates.templates as {
  template_id: string
  not_counted_as_pathway?: boolean
  required_courses?: { course_id: string }[]
  starter_courses?: { course_id: string }[]
  diagnostic?: { required_facts?: { question_ids: string[] }[] }
}[]) {
  check(t.not_counted_as_pathway === true, `قالب ${t.template_id} لا يحمل not_counted_as_pathway=true`)
  for (const rc of t.required_courses ?? []) check(courseIds.has(rc.course_id), `قالب ${t.template_id} يشير لدورة غير موجودة ${rc.course_id}`)
  for (const sc of t.starter_courses ?? []) check(courseIds.has(sc.course_id), `قالب ${t.template_id} (مبدئي) يشير لدورة غير موجودة ${sc.course_id}`)
  for (const rf of t.diagnostic?.required_facts ?? []) {
    for (const qid of rf.question_ids) check(questionIds.has(qid), `قالب ${t.template_id} يشير لسؤال غير موجود ${qid}`)
  }
}

/* 7) المدربون: أي ملف موثق يجب أن يذكر مصدره */
for (const t of trainers.profiles as { trainer_id: string; verified_source?: string }[]) {
  check(Boolean(t.verified_source), `مدرب ${t.trainer_id} بلا مصدر توثيق`)
}

/* 8) أوزان الملاءمة والثقة والمنفعة تُختبر في vitest (تستورد config مباشرة) */

if (problems.length > 0) {
  console.error(`\n❌ فشل التدقيق — ${problems.length} مشكلة:`)
  for (const p of problems.slice(0, 50)) console.error(`  - ${p}`)
  process.exit(1)
}
console.log('✅ تدقيق بيانات التشخيص ناجح:')
console.log('   192 سؤالا · 216 مهارة · 20 مسارا · 100 دورة · 400 وحدة · 16 قالبا مركبا')
console.log('   لا معرفات مكررة · كل المراجع سليمة · كل المحفزات معروفة · كل الأسئلة الحاسمة مغطاة بتأثير موثق')
