/* التسجيلُ بعد الاعتماد، والالتحاقُ حتّى الموعد الثاني — ما تقوله الشاشات (٣ج).

   القاعدةُ في الخادم (`registration-window.ts`) ويحرسها في المواضع الستّة
   `server/tests/commerce/registration-window.test.ts`، وكتابةُ آخرِ الالتحاق عند
   الاعتماد في `axis-plan.test.ts` (⑦). وهنا أنّ الشاشات تقول ما يحكم به الخادم:
   تاريخُ المدرّب من القاعدة نفسِها، والمعتمِدُ يُقال له إنّ العلمَ لا يفتح قبل
   الاعتماد، ولوحُ الشراء يسمّي السببين الجديدين. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const WORKSPACE = code('src/pages/trainer/CohortWorkspace.tsx')
const COHORT_OPS = code('src/pages/admin/CohortOps.tsx')
const BUY_PANEL = code('src/components/BuyPanel.tsx')

describe('المدرّبُ يعرف متى يدخلها متعلّموه', () => {
  it('⚠️ آخرُ الالتحاق بالقاعدة التي يكتبه بها الاعتماد — لا بحسابٍ ثانٍ', () => {
    expect(WORKSPACE).toMatch(/const closes = joinClosesAt\(planPeriod, content\.slots\);/)
    expect(WORKSPACE).toMatch(/\{closes && <>، ويُقبل الملتحقون حتّى بدء موعدها الثاني — <b className="text-foreground">\{whenAr\(closes\)\}<\/b><\/>\}/)
  })
})

describe('والمعتمِدُ يُقال له ما يحكم به الخادم', () => {
  it('⚠️ علمٌ مرفوعٌ على خطّةٍ لم تُعتمَد لا يُقرأ «مفتوحا»', () => {
    expect(COHORT_OPS).toMatch(/\{trainerPlan\.registration\?\.awaitingPlan \? \(/)
    expect(COHORT_OPS).toMatch(/\) : trainerPlan\.registration\?\.joinClosesAt \? \(/)
  })
})

describe('ولوحُ الشراء يسمّي السببين', () => {
  /* الشارةُ قصيرةٌ من هنا والنصُّ الكاملُ من الخادم تحتها — وسببٌ بلا شارةٍ يُقرأ
     «غير متاحة الآن» فلا يعرف المشتري أَيَنتظر أم يبحث عن غيرها */
  it('⚠️ «بانتظار الاعتماد» و«أُغلق الالتحاق» شارتان بأسمائهما', () => {
    const map = BUY_PANEL.slice(BUY_PANEL.indexOf('const REASON_AR'), BUY_PANEL.indexOf('};', BUY_PANEL.indexOf('const REASON_AR')))
    expect(map).toMatch(/\n {2}awaiting_plan: "[^"]+",/)
    expect(map).toMatch(/\n {2}late_closed: "[^"]+",/)
    expect(map).toMatch(/\n {2}not_yet: "[^"]+",/)
  })
})
