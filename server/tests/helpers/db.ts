/* إعداد قاعدة اختبار معزولة — wajeez_test على PostgreSQL المدمج نفسه.

   ═══ العزلُ نفسُه، والكلفةُ عُشرُها — قالبٌ يُبنى مرّةً ويُنسَخ ═══

   كان كلُّ ملفّ اختبارٍ **يبني القاعدةَ من الصفر**: إسقاطٌ وإنشاءٌ ثمّ
   `prisma migrate deploy` ثمّ بذرُ الصلاحيّات ثمّ استيرادُ الكتالوج. وقِيس
   ذلك: ١٤–١٦ ثانيةً للملفّ الواحد. ومئةٌ وواحدٌ من ملفّاتِ الاختبار تحتاج
   قاعدةً، والملفّاتُ تجري **بالتتابع** (`fileParallelism: false`) — فالجولةُ
   بين خمسَ عشرةَ وثلاثين دقيقة، وسقفُها في CI ثلاثون.

   وقد بلغته فعلا في ٨ سبتمبر ٢٠٢٦: جولةٌ أُلغيت عند الثلاثين والاختباراتُ
   تمرّ واحدا بعد واحد، لا عُطبَ فيها ولا تعليق — نفدَ الوقتُ لا أكثر. وكلفةُ
   ذلك دورةُ نشرٍ كاملةٌ ضاعت على تغييرٍ لا يمسّ الخادمَ أصلا.

   ── ولماذا كان يُبنى لكلّ ملفّ ──

   `ready` تُخزَّن في وحدةٍ، وكان الظنُّ أنّ العواملَ تُعاد فتتقاسم القاعدة.
   **وليس كذلك**: vitest يشغّل كلَّ ملفٍّ في عمليّةٍ مستقلّةٍ حتّى مع
   `--no-file-parallelism` — وهو مكتوبٌ صراحةً في `global-setup.ts`. فالخزنُ
   لا يعبر ملفّا، والبناءُ يُعاد مئةً ومرّة.

   ── والعلاجُ لا يُضحّي بالعزل ──

   القاعدةُ المبذورةُ تُبنى **مرّةً واحدةً** في `global-setup` باسم
   `wajeez_test_template`، ثمّ يأخذ كلُّ ملفّ نسخةً منها:

       CREATE DATABASE wajeez_test TEMPLATE wajeez_test_template

   وPostgreSQL ينسخ القالبَ نسخا على مستوى الملفّات — أقلَّ من ثانية. فكلُّ
   ملفٍّ يبدأ بقاعدةٍ **نظيفةٍ كما كان تماما**: لا مشاركةَ حالةٍ بين الملفّات،
   ولا يتغيّر شيءٌ ممّا تعتمد عليه الاختبارات. الفرقُ في الكلفة وحدَها.

   ⚠️ وشرطُ النسخ: لا اتّصالَ مفتوحا على القالب. ولذلك يُغلَق كلُّ اتّصالٍ
   بعد بنائه، وتُقطَع المتبقّياتُ قبل كلّ نسخة — وإلّا ردّ الخادمُ
   «source database is being accessed by other users» وسقطت الجولةُ كلُّها
   برسالةٍ لا تدلّ على سببها. */

import { execSync } from 'node:child_process'
import pg from 'pg'
import { ensureEmbeddedPostgres } from '../../db/embedded'

export const TEST_DATABASE_URL = 'postgresql://wajeez:wajeez_local@localhost:5433/wajeez_test'
/** القالبُ المبذور — يُبنى مرّةً في `global-setup` ولا يُكتب فيه بعدها */
export const TEMPLATE_DATABASE = 'wajeez_test_template'
const TEMPLATE_URL = `postgresql://wajeez:wajeez_local@localhost:5433/${TEMPLATE_DATABASE}`
const ADMIN_URL = 'postgresql://wajeez:wajeez_local@localhost:5433/wajeez'

let ready: Promise<void> | null = null

