/* أين يهبط الزائر — عطبان ظهرا على أجهزةٍ حقيقية لا في أيّ محاكاةٍ محلّية.

   كلاهما من نوعٍ واحد: الصفحةُ تصل، ولا خطأَ يُرمى، ولا شيءَ يُسجَّل — والعطبُ
   كلُّه فيما يراه الزائر. ولذلك يُحرَسان بنيةً: لا اختبارَ وحدةٍ يلتقط موضعَ
   لفٍّ في متصفّح، ولا سجلَّ يشهد على رسالةٍ خاطئة قُرئت. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (f: string) => readFileSync(join(root, f), 'utf8')

describe('الصفحة تُفتح من أعلاها', () => {
  /* شكا صاحبُ المنصّة ثلاثَ مرّات أنّ صفحة التشخيص «مقصوصة من الأعلى»، ولم
     تظهر الحالةُ في متصفّحٍ محلّيّ سريع قطّ — فعالجتُ مرّتين عَرَضا آخر.

     وأُعيد إنتاجُها أخيرا بخنق الشبكة: `history.scrollRestoration` قيمتُه
     `auto`، والصفحاتُ محمّلةٌ كسولا. فالترتيب على شبكةٍ بطيئة:
       تنقّل ← scrollTo(0,0) على مستندٍ قصير (شاشة الانتظار)
             ← تصل الحزمة ← يطول المستند
             ← يستعيد المتصفّحُ موضعَه المحفوظ الآن، بعد أن مضى أمرُنا
     القياس: مع `auto` هبطت الصفحةُ على scrollY=700 والعنوانُ فوق الحافّة
     بـ574 بكسل؛ ومع `manual` صفرٌ والعنوانُ ظاهر.

     ومنافسةُ المتصفّح بتأخيرٍ أو مؤقّت مقامرةٌ على شبكةٍ لا نعرفها. */
  const APP = read('src/App.tsx')

  it('الاستعادةُ التلقائية مُلغاة — وإلّا عادت الصفحةُ مقصوصة على الشبكات البطيئة', () => {
    expect(APP).toMatch(/history\.scrollRestoration\s*=\s*'manual'/)
  })

  it('وأمرُ الصعود باقٍ عند كلّ تنقّل', () => {
    expect(APP).toMatch(/window\.scrollTo\(0,\s*0\)/)
    expect(APP, 'الصعود معلَّقٌ على المسار').toMatch(/\[pathname\]/)
  })
})

describe('العودة من صفحة الدفع', () => {
  /* المزوّد يبني الرابطين من `callbackUrl` نفسِه (payments/provider.ts)، فكلاهما
     يحمل `paid=<orderId>`:
       نجاح : /student/learning?paid=<id>&paid=1
       إلغاء: /student/learning?paid=<id>&cancelled=1
     وكانت الصفحة تقرأ `paid` وحدَه، فمن ألغى دفعَه يُستقبَل بـ«شكرا لك» ثمّ
     ينتظر شعبا لن تأتي — لأنّه لم يدفع. */
  const ML = read('src/pages/student/MyLearning.tsx')

  it('الإلغاءُ يُقرأ — لا يُستدلّ بـ paid وحدَه', () => {
    expect(ML).toMatch(/params\.get\("cancelled"\)/)
  })

  it('ورسالةُ الشكر مشروطةٌ بألّا يكون إلغاء', () => {
    expect(ML, 'رسالةُ النجاح تظهر بلا نفي الإلغاء').toMatch(/paidOrder\s*&&\s*!cancelled/)
  })

  it('ورسالةُ الإلغاء تنفي الخصمَ صراحةً — فأوّلُ ما يخافه من تراجع أن يكون قد دُفع', () => {
    expect(ML).toMatch(/لم يُخصم منك شيء/)
  })
})
