/* نقطة تشغيل خادم API — يضمن قاعدة البيانات (المدمجة أو DATABASE_URL) ثم يستمع */

import { getPrisma } from './db/client'
import { ensureRbacSeeded } from './auth/rbac-seed'
import { ensureFoundersPromoted } from './auth/founders'
import { buildApp } from './http/app'

const main = async () => {
  const prisma = await getPrisma()
  await ensureRbacSeeded(prisma) // فحصٌ واحد، ويبذر إن نقص
  await announceFounders(prisma)
  const app = await buildApp(prisma)
  warnOnDerivedStorageSecret(app)
  const port = Number(process.env.API_PORT ?? 7101)
  /* العنوان قابل للضبط، وافتراضه المغلق لا المفتوح.
     على الجهاز 127.0.0.1 هو الصواب: لا يُنصت الخادم على الشبكة بلا قصد.
     وعلى الإنتاج يُضبط `API_HOST=0.0.0.0` في `deploy/compose.prod.yml`، لأنّ
     الوسيطَ العكسيّ (Caddy) حاويةٌ أخرى تبلغه باسمه `app:7101` عبر شبكة
     Docker — ولا يُنشَر منفذُه إلى المضيف، فالانفتاحُ داخلَ الشبكة وحدَها. */
  const host = process.env.API_HOST ?? '127.0.0.1'
  await app.listen({ port, host })
  console.log(`✅ خادم وجيز يعمل: http://localhost:${port} — التوثيق: http://localhost:${port}/docs`)
}

/* ترقيةُ المؤسِّسين تُعلَن ولا تُسقط الإقلاع.

   خادمٌ يرفض الإقلاعَ لأنّ ترقيةً تعذّرت يُنزل الموقعَ كلَّه من أجل لوحةِ
   إدارة. فيُقال في السجلّ ويُخدَم الموقع، وتُعاد المحاولةُ في الإقلاع
   التالي — وهي آمنةُ الإعادة. */
async function announceFounders(prisma: Awaited<ReturnType<typeof getPrisma>>): Promise<void> {
  try {
    const r = await ensureFoundersPromoted(prisma)
    for (const e of r.promoted) console.log(`⬆️  رُقّي إلى مدير النظام: ${e}`)
    for (const e of r.missing) {
      console.log(`ℹ️  مؤسِّسٌ بلا حساب: ${e} — يسجّل من /auth ثمّ يُرقّى في الإقلاع التالي`)
    }
  } catch (e) {
    console.error(`⚠️  تعذّرت ترقيةُ المؤسِّسين: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/* مفتاحُ توقيع الروابط يُشتقّ من DATABASE_URL حين لا يُضبط صريحا (انظر
   storage.service.ts). وهذا يعمل — إلى أن يتغيّر عنوانُ القاعدة: فينقلب كلُّ
   رابطٍ موقّعٍ سابقٍ إلى «رابط غير صالح»، ووثائقُ المتقدّمين المخزَّنةُ تصير
   غيرَ قابلةٍ للفتح. ونقلُ الاستضافة يغيّر العنوانَ بالضرورة. فالصمتُ هنا
   خطر، والسطرُ التالي يجعله مسموعا قبل النقل لا بعده. */
function warnOnDerivedStorageSecret(app: { log: { warn: (msg: string) => void } }): void {
  if (process.env.STORAGE_SECRET) return
  if (process.env.NODE_ENV !== 'production') return
  app.log.warn(
    'STORAGE_SECRET غير مضبوط — مفتاحُ توقيع الروابط مشتقٌّ من DATABASE_URL. ' +
    'اضبطه بقيمةٍ ثابتةٍ قبل أيّ تغييرٍ لعنوان القاعدة (نقلُ الاستضافة)، وإلّا صارت الوثائقُ المخزَّنةُ غيرَ قابلةٍ للفتح.',
  )
}

process.on('uncaughtException', (e) => { if (!/terminat/i.test(String(e))) throw e })
main().catch((e) => { console.error(e); process.exit(1) })
