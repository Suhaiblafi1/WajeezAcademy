/* شاشةُ العقود: نسخةٌ تُحمَل، وإغلاقٌ يقول أثرَه، ومنعٌ ينطق بسببه.
 *
 * ── البلاغاتُ التي تحرسها ──
 *
 * صاحبُ المنصّة (٢٦ سبتمبر ٢٠٢٦):
 * ① «العقد الملغى لم يظهر لي زرّ تحميل أو حذف».
 * ② «يجب أن يكون زرُّ إلغاء العقد فيرسل للمدرّب… **والنظام يجب أن يحذّرني إذا
 *   كان للإلغاء أثر**».
 * ③ «اسم الطرف الثاني يجب أن يكون مطابقا للهوية».
 *
 * ── وما يُقاس ──
 *
 * على **كتلة** الزرّ لا على الملفّ: صفُّ الأفعال يحمل سبعةَ أزرارٍ تنادي
 * مساراتٍ متشابهة، فمسحٌ على الملفّ يخضرّ على جار. وهي طريقةُ
 * `countersign-activates-button.test.ts` نفسُها.
 *
 * ── وأدقُّ ما يُقاس: أنّ الأرقامَ تُقرأ قبل أن تُفتح النافذة ──
 *
 * نافذةٌ تُفتح ثمّ تُقرأ أرقامُها تُقرأ أصفارا لحظةً، ومن نقر في تلك اللحظة
 * نقر على «لا أثر». فالقياسُ أنّ `closing` لا تُوضَع إلّا بالقراءة في يدها —
 * أي أنّ `apiGet` **داخلَ** نداء `setClosing` لا قبله بسطر.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const bare = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const SCREEN = bare('src/pages/admin/TrainerContracts.tsx')
const CSS = read('src/index.css')

/** كتلةُ زرٍّ بعينها — من `onClick` السابق للنصّ إلى إغلاق النداء */
function callBlock(needle: string): string {
  const at = SCREEN.indexOf(needle)
  if (at < 0) return ''
  const open = SCREEN.lastIndexOf('onClick', at)
  const close = SCREEN.indexOf('}>', at)
  return open < 0 || close < 0 ? '' : SCREEN.slice(open, close)
}

