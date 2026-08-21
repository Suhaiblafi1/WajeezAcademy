/* واجهة سطر أوامر للمستورد: تهيئة القاعدة → نشر migrations → بذر الصلاحيات → استيراد.
   idempotent: شغّله مرتين ولن يتكرر أي سجل — التقرير يثبت ذلك. */
import { execSync } from 'node:child_process'
import { getPrisma, disconnectPrisma } from '../server/db/client'
import { stopEmbeddedPostgres } from '../server/db/embedded'
import { importCatalog } from '../server/catalog/importer'
import { seedRbac } from '../server/auth/rbac-seed'

const prisma = await getPrisma()
const url = process.env.DATABASE_URL!

console.log('① نشر migrations…')
execSync('npx prisma migrate deploy', { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url } })

console.log('② بذر الأدوار والصلاحيات…')
const rbac = await seedRbac(prisma)
console.log(`   ${rbac.roles} أدوار · ${rbac.permissions} صلاحية · ${rbac.grants} منحة`)

console.log('③ استيراد الكتالوج…')
const s = await importCatalog(prisma)
console.log('   ── تقرير الاستيراد ──')
console.log(`   ${s.pathways} مسارا · ${s.templates} قالبا · ${s.courses} دورة · ${s.modules} وحدة`)
console.log(`   ${s.skills} مهارة · ${s.questions} سؤالا (${s.options} خيارا) · ${s.references} مراجع`)
console.log(`   ${s.links} علاقة مرجعية · ${s.diagnosticProfiles} ملفا تشخيصيا · ${s.pathwayDomains} ربط مجال`)
console.log(`   إصدار الكتالوج: ${s.catalogVersionId} ${s.catalogVersionCreated ? '(أُنشئ ونُشر الآن)' : '(موجود — لم يتكرر)'}`)
console.log(`   بصمة اللقطة: ${s.snapshotHash.slice(0, 16)}…`)

await disconnectPrisma()
/* سباق إغلاق معروف عند إيقاف القاعدة المدمجة — رسالة pg الآمنة لا تعني فشلا */
process.on('uncaughtException', (e) => {
  if (String(e).includes('terminat')) process.exit(0)
  throw e
})
await stopEmbeddedPostgres()
console.log('✅ اكتمل الاستيراد')
