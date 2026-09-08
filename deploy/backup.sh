#!/usr/bin/env bash
# نسخة احتياطية — القاعدةُ **وحجمُ الملفّات** — إلى خارج الخادم، أو لا تعمل.
#
#   bash deploy/backup.sh              النسخة الليلية (يشغّلها المؤقّت)
#   bash deploy/backup.sh --pre-deploy نسخةٌ قبل الهجرة (يشغّلها deploy.sh)
#   bash deploy/backup.sh --verify     ينزّل آخر نسخة ويسترجعها في قاعدة خدش
#
# ── ولماذا صارت شيئَين (البند ⑤) ──
#
# كانت الوثائقُ بايتاتٍ في عمودِ قاعدة، فنسخةُ القاعدة تحملها ضمنا. ثمّ صارت
# على حجم `storage` — وعندها **انقسم ما يجب حفظُه إلى نصفَين**: صفٌّ يقول
# «هذه سيرةُ فلان» في القاعدة، وبايتاتُها على الحجم. ونسخةٌ تأخذ أحدَهما
# تُنتج بعد الاسترجاع منصّةً تعرض وثائقَ لا محتوى لها — وهو أسوأُ من فقدها
# معا، لأنّه يبدو سليما.
#
# فالحجمُ يدخل هنا **في الالتزام نفسِه** الذي نقل البايتاتِ إليه. مخزنُ
# ملفّاتٍ بلا نسخةٍ احتياطيّةٍ عطبٌ أسوأُ من غيابه.
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

# ── وأن يكون مضبوطا لا يكفي: أن يكون **خارج الخادم** ──
#
# كان الفحصُ أعلاه وحدَه، وهو يسأل «أفارغٌ المتغيّر؟» لا «أوجهةٌ خارجيّةٌ هو؟».
# فمرّ `BACKUP_REMOTE=/var/backups/wajeez` — مسارٌ على القرص نفسِه — و`rclone`
# ينسخ إليه بلا شكوى، والسكربتُ يطبع «✓ رُفعت … ✓ النسخ الاحتياطي مُثبَت».
#
# وهذا بعينه ما يحذّر منه رأسُ هذا الملفّ: «السكربتُ الذي يكتب محليا ويقول
# «تمّ» أخطرُ من غيابه». فكان يقوله، ولا شيءَ يمنعه.
#
# ── ولمَ هو أخطرُ من ضياع نسخة ──
#
# `--verify` يكتب **إثباتَ الاسترجاع**، وهو الحارسُ الأوّلُ على «إعادة ضبط
# الحسابات» (`account-reset.service.ts`: «قبل كلّ شيء، فبدونه لا معنى لبقيّة
# الحرّاس») — ومحوُ الحسابات **لا رجعةَ فيه**. فنسخةٌ تموت مع الخادم كانت
# تفتح بابَ محوٍ لا رجعةَ عنه.
#
# ── والقياسُ صيغةُ rclone نفسُها ──
#
# الوجهةُ البعيدة `اسم:مسار` — نقطتان قبل أيّ شَرطة. والمسارُ المحلّيّ يبدأ
# بشَرطةٍ أو نقطة. ولا يُمنع المحلّيُّ منعا: قد يكون تجهيزا شبكيّا مركوبا
# (CIFS · SSHFS) وهو خارجُ الخادم حقّا. لكنّه يُعلَن، فيقولها صاحبُه صراحةً
# في `BACKUP_REMOTE_ALLOW_LOCAL=yes` — ولا تُقبل صامتةً.
if ! printf '%s' "$BACKUP_REMOTE" | grep -qE '^[A-Za-z0-9_-]+:'; then
  if [ "${BACKUP_REMOTE_ALLOW_LOCAL:-}" != "yes" ]; then
    cat >&2 <<MSG
