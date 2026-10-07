/* قالبا كرّاسة وجيز الفارغان — كرّاسةُ الدورة وكرّاسةُ المحور، في `public/templates/`.

   يكتبهما المولّدُ نفسُه الذي يكتب الكرّاسةَ المملوءةَ بخطّة الشعبة
   (`server/services/workbook-docx.ts` — والقراران والصنعةُ في رأسه)، بـ`blankFill`.
   فالقالبُ الفارغُ والمملوءُ شكلٌ واحدٌ لا يفترقان.

   الاستعمال (أداةٌ محلّيّةٌ خارجَ البناء — يُعاد تشغيلُها متى تغيّر المولّد):

     npx tsx scripts/workbook-template/build.ts

   والخطّان في `server/assets/fonts/` (برخصة OFL معهما)، والشعارُ `public/logo-full.png`. */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { blankFill, workbookDocx } from '../../server/services/workbook-docx'
import { WORKBOOK_TEMPLATES } from '../../src/application/trainer/cohort-workbooks'

const OUT = join(process.cwd(), 'public')
mkdirSync(join(OUT, 'templates'), { recursive: true })
for (const [kind, tpl] of [['course', WORKBOOK_TEMPLATES.course], ['module', WORKBOOK_TEMPLATES.modules]] as const) {
  const data = await workbookDocx(blankFill(kind))
  writeFileSync(join(OUT, tpl.href), data)
  console.log(`${tpl.href}: ${(data.length / 1024).toFixed(0)} KB`)
}
