/* PostgreSQL مدمج للتطوير المحلي — بديل Docker عند غيابه على الجهاز.
   قاعدة حقيقية (لا محاكاة): نفس binaries الرسمية، بياناتها في .pgdata/
   وتُهمَل من Git. في الإنتاج أو مع Docker: عيّن DATABASE_URL ولا يُستخدم هذا. */

import EmbeddedPostgres from 'embedded-postgres'
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

let instance: EmbeddedPostgres | null = null

/** يشغّل PostgreSQL المدمج ويعيد رابط الاتصال — idempotent: يعيد استخدام الجاري */
export async function ensureEmbeddedPostgres(): Promise<string> {
  if (process.env.DATABASE_URL && process.env.WAJEEZ_EMBEDDED_PG !== '1') {
    return process.env.DATABASE_URL
  }
  if (!instance) {
    /* نسخة حية من عملية أخرى (مثل خادم API) — نستخدمها ولا نبدأ منافسا */
    if (await portAlive(EMBEDDED_PG.port)) return EMBEDDED_DATABASE_URL
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
