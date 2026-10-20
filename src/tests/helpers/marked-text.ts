/* ═══ نصٌّ يراه إنسانٌ بتشكيلٍ إعرابيّ — الماسحُ الواحد (٢٠ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة (١١ أكتوبر ٢٠٢٦): ما يراه إنسانٌ بلا حركاتٍ ولا تنوينٍ ولا سكون — والشدّةُ وحدَها تبقى.
   والماسحُ يقرأ النصوصَ بشجرة TypeScript لا بالحرف: النصُّ والقالبُ ونصُّ JSX، لا التعليقات. */

import ts from 'typescript'

/** الحركاتُ والتنوينُ والسكون — بلا الشدّة (U+0651) */
export const MARKS = /[ً-ِْ]/

/** كلُّ نصٍّ في الملفّ فيه علامة — «ملفّ:سطر نصّ» */
export function markedTexts(file: string, src: string): string[] {
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
