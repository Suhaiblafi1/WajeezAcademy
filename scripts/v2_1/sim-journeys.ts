/* محاكاة رحلات V2.1 التسع المطلوبة — لكل رحلة: سؤال → لماذا الآن → إجابة → ما الذي تغيّر.
   حتمي: كل شخصية تُشغّل مرتين ويجب تطابق الأسئلة والنتيجة.
   الناتج: docs/diagnostic-v2_1/journeys.v2_1.json + ملخص console. */

import { mkdirSync, writeFileSync } from 'node:fs'
import { createEngineV21 } from '../../src/domain/diagnostic/v2_1'
import { Q, type CareerStage } from '../../src/domain/diagnostic/v2_1/maps'

interface PersonaScript {
  id: string
  label_ar: string
  stage: CareerStage
  employment?: string // optionId
  goalMatch?: string // نص جزئي من خيار الهدف
  needMatch?: string // نص جزئي من خيار الاحتياج
  skillLevel?: number
}

const PERSONAS: PersonaScript[] = [
  { id: 'uni', label_ar: 'طالب جامعي', stage: 'university_student', employment: 'o1', goalMatch: 'أول وظيفة', needMatch: 'الجاهزية لسوق العمل', skillLevel: 2 },
  { id: 'grad', label_ar: 'خريج حديث + باحث عن عمل', stage: 'fresh_graduate', employment: 'o2', goalMatch: 'أول وظيفة', needMatch: 'الجاهزية لسوق العمل', skillLevel: 2 },
  { id: 'junior', label_ar: 'موظف مبتدئ', stage: 'early_career', employment: 'o3', goalMatch: 'تحسين أدائي', needMatch: 'الذكاء الاصطناعي', skillLevel: 3 },
  { id: 'experienced', label_ar: 'موظف خبير', stage: 'experienced', employment: 'o3', goalMatch: 'الترقية', needMatch: 'إدارة المشاريع', skillLevel: 4 },
  { id: 'manager', label_ar: 'مدير', stage: 'manager', employment: 'o3', goalMatch: 'قيادي', needMatch: 'القيادة', skillLevel: 4 },
  { id: 'founder', label_ar: 'مؤسس', stage: 'founder', goalMatch: 'تنمية مشروعي', needMatch: 'التسويق', skillLevel: 3 },
  { id: 'freelancer', label_ar: 'مستقل', stage: 'freelancer', goalMatch: 'العمل الحر', needMatch: 'المبيعات', skillLevel: 3 },
  { id: 'trainer', label_ar: 'مدرب / مختص تعلم وتطوير', stage: 'trainer_ld', employment: 'o3', goalMatch: 'تصميم تدريب', needMatch: 'التعلم والتدريب', skillLevel: 4 },
  { id: 'unsure', label_ar: 'غير محسوم', stage: 'other_unsure', employment: 'o1', goalMatch: 'غير متأكد', needMatch: 'غير متأكد', skillLevel: 3 },
]

function pickOption(options: string[], activeIds: string[] | undefined, match: string | undefined, fallbackIdx: number): { idx: number; optionId: string } {
  let idx = match ? options.findIndex((o) => o.includes(match)) : -1
  if (idx < 0) idx = Math.min(fallbackIdx, options.length - 1)
  return { idx, optionId: activeIds?.[idx] ?? `o${idx + 1}` }
}

