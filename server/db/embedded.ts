/* PostgreSQL مدمج للتطوير المحلي — بديل Docker عند غيابه على الجهاز.
   قاعدة حقيقية (لا محاكاة): نفس binaries الرسمية، بياناتها في .pgdata/
   وتُهمَل من Git. في الإنتاج أو مع Docker: عيّن DATABASE_URL ولا يُستخدم هذا. */

import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { existsSync } from 'node:fs'
import { createConnection } from 'node:net'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** هل المنفذ يقبل اتصالات؟ — نسخة مشغَّلة من عملية أخرى تُعاد استخدامها */
function portAlive(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createConnection({ port, host: '127.0.0.1' })
    s.once('connect', () => { s.destroy(); resolve(true) })
    s.once('error', () => resolve(false))
    s.setTimeout(1200, () => { s.destroy(); resolve(false) })
  })
}

export const EMBEDDED_PG = {
  port: 5433,
  user: 'wajeez',
  password: 'wajeez_local',
  database: 'wajeez',
  databaseDir: join(root, '.pgdata'),
}

export const EMBEDDED_DATABASE_URL =
  `postgresql://${EMBEDDED_PG.user}:${EMBEDDED_PG.password}@localhost:${EMBEDDED_PG.port}/${EMBEDDED_PG.database}`

/* المنفذ مفتوح لا يعني أن القاعدة تقبل اتصالا: بين «شُغِّلت» و«جاهزة» فجوة،
   وبين «تُطفأ» و«أُغلق المنفذ» فجوة أخرى. هذه الثانية هي ما كان يُسقط اختبارات
   الخادم في CI: vitest يشغّل كل ملف في عملية مستقلة (حتى مع --no-file-parallelism)،
   فتُطفأ نسخة الملف السابق بينما يفحص التالي المنفذ فيجده حيا ويتصل به وهو
   يُغلق — فيسقط بـ«the database system is shutting down» قبل أن يجري اختبار
   واحد. سقطت بهذا مرتين على ملفين مختلفين.

   العلاج: لا نكتفي بالمنفذ، بل نتصل فعلا ونستعلم. وإن كانت النسخة الحية في
   طور الإغلاق ننتظرها حتى تختفي ثم نشغّل نسختنا. */
async function acceptsConnections(url: string): Promise<boolean> {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 2000 })
  try {
    await client.connect()
    await client.query('SELECT 1')
    return true
  } catch {
    return false
  } finally {
    await client.end().catch(() => { /* أُغلق أصلا */ })
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** ينتظر حتى تقبل القاعدة اتصالا فعليا، أو ينتهي بمهلة */
async function waitUntilReady(url: string, timeoutMs: number): Promise<boolean> {
  const until = Date.now() + timeoutMs
  for (;;) {
    if (await acceptsConnections(url)) return true
    if (Date.now() >= until) return false
    await sleep(250)
  }
}

/** ينتظر اختفاء نسخة تُطفأ حتى لا نتصل بها ولا نصادم منفذها */
async function waitUntilPortFree(port: number, timeoutMs: number): Promise<boolean> {
  const until = Date.now() + timeoutMs
  for (;;) {
    if (!(await portAlive(port))) return true
    if (Date.now() >= until) return false
    await sleep(250)
  }
}

let instance: EmbeddedPostgres | null = null

/** يشغّل PostgreSQL المدمج ويعيد رابط الاتصال — idempotent: يعيد استخدام الجاري */
export async function ensureEmbeddedPostgres(): Promise<string> {
  if (process.env.DATABASE_URL && process.env.WAJEEZ_EMBEDDED_PG !== '1') {
    return process.env.DATABASE_URL
  }
  if (!instance) {
    /* نسخة حية من عملية أخرى (مثل خادم API) — نستخدمها ولا نبدأ منافسا،
       بشرط أن تكون جاهزة فعلا لا مجرد منفذ مفتوح */
    if (await portAlive(EMBEDDED_PG.port)) {
      if (await waitUntilReady(EMBEDDED_DATABASE_URL, 20_000)) return EMBEDDED_DATABASE_URL
      /* منفذ حيّ لا يقبل اتصالا = نسخة في طور الإغلاق. ننتظر انصرافها ثم نبدأ. */
      await waitUntilPortFree(EMBEDDED_PG.port, 30_000)
    }
    instance = new EmbeddedPostgres({
      databaseDir: EMBEDDED_PG.databaseDir,
      user: EMBEDDED_PG.user,
      password: EMBEDDED_PG.password,
      port: EMBEDDED_PG.port,
      persistent: true,
    })
    if (!existsSync(join(EMBEDDED_PG.databaseDir, 'PG_VERSION'))) {
      await instance.initialise()
    }
    await instance.start()
    /* «بدأت» لا تعني «جاهزة» — أول استعلام بعد start قد يسبق قبول الاتصالات */
    if (!(await waitUntilReady(EMBEDDED_DATABASE_URL, 30_000))) {
      throw new Error('تعذّر تشغيل PostgreSQL المدمج: بدأ ولم يقبل اتصالا خلال 30 ثانية')
    }
    try {
      await instance.createDatabase(EMBEDDED_PG.database)
    } catch {
      /* القاعدة موجودة من تشغيل سابق */
    }
  }
  return EMBEDDED_DATABASE_URL
}

export async function stopEmbeddedPostgres(): Promise<void> {
  if (instance) {
    await instance.stop()
    instance = null
  }
}
