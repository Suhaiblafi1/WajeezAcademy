#!/usr/bin/env bash
# تركيبُ النشر التلقائيّ — أمرٌ واحدٌ يُنفَّذ مرّةً على الخادم، ثمّ لا يُعاد.
#
#   bash scripts/install-auto-deploy.sh
#
# ماذا يفعل، بالترتيب:
#   ١) يفحص أنّ كلَّ شرطٍ متحقّق — ويقف عند أوّل نقصٍ بجملةٍ تقول ما ينقص.
#   ٢) ينشر ما في `main` الآن مرّةً واحدةً بيدك، فترى المخرجاتِ كاملة.
#   ٣) يركّب سطرَ الجدولة، فيصير الخادمُ يسأل `main` كلَّ خمس دقائق وينشر وحدَه.
#   ٤) يقول لك كيف تقرأ ما جرى، وكيف تتراجع.
#
# وهو **آمنُ الإعادة**: تشغيلُه مرّتين لا يضع سطرَين في الجدولة.
#
# والتراجع: `crontab -e` ثمّ احذف السطر. لا شيءَ غيرُه يتغيّر.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
WATCHER="$ROOT/scripts/deploy-watch.sh"
CRON_LINE="*/5 * * * * /bin/bash $WATCHER"

ok()   { printf '\033[32m✔\033[0m %s\n' "$1"; }
step() { printf '\n\033[1m── %s ──\033[0m\n' "$1"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

step "١/٤ · فحصُ الشروط"

[ -f "$WATCHER" ] || fail "لا يوجد $WATCHER — أهذا مجلَّدُ المستودَع؟"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "main" ] || fail "المستودَع على الفرع «$BRANCH» لا main. نفّذ: git checkout main"
ok "الفرع main"

[ -f deploy/.env.production ] || fail "لا يوجد deploy/.env.production — انسخه عن deploy/.env.production.example واملأه (deploy/README.md §٢)"
grep -qE '^SITE_DOMAIN=.+' deploy/.env.production || fail "SITE_DOMAIN فارغٌ في deploy/.env.production — منه يطلب Caddy الشهادة"
ok "ملفُّ البيئة موجودٌ وفيه النطاق"

# ── أكثرُ ما يُسقط مهمّةً مجدولة: بيئةُ cron أفقرُ من بيئتك ──
# لا وكيلَ SSH، ولا PATH كامل. فيُجرَّب هنا بالبيئة الفقيرة نفسِها، لا ببيئتك.
CRON_ENV="env -i HOME=$HOME PATH=/usr/bin:/bin"
$CRON_ENV /bin/bash -c "cd '$ROOT' && git fetch origin main" >/dev/null 2>&1 \
  || fail "git fetch لا يعمل بلا تفاعل — المفتاحُ يحتاج وكيلا. استعمل مفتاحَ نشرٍ بلا عبارةِ مرور، أو حوّل الأصلَ إلى HTTPS برمزٍ مخزَّن."
ok "git fetch يعمل في بيئةٍ فقيرةٍ كبيئة cron"

$CRON_ENV /bin/bash -c 'docker compose version' >/dev/null 2>&1 \
  || fail "docker compose ليس في مسار cron. أضِف في أوّل crontab سطرَ PATH= يشمل موضعَه، أو تحقّق أنّ المستخدمَ في مجموعة docker."
ok "docker compose في المسار"

step "٢/٤ · نشرةٌ واحدةٌ الآن، بعينك"
echo "تُبنى الصورةُ قبل لمس ما يعمل — فإن أخفق شيءٌ بقي الموقعُ القديمُ يخدم."
bash deploy/deploy.sh

step "٣/٤ · تركيبُ الجدولة"
CURRENT="$(crontab -l 2>/dev/null || true)"
if printf '%s\n' "$CURRENT" | grep -qF "$WATCHER"; then
  ok "السطرُ مركَّبٌ من قبل — لا يُكرَّر"
else
  printf '%s\n%s\n' "$CURRENT" "$CRON_LINE" | grep -v '^$' | crontab -
  ok "رُكِّب: كلَّ خمس دقائق يسأل الخادمُ main وينشر إن تحرّكت"
fi

step "٤/٤ · وبعد اليوم"
cat <<'AFTER'
لا شيءَ عليك. أيُّ تغييرٍ يصل main يظهر على الموقع خلال خمس دقائق.

  · ما جرى:      cat  ~/wajeez-deploy.log
  · هل فشل شيء:  grep '✖' ~/wajeez-deploy.log      (لا مخرجات = لا فشل)
  · العاملُ الخلفيّ:
      docker compose -f deploy/compose.prod.yml --env-file deploy/.env.production logs -f worker
  · التراجع:     crontab -e   ثمّ احذف السطر. لا شيءَ غيرُه يتغيّر.

ولا يُكتب في السجلّ شيءٌ حين لا جديد — بقصد: سطرٌ كلَّ خمس دقائق يُغرقه فلا
يُقرأ حين يهمّ.

⚠️ ولا تنبيهَ بعد: نشرةٌ تفشل في الثالثة فجرا سطرٌ في السجلّ لا يوقظ أحدا.
AFTER