describe('① نسختُه تُطبَع وتُنزَّل — ولو أُلغي', () => {
  it('وزرُّ المتن ليس معلَّقا على حالةٍ بعينها', () => {
    /* لو عُلّق على `signed` أو `countersigned` لَاحتجب عن الملغى — وهو
       عينُ البلاغ. فالشرطُ وجودُ متنٍ لا مرتبةُ حالته. */
    const at = SCREEN.indexOf('/body`')
    expect(at, 'لا زرَّ يفتح المتن').toBeGreaterThan(0)
    const guard = SCREEN.slice(SCREEN.lastIndexOf('{c.', SCREEN.lastIndexOf('<Button', at)), at)
    expect(guard, 'عُلّق فتحُ المتن على حالةٍ بعينها فاحتجب عن الملغى')
      .not.toMatch(/c\.status ===/)
  })

  it('والنافذةُ فيها بابُ طباعةٍ وبابُ تنزيل', () => {
    expect(SCREEN, 'لا بابَ للطباعة').toMatch(/onClick=\{\(\) => window\.print\(\)\}/)
    expect(SCREEN, 'لا بابَ لتنزيل المتن').toMatch(/onClick=\{\(\) => downloadBodyAr\(shownBody\)\}/)
  })

  it('والمنزَّلُ هو المتنُ المبصومُ نفسُه لا صياغةٌ له', () => {
    const fn = SCREEN.slice(SCREEN.indexOf('function downloadBodyAr'))
      .slice(0, SCREEN.slice(SCREEN.indexOf('function downloadBodyAr')).indexOf('\n}') + 2)
    expect(fn, 'لم تُقرأ دالّةُ التنزيل').toContain('Blob')
    expect(fn, 'نُزّل غيرُ متن الوثيقة — فلا تُقابَل به بصمة').toMatch(/new Blob\(\[doc\.body\]/)
  })

  it('والطباعةُ تُخرج الوثيقةَ وحدَها من شاشةٍ فيها مئتا صفّ', () => {
    /* الوسمُ والقاعدةُ والمعرّف: ثلاثتُها تلزم، وسقوطُ واحدٍ يطبع الشاشةَ
       كلَّها أو لا يطبع شيئا. */
    expect(SCREEN, 'لا وسمَ طباعةٍ يُوضَع عند فتح النافذة')
      .toMatch(/setAttribute\("data-printing", "contract-body"\)/)
    expect(SCREEN, 'لا يُرفَع الوسمُ بإغلاقها — فتُعدَّل طباعةُ كلّ شاشةٍ بعدها')
      .toMatch(/removeAttribute\("data-printing"\)/)
    expect(SCREEN, 'لا معرّفَ للورقة فلا شيءَ تمسكه القاعدة')
      .toMatch(/id="contract-sheet"/)

    const printBlocks = CSS.match(/@media print \{[\s\S]*?\n\}/g) ?? []
    const rule = printBlocks.find((b) => b.includes('data-printing="contract-body"')) ?? ''
    expect(rule, 'لا قاعدةَ طباعةٍ للوثيقة — أو هي خارج `@media print`').not.toBe('')
    expect(rule, 'القاعدةُ لا تستثني الورقةَ ولا أجدادَها، فتُخفيها مع الشاشة')
      .toMatch(/:not\(:has\(#contract-sheet\)\)/)
    expect(rule, 'يبقى قصُّ الشاشة في الورقة فيخرج ثلثُ العقد')
      .toMatch(/max-height:\s*none/)
  })
})

describe('② والإغلاقُ يقول أثرَه قبل أن يقع', () => {
  const REVOKE = callBlock('closeWith(c, "revoke")')
  const DEPART = callBlock('closeWith(c, "depart")')

  it('والكتلتان مقروءتان — وإلّا فالحارسُ يقيس الفراغ', () => {
    expect(REVOKE, 'لا زرَّ إلغاءٍ يمرّ بقارئ الأثر').not.toBe('')
    expect(DEPART, 'لا زرَّ إنهاءٍ للنافذ').not.toBe('')
  })

  it('ولا حوارَ متصفّحٍ يسأل «لماذا» بلا رقم', () => {
    expect(SCREEN, 'بقي `window.prompt` بابا للإغلاق — سطرٌ بلا أثرٍ ولا سياق')
      .not.toMatch(/window\.prompt/)
  })

  it('والنافذةُ لا تُفتح إلّا وأرقامُها في يدها', () => {
    const fn = SCREEN.slice(SCREEN.indexOf('const closeWith ='))
    const body = fn.slice(0, fn.indexOf('\n  };'))
    expect(body, 'لم تُقرأ دالّةُ فتح النافذة').toContain('setClosing')
    /* القراءةُ **داخلَ** النداء: `setClosing({ …, impact: await apiGet(…) })`.
       ولو سبقته بسطرٍ لَأمكن أن تُفتح النافذةُ على أصفارٍ تُقرأ «لا أثر». */
    expect(body, 'فُتحت النافذةُ ثمّ قُرئت أرقامُها — فلحظةٌ تُقرأ فيها أصفارا')
      .toMatch(/setClosing\(\{[^}]*impact:\s*await apiGet/)
    expect(body, 'تُفتح النافذةُ ولو تعثّرت القراءة')
      .toMatch(/catch[\s\S]*setRowErr/)
  })

  it('والنافذةُ تعدّ المواضعَ الأربعةَ التي يمسّها الرحيل', () => {
    const dlg = SCREEN.slice(SCREEN.indexOf('{closing && ('))
    const block = dlg.slice(0, dlg.indexOf('</ConfirmAction>'))
    expect(block, 'لم تُقرأ نافذةُ الإغلاق').toContain('ConfirmAction')
    for (const [key, what] of [
      ['liveCohorts', 'الشعبُ الحيّة'], ['enrolledLearners', 'المتعلّمون'],
      ['openOffers', 'العروضُ المعلَّقة'], ['unpaidPayouts', 'المستحقّاتُ غيرُ المصروفة'],
    ] as const) {
      expect(block, `لا تُعرَض ${what} في نافذة الإغلاق`).toContain(`impact.${key}`)
    }
    expect(block, 'جُمعت العملاتُ في رقمٍ واحد').toContain('owedByCurrency')
  })

  it('وسببُ الإلغاء مشروطٌ لا اختياريّ، ويصل المدرّبَ', () => {
    const dlg = SCREEN.slice(SCREEN.indexOf('{closing && ('))
    const block = dlg.slice(0, dlg.indexOf('</ConfirmAction>'))
    expect(block, 'لا سببَ مشروطٌ — فيُغلَق بلا ما يُقرأ بعد سنة')
      .toMatch(/reason=\{\{[\s\S]*minLength:\s*[1-9]/)
    expect(block, 'لا يُرسَل السببُ مع الإلغاء').toMatch(/reasonAr:\s*reasonText/)
  })

  it('ولا يُوعَد في الرحيل بما لا يُرسَل', () => {
    /* رسالةُ الرحيل تقول إنّ التعاقد انتهى ولا تنقل سببَه
       (`trainer-departure.service.ts`). فنصٌّ يقول «يصل المدرّبَ بنصّه» في
       بابِ الرحيل يصنع شكوى المرحلة السادسة نفسَها: وعدٌ مكتوبٌ لا يُوفى. */
    const dlg = SCREEN.slice(SCREEN.indexOf('{closing && ('))
    const block = dlg.slice(0, dlg.indexOf('</ConfirmAction>'))
    expect(block, 'وُحّد نصُّ السبب للبابَين — فأحدُهما يَعِد بما لا يُرسَل')
      .toMatch(/closing\.mode === "revoke"\s*\?\s*"سببُ الإلغاء/)
  })

  it('وإنهاءُ النافذِ يمشي في مسار الرحيل لا في فسخٍ وحدَه', () => {
    /* فسخُ العقد وحدَه يترك شعبا بلا مدرّبٍ وعروضا تنتظر جوابَ راحل.
       و`trainer-departures` تفسخ وتفتح صفّا لكلّ متعلّمٍ وتسحب العروض. */
    const dlg = SCREEN.slice(SCREEN.indexOf('{closing && ('))
    const block = dlg.slice(0, dlg.indexOf('</ConfirmAction>'))
    expect(block, 'الإنهاءُ لا يمرّ بمسار الرحيل — فيُترك ما بُني على العقد معلَّقا')
      .toContain('/api/admin/trainer-departures')
    expect(block, 'الإلغاءُ لا ينادي مسارَه').toMatch(/\/revoke`/)
  })

  it('وزرُّ الإنهاءِ على النافذ وحدَه', () => {
    const at = SCREEN.indexOf('closeWith(c, "depart")')
    const guard = SCREEN.slice(SCREEN.lastIndexOf('{c.', at), at)
    expect(guard, 'عُرض إنهاءُ التعاقد على غير النافذ')
      .toMatch(/c\.status === "countersigned"/)
  })
})

describe('③ والاسمان في الصفّ، والمنعُ ينطق بسببه', () => {
  it('الحكمُ في الحذف مستدعًى لا منسوخٌ بقائمة حالات', () => {
    /* كانت القائمةُ مكتوبةً باليد هنا ومكتوبةً في `contract-untouchable.ts`.
       ونسختان من حكمٍ تفترقان يوما، فيُخفي أحدُهما زرّا يسمح به الآخر. */
    expect(SCREEN, 'لا يُستدعى حكمُ «ما مسّه توقيعٌ»').toMatch(/isUntouchableContract\(c\)/)
    expect(SCREEN, 'بقيت نسخةٌ يدويّةٌ من قائمة الحالات في الشاشة')
      .not.toMatch(/\[\s*"signed",\s*"countersigned",\s*"terminated",\s*"superseded"\s*\]/)
  })

  it('وغيابُ زرّ الحذف يقول سببَه', () => {
    const at = SCREEN.indexOf('isUntouchableContract(c)')
    const block = SCREEN.slice(at, SCREEN.indexOf('احذِفْ', at))
    expect(block, 'يُمنع الحذفُ صامتا — وهو عينُ البلاغ الأوّل')
      .toMatch(/فلا يُحذَف/)
  })

  it('والاسمُ المعروضُ هو المطبوعُ في الوثيقة لا اسمُ الحساب', () => {
    /* بعد تصحيح الاسم يصير المطبوعُ `legalNameAr`. فشاشةٌ تعرض اسمَ الحساب
       تُنبّه على فرقٍ صحّحه الموظّفُ بنفسه، وتسكت عن فرقٍ قائم. */
    expect(SCREEN, 'لا يُقرأ الاسمُ المطبوعُ في الوثيقة')
      .toMatch(/legalNameAr \?\? c\.profile\?\.application\?\.fullName/)
    expect(SCREEN, 'بقي موضعٌ يعرض اسمَ الحساب مكانَ اسم الوثيقة')
      .not.toMatch(/<b>\{c\.profile\?\.application\?\.fullName/)
  })

  it('والاسمان يُعرَضان معا ويُقابَلان بـ`nameMatch`', () => {
    expect(SCREEN, 'لا مقابلةَ بين الاسمَين').toMatch(/nameMatch\(namesOf\(c\)\)/)
    expect(SCREEN, 'لا تُعرَض حالةُ «لم يُوقَّع» مستقلّةً — فيُقال «مطابق» على ما لم يُمَسّ')
      .toMatch(/nameMatch\(namesOf\(c\)\) !== "unsigned"/)
    expect(SCREEN, 'لا يُعرَض الاسمُ الموقَّعُ به إلى جانبه').toMatch(/c\.signerLegalName \?\? "—"/)
  })

  it('والفرقُ يقول ما يُفعَل به لا «انتبهْ» وحدَها', () => {
    const at = SCREEN.indexOf('=== "differs"')
    const block = SCREEN.slice(at, at + 900)
    expect(block, 'يُنبّه على الفرق ولا يقول أين المخرج').toMatch(/اردُدِ التوقيعَ|فاردُدِ التوقيعَ/)
  })
})
