#!/usr/bin/env bash
# سكربتُ النشر على Cloudways — المصدرُ الواحدُ لما يجري عند كلّ نشرة.
#
# لماذا في المستودَع لا على الخادم: كان أمرُ التشغيل مكتوبا بيدٍ **خارج**
# المستودَع، لا يعرفه أحدٌ ولا يراجعه أحدٌ ولا يتحدّث حين تتغيّر الشيفرة.
# فوقع ما وقع: `npm run build` جرى وملفّاتُ الواجهة تغيّرت، وعمليّةُ Node
# بقيت في الذاكرة بالشيفرة التي أقلعت بها — فعرضت صفحةُ الدورات ٨١ دورةً
# و`‎/api/version` يردّ بشيفرةٍ سابقةٍ للدمج. وهذا الملفُّ هو ذلك الأمرُ وقد
# دخل المستودَع: يقرؤه المراجعُ، ويشغّله خطُّ النشر، ويشغّله من يفتح SSH —
# ثلاثتُهم الشيءَ نفسَه.
#
# ويطابق `docs/DEPLOYMENT.md` §٢ خطوةً بخطوة. أيُّ تغييرٍ هنا يُنقل هناك.
#
#   الاستعمال (من جذر المستودَع على الخادم):
#     bash scripts/deploy-cloudways.sh
#
#   المتغيّراتُ الاختياريّة:
#     WAJEEZ_RESTART_CMD   أمرُ إعادة التشغيل — الافتراض `supervisorctl restart all`
#     WAJEEZ_SKIP_PULL=1   لا يسحب (حين يكون السحبُ قد جرى قبلَه)

set -euo pipefail

step() { printf '\n\033[1m── %s\033[0m\n' "$1"; }
note() { printf '   %s\n' "$1"; }

cd "$(dirname "$0")/.."

# ─── ١) الشيفرة ───
if [ "${WAJEEZ_SKIP_PULL:-}" != "1" ]; then
  step "سحبُ الشيفرة"
  git fetch origin main
  # `--ff-only` بقصد: لو كان على الخادم التزامٌ محلّيٌّ (إصلاحٌ عاجلٌ بيدٍ مثلا)
  # يفشل السحبُ ويُقال — ولا يُمحى عملُ أحدٍ بصمت.
  git merge --ff-only origin/main
fi
DEPLOYED_SHA="$(git rev-parse --short=7 HEAD)"
note "الالتزام: ${DEPLOYED_SHA}"

# ─── ٢) الاعتماديّات وقاعدة البيانات ───
step "تثبيتُ الاعتماديّات"
npm ci

step "توليدُ عميل Prisma"
npx prisma generate

# ⚠️ لا يُشترط بأيّ متغيّرِ بيئة. وبدونه: انحرافُ مخطَّط — ترحيلاتٌ جديدة
#    لا تُنفَّذ، فمساراتُ الخادم تسقط بـ٥٠٠ على أعمدةٍ غيرِ موجودة.
step "ترحيلاتُ قاعدة البيانات"
npx prisma migrate deploy

# ─── ٣) البناء ───
# يقرأ VITE_SITE_ORIGIN من البيئة، ويكتب ختمَ البناء تلقائيا (خطّاف prebuild).
step "بناءُ الواجهة"
npm run build

# ─── ٤) المحتوى — وهو ما يُنسى فيتجمّد ما يراه المتعلّم ───
# `‎/api/public/core-catalog` يقرأ **الجداولَ الحيّة** لا ملفّات المستودَع.
# فبلا هاتين الخطوتين تصل شيفرةٌ جديدةٌ فوق محتوًى قديمٍ لا يتغيّر — وهو
# أحدُ وجهَي شكوى «الموقعُ القديمُ يتصدّر».
step "استيرادُ الكتالوج إلى الجداول الحيّة"
CATALOG_IMPORT_SKIP_MIGRATE=1 npm run catalog:import

step "نشرُ لقطة الكتالوج والتشخيص"
npm run catalog:publish

