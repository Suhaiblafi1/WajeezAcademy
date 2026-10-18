/* «أبلغني» لكلّ دورة، و«من ينتظر دورة بلا شعبة» — ما تقوله الشاشات (١٢ أكتوبر ٢٠٢٦).

   الحسابُ والإرسالُ في الخادم (`server/tests/commerce/course-interest.test.ts`). وهنا ما لو
   انكسر لم يحمرّ خادم: أنّ الحقلَ يظهر **حيث لا شعبة** لا تحت كلّ دورة، وأنّه يُرسل الدورةَ
   بعينها، وأنّ التقريرَ معروضٌ في شاشة الشعب. والفحصُ على البنية لا على ورود جملة. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PAGE = code('src/pages/CoursePath.tsx')
const FORM = code('src/components/CourseInterestForm.tsx')
const COHORTS = code('src/pages/admin/AdminCohorts.tsx')
const DEMAND = code('src/pages/admin/CourseDemand.tsx')

describe('«أبلغني» حيث لا شعبة', () => {
  it('⚠️ يظهر تحت الدورة التي لا شعبةَ لها وحدَها — بعد أن تُقرأ الشعب', () => {
    expect(PAGE).toMatch(/pricesLoaded && options\.length === 0 && \(\s*<CourseInterestForm courseId=\{c\.id\}/)
  })

  it('⚠️ ويُرسل البريدَ والدورةَ بعينها إلى بابها', () => {
    expect(FORM).toMatch(/apiPost<InterestResult>\("\/api\/public\/course-interest", \{ email: value, courseId \}\)/)
  })

  it('ونصوصُه بلا تشكيلٍ إعرابيّ — «اللغة البيضاء»', () => {
    for (const t of ['أبلغني حين تفتح شعبتها', 'اترك بريدك ونعلمك حين تفتح شعبة لهذه الدورة — رسالة واحدة، ولا شيء غيرها.']) {
      expect(FORM).toContain(t)
      expect(t).toBe(plainAr(t))
    }
  })
})

describe('«من ينتظر دورة بلا شعبة» في شاشة الشعب', () => {
  it('⚠️ معروضٌ في الشعب، ويقرأ تقريرَ الخادم', () => {
    expect(COHORTS).toMatch(/<CourseDemand \/>/)
    expect(DEMAND).toMatch(/apiGet<\{ rows: DemandRow\[\]; learners\?: DemandLearner\[\] \}>\("\/api\/admin\/course-demand"\)/)
  })

  it('وكلُّ حالٍ لها كلمتُها — والخطّةُ المنتظِرةُ رابطٌ إلى اعتمادها', () => {
    for (const s of ['no_trainer', 'trainer_preparing', 'plan_submitted', 'approved_draft']) {
      expect(DEMAND).toMatch(new RegExp(`${s}: \\{ label: "[^"]+"`))
    }
    expect(DEMAND).toMatch(/r\.state === "plan_submitted" \? \(\s*<Link to="\/admin\/pending-plans"/)
  })
})
