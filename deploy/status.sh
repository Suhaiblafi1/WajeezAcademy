#!/usr/bin/env bash
# حالُ الخادم في أمرٍ واحد — يُقرأ ولا يكتب.
#
#   bash deploy/status.sh
#
# ── لماذا يوجد هذا الملفّ ──
#
# كان تشخيصُ حالِ الخادم يجري بأوامرَ تُؤلَّف في المحادثة ثمّ تُلصَق: سطرٌ
# لـ`BACKUP_REMOTE`، وآخرُ لـ`rclone`، وثالثٌ لعدّ الكائنات. وذلك يخطئ بطرقٍ
# يعرفها من جرّبه: يُلصَق `ssh` ومعه ما بعده فيُبتلع الباقي، ويُنفَّذ أمرُ
# الخادم على الجهاز المحلّيّ، ويُنسى `cd` فتُقرأ ملفّاتٌ من `/root`.
#
# والأصلُ أنّ ما يُكرَّر يُكتب مرّةً. فهذا ملفٌّ في المستودَع: يصل الخادمَ مع
# النشر (`deploy-watch.sh` يسحب `origin/main` من تلقائه)، ويُشغَّل بأمرٍ واحدٍ
# مخرَجُه كتلةٌ واحدةٌ تُنسخ كما هي.
#
# ── ولماذا لا يكتب شيئا ──
#
# ليُشغَّل بلا تردّد. كلُّ ما يغيّر حالا — إشعالُ الرفع، تصحيحُ وجهة النسخ،
# هجرةُ الوثائق — يبقى أمرا صريحا يكتبه صاحبُه وهو يعلم. وتشخيصٌ يكتب شيئا
# يصير قرارا مختبئا في «اطّلاع».

set -uo pipefail   # لا -e: قسمٌ يتعذّر لا يُسقط التقريرَ كلَّه
cd "$(dirname "$0")/.."

ENV_FILE=deploy/.env.production
COMPOSE="docker compose -f deploy/compose.prod.yml --env-file $ENV_FILE"

sec() { printf '\n\033[1m══ %s ══\033[0m\n' "$1"; }
val() { printf '  %-28s %s\n' "$1" "$2"; }

[ -f "$ENV_FILE" ] || { echo "✗ لا يوجد $ENV_FILE — أهذا خادمُ الإنتاج؟" >&2; exit 1; }
# القراءةُ بـgrep لا بـsource: الملفّ فيه أسرارٌ لا حاجةَ لتحميلها في هذه الصدفة
envv() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- ; }

sec "الإصدار"
val "الفرع" "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '؟')"
val "الالتزام" "$(git log -1 --format='%h %s' 2>/dev/null | cut -c1-72 || echo '؟')"
val "تاريخُه" "$(git log -1 --format=%cd --date=format:'%Y-%m-%d %H:%M' 2>/dev/null || echo '؟')"

sec "النسخُ الاحتياطيّ"
REMOTE="$(envv BACKUP_REMOTE)"
ALLOW="$(envv BACKUP_REMOTE_ALLOW_LOCAL)"
val "BACKUP_REMOTE" "${REMOTE:-(غير مضبوط)}"
if printf '%s' "$REMOTE" | grep -qE '^[A-Za-z0-9_-]+:'; then
  val "نوعُ الوجهة" "بعيدة ✓"
else
  val "نوعُ الوجهة" "محلّيّة ✗ — على قرص الخادم نفسِه"
fi
[ -n "$ALLOW" ] && val "تعطيلُ الحارس" "BACKUP_REMOTE_ALLOW_LOCAL=$ALLOW ⚠"
if rclone config file >/dev/null 2>&1; then
  val "إعدادُ rclone" "موجود"
  val "الوجهاتُ المعرَّفة" "$(rclone listremotes 2>/dev/null | tr '\n' ' ' | sed 's/ $//')"
else
  val "إعدادُ rclone" "لا ملفَّ إعداد ✗ — فلا وجهةَ بعيدةً أصلا"
fi
val "المؤقّت" "$(systemctl is-active wajeez-backup.timer 2>/dev/null || echo '؟')"
LOCAL_DIR="${REMOTE:-/var/backups/wajeez}"
if [ -d "$LOCAL_DIR" ]; then
  val "آخرُ نسخةٍ محلّيّة" "$(ls -1t "$LOCAL_DIR"/*.sql.gz 2>/dev/null | head -1 | xargs -r basename || echo 'لا شيء')"
  val "عددُها · حجمُها" "$(ls -1 "$LOCAL_DIR"/*.gz 2>/dev/null | wc -l) ملفّا · $(du -sh "$LOCAL_DIR" 2>/dev/null | cut -f1)"
fi

sec "رفعُ الملفّات"
val "FILE_UPLOADS" "$(envv FILE_UPLOADS || echo '(غير مضبوط = مطفأ)')"
# وثائقُ الانضمام ترفع مهما كان المفتاح — فالعدُّ يقول ما على القرص فعلا
OBJ=$($COMPOSE exec -T app sh -c 'find /app/storage -type f ! -name "*.meta.json" 2>/dev/null | wc -l' 2>/dev/null | tr -d '\r')
SIZE=$($COMPOSE exec -T app sh -c 'du -sh /app/storage 2>/dev/null | cut -f1' 2>/dev/null | tr -d '\r')
val "كائناتٌ على المخزن" "${OBJ:-؟} · ${SIZE:-؟}"
val "بقيت في عمود القاعدة" "$($COMPOSE exec -T db psql -tAq -U "$(envv POSTGRES_USER)" -d "$(envv POSTGRES_DB)" \
  -c 'select count(*) from "TrainerApplicationDocument" where content is not null' 2>/dev/null | tr -d '\r' || echo '؟')"

sec "الأقراصُ والأحجام"
df -h / 2>/dev/null | awk 'NR==2 {printf "  %-28s %s مستعمَلة من %s (%s)\n", "الجذر /", $3, $2, $5}'
# حجمٌ إضافيٌّ مركوبٌ يعني قرصا آخرَ فعلا — وهو ما يفرّق في النسخ
OTHER=$(df -h --output=target,size,pcent 2>/dev/null | grep -vE '^(Mounted|/dev|/run|/sys|/proc|tmpfs|overlay|/$)' | grep -E '^/' | head -5)
[ -n "$OTHER" ] && { echo "  أحجامٌ أخرى مركوبة:"; echo "$OTHER" | sed 's/^/    /'; }
echo "  أحجامُ Docker:"
docker volume ls --format '    {{.Name}}' 2>/dev/null | head -10

sec "الحاويات"
$COMPOSE ps --format '  {{.Service}}  {{.State}}  {{.Status}}' 2>/dev/null | head -10

printf '\n\033[1m══ الخلاصة ══\033[0m\n'
if printf '%s' "$REMOTE" | grep -qE '^[A-Za-z0-9_-]+:' && rclone config file >/dev/null 2>&1; then
  echo "  ✓ وجهةُ النسخ بعيدةٌ ومعرَّفة."
else
  echo "  ✗ لا نسخةَ خارجَ الخادم: الوجهةُ محلّيّةٌ أو بلا إعدادِ rclone."
  echo "    وحتّى تُصحَّح، لا يُشغَّل «bash deploy/backup.sh --verify» — فهو يكتب"
  echo "    إثباتَ الاسترجاع الذي تشترطه إعادةُ ضبط الحسابات."
fi