# ─── ٥) إعادةُ التشغيل — أخطرُ خطوةٍ في الملفّ ───
# عمليّةُ Node تبقى في الذاكرة بالشيفرة التي أقلعت بها. وزرُّ «إعادة تشغيل
# التطبيق» في لوحة Cloudways **لا يكفي**: يعيد خادمَ الويب ولا يمسّ عمليّةَ
# Node. المطلوبُ وظيفةُ Supervisor التي تشغّلها.
step "إعادةُ تشغيل عمليّة Node"
RESTART_CMD="${WAJEEZ_RESTART_CMD:-supervisorctl restart all}"
note "الأمر: ${RESTART_CMD}"
eval "${RESTART_CMD}"

# ─── ٦) تفريغُ Varnish ───
# Cloudways يشغّله افتراضا وهو يخزّن HTML ويعلو على `.htaccess`. وموضعُه هنا
# فلا يُنسى. ولا يُسقط النشرةَ إن تعذّر — لكنّه **يُقال** ولا يُبتلع: تفريغٌ
# صامتٌ لم يقع هو بعينه العطبُ الذي يُبحث عنه بعد أسبوع.
step "تفريغُ Varnish"
if command -v varnishadm >/dev/null 2>&1; then
  if varnishadm 'ban req.url ~ .' >/dev/null 2>&1; then
    note "فُرِّغ."
  else
    note "⚠️  varnishadm موجودٌ ورفض الأمر — فرّغه من لوحة Cloudways: Application ← Purge Varnish"
  fi
else
  note "⚠️  varnishadm غيرُ متاحٍ لهذا المستخدم — فرّغه من لوحة Cloudways: Application ← Purge Varnish"
fi

# ─── ٧) التحقّق — النشرةُ تُعلَن ناجحةً حين يقولها الخادمُ لا حين ترجع الأوامر ───
# يُسأل الخادمُ المحلّيُّ مباشرةً (127.0.0.1) لا النطاقُ العامّ: فالمقصودُ
# «هل أعادت عمليّةُ Node الإقلاعَ على الشيفرة الجديدة؟» — لا «هل يعمل
# النطاق؟». وسؤالُ النطاق يمرّ بـVarnish فقد يجيب من محفوظ.
step "التحقّق من الالتزام العامل"
API="http://127.0.0.1:${API_PORT:-7101}/api/version"
LIVE=""
for _ in 1 2 3 4 5 6; do
  sleep 3
  BODY="$(curl -fsS --max-time 15 "$API" 2>/dev/null || true)"
  [ -n "$BODY" ] || continue
  LIVE="$(printf '%s' "$BODY" | grep -o '"الالتزام":"[0-9a-f]\{7\}"' | head -1 | grep -o '[0-9a-f]\{7\}' || true)"
  [ -n "$LIVE" ] && break
done

if [ -z "$BODY" ]; then
  printf '\n\033[1;31m✖ الخادمُ لا يجيب على %s بعد إعادة التشغيل\033[0m\n' "$API"
  note "النشرُ جرى والخادمُ ساقط — راجع سجلّ Supervisor فورا"
  exit 1
fi
if [ -n "$LIVE" ] && [ "$LIVE" != "${DEPLOYED_SHA}" ]; then
  printf '\n\033[1;31m✖ الخادمُ يعمل بالتزام %s لا %s\033[0m\n' "$LIVE" "${DEPLOYED_SHA}"
  note "إعادةُ التشغيل لم تأخذ الشيفرةَ الجديدة — وهذا العطبُ بعينه الذي وقع من قبل"
  exit 1
fi
if [ -z "$LIVE" ]; then
  note "⚠ الخادمُ يجيب ولا يعلن التزامَه — راجع ختمَ البناء"
fi

printf '\n\033[1m✔ اكتملت النشرة — الالتزام %s، والخادمُ يعلنه\033[0m\n\n' "${DEPLOYED_SHA}"
