/* لوحُ الشراء: البنودُ تُطوى، والتحذيرُ لا يُطوى معها.

   ═══ لماذا حارسٌ لهذا ═══

   قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦) أن تُطوى قائمةُ الدورات ليصغر الصندوق.
   والطيُّ في ذاته لا خطرَ فيه: الأسماءُ رآها المشتري قبل أن يصل.

   **والخطرُ في بندٍ استُبعد.** الخادمُ «كلُّ شيءٍ أو لا شيء»، والبندُ الذي لا
   شعبةَ له يخرج من الطلب — فإن طُوي مع ما طُوي ظنّ المشتري أنّه اشتراه. وهو
   العطبُ نفسُه الذي كُتب له `withoutCohort` أسفلَ اللوح.

   ولا يُفحص بورود كلمةٍ: يُفحص أنّ الظهورَ **مشروطٌ بالاستبعاد** في الشيفرة. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = readFileSync(join(root, 'src/components/BuyPanel.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

describe('لوح الشراء · البنود تطوى ولا يطوى تحذير', () => {
  it('القائمة مطويّة في الأصل — وإلّا فلا معنى للتغيير', () => {
    expect(code, 'لا حالة طيّ أصلا').toMatch(/useState\(false\)/)
    expect(code, 'القائمة لا تخفى').toMatch(/hidden=\{!listShown\}/)
  })

  it('⚠️ والظهور مقسور حين يستبعد بند — لا يترك لنقرة المشتري', () => {
    /* الفحصُ على البنية: `listShown` تجمع اختيارَ المشتري **أو** الاستبعاد.
       فلو صارت `listOpen` وحدَها لطُوي التحذيرُ ولم يحمرّ شيء. */
    expect(code, 'الظهور لا يقسر عند الاستبعاد').toMatch(/listShown\s*=\s*listOpen\s*\|\|\s*hasExcluded/)
    expect(code, 'لا يحسب المستبعد من الشعبة المختارة').toMatch(/hasExcluded[\s\S]{0,200}excludedOf\.has/)
  })

  it('والزرّ يقول للقارئ أنّ فيها ما استبعد، ولا يطفأ', () => {
    expect(code, 'لا ينبّه على الاستبعاد في متن الزرّ').toContain('فيها ما استبعد')
    /* زرٌّ معطَّلٌ لا يقول لماذا — فيبقى يُنقر ويبقى مفتوحا */
    expect(code, 'زرّ الكشف يعطّل').not.toMatch(/aria-controls="buy-lines"[\s\S]{0,200}disabled/)
  })

  it('⚠️ والزرّ يرى زرّا: بإطار المعجم المميز، ويقول فعله «عرض» أو «إخفاء»', () => {
    /* قرارُ صاحب المنصّة (٢٦ أكتوبر ٢٠٢٦): «الدورات ومواعيدها لا تبدو أنّها زرٌّ للنقر.. اجعلها بإطارٍ مميّز» */
    const at = code.indexOf('aria-controls="buy-lines"')
    expect(at, 'زر الكشف لم يوجد').toBeGreaterThan(0)
    const toggle = code.slice(code.lastIndexOf('<button', at), code.indexOf('</button>', at))
    const cls = toggle.match(/className="([^"]*)"/)?.[1].split(/\s+/) ?? []
    expect(cls, 'زر الكشف بلا إطار مميز').toEqual(expect.arrayContaining(['btn-outline-brand', 'w-full']))
    expect(toggle, 'زر الكشف لا يقول فعله').toMatch(/\{listShown \? "إخفاء" : "عرض"\}/)
  })

  it('ويبقى معلنا لقارئ الشاشة — لا طيّ صامت', () => {
    expect(code).toMatch(/aria-expanded=\{listShown\}/)
    expect(code).toMatch(/aria-controls="buy-lines"/)
  })
})
