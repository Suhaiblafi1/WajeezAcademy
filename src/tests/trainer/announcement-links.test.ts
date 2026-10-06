/* روابطُ إعلانات المدرّبين تُضغط (٦ أكتوبر ٢٠٢٦).

   القرارُ في `src/application/text/linkify.ts`: كان الرابطُ في الإعلان حرفا ميّتا يُنسخ
   باليد. وما يُحرَس:

   ① **ما يُعدّ رابطا** — http وhttps وwww. بنطاقٍ فيه نقطة، ولا شيءَ غيرها؛ وما بعده
      من ترقيم الجملة وحروفها ليس منه؛ وجمعُ القطع يعيد النصَّ حرفا بحرف.
   ② **وكيف يُعرض** — وسمٌ يُفتح في لسانٍ آخر، باتّجاه نصّه، والفقراتُ كما كانت.
      والمكوّنُ مُصيَّرٌ بـ`react-dom/server` لا مقروءٌ نصّا.
   ③ **والشاشتان تعرضانه منه** — نافذةُ المدرّب ومعاينةُ الإدارة، فلا تعود إحداهما
      إلى فقراتٍ بلا روابط (بشجرة TypeScript لا بنصّ). */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { linkSegments } from '@/application/text/linkify'
import AnnouncementBody from '@/components/AnnouncementBody'

const links = (t: string) => linkSegments(t).filter((s) => s.kind === 'link').map((s) => (s.kind === 'link' ? s.href : ''))
const GUIDE = 'https://www.wajeezacademy.com/trainer/guide#standard'

describe('① ما يُعدّ رابطا', () => {
  it('نصٌّ بلا رابطٍ يبقى قطعةً واحدةً كما هو', () => {
    const t = 'الزملاءُ المدرّبون الكرام، أضفنا إلى الدليل قسما جديدا.'
    expect(linkSegments(t)).toEqual([{ kind: 'text', text: t }])
  })

  it('https بين كلامٍ عربيّ — والفاصلةُ العربيّةُ بعده للجملة لا له', () => {
    expect(linkSegments(`افتح ${GUIDE}، ثمّ اقرأ.`)).toEqual([
      { kind: 'text', text: 'افتح ' },
      { kind: 'link', text: GUIDE, href: GUIDE },
      { kind: 'text', text: '، ثمّ اقرأ.' },
    ])
  })

  it('ونقطةُ الجملة بعده ليست منه، ولا المزدوجان حولَه', () => {
    expect(links('افتح https://x.com/guide.')).toEqual(['https://x.com/guide'])
    expect(links('«https://x.com/a»')).toEqual(['https://x.com/a'])
    expect(links('هنا: https://x.com/a?b=1!')).toEqual(['https://x.com/a?b=1'])
  })

  it('وحرفٌ عربيٌّ ملاصقٌ يُنهيه', () => {
    expect(links('https://wajeezacademy.comثمّ')).toEqual(['https://wajeezacademy.com'])
  })

  it('www. يُفتح بـhttps — ونصُّه كما كُتب', () => {
    const [, link] = linkSegments('الرابط: www.wajeezacademy.com/trainer/guide.')
    expect(link).toEqual({ kind: 'link', text: 'www.wajeezacademy.com/trainer/guide', href: 'https://www.wajeezacademy.com/trainer/guide' })
  })

  it('والقوسُ يُبقى إن أغلق قوسا فُتح في الرابط نفسِه — ويُسقط إن كان للجملة', () => {
    expect(links('انظر (https://en.wikipedia.org/wiki/A_(b)) هنا')).toEqual(['https://en.wikipedia.org/wiki/A_(b)'])
    expect(links('(https://x.com/a)')).toEqual(['https://x.com/a'])
  })

  it.each([
    'javascript:alert(1)',
    'mailto:a@b.com',
    'ftp://x.com/file',
    'http://localhost',
    'https://',
    'www.',
  ])('«%s» نصٌّ لا رابط', (t) => {
    expect(links(`قبل ${t} بعد`)).toEqual([])
  })

  it('وجمعُ القطع يعيد النصَّ حرفا بحرف — لا يُفقَد منه شيءٌ ولا يُزاد', () => {
    for (const t of [
      `افتح ${GUIDE}، ثمّ اقرأ.`,
      'رابطان: https://a.com/x و www.b.org/y؛ وانتهى.',
      '(https://x.com/a)',
      'لا روابط هنا',
      'https://x.com',
    ]) {
      expect(linkSegments(t).map((s) => s.text).join('')).toBe(t)
    }
  })
})

