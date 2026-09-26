/* صفحةُ التوقيع لا تطرق بابا أغلقته بنفسها.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * بلاغُ صاحب المنصّة (٢٦ سبتمبر ٢٠٢٦): «بعد أن يوقّع المدرّب العقد تظهر له
 * صفحة "تعذّر فتحُ العقد" بالرغم أنّه يظهر لنا أنّه قام بالتوقيع».
 *
 * وعلّتُه ترتيبٌ من ثلاث خطوات، كلُّ واحدةٍ منها صحيحةٌ وحدَها:
 *
 * ① `signContractByToken` تكتب `tokenHash: null` — والرمزُ يموت بالتوقيع
 *   قصدا، فبابٌ حيٌّ على وثيقةٍ تحمل اسمَ إنسانٍ وأتعابَه لا يُترك مفتوحا.
 * ② ثمّ كانت الشاشةُ تستدعي `load()` بالرمز الميّت.
 * ③ فيُردّ ٤٠٤، و`load` تكتب `fatal`، و`fatal` تكسو الصفحةَ لوحا أحمر.
 *
 * فيُرسَم الفشلُ فوق فعلٍ **نجح**. ومن قرأه ظنّ توقيعَه ضائعا.
 *
 * ── وما يُقاس ──
 *
 * أنّ الفعلَين اللذَين يميتان الرمزَ (التوقيعُ والاعتذار) يبنيان الحالَ من
 * **جواب الخادم**، وأنّ طلبَ التعديل — ورمزُه يبقى حيّا لأنّ العقدَ ينتظر
 * جوابَنا — ما زال يسأل الخادمَ. والثالثُ شاهدٌ مضادّ: لولاه لَمرّ فحصٌ يقول
 * «لا `load` في الملفّ» وهو لا يقيس شيئا.
 *
 * والفحصُ على جسم الدالّة بعينها لا على الملفّ: `load` تُنادى في هذا الملفّ
 * بحقٍّ في مواضعَ أخرى (أوّلُ رسم، ورفعُ وثيقة).
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
/* وتُطرح التعليقاتُ: هذا الملفّ يشرح العطبَ في رأس الدالّة بنصّه، فمسحٌ
   يقرأ التعليقَ يخضرّ على شرحِ ما أُصلح لا على إصلاحه. */
const bare = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const PAGE = bare('src/pages/ContractSign.tsx')

/** جسمُ معالِجٍ بعينه: من `const <name> = async () => {` إلى المعالج الذي يليه */
function handler(name: string): string {
  const at = PAGE.indexOf(`const ${name} = async (`)
  if (at < 0) return ''
  const next = PAGE.indexOf('\n  const ', at + 1)
  return PAGE.slice(at, next < 0 ? PAGE.length : next)
}

const SIGN = handler('sign')
const DECLINE = handler('decline')
const AMEND = handler('requestAmendment')

describe('ما أغلق البابَ خلفه لا يطرقه ثانيةً', () => {
  it('والأجسامُ الثلاثةُ مقروءةٌ — وإلّا فالحارسُ يقيس الفراغ', () => {
    expect(SIGN, 'لم يُقرأ جسمُ `sign`').not.toBe('')
    expect(DECLINE, 'لم يُقرأ جسمُ `decline`').not.toBe('')
    expect(AMEND, 'لم يُقرأ جسمُ `requestAmendment`').not.toBe('')
    /* وأنّها هي: كلُّ واحدٍ ينادي مسارَه هو */
    expect(SIGN).toContain('/sign`')
    expect(DECLINE).toContain('/decline`')
    expect(AMEND).toContain('/amend`')
  })

  it('التوقيعُ يبني حالَه من جواب الخادم ولا يُعيد قراءةَ رمزٍ أماته', () => {
    expect(SIGN, 'عادت الشاشةُ تسأل برمزٍ ميّتٍ بعد التوقيع').not.toMatch(/\bload\(\)/)
    expect(SIGN, 'لم تُبنَ حالُ «وُقّع» من جواب التوقيع').toMatch(/setView\(\{[\s\S]*state: 'signed'/)
    /* وتاريخُه من الخادم لا من ساعة المتصفّح */
    expect(SIGN, 'تاريخُ التوقيع من غير جواب الخادم').toMatch(/signedAt: r\.signedAt/)
  })

  it('والاعتذارُ مثلُه — ورمزُه يموت كذلك', () => {
    expect(DECLINE, 'عادت الشاشةُ تسأل برمزٍ ميّتٍ بعد الاعتذار').not.toMatch(/\bload\(\)/)
    expect(DECLINE, 'لم تُبنَ حالُ «اعتُذر» من جواب الاعتذار').toMatch(/setView\(\{[\s\S]*state: 'declined'/)
  })

  it('وطلبُ التعديل يبقى يسأل الخادمَ — رمزُه حيٌّ والعقدُ ينتظر جوابَنا', () => {
    /* الشاهدُ المضادّ: به يُعلَم أنّ الفحصَ فوقُ يميّز ولا يمسح الملفَّ كلَّه */
    expect(AMEND, 'طلبُ التعديل لا يسأل الخادمَ — فالفحصُ فوقَه لا يميّز شيئا')
      .toMatch(/\bload\(\)/)
  })
})

describe('الرابطُ المنتهي ليس عطبا', () => {
  it('يُحفَظ رمزُ الخطأ لا نصُّه وحدَه', () => {
    const LOAD = handler('load') || PAGE.slice(PAGE.indexOf('const load = useCallback'))
    expect(LOAD, 'لم يُحفَظ رمزُ الخطأ، فلا سبيلَ إلى التمييز').toMatch(/code: e\.code/)
  })

  it('وينفصل لوحُه عن اللوح الأحمر — ولا يُقال له «تعذّر» على فعلٍ نجح', () => {
    expect(PAGE, 'لا تمييزَ للرابط المنتهي').toContain("fatal.code === 'invalid_token'")
    /* واللوحُ يتبدّل نبرةً وعنوانا معا: نبرةٌ تهدأ وعنوانٌ يبقى «تعذّر» لا يصلح */
    expect(PAGE, 'بقيت النبرةُ حمراءَ على رابطٍ أدّى عملَه')
      .toMatch(/tone=\{spent \? 'warn' : 'danger'\}/)
    expect(PAGE, 'بقي العنوانُ «تعذّر فتحُ العقد» على رابطٍ منتهٍ')
      .toMatch(/\{spent \? 'انتهى هذا الرابط' : 'تعذّر فتحُ العقد'\}/)
  })
})
