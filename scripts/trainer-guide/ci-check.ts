/* ═══ بذرُ الدليل في CI — على قاعدةٍ جديدةٍ من الصفر (٤ أكتوبر ٢٠٢٦) ═══

   صار مشروعُ التخرّج شرطا في قائمة التجهيز (٣٠ سبتمبر ٢٠٢٦)، فوقف
   `npm run guide:seed` عند «بقي قبل الإرسال: ضع مشروعَ التخرّج» أيّاما ولم يحمرّ
   شيء: لا شيءَ في CI يشغّله، فلم يُعرف إلّا حين احتاجه من يصوّر الدليل (⑬). فقال
   صاحبُ المنصّة: «add the seed to CI» — قاعدةٌ جديدةٌ في مسار الخطط تُسقطه هنا،
   في الطلب الذي جاء بها، لا عند من يحتاجه بعد أسبوع.

   · **قاعدةٌ جديدةٌ في كلّ مرّة** (`wajeez_guide_ci`) لا قاعدةُ المطوّر: البذرُ
     يكتب حساباتِ الديمو والدليل، واستيرادُ الكتالوج ينشر إصدارا. وعلى عدّاءٍ بارد
     العنقودُ فارغٌ أصلا — فيُبنى كلُّ ما يحتاجه هنا (`ci-gates-wired.test.ts`:
     «أتحتاج قاعدةً؟ مُرحَّلة؟ بذرا؟»).
   · **وما يسبقه كما يسبقه عند المطوّر**: الترحيلاتُ، فالكتالوجُ، فبذرُ الديمو
     (حسابُ الإدارة الذي يعتمد به البذرُ) — ثمّ البذرُ بأمره نفسِه
     (`scripts/trainer-guide/seed.ts`) لا بنسخةٍ منه.
   · **والحكمُ على ما بلغه لا على خروجه وحدَه**: في البذر حرّاسٌ يتخطّون بصمت
     (`if (!link) return`) — فبذرٌ لم يجد شعبتَه يخرج بصفرٍ ولم يصنع شيئا. فيُفحص
     بعده ما يقوم عليه الدليل: الحسابان، وخطّتا شعبتَي التفاوض معتمَدتان ولكلٍّ
     مشروعُ تخرّج، وشعبةُ الإعداد بخطّتها المحفوظة.

   التشغيل: `npm run ci:guide-seed` (بغلاف `with-db`). */

import { execFileSync } from 'node:child_process'
import pg from 'pg'
import { GUIDE_ACCOUNTS } from './accounts'

const BASE = process.env.DATABASE_URL
if (!BASE) throw new Error('لا DATABASE_URL — شغّله بغلاف القاعدة: npm run ci:guide-seed')
const DB = 'wajeez_guide_ci'
const target = new URL(BASE)
target.pathname = `/${DB}`

/* ① قاعدةٌ جديدة — يُتّصل بالقاعدة التي مرّرها الغلافُ لتُنشأ أختُها بجانبها */
{
  const admin = new pg.Client({ connectionString: BASE })
  await admin.connect()
  await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`)
  await admin.query(`CREATE DATABASE ${DB}`)
  await admin.end()
}

/* ② ما يسبق البذرَ ثمّ البذرُ نفسُه — كلٌّ بأمره، والسقوطُ يُسقط الخطوة */
const env = { ...process.env, DATABASE_URL: target.toString(), CATALOG_IMPORT_SKIP_MIGRATE: '1' }
const step = (label: string, args: string[]) => {
  console.log(`\n▶ ${label}`)
  execFileSync('npx', args, { stdio: 'inherit', env })
}
step('الترحيلات', ['prisma', 'migrate', 'deploy'])
step('الكتالوج', ['tsx', 'scripts/import-catalog.ts'])
step('بذرُ الديمو', ['tsx', 'server/db/seed-demo.ts'])
step('بذرُ الدليل', ['tsx', 'scripts/trainer-guide/seed.ts'])

/* ③ ما بلغه — لا خروجُه وحدَه */
const db = new pg.Client({ connectionString: target.toString() })
await db.connect()
const problems: string[] = []

const accounts = Object.values(GUIDE_ACCOUNTS).map((a) => a.email)
const found = (await db.query<{ email: string }>('SELECT email FROM "User" WHERE email = ANY($1)', [accounts])).rows.map((r) => r.email)
for (const email of accounts) if (!found.includes(email)) problems.push(`لا حسابَ ${email}`)

/* شعبُ المدرّب النشط بخططها ومشاريعها — بطلبه لا بأسماء الشعب، فلا يُكرَّر هنا ما في البذر */
const cohorts = (await db.query<{ title: string; approved: boolean; draft: boolean; projects: number }>(`
  SELECT co.title,
         bool_or(p.status IN ('approved', 'published')) AS approved,
         bool_or(p.status = 'draft') AS draft,
         (SELECT count(*)::int FROM "CohortAssessment" a WHERE a."cohortId" = co.id AND a.type = 'project') AS projects
  FROM "TrainerApplication" app
  JOIN "TrainerProfile" tp ON tp."applicationId" = app.id
  JOIN "CohortTrainer" ct ON ct."profileId" = tp.id
  JOIN "Cohort" co ON co.id = ct."cohortId"
  LEFT JOIN "CohortDeliveryPlan" p ON p."cohortId" = co.id AND p."trainerId" IS NOT NULL
  WHERE app.email = $1
  GROUP BY co.id, co.title`, [GUIDE_ACCOUNTS.active.email])).rows

const approved = cohorts.filter((c) => c.approved)
if (approved.length < 2) {
  problems.push(`عددُ خطط المدرّب النشط المعتمَدة ${approved.length} لا اثنتان — لم يبلغ البذرُ اعتمادَ شعبتَي التفاوض`)
}
for (const c of approved) if (c.projects < 1) problems.push(`«${c.title}» معتمَدةٌ بلا مشروع تخرّج`)
if (!cohorts.some((c) => c.draft && !c.approved)) problems.push('لا شعبةَ إعدادٍ بخطّةٍ محفوظةٍ للمدرّب النشط')

await db.end()
if (problems.length) {
  console.error(`\n❌ بذرُ الدليل لم يبلغ ما يقوم عليه الدليل:\n${problems.map((p) => `   · ${p}`).join('\n')}`)
  process.exit(1)
}
console.log(`\n✅ بذرُ الدليل تمّ على قاعدةٍ جديدة — الحسابان، والخططُ المعتمَدةُ بمشاريعها: ${approved.length}، وشعبةُ الإعداد بخطّتها`)
