/* حرّاسُ ترتيبِ المحاور ومعرّفاتِها.

   أهمُّها الأوّل: **المعرّفُ لا يُشتقّ من الموضع**. وهو العطبُ الذي كان
   كامنا ما دام لا حذفَ — ويستيقظ بأوّل حذف. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { nextTrainerModuleId, moveModule, isCatalogModule } from '@/application/trainer/plan-modules'

const C = 'C-EDT-101'
const mods = (...ids: string[]) => ids.map((moduleId) => ({ moduleId }))

describe('معرّفُ محورٍ يضيفه المدرّب', () => {
  it('يبدأ من واحدٍ حين لا محورَ له في الخطّة', () => {
    expect(nextTrainerModuleId(C, [])).toBe('C-EDT-101-T1')
    /* محاورُ الكتالوج لا تصدّر تسلسلَه */
    expect(nextTrainerModuleId(C, mods('C-EDT-101-M1', 'C-EDT-101-M2'))).toBe('C-EDT-101-T1')
  })

  it('ولا يعيد رقما حُذف — وهذا العطبُ الذي يستيقظ بأوّل حذف', () => {
    /* [T1, T2, T3] حُذف منها T2 */
    const after = mods('C-EDT-101-T1', 'C-EDT-101-T3')
    /* الاشتقاقُ من الطول يعطي T3 وهو قائم؛ والاشتقاقُ من الأكبر يعطي T4 */
    expect(nextTrainerModuleId(C, after)).toBe('C-EDT-101-T4')
  })

  it('ولا يصطدم بمعرّفٍ قائمٍ مهما كان ترتيبُ القائمة', () => {
    const list = mods('C-EDT-101-T7', 'C-EDT-101-M1', 'C-EDT-101-T2')
    const next = nextTrainerModuleId(C, list)
    expect(list.map((m) => m.moduleId)).not.toContain(next)
    expect(next).toBe('C-EDT-101-T8')
  })

  it('وإضافةٌ وحذفٌ متعاقبان لا يُخرجان معرّفا مكرّرا أبدا', () => {
    /* الإضافةُ وحدَها لا تكشف شيئا: بلا حذفٍ يعطي الاشتقاقُ من الطول
       معرّفاتٍ متمايزةً أيضا. فالحذفُ في أثناء الدورة هو المحكّ. */
    let list = mods('C-EDT-101-M1')
    const everGiven = new Set<string>()
    for (let i = 0; i < 10; i += 1) {
      const id = nextTrainerModuleId(C, list)
      expect(everGiven.has(id), `تكرّر المعرّف ${id} في الجولة ${i}`).toBe(false)
      everGiven.add(id)
      list = [...list, { moduleId: id }]
      /* يُحذف محورٌ من الوسط كلَّ جولتين — فيقصر الطولُ ويبقى الأكبرُ كما هو */
      if (i % 2 === 1 && list.length > 2) list = list.filter((_, j) => j !== 1)
    }
    expect(everGiven.size).toBe(10)
  })

  it('ومعرّفُ الدورة يُهرَّب فلا يُقرأ رموزا نمطيّة', () => {
    /* دورةٌ في معرّفها نقطة: بلا هربٍ تطابق النقطةُ أيَّ حرف، فيُقرأ
       `C.EDT-T9` تسلسلا لدورةٍ أخرى ويُقفز الرقمُ بلا سبب. */
    expect(nextTrainerModuleId('C.EDT', mods('CxEDT-T9'))).toBe('C.EDT-T1')
  })
})

describe('نقلُ المحور خطوةً', () => {
  it('يرفع المحورَ فوق ما قبله ويُنزله تحت ما بعده', () => {
    const list = mods('a', 'b', 'c')
    expect(moveModule(list, 1, -1).map((m) => m.moduleId)).toEqual(['b', 'a', 'c'])
    expect(moveModule(list, 1, 1).map((m) => m.moduleId)).toEqual(['a', 'c', 'b'])
  })

  it('والطرفان يثبتان — لا فوقَ الأوّلِ ولا تحتَ الآخر', () => {
    const list = mods('a', 'b', 'c')
    expect(moveModule(list, 0, -1).map((m) => m.moduleId)).toEqual(['a', 'b', 'c'])
    expect(moveModule(list, 2, 1).map((m) => m.moduleId)).toEqual(['a', 'b', 'c'])
  })

  it('ولا يُسقط محورا ولا يكرّره — العددُ والمجموعةُ كما كانا', () => {
    const list = mods('a', 'b', 'c', 'd')
    for (const [i, d] of [[0, 1], [1, -1], [3, -1], [2, 1]] as [number, -1 | 1][]) {
      const out = moveModule(list, i, d)
      expect(out).toHaveLength(list.length)
      expect(new Set(out.map((m) => m.moduleId))).toEqual(new Set(list.map((m) => m.moduleId)))
    }
  })

  it('ولا يمسّ القائمةَ الأصليّة — النقلُ يعيد نسخة', () => {
    const list = mods('a', 'b')
    const out = moveModule(list, 0, 1)
    expect(list.map((m) => m.moduleId)).toEqual(['a', 'b'])
    expect(out).not.toBe(list)
  })

  it('وموضعٌ خارج القائمة يُعيدها كما هي لا يرميها', () => {
    const list = mods('a', 'b')
    expect(moveModule(list, 5, -1).map((m) => m.moduleId)).toEqual(['a', 'b'])
    expect(moveModule(list, -1, 1).map((m) => m.moduleId)).toEqual(['a', 'b'])
  })
})

