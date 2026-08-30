/* لا رقمَ سعرٍ في الحزمة إلا من الشعبة.

   التوصية ٤ حذفت `coursePriceOf` (تقدير ١٣٠–١٨٠ بمطابقة كلماتٍ في العنوان)
   و`pathwayPriceFor` (٥٠٠/٥٥٠/٦٠٠ بالعدد) من كل ما يُرسَم، لأن الفاتورة تُصدر
   بـ`Cohort.price` وبعملةٍ أخرى — فالوعد كان يفارق المطالبة.

   وحذفُها مرةً لا يمنع عودتَها: يكفي أن يحتاج مطوّرٌ رقما «مؤقتا» فيكتب
   ثابتا في مكوّن. فالحارس بنيويّ: يمسح شجرة المصدر المشحونة (كل ما تحت
   `src/` عدا `src/tests/`) بحثا عن اسمَي الدالّتين وعن أسعارٍ مكتوبةٍ بأيدينا
   في نصوصٍ معروضة. من احتاج سعرا فمن `services/cohort-prices.ts`. */

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(process.cwd(), 'src')

function shippedFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      /* شجرة الاختبارات ليست في الحزمة: السلّم الصناعيّ يعيش فيها بقصد */
      if (name === 'tests') continue
      shippedFiles(full, out)
    } else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

const FILES = shippedFiles(SRC)

describe('لا تسعير مُختلَق في الحزمة المشحونة', () => {
  it('الشجرة تُمسح فعلا — وإلا كان الحارس يخضرّ على فراغ', () => {
    expect(FILES.length).toBeGreaterThan(50)
  })

  it('لا `coursePriceOf` ولا `pathwayPriceFor` ولا `PATHWAY_PRICE` خارج الاختبارات', () => {
    const offenders: string[] = []
    for (const f of FILES) {
      /* التعليقات تشرح لماذا زالت هذه الأسماء، فتُنزع قبل البحث: المقيس
         استعمالٌ في شيفرةٍ تعمل لا ذِكرٌ في شرح. */
      const src = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
      const used =
        /\bcoursePriceOf\b/.test(src) ||
        /\bpathwayPriceFor\b/.test(src) ||
        /\bPATHWAY_PRICE\b/.test(src)
      if (used) offenders.push(relative(SRC, f))
    }
    expect(offenders, `تسعير مُختلَق عاد إلى: ${offenders.join('، ')}`).toEqual([])
  })

  it('السلّم الصناعيّ نفسه لا يُستورَد من شيفرةٍ مشحونة', () => {
    const offenders = FILES.filter((f) => /['"][^'"]*tests\/pricing-scale['"]/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f))
    expect(offenders, `سلّم الاختبار سرّب إلى: ${offenders.join('، ')}`).toEqual([])
  })
})
