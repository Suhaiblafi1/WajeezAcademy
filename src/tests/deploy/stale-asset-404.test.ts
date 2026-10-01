/* الأصلُ الزائلُ يُجاب ٤٠٤ — لا بالصفحة الرئيسة.

   بلاغُ صاحب المنصّة (١ أكتوبر ٢٠٢٦): وقّع عقدا من صفحةٍ فُتحت قبل نشرٍ وقع في
   الدقيقة نفسِها، فبقيت الصفحةُ بيضاء ووصله بريدُ التوقيع. وعلّتُه أنّ
   `try_files … /index.html` كان يعمّ `/assets/` كذلك: قطعةٌ حذفها النشرُ تُجاب
   ٢٠٠ و`text/html`، فلا يراها حارسُ القطع الزائلة (المبنيُّ على ٤٠٤)، ويرمي
   سفاري خطأَ نوعٍ يرفع الشجرةَ كلَّها.

   ويُقاس على **بنية** الملفّ لا على ورود كلمة: كتلةُ `/assets/*` قائمةٌ وفيها
   `file_server` بلا `try_files`، وتسبق كتلةَ السقوط. وقد جُرّب الملفُّ على
   Caddy حقيقيٍّ قبل كتابة هذا: الأصلُ المفقودُ ٤٠٤، والموجودُ ٢٠٠، والصفحاتُ كما كانت.
   وصيغةُ `try_files @matcher …` جُرّبت قبلها فلم تعمل — يقرأ Caddy الاسمَ ملفّا. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
/** الملفُّ بلا تعليقاته — فلا يُخضِر الفحصَ سطرٌ في شرح */
const CADDY = readFileSync(join(root, 'deploy/Caddyfile'), 'utf8')
  .split('\n').map((l) => l.replace(/#.*$/, '')).join('\n')

/** جسمُ الكتلة التي تبدأ عند `at` — بعدّ الأقواس */
function blockAt(src: string, at: number): string {
  const open = src.indexOf('{', at)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) return src.slice(open + 1, i)
  }
  return ''
}

describe('الأصولُ لا تسقط على index.html', () => {
  const at = CADDY.search(/^\s*handle \/assets\/\*\s*\{/m)
  const assets = at < 0 ? '' : blockAt(CADDY, at)

  it('⚠️ لـ/assets/ كتلتُها، تخدم الملفَّ وحدَه بلا سقوط', () => {
    expect(at, 'لا كتلةَ لـ/assets/* — فالقطعةُ الزائلةُ تُجاب بالصفحة الرئيسة').toBeGreaterThan(-1)
    expect(assets).toMatch(/\bfile_server\b/)
    expect(assets, 'في كتلة الأصول سقوطٌ على صفحة').not.toMatch(/\btry_files\b|index\.html/)
  })

  it('⚠️ وتسبق كتلةَ السقوط — وإلّا ابتلعها', () => {
    const fallback = CADDY.search(/^\s*try_files\b.*\/index\.html/m)
    expect(fallback, 'لا سقوطَ على index.html أصلا').toBeGreaterThan(-1)
    expect(at, 'كتلةُ الأصول بعد السقوط').toBeLessThan(fallback)
  })
})
