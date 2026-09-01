/* بوّابةُ الرقم واللغة — لغةُ عرضٍ واحدة في الواجهة.

   جولةُ الأدوار كشفت شاشةً واحدةً تعرض نظامَي أرقام: بطاقةُ القِمع تقول
   «99» لأنّها تُصيّر الرقم خامًا، وجارتُها تقول «٢ متعلم» لأنّها تمرّ
   بـ`toLocaleString("ar-JO")`. وسببُه ستُّ لغاتٍ متفرّقة اختيرت كلٌّ في
   ملفّها: `ar`, `ar-JO`, `ar-SA`, `ar-EG`, `ar-u-ca-gregory`, وخامٌ بلا لغة.

   فصار الاختيارُ في `src/application/text/format-ar.ts` وحدَه، وهذه
   البوّابة تمنع عودةَ الاختيار إلى الملفّات.

     npx tsx scripts/audit-locale.ts            تقرير
     npx tsx scripts/audit-locale.ts --check    يسقط عند أيّ مخالفة
*/

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/** الملفّ الوحيد الذي يملك أن يسمّي لغةً */
const HOME = 'src/application/text/format-ar.ts'

/** `toLocaleX("ar…")` أو `Intl.XFormat("ar…")` — اللغةُ مسمّاةٌ في الملفّ */
const NAMED_LOCALE = /(?:toLocale(?:Date|Time)?String|Intl\.(?:NumberFormat|DateTimeFormat|RelativeTimeFormat))\(\s*['"]ar[a-zA-Z-]*['"]/

const files = execSync(
  `git ls-files 'src/**/*.ts' 'src/**/*.tsx' 'server/**/*.ts'`,
  { encoding: 'utf8' },
).split('\n').filter(Boolean)

interface Hit { file: string; line: number; text: string }
const hits: Hit[] = []

for (const f of files) {
  if (f === HOME) continue
  /* التعليقُ يشرح البوّابة ولا يخالفها — تُمحى الكتلُ والأسطر مع حفظ الأسطر */
  const src = readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
  for (const [i, l] of src.split('\n').entries()) {
    if (NAMED_LOCALE.test(l)) hits.push({ file: f, line: i + 1, text: l.trim().slice(0, 110) })
  }
}

console.log(`\nبوّابةُ الرقم واللغة — ${files.length} ملفّا`)
if (hits.length === 0) {
  console.log(`✅ لغةُ العرض في ${HOME} وحدَه.\n`)
} else {
  console.log(`\n✗ ${hits.length} موضعا يسمّي لغةً خارج ${HOME}:\n`)
  for (const h of hits) console.log(`  ${h.file}:${h.line}\n    ${h.text}`)
  console.log(`\n  البديل: fmtNum · fmtMoney · fmtDate · fmtDateLong · fmtDayMonth · fmtDateTime · fmtTime · fmtSession · fmtDateWith\n`)
}

if (process.argv.includes('--check') && hits.length > 0) process.exit(1)
