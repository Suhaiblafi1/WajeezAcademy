/* ═══ نصوصُ صفحة الشعبة بلا تشكيلٍ إعرابيّ (٢٠ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة (١١ أكتوبر ٢٠٢٦): ما يراه إنسانٌ بلا حركاتٍ ولا تنوينٍ ولا سكون — والشدّةُ وحدَها تبقى.
   وكان في صفحة الشعبة ثلاثةٌ: إشعارُ شعبة الإعداد («شعبةُ إعداد… دورتَك… تُنشَر»)، وخطآ بطاقات «قبل/بعد»
   («الرابطُ» و«تُرفع»). والماسحُ يقرأ النصوصَ بشجرة TypeScript لا بالحرف، فالتعليقاتُ ليست منه.

   ورُئي ساقطا: أُعيد «شعبةُ إعداد» في `usePrepCohorts.ts` فسقط. */

import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** الحركاتُ والتنوينُ والسكون — بلا الشدّة (U+0651) */
const MARKS = /[ً-ِْ]/

function marked(file: string, src: string): string[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out: string[] = []
  const visit = (n: ts.Node) => {
    let texts: string[] = []
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) texts = [n.text]
    else if (ts.isTemplateExpression(n)) texts = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)]
    else if (ts.isJsxText(n)) texts = [n.text]
    for (const t of texts) if (MARKS.test(t)) out.push(`${file}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1} ${t.trim().slice(0, 60)}`)
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

const FILES = [
  'src/pages/trainer/CohortWorkspace.tsx',
  'src/pages/trainer/SlotSessions.tsx',
  'src/pages/trainer/WeeklySessions.tsx',
  'src/pages/trainer/SlotDaySelect.tsx',
  'src/pages/trainer/TrainerSchedule.tsx',
  'src/pages/trainer/SessionsAndAttendance.tsx',
  'src/components/PlanEdits.tsx',
  'src/components/trainer/usePrepCohorts.ts',
  'src/application/trainer/plan-edits.ts',
]

describe('صفحة الشعبة بلا تشكيل', () => {
  it('الماسح يرى الحركة في النصّ ويتجاوز التعليق والشدّة', () => {
    const sample = ["const a = 'شعبةُ إعداد'", "/* شعبةُ في تعليق */ const b = 'شعبة'", "const c = 'الكرّاسة'", 'const d = <p>تُنشَر</p>'].join('\n')
    expect(marked('sample.tsx', sample).map((x) => x.split(' ')[0])).toEqual(['sample.tsx:1', 'sample.tsx:4'])
  })

  it('⚠️ لا حركة في نصوص صفحة الشعبة وما تعرضه', () => {
    const hits = FILES.flatMap((f) => marked(f, readFileSync(join(process.cwd(), f), 'utf8')))
    expect(hits, 'نصّ بتشكيل إعرابيّ').toEqual([])
  })
})

/* ═══ ولا وعدَ بحفظٍ يدويٍّ لم يعد (٢٠ أكتوبر ٢٠٢٦) ═══
   الحفظُ التلقائيُّ يكتب حذفَ المحور بعد ثوانٍ بلا تراجع — وكان الصندوقُ يقول «لا يقع شيء حتّى تحفظ المحاور»،
   وبطاقةُ الموعد «تحفظ بزرّ احفظ في أعلى الصفحة» ولا زرّ. ورُئي ساقطا: أُعيد النصّان فسقط. */
describe('لا وعد بحفظ يدويّ', () => {
  it('⚠️ حذف المحور والجلسة المسجّلة يقولان إنّ الحفظ تلقائيّ', () => {
    const ws = readFileSync(join(process.cwd(), 'src/pages/trainer/CohortWorkspace.tsx'), 'utf8')
    const slot = readFileSync(join(process.cwd(), 'src/pages/trainer/SlotSessions.tsx'), 'utf8')
    expect(ws).not.toContain('حتّى تحفظ المحاور')
    expect(ws).toContain('ويحفظ الحذف تلقائيّا بعد ثوان.')
    expect(slot).not.toContain('بزرّ «احفظ» في أعلى الصفحة')
    expect(slot).toContain('الجلسة المسجّلة تحفظ مع خطّتك تلقائيّا.')
  })
})
