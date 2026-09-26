/* اسمُ الطرف الثاني في الشاشتَين — بابُ الموظّف وبابُ المدرّب.
 *
 * ── العطبُ الذي تحرسه ──
 *
 * بلاغُ صاحب المنصّة (٢٦ سبتمبر ٢٠٢٦): «الطرف الثاني كاسم يجب أن يكون مطابقا
 * للهويّة **أو أعطِه الحقَّ بكتابته بنفسه**». وهما بابان لا واحد، ولا يغني
 * أحدُهما عن الآخر: من سدّ بابَ الموظّف وحدَه بقي الخطأُ يقع حين لا ينتبه،
 * ومن سدّ بابَ المدرّب وحدَه ترك الخطأَ يُكتشَف بعد التوقيع لا قبله.
 *
 * ــ وما يُقاس: المسارُ والمصدر، لا ورودُ كلمةٍ في ملفّ ــ
 *
 * فالشاشةُ قد تعرض حقلا جميلا لا يصل الخادمَ، أو تملؤه من اسم الحساب فتعيد
 * العطبَ بحقلٍ فوقه. فيُقاس **ما يُرسَل** و**من أين يُملأ**.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const bare = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const SIGN = bare('src/pages/ContractSign.tsx')
const ADMIN = bare('src/pages/admin/TrainerContracts.tsx')

/** جسمُ معالِجٍ بعينه: من `const <name> = async (` إلى المعالج الذي يليه */
function handler(src: string, name: string): string {
  const at = src.indexOf(`const ${name} = async (`)
  if (at < 0) return ''
  const next = src.indexOf('\n  const ', at + 1)
  return src.slice(at, next < 0 ? src.length : next)
}

describe('بابُ المدرّب: «اسمي في هويّتي غيرُ هذا»', () => {
  it('والملفّان مقروءان — وإلّا فالحارسُ يقيس الفراغ', () => {
    expect(SIGN.length, 'لم تُقرأ صفحةُ التوقيع').toBeGreaterThan(5000)
    expect(ADMIN.length, 'لم تُقرأ شاشةُ العقود').toBeGreaterThan(5000)
  })

  it('للمدرّب زرٌّ رابعٌ أمام عرضه', () => {
    expect(SIGN, 'لا بابَ للمدرّب يصحّح به اسمَه').toContain('اسمي في هويّتي غيرُ هذا')
  })

  it('وينادي مسارَه هو لا مسارَ طلبِ التعديل', () => {
    const fn = handler(SIGN, 'requestNameCorrection')
    expect(fn, 'لم يُقرأ معالجُ تصحيح الاسم').not.toBe('')
    expect(fn, 'تصحيحُ الاسم يمرّ من باب طلب التعديل — فيضيع تمييزُه')
      .toContain('/name-correction`')
    expect(fn, 'يُرسَل نصّا حرّا لا اسما في حقله').toContain('legalNameAr:')
  })

  it('ويُعرَض له الاسمُ المطبوعُ في الوثيقة ليقابله', () => {
    /* ولا يُسأل «ما اسمُك؟» في فراغ: من لا يرى ما كُتب لا يعرف أثمّ فرقٌ أصلا */
    expect(SIGN, 'لا يُعرَض له ما تسمّيه الوثيقةُ به').toMatch(/\{v\.trainerName\}/)
  })
})

describe('بابُ الموظّف: الاسمُ يُحرَّر قبل التجميد', () => {
  it('حقلُ اسم الطرف الثاني يُرسَل مع مُدخل التركيب', () => {
    expect(ADMIN, 'الحقلُ لا يصل الخادمَ — شاشةٌ تُملأ بلا أثر')
      .toContain('trainerLegalNameAr: legalNameAr.trim() || null')
  })

  it('ويُملأ من الاسم المثبَّت لا من اسم الحساب', () => {
    /* ═══ وهذا أدقُّ ما في هذا اللوح ═══

       حقلٌ يُملأ من `fullName` يعيد العطبَ بحقلٍ فوقه: يرى الموظّفُ اسما
       يبدو صحيحا فيمرّره بلا نظر. و`legalNameAr` تعود إلى `fullName` في
       الخادم حين لا يكون ثمّ اسمٌ مثبَّت — فالفرقُ يُقرأ في `legalNameSource`. */
    expect(ADMIN, 'الحقلُ يُملأ من اسم الحساب فيعيد العطبَ')
      .toContain('setLegalNameAr(p.legalNameAr)')
    expect(ADMIN, 'لا يُنبَّه الموظّفُ حين يكون الاسمُ من الحساب بعدُ')
      .toContain('prefill.legalNameSource === "account"')
  })
})

describe('وجوابُ تصحيح الاسم نقرةٌ لا صندوقُ نصّ', () => {
  it('اللوحُ يفرّق بين تصحيحِ اسمٍ واعتراضٍ على بند', () => {
    /* الوقوفُ واحدٌ في الحالة، والجوابُ مختلف: ذاك يُجاب بنعم أو لا، وهذا
       لا يُجاب إلّا بفعل — فلا رأيَ لنا في اسم إنسان. */
    expect(ADMIN, 'لا تمييزَ لوقوفِ تصحيح الاسم')
      .toContain('c.status === "amendment_requested" && c.nameCorrectionAr')
    expect(ADMIN, 'صندوقُ جوابِ التعديل يُعرَض على تصحيح اسمٍ كذلك')
      .toContain('c.status === "amendment_requested" && !c.nameCorrectionAr')
  })

  it('وله مسارُه ينادَى من اللوح', () => {
    expect(ADMIN, 'لا زرَّ يُعيد العقدَ مصحَّحا').toContain('/name-reissue`')
  })

  it('ورفضُ التوقيع يُتبَع ببابٍ يُوفي بما وُعد به في البريد', () => {
    /* بريدُ الرفض يقول: «ويصلك عقدٌ جديدٌ برابطٍ جديدٍ بعد تصحيحه» — وكان
       لا يُنشأ شيء. فالصفُّ المرفوضُ يحمل بابَه. */
    expect(ADMIN, 'لا بابَ على الصفّ المرفوض')
      .toContain('(c.revokeReasonAr ?? "").startsWith("رُفض التوقيع")')
    expect(ADMIN, 'لا زرَّ يصحّح الاسمَ ويُعيد الإرسال')
      .toContain('صحّحِ الاسمَ وأعِدْ إرساله')
  })
})
