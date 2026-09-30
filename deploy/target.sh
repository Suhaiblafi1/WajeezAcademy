#!/usr/bin/env bash
# ما يُنشَر: آخرُ التزامٍ اجتاز CI على main — لا رأسُ main كيفما كان.
#
#   bash deploy/target.sh                     يجلب ثمّ يطبع «<sha> <المصدر>»
#   DEPLOY_TARGET=<sha|ref> bash deploy/target.sh   تجاوزٌ بشريٌّ صريح — ويُتحقَّق أنّه على main
#
# والمصدرُ واحدٌ من ثلاثة: `ci-green` · `main` (قبل أوّل أخضر) · `override`.
#
# ═══ لماذا (٣٠ سبتمبر ٢٠٢٦) ═══
#
# قاعدةُ صاحب المنصّة: «لا يُدمج أحمر — خضرةُ CI هي الإذن». والدمجُ يُفحَص في
# طلبه، لكنّ النشرَ كان يأخذ رأسَ main لحظةَ يتحرّك: المراقبُ على الخادم
# (`scripts/deploy-watch.sh`) يرى الدمجَ في دقيقته فينشره — قبل أن يُفحَص على
# main نفسِها، ولو احمرّ بعد ذلك. وقيس ذلك يومَ كُتب هذا الملفّ: وصل #361 الإنتاجَ
# قبل أن ينتهي CI الخاصُّ به على main، وكان #360 قد دُمج قبله بثمانِ دقائق —
# فما نُشر خليطٌ لم يفحصه أحدٌ مجتمعا.
#
# فصارت CI تقول بنفسها ما اجتازها: وظيفتُها الأخيرة (`green` في ci.yml) تُقدِّم
# فرعَ `ci-green` إلى الالتزام الذي نجحت وظيفتاه على main — تقدّما لا رجوعا
# (`scripts/mark-ci-green.sh`). وهذا الملفُّ يقرؤه. فلا مفتاحَ ولا واجهةَ ولا
# مهلةَ طلبات: git وحدَه، وهو ما يملكه الخادمُ أصلا.
#
# ═══ وقبل أوّل أخضر: main كما كان ═══
#
# الفرعُ لا يوجد حتّى تنجح CI على main أوّلَ مرّةٍ بعد هذا التغيير. فحتّى يوجد
# يُتبَع main كما كان، ويُقال المصدرُ `main` ليُكتب في السجلّ. ومتى وُجد صار
# الحكمَ وحدَه.
#
# ═══ ولا يُنشَر ما ليس على main ═══
#
# ولو كُتب في `ci-green` أو في التجاوز التزامٌ من فرعٍ آخر — خطأً أو عمدا —
# رُدّ هنا قبل أن يُجلب إلى مجلّد العمل.
#
# رموزُ الخروج: ٢ تعذّر الوصولُ إلى origin (عابرٌ — يُعاد) · ٣ تجاوزٌ لا يُعرف ·
# ٤ الهدفُ ليس على main.

set -euo pipefail

cd "$(dirname "$0")/.."

git fetch --quiet origin +refs/heads/main:refs/remotes/origin/main 2>/dev/null \
  || { echo "تعذّر جلبُ main من origin" >&2; exit 2; }

# `--exit-code` يفرّق الغائبَ (٢) عن تعذّر الوصول (غيرُه)
GREEN=0
git ls-remote --exit-code origin refs/heads/ci-green >/dev/null 2>&1 || GREEN=$?

if [ -n "${DEPLOY_TARGET:-}" ]; then
  WANT="$(git rev-parse --verify --quiet "${DEPLOY_TARGET}^{commit}")" \
    || { echo "لا التزامَ باسم «${DEPLOY_TARGET}»" >&2; exit 3; }
  SOURCE=override
elif [ "$GREEN" = 0 ]; then
  git fetch --quiet origin +refs/heads/ci-green:refs/remotes/origin/ci-green 2>/dev/null \
    || { echo "تعذّر جلبُ ci-green من origin" >&2; exit 2; }
  WANT="$(git rev-parse origin/ci-green)"
  SOURCE=ci-green
elif [ "$GREEN" = 2 ]; then
  WANT="$(git rev-parse origin/main)"
  SOURCE=main
else
  echo "تعذّر السؤالُ عن ci-green في origin" >&2
  exit 2
fi

git merge-base --is-ancestor "$WANT" origin/main \
  || { echo "«${WANT:0:7}» ليس على main — لا يُنشَر" >&2; exit 4; }

echo "$WANT $SOURCE"
