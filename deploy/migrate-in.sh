#!/usr/bin/env bash
# نقلُ قاعدةِ الإنتاج من خادمٍ قديمٍ إلى هذا الخادم — مرّةً واحدة، وقتَ النقل.
#
#   SOURCE_SSH=root@5.9.82.49 bash deploy/migrate-in.sh --check   يقول ماذا سيفعل ولا يفعله
#   SOURCE_SSH=root@5.9.82.49 bash deploy/migrate-in.sh           النقل
#   bash deploy/migrate-in.sh --from-file dump.sql.gz             نسخةٌ عندك أصلا
#   ... --force                                                   يكتب فوق قاعدةٍ فيها بيانات
#
# ── العطبُ الذي يمنعه ──
#
# خادمٌ جديد يُقلع بقاعدةٍ **فارغة**. وإن حُوِّل النطاقُ إليه قبل أن تنتقل
# البيانات، فما إن تصدر شهادةُ Caddy حتّى تخدم الأكاديميّةُ الحيّةُ صفرَ
# مستخدمٍ وصفرَ دورة — ويصل خطّافُ سترايب إلى خادمٍ لا يعرف الطلباتِ التي
# يُخبر عنها: **مالٌ يُقبض ولا تسجيلَ يُنشأ**.
#
# وهذا لا يُكتشف باختبار: الموقعُ يعمل، و`/api/version` يجيب، والحاوياتُ
# صحّيّة. الفارغُ يبدو سليما تماما — ولذلك يُنقل قبل التحويل لا بعده.
#
# ── ولماذا سكربتٌ لا أمرَان يُكتبان باليد ──
#
# `pg_dump | psql` يبدو سطرا واحدا، وفيه أربعةُ مواضعَ تُفقد فيها البيانات
# صامتةً: نسخةٌ فارغةٌ تُكتب فوق قاعدةٍ عامرة، ومخطَّطٌ أقدمُ من الشيفرة
# فتسقط المساراتُ بـ٥٠٠، و`STORAGE_SECRET` يختلف فتنكسر كلُّ رابطٍ موقَّع،
# وهجرةٌ تُنسى. فكلُّها هنا شرطٌ يُفحص لا خطوةٌ تُتذكَّر.

set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=deploy/.env.production
COMPOSE="docker compose -f deploy/compose.prod.yml --env-file $ENV_FILE"

step() { printf '\n\033[1m── %s ──\033[0m\n' "$1"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }
warn() { printf '\033[33m⚠ %s\033[0m\n' "$1" >&2; }

CHECK_ONLY=0; FORCE=0; FROM_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --check) CHECK_ONLY=1 ;;
    --force) FORCE=1 ;;
    --from-file) FROM_FILE="${2:-}"; shift ;;
    *) fail "وسيطٌ مجهول: $1" ;;
  esac
  shift
done

SOURCE_SSH="${SOURCE_SSH:-}"
SOURCE_PATH="${SOURCE_PATH:-/opt/wajeez}"

[ -f "$ENV_FILE" ] || fail "لا يوجد $ENV_FILE — انسخه عن .env.production.example واملأه أوّلا"
set -a; . "$ENV_FILE"; set +a

if [ -z "$FROM_FILE" ] && [ -z "$SOURCE_SSH" ]; then
  cat >&2 <<'MSG'
✗ لا مصدرَ للبيانات.

  إمّا خادمٌ يُسحب منه:      SOURCE_SSH=root@5.9.82.49 bash deploy/migrate-in.sh
  وإمّا نسخةٌ عندك أصلا:     bash deploy/migrate-in.sh --from-file dump.sql.gz

MSG
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# ── ١) الشرطُ الذي يُفحص قبل كلّ شيء: مفتاحُ توقيع الروابط ──
#
# إن لم يُضبط `STORAGE_SECRET` صراحةً اشتُقّ من `DATABASE_URL` — وهو يختلف
# بين الخادمين حتما (كلمةُ سرّ القاعدة تُولَّد جديدةً على الجديد). فتنتقل
# البياناتُ سليمةً **وتنكسر كلُّ رابطٍ موقَّعٍ لوثائق المتقدّمين** بلا خطأ
# يُرى: الصفُّ موجودٌ في القاعدة، والرابطُ إليه لا يُفتح.
step "١/٦ · مفتاحُ توقيع الروابط"
if [ -z "${STORAGE_SECRET:-}" ]; then
  warn "STORAGE_SECRET غير مضبوطٍ في $ENV_FILE — سيُشتقّ من DATABASE_URL."
  warn "وهو يختلف عن الخادم القديم، فتنكسر روابطُ الوثائق الموقَّعةُ كلُّها."
  warn "انسخ قيمتَه من الخادم القديم قبل النقل، أو اقبل كسرَها صراحةً."
  [ "$FORCE" = 1 ] || fail "أُوقف النقل. أضف --force إن كنتَ تقبل ذلك."
else
  echo "✓ مضبوطٌ صراحة — تأكّد أنّه **نفسُ** قيمة الخادم القديم"
fi

# ── ٢) هل القاعدةُ الهدفُ عامرة؟ ──
step "٢/٦ · حالُ القاعدة الهدف"
$COMPOSE up -d db >/dev/null 2>&1 || fail "تعذّر تشغيل حاويةِ القاعدة"
for i in $(seq 1 30); do
  $COMPOSE exec -T db pg_isready -q 2>/dev/null && break
  [ "$i" = 30 ] && fail "القاعدة لم تجهز خلال ٣٠ محاولة"
  sleep 2
done

count_or_zero() {
  $COMPOSE exec -T db psql -tAq -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "select count(*) from \"$1\"" 2>/dev/null | tr -d '[:space:]' || echo 0
}
TARGET_USERS="$(count_or_zero User)"; TARGET_USERS="${TARGET_USERS:-0}"
echo "المستخدمون في الهدف الآن: $TARGET_USERS"

