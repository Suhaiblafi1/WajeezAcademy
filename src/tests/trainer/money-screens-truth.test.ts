/* ═══ «مستحقّاتي» و«دعوتي» تقولان الحقّ (٢٠ أكتوبر ٢٠٢٦) ═══

   ① من ليس له إلّا اتفاقٌ خاصٌّ بدورةٍ أو شعبة كان يقرأ «لم تحدّد الإدارة أتعابك» — وجدولُ شعبه يحسب بها،
      وكشوفُه تُولَّد بها. فالخاصّةُ تُعرض خارج فرع العامّ، ويُقال إنّه لا اتفاقَ عامّا.
   ② وإخفاقُ روابط الشعب كان يُقرأ «لا شعبة مفتوحة لك» — لمن له شعبٌ مفتوحة. فيُقال إنّها لم تُجلب.
   ③ و«صفحتك لا تفتح» يقول شرطَيها كلَيهما: اعتمادُ النشر، ودورةٌ منشورةٌ هذا الفصل.

   والفحصُ على الشيفرة بلا تعليقاتها. ورُئي ساقطا: أُعيدت الخاصّةُ داخل فرع العامّ فسقط ①، وأُعيد الإخفاقُ
   قائمةً فارغةً بلا راية فسقط ②. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('مستحقّاتي ودعوتي', () => {
  it('⚠️ ① الاتفاقات الخاصّة تعرض ولو بلا اتفاق عامّ', () => {
    const page = code('src/pages/trainer/Earnings.tsx')
    expect(page).toMatch(/\) : scoped\.length > 0 \? \(\s*<p[^>]*>\s*ليس لك اتفاق عامّ — أتعابك باتفاقات خاصّة بدورات أو شعب بعينها، وعليها تحسب كشوفها\./)
    /* والقائمةُ بعد الفروع كلّها — لا داخل فرع العامّ */
    const list = page.indexOf('{scoped.length > 0 && (')
    expect(list, 'لا قائمة للاتفاقات الخاصّة').toBeGreaterThan(page.indexOf('لم تحدّد الإدارة أتعابك بعد'))
  })

  it('⚠️ ② وإخفاق روابط الشعب يقال — لا «لا شعبة مفتوحة»', () => {
    const page = code('src/pages/trainer/Referral.tsx')
    expect(page).toMatch(/\.catch\(\(\) => \{ if \(alive\) \{ setCohortLinks\(\[\]\); setLinksDown\(true\); \} \}\);/)
    expect(page).toMatch(/\{linksDown \? \(\s*<p[^>]*>\s*تعذّر جلب روابط شعبك الآن\./)
  })

  it('③ وصفحته لا تفتح بشرطيها', () => {
    expect(code('src/pages/trainer/Referral.tsx')).toContain('تفتح حين تعتمد الإدارة نشر ملفّك وتكون لك دورة منشورة هذا الفصل')
  })
})
