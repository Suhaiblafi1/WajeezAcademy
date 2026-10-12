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
import { SIGNED_COPY_STATES } from '@/application/trainer/contract-link-state'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const RAW = readFileSync(join(root, 'src/pages/ContractSign.tsx'), 'utf8')
/* وتُطرح التعليقاتُ: هذا الملفّ يشرح ما أُصلح بنصّه، فمسحٌ يقرأ التعليقَ
   يخضرّ على الشرح لا على الإصلاح. */
const PAGE = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

describe('نسخة الموقّع تعرض له من رابطه', () => {
  /* ═══ و«وُقّع» صار أوّلَ أخواتٍ أربع (١ أكتوبر ٢٠٢٦) ═══

     طلبُ صاحب المنصّة: «for the signed ones, they should still see the
     contract locked for reading» — لا حين ينتظر اعتمادَنا وحدَه، بل بعد أن
     نعتمده، وبعد أن يُزيحه أحدثُ منه، وبعد أن ينتهي. فصار شرطُ النسخة قائمةً
     مسمّاة (`SIGNED_COPY_STATES`) يُقاس أنّ «وُقّع» فيها وأنّ الصفحةَ تسألها. */
  it('والملفّ مقروء وفيه فرع «وقّع» — وإلّا فالحارس يقيس الفراغ', () => {
    expect(PAGE.length, 'لم يقرأ الملفّ').toBeGreaterThan(2000)
    expect(PAGE, 'لا تقرأ قائمة ما وقّع').toContain('SIGNED_COPY_STATES.includes(view.state)')
    for (const s of ['signed', 'countersigned', 'superseded', 'terminated'] as const) {
      expect(SIGNED_COPY_STATES, `«${s}» خرج من القائمة — فلوحه بلا وثيقة`).toContain(s)
    }
  })

  it('المتن يشتقّ لما وقّع كما لـ«مفتوح»', () => {
    /* على البنية: الشرطُ الذي يُسند `bodyAr` يذكر الحالتين كلتيهما */
    const m = PAGE.match(/const bodyAr = [^\n]*\n?[^\n]*/)
    expect(m, 'لم يوجد إسناد `bodyAr`').toBeTruthy()
    expect(m![0], 'ما وقّع لا يشتقّ له متن — فلوحه بلا وثيقة')
      .toContain('SIGNED_COPY_STATES.includes(view.state)')
    expect(m![0], 'حالة «مفتوح» فقدت متنها').toContain("'open'")
  })

  it('و`ContractDocument` يرسم في لوح ما وقّع لا في «مفتوح» وحده', () => {
    /* يُقصّ ما بعد شرط النسخة، فيُنظَر أفيه رسمُ الوثيقة */
    const at = PAGE.indexOf('const copy = SIGNED_COPY_STATES.includes(view.state) && doc')
    expect(at, 'لا شرط يرسم الوثيقة في لوح ما وقّع').toBeGreaterThan(-1)
    const draw = PAGE.indexOf('{copy && (', at)
    expect(draw, 'الشرط محسوب ولا يرسم به شيء').toBeGreaterThan(-1)
    expect(PAGE.slice(draw, draw + 400), 'فتح لوح «وقّع» بلا وثيقة فيه').toContain('<ContractDocument')
  })

  it('والتوقيع من الشاشة ينقل المتن إلى حاله الجديدة', () => {
    const at = PAGE.indexOf('const sign = async (')
    expect(at, 'لم يوجد معالج التوقيع').toBeGreaterThan(-1)
    const body = PAGE.slice(at, PAGE.indexOf('\n  const ', at + 1))
    expect(body, 'بنيت حال «وقّع» بلا متن — فيرى الموقّع لوحا خاويا')
      .toMatch(/bodyAr: v\.bodyAr/)
  })

  it('ولا يعتذر عن حماية لا تقع: «يفتح مرّة واحدة» جملة زالت', () => {
    /* على النصّ المعروض لا على التعليق: `RAW` يحمل التعليقَ الذي يحكي الجملةَ
       القديمة، فلو قيست عليه لَسقط الحارسُ على شرحه هو. */
    expect(PAGE, 'بقيت الصفحة تقول إنّ الرابط يفتح مرّة واحدة')
      .not.toContain('يفتح مرّة واحدة')
    expect(PAGE, 'لم يقل للواقف أيّ باب هو').toContain('سحبته')
  })
})
