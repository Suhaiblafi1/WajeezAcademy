/* ═══ بطاقةُ «شعبي» ورأسُ صفحة الشعبة — ⑩ و⑫ (٤ أكتوبر ٢٠٢٦) ═══
 *
 * من مقترحات مسار الاعتماد التي اختارها صاحبُ المنصّة («do»):
 *
 *   ⑩ بطاقةُ شعبة الإعداد كانت تقول «تبدأ —» وفي خطّته يومٌ مكتوب — فيُقال
 *      يومُ خطّته موسوما «مقترح» حتّى تُعتمَد، ثمّ يومُ الشعبة المعتمَد.
 *   ⑫ أولى شعبه في دورةٍ سبقتها ثلاثٌ اسمُها «شعبة ٤» — فيُقال معه «شعبتك
 *      الأولى» في لوح «شعبي» ورأسِ صفحة الشعبة (اختار أن يُقالا معا: «Both»).
 *
 * والقاعدتان وحدتان خالصتان تُفحصان بمدخلاتهما، والشاشتان تُقرآن بمحلّل
 * TypeScript على الاستدعاءات. وما على الخادم في `server/tests/trainer/last-mile.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { boardStart } from '@/application/trainer/plan-gate'
import { cohortTitleAr, trainerOrdinalNoteAr, trainerOrdinals } from '@/application/learning/cohort-title'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const tree = (rel: string) =>
  ts.createSourceFile(rel, readFileSync(join(root, rel), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function all(node: ts.Node, pred: (n: ts.Node) => boolean): ts.Node[] {
  const out: ts.Node[] = []
  const visit = (n: ts.Node) => { if (pred(n)) out.push(n); ts.forEachChild(n, visit) }
  visit(node)
  return out
}
/** استدعاءاتُ دالّةٍ بعينها بوسائطها نصّا */
const callsOf = (sf: ts.SourceFile, name: string) =>
  (all(sf, (n) => ts.isCallExpression(n) && n.expression.getText(sf) === name) as ts.CallExpression[])
    .map((c) => c.arguments.map((a) => a.getText(sf)))
/** «X && …» في JSX: الشرطُ ونصُّ ما يُعرض به */
const guarded = (sf: ts.SourceFile, cond: string) =>
  (all(sf, (n) => ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    && n.left.getText(sf) === cond) as ts.BinaryExpression[]).map((b) => b.right.getText(sf))

const BOARD = tree('src/pages/trainer/CohortBoard.tsx')
const WORKSPACE = tree('src/pages/trainer/CohortWorkspace.tsx')

describe('⑩ يومُ البدء على البطاقة — والمقترَحُ قبل الاعتماد', () => {
  it('المعتمَدُ من الشعبة أوّلا، ثمّ يومُ الخطّة مقترحا، ثمّ لا يوم', () => {
    const at = '2026-10-31T21:00:00.000Z'
    expect(boardStart({ startsAt: at, proposedStartsOn: '2026-12-01' })).toEqual({ at, proposed: false })
    expect(boardStart({ startsAt: null, proposedStartsOn: '2026-11-01' })).toEqual({ at: '2026-11-01', proposed: true })
    expect(boardStart({ startsAt: null, proposedStartsOn: null })).toEqual({ at: null, proposed: false })
    expect(boardStart({ startsAt: null })).toEqual({ at: null, proposed: false })
  })

  it('والبطاقةُ تكتب اليومَ بيوم عمّان وتسِمه «مقترح» حين يكون', () => {
    expect(callsOf(BOARD, 'boardStart'), 'البطاقةُ لا تقرأ القاعدة').toEqual([['c']])
    expect(callsOf(BOARD, 'cohortDayAr'), 'يومُ البطاقة بغير القاعدة أو بغير يوم عمّان').toEqual([['start.at']])
    const marked = guarded(BOARD, 'start.proposed')
    expect(marked.length, 'لا وسمَ «مقترح» — فيُقرأ يومُ خطّته معتمَدا').toBe(1)
    expect(marked[0]).toContain('مقترح')
  })
})

