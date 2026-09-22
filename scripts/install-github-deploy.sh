#!/usr/bin/env bash
# تركيبُ بابِ النشر من GitHub — أمرٌ واحدٌ يُنفَّذ **على خادم الإنتاج**، ثمّ
# تُلصَق أربعُ قيمٍ في GitHub ولا يُعاد شيء.
#
#   bash scripts/install-github-deploy.sh              يولّد ويركّب ويطبع ما يُلصَق
#   bash scripts/install-github-deploy.sh --check      يقول ما حالُه ولا يغيّر شيئا
#   bash scripts/install-github-deploy.sh --print-key  يطبع المفتاحَ الخاصّ وحدَه
#
# ═══ لماذا هذا السكربتُ موجود ═══
#
# الخطوةُ ① في `docs/DEPLOYMENT.md` §٢-جـ-٢ ثلاثةُ أسطرٍ تُكتب باليد على خادم
# الإنتاج، وفيها ثلاثةُ مواضعَ تفشل صامتةً:
#
#   · **سطرُ `command=` يُنسى أو يُكتب ناقصا.** وهو الأمانُ كلُّه: بدونه يفتح
#     المفتاحُ صَدَفةً كاملةً على الإنتاج لكلّ من يملك الكتابةَ في المستودَع.
#     ولا يحمرّ شيء — النشرُ يعمل، والبابُ صار أوسعَ ممّا أُريد له.
#   · **وإذنُ `~/.ssh` أو `authorized_keys`.** إن كان أوسعَ من اللازم تجاهل
#     sshd المفتاحَ **بلا سطرٍ في سجلٍّ يقرؤه أحد**، فيُقرأ الفشلُ «مفتاحٌ خطأ»
#     ويُولَّد ثانيةً ويُلصَق ثانيةً — والعلّةُ في الإذن لا في المفتاح.
#   · **وبصمةُ المضيف تُؤخَذ من الشبكة.** `ssh-keyscan` من جهازٍ بعيدٍ يسأل
#     الطريقَ عن بصمة الطريق. والمصدرُ الصادقُ هو الخادمُ نفسُه — وهذا
#     السكربتُ يجري عليه، فيقرؤها من `/etc/ssh/ssh_host_ed25519_key.pub`.
#
# ═══ وما لا يفعله ═══
#
# **لا يلمس GitHub.** لا رمزَ ولا شبكةَ ولا سرَّ يخرج من هذا الجهاز: يطبع ما
# تلصقه بيدك في `Settings → Environments → production`. وقاعدةُ المستودَع
# صريحة: «لا يُنقل مفتاحٌ في محادثة» — ولا في سكربتٍ يرفعه إلى مكان.
#
# **ولا يطبع المفتاحَ الخاصَّ إلّا بطلبٍ صريح** (`--print-key`): تشغيلٌ عاديٌّ
# يترك سرّا في سجلّ الطرفيّة وفي `~/.bash_history` لمن بعدك.
#
# **ولا يُبدِّل مفتاحا قائما.** من وُلد له مفتاحٌ ولُصق في GitHub، ثمّ وُلّد
# فوقَه ثانٍ، صار في GitHub سرٌّ لا يفتح شيئا — والنشرةُ تفشل بعد أسبوعٍ بلا
# أن يعرف أحدٌ لماذا. فالقائمُ يبقى، ويُقال إنّه بقي.
#
# **ولا يُلغي `deploy-watch.sh`**: الطريقان معا أمتنُ من واحد (§٢-جـ-٢).
#
# والتراجع: احذف سطرَ `github-deploy` من `~/.ssh/authorized_keys`. لا شيءَ
# غيرُه يتغيّر — ونسخةُ الملفّ قبل التعديل محفوظةٌ بجانبه.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

KEY="$HOME/.ssh/github_deploy"
PUB="$KEY.pub"
AUTH="$HOME/.ssh/authorized_keys"
HOST_KEY='/etc/ssh/ssh_host_ed25519_key.pub'

