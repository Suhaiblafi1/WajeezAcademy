/* إعداد قاعدة اختبار معزولة — wajeez_test على PostgreSQL المدمج نفسه.
   يهيئ مرة واحدة لكل عملية: ينشئ القاعدة، ينشر الترحيلات، يبذر الصلاحيات، يستورد الكتالوج. */

import { execSync } from 'node:child_process'
import pg from 'pg'
import { ensureEmbeddedPostgres } from '../../db/embedded'

export const TEST_DATABASE_URL = 'postgresql://wajeez:wajeez_local@localhost:5433/wajeez_test'

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

export function setupTestDb(): Promise<void> {
  if (ready) return ready
  ready = (async () => {
    await ensureEmbeddedPostgres()
    /* إسقاط قاعدة الاختبار وإعادة إنشائها — عزل كامل عن التشغيلات السابقة */
    const admin = new pg.Client({ connectionString: 'postgresql://wajeez:wajeez_local@localhost:5433/wajeez' })
    await admin.connect()
    await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'wajeez_test' AND pid <> pg_backend_pid()`)
    await admin.query('DROP DATABASE IF EXISTS wajeez_test')
    await admin.query('CREATE DATABASE wajeez_test')
    await admin.end()

    /* نشر الترحيلات على قاعدة الاختبار */
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: ['ignore', 'ignore', 'inherit'],
    })

    /* بذر الصلاحيات + استيراد الكتالوج — القاعدة أعيد بناؤها للتو فالاستيراد دائم */
    const { PrismaClient } = await import('@prisma/client')
    const { PrismaPg } = await import('@prisma/adapter-pg')
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }) })
    const { seedRbac } = await import('../../auth/rbac-seed')
    await seedRbac(prisma)
    const { importCatalog } = await import('../../catalog/importer')
    await importCatalog(prisma)
    await prisma.$disconnect()
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
