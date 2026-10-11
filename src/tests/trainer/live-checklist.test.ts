/* الحفظُ التلقائيّ وقائمةُ الفحص الحيّة وعددُ النواقص على الخطوات — ملفُّ صاحب
   المنصّة «تحسينات بوابة مدرّب وجيز» (١١ أكتوبر ٢٠٢٦).

   مؤشّرُ الحفظ محضٌ يُفحص بقيمه. والشاشةُ تُفحص على بنيتها (التعليقاتُ تُنزع قبل
   الفحص): النواقصُ هي ما يقوله «التالي» حين لا ينقل (`gapsFor`) لا عدٌّ ثانٍ
   يفترق عنه، واللوحةُ تُرسم على الشاشة العريضة وفوق المتن على الهاتف. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { autosaveLineAr, autosaveView, savedAgoAr } from '@/application/trainer/autosave'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const WS = code('src/pages/trainer/CohortWorkspace.tsx')

describe('مؤشّرُ الحفظ — يقول حالَه بكلمات', () => {
  it('«قبل ثوانٍ» ثمّ بالدقائق', () => {
    expect(savedAgoAr(3_000)).toBe('قبل ثوانٍ')
    expect(savedAgoAr(60_000)).toBe('قبل دقيقة')
    expect(savedAgoAr(120_000)).toBe('قبل دقيقتين')
    expect(savedAgoAr(5 * 60_000)).toBe('قبل 5 دقائق')
    expect(savedAgoAr(30 * 60_000)).toBe('قبل 30 دقيقة')
    expect(savedAgoAr(2 * 3600_000)).toBe('قبل أكثر من ساعة')
  })

  it('الجاري أوّلا، ثمّ ما يمنع، ثمّ ما سقط، ثمّ ما ينتظر', () => {
    const base = { saving: false, dirty: true, problem: null, failed: null, savedAt: null }
    expect(autosaveView({ ...base, saving: true, problem: 'x' }).kind).toBe('saving')
    expect(autosaveView({ ...base, problem: 'المحور 2 بلا عنوان', failed: 'y' })).toEqual({ kind: 'blocked', reason: 'المحور 2 بلا عنوان' })
    expect(autosaveView({ ...base, failed: 'تعذّر الاتّصال' }).kind).toBe('failed')
    expect(autosaveView(base).kind).toBe('pending')
    expect(autosaveView({ ...base, dirty: false, savedAt: 5 })).toEqual({ kind: 'saved', at: 5 })
    expect(autosaveView({ ...base, dirty: false })).toEqual({ kind: 'idle' })
  })

  it('والسطرُ بجملته — ولا شيءَ يُقال قبل أيّ تعديل', () => {
    expect(autosaveLineAr({ kind: 'saved', at: 1_000 }, 4_000)).toBe('حُفظ قبل ثوانٍ')
    expect(autosaveLineAr({ kind: 'blocked', reason: 'اسمُ الشعبة ثلاثةُ أحرفٍ فأكثر' }, 0)).toBe('لم يُحفظ — اسمُ الشعبة ثلاثةُ أحرفٍ فأكثر')
    expect(autosaveLineAr({ kind: 'idle' }, 0)).toBeNull()
  })
})

describe('النواقصُ على الخطوات وفي القائمة الحيّة', () => {
  it('النواقصُ هي ما يقوله «التالي» — لا عدٌّ ثانٍ يفترق عنه', () => {
    expect(WS).toMatch(/const missingOf = \(k: Stage\): string\[\] => \(k === "approval" \|\| doneOf\(k\) \? \[\] : gapsFor\(k, ws\)\);/)
    /* و`gapsFor` يُعرَّف قبل أن يُنادى في الرسم — وإلّا سقطت الصفحةُ بخطإ «قبل التعريف» */
    expect(WS.indexOf('const gapsFor = ')).toBeLessThan(WS.indexOf('const missing = new Map('))
  })

  it('وعددُها تحت اسم كلّ خطوة — ومسموعٌ في اسمها', () => {
    const rail = WS.slice(WS.indexOf('<ol className="flex w-full'), WS.indexOf('</ol>', WS.indexOf('<ol className="flex w-full')))
    expect(rail).toContain('const lack = missing.get(s.key)?.length ?? 0;')
    expect(rail).toMatch(/\{lack\} ناقص/)
    expect(rail).toContain('${lack ? ` · ينقصها ${lack}` : ""}')
  })

  it('واللوحةُ الجانبيّةُ على الشاشة العريضة، وسطرٌ يُفتح على الهاتف — ما دامت الخطّةُ بيده', () => {
    expect(WS).toMatch(/<aside aria-label="ما بقي قبل الإرسال" className="sticky hidden lg:block"/)
    expect(WS).toMatch(/\{inHand && missingTotal > 0 && \(\s*<Inset as="details" className="mb-4 px-3 py-2 lg:hidden">/)
    expect((WS.match(/<LiveChecklist /g) ?? []).length).toBe(2)
    expect(WS).toContain('const inHand = planStatus === "draft" || planStatus === "changes_requested";')
  })
})
