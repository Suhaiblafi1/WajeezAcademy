/* الأفعالُ الجماعيّة: ما يصلح للمحدَّد كلِّه، وتحديدُ «الكلّ» على درجتين.

   ═══ ما طُلب (٢١ سبتمبر ٢٠٢٦) ═══

   «أريد أن نضع خيارَ تذكيرِ جميعِ من بدؤوا بمسوّدةٍ أن يكملوا الطلبَ، وأيضا
   أريد أن أختارَ الكلَّ وأقومَ بأكشن لهم كلِّهم حسب حالتهم إذا كانوا نفسَ
   الفئة».

   ═══ وما يُحرَس ═══

   ① **لا فعلَ على محدَّدٍ فارغ** — و`every` على فراغٍ صادقةٌ في جافاسكربت،
      فالفخُّ هنا لا في الحالات.
   ② **ولا فعلَ إلّا إن صلح للمحدَّد كلِّه** — «نفسُ الفئة» بعينها.
   ③ **وتذكيرُ المسوّدة يُجمَّع** — وهو ما لم يكن.
   ④ **والتذكيران لا يجتمعان** — «مسودة» لا يُحجَز فيها موعد.
   ⑤ **و«الكلُّ» درجتان** — صفحةٌ تُنقَر، وكلٌّ مطابِقٌ يُعرض بعدده.
   ⑥ **والشاشةُ تقرأ هذه الأحكامَ ولا تكتبها ثانية.** */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  bulkDecisionsFor, bulkRemindersFor, fitsAll, pageSelection, togglePage, unselectedMatching,
} from '@/application/trainer/bulk'
import { BULK_ACTIONS, DECISIONS } from '@/application/trainer/decisions'
import { BOOKABLE_STATUSES } from '@/application/trainer/application-options'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const SCREEN = 'src/pages/admin/TrainerApplications.tsx'

/** صفُّ طابورٍ مختصَرٌ إلى ما يُحكَم به */
const row = (status: string, interviewsCount = 0) => ({ status, interviewsCount })

describe('① المحدَّدُ الفارغُ لا يصلح لشيء', () => {
  it('`fitsAll` على فراغٍ كاذبة — و`every` وحدَها تقول صادقة', () => {
    expect([].every(() => false), 'تغيّرت جافاسكربت — فبطل سببُ هذا الحارس').toBe(true)
    expect(fitsAll([], () => true), 'فعلٌ عُرض على لا أحد').toBe(false)
  })

  it('فلا قرارَ ولا تذكيرَ يُعرض قبل أن يُحدَّد شيء', () => {
    expect(bulkDecisionsFor([], DECISIONS)).toEqual([])
    expect(bulkRemindersFor([])).toEqual([])
  })
})

describe('② ولا يُعرض إلّا ما يصلح للمحدَّد كلِّه', () => {
  it('المتّحدون في الحالة: تُعرض قراراتُهم', () => {
    const actions = bulkDecisionsFor([row('submitted'), row('submitted')], DECISIONS)
    expect(actions.length, 'لا قرارَ لمن اتّحدت حالُهم').toBeGreaterThan(0)
    for (const d of actions) expect(d.from).toContain('submitted')
  })

  it('وصفٌّ واحدٌ يخالف يُسقط الفعلَ عن الجميع — لا إخفاقَ جزئيّ', () => {
    const alone = bulkDecisionsFor([row('submitted')], DECISIONS).map((d) => d.action)
    expect(alone.length, 'تعطّل الفحص: لا قرارَ أصلا').toBeGreaterThan(0)
    const mixed = bulkDecisionsFor([row('submitted'), row('rejected')], DECISIONS).map((d) => d.action)
    for (const a of mixed) {
      expect(alone, `«${a}» عُرض على خليطٍ لا يصلح له`).toContain(a)
      expect(DECISIONS.find((d) => d.action === a)!.from).toContain('rejected')
    }
  })

  it('ولا يُعرض جماعيّا إلّا ما أُذن فيه — والمقابلةُ والعقدُ قرارٌ فرديّ', () => {
    for (const d of bulkDecisionsFor([row('submitted'), row('submitted')], DECISIONS)) {
      expect(BULK_ACTIONS, `«${d.action}» خرج إلى الجماعيّ بلا إذن`).toContain(d.action)
    }
  })
})

describe('③ وتذكيرُ المسوّدة يُجمَّع', () => {
  it('كلُّهم مسوّدة: يُعرض «أكمِلْ» ومسارُه مسارُ الخادم', () => {
    const rs = bulkRemindersFor([row('draft'), row('draft'), row('draft')])
    expect(rs.map((r) => r.key), 'تذكيرُ الإكمال لا يُجمَّع — وهو المطلوب').toEqual(['draft'])
    expect(rs[0].path, 'المسارُ غيرُ مسار الخادم').toBe('draft-reminder')
  })

  it('وواحدٌ ليس مسوّدةً يُسقطه — فلا يُقال لمن أكمل «أكمِلْ»', () => {
    expect(bulkRemindersFor([row('draft'), row('submitted')]).map((r) => r.key))
      .not.toContain('draft')
  })
})