function runPersona(p: PersonaScript) {
  const engine = createEngineV21(`journey-${p.id}`)
  const steps: {
    questionId: string
    question_ar: string
    why_now_ar: string
    answer_ar: string
    what_changed: string[]
  }[] = []
  for (let i = 0; i < 20; i++) {
    const step = engine.nextQuestion()
    if (step.stop.shouldStop || !step.question) break
    const q = step.question
    const whyTrace = engine.getState().trace.filter((t) => t.kind === 'question_selected').at(-1)
    const why = (whyTrace?.data?.winnerReason_ar as string | undefined) ?? step.stop.reason_ar

    let chosen: { idx: number; optionId: string }
    if (q.question_id === Q.STAGE) {
      const stages: CareerStage[] = ['university_student', 'fresh_graduate', 'early_career', 'experienced', 'manager', 'senior_manager', 'founder', 'freelancer', 'trainer_ld', 'other_unsure']
      chosen = { idx: stages.indexOf(p.stage), optionId: `o${stages.indexOf(p.stage) + 1}` }
    } else if (q.question_id === Q.EMPLOYMENT) {
      const idx = Number((p.employment ?? 'o1').slice(1)) - 1
      chosen = { idx, optionId: p.employment ?? 'o1' }
    } else if (q.question_id === Q.GOAL) {
      chosen = pickOption(q.options_ar, q.active_option_ids, p.goalMatch, q.options_ar.length - 1)
    } else if (q.question_id === Q.NEED) {
      chosen = pickOption(q.options_ar, q.active_option_ids, p.needMatch, q.options_ar.length - 1)
    } else if (q.answer_type === 'skill_level_5' || q.answer_type === 'likert_5') {
      const lvl = p.skillLevel ?? 3
      chosen = { idx: lvl - 1, optionId: `o${lvl}` }
    } else {
      chosen = pickOption(q.options_ar, q.active_option_ids, undefined, 0)
    }
    const label = q.options_ar[chosen.idx] ?? q.options_ar[0]
    const beforeFacts = new Set(Object.keys(engine.getState().facts))
    const beforeSkills = new Set(Object.keys(engine.getState().skillVector))
    engine.answer({ questionId: q.question_id, value: label, optionIds: [chosen.optionId] })
    const st = engine.getState()
    const changed = [
      ...Object.keys(st.facts).filter((k) => !beforeFacts.has(k)).map((k) => `+${k}`),
      ...Object.keys(st.skillVector).filter((k) => !beforeSkills.has(k)).map((k) => `+skill:${k}`),
    ]
    steps.push({ questionId: q.question_id, question_ar: q.text_ar, why_now_ar: why, answer_ar: label, what_changed: changed })
  }
  const rec = engine.recommend()
  const v2 = rec.v2 as { confidence?: { overall: number; outputKind_ar: string } } | undefined
  return {
    persona: p.label_ar,
    stage: p.stage,
    questionsCount: steps.length,
    steps,
    result: {
      kind: rec.kind,
      topPathwayId: rec.primaryPathway?.pathwayId ?? null,
      compositeTemplateId: rec.composite?.templateId ?? null,
      confidence: v2?.confidence?.overall ?? rec.confidence.total,
      outputKind_ar: v2?.confidence?.outputKind_ar ?? rec.confidence.band_ar,
    },
  }
}

const journeys = PERSONAS.map((p) => {
  const a = runPersona(p)
  const b = runPersona(p)
  const det =
    JSON.stringify(a.steps.map((s) => s.questionId)) === JSON.stringify(b.steps.map((s) => s.questionId)) &&
    JSON.stringify(a.result) === JSON.stringify(b.result)
  return { ...a, deterministic: det }
})

mkdirSync('docs/diagnostic-v2_1', { recursive: true })
writeFileSync('docs/diagnostic-v2_1/journeys.v2_1.json', JSON.stringify({ version: '2.1.0', journeys }, null, 2) + '\n', 'utf8')

console.log('الشخصية | أسئلة | النوع | المسار/القالب | الثقة | المخرج | حتمي')
for (const j of journeys) {
  console.log(
    `${j.persona} | ${j.questionsCount} | ${j.result.kind} | ${j.result.topPathwayId ?? j.result.compositeTemplateId ?? '—'} | ${(j.result.confidence * 100).toFixed(0)}٪ | ${j.result.outputKind_ar} | ${j.deterministic ? '✓' : '✗'}`,
  )
}
const allDet = journeys.every((j) => j.deterministic)
console.log(allDeterminismNote(allDet))
function allDeterminismNote(ok: boolean) {
  return ok ? '\n✅ كل الرحلات التسع حتمية عبر تشغيلين.' : '\n❌ رحلة غير حتمية — يمنع الدمج.'
}
if (!allDet) process.exit(1)
