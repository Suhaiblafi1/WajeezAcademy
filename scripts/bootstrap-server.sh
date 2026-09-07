#!/usr/bin/env bash
# تجهيزُ خادمٍ جديدٍ من الصفر — من Ubuntu عارٍ إلى منظومةٍ جاهزةٍ للنشر.
#
#   bash scripts/bootstrap-server.sh            التجهيز
#   bash scripts/bootstrap-server.sh --check    يقول ماذا سيفعل ولا يفعله
#
# ولا ينشر: يقف عند آخر خطوةٍ **قبل** `deploy/deploy.sh` عمدا، لأنّ ما بينهما
# مفاتيحُ لا تُخترع — سترايب وResend ووجهةُ النسخ الاحتياطيّ. فيُملأ الملفُّ
# بيدٍ ثمّ يُنشَر.
#
# ── وآمنُ الإعادة بقصد ──
#
# تشغيلُه مرّتين لا يُفسد شيئا: لا يُعاد توليدُ سرٍّ موجود، ولا يُكتب فوق
# `deploy/.env.production` القائم. وهذا ليس ترفا — **إعادةُ توليد
# `STORAGE_SECRET` تُبطل كلَّ رابطٍ موقَّعٍ سارٍ** لوثائق المتقدّمين، وإعادةُ
# توليد كلمة القاعدة تقطع الخادمَ عن قاعدته. فالموجودُ يُترك.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/wajeez}"
REPO="${REPO:-https://github.com/Suhaiblafi1/WajeezAcademy}"
BRANCH="${BRANCH:-main}"
CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

step() { printf '\n\033[1m── %s ──\033[0m\n' "$1"; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '\033[33m⚠\033[0m %s\n' "$1" >&2; }
fail() { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" = 0 ] || fail "شغّله بـroot أو sudo — يثبّت حزما ويضبط جدارَ نار"

step "٠/٦ · فحصُ الشروط"
. /etc/os-release 2>/dev/null || fail "لا /etc/os-release — نظامٌ غيرُ متوقَّع"
echo "النظام: ${PRETTY_NAME:-مجهول}"
[ "${ID:-}" = ubuntu ] || warn "مُجرَّبٌ على Ubuntu 24.04 — غيرُه قد يحتاج يدا"
# ذاكرةٌ دون ٢ غيغا تجعل `docker compose build` يُقتل بلا رسالةٍ مفهومة
MEM_MB=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)
[ "$MEM_MB" -ge 1900 ] || warn "الذاكرة ${MEM_MB}م — البناءُ قد يُقتل. المُوصى: ٤ غيغا"
ok "الشروطُ مقروءة"

if [ "$CHECK_ONLY" = 1 ]; then
  cat <<MSG

سيفعل هذا السكربت — ولم يفعل شيئا الآن:
  ١) Docker وrclone وunattended-upgrades
  ٢) جدارُ نار: يُغلق كلُّ وارد إلّا SSH و٨٠ و٤٤٣
  ٣) SSH بالمفاتيح وحدها (تعطيلُ كلمة المرور)
  ٤) استنساخُ $REPO إلى $APP_DIR على الفرع $BRANCH
  ٥) توليدُ deploy/.env.production بأسرارٍ عشوائيّة — إن لم يكن موجودا
  ٦) تركيبُ مؤقّت النسخ الاحتياطيّ

MSG
  exit 0
fi

step "١/٦ · الحزم"
export DEBIAN_FRONTEND=noninteractive
if command -v docker >/dev/null; then ok "Docker موجود"; else
  curl -fsSL https://get.docker.com | sh || fail "تعذّر تثبيت Docker"
  ok "ثُبِّت Docker"
fi
apt-get update -qq || warn "apt-get update أخفق — قد تفشل الحزم التالية"
apt-get install -y -qq rclone unattended-upgrades git >/dev/null || warn "تعذّر تثبيت بعض الحزم"
ok "rclone وgit والترقيعاتُ التلقائيّة"

step "٢/٦ · جدارُ النار"
# ⚠️ يُسمح لـSSH **قبل** التفعيل — والعكسُ يقطعك عن خادمك في السطر نفسِه.
if command -v ufw >/dev/null; then
  ufw --force default deny incoming >/dev/null
  ufw --force default allow outgoing >/dev/null
  ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
  ok "مفتوحٌ: SSH · ٨٠ · ٤٤٣ — وما سواه مغلق"
