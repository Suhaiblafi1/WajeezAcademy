/* عرضُ الموعد في «المحاور ومواعيدها» (١١ أكتوبر ٢٠٢٦).

   شكا صاحبُ المنصّة بلقطة: «لماذا التصميمُ خربان؟» — موعدٌ يمتدّ خارج الصفحة، وحقلُ «وينتهي»
   ونصفُ المحور مقصوصان. والعلّة: عمودُ الشبكة الضمنيُّ بعرض أعرض ما فيه، وسطرُ المخرَج في المحور
   المطويّ سطرٌ واحدٌ مقصوص (`truncate`) فعرضُه الأدنى طولُه كلُّه. فمخرَجٌ طويلٌ — بعد قبول تعديلٍ
   يطوّله — مدّ الموعدَ كلَّه.

   ① الموعدُ وبطاقتُه عمودٌ واحدٌ بأدنى صفر (`grid-cols-1` = `minmax(0, 1fr)`) فيبقيان في عرضهما.
   ② وعنوانُ المحور بأساسٍ يُنزل أزرارَه سطرا في الهاتف، لا يُعصر كلمةً في كلّ سطر.

   والفحصُ على الشيفرة بلا تعليقاتها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const WS = readFileSync(join(process.cwd(), 'src/pages/trainer/CohortWorkspace.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('عرض الموعد', () => {
  it('⚠️ الموعد وبطاقته عمود واحد يضيق — لا يمدّهما سطر مخرج طويل', () => {
    const at = WS.indexOf('{slots.map((slot, si) => (')
    expect(at, 'لا قائمة مواعيد').toBeGreaterThan(0)
    expect(WS.slice(at, at + 400)).toMatch(/^\{slots\.map\(\(slot, si\) => \(\s*<li key=[^\n]*\s+className="grid grid-cols-1 gap-2">\s*<Card tone="default" className="grid grid-cols-1 gap-3">/)
  })

  it('⚠️ وعنوان المحور المطويّ يضيق ويقصّ سطره — وفي الهاتف تنزل أزراره سطرا', () => {
    const at = WS.indexOf('const moduleCard = (m: PlanModule, i: number) => {')
    expect(at).toBeGreaterThan(0)
    const card = WS.slice(at, at + 2500)
    expect(card).toMatch(/aria-expanded=\{open\}\s+className="flex min-w-0 flex-1 basis-56 items-center gap-2 text-start"/)
    expect(card).toMatch(/<span className=\{`mt-0\.5 block truncate text-read /)
  })
})
