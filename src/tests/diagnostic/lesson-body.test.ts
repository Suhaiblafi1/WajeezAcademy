import { describe, expect, it } from 'vitest'
import { parseLesson } from '../../application/content/lesson-markup'

describe('متن الدرس — التحليل (ح-١)', () => {
  it('متن فارغ لا كتل', () => {
    expect(parseLesson('')).toEqual([])
    expect(parseLesson('\n\n   \n')).toEqual([])
  })

  it('العناوين بثلاث مستويات', () => {
    const b = parseLesson('# أول\n## ثان\n### ثالث')
    expect(b).toEqual([
      { kind: 'h', level: 1, text: 'أول' },
      { kind: 'h', level: 2, text: 'ثان' },
      { kind: 'h', level: 3, text: 'ثالث' },
    ])
  })

  it('#### أربع علامات ليست عنوانا — تبقى فقرة كما كُتبت', () => {
    expect(parseLesson('#### ليس عنوانا')).toEqual([{ kind: 'p', text: '#### ليس عنوانا' }])
  })

  it('السطر الفارغ يفصل الفقرات، والأسطر المتصلة تُدمج', () => {
    expect(parseLesson('سطر أول\nسطر ثان\n\nفقرة أخرى')).toEqual([
      { kind: 'p', text: 'سطر أول سطر ثان' },
      { kind: 'p', text: 'فقرة أخرى' },
    ])
  })

  it('القوائم النقطية والمرقّمة تُجمَّع في كتلة واحدة', () => {
    expect(parseLesson('- أ\n- ب\n- ج')).toEqual([{ kind: 'ul', items: ['أ', 'ب', 'ج'] }])
    expect(parseLesson('1. أ\n2. ب')).toEqual([{ kind: 'ol', items: ['أ', 'ب'] }])
    expect(parseLesson('1) أ\n2) ب')).toEqual([{ kind: 'ol', items: ['أ', 'ب'] }])
  })

  it('قائمتان مفصولتان بفقرة لا تندمجان', () => {
    const b = parseLesson('- أ\n\nفاصل\n\n- ب')
    expect(b.map((x: { kind: string }) => x.kind)).toEqual(['ul', 'p', 'ul'])
  })

  it('الاقتباس متعدد الأسطر كتلة واحدة', () => {
    expect(parseLesson('> سطر\n> ثان')).toEqual([{ kind: 'quote', text: 'سطر ثان' }])
  })

  it('الكود يحفظ أسطره ومسافاته ولا يُفسَّر ما فيه', () => {
    const b = parseLesson('```\nconst x = 1\n  # ليس عنوانا\n- ليست قائمة\n```')
    expect(b).toEqual([{ kind: 'code', text: 'const x = 1\n  # ليس عنوانا\n- ليست قائمة' }])
  })

  it('كتلة كود بلا إغلاق لا تُسقط التحليل', () => {
    const b = parseLesson('```\nسطر بلا إغلاق')
    expect(b).toEqual([{ kind: 'code', text: 'سطر بلا إغلاق' }])
  })

  it('الفاصل ثلاث شرطات أو أكثر', () => {
    expect(parseLesson('---')).toEqual([{ kind: 'hr' }])
    expect(parseLesson('-----')).toEqual([{ kind: 'hr' }])
    /* شرطتان ليست فاصلا */
    expect(parseLesson('--')).toEqual([{ kind: 'p', text: '--' }])
  })

  it('CRLF يُطبَّع فلا تظهر أسطر شبحية', () => {
    expect(parseLesson('# عنوان\r\n\r\nفقرة')).toEqual([
      { kind: 'h', level: 1, text: 'عنوان' },
      { kind: 'p', text: 'فقرة' },
    ])
  })

  it('لا كتلة من نوع html أو raw — البنية مغلقة على سبعة أنواع', () => {
    const kinds = new Set(parseLesson('# ع\nنص\n- ق\n1. م\n> ا\n---\n```\nك\n```').map((b: { kind: string }) => b.kind))
    for (const k of kinds) expect(['h', 'p', 'quote', 'ul', 'ol', 'code', 'hr']).toContain(k)
  })

  it('وسم HTML في المتن يبقى نصا في كتلة فقرة — لا تفسير ولا تنفيذ', () => {
    const b = parseLesson('<img src=x onerror=alert(1)>')
    expect(b).toEqual([{ kind: 'p', text: '<img src=x onerror=alert(1)>' }])
  })
})