else warn "ufw غيرُ موجود — الجدارُ لم يُضبط"; fi

step "٣/٦ · تقسيةُ SSH"
# لا يُمسّ إلّا كلمةُ المرور: مفتاحُك العامل يبقى كما هو.
if [ -f /etc/ssh/sshd_config ]; then
  sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || warn "أعد تحميل SSH يدويّا"
  ok "الدخولُ بالمفاتيح وحدَها"
fi

step "٤/٦ · الشيفرة"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch origin "$BRANCH" --quiet || warn "تعذّر الجلب"
  git -C "$APP_DIR" checkout "$BRANCH" --quiet
  git -C "$APP_DIR" pull --ff-only --quiet || warn "تعذّر السحب — مجلّدُ العمل غيرُ نظيف؟"
  ok "حُدِّث $APP_DIR"
else
  mkdir -p "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO" "$APP_DIR" --quiet || fail "تعذّر الاستنساخ من $REPO"
  ok "استُنسخ إلى $APP_DIR"
fi
cd "$APP_DIR"
echo "الإصدار: $(git rev-parse --short HEAD)"

step "٥/٦ · ملفُّ البيئة"
ENV_FILE=deploy/.env.production
if [ -f "$ENV_FILE" ]; then
  # لا يُكتب فوقه: فيه أسرارٌ تعمل، وإعادةُ توليدها تقطع القاعدةَ وتُبطل الروابط
  ok "$ENV_FILE موجودٌ — لم يُمَسّ"
else
  cp deploy/.env.production.example "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  PG_PASS="$(openssl rand -base64 32 | tr -d '\n/@ ')"
  STORE="$(openssl rand -hex 32)"
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PG_PASS}|" "$ENV_FILE"
  sed -i "s|^STORAGE_SECRET=.*|STORAGE_SECRET=${STORE}|" "$ENV_FILE"
  ok "أُنشئ $ENV_FILE (٦٠٠) بكلمةِ قاعدةٍ ومفتاحِ تخزينٍ عشوائيَّين"
fi

step "٦/٦ · مؤقّتُ النسخ الاحتياطيّ"
if [ -f deploy/wajeez-backup.timer ]; then
  cp deploy/wajeez-backup.service deploy/wajeez-backup.timer /etc/systemd/system/ 2>/dev/null || true
  systemctl daemon-reload 2>/dev/null || true
  systemctl enable --now wajeez-backup.timer 2>/dev/null \
    && ok "المؤقّتُ مفعَّل — ولن يعمل قبل ضبط BACKUP_REMOTE" \
    || warn "تعذّر تفعيلُ المؤقّت"
fi

# ── ما لا يخترعه سكربت ──
MISSING=""
for k in PAYMENT_SECRET_KEY PAYMENT_PUBLISHABLE_KEY PAYMENT_WEBHOOK_SECRET RESEND_API_KEY BACKUP_REMOTE; do
  grep -qE "^${k}=.+" "$ENV_FILE" || MISSING="$MISSING  · $k\n"
done

printf '\n\033[32m✓ جُهِّز الخادم — ولم يُنشَر بعد\033[0m\n\n'
if [ -n "$MISSING" ]; then
  printf 'وهذه تُملأ بيدك في %s/%s — لا يخترعها سكربت:\n' "$APP_DIR" "$ENV_FILE"
  printf "$MISSING"
  cat <<'MSG'
  (وعنوانُ خطّاف سترايب: https://<نطاقك>/api/webhooks/payments/stripe
   بحدث checkout.session.completed — ومنه يُنسخ whsec_)

MSG
fi
cat <<MSG
ثمّ — وبهذا الترتيب:

  nano $APP_DIR/$ENV_FILE      املأ ما سبق
  cd $APP_DIR && bash deploy/deploy.sh
  bash scripts/install-auto-deploy.sh          نشرٌ آليٌّ بلا مفتاحٍ يخرج

⚠️  ومن كان له قاعدةٌ على خادمٍ سابق فلينقلها **قبل** deploy.sh:
      bash deploy/migrate-in.sh --check
    وإلّا خدم النطاقُ أكاديميّةً فارغة.
MSG
