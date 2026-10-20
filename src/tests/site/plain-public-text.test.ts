/* نصوصُ الصفحات العامّة بلا تشكيلٍ إعرابيّ — «من نحن» والقصص والسياسات (٢٠ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة (١١ أكتوبر ٢٠٢٦): ما يراه إنسانٌ بلا حركاتٍ ولا تنوينٍ ولا سكون — والشدّةُ وحدَها
   تبقى (`plain-ar.ts`). وبقيت في هذه الملفّات الثلاثة ١١١ جملةً مشكولةً تُعرض للزائر. والتعليقاتُ ليست
   منها، فالفحصُ على نصوص الشيفرة الحرفيّة بمحلّل TypeScript لا على الملفّ كلّه. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { CASE_MARKS } from '@/application/text/plain-ar'

const FILES = ['src/data/siteContent.ts', 'src/data/about.ts', 'src/data/stories.ts']

/* والكتالوجُ نفسُه صار بلا تشكيل (٢٠ أكتوبر ٢٠٢٦) — فما تنقله القصصُ عنه حرفا بلا تشكيلٍ كذلك، ولا
   استثناء. والكتالوجُ يحرسه `catalog-plain-text.test.ts` */

function marked(p: string): string[] {
  const sf = ts.createSourceFile(p, readFileSync(join(process.cwd(), p), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const out: string[] = []
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      if (new RegExp(CASE_MARKS.source).test(n.text)) out.push(n.text.slice(0, 60))
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

describe('نصوصُ الصفحات العامّة بلا تشكيلٍ إعرابيّ', () => {
  for (const f of FILES) {
    it(`⚠️ ${f}`, () => {
      expect(marked(f), 'جملةٌ مشكولةٌ تُعرض للزائر').toEqual([])
    })
  }
})
