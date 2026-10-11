/* صفحةُ المصادر قائمةٌ مضغوطةٌ مجمّعةٌ بالمحور، ومنطقةُ رفعٍ واحدةٌ لعدّة ملفّات —
   ملفُّ صاحب المنصّة «تحسينات بوابة مدرّب وجيز» (١١ أكتوبر ٢٠٢٦).

   المحضُ يُفحص بقيمه، والشاشةُ على بنيتها (التعليقاتُ تُنزع قبل الفحص). */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  groupResources, isResourceUrl, resourceBadge, rowFromFile, rowFromUrl, titleFromFileName, titleFromUrl,
} from '@/application/trainer/resource-list'
import { resourceHasSource } from '@/application/trainer/module-body'
import { PLAN_TITLE_MIN } from '@/application/trainer/plan-limits'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const LIST = code('src/pages/trainer/PlanResources.tsx')

const modules = [{ moduleId: 'M1', titleAr: 'مقدّمة' }, { moduleId: 'M2', titleAr: 'قوة الصوت والتنفس' }]

describe('التجميعُ بالمحور', () => {
  it('للشعبة كلّها أوّلا، ثمّ بترتيب المحاور، ثمّ المربوطُ بمحورٍ حُذف — والمسجَّلُ خارجها', () => {
    const g = groupResources([
      { title: 'دليل التمارين', moduleId: 'M2', category: 'reading' },
      { title: 'كراسة المتحدث', moduleId: null, category: 'reading' },
      { title: 'جلسة', moduleId: 'M1', category: 'recorded' },
      { title: 'قديم', moduleId: 'M9', category: 'public' },
    ], modules)
    expect(g.map((x) => x.labelAr)).toEqual(['للشعبة كلّها', 'المحور 2 · قوة الصوت والتنفس', 'مربوطٌ بمحورٍ حُذف — اختر له محورا'])
    /* والموضعُ في مصفوفة الخطّة الواحدة يُحمل — عليه يقع التعديلُ والحذف */
    expect(g.map((x) => x.rows.map((r) => r.i))).toEqual([[1], [0], [3]])
  })

  it('ولا مجموعةَ فارغة', () => {
    expect(groupResources([], modules)).toEqual([])
  })
})

describe('الصفُّ الجديدُ كاملٌ من لحظته — فلا يمنع صفٌّ ناقصٌ حفظَ الخطّة', () => {
  it('من ملفّ: اسمُه بلا امتداد، وصنفُه «كتبٌ وملفّات» ونوعُه ملفّ', () => {
    const r = rowFromFile({ key: 'k1', name: 'kurrasat_al-mutahaddith.pdf', mime: 'application/pdf' })
    expect(r.title).toBe('kurrasat al mutahaddith')
    expect(r).toMatchObject({ category: 'reading', kind: 'file', bodyFileKey: 'k1', moduleId: null })
    expect(resourceHasSource(r)).toBe(true)
  })

  it('من رابط: نطاقُه وأوّلُ مساره، وصنفُه عامّ', () => {
    const r = rowFromUrl(' https://www.youtube.com/watch?v=1 ')
    expect(r).toMatchObject({ title: 'youtube.com/watch', url: 'https://www.youtube.com/watch?v=1', category: 'public', kind: 'link' })
    expect(resourceHasSource(r)).toBe(true)
  })

  it('والاسمُ لا يقصر عن حدّ الخطّة', () => {
    expect(titleFromFileName('a.pdf').length).toBeGreaterThanOrEqual(PLAN_TITLE_MIN)
    expect(titleFromUrl('https://x.io').length).toBeGreaterThanOrEqual(PLAN_TITLE_MIN)
  })

  it('والرابطُ رابطٌ بنطاق — لا نصٌّ يُلصق خطأً', () => {
    expect(isResourceUrl('https://example.com/a')).toBe(true)
    expect(isResourceUrl('example.com')).toBe(false)
    expect(isResourceUrl('javascript:alert(1)')).toBe(false)
    expect(isResourceUrl('https://localhost')).toBe(false)
  })

  it('وشارةُ النوع من الملفّ لا من الاسم', () => {
    expect(resourceBadge({ title: 'x', bodyFileKey: 'k', bodyFileMime: 'application/pdf' })).toBe('PDF')
    expect(resourceBadge({ title: 'x', bodyFileKey: 'k', bodyFileMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe('DOC')
    expect(resourceBadge({ title: 'x', url: 'https://a.b' })).toBe('رابط')
  })
})

describe('الشاشة', () => {
  it('خانةٌ واحدةٌ تقبل الإفلاتَ وعدّةَ ملفّات واللصق — بلا «ارفع ملفّا / أضِف رابطا» قبلها', () => {
    expect(LIST).toContain('onDrop={onDrop}')
    expect(LIST).toMatch(/type="file" multiple/)
    expect(LIST).toContain('onPaste=')
    expect(LIST).not.toContain('أضِف رابطَ كتاب')
  })

  it('والرفعُ تباعا، والصفُّ يُضاف بعد أن يُرفع ملفُّه — لا قبله', () => {
    expect(LIST).toMatch(/for \(const f of files\) await uploadOne\(f\);/)
    const one = LIST.slice(LIST.indexOf('const uploadOne'), LIST.indexOf('const uploadAll'))
    expect(one.indexOf('if (!put.ok)')).toBeLessThan(one.indexOf('onAdd(rowFromFile('))
  })

  it('وزرُّ حذفٍ واحدٌ بأيقونة — لا «احذفه» و«أزل» معا', () => {
    expect(LIST).toMatch(/icon=\{Trash2\} disabled=\{locked\} aria-label=\{`احذف «\$\{name\}»`\}/)
    expect(LIST).not.toMatch(/>أزل<|>احذفه</)
    expect(LIST, 'عادت جملةُ الأنواع تحت كلّ ملفّ').not.toContain('ModuleBodyUpload')
  })
})

describe('ولا يُحال المدرّبُ إلى زرٍّ ذهب', () => {
  it('⚠️ «أضف» و«أزل» ذهبا من المصادر — فلا يسمّيهما ما يقال له', () => {
    const WS = code('src/pages/trainer/CohortWorkspace.tsx')
    expect(WS).not.toContain('من «أضف»')
    expect(WS).not.toMatch(/أزِله (?:من|وأضِفه)/)
    expect(LIST).toContain('أفلِت الملفّاتِ هنا، أو الصق رابطا')
  })
})
