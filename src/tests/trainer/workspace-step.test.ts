/* رابطٌ إلى خطوةٍ بعينها في خطّة الشعبة (٧ أكتوبر ٢٠٢٦).

   المحضُ في `workspace-step.ts`؛ وأنّ الصفحةَ تقرؤه في أوّل فتحٍ لها بالقفل نفسِه
   الذي يقفل شريطَها يُقرأ من بنيتها أدناه. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { firstStep, readWorkspaceStep, workspaceStepPath, WORKSPACE_STEPS } from '@/application/trainer/workspace-step'
import { STAGE_LABELS } from '@/application/trainer/review-notes'

describe('خطوةُ الرابط', () => {
  it('تُقرأ خطوةً من الستّ — وما عداها لا شيء', () => {
    expect(readWorkspaceStep('workbooks')).toBe('workbooks')
    expect(readWorkspaceStep('approval')).toBe('approval')
    expect(readWorkspaceStep('resources')).toBeNull()
    expect(readWorkspaceStep('')).toBeNull()
    expect(readWorkspaceStep(null)).toBeNull()
  })

  it('ومفاتيحُها مفاتيحُ أقسام ملاحظات المعتمِد — فالرابطُ والملاحظةُ يسمّيان الشيءَ نفسَه', () => {
    for (const k of Object.keys(STAGE_LABELS)) expect(WORKSPACE_STEPS).toContain(k)
  })

  it('المسارُ يحمل الشعبةَ والخطوة', () => {
    expect(workspaceStepPath('c-1', 'sessions')).toBe('/trainer/cohort/c-1?step=sessions')
  })

  it('يُفتح على خطوته إن كانت تُفتح له، وإلّا على ما كانت الصفحةُ تُفتح عليه', () => {
    const onlyFirstTwo = (s: string) => s === 'identity' || s === 'modules'
    expect(firstStep('modules', 'identity', onlyFirstTwo)).toBe('modules')
    expect(firstStep('workbooks', 'modules', onlyFirstTwo)).toBe('modules')
    expect(firstStep(null, 'modules', () => true)).toBe('modules')
  })
})

describe('والصفحةُ تقرؤه في أوّل فتح', () => {
  /* التعليقاتُ لا تُحتسب — الفحصُ على الشيفرة */
  const src = readFileSync(join(process.cwd(), 'src/pages/trainer/CohortWorkspace.tsx'), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*(\/\/|--).*$/gm, '')

  it('خطوةُ الرابط تُقرأ من عنوان الصفحة وتُمرَّر إلى أوّل خطوة', () => {
    expect(src).toMatch(/readWorkspaceStep\(\s*params\.get\(STEP_PARAM\)\s*\)/)
    expect(src).toMatch(/setStage\(\s*firstStep\(/)
  })

  it('وقفلُها قفلُ الشريط: لا تُفتح خطوةٌ لم يتمّ ما قبلها في خطّةٍ في يد المدرّب', () => {
    const body = src.slice(src.indexOf('setStage(firstStep('))
    const call = body.slice(0, body.indexOf(');') + 2)
    expect(call).toContain('openableAt')
    expect(src).toMatch(/const openableAt = [\s\S]{0,400}STAGES\.slice\(0, i\)\.every/)
  })
})
