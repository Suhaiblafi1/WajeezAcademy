/* قيمة أسئلة التأكيد — أولوية تأليف بدل تخمين
   السؤال الذي دفع لهذا: جولة التدقيق («لديك دقيقة أخرى لنتأكد أكثر؟») مبنية
   بشكل صحيح — تبحث أولا عن سؤال يقيس مهارة فاصلة أو فجوة معروفة (weak_skill)
   قبل أن تلجأ لأسئلة سياق عامة (coverage). لكن التجربة أثبتت أنها لا تجد شيئا
   تسأله لأن بنك الأسئلة يقيس 13 مهارة فقط من 225 مهارة مقررات — فتنتهي كل
   جولة إلى أسئلة سياق لا تضيف دليلا حاسما، بل قد تُنقص الثقة بدل أن تزيدها.

   هذا التقرير يرتّب المهارات التي **لا يوجد لها سؤال قياس بعد** بمقدار قيمتها
   الفعلية لو أُلِّف لها سؤال: كم جلسة محاكاة انتهت وهذه المهارة لا تزال مجهولة
   ضمن خطة الفائز الشخصنة، وكم مسارا مختلفا تمسه. القرار الأكاديمي (نص السؤال)
   يبقى للمالك؛ هذا التقرير يحدد أين يستحق التأليف أولا — لا يقترح نصا.

   حتمي: بذرة ثابتة. لا يغيّر سؤالا ولا محركا — قياس فقط. */

import { writeFileSync } from 'node:fs'
import { createEngineV21 } from '../../src/domain/diagnostic/v2_1'
import { GOALS_V21, NEEDS_V21, Q, type CareerStage } from '../../src/domain/diagnostic/v2_1/maps'
import { questionPlanV21 } from '../../src/domain/diagnostic/v2_1/data'
import { questionById, catalogCourses } from '../../src/domain/diagnostic/catalog'
import type { Answer } from '../../src/domain/diagnostic/types'

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T,>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]

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
const TIME_BY_ORDER = ['أقل من ساعتين أسبوعيًا', '٢–٤ ساعات', '٥–٧ ساعات', '٨ ساعات أو أكثر']
const MASTERY = ['أن أتقن مهارة أو تخصصًا واحدًا بعمق', 'أن أبني مجموعة مهارات مترابطة لتحقيق هدف', 'غير متأكد']
const INTERESTS = ['تقنية', 'أعمال', 'تسويق', 'تعليم', 'صناعة محتوى', 'قيادة', 'حكومة/سياسات', 'مالية', 'لا أعرف']

/* المهارات التي لها بالفعل سؤال قياس نشط B2C — لا حاجة لتأليف جديد لها،
   حتى لو لم تُسأل في جلسة بعينها (تلك مسألة أهلية/ترتيب لا نقص تأليف) */
function skillsWithActiveQuestion(): Set<string> {
  const out = new Set<string>()
  for (const q of questionById.values()) {
    if (q.answer_type !== 'skill_level_5') continue
    const plan = (questionPlanV21 as Record<string, { final_status?: string }>)[q.question_id]
    if (plan?.final_status === 'active_b2c') out.add(q.measures[0])
  }
  return out
}