describe('«أمِنَ الكتالوجِ هذا المحور؟»', () => {
  it('بالعضويّةِ في محاور الدورة لا بشكلِ المعرّف', () => {
    const base = mods('C-EDT-101-M1', 'C-EDT-101-M2')
    expect(isCatalogModule('C-EDT-101-M1', base)).toBe(true)
    expect(isCatalogModule('C-EDT-101-T1', base)).toBe(false)
    /* معرّفٌ بحرف الكتالوج وليس في محاوره — فليس منه */
    expect(isCatalogModule('C-EDT-101-M9', base)).toBe(false)
  })
})

/* ── وصلُ المنطقِ بالشاشة والخادم ──

   الدوالُّ أعلاه صحيحةٌ وحدَها، ولا تنفع إن لم تُنادَ. وهذه تتحقّق أنّ
   الشاشةَ تناديها فعلا، وأنّ الاشتقاقَ من الطول **زال** لا أنّه تُرك
   بجانبها. */

const src = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

const WS = 'src/pages/trainer/CohortWorkspace.tsx'
const ROUTES = 'server/http/routes/learning-portal.routes.ts'

describe('الشاشةُ تنادي المنطقَ ولا تعيد اشتقاقَه', () => {
  it('«+ محور» يأخذ معرّفَه من الدالّة، والاشتقاقُ من الطول زال', () => {
    const ws = src(WS)
    expect(ws).toContain('nextTrainerModuleId(ws.course.id, content.modules)')
    /* العطبُ الأصليّ: `-T${content.modules.length + 1}` — وجودُه يعني أنّه
       تُرك في مكانٍ ما ولو أُضيفت الدالّةُ بجانبه. */
    expect(ws, 'الاشتقاقُ من الطول ما زال في الشاشة').not.toMatch(/-T\$\{[^}]*\.length/)
  })

  it('والنقلُ خطوةً واحدةً في الاتّجاهين، ومعطَّلٌ عند الطرف', () => {
    const ws = src(WS)
    expect(ws).toContain('moveModule(content.modules, i, -1)')
    expect(ws).toContain('moveModule(content.modules, i, 1)')
    /* ولا يُترك الزرُّ يعمل عند الطرف فيبدو مكسورا */
    expect(ws).toMatch(/disabled=\{locked \|\| i === 0\}/)
    expect(ws).toMatch(/disabled=\{locked \|\| i === content\.modules\.length - 1\}/)
  })

  it('والحذفُ يمرّ بالاستئذان لا بنقرةٍ تُسقط المحور', () => {
    const ws = src(WS)
    const btn = ws.slice(ws.indexOf('احذف «'), ws.indexOf('احذف «') + 400)
    expect(btn, 'زرُّ الحذف يعدّل المحاورَ مباشرةً').toContain('setPendingModule(')
    /* والاستئذانُ هو الذي يُسقطه */
    expect(ws).toMatch(/modules: content\.modules\.filter\(\(_, j\) => j !== pendingModule\.index\)/)
  })

  it('ومحورُ الكتالوج يُقال إنّه يبقى في الدورة', () => {
    expect(src(WS)).toContain('isCatalogModule(pendingModule.module.moduleId, ws.course.baseModules)')
  })
})

describe('الخادمُ يردّ المعرّفَ المكرّر', () => {
  it('فحصُ التفرّد على مصفوفة المحاور في مخطّط الخطّة', () => {
    const routes = src(ROUTES)
    const block = routes.slice(routes.indexOf('const planContent = z.object({'), routes.indexOf('app.get(\'/api/trainer/cohorts/:id/workspace\''))
    expect(block, 'لا فحصَ تفرّدٍ على معرّفات المحاور').toContain('superRefine')
    expect(block).toMatch(/new Set<string>\(\)/)
    expect(block, 'الفحصُ لا يشير إلى المعرّف المكرّر').toMatch(/seen\.has\(m\.moduleId\)/)
  })
})