describe('⑫ «شعبتك الأولى» بجانب «شعبة ٤»', () => {
  it('الترتيبُ بين شعب المدرّب في كلّ دورةٍ وحدَها — بتاريخ الإنشاء، والمعرّفُ يفصل المتساويين', () => {
    const t = (iso: string) => new Date(iso)
    /* المعرّفاتُ على غير ترتيب الإنشاء عمدا — فترتيبٌ بالمعرّف وحدَه يسقط هنا */
    const got = trainerOrdinals([
      { id: 'b', courseId: 'A', createdAt: t('2026-10-02T00:00:00Z') },
      { id: 'm', courseId: 'A', createdAt: t('2026-10-01T00:00:00Z') },
      { id: 'a', courseId: 'B', createdAt: t('2026-09-01T00:00:00Z') },
      { id: 'z', courseId: 'A', createdAt: t('2026-10-03T00:00:00Z') },
      { id: 'c', courseId: 'A', createdAt: t('2026-10-03T00:00:00Z') },
      { id: 'b', courseId: 'A', createdAt: t('2026-10-02T00:00:00Z') },
    ])
    expect(Object.fromEntries(got)).toEqual({ m: 1, b: 2, c: 3, z: 4, a: 1 })
  })

  it('تُقال حين يخالف رقمُ الشعبة ترتيبَها وحدَه — لا تكرارا ولا لاسمٍ بلا رقم', () => {
    expect(trainerOrdinalNoteAr(cohortTitleAr('دورةُ الرسالة', 4), 1)).toBe('شعبتك الأولى')
    expect(trainerOrdinalNoteAr(cohortTitleAr('دورةُ الرسالة', 7), 2)).toBe('شعبتك الثانية')
    expect(trainerOrdinalNoteAr(cohortTitleAr('دورةُ الرسالة', 14), 11)).toBe('شعبتك رقم ١١')
    expect(trainerOrdinalNoteAr(cohortTitleAr('دورةُ الرسالة', 1), 1), '«شعبة ١ · شعبتك الأولى» تكرار').toBeNull()
    expect(trainerOrdinalNoteAr('دفعةُ أكتوبر — مسائيّة', 1), 'اسمٌ بلا رقمٍ لا يُسأل فيه عمّا قبله').toBeNull()
    expect(trainerOrdinalNoteAr(cohortTitleAr('دورةُ الرسالة', 4), null)).toBeNull()
  })

  it('وفي شاشتَي المدرّب: لوحُ «شعبي» ورأسُ صفحة الشعبة', () => {
    expect(callsOf(BOARD, 'trainerOrdinalNoteAr'), 'البطاقةُ لا تقرأ ترتيبَها').toEqual([['c.title', 'c.trainerOrdinal']])
    expect(guarded(BOARD, 'ordinalNote').join(' '), 'البطاقةُ لا تقول «شعبتك الأولى»').toContain('{ordinalNote}')
    expect(callsOf(WORKSPACE, 'trainerOrdinalNoteAr'), 'رأسُ الصفحة لا يقرأ ترتيبَها')
      .toEqual([['ws.cohort.title', 'ws.cohort.trainerOrdinal']])
    /* وفي سطر الحقائق بعد الاسم مباشرةً — لا في موضعٍ بعيدٍ عنه */
    const facts = all(WORKSPACE, (n) => ts.isJsxElement(n) && n.openingElement.tagName.getText(WORKSPACE) === 'b'
      && n.children.some((c) => c.getText(WORKSPACE) === '{ws.cohort.title}')) as ts.JsxElement[]
    expect(facts.length, 'تغيّر سطرُ الحقائق في رأس الصفحة — فتغيّر الحارس').toBe(1)
    const siblings = (facts[0].parent as ts.JsxElement).children.filter((c) => !(ts.isJsxText(c) && !c.getText(WORKSPACE).trim()))
    const next = siblings[siblings.indexOf(facts[0]) + 1]
    expect(next?.getText(WORKSPACE) ?? '', '«شعبتك الأولى» ليست بجانب الاسم').toMatch(/^\{ordinalNote && /)
  })
})