function main() {
  const seed = Number(process.argv[2] ?? 20260822)
  const sessions = Number(process.argv[3] ?? 400)
  const rng = mulberry32(seed)
  const hasQuestion = skillsWithActiveQuestion()

  /* لكل مهارة بلا سؤال: كم جلسة بقيت فيها مجهولة ضمن خطة الفائز، وأي مسارات مسّتها */
  const unknownSessions = new Map<string, number>()
  const pathwaysTouched = new Map<string, Set<string>>()
  const coursesTouched = new Map<string, Set<string>>()
  let sessionsWithPlan = 0

  for (let i = 0; i < sessions; i++) {
    const stage = pick(rng, ALL_STAGES)
    const goals = GOALS_V21.filter((g) => g.stages === 'all' || g.stages.includes(stage))
    const needs = NEEDS_V21.filter((n) => n.stages === 'all' || n.stages.includes(stage))
    const script = {
      stage,
      employment: pick(rng, ['أعمل لدى جهة', 'لا أعمل حاليًا', 'لدي مشروعي الخاص']),
      goal: pick(rng, goals).label_ar,
      need: pick(rng, needs).label_ar,
      time: pick(rng, TIME_BY_ORDER),
      mastery: pick(rng, MASTERY),
      interest: pick(rng, INTERESTS),
      skillLevel: 1 + Math.floor(rng() * 5),
      govSector: rng() < 0.15,
    }
    const engine = createEngineV21(`cv-${seed}-${i}`)
    for (let step = 0; step < 20; step++) {
      const next = engine.nextQuestion()
      if (next.stop.shouldStop || !next.question) break
      const q = next.question
      const byLabel = (l?: string) => (l ? q.options_ar.indexOf(l) : -1)
      let idx = -1
      if (q.question_id === Q.STAGE) idx = byLabel(STAGE_LABEL[script.stage])
      else if (q.question_id === Q.EMPLOYMENT) idx = byLabel(script.employment)
      else if (q.question_id === Q.GOAL) idx = byLabel(script.goal)
      else if (q.question_id === Q.NEED) idx = byLabel(script.need)
      else if (q.question_id === Q.TIME) idx = byLabel(script.time)
      else if (q.question_id === Q.MASTERY) idx = byLabel(script.mastery)
      else if (q.question_id === 'QB-M3E-002') idx = byLabel(script.interest)
      else if (q.question_id === 'QB-M3B-001' && script.govSector) idx = byLabel('حكومي')
      else if (q.answer_type === 'skill_level_5' || q.answer_type === 'likert_5') idx = script.skillLevel - 1
      else idx = 0
      if (idx < 0) idx = 0
      const value: Answer['value'] = q.options_ar[idx] ?? 'لا ينطبق'
      engine.answer({ questionId: q.question_id, value, optionIds: [q.active_option_ids?.[idx] ?? `o${idx + 1}`] })
    }
    const rec = engine.recommend() as unknown as {
      personalPlan?: { pathwayId: string; courses: { courseId: string; unknownSkills: string[] }[] }
    }
    const plan = rec.personalPlan
    if (!plan) continue
    sessionsWithPlan++
    const seenThisSession = new Set<string>()
    for (const course of plan.courses) {
      for (const slug of course.unknownSkills) {
        if (hasQuestion.has(slug)) continue
        seenThisSession.add(slug)
        if (!pathwaysTouched.has(slug)) pathwaysTouched.set(slug, new Set())
        pathwaysTouched.get(slug)!.add(plan.pathwayId)
        if (!coursesTouched.has(slug)) coursesTouched.set(slug, new Set())
        coursesTouched.get(slug)!.add(course.courseId)
      }
    }
    for (const slug of seenThisSession) unknownSessions.set(slug, (unknownSessions.get(slug) ?? 0) + 1)
  }

  const rows = [...unknownSessions.entries()]
    .map(([slug, count]) => ({
      slug,
      sessionRate: count / Math.max(1, sessionsWithPlan),
      sessions: count,
      pathways: [...(pathwaysTouched.get(slug) ?? [])].sort(),
      courseCount: coursesTouched.get(slug)?.size ?? 0,
    }))
    .sort((a, b) => b.sessions - a.sessions || b.pathways.length - a.pathways.length)

  const totalCourseSkills = new Set(catalogCourses.flatMap((c) => c.skill_slugs)).size
  const measuredCount = hasQuestion.size

  const md: string[] = []
  md.push('# أولوية تأليف أسئلة التأكيد — V2.1', '')
  md.push(`توليد: ${new Date().toISOString().slice(0, 10)} · بذرة ${seed} · ${sessions} جلسة حتمية (${sessionsWithPlan} أنتجت خطة مسار واحد).`, '')
  md.push('> جولة «لديك دقيقة أخرى لنتأكد أكثر؟» تبحث أولا عن سؤال يقيس مهارة مجهولة')
  md.push(`> ضمن خطة الفائز. وبنك الأسئلة يقيس اليوم **${measuredCount} من ${totalCourseSkills}** مهارة مقررات فقط —`)
  md.push('> فتفشل الجولة في إيجاد سؤال مهارة، وتلجأ لأسئلة سياق عامة لا تضيف دليلا حاسما.', '')
  md.push('## القراءة', '')
  md.push('- **نسبة الجلسات** = من الجلسات التي أنتجت خطة، كم بقيت هذه المهارة مجهولة ضمنها — أي كم مرة كانت جولة التأكيد ستحتاجها لو وُجد سؤال.')
  md.push('- **المسارات الممسوسة** = كم مسارا مختلفا يحتاج تأليفا لهذه المهارة تحديدا — سؤال واحد قد يخدم عدة مسارات.')
  md.push('- هذا ترتيب أولوية لا اقتراح نص: نص السؤال قرار أكاديمي بالكامل.', '')
  md.push('## الجدول — الأعلى قيمة أولا', '')
  md.push('| المهارة | نسبة الجلسات | جلسات | مقررات ممسوسة | مسارات ممسوسة |')
  md.push('|---|---|---|---|---|')
  for (const r of rows.slice(0, 40)) {
    md.push(`| \`${r.slug}\` | ${(r.sessionRate * 100).toFixed(1)}٪ | ${r.sessions} | ${r.courseCount} | ${r.pathways.join('، ')} |`)
  }
  md.push('')
  if (rows.length > 40) md.push(`_(${rows.length - 40} مهارة إضافية بقيمة أقل — غير مدرجة هنا)_`, '')

  writeFileSync('docs/CONFIRMATION_QUESTION_PRIORITY_V2_1_AR.md', md.join('\n'))
  console.log(`📄 docs/CONFIRMATION_QUESTION_PRIORITY_V2_1_AR.md — ${rows.length} مهارة بلا سؤال ظهرت مجهولة في خطة فائز`)
  console.log(`   أعلى خمس أولوية:`, rows.slice(0, 5).map((r) => `${r.slug}(${(r.sessionRate * 100).toFixed(0)}٪·${r.pathways.length}مسار)`).join(' · '))
}
main()
