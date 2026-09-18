/* قائمتا المزايا: فرقُ الشراءَين، وما هو مجّانيٌّ للجميع.

   ═══ ما يحرسه هذا الملفّ ═══

   قائمةُ `PATHWAY_ONLY_PERKS` غرضُها مكتوبٌ في مصدرها: «لا تُعطى لمن يشتري
   دورة مفردة — فهي فرقُ الشراءَين». فبندٌ مجّانيٌّ للجميع فيها **يُفقد
   القارئَ سببَ الشراء بدل أن يكسبه**.

   وقرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦): الملخّصاتُ مجّانا للجميع **لفترةٍ
   محدودة**. والفترةُ المحدودةُ تنتهي — فالحارسُ ليس على «أين البند اليوم»
   بل على أنّ القائمتَين **تُشتقّان من رايةٍ واحدة**، فيعود البندُ إلى موضعه
   بإطفائها بلا أن يتذكّر أحد. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FREE_FOR_ALL_NOW, PATHWAY_ONLY_PERKS } from '@/data/pathway-perks'
import { wajeezSkillsStats } from '@/data/trustMetrics'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const source = readFileSync(join(root, 'src/data/pathway-perks.ts'), 'utf8')

/* بلا تعليقات: الحارسُ على ما يُصيَّر، وذِكرُ الاسم في شرحٍ ليس عرضا له. */
const rendered = (file: string) =>
  readFileSync(join(root, file), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

describe('قائمتا المزايا لا تتداخلان', () => {
  it('⚠️ ولا بندَ في الاثنتين — فرقُ الشراءَين لا يكون مجّانا للجميع', () => {
    const paid = new Set(PATHWAY_ONLY_PERKS.map((p) => p.t))
    const both = FREE_FOR_ALL_NOW.filter((p) => paid.has(p.t)).map((p) => p.t)
    expect(both, `بندٌ يُوعَد به مقابل الشراء وهو مجّانيٌّ للجميع: ${both.join('، ')}`).toEqual([])
  })

  it('وكلتاهما غيرُ فارغة — فحارسٌ على قائمتَين خاويتَين لا يحرس شيئا', () => {
    expect(PATHWAY_ONLY_PERKS.length).toBeGreaterThan(0)
    expect(FREE_FOR_ALL_NOW.length).toBeGreaterThan(0)
  })

  it('⚠️ والقائمتان مشتقّتان من رايةٍ واحدة — تُطفأ فيعود البندُ بلا كتابة', () => {
    /* لو كُتبت القائمتان بأيديهما لوجب حذفُ البند من إحداهما وإضافتُه إلى
       الأخرى حين تنتهي الفترة — ولا شيءَ يذكّر بذلك بعد شهرَين. */
    expect(source, 'قائمةُ المسار لا تُشتقّ بالترشيح').toMatch(/PATHWAY_ONLY_PERKS[^=]*=\s*PATHWAY_PERKS\.filter/)
    expect(source, 'قائمةُ المجّانيّ لا تُشتقّ بالترشيح').toMatch(/PATHWAY_PERKS\.filter\(\(p\) => p\.freeForAllNow\)/)
  })

  it('كلُّ مجّانيٍّ له وجهةٌ أو شرحٌ — ولا بندَ يُنقر فلا يقع شيء', () => {
    for (const p of FREE_FOR_ALL_NOW) {
      expect(Boolean(p.href || p.explain), `«${p.t}» بلا وجهةٍ ولا شرح`).toBe(true)
    }
  })

  it('⚠️ ولا رابطَ خارجيٍّ يُخترع — سياسةُ التأليف تنهى عنه', () => {
    /* «ولا يُخترع عنوانُ كتابٍ ولا رابط. ما لا نتحقّق من وجوده لا يُذكر.»
       وجسرُ المكتبة إلى «وجيز مهارات» غيرُ مربوطٍ بعد، فلا وجهةَ خارجيّة. */
    for (const p of FREE_FOR_ALL_NOW) {
      if (!p.href) continue
      expect(p.href.startsWith('/'), `«${p.t}» يشير إلى خارج المنصّة: ${p.href}`).toBe(true)
    }
    expect(source, 'رابطٌ خارجيٌّ في مصدر المزايا').not.toMatch(/href:\s*['"`]https?:/)
  })

  it('ورقمُ الملخّصات يُقرأ من مصدره الموثَّق لا مكتوبا باليد', () => {
    const doc = wajeezSkillsStats.find((m) => m.key === 'book_summaries')
    expect(doc?.approved_for_display, 'الرقمُ غيرُ معتمدٍ للعرض').toBe(true)
    expect(source, 'الرقمُ مكتوبٌ باليد بدل قراءته').toMatch(/wajeezSkillsStats\.find/)
    const summaries = FREE_FOR_ALL_NOW.find((p) => p.explain)?.explain?.paras.join(' ') ?? ''
    expect(summaries, 'الرقمُ لا يظهر في الشرح').toContain(doc!.display_value)
  })
})

/* ═══ وأين يُعرض المجّانيُّ — شاشةٌ واحدةٌ لا شاشتان ═══

   قرارُ صاحب المنصّة (١٨ سبتمبر ٢٠٢٦): «لا داعي لوجود هذه الخانة بعد أن
   ينقر على دفع… لا أريد أن أشتّته لكي يقوم بإتمام الدفع كاملا، وهي موجودةٌ
   في الصفحة التي قبلها». فما بعد نقرة الشراء غرضُه إتمامُه.

   والكتلةُ بابٌ يُنقر فيُغادِر — فتكرارُها على اللوح ليس زخرفا زائدا بل
   مخرجٌ من الدفع في وسطه. والفحصُ على التصيير لا على ورود الاسم: اسمٌ في
   تعليقٍ لا يعرض شيئا، فالتعليقاتُ تُنزع قبل النظر. */
describe('وموضعُ المجّانيّ شاشةٌ واحدة', () => {
  it('صفحةُ المسار تعرضه — وإلّا فالحارسُ يحرس عدما', () => {
    expect(rendered('src/pages/Pathway.tsx'), 'صفحةُ المسار لا تعرضه').toMatch(/<FreeNowPerks\b/)
  })

  it('⚠️ ولوحُ الشراء لا يعرضه — لا بابَ مجّانيّا بعد نقرة الدفع', () => {
    const buy = rendered('src/components/BuyPanel.tsx')
    expect(buy, 'لوحُ الشراء يعرض المجّانيّ ثانيةً').not.toMatch(/<FreeNowPerks\b/)
    expect(buy, 'لوحُ الشراء ما زال يستورد الكتلة').not.toMatch(/from\s+['"]@\/components\/FreeNowPerks['"]/)
  })

  it('ويبقى فيه فرقُ الشراءَين وحدَه — تأكيدُ ما يشتريه لا صرفٌ عنه', () => {
    expect(rendered('src/components/BuyPanel.tsx'), 'اللوحُ لا يعرض فرقَ الشراءَين').toMatch(/PATHWAY_ONLY_PERKS\.map/)
  })
})
