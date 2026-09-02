/* بوّابةُ الترحيلات: لا نموذجَ في المخطَّط بلا جدولٍ يُنشئه.

   ─────────── العطبُ الذي وُضعت له ───────────

   أُنشئ `AdvisorProfile` بنموذجٍ وترحيل. ثمّ أسقط دمجٌ ملفَّ الترحيل وأبقى
   النموذجَ والخدمةَ التي تقرؤه — فصار الخادمُ ينادي جدولا لا وجودَ له، وكلُّ
   نداءٍ على «المستشارون والعمولة» و«عمولتي» يُردّ بخطأ قاعدةٍ خام.

   ولم يظهر في شيء: المخطَّطُ سليم، والأنواعُ تمرّ (لأنّ عميلَ Prisma يُولَّد
   من المخطَّط لا من القاعدة)، والبناءُ ينجح، والواجهةُ تُصيَّر. ولا يُكتشف
   إلّا بنداءٍ حيٍّ على قاعدةٍ مرحَّلةٍ من الصفر.

   وهذا ما يجعله صنفَ عطبٍ لا يمسكه إلّا حارسٌ بنيويّ: يقارن أسماءَ النماذج
   بما تُنشئه ملفّاتُ الـSQL، ويسمّي الناقصَ. */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const SCHEMA = 'prisma/schema.prisma'
const MIGRATIONS = 'prisma/migrations'

const schema = readFileSync(SCHEMA, 'utf8')

/* أسماءُ النماذج — والجدولُ يحمل اسمَ النموذج إلّا أن يُعاد تسميته بـ@@map */
const models = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map(([, name, body]) => {
  const mapped = /@@map\("([^"]+)"\)/.exec(body)?.[1]
  return { model: name, table: mapped ?? name }
})

if (models.length === 0) {
  console.error('✘ لم يُقرأ أيُّ نموذجٍ من المخطَّط — تغيّرت صيغتُه؟')
  process.exit(1)
}

const sql = existsSync(MIGRATIONS)
  ? readdirSync(MIGRATIONS, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(MIGRATIONS, d.name, 'migration.sql'))
      .filter((f) => existsSync(f))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n')
  : ''

/* `CREATE TABLE`، و`CREATE TABLE IF NOT EXISTS`، وباقتباسٍ أو بلا */
const created = new Set(
  [...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([A-Za-z0-9_]+)"?/gi)].map((m) => m[1]),
)

const missing = models.filter((m) => !created.has(m.table))

if (missing.length === 0) {
  console.log(`✅ ${models.length} نموذجا، ولكلٍّ ترحيلٌ ينشئ جدولَه.`)
  process.exit(0)
}

console.error(`✘ ${missing.length} نموذجا في المخطَّط بلا ترحيلٍ ينشئ جدولَه:`)
for (const m of missing) console.error(`   · ${m.model}  (الجدول: ${m.table})`)
console.error('\n   الخادمُ سينادي جدولا لا وجودَ له على قاعدةٍ مرحَّلةٍ من الصفر.')
console.error('   الإصلاح: أنشئ ملفَّ ترحيلٍ ينشئ الجدول، أو احذف النموذجَ من المخطَّط.')
process.exit(1)
