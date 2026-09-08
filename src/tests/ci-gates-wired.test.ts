/* كلُّ بوّابةٍ معرَّفةٍ تعمل فعلا — وإلّا فهي زينة.

   ── العطبُ الذي فُتح له هذا الحارس ──

   جولةُ البند ③ وجدت بوّابتَين في `package.json` **لا تعملان في CI**:

     · `ci:locale` — وكانت **حمراءَ**: ستّةُ مواضعَ تسمّي لغةً خارج
       `format-ar.ts`، تراكمت بلا أن يحمرّ شيء.
     · `ci:status-checks` — خضراءَ، لكن بلا حارسٍ يُبقيها خضراء.

   وأبلغُ ما في الأمر أنّ الجولةَ نفسَها **أضافت المخالفةَ السابعة** وهي تكتب
   تقريرَها عن الستّ: سطرٌ في `notifyCohortOfSession` يسمّي اللغةَ في مكانه.
   لم يمسكه شيء — لأنّ البوّابةَ التي تمسكه لم تكن تعمل. ولم يُكتشف إلّا
   بتشغيلها باليد.

   وقاعدةُ `CLAUDE.md` صريحة: «**خضرةُ CI هي الإذن**، لا رأيي في الشيفرة ولا
   خضرةُ جهازي». فبوّابةٌ خارج CI ليست بوّابة.

   ── ولمَ يُقاس على الاسم لا على النصّ ──

   لا يكفي أن يرد اسمُ السكربت في مكانٍ ما من الملفّ: قد يرد في تعليقٍ يشرح
   لماذا **لا** يعمل. فالمقياسُ ورودُه في **سطر `run:`** — أي أنّه يُنفَّذ.

   ── وما لا يحرسه هذا الحارس ──

   يحرس **الوصلَ** لا **الموضع** ولا **الشرطَ الذي يسبقه**. ومرّ خضراءَ
   على وصلٍ خاطئ **مرّتَين متتاليتَين**، وكلتاهما على السكربت نفسِه:

     · جولة ٦٣٤ — وُضعت `ci:status-checks` في وظيفة المتصفّح، وهي تتّصل
       بقاعدة (`status-checks.ts:95`) ولا قاعدةَ هناك: `ECONNREFUSED`.
     · جولة ٦٣٦ — نُقلت إلى وظيفة الخادم بغلاف `with-db`، فأنشأ عنقودا
       **فارغا** على عدّاء بارد: «❌ بلا قيد (٥٨)» — لا لأنّ القيودَ نقصت
       بل لأنّ الجداولَ لم تُخلق. فسُبقت بـ`prisma migrate deploy` داخل
       الغلاف نفسِه.

   وفي المرّتَين مرّ الفحصُ محلّيّا لأنّ عنقودَ المطوّر مُرحَّلٌ وحيّ، وسقط
   في CI. وهو تصديقٌ لقاعدة `CLAUDE.md` بنصّها: «خضرةُ CI هي الإذن، لا
   رأيي في الشيفرة ولا خضرةُ جهازي».

   فمن أضاف بوّابةً سأل نفسَه ثلاثة: **أتحتاج قاعدةً؟** و**أتحتاج قاعدةً
   مُرحَّلة؟** و**أتحتاج بذرا؟** — ثمّ وضعها حيث تجد ما تحتاج. وهذا حكمٌ
   لا يُقاس بالنصّ، فلا يحرسه هذا الحارس. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')

/** أوامرُ `run:` وحدَها — لا التعليقاتُ ولا أسماءُ الخطوات */
const RUN_LINES = workflow
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.startsWith('run:') || l.startsWith('- run:'))
  .join('\n')
/* وكتلةُ `run: |` متعدّدةُ الأسطر: تُضاف أسطرُها كلُّها فلا يفوت أمرٌ فيها */
const ALL_COMMANDS = workflow
  .split('\n')
  .filter((l) => !l.trim().startsWith('#'))
  .join('\n')

const CI_SCRIPTS = Object.keys(pkg.scripts).filter((k) => k.startsWith('ci:'))

describe('البوّاباتُ المعرَّفةُ تعمل في CI', () => {
  it('المسحُ يقرأ سكربتاتٍ فعلا — وإلّا فالحارسُ أخضرُ لفراغه', () => {
    expect(CI_SCRIPTS.length).toBeGreaterThan(5)
    expect(RUN_LINES.length).toBeGreaterThan(100)
  })

  it.each(CI_SCRIPTS)('«%s» تُستدعى في ci.yml', (script) => {
    /* يُقبل النداءُ باسم السكربت (`npm run ci:x`) أو بملفّه مباشرةً
       (`npx tsx scripts/x.ts`) — فبعضُ البوّابات تُستدعى بملفّها. */
    const byName = new RegExp(`npm run ${script.replace(':', ':')}(\\s|$)`).test(ALL_COMMANDS)
    const file = pkg.scripts[script].match(/scripts\/[\w/.-]+\.ts/)?.[0]
    const byFile = file ? ALL_COMMANDS.includes(file) : false
    expect(
      byName || byFile,
      `البوّابة «${script}» معرَّفةٌ في package.json ولا تُستدعى في ci.yml.\n`
      + 'وبوّابةٌ خارج CI ليست بوّابة: «خضرةُ CI هي الإذن» (CLAUDE.md).\n'
      + `أضِفها خطوةً في .github/workflows/ci.yml، أو احذفها إن لم تعد تحرس شيئا.`,
    ).toBe(true)
  })
})