✗ BACKUP_REMOTE ليس وجهةً بعيدة: «$BACKUP_REMOTE»

  هذا مسارٌ محلّيّ — على القرص نفسِه الذي يحمل القاعدة. وعطبُ القرص أو حذفُ
  الخادم يأخذ الأصلَ والنسخةَ معا.

  وأخطرُ من ذلك: «--verify» يكتب إثباتَ الاسترجاع، وهو شرطُ **إعادة ضبط
  الحسابات** — محوٌ لا رجعةَ فيه. فنسخةٌ تموت مع الخادم تفتح ذلك الباب.

  الوجهةُ البعيدة بصيغة «اسم:مسار»:

    rclone config create wajeez-backup sftp \\
      host uXXXXXX.your-storagebox.de user uXXXXXX port 23 \\
      pass "\$(rclone obscure 'كلمة-السرّ')"
    rclone lsd wajeez-backup:                 # أثبِتها قبل الوثوق بها
    # ثمّ في deploy/.env.production:
    BACKUP_REMOTE=wajeez-backup:wajeez

  وإن كان هذا المسارُ تجهيزا شبكيّا مركوبا خارجَ الخادم فعلا، فقُلها صراحةً:

    BACKUP_REMOTE_ALLOW_LOCAL=yes

MSG
    exit 1
  fi
  echo "⚠ BACKUP_REMOTE مسارٌ محلّيّ، وأُذن به صراحةً — تأكّد أنّه خارجُ الخادم." >&2
fi

# وإعدادُ rclone نفسُه: غيابُه دليلٌ قاطعٌ على أن لا وجهةَ بعيدةً معرَّفة.
if [ "${BACKUP_REMOTE_ALLOW_LOCAL:-}" != "yes" ] && ! rclone config file >/dev/null 2>&1; then
  cat >&2 <<'MSG'
✗ لا ملفَّ إعدادٍ لـrclone — فلا وجهةَ بعيدةً معرَّفةً أصلا.

  «rclone config file» لا يجد شيئا، ومعنى ذلك أنّ كلَّ نسخٍ يقع على هذا
  القرص مهما بدا اسمُ الوجهة بعيدا. أنشئ الوجهةَ أوّلا:

    rclone config create wajeez-backup sftp host … user … port 23 pass …
    rclone lsd wajeez-backup:

MSG
  exit 1