# ── الأمرُ المفروضُ على المفتاح: أربعةُ قيودٍ وأمرٌ واحد ──
#
# والمسارُ مقروءٌ من الشجرة لا مكتوبٌ حرفا: الوثيقةُ تكتب `/opt/wajeez` وهو
# العرف، ومن ركّب المستودَعَ في غيره كتب هذا السكربتُ أمرَه كما هو عنده —
# فلا يُركَّب أمرٌ يشير إلى ملفٍّ لا وجود له.
RESTRICTIONS='no-agent-forwarding,no-port-forwarding,no-pty,no-X11-forwarding'
FORCED="command=\"bash $ROOT/deploy/deploy.sh\",$RESTRICTIONS"

ok()   { printf '\033[32m✔\033[0m %s\n' "$1"; }
note() { printf '  %s\n' "$1"; }
step() { printf '\n\033[1m── %s ──\033[0m\n' "$1"; }
warn() { printf '\033[33m⚠\033[0m %s\n' "$1"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

MODE='install'
case "${1:-}" in
  --check) MODE='check' ;;
  --print-key) MODE='print-key' ;;
  '') ;;
  *) fail "خيارٌ لا أعرفه: $1 — والمعروفُ: --check أو --print-key" ;;
esac

# ═══ المفتاحُ الخاصُّ وحدَه، بطلبٍ صريح ═══
#
# يُطبع خامّا بلا ترويسةٍ ولا لون: يُلصَق في GitHub كما هو بسطوره، وأيُّ
# حرفٍ يُزاد يُفسده.
if [ "$MODE" = 'print-key' ]; then
  [ -f "$KEY" ] || fail "لا مفتاحَ في $KEY — شغّل السكربتَ بلا خيارٍ أوّلا"
  cat "$KEY"
  exit 0
fi

step "١/٥ · أهذا خادمُ الإنتاج؟"

[ -f "$ROOT/deploy/deploy.sh" ] || fail "لا يوجد $ROOT/deploy/deploy.sh — أهذا مجلَّدُ المستودَع؟"
ok "المستودَعُ هنا: $ROOT"

# ولمَ يُفحَص docker: المفتاحُ يُركَّب لمستخدِمٍ بعينه، والأمرُ المفروضُ يجري
# بصلاحيّته هو. فمستخدِمٌ لا يشغّل docker يُركَّب له بابٌ يفتح على فشل.
docker compose version >/dev/null 2>&1 \
  || fail "docker compose لا يعمل للمستخدِم «$(id -un)» — والأمرُ المفروضُ يجري بصلاحيّته. أضِفْه إلى مجموعة docker ثمّ أعِد الدخول."
ok "docker compose يعمل للمستخدِم $(id -un)"

# وأداةُ التوليد: على خادمٍ يُدخَل إليه بـSSH هي موجودةٌ أبدا — ويُقال صريحا
# حين تغيب، فـ«command not found» في وسط سكربتٍ لا يقول ما ينقص.
command -v ssh-keygen >/dev/null 2>&1 \
  || fail "لا توجد ssh-keygen — ثبّتها: apt install -y openssh-client"

# ═══ ومن يُركَّب له المفتاح: صاحبُ المستودَع لا من صادف أنّه يشغّل السكربت ═══
#
# الأمرُ المفروضُ يجري بصلاحيّة صاحب المفتاح، و`deploy.sh` يسحب ويبني في هذه
# الشجرة. فمفتاحٌ رُكِّب لـroot على شجرةٍ يملكها `wajeez` يُنتج أحدَ اثنين:
# `git` يردّ «dubious ownership» فلا يُسحب شيء، أو يُسحب بملكيّةٍ مختلطةٍ
# فتفشل النشرةُ التالية للمالك الأصليّ. وكلاهما يقع **بعد** أسبوعٍ من الضبط.
REPO_OWNER="$(stat -c '%U' "$ROOT/.git" 2>/dev/null || echo '?')"
[ "$REPO_OWNER" = "$(id -un)" ] \
  || fail "المستودَعُ يملكه «$REPO_OWNER» وأنت «$(id -un)» — شغّلْه بصاحبه: su - $REPO_OWNER ثمّ أعِد الأمر من $ROOT"
ok "المستخدِمُ «$(id -un)» يملك الشجرة"


