/* تنوّع الخطط ووصول المقررات — V2.1

   السؤال الذي أنتج هذا الفحص، بلسان المالك: «كنت أتضايق من وجود مسارات جاهزة
   دائما وكلها تتكرر». فالسؤال ليس «هل المحرك يعمل؟» بل: هل يعطي **أشخاصا
   مختلفين خططا مختلفة**، وهل يستطيع متعلمٌ ما أن يصل إلى **كل** مقرر في
   الكتالوج، أم تبقى مقررات لا يراها أحد أبدا؟

   يقيس على شبكة شخصيات مولَّدة حتميا:
     • كم مسارا فائزا مختلفا · كم خطة مركّبة مختلفة
     • كم مقررا من المئة وصل إليه متعلم واحد على الأقل
     • أكثر مسار/مقرر تكرارا — مؤشر «الجاهز المتكرر»
   لا يغيّر شيئا — قياس فقط. */

import { writeFileSync } from 'node:fs'
import { createEngineV21 } from '../../src/domain/diagnostic/v2_1'
import { GOALS_V21, NEEDS_V21, Q, type CareerStage } from '../../src/domain/diagnostic/v2_1/maps'
import { catalogCourses } from '../../src/domain/diagnostic/catalog'

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T,>(rng: () => number, a: readonly T[]): T => a[Math.floor(rng() * a.length)]

const STAGE_LABEL: Record<CareerStage, string> = {
  university_student: 'طالب جامعي', fresh_graduate: 'خريج حديث',
  early_career: 'موظف في بداية مساري المهني', experienced: 'موظف ذو خبرة',
  manager: 'مدير / قائد فريق', senior_manager: 'مدير أول / تنفيذي',
  founder: 'مؤسس / صاحب عمل', freelancer: 'مستقل — أعمل لحسابي',
  trainer_ld: 'مدرب / معلم / مختص تعلم وتطوير', other_unsure: 'غير ذلك / غير متأكد',
}
const ALL_STAGES = Object.keys(STAGE_LABEL) as CareerStage[]
const TIME = ['أقل من ساعتين أسبوعيًا', '٢–٤ ساعات', '٥–٧ ساعات', '٨ ساعات أو أكثر']
const MASTERY = ['أن أتقن مهارة أو تخصصًا واحدًا بعمق', 'أن أبني مجموعة مهارات مترابطة لتحقيق هدف', 'غير متأكد']

interface Row { pathway: string | null; courses: string[]; composed: boolean }

function runOne(seed: number, i: number, rateFamilies: boolean): Row {
  const rng = mulberry32(seed * 7919 + i)
  const stage = pick(rng, ALL_STAGES)
  const goals = GOALS_V21.filter((g) => g.stages === 'all' || g.stages.includes(stage))
  const needs = NEEDS_V21.filter((n) => n.stages === 'all' || n.stages.includes(stage))
  const s = {
    stage,
    employment: pick(rng, ['أعمل لدى جهة', 'لا أعمل حاليًا', 'لدي مشروعي الخاص']),
    goal: pick(rng, goals).label_ar, need: pick(rng, needs).label_ar,
    time: pick(rng, TIME), mastery: pick(rng, MASTERY),
    skill: 1 + Math.floor(rng() * 5), gov: rng() < 0.15,
  }
  const e = createEngineV21(`div-${seed}-${i}`)
  for (let step = 0; step < 20; step++) {
    const nx = e.nextQuestion()
    if (nx.stop.shouldStop || !nx.question) break
    const q = nx.question
    const by = (l?: string) => (l ? q.options_ar.indexOf(l) : -1)
    let idx = -1
    if (q.question_id === Q.STAGE) idx = by(STAGE_LABEL[s.stage])
    else if (q.question_id === Q.EMPLOYMENT) idx = by(s.employment)
    else if (q.question_id === Q.GOAL) idx = by(s.goal)
    else if (q.question_id === Q.NEED) idx = by(s.need)
    else if (q.question_id === Q.TIME) idx = by(s.time)
    else if (q.question_id === Q.MASTERY) idx = by(s.mastery)
    else if (q.question_id === 'QB-M3B-001' && s.gov) idx = by('حكومي')
    else if (q.answer_type === 'skill_level_5' || q.answer_type === 'likert_5') idx = s.skill - 1
    else idx = Math.floor(rng() * Math.max(1, q.options_ar.length))
    if (idx < 0) idx = 0
    e.answer({ questionId: q.question_id, value: q.options_ar[idx] ?? 'لا ينطبق', optionIds: [q.active_option_ids?.[idx] ?? `o${idx + 1}`] })
  }
  /* المتعلم يقيّم جوانبه — تنويع حتمي يحاكي اختلاف الناس */
  if (rateFamilies) {
    const fams = e.familiesToRate()
    const r: Record<string, number> = {}
    for (const f of fams) r[f.family] = 1 + Math.floor(rng() * 5)
    e.setFamilyRatings(r)
  }
  const rec = e.recommend() as unknown as {
    primaryPathway: { pathwayId: string } | null
    composedPath?: { courses: { courseId: string }[] }
    personalPlan?: { courses: { courseId: string }[] }
  }
  const cp = rec.composedPath?.courses?.map((c) => c.courseId)
  const pp = rec.personalPlan?.courses?.map((c) => c.courseId)
  return { pathway: rec.primaryPathway?.pathwayId ?? null, courses: (cp ?? pp ?? []).slice().sort(), composed: Boolean(cp) }
}

