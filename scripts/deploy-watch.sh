#!/usr/bin/env bash
# مراقبُ النشر — الخادمُ يسحب بنفسه، ولا يخرج منه سرٌّ واحد.
#
# ── لماذا هذا الاتّجاه لا العكس ──
#
# النشرُ من GitHub يقتضي أن يحمل GitHub مفتاحَ خادمك. وذلك يعني أن تثق —
# لا بـGitHub وحدَه — بل بكلِّ من يملك صلاحيّةَ الكتابة في المستودَع: من كتب
# سير عملٍ استطاع أن يقرأ السرَّ نظريّا. وقرارُ صاحب المنصّة أن لا تخرج
# مفاتيحُ الخادم منه.
#
# فقُلب الاتّجاه: **الخادمُ يسأل، ولا يُسأل.** لا مفتاحَ في GitHub، ولا منفذَ
# مفتوحٌ لأحد، ولا سرَّ في أيّ مكانٍ خارج الخادم. وثمنُه تأخيرٌ يساوي دورةَ
# الجدولة (خمسُ دقائقَ في المقترَح) بين الدمج والنشر.
#
# ── ماذا يفعل ──
#
#   ١) يسأل: هل تحرّكت `origin/main` عن نسختي؟
#   ٢) فإن لم تتحرّك — يخرج صامتا. لا سطرَ في السجلّ كلَّ خمس دقائق.
#   ٣) وإن تحرّكت — يشغّل `deploy-cloudways.sh`، ويكتب النتيجةَ في السجلّ.
#
# ── التركيب (مرّةً واحدة) ──
#
#   crontab -e   ثمّ سطرٌ واحد:
#     */5 * * * * /bin/bash /المسار/إلى/المستودَع/scripts/deploy-watch.sh
#
#   أو من لوحة Cloudways: Application ← Cron Job Management.
#
#   والسجلّ في `~/wajeez-deploy.log` (يُغيَّر بـWAJEEZ_DEPLOY_LOG).
#
# ── التشغيل يدويّا للفحص ──
#
#   bash scripts/deploy-watch.sh          يسحب إن تحرّكت main
#   bash scripts/deploy-watch.sh --check  يقول ماذا سيفعل ولا يفعل

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="${WAJEEZ_DEPLOY_LOG:-$HOME/wajeez-deploy.log}"
LOCK="${WAJEEZ_DEPLOY_LOCK:-${TMPDIR:-/tmp}/wajeez-deploy.lock}"
CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

log() { printf '[%s] %s\n' "$(date -u '+%Y-%m-%d %H:%M:%SZ')" "$1" >> "$LOG"; }
say() { printf '%s\n' "$1"; }

cd "$ROOT"

# ── قفلٌ يمنع نشرتَين متداخلتَين ──
# دورةُ الجدولة خمسُ دقائق والنشرةُ قد تطول. وبلا قفلٍ تبدأ الثانيةُ فوق
# الأولى: `npm ci` يحذف node_modules بينما البناءُ يقرأ منها.
# و`mkdir` ذرّيٌّ على كلّ نظام ملفّات — لا يحتاج flock.
if ! mkdir "$LOCK" 2>/dev/null; then
  say "نشرةٌ جاريةٌ بالفعل — لا شيء"
  exit 0
fi
# يُحرَّر القفلُ مهما كانت النهاية — نجاحا أو فشلا أو مقاطعة
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT INT TERM

# ── حارسٌ: لا يُنشَر إلّا من main ──
# خادمٌ تُرك على فرعٍ آخر بعد فحصٍ يدويّ لا يُسحَب إليه main صامتا.
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  MSG="⚠ الخادمُ على الفرع «${BRANCH}» لا main — لا نشر. أعِده إلى main يدويّا."
  say "$MSG"; log "$MSG"
  exit 1
fi

# ── هل تحرّكت؟ ──
if ! git fetch origin main --quiet 2>/dev/null; then
  MSG="⚠ تعذّر الوصولُ إلى origin — يُعاد في الدورة التالية"
  say "$MSG"; log "$MSG"
  exit 0                     # عطبُ شبكةٍ عابرٌ لا يستحقّ إنذارا
fi

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"

if [ "$LOCAL" = "$REMOTE" ]; then
  # لا سطرَ في السجلّ: سطرٌ كلَّ خمس دقائق يُغرقه فلا يُقرأ حين يهمّ
  say "لا جديد — ${LOCAL:0:7}"
  exit 0
fi

# ── تحرّكت ──
SUBJECT="$(git log --format=%s -1 origin/main | cut -c1-72)"
say "جديد: ${LOCAL:0:7} ← ${REMOTE:0:7} — ${SUBJECT}"

if [ "$CHECK_ONLY" = "1" ]; then
  say "(--check: لم يُنفَّذ شيء)"
  exit 0
fi

log "▶ نشرةٌ تبدأ: ${LOCAL:0:7} ← ${REMOTE:0:7} — ${SUBJECT}"

if bash "$ROOT/scripts/deploy-cloudways.sh" >> "$LOG" 2>&1; then
  log "✔ نشرةٌ اكتملت: ${REMOTE:0:7}"
  say "✔ اكتملت — ${REMOTE:0:7}"
else
  STATUS=$?
  # الفشلُ يُصرَّخ به في السجلّ لا يُبتلع. ولا رصدَ آليّا بعد (البند ٢٥ في
  # docs/review-2026-09-06) — فهذا السطرُ هو كلُّ ما ينبّه اليوم، ويُقرأ بـ:
  #   grep '✖' ~/wajeez-deploy.log
  log "✖ نشرةٌ فشلت (خروج ${STATUS}) عند ${REMOTE:0:7} — الخادمُ باقٍ على ${LOCAL:0:7}"
  say "✖ فشلت — راجع $LOG"
  exit "$STATUS"
fi
