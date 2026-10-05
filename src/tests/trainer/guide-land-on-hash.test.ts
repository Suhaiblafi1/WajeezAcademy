/* رابطٌ إلى قسمٍ من الدليل يهبط عليه (٥ أكتوبر ٢٠٢٦).

   القرارُ وعلّتُه في `src/components/guide/land-on-hash.ts`: روابطُ «التدريبُ معنا»
   إلى الدليل (`/trainer/guide#standard`) كانت تفتحه من أوّله. وما يُحرَس:

   ① **يهبط على القسم** — في الإطار التالي، ثمّ مرّةً بعد الخطوط، وتحت هامشه
      (`scroll-mt`) لا فوقه — **عموديّا وحدَه**: لا يُمسّ الأفق.
   ② **ولا يُنازع القارئ** — إن مرّر أو لمس قبل الهبوط الثاني فلا هبوطَ بعده.
   ③ **ولا يفعل شيئا لمرساةٍ ليست قسما** — ولا لمرساةٍ معطوبة الترميز.
   ④ **والدليلُ يستعمله فعلا** — داخل أثرٍ في مكوّن الصفحة، بمعرّفات فهرسه.

   والنافذةُ هنا مصنوعة: لا DOM في هذه الحزمة، والدالّةُ لا تطلب إلّا ما تعرّفه
   واجهاتُها. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { hashTarget, landOnHash, READER_MOVES, type LandDocument, type LandWindow } from '../../components/guide/land-on-hash'

const IDS = ['journey', 'first-login', 'standard', 'faq']

/** نافذةٌ ومستندٌ مصنوعان: القسمُ على بعد `top` من أعلى الشاشة وهي عند `scrollY` */
function fake(hash: string, { top = 5000, margin = '96px' } = {}) {
  const scrolls: ScrollToOptions[] = []
  const listeners = new Map<string, () => void>()
  const frames: (() => void)[] = []
  let releaseFonts!: () => void
  const fontsReady = new Promise<void>((r) => { releaseFonts = r })
  const win: LandWindow = {
    location: { hash },
    scrollY: 0,
    scrollTo: (o) => { scrolls.push(o); if (o.top !== undefined) win.scrollY = o.top },
    getComputedStyle: () => ({ scrollMarginTop: margin }),
    addEventListener: (t, fn) => { listeners.set(t, fn) },
    removeEventListener: (t) => { listeners.delete(t) },
    requestAnimationFrame: (fn) => frames.push(fn),
    cancelAnimationFrame: (id) => { frames[id - 1] = () => {} },
  }
  const asked: string[] = []
  const doc: LandDocument = {
    getElementById: (id) => { asked.push(id); return { getBoundingClientRect: () => ({ top: top - win.scrollY }) } },
    fonts: { ready: fontsReady },
  }
  const frame = () => frames.splice(0).forEach((f) => f())
  const fonts = async () => { releaseFonts(); await fontsReady; await Promise.resolve() }
  return { win, doc, scrolls, listeners, frame, fonts, asked }
}

describe('① يهبط على القسم', () => {
  it('في الإطار التالي — لا قبله، فرفعُ `ScrollToTop` إلى الأعلى يمضي أوّلا', () => {
    const f = fake('#standard')
    landOnHash(f.win, f.doc, IDS)
    expect(f.scrolls, 'هبط قبل الإطار').toEqual([])
    f.frame()
    expect(f.asked).toEqual(['standard'])
    expect(f.scrolls).toHaveLength(1)
  })

  it('تحت هامشه: عنوانُ القسم لا يختفي تحت الشريط الثابت', () => {
    const f = fake('#standard', { top: 5000, margin: '96px' })
    landOnHash(f.win, f.doc, IDS)
    f.frame()
    expect(f.scrolls[0].top).toBe(5000 - 96)
  })

  it('عموديّا وحدَه — فلا تنزاح الصفحةُ جانبا', () => {
    const f = fake('#standard')
    landOnHash(f.win, f.doc, IDS)
    f.frame()
    expect(f.scrolls[0]).not.toHaveProperty('left')
  })

  it('ومرّةً بعد الخطوط — فهي تغيّر أطوالَ ما فوق القسم', async () => {
    const f = fake('#standard')
    landOnHash(f.win, f.doc, IDS)
    f.frame()
    await f.fonts()
    expect(f.scrolls).toHaveLength(2)
  })
})

