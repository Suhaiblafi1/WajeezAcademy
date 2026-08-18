/* نقطة تشغيل خادم API — يضمن قاعدة البيانات (المدمجة أو DATABASE_URL) ثم يستمع */

import { getPrisma } from './db/client'
import { seedRbac } from './auth/rbac-seed'
import { buildApp } from './http/app'

const main = async () => {
  const prisma = await getPrisma()
  await seedRbac(prisma) // idempotent — يضمن الأدوار والصلاحيات عند كل إقلاع
  const app = await buildApp(prisma)
  const port = Number(process.env.API_PORT ?? 7101)
  await app.listen({ port, host: '127.0.0.1' })
  console.log(`✅ خادم وجيز يعمل: http://localhost:${port} — التوثيق: http://localhost:${port}/docs`)
}

process.on('uncaughtException', (e) => { if (!/terminat/i.test(String(e))) throw e })
main().catch((e) => { console.error(e); process.exit(1) })
