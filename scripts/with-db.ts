#!/usr/bin/env node
/* غلاف أوامر قاعدة البيانات: يشغّل PostgreSQL المدمج، يمرر DATABASE_URL
   للأمر المطلوب، ثم يبقي القاعدة حية عبر عملية منفصلة خفيفة.

   الاستعمال:
     node scripts/with-db.mjs <command...>
   مثال:
     node scripts/with-db.mjs npx prisma migrate deploy
*/
import { spawn } from 'node:child_process'
import { ensureEmbeddedPostgres } from '../server/db/embedded.ts'

const url = await ensureEmbeddedPostgres()
const cmd = process.argv[2]
if (!cmd) {
  console.log(`DATABASE_URL=${url}`)
  process.exit(0)
}
const child = spawn(cmd, process.argv.slice(3), {
  stdio: 'inherit',
  shell: false,
  env: { ...process.env, DATABASE_URL: url, WAJEEZ_EMBEDDED_PG: '1' },
})
child.on('exit', (code) => process.exit(code ?? 0))
