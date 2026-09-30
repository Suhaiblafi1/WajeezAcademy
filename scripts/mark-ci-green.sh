#!/usr/bin/env bash
# يُقدِّم فرعَ `ci-green` إلى التزامٍ اجتاز CI على main — تقدّما لا رجوعا.
#
#   GH_TOKEN=… bash scripts/mark-ci-green.sh <owner/repo> <sha>
#
# يناديه `green` في ci.yml وحدَه، بعد أن تنجح الوظيفتان على main. والفرعُ هو ما
# ينشره الخادم (`deploy/target.sh`) — فهذا الملفُّ هو الإذنُ بالنشر، والشرحُ هناك.
#
# ═══ تقدّما لا رجوعا ═══
#
# تشغيلاتُ CI على main تنتهي بغير ترتيب دمجها: الأقصرُ ينتهي أوّلا. فلو كتب كلٌّ
# التزامَه فوق الفرع لأعاده الأبطأُ إلى الوراء — والخادمُ لا يرجع (يجلب تقدّما
# فقط)، لكنّ ما نُشر يصير أحدثَ ممّا يقوله الفرع، فيُقرأ السجلُّ على غير حقيقته.
# فيُقارَن أوّلا: هذا أحدثُ ممّا في الفرع؟ يُقدَّم. أقدمُ أو هو؟ يُترك. متفرّقان؟
# خطأٌ يُقال — فلا التزامَ على main يفارق آخرَ عليها.
#
# والكتابةُ نفسُها `force=false`: فإن سبقه تشغيلٌ آخرُ بين المقارنة والكتابة ردّها
# GitHub، فيُعاد السؤالُ من أوّله — ثلاثَ مرّات.

set -euo pipefail

REPO="${1:?owner/repo}"
SHA="${2:?sha}"
REF="heads/ci-green"

for _ in 1 2 3; do
  CUR="$(gh api "repos/$REPO/git/ref/$REF" --jq .object.sha 2>/dev/null || true)"

  if [ -z "$CUR" ]; then
    if gh api -X POST "repos/$REPO/git/refs" -f "ref=refs/$REF" -f "sha=$SHA" >/dev/null 2>&1; then
      echo "أُنشئ ci-green عند ${SHA:0:7}"
      exit 0
    fi
    continue   # أنشأه تشغيلٌ آخرُ في اللحظة نفسِها — يُعاد السؤال
  fi

  STATUS="$(gh api "repos/$REPO/compare/$CUR...$SHA" --jq .status)"
  case "$STATUS" in
    identical|behind)
      echo "ci-green عند ${CUR:0:7} — وهو ${SHA:0:7} أو أحدثُ منه، فلا رجوع"
      exit 0
      ;;
    ahead)
      if gh api -X PATCH "repos/$REPO/git/refs/$REF" -f "sha=$SHA" -F force=false >/dev/null 2>&1; then
        echo "تقدّم ci-green: ${CUR:0:7} ← ${SHA:0:7}"
        exit 0
      fi
      ;;         # تقدّم به تشغيلٌ آخرُ بين المقارنة والكتابة — يُعاد السؤال
    *)
      echo "::error::ci-green (${CUR:0:7}) و${SHA:0:7} متفرّقان (${STATUS}) — لا يُكتب فوقه" >&2
      exit 1
      ;;
  esac
done

echo "::error::تعذّر تقديمُ ci-green إلى ${SHA:0:7} بعد ثلاث محاولات" >&2
exit 1
