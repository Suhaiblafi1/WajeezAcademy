/* التسجيلُ بعد الاعتماد، والالتحاقُ حتّى الموعد الثاني — ما تقوله الشاشات (٣ج).

   القاعدةُ في الخادم (`registration-window.ts`) ويحرسها في المواضع الستّة
   `server/tests/commerce/registration-window.test.ts`، وكتابةُ آخرِ الالتحاق عند
   الاعتماد في `axis-plan.test.ts` (⑦). وهنا أنّ الشاشات تقول ما يحكم به الخادم:
   تاريخُ المدرّب من القاعدة نفسِها، والمعتمِدُ يُقال له إنّ العلمَ لا يفتح قبل
   الاعتماد، ولوحُ الشراء يسمّي السببين الجديدين. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { adminRegistrationLine, lineText, trainerRegistrationLine } from '@/application/learning/registration-state'
import { whenAr } from '@/application/learning/cohort-gate'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const WORKSPACE = code('src/pages/trainer/CohortWorkspace.tsx')
/* ومراجعةُ الخطّة خرجت من بطاقة الشعبة إلى مكوّنٍ تعرضه البطاقةُ و«خططٌ تنتظر اعتمادك»
   معا (٣ أكتوبر ٢٠٢٦) — فالحارسُ يقرؤها حيث صارت، وعرضُ البابين لها في
   `src/tests/admin/pending-plans.test.ts`. */
const PLAN_REVIEW = code('src/components/admin/TrainerPlanReview.tsx')
const BUY_PANEL = code('src/components/BuyPanel.tsx')

/* ═══ والجملتان خرجتا إلى قاعدةٍ واحدة (٣ أكتوبر ٢٠٢٦) ═══
   سار صاحبُ المنصّة في المسار فوجد الشاشتين تقولان «تُفتح حين تُعتمَد» و«مفتوحٌ
   حتّى…» عن شعبة إعدادٍ علمُها منزولٌ لا يرفعه الاعتماد. فصارت الجملةُ من حال
   الشعبة كلِّها — علمِها وخطّتِها والتحاقِها — في `registration-state.ts`، يقرؤها
   البابان. والحارسان هنا يحرسان ما كانا يحرسانه حيث صار: تاريخُ المدرّب من قاعدة
   الاعتماد نفسِها ومكتوبٌ بتوقيت عمّان، وعلمٌ مرفوعٌ على خطّةٍ لم تُعتمَد لا يُقرأ
   «مفتوحا». وما زاد (العلمُ المنزول) في `last-mile-screens.test.ts`. */
describe('المدرّبُ يعرف متى يدخلها متعلّموه', () => {
  it('⚠️ آخرُ الالتحاق بالقاعدة التي يكتبه بها الاعتماد — لا بحسابٍ ثانٍ', () => {
    expect(WORKSPACE).toMatch(/joinClosesAt: joinClosesAt\(planPeriod, content\.slots\),/)
    const closes = new Date('2026-11-10T13:00:00Z')
    const line = trainerRegistrationLine({ registrationOpen: true, awaitingPlan: true, joinClosesAt: closes }, new Date('2026-11-01T00:00:00Z'))
    expect(line.lead).toContain('ويُقبل الملتحقون حتّى بدء موعدها الثاني')
    expect(line.date).toBe(whenAr(closes))
  })
})

describe('والمعتمِدُ يُقال له ما يحكم به الخادم', () => {
  it('⚠️ علمٌ مرفوعٌ على خطّةٍ لم تُعتمَد لا يُقرأ «مفتوحا»', () => {
    expect(PLAN_REVIEW).toMatch(/adminRegistrationLine\(\{ \.\.\.r, registrationOpen: r\.registrationOpen \?\? true \}, new Date\(\)\)/)
    const raised = lineText(adminRegistrationLine(
      { registrationOpen: true, awaitingPlan: true, joinClosesAt: new Date('2026-12-01T00:00:00Z') }, new Date('2026-11-01T00:00:00Z'),
    )!)
    expect(raised).toContain('يُفتح باعتمادك')
    expect(raised).not.toContain('مفتوح')
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
