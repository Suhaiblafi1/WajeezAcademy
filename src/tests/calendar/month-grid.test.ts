/* شبكةُ الشهر (ع-٣ · ك-١١).

   شكوى ١٣ سبتمبر ٢٠٢٦: «جدولي» قائمةٌ مبعثرةٌ لا تقويم. وحسابُ الشهر موضعُ
   أخطاءِ الفواصل كلِّها — أوّلُ الشهر في أيّ عمود، وكم أسبوعا يلزم، وما
   يُعرض من الشهر المجاور. وخطأٌ بيومٍ واحدٍ يضع جلسةً في خانةِ غيرها، ولا
   يُكتشف إلّا حين يحضر أحدٌ في اليوم الخطأ. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { WEEKDAYS_AR, monthGrid, nextItem, shiftMonth } from '@/application/calendar/month-grid'

const at = (s: { d: string }) => new Date(s.d)
const S = (d: string) => ({ d })
/** تاريخٌ محلّيٌّ بلا منطقةٍ — كما يقرؤه المتصفّح */
const local = (y: number, m: number, day: number, h = 12) => new Date(y, m, day, h)

describe('بنيةُ الشبكة', () => {
  it('⚠️ الأسبوعُ يبدأ الأحد — وهو ترتيبُ أيّام المنصّة منذ كُتبت', () => {
    expect(WEEKDAYS_AR[0]).toBe('الأحد')
    expect(WEEKDAYS_AR).toHaveLength(7)
    /* سبتمبر ٢٠٢٦ يبدأ يومَ الثلاثاء: فأوّلُ صفٍّ يبدأ بالأحد ٣٠ أغسطس */
    const g = monthGrid(2026, 8, [], at, local(2026, 8, 14))
    expect(g[0][0].date.getDay(), 'أوّلُ خانةٍ ليست أحدا').toBe(0)
    expect(g[0][0].date.getMonth(), 'أوّلُ خانةٍ ليست من الشهر السابق').toBe(7)
    expect(g[0][2].date.getDate(), 'الأوّلُ من سبتمبر ليس في عمود الثلاثاء').toBe(1)
  })

  it('⚠️ وكلُّ صفٍّ سبعُ خانات، وكلُّ خانةٍ يومٌ متتابع', () => {
    const g = monthGrid(2026, 8, [], at, local(2026, 8, 14))
    for (const row of g) expect(row).toHaveLength(7)
    const flat = g.flat()
    for (let i = 1; i < flat.length; i += 1) {
      const gap = (flat[i].date.getTime() - flat[i - 1].date.getTime()) / 86_400_000
      expect(Math.round(gap), `قفزةٌ بين ${flat[i - 1].date} و${flat[i].date}`).toBe(1)
    }
  })

  it('⚠️ والأسابيعُ بقَدرِ الشهر لا ستّةٌ دائما — فلا صفٌّ فارغٌ يكذب', () => {
    /* فبراير ٢٠٢٦: ٢٨ يوما يبدأ الأحد — أربعةُ أسابيعَ تماما، لا ستّة. */
    expect(monthGrid(2026, 1, [], at, local(2026, 1, 10))).toHaveLength(4)
    /* وأغسطس ٢٠٢٦: ٣١ يوما يبدأ السبت — يحتاج ستّة */
    expect(monthGrid(2026, 7, [], at, local(2026, 7, 10))).toHaveLength(6)
  })

  it('⚠️ وما ليس من الشهر يُعلَّم — فلا يُحسب يومٌ مرّتين', () => {
    const g = monthGrid(2026, 8, [], at, local(2026, 8, 14))
    const inMonth = g.flat().filter((c) => c.inMonth)
    expect(inMonth, 'عددُ أيّام سبتمبر ليس ثلاثين').toHaveLength(30)
    expect(g[0][0].inMonth, '٣٠ أغسطس عُدّ من سبتمبر').toBe(false)
  })

  it('واليومُ الجاري يُعلَّم مرّةً واحدةً لا أكثر', () => {
    const g = monthGrid(2026, 8, [], at, local(2026, 8, 14))
    expect(g.flat().filter((c) => c.isToday)).toHaveLength(1)
    expect(g.flat().find((c) => c.isToday)!.date.getDate()).toBe(14)
  })
})

