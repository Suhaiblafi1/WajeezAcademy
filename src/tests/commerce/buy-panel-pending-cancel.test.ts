/* لوحُ الشراء: إلغاءُ الطلب المعلَّق لا يُضيع كودَ المنحة، وتعثّرُ صفحة الدفع لا يترك المشتري بلا زرّين.

   ═══ ما كان يقع (مراجعةُ رحلة المشتري، ٣١ أكتوبر ٢٠٢٦) ═══

   ١) من استنفد طلبُه المعلَّقُ حدَّ منحته رُدّ كودُه في التسعير ومُحي من `applied`. فإذا ألغى الطلبَ كما يدعوه سطرُه
      («ألغه وتشتريها بمنحتك هنا») أُعيد التسعيرُ بالكود الممحوّ — أي بلا منحة — وبقي تحت الخانة سببُ ردٍّ لم يعد صحيحا.
      فيدفع قريبا من السعر الكامل.
   ٢) من أُنشئ طلبُه وتعثّرت صفحةُ دفعه قيل له الخطأ واللوحُ على تسعيره القديم، فإذا ضغط «ادفع» ثانيةً قيل له «لك طلبٌ لم
      يكتمل دفعه» ولا زرَّ أمامه.

   والفحصُ على البنية بلا تعليقات: جسمُ الدالّة نفسِها، لا ورودُ كلمةٍ في الملفّ. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = readFileSync(join(root, 'src/components/BuyPanel.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
  .replace(/^\s*\/\/.*$/gm, '')

/** جسمُ دالّةٍ سهميّةٍ معرَّفةٍ بـ`const <name> = async (...) => { ... };` */
function body(name: string): string {
  const start = code.indexOf(`const ${name} = async`)
  expect(start, `لا دالّة ${name}`).toBeGreaterThan(-1)
  const open = code.indexOf('{', code.indexOf('=>', start))
  let depth = 0
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++
    else if (code[i] === '}' && --depth === 0) return code.slice(open, i + 1)
  }
  throw new Error(`لم تغلق ${name}`)
}

describe('لوح الشراء · إلغاء الطلب المعلق يعيد كود المنحة', () => {
  it('⚠️ الكود المردود يحفظ عند رده، ويمحى حين يقبل', () => {
    const refresh = code.slice(code.indexOf('const refresh = useCallback'), code.indexOf('useEffect(() => { void refresh(applied); }'))
    expect(refresh, 'الكود المردود لا يحفظ').toMatch(/rejectedCode\.current\s*=\s*code/)
    expect(refresh, 'الكود المقبول لا يمحو المردود').toMatch(/rejectedCode\.current\s*=\s*""/)
  })

  it('⚠️ بعد الإلغاء يسعر بالكود المردود لا بالممحو، ويمحى سبب الرد القديم', () => {
    const cancel = body('cancelPending')
    const after = cancel.slice(cancel.indexOf('/cancel'))
    expect(after, 'سبب الرد القديم يبقى بعد الإلغاء').toMatch(/setCouponError\(null\)/)
    expect(after, 'لا يعاد الكود المردود').toMatch(/applied\s*\|\|\s*rejectedCode\.current/)
    expect(after, 'الكود المردود لا يطبق').toMatch(/setApplied\(again\)/)
  })
})

describe('لوح الشراء · تعثر صفحة الدفع يظهر زري الطلب', () => {
  it('⚠️ يعاد التسعير في الخطأ قبل أن يقال — فيظهر «أكمل الدفع» و«ألغ الطلب»', () => {
    const pay = body('pay')
    const fail = pay.slice(pay.lastIndexOf('catch'))
    const re = fail.indexOf('await refresh(')
    expect(re, 'لا يعاد التسعير بعد تعثر الدفع').toBeGreaterThan(-1)
    /* والتسعيرُ يمحو الخطأ في أوّله — فالخطأُ يقال بعده لا قبله */
    expect(fail.indexOf('setError(', re), 'الخطأ يقال قبل التسعير فيمحى').toBeGreaterThan(re)
  })
})

describe('لوح الشراء · جلسة انتهت عند الخادم', () => {
  it('⚠️ ٤٠١ في التسعير يمحو نسخة الجهاز ويعطي باب الدخول بالعودة إلى الصفحة', () => {
    const refresh = code.slice(code.indexOf('const refresh = useCallback'), code.indexOf('useEffect(() => { void refresh(applied); }'))
    const on401 = refresh.slice(refresh.indexOf('status === 401'))
    expect(refresh, 'لا يفرق ٤٠١ عن غيره').toMatch(/e\.status === 401/)
    expect(on401, 'نسخة الجهاز تبقى').toMatch(/clearLocalSession\(\)/)
    expect(on401, 'لا باب دخول').toMatch(/setSignedOut\(true\)/)
    expect(code, 'باب الدخول لا يعود إلى الصفحة').toMatch(/\/auth\?next=\$\{encodeURIComponent/)
    expect(code, 'باب الدخول لا يظهر').toMatch(/\{signedOut && \(/)
  })
})
