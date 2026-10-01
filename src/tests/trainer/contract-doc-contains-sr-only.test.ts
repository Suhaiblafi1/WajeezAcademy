/* صفحةُ التوقيع لا تبيضّ بعد التوقيع — والوثيقةُ مرجعُ ما فيها.

   بلاغُ صاحب المنصّة (١ أكتوبر ٢٠٢٦): وقّع فبقيت الصفحةُ بيضاء ووصله بريدُ
   التوقيع. وقيس في متصفّحٍ حقيقيّ: في الوثيقة ٤٤ `sr-only` (`position:
   absolute`) بلا سلفٍ مموضَع، فتفلت من صندوق التمرير وتمدّ الصفحةَ إلى ١٦١٨٣
   بكسلا ومحتواها ١٩٧٨. فمن وقّع من أسفل النموذج بقي في الفراغ.

   ويُقاس على **البنية** بعد نزع التعليقات: صنفُ جذر الوثيقة نفسِه، ونداءُ
   رفع النافذة في الصفحة — لا ورودُ كلمةٍ في شرح. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const bare = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('الوثيقةُ تحوي ما فيها', () => {
  it('⚠️ جذرُ ContractDocument مموضَعٌ — فلا تفلت sr-only من صندوق التمرير', () => {
    const src = bare('src/components/ContractDocument.tsx')
    const cls = /<article\s+className="([^"]*)"/.exec(src)?.[1]
    expect(cls, 'لم يُقرأ جذرُ الوثيقة').toBeDefined()
    expect(cls!.split(/\s+/), 'جذرُ الوثيقة غيرُ مموضَع — تمتدّ الصفحةُ فراغا').toContain('relative')
  })
})

describe('وما بعد التوقيع يُرى أوّلا', () => {
  it('⚠️ تُرفَع النافذةُ إلى رأسها إذا خرجت الحالُ من open', () => {
    const src = bare('src/pages/ContractSign.tsx')
    expect(src, 'لا رفعَ للنافذة بعد التوقيع').toMatch(/wasOpen\.current\)\s*\{[^}]*window\.scrollTo\(\{\s*top:\s*0\s*\}\)/)
  })
})