describe('④ والتذكيران لا يجتمعان', () => {
  it('«مسودة» ليست ممّا يُحجَز فيه موعد — فالشرطان متنافيان بنيةً', () => {
    expect(BOOKABLE_STATUSES, 'صارت المسوّدةُ تُحجَز — فيجتمع التذكيران').not.toContain('draft')
  })

  it('ولا يُعرض أكثرُ من تذكيرٍ واحدٍ لأيّ محدَّدٍ متّحد', () => {
    for (const st of ['draft', ...BOOKABLE_STATUSES]) {
      const rs = bulkRemindersFor([row(st), row(st)])
      expect(rs.length, `«${st}» عُرض له تذكيران`).toBeLessThanOrEqual(1)
    }
  })

  it('ومن حجز موعدَه لا يُذكَّر بما فعل', () => {
    const booked = BOOKABLE_STATUSES[0]
    expect(bulkRemindersFor([row(booked, 1), row(booked, 1)])).toEqual([])
  })
})

describe('⑤ و«الكلُّ» درجتان لا درجة', () => {
  const page = ['a', 'b', 'c']

  it('حالُ المربّع ثلاثةٌ — و«بعضُه» ليست «كلَّه»', () => {
    expect(pageSelection(page, new Set())).toBe('none')
    expect(pageSelection(page, new Set(['a']))).toBe('some')
    expect(pageSelection(page, new Set(page))).toBe('all')
  })

  it('وصفحةٌ فارغةٌ ليست «كلَّه» — وإلّا عُرض مربّعٌ مؤشَّرٌ على لا شيء', () => {
    expect(pageSelection([], new Set())).toBe('none')
  })

  it('وضمُّ الصفحة ورفعُها لا يمسّان ما خارجها', () => {
    const outside = new Set(['z'])
    const on = togglePage(outside, page, true)
    expect([...on].sort()).toEqual(['a', 'b', 'c', 'z'])
    const off = togglePage(on, page, false)
    expect([...off]).toEqual(['z'])
  })

  it('ولا يُعرض «حدّد الكلَّ» ولا شيءَ وراء المحدَّد', () => {
    const all = ['a', 'b', 'c', 'd']
    expect(unselectedMatching(all, new Set(page)), 'وراء الصفحة واحد').toBe(1)
    expect(unselectedMatching(all, new Set(all)), 'عُرض العرضُ وقد حُدّد الكلّ').toBe(0)
    expect(unselectedMatching(page, new Set(page))).toBe(0)
  })
})

describe('⑥ والشاشةُ تقرأ الأحكامَ ولا تكتبها ثانية', () => {
  const screen = code(SCREEN)

  it('القراراتُ والتذكيراتُ من الوحدة — لا `every` مكتوبةٌ في الشاشة', () => {
    expect(screen, 'القراراتُ تُرشَّح بيد الشاشة').toContain('bulkDecisionsFor(selectedRows, DECISIONS)')
    expect(screen, 'التذكيراتُ تُرشَّح بيد الشاشة').toContain('bulkRemindersFor(selectedRows)')
    expect(screen, 'عاد شرطُ «الفئة الواحدة» مكتوبا في الشاشة')
      .not.toMatch(/selectedRows\.every\(/)
  })

  it('والمطابِقُ يُرشَّح مرّةً — فلا يُحدَّد «الكلُّ» غيرَ ما يُعرض', () => {
    expect(screen, 'المطابِقُ لا يُسمّى').toMatch(/const matching = sortApplications\(/)
    expect(screen, 'الصفحةُ تُرقَّم من غير المطابِق').toMatch(/paginate\(\s*matching,/)
    expect(screen, '«حدّد الكلَّ» يقرأ قائمةً ثانية').toContain('setSel(new Set(matching.map((a) => a.id)))')
  })

  it('ومربّعُ الترويسة للصفحة وحدَها — لا للمطابِق كلِّه', () => {
    expect(screen, 'مربّعُ الصفحة يحدّد ما لا يُرى')
      .toContain('setSel(togglePage(sel, pageIds, pageSel !== "all"))')
    expect(screen, 'مفاتيحُ الصفحة من غير الصفحة').toContain('const pageIds = view.rows.map((a) => a.id)')
  })

  it('وكلُّ تذكيرٍ يُصيَّر بمساره — فلا مسارٌ مكتوبٌ بيد الشاشة', () => {
    expect(screen, 'النداءُ لا يُبنى من مسار الوحدة')
      .toContain('`/api/admin/trainer-applications/${id}/${path}`')
    /* والنداءُ في صفٍّ واحدٍ يبقى بمساره الصريح — هو فعلٌ فرديٌّ لا جماعيّ.
       فالمحروسُ أنّ **الشريط** يناديه بما تردّه الوحدةُ لا بما يُكتب هنا. */
    expect(screen, 'الشريطُ ينادي تذكيرا بمسارٍ مكتوبٍ بيده')
      .toContain('void bulkRemind(r.path, r.doneAr)')
    expect(screen, 'عاد تذكيرٌ جماعيٌّ مكتوبٌ بيده خارجَ قائمة الوحدة')
      .not.toMatch(/bulkRemind\((["'`])/)
  })
})