# ═══ وميناءُ SSH: غيرُ ٢٢ لا يعمل مع هذا السير ═══
#
# `deploy.yml` لا يمرّر `-p` إلى `ssh`. فلو كان الميناءُ غيرَ الافتراضيّ
# لَركّبنا بابا لا يُفتح أبدا، وبصمةً لا تُطابق — ويُقرأ الفشلُ «بصمةٌ خطأ».
SSH_PORT="$(awk '/^[[:space:]]*Port[[:space:]]+[0-9]+/ {p=$2} END {print (p ? p : 22)}' /etc/ssh/sshd_config 2>/dev/null || echo 22)"
[ "$SSH_PORT" = '22' ] \
  || fail "ميناءُ SSH هنا $SSH_PORT لا ٢٢، و.github/workflows/deploy.yml لا يمرّر -p — فأضِفْه هناك أوّلا، وإلّا رُكِّب بابٌ لا يُفتح."
ok "ميناءُ SSH ٢٢ — كما يفترضه السير"

step "٢/٥ · مفتاحٌ خاصٌّ بهذا الباب"

mkdir -p "$HOME/.ssh"
if [ -f "$KEY" ]; then
  ok "مفتاحٌ قائمٌ في $KEY — يبقى كما هو"
  note "ولا يُولَّد فوقَه: ما في GitHub لن يوافق الجديدَ، فتفشل النشرةُ بلا سببٍ ظاهر."
  note "وإن أردتَ تبديلَه فعلا: احذف $KEY و$PUB ثمّ أعِد هذا السكربت، والصِقِ الجديدَ في GitHub."
elif [ "$MODE" = 'check' ]; then
  warn "لا مفتاحَ بعد — يولّده التشغيلُ بلا خيار"
else
  ssh-keygen -t ed25519 -C 'github-deploy' -f "$KEY" -N '' >/dev/null
  ok "وُلِّد: $KEY (بلا عبارةِ مرور — لا أحدَ يكتبها في مُشغِّل CI)"
fi

step "٣/٥ · الأمرُ المفروضُ في authorized_keys"

if [ ! -f "$PUB" ]; then
  warn "لا مفتاحَ عامَّ بعد — لا سطرَ يُركَّب"
else
  LINE="$FORCED $(cat "$PUB")"
  # ويُميَّز السطرُ بمادّة المفتاح لا بتعليقه: التعليقُ يُغيَّر باليد، والمادّةُ لا.
  BODY="$(awk '{print $2}' "$PUB")"
  touch "$AUTH"
  if grep -qxF "$LINE" "$AUTH"; then
    ok "السطرُ مركَّبٌ بالأمر نفسِه — لا يُكرَّر"
  elif grep -qF "$BODY" "$AUTH"; then
    if [ "$MODE" = 'check' ]; then
      warn "المفتاحُ مركَّبٌ بخيارٍ آخرَ — التشغيلُ بلا خيار يُصلحه"
      note "المركَّبُ الآن: $(grep -F "$BODY" "$AUTH" | head -1 | sed "s/ $BODY.*//")"
    else
      # نسخةٌ قبل كلّ تعديل: هذا الملفُّ هو بابُ دخولك إلى الخادم، وخطأٌ فيه
      # يُقفله عليك. ولا يُحذف إلّا سطرُ هذا المفتاح — بقيّةُ مفاتيحك لا تُمَسّ.
      BACKUP="$AUTH.bak-$(date +%Y%m%d%H%M%S)"
      cp -p "$AUTH" "$BACKUP"
      TMP="$(mktemp)"
      grep -vF "$BODY" "$AUTH" > "$TMP" || true
      printf '%s\n' "$LINE" >> "$TMP"
      cat "$TMP" > "$AUTH"
      rm -f "$TMP"
      ok "استُبدل السطرُ بالأمر المفروض — والنسخةُ قبله في $BACKUP"
    fi
  elif [ "$MODE" = 'check' ]; then
    warn "المفتاحُ غيرُ مركَّبٍ في $AUTH"
  else
    printf '%s\n' "$LINE" >> "$AUTH"
    ok "رُكِّب — ومن سرق المفتاحَ نشر الإصدارَ القائم ولا يفتح صَدَفةً ولا يقرأ ملفّا"
  fi
  note "الأمر: $FORCED"
fi

