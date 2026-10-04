/* ═══ «ما تغيّر منذ ردّك» — إعادةُ المراجعة بعد ردٍّ بملاحظات (٣ أكتوبر ٢٠٢٦، ⑦) ═══
 *
 * سار صاحبُ المنصّة في المسار: ردّ خطّةً بملاحظاتٍ فأعاد المدرّبُ إرسالَها، فرأى
 * «ما طلبتَه» أسفلَ المنهج ولم يرَ ما تغيّر — فيعيد قراءةَ المنهج كلِّه ليعرف أأُجيبت
 * ملاحظتُه. واختار («7»): تُقابَل المرسَلةُ بالتي رُدّت خطوةً خطوة، وكلُّ ملاحظةٍ
 * بجانب ما تغيّر في خطوتها.
 *
 * ── ما يُحرَس ──
 *
 * ① القاعدةُ (`sinceReturn`): ملاحظةٌ بلا تغيير تُرى في خطوتها، وتغييرٌ بلا ملاحظةٍ
 *    يُرى كذلك، وما لا هذا ولا ذاك لا يُذكر — بترتيب خطوات المدرّب.
 * ② الشاشة: تُعرض المنطقةُ لخطّةٍ أُعيد إرسالُها بعد ردٍّ وحدَها، وتُقابِل الخطّةَ كما
 *    رُدّت بالمرسَلة (لا العكس)، ولا تُكرّر «ما طلبتَه» أسفلَ المنهج وقد قيلت فيها.
 *    ويُقرأ على شجرة TypeScript لا على ورود حرف. والخادمُ (حفظُ اللقطة ورفعُها)
 *    محروسٌ في `server/tests/trainer/cohort-plan.test.ts`. */
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sinceReturn } from '@/application/trainer/plan-diff'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const ymd = (d: string) => d

const RETURNED = {
  summaryAr: 'شعبةٌ تطبيقيّةٌ من أربعة أسابيع',
  startsOn: '2026-11-01', endsOn: '2026-11-28',
  modules: [
    { moduleId: 'm1', titleAr: 'صياغةُ الرسالة', bodyAr: 'متنٌ قصير' },
    { moduleId: 'm2', titleAr: 'الدليل', bodyAr: 'متنُ المحور الثاني' },
  ],
  slots: [],
  resources: [],
}
const RESENT = {
  ...RETURNED,
  modules: [{ ...RETURNED.modules[0], bodyAr: 'متنٌ أطول فيه مثالٌ من بيئة العمل' }, RETURNED.modules[1]],
  resources: [{ title: 'مقالةٌ في الإسناد', url: 'https://example.com/a', kind: 'link' }],
}

describe('⑦ القاعدة — ملاحظتُك بجانب ما تغيّر في خطوتها', () => {
  it('ملاحظةٌ بلا تغيير، وملاحظةٌ أُجيبت، وتغييرٌ بلا ملاحظة — بترتيب الخطوات', () => {
    const r = sinceReturn(RETURNED, RESENT, {
      general: 'خطّةٌ جيّدة — بقي تعديلان',
      identity: 'اكتب وقتَ اللقاء في اسم الشعبة',
      modules: 'أضف مثالا في المحور الأوّل',
    }, { date: ymd })
    expect(r.general).toBe('خطّةٌ جيّدة — بقي تعديلان')
    expect(r.rows.map((x) => [x.section, x.note !== null, x.lines.length > 0])).toEqual([
      ['identity', true, false],
      ['modules', true, true],
      ['assignments', false, true],
    ])
    expect(r.rows[1].lines.join(' ')).toContain('صياغةُ الرسالة')
  })

  it('ولا شيءَ يُذكر حين لا ملاحظةَ ولا تغيير', () => {
    expect(sinceReturn(RETURNED, RETURNED, {}, { date: ymd })).toEqual({ general: null, rows: [] })
  })
})

/* ─────────── الشاشة ─────────── */

function tree(rel: string): ts.SourceFile {
  return ts.createSourceFile(rel, readFileSync(join(root, rel), 'utf8'), ts.ScriptTarget.Latest, true,
    rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}
function all(node: ts.Node, pred: (n: ts.Node) => boolean): ts.Node[] {
  const out: ts.Node[] = []
  const visit = (n: ts.Node) => { if (pred(n)) out.push(n); ts.forEachChild(n, visit) }
  visit(node)
  return out
}
const mentions = (node: ts.Node, name: string) => all(node, (n) => ts.isIdentifier(n) && n.text === name).length > 0

describe('⑦ الشاشة — «ما تغيّر منذ ردّك» في بطاقة المراجعة', () => {
  const sf = tree('src/components/admin/TrainerPlanReview.tsx')

  it('تُعرض لخطّةٍ أُعيد إرسالُها بعد ردٍّ — وبها وحدَها', () => {
    const shown = all(sf, (n) => ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      && /trainerPlan\.status === "submitted"/.test(n.left.getText(sf)) && /trainerPlan\.returned\b/.test(n.left.getText(sf))
      && mentions(n.right, 'SinceReturnList'))
    expect(shown.length, 'المنطقةُ لا تُعرض، أو تُعرض بلا شرطها').toBe(1)
  })

  it('وتُقابِل الخطّةَ كما رُدّت بالمرسَلة — لا العكس، ولا بالمعتمَدة', () => {
    const calls = all(sf, (n) => ts.isCallExpression(n) && n.expression.getText(sf) === 'sinceReturn') as ts.CallExpression[]
    expect(calls.length).toBe(1)
    expect(calls[0].arguments.slice(0, 2).map((a) => a.getText(sf)))
      .toEqual(['trainerPlan.returned.content', 'trainerPlan.content'])
  })

  it('ولا تُكرَّر «ما طلبتَه» أسفلَ المنهج وقد قيلت بجانب ما تغيّر', () => {
    const notesBlock = all(sf, (n) => ts.isArrowFunction(n) && mentions(n, 'ReviewNotesList'))
    expect(notesBlock.length, 'تغيّر بناءُ صندوق «ما طلبتَه» — فتغيّر الحارس').toBeGreaterThan(0)
    const skip = all(notesBlock[0], (n) => ts.isIfStatement(n)
      && /trainerPlan\.returned\b/.test(n.expression.getText(sf))
      && /^return null;?$/.test(n.thenStatement.getText(sf).trim()))
    expect(skip.length, '«ما طلبتَه» يُكرَّر تحت المنهج وقد قيل في «ما تغيّر منذ ردّك»').toBe(1)
  })
})