fi

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

  # ── وأرشيفُ التخزين يُثبَت كما تُثبَت القاعدة ──
  #
  # نسخةٌ لا تُفتح ليست نسخة. فيُنزَّل أحدثُ أرشيفٍ ويُفكّ في مجلّدٍ مؤقّتٍ
  # وتُعدّ كائناتُه — لا يُكتفى بوجود الملفّ في الوجهة.
  STORE_LATEST="$(rclone lsf "$BACKUP_REMOTE" --include '*-storage.tar.gz' | sort | tail -1)"
  if [ -n "$STORE_LATEST" ]; then
    rclone copyto "$BACKUP_REMOTE/$STORE_LATEST" "$WORK/store.tar.gz"
    mkdir -p "$WORK/store"
    tar -xzf "$WORK/store.tar.gz" -C "$WORK/store" \
      || { echo "✗ أرشيفُ التخزين لا يُفكّ — هذه ليست نسخة" >&2; exit 1; }
    OBJECTS=$(find "$WORK/store" -type f ! -name '*.meta.json' | wc -l)
    echo "✓ فُكّ أرشيفُ التخزين $STORE_LATEST: $OBJECTS كائنا"
  else
    # لا أرشيفَ بعد = لم تجرِ نسخةٌ ليليّةٌ منذ وصول المخزن. يُقال ولا يُسكَت
    # عنه، ولا يُعدّ إخفاقا: قد يكون المخزنُ نُشر قبل ساعة.
    echo "⚠ لا أرشيفَ تخزينٍ في الوجهة بعد — شغّل bash deploy/backup.sh مرّةً" >&2
  fi

  # ── الإثباتُ يُكتب حيث يقرؤه التطبيق (البند ٦٥) ──
  #
  # كان نجاحُ هذا الاختبار سطرا في طرفيّةٍ يراه من شغّله ثمّ يذهب. ولا شيءَ
  # في المنصّة يعرف أنّه جرى — فبقي «نسخٌ محقَّقةٌ بالاستعادة» شرطا في وثيقةٍ
  # يُوعَد به، لا شرطا يُفرَض.
  #
  # فيُكتب صفٌّ في `SystemSetting` (جدولٌ كان في المخطَّط بلا مستعمِل).
  # ويقرؤه `server/services/backup-attestation.ts`، فتمنع **إعادةُ ضبط
  # الحسابات** (البند ٦٦) نفسَها إن لم يكن ثمّ استرجاعٌ مُثبَتٌ حديث.
  #
  # والقيمةُ تحمل ما يجعلها قابلةً للحكم لا مجرّدَ «نعم»: متى، وأيُّ ملفّ،
  # وكم صفّا استُرجع. فمن يقرؤها يعرف أهي إثباتٌ أم لقطةٌ فارغةٌ نجحت شكلا.
  ATTEST=$(printf '{"at":"%s","file":"%s","users":%s,"orders":%s,"remote":"%s"}' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$LATEST" "$USERS" "$ORDERS" "$BACKUP_REMOTE")
  $COMPOSE exec -T db psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
    "INSERT INTO \"SystemSetting\" (key, value, \"updatedAt\") VALUES ('backup.lastVerifiedRestore', '$ATTEST'::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, \"updatedAt\" = now()" \
    && echo "✓ كُتب إثباتُ الاسترجاع — تقرؤه المنصّةُ وتشترطه إعادةُ ضبط الحسابات" \
    || echo "⚠ تعذّر كتابةُ الإثبات في القاعدة — الاسترجاعُ نجح، لكنّ المنصّةَ لن تعرف" >&2

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

# ── وحجمُ الملفّات معها ──
#
# يُقرأ من داخل حاوية التطبيق: الحجمُ مركوبٌ هناك على `/app/storage`، ولا
# يُفترض مسارُه على المضيف (أحجامُ Docker مسمّاةٌ لا مسارات — قرارٌ مكتوبٌ في
# `compose.prod.yml`). و`tar` يقرأ ويكتب إلى المخرَج القياسيّ، فلا يحتاج
# مساحةً على قرص الحاوية.
STORE_FILE="wajeez-${LABEL}-${STAMP}-storage.tar.gz"
$COMPOSE exec -T app tar -czf - -C /app/storage . > "$WORK/$STORE_FILE" \
  || { echo "✗ تعذّرت أرشفةُ حجم التخزين" >&2; exit 1; }
STORE_SIZE=$(stat -c%s "$WORK/$STORE_FILE")

# أرشيفُ tar فارغٍ نحوَ ٤٥ بايتا — وذلك مقبولٌ ما دام لا ملفّاتٍ بعد. لكنّ
# **صفرا** يعني أنّ الأمرَ نفسَه أخفق، وتلك لا تُرفع فتزيح نسخةً صالحة.
[ "$STORE_SIZE" -gt 0 ] || { echo "✗ أرشيفُ التخزين صفرُ بايت — فشلٌ صامت" >&2; exit 1; }

rclone copy "$WORK/$STORE_FILE" "$BACKUP_REMOTE" \
  || { echo "✗ أخفق رفعُ أرشيف التخزين إلى $BACKUP_REMOTE" >&2; exit 1; }
echo "✓ رُفع $STORE_FILE ($(numfmt --to=iec "$STORE_SIZE" 2>/dev/null || echo "$STORE_SIZE bytes")) إلى $BACKUP_REMOTE"

# ── التقليم ──
KEEP="${BACKUP_KEEP_DAYS:-30}"
rclone delete "$BACKUP_REMOTE" --include 'wajeez-nightly-*.sql.gz' --min-age "${KEEP}d" || true
rclone delete "$BACKUP_REMOTE" --include 'wajeez-nightly-*-storage.tar.gz' --min-age "${KEEP}d" || true
echo "✓ حُذف ما تجاوز ${KEEP} يوما من النسخ الليلية (القاعدةُ والتخزينُ معا)"
