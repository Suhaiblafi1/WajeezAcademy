/* فحص اتصال سريع: عدد الجداول وجاهزية النماذج */
import { getPrisma, disconnectPrisma } from '../server/db/client'
import { stopEmbeddedPostgres } from '../server/db/embedded'

const prisma = await getPrisma()
const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(
  "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'",
)
console.log('عدد الجداول في القاعدة:', rows[0]?.n)
console.log('نماذج جاهزة:', ['pathway', 'course', 'skill', 'question', 'user', 'diagnosticSession']
  .map((m) => `${m}:${typeof (prisma as unknown as Record<string, { count: unknown }>)[m]?.count === 'function' ? 'ok' : 'missing'}`).join(' '))
await disconnectPrisma()
/* سباق إغلاق معروف عند إيقاف القاعدة المدمجة — رسالة pg الآمنة لا تعني فشلا */
process.on('uncaughtException', (e) => {
  if (String(e).includes('terminat')) process.exit(0)
  throw e
})
await stopEmbeddedPostgres()
