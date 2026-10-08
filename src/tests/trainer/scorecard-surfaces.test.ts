/* بطاقةُ المعايير على وجهيها (٨ أكتوبر ٢٠٢٦) — الحسابُ واحد، والقرارُ للمعتمِد.

   ① بطاقةُ المراجعة وفحصُ المدرّب يقرآن `planScorecard` على بيانات الخطّة نفسِها،
      فلا يرى المعتمِدُ غيرَ ما رآه المدرّب.
   ② و«لا إجبارَ على فعل»: المطلوبُ الساقطُ يمنع المدرّبَ من الإرسال ولا يُطفئ على
      المعتمِد زرَّ الاعتماد — يُقال الخياران وما يقع بكلٍّ، ويختار.

   والفحصُ على الشيفرة بلا تعليقاتها: حارسٌ طابق جملةً في تعليقٍ مرّ أخضرَ لسببٍ خاطئ. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('بطاقةُ المراجعة عند المعتمِد', () => {
  const src = code('src/components/admin/TrainerPlanReview.tsx')

  it('تحسب البطاقةَ من الخطّة نفسِها وترسمها', () => {
    expect(src).toMatch(/planScorecard\(\{\s*period: trainerPlan\.period, content: trainerPlan\.content, sessions: trainerPlan\.sessions, assessments: trainerPlan\.assessments\s*\}\)/)
    expect(src).toMatch(/<PlanScorecard\s+items=\{scorecard\}/)
  })

  it('⚠️ وزرُّ الاعتماد لا يُطفئه مطلوبٌ ساقط — يُقال الخياران', () => {
    const approve = src.slice(src.lastIndexOf('<Button', src.indexOf('approvalBody(approveNote)')), src.indexOf('approvalBody(approveNote)'))
    expect(approve).toContain('disabled={busy}')
    expect(approve).not.toMatch(/disabled=\{[^}]*blocked/)
    expect(src).toContain('اطلب تعديلات بما في البطاقة')
    expect(src).toContain('اعتمدها كما هي')
  })

  it('وصندوقُ الردّ يُملأ ممّا سقط بنقرة — ويبقى يُعدَّل قبل الإرسال', () => {
    expect(src).toMatch(/setAskFrom\(scorecardNotes\(scorecard\)\)/)
    expect(src).toMatch(/<ReviewNotesForm[\s\S]{0,120}initial=\{askFrom\}/)
    expect(code('src/components/ReviewNotes.tsx')).toMatch(/useState<ReviewNotes>\(initial \?\? \{\}\)/)
  })
})

describe('فحصُ المدرّب قبل الإرسال', () => {
  const src = code('src/pages/trainer/CohortWorkspace.tsx')

  it('البطاقةُ نفسُها على ما حُفظ — وكلُّ خطوةٍ تُفتح منها', () => {
    expect(src).toMatch(/planScorecard\(\{\s*period: ws\.cohort\.period, content: ws\.plan\?\.content \?\? null, sessions: ws\.sessions, assessments: ws\.assessments,?\s*\}\)/)
    expect(src).toMatch(/<PlanScorecard[\s\S]{0,400}onStep=\{\(step\) => void openStage\(step as Stage\)\}/)
  })
})

describe('وحاجزُ الإرسال في الخادم يقرأ المُلزِمَ بالدوالّ نفسِها', () => {
  const svc = code('server/services/cohort-plan.service.ts')
  const body = svc.slice(svc.indexOf('export function buildChecklist('), svc.indexOf('\n}\n', svc.indexOf('export function buildChecklist(')))

  it('الأربعةُ داخلَ القائمة لا بجانبها', () => {
    for (const fn of ['seasonEndProblem(', 'practiceGaps(', 'sourceGaps(', 'projectDeadlineProblem(']) expect(body).toContain(fn)
    expect(body).toMatch(/done: identityDone && endProblem === null/)
    expect(body).toMatch(/done: resourcesDone && noSource\.length === 0/)
  })

  it('⚠️ والإرسالُ يمرّر مواعيدَ المهامّ — وإلّا لم يُحكم على موعد المشروع', () => {
    const submit = svc.slice(svc.indexOf('async submit('), svc.indexOf('stages_incomplete'))
    expect(submit).toMatch(/select: \{ moduleId: true, type: true, dueAt: true \}/)
    expect(submit).toMatch(/assessmentDues: gateCohort\.assessments\.map\(\(a\) => a\.dueAt\)/)
  })
})