describe('وقوعُ العناصر في خاناتها', () => {
  it('كلُّ جلسةٍ في يومها', () => {
    const g = monthGrid(2026, 8, [{ d: new Date(2026, 8, 14, 22, 30).toISOString() }], at, local(2026, 8, 1))
    expect(g.flat().find((c) => c.items.length > 0)!.date.getDate()).toBe(14)
  })

  /* ═══ ولماذا هذا الحارسُ بنيويٌّ لا سلوكيّ ═══

     جلسةُ العاشرة مساءً بتوقيت عمّان تقع في اليوم التالي بـUTC: من حسبها
     هناك وضعها في خانة الغد فيحضر المتعلّمُ يوما متأخّرا. وهو أخطرُ عطبٍ
     في تقويم.

     لكنّ الحاويةَ تعمل بـUTC، فـ«المحلّيّ» و«UTC» فيها شيءٌ واحد: كُتب فحصٌ
     سلوكيٌّ أوّلا، ثمّ بُدّلت الدالّةُ إلى `getUTC*` فمرّ أخضرَ — حارسٌ
     زينةٌ بنصِّ دفتر العمل. فصار الفحصُ على **الدالّة المستعملة**: هي التي
     تنكسر حين يُبدَّل الحساب، في أيّ منطقةٍ كانت الحاوية. */
  it('⚠️ والمفتاحُ يُشتقّ بالتوقيت المحلّيّ — لا بـUTC', () => {
    const src = readFileSync(join(process.cwd(), 'src/application/calendar/month-grid.ts'), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
    expect(src, 'الحسابُ انتقل إلى UTC فتنزلق الجلساتُ المسائيّة').not.toMatch(/getUTC(FullYear|Month|Date|Day)/)
    expect(src, 'مفتاحُ اليوم لا يُشتقّ من التاريخ المحلّيّ').toMatch(/\$\{d\.getFullYear\(\)\}-\$\{d\.getMonth\(\)\}-\$\{d\.getDate\(\)\}/)
  })

  it('وما في اليوم الواحد مرتَّبٌ بالوقت', () => {
    const items = [
      { d: new Date(2026, 8, 14, 18).toISOString() },
      { d: new Date(2026, 8, 14, 9).toISOString() },
      { d: new Date(2026, 8, 14, 13).toISOString() },
    ]
    const cell = monthGrid(2026, 8, items, at, local(2026, 8, 1)).flat().find((c) => c.items.length)!
    expect(cell.items.map((x) => new Date(x.d).getHours())).toEqual([9, 13, 18])
  })

  /* وتاريخٌ مشوّهٌ: يسقط من الشبكة بفحصٍ أو بلا فحص — مفتاحُه
     `NaN-NaN-NaN` لا تنظر إليه خانة. فلا يُكتب له حارسٌ سلوكيٌّ لا يسقط
     حين يُنزع ما يُفترض أنّه يحرسه؛ والسطرُ في الوحدة يبقى دفاعا صريحا
     يُقرأ، لا حارسا يُدّعى. وهذا يُثبَت لا يُفترض: */
  it('تاريخٌ مشوّهٌ يسقط من الشبكة ولا يُسقط السليمَ معه', () => {
    const g = monthGrid(2026, 8, [S('ليس تاريخا'), { d: new Date(2026, 8, 14).toISOString() }], at, local(2026, 8, 1))
    expect(g.flat().reduce((n, c) => n + c.items.length, 0)).toBe(1)
  })

  it('وجلسةٌ من شهرٍ آخرَ لا تظهر إلّا في خانات الحوافّ', () => {
    const g = monthGrid(2026, 8, [{ d: new Date(2026, 9, 20).toISOString() }], at, local(2026, 8, 1))
    expect(g.flat().reduce((n, c) => n + c.items.length, 0), '٢٠ أكتوبر ظهر في شبكة سبتمبر').toBe(0)
  })
})

describe('الجلسةُ القادمة', () => {
  it('⚠️ ما مضى ليس قادما ولو بدقيقة', () => {
    const now = local(2026, 8, 14, 12)
    const past = { d: new Date(2026, 8, 14, 11, 59).toISOString() }
    const soon = { d: new Date(2026, 8, 14, 12, 1).toISOString() }
    expect(nextItem([past, soon], at, now)).toBe(soon)
    expect(nextItem([past], at, now), 'ما مضى عُدّ قادما').toBeNull()
  })

  it('وأقربُ القادم لا أوّلُ المصفوفة', () => {
    const now = local(2026, 8, 14, 12)
    const far = { d: new Date(2026, 9, 1).toISOString() }
    const near = { d: new Date(2026, 8, 20).toISOString() }
    expect(nextItem([far, near], at, now)).toBe(near)
  })

  it('وبلا شيءٍ قادمٍ يُقال ذلك صراحةً', () => {
    expect(nextItem([], at, local(2026, 8, 14))).toBeNull()
  })
})

describe('التنقّلُ بالأشهر', () => {
  it('⚠️ ويعبر رأسَ السنة في الاتّجاهين', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 })
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 })
  })

  it('وقفزةٌ أبعدُ من سنةٍ تبقى صحيحة', () => {
    expect(shiftMonth(2026, 5, 14)).toEqual({ year: 2027, month: 7 })
  })
})