# ═══ والإذنُ: أكثرُ ما يُسقط مفتاحا صحيحا ═══
#
# sshd يتجاهل `authorized_keys` إن كان مكتوبا لغير صاحبه — بلا سطرٍ في سجلّ
# يقرؤه أحد. فيُقرأ الفشلُ «المفتاحُ خطأ» ويُولَّد ثانيةً بلا فائدة.
if [ "$MODE" != 'check' ]; then
  chmod 700 "$HOME/.ssh"
  [ -f "$AUTH" ] && chmod 600 "$AUTH"
  [ -f "$KEY" ] && chmod 600 "$KEY"
  ok "الإذنُ مضبوط: ‎700 لـ~/.ssh و600 للملفّين"
else
  PERM_DIR="$(stat -c '%a' "$HOME/.ssh" 2>/dev/null || echo '?')"
  PERM_AUTH="$(stat -c '%a' "$AUTH" 2>/dev/null || echo '—')"
  note "إذنُ ~/.ssh = $PERM_DIR · authorized_keys = $PERM_AUTH (المطلوب ٧٠٠ و٦٠٠)"
fi

step "٤/٥ · القيمُ الثلاثُ غيرُ السرّيّة"

DEPLOY_USER="$(id -un)"

# ═══ العنوانُ نطاقٌ لا رقم — والمحلولُ خبرٌ يُقرأ لا قيمةٌ تُلصق ═══
#
# ولا يُكتب الرقمُ في وثيقةٍ بقصد (`deploy/README.md`): الخادمُ انتقل مرّةً
# داخل Hetzner فبقيت الوثائقُ تشير إلى عنوانٍ ميّت — **فالاسمُ هو الثابتُ
# والرقمُ هو المتحرّك**، وهذا وحدَه يرجّح الاسم.
#
# ويزيده ترجيحا أنّ هذا السكربتَ يحلّ الاسمَ بمُحلِّلِ الجهاز الذي يجري عليه.
# ولو لُصق ما ردّه: مُحلِّلٌ مخدوعٌ أو وسيطٌ في الطريق يُنتج سرّا يشير إلى
# غير خادمك — **وهو عينُ ما وُضعت `known_hosts` لتمنعه**. فالاسمُ يُلصَق،
# والرقمُ يُعرض لتقابله بعينك بما تعرفه عن خادمك.
DOMAIN="$(grep -E '^[[:space:]]*SITE_DOMAIN=' deploy/.env.production 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '[:space:]' || true)"
[ -n "$DOMAIN" ] || DOMAIN='www.wajeezacademy.com'
DEPLOY_HOST="$DOMAIN"
RESOLVED="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}' || true)"

# ── وبصمةُ المضيف من الخادم نفسِه لا من الشبكة ──
if [ -f "$HOST_KEY" ]; then
  KNOWN="$DEPLOY_HOST $(awk '{print $1, $2}' "$HOST_KEY")"
else
  KNOWN=''
  warn "لا يوجد $HOST_KEY — خُذ البصمةَ بـ: ssh-keyscan -t ed25519 $DEPLOY_HOST"
fi

cat <<VALUES

  DEPLOY_USER        = $DEPLOY_USER
  DEPLOY_HOST        = $DEPLOY_HOST   (يُحلّ الآن إلى ${RESOLVED:-؟} — قابِلْه بما تعرفه عن خادمك)
  DEPLOY_KNOWN_HOSTS = ${KNOWN:-<خُذها بـ ssh-keyscan>}
  DEPLOY_SSH_KEY     = محتوى $KEY — لا يُطبع هنا بقصد
VALUES

step "٥/٥ · وما عليك في GitHub"
cat <<AFTER
① Settings → Environments → بيئةٌ اسمُها بالحرف: production
② أضِف فيها الأسرارَ الأربعةَ أعلاه. والخاصُّ يُنسخ بـ:

     bash scripts/install-github-deploy.sh --print-key

   (أو من جهازك: ssh $DEPLOY_USER@$DEPLOY_HOST 'cat ~/.ssh/github_deploy')

③ Actions → «نشرُ الإنتاج» → Run workflow. فإن خضّر صار كلُّ دمجٍ أخضرَ
   ينشر نفسَه؛ وإن حمّر فخطوةُ «التحقّقُ من أنّ النشرَ وقع فعلا» تقول لماذا —
   فنجاحٌ كاذبٌ أسوأُ من فشل.

والتراجع: احذف سطرَ github-deploy من $AUTH. ولا يتغيّر شيءٌ غيرُه.
AFTER