function analyse(rows: Row[], label: string) {
  const pw = new Map<string, number>(), plans = new Map<string, number>(), reach = new Map<string, number>()
  for (const r of rows) {
    if (r.pathway) pw.set(r.pathway, (pw.get(r.pathway) ?? 0) + 1)
    if (r.courses.length) plans.set(r.courses.join('|'), (plans.get(r.courses.join('|')) ?? 0) + 1)
    for (const c of r.courses) reach.set(c, (reach.get(c) ?? 0) + 1)
  }
  const total = rows.length
  const topPw = [...pw.entries()].sort((a, b) => b[1] - a[1])[0]
  const topPlan = [...plans.entries()].sort((a, b) => b[1] - a[1])[0]
  return {
    label, total,
    distinctPathways: pw.size,
    distinctPlans: plans.size,
    coursesReached: reach.size,
    coursesTotal: catalogCourses.length,
    topPathwayShare: topPw ? topPw[1] / total : 0,
    topPathwayId: topPw?.[0] ?? '—',
    topPlanShare: topPlan ? topPlan[1] / total : 0,
    unreached: catalogCourses.filter((c) => !reach.has(c.course_id)).map((c) => c.course_id),
  }
}

function main() {
  const seed = Number(process.argv[2] ?? 20260823)
  const n = Number(process.argv[3] ?? 400)
  const before = analyse(Array.from({ length: n }, (_, i) => runOne(seed, i, false)), 'بلا تقييم جوانب (كما كان)')
  const after = analyse(Array.from({ length: n }, (_, i) => runOne(seed, i, true)), 'مع تقييم الجوانب (بعد التوصيل)')

  const md: string[] = []
  md.push('# تنوّع الخطط ووصول المقررات — V2.1', '')
  md.push(`توليد: ${new Date().toISOString().slice(0, 10)} · بذرة ${seed} · ${n} شخصية حتمية لكل حالة.`, '')
  md.push('| المقياس | ' + before.label + ' | ' + after.label + ' |')
  md.push('|---|---|---|')
  const row = (k: string, a: string | number, b: string | number) => md.push(`| ${k} | ${a} | ${b} |`)
  row('مسارات فائزة مختلفة', before.distinctPathways, after.distinctPathways)
  row('خطط مختلفة (مجموعات دورات)', before.distinctPlans, after.distinctPlans)
  row('مقررات وصل إليها متعلم', `${before.coursesReached} من ${before.coursesTotal}`, `${after.coursesReached} من ${after.coursesTotal}`)
  row('حصة أكثر مسار تكرارا', `${(before.topPathwayShare * 100).toFixed(1)}٪ (${before.topPathwayId})`, `${(after.topPathwayShare * 100).toFixed(1)}٪ (${after.topPathwayId})`)
  row('حصة أكثر خطة تكرارا', `${(before.topPlanShare * 100).toFixed(1)}٪`, `${(after.topPlanShare * 100).toFixed(1)}٪`)
  md.push('')
  if (after.unreached.length) {
    md.push(`## مقررات لم يصل إليها أحد بعد التوصيل (${after.unreached.length})`, '')
    for (const id of after.unreached) {
      const c = catalogCourses.find((x) => x.course_id === id)!
      md.push(`- \`${id}\` — ${c.title_ar} (${c.pathway_id})`)
    }
    md.push('')
  } else md.push('## كل مقرر في الكتالوج وصل إليه متعلم واحد على الأقل.', '')

  writeFileSync('docs/PLAN_DIVERSITY_V2_1_AR.md', md.join('\n'))
  console.log('📄 docs/PLAN_DIVERSITY_V2_1_AR.md')
  console.log(`  قبل: ${before.distinctPathways} مسارا · ${before.distinctPlans} خطة · ${before.coursesReached}/${before.coursesTotal} مقررا · أكثر مسار ${(before.topPathwayShare*100).toFixed(1)}٪`)
  console.log(`  بعد: ${after.distinctPathways} مسارا · ${after.distinctPlans} خطة · ${after.coursesReached}/${after.coursesTotal} مقررا · أكثر مسار ${(after.topPathwayShare*100).toFixed(1)}٪`)
  console.log(`  مقررات لم يصلها أحد: ${after.unreached.length}`)
}
main()
