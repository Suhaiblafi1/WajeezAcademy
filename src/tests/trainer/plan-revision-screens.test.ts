/* ما تغيّر عن المعتمَد — ما تقوله الشاشتان (٣ج-٤).

   القاعدةُ محضةٌ في `plan-diff.test.ts`، وأنّ الخادمَ يعيد المعتمَدةَ مع المراجعة
   وحدَها في `server/tests/trainer/plan-revision-diff.test.ts`. وهنا أنّ الشاشتين
   تقرآن السطورَ من القاعدة نفسِها: المعتمِدُ على المرسَلة، والمدرّبُ على ما في يده. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlanDiffList } from '@/components/PlanDiff'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const WORKSPACE = code('src/pages/trainer/CohortWorkspace.tsx')
/* ومراجعةُ الخطّة خرجت من بطاقة الشعبة إلى مكوّنٍ تعرضه البطاقةُ و«خططٌ تنتظر اعتمادك»
   معا (٣ أكتوبر ٢٠٢٦) — فالحارسُ يقرؤها حيث صارت، وعرضُ البابين لها في
   `src/tests/admin/pending-plans.test.ts`. */
const PLAN_REVIEW = code('src/components/admin/TrainerPlanReview.tsx')

describe('السطورُ بخطوات المدرّب', () => {
  it('⚠️ كلُّ خطوةٍ باسمها وسطورِها — والفارغُ يُقال لا يُترك بياضا', () => {
    const html = renderToStaticMarkup(createElement(PlanDiffList, {
      sections: [{ section: 'workbooks', label: 'الكرّاسات', lines: ['تغيّرت كرّاسةُ الموعد 2'] }],
      emptyText: 'لا تغيير',
    }))
    expect(html).toMatch(/<dt[^>]*>الكرّاسات<\/dt><dd[^>]*><ul[^>]*><li[^>]*>تغيّرت كرّاسةُ الموعد 2<\/li>/)
    expect(renderToStaticMarkup(createElement(PlanDiffList, { sections: [], emptyText: 'لا تغيير' }))).toContain('لا تغيير')
  })
})

describe('المعتمِدُ يقرأ ما تغيّر قبل أن يعتمد', () => {
  it('⚠️ على المرسَلة وحدَها، وبالقاعدة بين المعتمَدة والمرسَلة', () => {
    expect(PLAN_REVIEW).toMatch(/\{trainerPlan\.status === "submitted" && trainerPlan\.approvedPlan && \(/)
    expect(PLAN_REVIEW).toMatch(/sections=\{planDiff\(trainerPlan\.approvedPlan\.content, trainerPlan\.content, \{ date: fmtDateAr \}\)\}/)
  })
})

describe('والمدرّبُ يقرؤه قبل أن يرسل', () => {
  it('⚠️ على ما في يده — لا على آخر ما حُفظ', () => {
    expect(WORKSPACE).toMatch(/\{ws\.approvedPlan && \(/)
    expect(WORKSPACE).toMatch(/sections=\{planDiff\(ws\.approvedPlan\.content, content, \{ date: fmtDateAr \}\)\}/)
  })
})