describe('② وكيف يُعرض', () => {
  const html = (text: string) => renderToStaticMarkup(createElement(AnnouncementBody, { text }))

  it('وسمٌ إلى عنوانه، يُفتح في لسانٍ آخر، وباتّجاه نصّه', () => {
    const h = html(`أين تجده: ${GUIDE}، يُقرأ في عشر دقائق.`)
    const a = /<a\b[^>]*>([^<]*)<\/a>/.exec(h)
    expect(a, 'لا وسمَ رابط').toBeTruthy()
    expect(a![0]).toContain(`href="${GUIDE}"`)
    expect(a![0]).toContain('target="_blank"')
    expect(a![0]).toContain('rel="noopener noreferrer"')
    expect(a![0]).toContain('dir="ltr"')
    expect(a![1]).toBe(GUIDE)
    expect(h).toContain('، يُقرأ في عشر دقائق.')
  })

  it('والفقراتُ كما كانت: سطرٌ فارغٌ يفصل فقرتين', () => {
    const h = html('الأولى https://a.com\n\nالثانية\nوسطرٌ بعدها')
    expect(h.match(/<p\b/g)).toHaveLength(2)
    expect(h.match(/<a\b/g)).toHaveLength(1)
  })

  it('وما ليس رابطا لا يصير وسما — ولا يُحقن فيه شيء', () => {
    const h = html('javascript:alert(1) <b>عريض</b>')
    expect(h).not.toMatch(/<a\b/)
    expect(h).not.toMatch(/<b>/)
  })
})

describe('③ والشاشتان تعرضانه منه', () => {
  const tree = (rel: string) =>
    ts.createSourceFile(rel, readFileSync(join(process.cwd(), rel), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const all = (node: ts.Node, pred: (n: ts.Node) => boolean): ts.Node[] => {
    const out: ts.Node[] = []
    const visit = (n: ts.Node) => { if (pred(n)) out.push(n); ts.forEachChild(n, visit) }
    visit(node)
    return out
  }
  /** قيمةُ سمة `text` في كلّ <AnnouncementBody …/> */
  const bodies = (sf: ts.SourceFile) =>
    all(sf, (n) => ts.isJsxSelfClosingElement(n) && n.tagName.getText(sf) === 'AnnouncementBody')
      .map((n) => (n as ts.JsxSelfClosingElement).attributes.properties
        .find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === 'text'))
      .map((p) => (p?.initializer && ts.isJsxExpression(p.initializer) ? p.initializer.expression?.getText(sf) : undefined))
  /** فقراتٌ تُقسَم باليد (`.split(/\n{2,}/)`) — عرضٌ يتجاوز الروابط */
  const handSplit = (sf: ts.SourceFile) =>
    all(sf, (n) => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'split' && n.arguments.some((a) => ts.isRegularExpressionLiteral(a) && a.text.includes('{2,}')))

  it('نافذةُ المدرّب تعرض نصَّ الإعلان به', () => {
    const sf = tree('src/pages/trainer/TrainerAnnouncement.tsx')
    expect(bodies(sf)).toEqual(['shown.bodyAr'])
    expect(handSplit(sf), 'فقراتٌ تُقسَم باليد بلا روابط').toHaveLength(0)
  })

  it('ومعاينةُ الإدارة به كذلك — فما يُرى قبل الإرسال هو ما يصل', () => {
    const sf = tree('src/pages/admin/TrainerAnnouncements.tsx')
    expect(bodies(sf)).toEqual(['b'])
    expect(handSplit(sf), 'فقراتٌ تُقسَم باليد بلا روابط').toHaveLength(0)
  })
})