describe('② ولا يُنازع القارئ', () => {
  for (const move of READER_MOVES) {
    it(`من بدأ يتحرّك (${move}) قبل الخطوط لا يُشدّ إلى القسم بعدها`, async () => {
      const f = fake('#standard')
      landOnHash(f.win, f.doc, IDS)
      f.frame()
      const stop = f.listeners.get(move)
      expect(stop, `لا يُصغى إلى ${move}`).toBeTypeOf('function')
      stop!()
      await f.fonts()
      expect(f.scrolls).toHaveLength(1)
    })
  }

  it('ومن غادر الصفحةَ قبل الإطار لا يُهبَط به', () => {
    const f = fake('#standard')
    const cleanup = landOnHash(f.win, f.doc, IDS)
    cleanup()
    f.frame()
    expect(f.scrolls).toEqual([])
    expect(f.listeners.size, 'بقي مُصغٍ بعد المغادرة').toBe(0)
  })
})

describe('③ ولا يفعل شيئا لمرساةٍ ليست قسما', () => {
  it.each(['', '#', '#nope', '#%E0%A4%A', '#main-content'])('«%s»', async (hash) => {
    const f = fake(hash)
    landOnHash(f.win, f.doc, IDS)
    f.frame()
    await f.fonts()
    expect(f.scrolls).toEqual([])
    expect(f.listeners.size).toBe(0)
  })

  it('والمرساةُ تُفكّ من ترميزها قبل أن تُطابَق', () => {
    expect(hashTarget('#first-login', IDS)).toBe('first-login')
    expect(hashTarget(`#${encodeURIComponent('first-login')}`, IDS)).toBe('first-login')
    expect(hashTarget('#%', IDS)).toBeNull()
  })
})

describe('④ والدليلُ يستعمله فعلا', () => {
  const rel = 'src/pages/trainer/Guide.tsx'
  const sf = ts.createSourceFile(rel, readFileSync(join(process.cwd(), rel), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const page = sf.statements.find((s): s is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(s) && !!s.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword))

  const calls = (node: ts.Node, name: string): ts.CallExpression[] => {
    const out: ts.CallExpression[] = []
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === name) out.push(n)
      ts.forEachChild(n, visit)
    }
    visit(node)
    return out
  }

  it('داخل أثرٍ (`useEffect`) في مكوّن الصفحة نفسِه', () => {
    expect(page, 'لا مكوّنَ مصدَّرا افتراضيّا في Guide.tsx').toBeTruthy()
    const inEffect = calls(page!, 'useEffect').filter((e) => calls(e.arguments[0], 'landOnHash').length > 0)
    expect(inEffect, 'لا يُستدعى landOnHash في أثرٍ من آثار الصفحة').toHaveLength(1)
  })

  it('بمعرّفات الفهرس — فكلُّ ما يدلّ عليه الفهرسُ يُهبَط عليه', () => {
    const [call] = calls(page!, 'landOnHash')
    const ids = call.arguments[2]
    expect(ts.isIdentifier(ids) && ids.text, 'المعرّفاتُ غيرُ معرّفات الفهرس').toBe('ids')
    const decl = calls(page!, 'useMemo').find((c) => {
      const parent = c.parent
      return ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) && parent.name.text === 'ids'
    })
    expect(decl?.getText(sf), '`ids` لا يُبنى من الفهرس').toMatch(/tocGroups\.flatMap/)
  })
})
