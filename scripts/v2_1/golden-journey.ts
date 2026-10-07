/* رحلةُ Golden Suite — جلسةٌ حتميّةٌ بإجاباتٍ نصّيّة، مشتركةٌ بين السكربت والاختبار.

   فُصلت من `golden-suite.ts` (٧ أكتوبر ٢٠٢٦) حين أسقط تغييرُ ساعات الدورات
   قالبا (TPL-SUPPLY-001) من الفضاء ولم يحمرّ شيء: السكربتُ يُشغَّل يدويّا لا في
   CI. فصار `src/tests/diagnostic/golden-replay.test.ts` يعيد رحلةَ كلّ كيانٍ
   الفائزةَ المحفوظةَ — ويحتاج المشغّلَ نفسَه حرفا، لا نسخةً منه تفترق. */

import { createEngineV21, type RecommendationV21 } from '../../src/domain/diagnostic/v2_1'
import { Q, type CareerStage } from '../../src/domain/diagnostic/v2_1/maps'
import type { CompetitionResult } from '../../src/domain/diagnostic/v2_1/compete'

/* ─── جلسة حتمية بإجابات نصية ─── */
export interface Journey {
  stage: CareerStage
  employment?: string
  goal?: string
  need?: string
  mastery?: string
  interest?: string
  answers?: Record<string, string>
  skillLevel?: number
}

export const STAGE_LABEL: Record<CareerStage, string> = {
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
export const MASTERY_UNSURE = 'غير متأكد'

export interface RunOutcome {
  asked: string[]
  rec: RecommendationV21
  comp: CompetitionResult
  trace?: { kind: string; summary_ar: string }[]
  /** حقائق الجلسة — للتفكيك */
  facts: Record<string, unknown>
}

export function runJourney(name: string, script: Journey): RunOutcome {
  const engine = createEngineV21(`golden-${name}`)
  const asked: string[] = []
  for (let i = 0; i < 20; i++) {
    const step = engine.nextQuestion()
    if (step.stop.shouldStop || !step.question) break
    const q = step.question
    asked.push(q.question_id)
    /* المطابقةُ الحرفيّةُ وحدَها كانت تكذب صامتةً.

       `answers['QB-M3B-001'] = 'حكومي'` مكتوبٌ في البحث منذ البداية ليفتح
       المسارات الحكوميّة، ونصُّ الخيار «حكومي — جهة حكومية أو قطاع عام».
       فـ`indexOf` يردّ ‎-1، ويسقط السطرُ إلى `idx = 0` — أي **«خاص»**. فبقي
       `PW-GOV-002` يُعدُّ «غيرَ قابلٍ للفوز» وهو قابلٌ له، والسببُ في أداة
       القياس لا في المنتَج.

       فصارت المطابقةُ: حرفيّةً، ثمّ ببادئةٍ، ثمّ **تصرخ**. والصمتُ هو ما
       أطال عمرَ العطب — لا الخطأُ نفسُه. */
    const byLabel = (l?: string): number => {
      if (!l) return -1
      const exact = q.options_ar.indexOf(l)
      if (exact >= 0) return exact
      const prefix = q.options_ar.findIndex((o) => o.startsWith(l) || l.startsWith(o))
      return prefix
    }
    let idx = -1
    const explicit = script.answers?.[q.question_id]
    if (explicit !== undefined) {
      idx = byLabel(explicit)
      if (idx < 0) {
        throw new Error(
          `جوابٌ صريحٌ لا يطابق خيارا في ${q.question_id}: «${explicit}»\n`
          + `  الخيارات: ${q.options_ar.map((o) => `«${o}»`).join(' · ')}`,
        )
      }
    }
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
  const all = engine.getState().facts
  const facts = Object.fromEntries(
    ['career_stage', 'primary_goal', 'goal_code_v21', 'need_id', 'interest_domains', 'function_specialization', 'weekly_load', 'mastery_portfolio_pref', 'sector']
      .filter((k) => all[k] !== undefined)
      .map((k) => [k, all[k].value]),
  )
  return { asked, facts, rec: engine.recommend(), comp: engine.competeSnapshot(), trace: engine.getState().trace.map((t) => ({ kind: t.kind, summary_ar: t.summary_ar })) }
}

/** الفائز الفعلي — يُقرأ الكيان المرفق حتى لو وُسم التوصية بمراجعة مستشار */
export function winnerOf(rec: RecommendationV21): string | null {
  if (rec.composite) return rec.composite.templateId
  if (rec.primaryPathway) return rec.primaryPathway.pathwayId
  return null
}

