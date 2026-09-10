/* عنوانُ خطّاف الدفع في الوثائق هو المسجَّلُ في الشيفرة — لا عنوانٌ يُشبهه.

   ── العطبُ الذي وقع فعلا ──

   كان `deploy/README.md` يأمر بتسجيل `payments` قبل `webhook` في سترايب،
   ولا وجودَ لذلك المسار. والمسجَّلُ `‎/api/webhooks/payments/:provider`.

   ومن تبع الوثيقةَ سجّل عنوانا يردّ **٤٠٤**. وسترايب لا يشتكي إلى المشتري:
   يقبض المالَ، ويُعيد المحاولةَ في صمت، ثمّ يستسلم. **فلا تسويةَ ولا تسجيل،
   والمالُ مقبوض** — وهو بعينه ما كان عنوانُ ذلك القسم يحذّر منه:
   «سترايب — الخطوة التي تُفقد المال إن أُخطئت».

   ── ولماذا لا يُمسكه شيءٌ آخر ──

   لا اختبارَ يفتح وثيقةً، ولا بناءَ يقرأ ما فيها. والخطأُ لا يظهر إلّا يومَ
   يشتري أحدٌ شراءً حقيقيّا — بعد أن يكون العنوانُ قد سُجّل ونُسي.

   ── والفحصُ مشتقٌّ لا مكتوبٌ باليد ──

   المسارُ يُنتزع من `commerce.routes.ts` نفسِه. فمن غيّر المسارَ وحدّث
   الوثائقَ معه مرّ، ومن غيّر أحدَهما وحدَه سقط — وهو المقصود. */

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

/** الوثائقُ التي تُملي على القارئ عنوانا يسجّله عند مزوّد الدفع. */
const DOCS = ['deploy/README.md', 'docs/DEPLOYMENT.md', 'docs/CONNECT_AR.md']

/** المسارُ المسجَّلُ فعلا — يُقرأ من الشيفرة لا يُكتب هنا. */
function registeredWebhookPath(): string {
  const src = read('server/http/routes/commerce.routes.ts')
  const m = src.match(/app\.post\(\s*'([^']*webhook[^']*)'/i)
  expect(m, 'لا مسارَ خطّافٍ مسجَّلٌ في commerce.routes.ts — تغيّرت بنيتُها').toBeTruthy()
  return m![1]
}

describe('عنوانُ خطّاف الدفع — الوثيقةُ تطابق الشيفرة', () => {
  it('المسارُ مسجَّلٌ في الشيفرة ويُقرأ منها', () => {
    const path = registeredWebhookPath()
    expect(path.startsWith('/api/'), `مسارٌ غيرُ متوقَّع: ${path}`).toBe(true)
    expect(path, 'المسارُ بلا مُعامل مزوّدٍ — تغيّر التصميم').toMatch(/:\w+/)
  })

  it('وكلُّ عنوانِ خطّافٍ تكتبه الوثائقُ يبدأ بالمسار المسجَّل', () => {
    /* البادئةُ ما قبل مُعامل المزوّد: `‎/api/webhooks/payments/`.
       فيُقبل `‎…/stripe` و`‎…/moyasar` و`‎…/:provider` سواءً. */
    const prefix = registeredWebhookPath().replace(/:\w+.*$/, '')

    for (const doc of DOCS) {
      if (!existsSync(join(root, doc))) continue
      const text = read(doc)

      /* كلُّ ما يشبه مسارَ **دفعٍ** وخطّافٍ تحت `/api`. وللمنصّة خطّافاتٌ
         أخرى (Zoom وCalendly)، فلا يجوز لحارس سترايب أن يطالبها بمساره. */
      const mentioned = [...text.matchAll(/\/api\/[A-Za-z0-9/_:.-]*webhook[A-Za-z0-9/_:.-]*/gi)]
        .map((m) => m[0])
        .filter((path) => /payments?/i.test(path))

      for (const p of [...new Set(mentioned)]) {
        expect(
          p.startsWith(prefix),
          `${doc} يأمر بتسجيل «${p}» — والمسجَّلُ «${prefix}<المزوّد>». ` +
            'من تبع الوثيقةَ ردّ عليه ٤٠٤: المالُ مقبوضٌ ولا تسجيلَ يُنشأ.',
        ).toBe(true)
      }
    }
  })

  it('ولا تخلو الوثائقُ من العنوان بتاتا — فالصمتُ لا يُنقذ أحدا', () => {
    /* حارسٌ ضدّ «الإصلاح» بالحذف: من حذف العنوانَ من الوثائق أمرّ الحارسَ
       أعلاه وترك من يسجّل بلا مرجع. */
    const prefix = registeredWebhookPath().replace(/:\w+.*$/, '')
    const anyDocNamesIt = DOCS.some(
      (d) => existsSync(join(root, d)) && read(d).includes(prefix),
    )
    expect(anyDocNamesIt, 'لا وثيقةَ تذكر عنوانَ الخطّاف — ومن يسجّله يخمّن').toBe(true)
  })
})
