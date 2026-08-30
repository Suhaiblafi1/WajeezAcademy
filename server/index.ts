/* نقطة تشغيل خادم API — يضمن قاعدة البيانات (المدمجة أو DATABASE_URL) ثم يستمع */

import { getPrisma } from './db/client'
import { seedRbac } from './auth/rbac-seed'
import { buildApp } from './http/app'

const main = async () => {
  const prisma = await getPrisma()
  await seedRbac(prisma) // idempotent — يضمن الأدوار والصلاحيات عند كل إقلاع
  const app = await buildApp(prisma)
  const port = Number(process.env.API_PORT ?? 7101)
  /* العنوان قابل للضبط، وافتراضه المغلق لا المفتوح.
     على الجهاز 127.0.0.1 هو الصواب: لا يُنصت الخادم على الشبكة بلا قصد.
     وداخل حاوية Docker هذا العنوان يعني «داخل الحاوية وحدها» فلا يصل إليه
     الوسيط العكسي أبدا — فتُضبط API_HOST=0.0.0.0 هناك. والحاوية نفسها لا
     تنشر منفذها إلى المضيف (انظر deploy/compose.prod.yml)، فالانفتاح داخل
     شبكة Docker الخاصة لا على الإنترنت. */
  const host = process.env.API_HOST ?? '127.0.0.1'
  await app.listen({ port, host })
  console.log(`✅ خادم وجيز يعمل: http://localhost:${port} — التوثيق: http://localhost:${port}/docs`)
}

process.on('uncaughtException', (e) => { if (!/terminat/i.test(String(e))) throw e })
main().catch((e) => { console.error(e); process.exit(1) })
