/* صفحةُ كلّ محورٍ تُقترح من فهرس الكرّاسة — المحضُ (١١ أكتوبر ٢٠٢٦).
   والشاشةُ تُفحص على بنيتها: المكتبةُ تُحمَّل عند النقر وحدَه، وما كتبه بيده لا يُستبدل إلّا باختياره. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeAr, startsFromOutline, startsFromText, titleScore, wherePages } from '@/application/trainer/workbook-toc'

const mods = [
  { moduleId: 'M1', titleAr: 'من الاهتمام إلى سؤال قرار' },
  { moduleId: 'M2', titleAr: 'القيم والدوافع والسياق' },
  { moduleId: 'M3', titleAr: 'خطاب قصير' },
]

describe('المطابقة', () => {
  it('التشكيل والهمزات والتاء المربوطة لا تفرّق', () => {
    expect(normalizeAr('القيم والدّوافع')).toBe(normalizeAr('القيم والدوافع'))
    expect(normalizeAr('إلى سؤال قرار')).toBe('الي سوال قرار')
    expect(titleScore('القيم والدوافع والسياق', 'المحور الثاني: القيم والدوافع والسياق')).toBe(1)
    expect(titleScore('القيم والدوافع والسياق', 'مقدّمة')).toBe(0)
  })

  it('من الفهرس: أحسن عنوان لكلّ محور — والمقدّمة لا تحسب', () => {
    const s = startsFromOutline([
      { title: 'مقدّمة', page: 1 },
      { title: 'المحور الأول: من الاهتمام إلى سؤال القرار', page: 3 },
      { title: 'المحور الثاني: القيم والدوافع والسياق', page: 9 },
      { title: 'المحور الثالث: خطاب قصير', page: 15 },
    ], mods)
    expect(Object.fromEntries(s)).toEqual({ M1: 3, M2: 9, M3: 15 })
  })

  it('ولا يطابق شيء والعدد نفسه — فبالترتيب', () => {
    const s = startsFromOutline([{ title: 'Part 1', page: 2 }, { title: 'Part 2', page: 6 }, { title: 'Part 3', page: 11 }], mods)
    expect(Object.fromEntries(s)).toEqual({ M1: 2, M2: 6, M3: 11 })
    expect(startsFromOutline([{ title: 'Part 1', page: 2 }], mods).size).toBe(0)
  })

  it('من النصّ: صفحة المحتويات لا تعدّ بداية', () => {
    const pages = [
      'الغلاف',
      'المحتويات من الاهتمام إلى سؤال قرار ٣ القيم والدوافع والسياق ٥ خطاب قصير ٧',
      'من الاهتمام إلى سؤال قرار — نصّ',
      'تابع',
      'القيم والدوافع والسياق',
      'تابع',
      'خطاب قصير',
    ]
    expect(Object.fromEntries(startsFromText(pages, mods))).toEqual({ M1: 3, M2: 5, M3: 7 })
  })
})

describe('النصّ المحفوظ بترتيبه المرئيّ', () => {
  it('أشكال العرض حرفا حرفا ومقلوبة — كما يقرؤها pdf.js من ملفّ طبعه كروم', () => {
    /* نصُّ صفحاتٍ حقيقيٌّ من ملفٍّ طُبع للاختبار — حرفا حرفا بأشكال العرض، والترتيبُ مرئيّ */
    const pages = [
      'ف ﻼ ﻐ ﻟ ا',
      'ﻞ ﺻ ا ﻮ ﺘ ﻟ ا   ار ﺮ ﻗ و   ر ﻮ ﻬ ﻤ ﺠ ﻟ ا  ﺔ ﻟ ﺎ ﺳ ﺮ ﻟ ا   ﺔ ﻄ ﻳ ﺮ ﺧ و   ﺔ ﺴ ﻴ ﺋ ﺮ ﻟ ا   ة ﺮ ﻜ ﻔ ﻟ ا',
      'ﻞ ﺻ ا ﻮ ﺘ ﻟ ا   ار ﺮ ﻗ و   ر ﻮ ﻬ ﻤ ﺠ ﻟ ا  ﺺ ﻧ',
      'ﻊ ﺑ ﺎ ﺗ',
      'ﺔ ﻟ ﺎ ﺳ ﺮ ﻟ ا   ﺔ ﻄ ﻳ ﺮ ﺧ و   ﺔ ﺴ ﻴ ﺋ ﺮ ﻟ ا   ة ﺮ ﻜ ﻔ ﻟ ا  ﺺ ﻧ',
    ]
    const s = startsFromText(pages, [
      { moduleId: 'A', titleAr: 'الجمهور وقرار التواصل' }, { moduleId: 'B', titleAr: 'الفكرة الرئيسة وخريطة الرسالة' },
    ])
    expect(Object.fromEntries(s)).toEqual({ A: 3, B: 5 })
    /* وعنوانٌ يخلط اللاتينيّةَ بالعربيّة — كلٌّ باتّجاهه */
    const mixed = startsFromText(['غلاف', 'ﺮ ﻴ ﺼ ﻗ   ب ﺎ ﻄ ﺧ و   Message Map  ﺺ ﻧ'], [{ moduleId: 'D', titleAr: 'Message Map وخطاب قصير' }])
    expect(mixed.get('D')).toBe(2)
  })
})

describe('المدى', () => {
  it('حتّى الصفحة التي قبل ما يليه، والأخير حتّى آخر الملفّ', () => {
    const w = wherePages(new Map([['M2', 9], ['M1', 3], ['M3', 15]]), 20)
    expect(Object.fromEntries(w)).toEqual({ M1: 'ص 3–8', M2: 'ص 9–14', M3: 'ص 15–20' })
    expect(wherePages(new Map([['M1', 4], ['M2', 5]]), 5).get('M1')).toBe('ص 4')
  })
})

describe('الشاشة', () => {
  const WS = readFileSync(join(process.cwd(), 'src/pages/trainer/CohortWorkspace.tsx'), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
  const PDF = readFileSync(join(process.cwd(), 'src/application/trainer/workbook-pdf.ts'), 'utf8')

  it('المكتبة تحمّل عند النقر وحده — لا في حزمة الصفحة', () => {
    expect(PDF).toMatch(/await import\('pdfjs-dist'\)/)
    expect(PDF).not.toMatch(/^import [^\n]*from 'pdfjs-dist'/m)
    expect(WS).not.toMatch(/from ["']pdfjs-dist/)
  })

  it('⚠️ ما كتبه بيده لا يستبدل إلّا باختياره', () => {
    expect(WS).toContain('const clash = [...found.entries()].filter(([id, w]) => (whereOf(id) ?? "").trim() && whereOf(id) !== w);')
    expect(WS).toMatch(/if \(clash\.length === 0\) applyPages\(found, "all"\);\s*else setPageAsk\(found\);/)
    expect(WS).toContain('applyPages(pageAsk, "empty")')
    expect(WS).toContain('applyPages(pageAsk, "all")')
    /* وملفٌّ رُفع للتوّ لا يُقرأ قبل أن تُحفظ الخطّةُ به */
    const fn = WS.slice(WS.indexOf('const suggestPages = async'), WS.indexOf('suggestWorkbookPages(key'))
    expect(fn).toContain('if (!(await persist())) return;')
  })
})
