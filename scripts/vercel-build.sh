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
