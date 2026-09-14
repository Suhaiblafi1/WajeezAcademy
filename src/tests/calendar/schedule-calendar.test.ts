/* «جدولي» تقويمٌ لا قائمةٌ مبعثرة (ع-٣ · ك-١١).

   والمحروسُ هنا ما لا تراه الوحدةُ النقيّة: أنّ الشاشةَ تنادي التقويمَ فعلا،
   وأنّ القائمةَ **لم تُحذف** بل نزلت تحته — فالتقويمُ يقول الشكلَ والقائمةُ
   تقول التفصيل (اسمَ الدورة والشعبةِ والدور ووقتَ النهاية)، وخانةُ يومٍ لا
   تسع ذلك. ومن حشره فيها أعاد الازدحامَ من بابٍ آخر.

   وك-١١ من دفتر العمل: «التقويمُ مكوّنٌ واحدٌ يُستعمل مرّتين». فالمكوّنُ لا
   يعرف ما الجلسةُ ولا من يقرؤها — يُعطى `at` و`renderItem` — وذلك ما يجعله
   صالحا لجدول المتعلّم حين يأتي دورُه. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const code = (p: string) => read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('«جدولي» صار تقويما', () => {
  const page = code('src/pages/trainer/Schedule.tsx')

  it('⚠️ الشاشةُ تنادي التقويمَ لا تصيّر شبكةً بيدها', () => {
    expect(page, 'لا تقويمَ في الشاشة').toMatch(/<MonthCalendar\b/)
    expect(page, 'حسابُ الشهر أُعيد في الشاشة بدل الوحدة المفحوصة')
      .not.toMatch(/getDay\(\)|new Date\([^)]*,\s*1\s*-\s*/)
  })

  it('⚠️ والقائمةُ باقيةٌ تحته — التقويمُ شكلٌ والقائمةُ تفصيل', () => {
    /* حذفُها يُخسِر اسمَ الدورة والشعبةِ والدورِ ووقتَ النهاية — ولا تسعها
       خانةُ يوم. */
    expect(page, 'القائمةُ التفصيليّةُ حُذفت مع التقويم').toContain('byDay.entries()')
    expect(page, 'اسمُ الدورة والشعبة سقط من التفصيل').toMatch(/s\.courseTitle/)
  })

  it('⚠️ و«القادمة» تُميَّز — وهي أوّلُ ما يُبحث عنه في تقويم', () => {
    expect(page).toMatch(/nextItem\(data\.sessions/)
    expect(page, 'التمييزُ لا يصل التقويم').toMatch(/isNext=/)
  })

  it('⚠️ والتزاحمُ يبقى ظاهرا في التقويم — لا في القائمة وحدَها', () => {
    /* التزاحمُ هو علّةُ وجود هذه الشاشة أصلا: من رآه في القائمة وحدَها
       فاته في الشكل الذي جاء يقرؤه. */
    expect(page).toMatch(/clashesWith\.length > 0[\s\S]{0,120}?bg-red/)
  })

  it('⚠️ والمكوّنُ لا يعرف ما يُعرض فيه — فيصلح لجدول المتعلّم كذلك (ك-١١)', () => {
    const cal = code('src/components/MonthCalendar.tsx')
    for (const own of ['sessionId', 'cohortTitle', 'courseTitle', 'clashesWith']) {
      expect(cal, `التقويمُ صار يعرف «${own}» فارتبط بجدول المدرّب وحدَه`).not.toContain(own)
    }
    expect(cal, 'لا مدخلَ لقراءة تاريخ العنصر').toMatch(/at:\s*\(item: T\) => Date/)
  })

  it('وسبعةُ أعمدةٍ تبقى على الهاتف — تقويمٌ بعمودٍ قائمةٌ بثوبِ تقويم', () => {
    expect(code('src/components/MonthCalendar.tsx')).toMatch(/grid-cols-7/)
  })
})