/* ─────────── ولمن يمحو الجدولَ كلَّه: بابُ إعادةِ البناء ───────────

   `ready` تُحفظ **لكلّ عمليّة** لا لكلّ ملفّ. وvitest يعيد استعمالَ العامل
   مع `--no-file-parallelism`، فالملفّاتُ المتتاليةُ في العامل نفسِه **تتقاسم
   قاعدةً واحدة**. وهذا مقبولٌ ما دام كلُّ ملفٍّ يكتب صفوفَه ويقرؤها.

   ويسقط حين يمحو ملفٌّ **صفوفَ غيره**: اختبارُ إعادة ضبط الحسابات (البند ٦٦)
   يمحو كلَّ حسابٍ غيرِ محميّ — فيذهب معه ما أنشأته ملفّاتٌ تليه في العامل
   نفسِه، فتسقط اختباراتُ المصادقة برسالةٍ لا تدلّ على السبب: «المستخدم غير
   موجود». وقد وقع ذلك فعلا: ثلاثةُ إخفاقاتٍ في CI تمرّ محلّيّا حين تُشغَّل
   ملفّاتُها وحدَها.

   فمن يمحو جماعةً يعيد البناءَ بعده. */
export function rebuildTestDb(): Promise<void> {
  ready = null
  return setupTestDb()
}

/** يقطع كلَّ اتّصالٍ بقاعدةٍ بعينها — شرطُ إسقاطِها أو النسخِ عنها */
async function disconnectAll(admin: pg.Client, db: string): Promise<void> {
  await admin.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [db],
  )
}

/* ═══ بناءُ القالب — مرّةً واحدةً للجولة كلِّها ═══

   يُستدعى من `global-setup.ts` في العمليّة الأمّ قبل أوّل عامل. وهو الموضعُ
   الوحيدُ الذي تُنشَر فيه الترحيلاتُ ويُبذَر فيه شيء. */
export async function buildTemplateDb(): Promise<void> {
  await ensureEmbeddedPostgres()
  const admin = new pg.Client({ connectionString: ADMIN_URL })
  await admin.connect()
  await disconnectAll(admin, TEMPLATE_DATABASE)
  await admin.query(`DROP DATABASE IF EXISTS ${TEMPLATE_DATABASE}`)
  await admin.query(`CREATE DATABASE ${TEMPLATE_DATABASE}`)
  await admin.end()

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEMPLATE_URL },
    stdio: ['ignore', 'ignore', 'inherit'],
  })

  const { PrismaClient } = await import('@prisma/client')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: TEMPLATE_URL }) })
  const { seedRbac } = await import('../../auth/rbac-seed')
  await seedRbac(prisma)
  const { importCatalog } = await import('../../catalog/importer')
  await importCatalog(prisma)
  /* ولا بدّ من الفصل: اتّصالٌ باقٍ على القالب يمنع النسخَ عنه */
  await prisma.$disconnect()
}

export function setupTestDb(): Promise<void> {
  if (ready) return ready
  ready = (async () => {
    await ensureEmbeddedPostgres()
    const admin = new pg.Client({ connectionString: ADMIN_URL })
    await admin.connect()
    try {
      /* نسخةٌ نظيفةٌ عن القالب — عزلٌ كاملٌ عن الملفّ الذي سبق */
      await disconnectAll(admin, 'wajeez_test')
      await admin.query('DROP DATABASE IF EXISTS wajeez_test')
      await disconnectAll(admin, TEMPLATE_DATABASE)
      await admin.query(`CREATE DATABASE wajeez_test TEMPLATE ${TEMPLATE_DATABASE}`)
    } catch (e) {
      /* رسالةٌ تدلّ على السبب: «لا قالب» تعني أنّ `global-setup` لم يجرِ —
         وهو ما يقع لمن شغّل vitest بلا `-c vitest.server.config.ts`. */
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(
        `تعذّر تجهيزُ قاعدة الاختبار من القالب (${msg}).\n`
        + `القالبُ يُبنى في global-setup — شغّل جولةَ الخادم بإعدادها: `
        + `npx vitest run -c vitest.server.config.ts`,
      )
    } finally {
      await admin.end()
    }
  })()
  return ready
}

/** عميل Prisma مباشر على قاعدة الاختبار */
export async function testPrisma() {
  await setupTestDb()
  const { PrismaClient } = await import('@prisma/client')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }) })
}