if [ "$TARGET_USERS" -gt 0 ] && [ "$FORCE" != 1 ]; then
  fail "القاعدةُ الهدفُ فيها $TARGET_USERS مستخدما — والنقلُ يكتب فوقها.
  إن كان هذا مقصودا أضف --force (وتُؤخذ نسخةٌ قبله)."
fi

# ── ٣) المصدر ──
step "٣/٦ · سحبُ النسخة من المصدر"
DUMP="$WORK/source.sql.gz"
if [ -n "$FROM_FILE" ]; then
  [ -f "$FROM_FILE" ] || fail "لا يوجد الملفّ: $FROM_FILE"
  echo "من ملفّ: $FROM_FILE"
  [ "$CHECK_ONLY" = 1 ] || cp "$FROM_FILE" "$DUMP"
else
  command -v ssh >/dev/null || fail "ssh غير مثبَّت — لا سبيلَ إلى $SOURCE_SSH"
  echo "من خادم: $SOURCE_SSH (المستودَع في $SOURCE_PATH)"
  ssh -o BatchMode=yes -o ConnectTimeout=10 "$SOURCE_SSH" true 2>/dev/null \
    || fail "تعذّر الاتّصال بـ$SOURCE_SSH بلا كلمة مرور — راجع المفاتيح"
  if [ "$CHECK_ONLY" != 1 ]; then
    # pg_dump من داخل حاوية المصدر: إصدارُ الأداة يطابق إصدارَ خادمه دائما
    ssh "$SOURCE_SSH" "cd '$SOURCE_PATH' && set -a && . deploy/.env.production && set +a && \
      docker compose -f deploy/compose.prod.yml --env-file deploy/.env.production \
      exec -T db pg_dump -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" --clean --if-exists" \
      | gzip -9 > "$DUMP" || fail "أخفق السحبُ من $SOURCE_SSH"
  fi
fi

if [ "$CHECK_ONLY" = 1 ]; then
  printf '\n\033[32m✓ الشروطُ سليمة — ولم يُنقل شيء (--check)\033[0m\n'
  exit 0
fi

# نسخةٌ فارغةٌ تُكتب فوق قاعدةٍ عامرة = فقدُ بيانات. تُفحص قبل أن تُستعمل.
SIZE=$(stat -c%s "$DUMP")
[ "$SIZE" -gt 5000 ] || fail "النسخةُ $SIZE بايت فقط — فشلٌ صامت، لم يُكتب شيء"
echo "✓ النسخة: $(numfmt --to=iec "$SIZE" 2>/dev/null || echo "$SIZE bytes")"

# ── ٤) نسخةُ أمانٍ للهدف قبل الكتابة فوقه ──
step "٤/٦ · نسخةُ أمانٍ للهدف"
if [ "$TARGET_USERS" -gt 0 ]; then
  SAFETY="$WORK/target-before-migrate.sql.gz"
  $COMPOSE exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
    | gzip -9 > "$SAFETY"
  KEEP="deploy/.migrate-rollback-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
  cp "$SAFETY" "$KEEP"
  echo "✓ حُفظت حالُ الهدف قبل الكتابة: $KEEP"
else
  echo "الهدفُ فارغ — لا شيءَ يُحفظ"
fi

# ── ٥) الاسترجاع ثمّ الهجرة ──
#
# والترتيبُ مقصود: النسخةُ تحمل مخطَّطَ الخادم القديم، وقد تكون الشيفرةُ هنا
# أحدثَ بهجراتٍ لم تصله. فتُستَرجع أوّلا ثمّ تُنشَر الهجراتُ فوقها — والعكسُ
# يجعل `--clean` يمحو ما هاجرناه للتوّ.
step "٥/٦ · الاسترجاع ثمّ الهجرة"
gunzip -c "$DUMP" | $COMPOSE exec -T db psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null \
  || fail "أخفق الاسترجاع — راجع السجلّ. حالُ الهدف السابقةُ محفوظةٌ أعلاه."
echo "✓ استُرجعت البيانات"

$COMPOSE run --rm --no-deps app npx prisma migrate deploy \
  || fail "أخفقت الهجرة بعد الاسترجاع — القاعدةُ على مخطَّطِ الخادم القديم.
  لا تُشغّل الموقعَ عليها: مساراتٌ تسقط بـ٥٠٠ على أعمدةٍ غيرِ موجودة."
echo "✓ نُشرت الهجرات"

# ── ٦) الإثبات — لا يُعلَن نجاحٌ لأنّ الأوامرَ رجعت بصفر ──
step "٦/٦ · التحقّق"
USERS="$(count_or_zero User)"; ORDERS="$(count_or_zero Order)"
echo "بعد النقل: $USERS مستخدما · $ORDERS طلبا"
[ "${USERS:-0}" -gt 0 ] || fail "القاعدةُ فارغةٌ بعد النقل — لم يُنقل شيء"

printf '\n\033[32m✓ انتقلت القاعدة: %s مستخدما · %s طلبا\033[0m\n' "$USERS" "$ORDERS"
cat <<MSG

ولم يبقَ إلّا ما لا تفعله قاعدةٌ عن نفسها:
  · bash deploy/deploy.sh            ليخدم الخادمُ هذه البيانات
  · تأكّد أنّ STORAGE_SECRET هنا هو نفسُه على القديم — وإلّا فروابطُ الوثائق مكسورة
  · حوّل خطّافَ سترايب إلى هذا الخادم، وأرسل حدثَ اختبارٍ وتأكّد من ٢٠٠
  · لا تُطفئ الخادمَ القديم قبل أن تُثبت هذا كلَّه
MSG
