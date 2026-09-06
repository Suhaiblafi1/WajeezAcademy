#!/usr/bin/env bash
# نسخة احتياطية للقاعدة — إلى خارج الخادم، أو لا تعمل أصلا.
#
#   bash deploy/backup.sh              النسخة الليلية (يشغّلها المؤقّت)
#   bash deploy/backup.sh --pre-deploy نسخةٌ قبل الهجرة (يشغّلها deploy.sh)
#   bash deploy/backup.sh --verify     ينزّل آخر نسخة ويسترجعها في قاعدة خدش
#
# لماذا يرفض العمل بلا BACKUP_REMOTE: نسخةٌ على القرص نفسه ليست نسخة
# احتياطية. عطبُ القرص أو حذفُ الخادم يأخذ الأصل والنسخة معا. والسكربت الذي
# يكتب محليا ويقول «تمّ» أخطر من غيابه: يمنح طمأنينةً لا يسندها شيء. فإمّا
# وجهةٌ خارجية وإمّا خروجٌ بخطأ.

set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=deploy/.env.production
[ -f "$ENV_FILE" ] || { echo "✗ لا يوجد $ENV_FILE" >&2; exit 1; }
set -a; . "$ENV_FILE"; set +a

COMPOSE="docker compose -f deploy/compose.prod.yml --env-file $ENV_FILE"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
MODE="${1:-}"
LABEL="nightly"; [ "$MODE" = "--pre-deploy" ] && LABEL="predeploy"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [ -z "${BACKUP_REMOTE:-}" ]; then
  cat >&2 <<'MSG'
✗ BACKUP_REMOTE غير مضبوط.

  نسخةٌ على القرص نفسه ليست نسخة احتياطية. اضبط وجهةً خارجية:

    rclone config                       # أنشئ وجهة (S3 · Backblaze · صندوق تخزين)
    # ثم في deploy/.env.production:
    BACKUP_REMOTE=wajeez-backup:wajeez/db

MSG
  exit 1
fi
command -v rclone >/dev/null || { echo "✗ rclone غير مثبَّت: apt install rclone" >&2; exit 1; }

# ── الاسترجاع: الاختبار الوحيد الذي يثبت أنّ ما نأخذه نسخةٌ فعلا ──
if [ "$MODE" = "--verify" ]; then
  echo "── اختبار الاسترجاع ──"
  LATEST="$(rclone lsf "$BACKUP_REMOTE" --include '*.sql.gz' | sort | tail -1)"
  [ -n "$LATEST" ] || { echo "✗ لا نسخ في $BACKUP_REMOTE" >&2; exit 1; }
  echo "أحدث نسخة: $LATEST"
  rclone copyto "$BACKUP_REMOTE/$LATEST" "$WORK/dump.sql.gz"

  SCRATCH="verify_$(date -u +%s)"
  $COMPOSE exec -T db createdb -U "$POSTGRES_USER" "$SCRATCH"
  gunzip -c "$WORK/dump.sql.gz" | $COMPOSE exec -T db psql -q -U "$POSTGRES_USER" -d "$SCRATCH" >/dev/null
  USERS=$($COMPOSE exec -T db psql -tAq -U "$POSTGRES_USER" -d "$SCRATCH" -c 'select count(*) from "User"')
  ORDERS=$($COMPOSE exec -T db psql -tAq -U "$POSTGRES_USER" -d "$SCRATCH" -c 'select count(*) from "Order"')
  $COMPOSE exec -T db dropdb -U "$POSTGRES_USER" "$SCRATCH"

  echo "✓ استُرجعت النسخة: $USERS مستخدما · $ORDERS طلبا"
  [ "$USERS" -gt 0 ] || { echo "✗ النسخة استُرجعت فارغة — هذه ليست نسخة" >&2; exit 1; }
  echo "✓ النسخ الاحتياطي مُثبَت. أعد هذا الاختبار شهريا."
  exit 0
fi

# ── الأخذ ──
FILE="wajeez-${LABEL}-${STAMP}.sql.gz"
# pg_dump من داخل حاوية القاعدة نفسها: إصدار الأداة يطابق إصدار الخادم دائما
$COMPOSE exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  | gzip -9 > "$WORK/$FILE"

SIZE=$(stat -c%s "$WORK/$FILE")
# نسخةٌ فارغة أو شبه فارغة تعني فشلا صامتا — لا تُرفع فتزيح نسخةً صالحة
[ "$SIZE" -gt 5000 ] || { echo "✗ النسخة $SIZE بايت فقط — فشلٌ صامت، لم تُرفع" >&2; exit 1; }

rclone copy "$WORK/$FILE" "$BACKUP_REMOTE" || { echo "✗ أخفق الرفع إلى $BACKUP_REMOTE" >&2; exit 1; }
echo "✓ رُفعت $FILE ($(numfmt --to=iec "$SIZE" 2>/dev/null || echo "$SIZE bytes")) إلى $BACKUP_REMOTE"

# ── التقليم ──
KEEP="${BACKUP_KEEP_DAYS:-30}"
rclone delete "$BACKUP_REMOTE" --include 'wajeez-nightly-*.sql.gz' --min-age "${KEEP}d" || true
echo "✓ حُذف ما تجاوز ${KEEP} يوما من النسخ الليلية"
