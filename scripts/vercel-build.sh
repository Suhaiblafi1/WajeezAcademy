#!/usr/bin/env bash
# بناء Vercel: توليد Prisma + نشر الهجرات بإعادة محاولة + بناء الواجهة + تجميع API.
#
# لماذا إعادة المحاولة؟ كل دفع إلى GitHub يطلق بناءين معًا (إنتاج + معاينة)،
# وكلاهما ينفّذ `prisma migrate deploy` على نفس قاعدة Neon — فيتزاحمان على
# القفل الاستشاري (pg_advisory_lock) ويسقط أحدهما بخطأ P1002 بعد 10 ثوان.
# الحل: 4 محاولات بفواصل متزايدة؛ من يخسر القفل ينتظر ثم يكمل بسلام.
set -e

npx prisma generate

attempt=1
max=4
until npx prisma migrate deploy; do
  if [ "$attempt" -ge "$max" ]; then
    echo "migrate deploy failed after $max attempts"
    exit 1
  fi
  wait_s=$((attempt * 20))
  echo "migrate deploy attempt $attempt failed — retrying in ${wait_s}s (advisory lock race)"
  sleep "$wait_s"
  attempt=$((attempt + 1))
done

npm run build
node scripts/bundle-api.mjs

# ── استيراد الكتالوج إلى قاعدة الإنتاج ──
#
# الإنتاج وحده: نُسخ المعاينة تشترك مع الإنتاج في نفس قاعدة Neon، فلو استوردت
# لكتبت محتوى فرع قيد المراجعة في جداول الموقع الحي.
#
# ولا يُسقِط البناء عند الإخفاق: الاستيراد يمسّ الجداول فقط، والمحرك يقرأ
# اللقطة المنشورة — فإخفاقه لا يغيّر حرفا واحدا لدى المستخدم، بينما إسقاط
# البناء يمنع نشر الموقع كله. نعلنه صراحة في السجل ونكمل.
#
# وهو لا ينشر: بعده تُفتح /admin/publishing وتُنشر لقطة جديدة، وإلا ظل
# المحرك يقرأ الكتالوج السابق. المستورد نفسه يقول ذلك في آخر تقريره.
if [ "$VERCEL_ENV" = "production" ]; then
  echo "── استيراد الكتالوج إلى قاعدة الإنتاج ──"
  if CATALOG_IMPORT_SKIP_MIGRATE=1 npm run catalog:import; then
    echo "✅ الجداول محدَّثة — يبقى نشر اللقطة من /admin/publishing"
  else
    echo "⚠️  أخفق استيراد الكتالوج — البناء يكمل، والموقع الحي لم يتأثر."
    echo "    أعده يدويا: DATABASE_URL=\"…\" npm run catalog:import"
  fi
else
  echo "تخطّي استيراد الكتالوج — البيئة '${VERCEL_ENV:-محلية}' وليست الإنتاج"
fi
