/* نسختُه الموقَّعةُ تُحال إليها ولا تُسكَب في بريد.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * بريدُ «نسختُك من العقد الموقَّع» كان يسكب `bodyAr` كلَّه في فقرةٍ واحدة:
 * ثلاثُمئةِ سطرٍ بلا بنيةٍ ولا رأسٍ ولا أثرٍ لأنّه وقّعها. فقال صاحبُ المنصّة
 * (٢٥ سبتمبر ٢٠٢٦): «يصله نصا طويلا غير موقع!! اين نضع توقيعنا؟».
 *
 * وليست العلّةُ في الصياغة وحدَها: عملاءُ البريد يقطعون الرسائلَ الطويلةَ
 * ويكسرون أسطرَها، فوثيقةٌ تُطبَع وتُحفَظ لا تُسلَّم في متن رسالة.
 *
 * ── والمقيسُ موضعُ الفعل لا ورودُ حرفٍ في ملفّ ──
 *
 * الفحصُ محدودٌ بجسم الدالّة نفسِها: `bodyAr` تُذكَر في هذا الملفّ عشراتَ
 * المرّات بحقّ (تُركَّب وتُهشَّم وتُقابَل)، فمسحٌ على الملفّ كلِّه يحمرُّ على
 * الصواب أو يخضرُّ على جارٍ.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const bare = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** جسمُ دالّةٍ بعينها لا إلى آخر الملفّ — على نمط حارس عدّ ما ينتظر ختمَنا */
function fnBody(src: string, name: string): string {
  const at = src.indexOf(`async ${name}(`)
  if (at < 0) return ''
  const next = src.indexOf('\n  async ', at + 1)
  return src.slice(at, next < 0 ? src.length : next)
}

const SVC = bare('server/services/trainer-review.service.ts')
const SIGN = fnBody(SVC, 'signContractByToken')

describe('بريدُ النسخة الموقَّعة يُحيل ولا يسكب', () => {
  it('وجسمُ دالّة التوقيع مقروءٌ — وإلّا فالحارسُ يقيس الفراغ', () => {
    expect(SIGN, 'لم يُقرأ جسمُ `signContractByToken`').not.toBe('')
    expect(SIGN, 'الجسمُ المقروءُ ليس جسمَ التوقيع').toContain('signerLegalName: legalName')
    expect(SIGN.length, 'الجسمُ المقروءُ أقصرُ من أن يكون هو').toBeGreaterThan(1500)
  })

  it('لا يُسكَب المتنُ في كتلةِ رسالة', () => {
    /* والصيغةُ التي كانت: `{ kind: 'p', text: c.bodyAr ?? '' }` */
    expect(SIGN, 'عاد المتنُ يُسكَب في البريد').not.toMatch(/text:\s*c\.bodyAr/)
    expect(SIGN, 'عاد المتنُ يُسكَب في البريد بصيغةٍ أخرى').not.toMatch(/text:[^\n]*bodyAr/)
  })

  it('ويحمل ما يُثبت التوقيعَ: الاسمُ القانونيُّ وبصمةُ النصّ', () => {
    /* ولا «وقّعتَ» وحدَها: بصمةُ النصّ هي ما يُحتَجّ به، وبدونها تبقى
       الرسالةُ إخبارا لا إثباتا. */
    expect(SIGN, 'لا تُذكَر بصمةُ النصّ في الرسالة').toMatch(/value:\s*c\.bodyHash/)
    expect(SIGN, 'لا يُذكَر الاسمُ القانونيُّ في الرسالة').toMatch(/value:\s*legalName/)
  })

  it('ويُحيل إلى «عقدي» في بوّابته', () => {
    expect(SIGN, 'لا وصلةَ إلى صفحة العقد').toContain("/trainer/contract")
  })

  /* ═══ والوعدُ يُقال بشرطه ═══

     من وقّع قبل أن يُنشئ حسابَه لا يفتح بوّابتَه اليومَ: `profile.userId`
     فارغٌ حتّى `consumeInvitation`. فزرٌّ يُرسَل إليه يردُّه إلى شاشة دخول —
     وهو أسوأُ من لا زرّ: وعدٌ يُخلَف في أوّل نقرة. */
  /* ولا يُقاس هذا بإرسالٍ حقيقيّ: الرسائلُ لا تُخزَّن في هذه المنصّة
     (`sendDirectEmail` تُسلّم للمزوّد وتعيد حالتَها)، فلا جسمَ رسالةٍ يُقرأ
     من قاعدةٍ بعد الفعل. فالقياسُ على بنية الشرط في موضعه. */
  it('ولا يُوعَد بزرٍّ من لا حسابَ له بعد', () => {
    expect(SIGN, 'لا يُسأل أصلا عن وجود الحساب').toMatch(/profile\.userId/)
    const cta = SIGN.indexOf("kind: 'cta'")
    expect(cta, 'لا زرَّ في الرسالة — أحُذفت الوصلةُ كلُّها؟').toBeGreaterThan(0)
    /* ولا يُكتفى بأنّ `hasPortal` مذكورةٌ قبل الزرّ: تصريحُها وحدَه يسبقه
       دائما، فيخضرُّ الفحصُ ولو رُفع الشرطُ عن الزرّ. فيُقاس على **حدّي
       الشرط**: الزرُّ بين فتحِ فرعِ «له حساب» وبدءِ فرعِ «لا حساب». */
    const tern = SIGN.indexOf('...(hasPortal')
    expect(tern, 'الزرُّ غيرُ معلَّقٍ على وجود الحساب').toBeGreaterThan(0)
    expect(cta, 'الزرُّ خارجَ فرعِ «له حساب»').toBeGreaterThan(tern)
    const otherwise = SIGN.indexOf(': ([', tern)
    expect(otherwise, 'لا فرعَ لمن لا حسابَ له — فيُترَك بلا خبر').toBeGreaterThan(0)
    expect(otherwise, 'الزرُّ في فرعِ «لا حساب» — يردُّه إلى شاشة دخول').toBeGreaterThan(cta)
  })
})
