#!/usr/bin/env bash
# نشرُ إصدارٍ جديد على الخادم — بترتيبٍ يجعل الفشل غير مؤذٍ.
#
#   bash deploy/deploy.sh            نشر من الفرع الحالي
#   SKIP_PULL=1 bash deploy/deploy.sh   نشر ما في مجلد العمل بلا جلب
#
# الترتيب مقصود: تُبنى الصورة الجديدة **قبل** لمس أيّ شيء يعمل. فإن فشل
# البناء أو الهجرة، الموقع القديم ما زال يخدم وكأن شيئا لم يكن. ولا يُبدَّل
# الحاويات إلا بعد أن تنجح الهجرة وتُبنى الصورة كاملة.

set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f deploy/compose.prod.yml --env-file deploy/.env.production"

step() { printf '\n\033[1m── %s ──\033[0m\n' "$1"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

[ -f deploy/.env.production ] || fail "لا يوجد deploy/.env.production — انسخه عن .env.production.example"

# ── مصدر أصل الموقع للفحص الصحي وللإصدار ──
SITE_DOMAIN="$(grep -E '^SITE_DOMAIN=' deploy/.env.production | cut -d= -f2-)"
[ -n "$SITE_DOMAIN" ] || fail "SITE_DOMAIN غير مضبوط في deploy/.env.production"

step "١/٧ · جلب الشيفرة"
if [ "${SKIP_PULL:-0}" != "1" ]; then
  git pull --ff-only
fi
COMMIT="$(git rev-parse --short HEAD)"
echo "الإصدار: $COMMIT"

step "٢/٧ · نسخة احتياطية قبل الهجرة"
# هجرةٌ تفشل في منتصفها أسوأ من هجرةٍ لا تبدأ. النسخة هنا لا هناك.
if $COMPOSE ps db --status running --quiet | grep -q .; then
  bash deploy/backup.sh --pre-deploy || fail "تعذّرت النسخة الاحتياطية — أُوقف النشر. لا تُهاجَر قاعدةٌ بلا نسخة."
else
  echo "القاعدة لا تعمل بعد (أوّل نشر؟) — لا نسخة تُؤخذ"
fi

step "٣/٧ · بناء الصورة الجديدة"
# البناء أولا: الموقع القديم يخدم طوال هذه الخطوة
#
# وبصمةُ الالتزام تُصدَّر إلى البناء: `.dockerignore` يستثني `.git`، فلا
# يستطيع `write-build-stamp.ts` قراءتَها من داخل الصورة. وبلا ذلك يقول
# `/api/version` «الالتزام: null» — فلا يُعرف أوصلت النشرةُ أم لا، وهو
# السؤالُ الذي بُني ذلك المسارُ للجواب عنه.
export GIT_COMMIT_SHA="$(git rev-parse HEAD 2>/dev/null || true)"
export GIT_COMMIT_REF="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
$COMPOSE build app || fail "أخفق البناء — الموقع القديم ما زال يعمل، لم يتغيّر شيء"

step "٤/٧ · تشغيل القاعدة وانتظار جاهزيتها"
$COMPOSE up -d db
for i in $(seq 1 30); do
  if $COMPOSE exec -T db pg_isready -q 2>/dev/null; then break; fi
  [ "$i" = 30 ] && fail "القاعدة لم تجهز خلال ٣٠ محاولة"
  sleep 2
done

step "٥/٧ · نشر الهجرات"
$COMPOSE run --rm --no-deps app npx prisma migrate deploy \
  || fail "أخفقت الهجرة — الحاويات لم تُبدَّل بعد، والموقع القديم يعمل. راجع السجل ثم أعد."

step "٦/٧ · تبديل الحاويات"
$COMPOSE up -d --remove-orphans

step "٧/٧ · الكتالوج ثم الفحص الصحي"
# الكتالوج لا يُسقط النشر: المحرّك يقرأ اللقطة المنشورة، فإخفاق الاستيراد
# لا يغيّر حرفا لدى المستخدم — بينما إسقاط النشر يمنع الموقع كله.
if $COMPOSE exec -T app npm run catalog:import; then
  $COMPOSE exec -T app npm run catalog:publish || echo "⚠️  أخفق نشر اللقطة — الموقع على اللقطة السابقة"
else
  echo "⚠️  أخفق استيراد الكتالوج — الموقع الحيّ لم يتأثر. أعده يدويا لاحقا."
fi

# ── الفحصان: داخليٌّ ثمّ عامّ، ولكلٍّ حكمُه ──
#
# كان الفحصُ واحدا على `https://$SITE_DOMAIN`. وخطّةُ النقل تقول صراحةً إنّ
# الحزمةَ الجديدة **تعمل بالتوازي على عنوانٍ مؤقّت قبل تحويل النطاق** — وفي
# تلك المدّة لا يشير النطاقُ إلى هذا الخادم بعد، فيسقط الفحصُ وينصح السكربتُ
# بالرجوع، **والنشرُ ناجحٌ تماما**. ونصيحةُ رجوعٍ في غير موضعها أسوأُ من لا
# نصيحة: تُدرّب المشغّلَ على تجاهل آخر سطرٍ في المخرَج.
#
# فصار الفحصُ داخليّا أوّلا (الخادمُ نفسُه يجيب في شبكة Docker)، ثمّ عامّا
# من الخارج. والحكمُ يفرّق بين ثلاث حالات لا حالتين.

internal=0
for i in $(seq 1 20); do
  if $COMPOSE exec -T app node -e \
      "fetch('http://127.0.0.1:'+(process.env.API_PORT||7101)+'/api/version').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
      >/dev/null 2>&1; then internal=1; break; fi
  sleep 3
done

if [ "$internal" != 1 ]; then
  printf '\n\033[31m✗ الخادم نفسُه لا يجيب — هذا إخفاقُ نشرٍ حقيقيّ\033[0m\n' >&2
  echo "السجل:  $COMPOSE logs --tail=80 app" >&2
  echo "للرجوع: git checkout <الإصدار السابق> && bash deploy/deploy.sh" >&2
  exit 1
fi

public=0
for i in $(seq 1 20); do
  if curl -fsS --max-time 5 "https://${SITE_DOMAIN}/api/version" >/dev/null 2>&1; then public=1; break; fi
  sleep 3
done

if [ "$public" = 1 ]; then
  printf '\n\033[32m✓ نُشر الإصدار %s على https://%s\033[0m\n' "$COMMIT" "$SITE_DOMAIN"
  echo
  echo "لم يبقَ إلا التحقّق اليدويّ من المال:"
  echo "  · أرسل حدث اختبار من لوحة سترايب وتأكّد من ٢٠٠"
  echo "  · $COMPOSE logs -f app   لمتابعة السجل"
elif ! getent hosts "$SITE_DOMAIN" >/dev/null 2>&1; then
  # النطاقُ لا يُترجَم بعد: هذه مرحلةُ التوازي، والنشرُ ناجح
  printf '\n\033[32m✓ نُشر الإصدار %s — والخادم يجيب داخليّا\033[0m\n' "$COMMIT"
  printf '\033[33m…و%s لا يُترجَم بعد، فلا يُفحَص من الخارج. هذا متوقَّعٌ قبل تحويل النطاق.\033[0m\n' "$SITE_DOMAIN"
  echo "افحصه بعنوان الخادم المؤقّت، أو أضف سطرا في /etc/hosts للفحص وحدَه."
else
  # النطاقُ يُترجَم ولا يجيب: الخادمُ يعمل والطريقُ إليه مقطوع
  printf '\n\033[31m✗ الخادم يجيب داخليّا، ولا يجيب على https://%s\033[0m\n' "$SITE_DOMAIN" >&2
  echo "فابحث في الطريق لا في التطبيق: شهادةُ Caddy · جدارُ النار (٤٤٣) · سجلّ DNS" >&2
  echo "السجل:  $COMPOSE logs --tail=80 caddy" >&2
  exit 1
fi
