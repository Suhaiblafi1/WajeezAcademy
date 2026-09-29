/* لوحُ «وُقّع هذا العقد» يُعرض فيه العقد — لا خبرُ توقيعه وحدَه.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * شكا مدرّبٌ (٢٩ سبتمبر ٢٠٢٦) أنّه نقر «افتح العقد» فلم يُفتح له شيء. وأصلُه
 * في الخادم — الرمزُ كان يموت بالتوقيع — ويحرسه
 * `server/tests/trainer/contract-link-after-signing.test.ts`.
 *
 * وبقيَ نصفُه هنا: لو أُصلح الخادمُ وحدَه لفُتح للموقِّع لوحٌ يقول «سُجّل
 * توقيعُك» ولا وثيقةَ فيه — فيعود يشكو الشكوى نفسَها بحقّ، إذ زرٌّ اسمُه
 * «افتح العقد» يُفتح على العقد لا على خبرٍ عنه.
 *
 * ── وما يُقاس ──
 *
 * على **بنية** الشرط لا على ورود حرفٍ في الملفّ: أنّ المتنَ يُشتقّ في حالة
 * «وُقّع» كما يُشتقّ في «مفتوح»، وأنّ `ContractDocument` يُرسَم في فرعها،
 * وأنّ التوقيعَ من الشاشة ينقل المتنَ إلى الحال الجديدة. والرابعُ شاهدٌ على
 * جملةٍ كانت تعتذر عن حمايةٍ لا تقع.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const RAW = readFileSync(join(root, 'src/pages/ContractSign.tsx'), 'utf8')
/* وتُطرح التعليقاتُ: هذا الملفّ يشرح ما أُصلح بنصّه، فمسحٌ يقرأ التعليقَ
   يخضرّ على الشرح لا على الإصلاح. */
const PAGE = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

describe('نسخةُ الموقِّع تُعرَض له من رابطه', () => {
  it('والملفُّ مقروءٌ وفيه فرعُ «وُقّع» — وإلّا فالحارسُ يقيس الفراغ', () => {
    expect(PAGE.length, 'لم يُقرأ الملفّ').toBeGreaterThan(2000)
    expect(PAGE, 'لا فرعَ لحالة «وُقّع»').toContain("view.state === 'signed'")
  })

  it('المتنُ يُشتقّ في حالة «وُقّع» كما في «مفتوح»', () => {
    /* على البنية: الشرطُ الذي يُسند `bodyAr` يذكر الحالتين كلتيهما */
    const m = PAGE.match(/const bodyAr = [^\n]*\n?[^\n]*/)
    expect(m, 'لم يُوجَد إسنادُ `bodyAr`').toBeTruthy()
    expect(m![0], 'حالةُ «وُقّع» لا يُشتقّ لها متنٌ — فلوحُها بلا وثيقة')
      .toContain("'signed'")
    expect(m![0], 'حالةُ «مفتوح» فقدت متنَها').toContain("'open'")
  })

  it('و`ContractDocument` يُرسَم في فرع «وُقّع» لا في فرع «مفتوح» وحدَه', () => {
    /* يُقصّ ما بين فرع «وُقّع» وآخرِ اللوح، فيُنظَر أفيه رسمُ الوثيقة */
    const at = PAGE.indexOf("view.state === 'signed' && doc")
    expect(at, 'لا شرطَ يرسم الوثيقةَ في لوح «وُقّع»').toBeGreaterThan(-1)
    const branch = PAGE.slice(at, at + 400)
    expect(branch, 'فُتح لوحُ «وُقّع» بلا وثيقةٍ فيه').toContain('<ContractDocument')
  })

  it('والتوقيعُ من الشاشة ينقل المتنَ إلى حاله الجديدة', () => {
    const at = PAGE.indexOf('const sign = async (')
    expect(at, 'لم يُوجَد معالِجُ التوقيع').toBeGreaterThan(-1)
    const body = PAGE.slice(at, PAGE.indexOf('\n  const ', at + 1))
    expect(body, 'بُنيت حالُ «وُقّع» بلا متنٍ — فيرى الموقِّعُ لوحا خاويا')
      .toMatch(/bodyAr: v\.bodyAr/)
  })

  it('ولا يُعتذَر عن حمايةٍ لا تقع: «يُفتح مرّةً واحدة» جملةٌ زالت', () => {
    /* على النصّ المعروض لا على التعليق: `RAW` يحمل التعليقَ الذي يحكي الجملةَ
       القديمة، فلو قيست عليه لَسقط الحارسُ على شرحه هو. */
    expect(PAGE, 'بقيت الصفحةُ تقول إنّ الرابطَ يُفتح مرّةً واحدة')
      .not.toContain('يُفتح مرّةً واحدة')
    expect(PAGE, 'لم يُقَل للواقف أيُّ بابٍ هو').toContain('سحبته')
  })
})
