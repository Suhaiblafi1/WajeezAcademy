/* التعليقُ عقدٌ، أو ليس شيئا.

   خمسةٌ وخمسون عمودا في المخطّط تحمل حالةً نصّيّةً، وقيمُها المسموحة مكتوبةٌ
   في **تعليقٍ** بجانبها: `status String @default("draft") // draft | published`.
   والتعليقُ لا يمنع شيئا: خطأٌ مطبعيٌّ واحدٌ (`publised`) يصنع حالةً جديدةً
   لا تعرفها الواجهةُ ولا التقاريرُ ولا أحد — وتبقى في القاعدة سنينَ لا
   يكتشفها إلّا من يسأل «لماذا هذا الصفُّ لا يظهر؟».

   والحلُّ الكامل أنواعٌ مُعدَّدةٌ في القاعدة (enum)، وهي تغييرٌ يمسّ نوعَ كلّ
   قراءةٍ وكتابةٍ في الشيفرة. وهذا الملفُّ يُنجز **الحرسَ نفسَه** بلا مساسٍ
   بحرفٍ من TypeScript: قيدُ `CHECK` على كلّ عمود، مشتقٌّ من تعليقه.

   فيصير التعليقُ هو العقد: من أراد حالةً جديدةً كتبها في التعليق أوّلا، ثمّ
   ولّد الترحيل. ومن كتبها في الشيفرة وحدَها ردّته القاعدة.

   الاستعمال:
     npx tsx scripts/status-checks.ts            # يطبع SQL الترحيل
     npx tsx scripts/status-checks.ts --check    # يقابل القاعدةَ الحيّةَ بالمخطّط

   ── وأين الحاجزُ في CI؟ ليس هنا ──

   `--check` أداةٌ محلّيّةٌ تتّصل بقاعدةِ التطويرِ عندك، **فتحمرّ إن كانت
   متأخّرةً عن الترحيلات** — وهذا وضعٌ شائعٌ ولا يعني شيئا عن الشيفرة.

   والحاجزُ الحقيقيُّ في CI هو `server/tests/schema/status-constraints.test.ts`:
   يجري في وظيفة `server` على قاعدةٍ **مُرحَّلةٍ من الصفر**، ويفحص ما يفحصه
   هذا السكربتُ وزيادةً — أنّ القيدَ **يمنع فعلا** (تُكتب حالةٌ ممنوعةٌ
   ويُنتظَر الرفض)، وأنّ المُفسِّرَ لم ينكسر فيجد أعمدةً أقلَّ ممّا ينبغي.

   وقد ضلّ هذا الرأسُ قارئا مرّةً فقرأ اسمَ `ci:status-checks` في
   `package.json`، ولم يجده في `.github/workflows/ci.yml`، فاستنتج أنّ الحاجزَ
   لا يُنادى — وهو يُنادى بصيغةٍ أقوى. فكُتب هذا هنا كي لا يتكرّر.

   ولا يُشمل عمودٌ إلّا إذا كان تعليقُه قائمةً نظيفةً: قيمٌ بحروفٍ صغيرةٍ
   وشُرَطٍ سفليّة، مفصولةً بـ`|`. وما بعد «—» شرحٌ يُقطع. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export interface StatusColumn {
  model: string
  field: string
  values: string[]
}

/** الأسماءُ التي تُقرأ حالةً — لا كلُّ عمودٍ نصّيٍّ له تعليق */
const STATUS_NAMES = /^(status|state|kind|type|level|result|outcome)$/

export function statusColumns(schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8')): StatusColumn[] {
  const out: StatusColumn[] = []
  let model: string | null = null
  for (const line of schema.split('\n')) {
    const m = /^model\s+(\w+)\s*\{/.exec(line)
    if (m) { model = m[1]; continue }
    if (/^\}/.test(line)) { model = null; continue }
    if (!model) continue
    const c = /^\s*(\w+)\s+String\??\s.*?\/\/\s*(.+)$/.exec(line)
    if (!c) continue
    const [, field, comment] = c
    if (!STATUS_NAMES.test(field)) continue
    const head = comment.split('—')[0].split(' - ')[0].trim()
    if (!head.includes('|')) continue
    const values = head.split('|').map((v) => v.trim()).filter(Boolean)
    if (values.length < 2 || values.some((v) => !/^[a-z0-9_]+$/.test(v))) continue
    out.push({ model, field, values })
  }
  return out
}

/** اسمُ القيد — ثابتٌ كي يُعاد توليدُه بلا تكرار */
export function checkName(c: StatusColumn): string {
  return `${c.model}_${c.field}_allowed`
}

export function checkSql(c: StatusColumn): string {
  const list = c.values.map((v) => `'${v}'`).join(', ')
  return `ALTER TABLE "${c.model}" DROP CONSTRAINT IF EXISTS "${checkName(c)}";\n` +
    `ALTER TABLE "${c.model}" ADD CONSTRAINT "${checkName(c)}" ` +
    `CHECK ("${c.field}" IN (${list}));`
}

async function main() {
  const cols = statusColumns()
  if (!process.argv.includes('--check')) {
    console.log('-- مولَّدٌ من تعليقات المخطّط: npx tsx scripts/status-checks.ts')
    console.log(`-- ${cols.length} عمودَ حالةٍ، قيمُ كلٍّ منها من تعليقه\n`)
    for (const c of cols) console.log(`${checkSql(c)}\n`)
    return
  }

  const { default: pg } = await import('pg')
  const url = process.env.DATABASE_URL ?? 'postgresql://wajeez:wajeez_local@localhost:5433/wajeez'
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  const { rows } = await client.query<{ conname: string; def: string }>(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE contype = 'c'`,
  )
  await client.end()
  const live = new Map(rows.map((r) => [r.conname, r.def]))

  const missing: string[] = []
  const stale: string[] = []
  for (const c of cols) {
    const def = live.get(checkName(c))
    if (!def) { missing.push(`${c.model}.${c.field}`); continue }
    for (const v of c.values) {
      if (!def.includes(`'${v}'`)) stale.push(`${c.model}.${c.field} — «${v}» في التعليق وليست في القيد`)
    }
  }
  if (missing.length === 0 && stale.length === 0) {
    console.log(`✅ ${cols.length} عمودَ حالةٍ، ولكلٍّ قيدٌ يطابق تعليقَه.`)
    return
  }
  if (missing.length) console.error(`❌ بلا قيد (${missing.length}):\n  ${missing.join('\n  ')}`)
  if (stale.length) console.error(`❌ قيدٌ متأخّرٌ عن تعليقه (${stale.length}):\n  ${stale.join('\n  ')}`)
  console.error('\nولّد الترحيلَ من جديد: npx tsx scripts/status-checks.ts > prisma/migrations/<جديد>/migration.sql')
  process.exit(1)
}

if (process.argv[1]?.includes('status-checks')) void main()
