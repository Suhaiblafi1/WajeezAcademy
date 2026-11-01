#!/bin/bash
# يثبّت أداةَ graphify في الجلسات السحابيّة — قرارُ صاحب المنصّة (١ نوفمبر ٢٠٢٦).
#
# مهارةُ `.claude/skills/graphify` تنادي الأمرَ `graphify`؛ وبلا الأداة تكون تعليماتٍ
# تشير إلى ما لا وجودَ له (علّةُ `claude-mem` في `.claude/skills/SOURCE.md`). والحاويةُ
# السحابيّةُ تُستعاد بعد كلّ سكون فيضيع ما ثُبّت فيها، فيُثبَّت هنا عند بدء الجلسة.
#
# • في السحابة وحدَها: جهازُ صاحب المنصّة أو غيرِه لا يُفرض عليه تثبيتٌ.
# • النسخةُ مثبَّتة (`GRAPHIFY_VERSION`) — هي التي قُرئ مصدرُها قبل الاستيراد. وأيُّ
#   ترقيةٍ تمرّ بقراءةٍ جديدةٍ وتحديثِ السطر في SOURCE.md معا.
# • لا يمنع بدءَ الجلسة إن تعذّر: الأداةُ عونٌ لا شرط، فيقول ما تعذّر ويخرج بصفر.
# • لا يكتب في CLAUDE.md ولا يضيف خطّافاتِ PreToolUse — `graphify install --project`
#   يفعل الأمرين، ولذلك لا يُشغَّل هنا.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

GRAPHIFY_VERSION="0.9.100"
BIN="$HOME/.local/bin"
export PATH="$BIN:$PATH"

# ليجد كلود الأمرَ في كلّ أوامر الجلسة
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$BIN:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

# مثبَّتٌ بالنسخة نفسِها؟ فلا شيء
if command -v graphify >/dev/null 2>&1 && graphify --version 2>/dev/null | grep -qx "graphify $GRAPHIFY_VERSION"; then
  exit 0
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "graphify: لا uv في هذه البيئة — لم يُثبَّت، ومهارةُ graphify لن تعمل في هذه الجلسة" >&2
  exit 0
fi

if ! uv tool install --force "graphifyy==$GRAPHIFY_VERSION" >/dev/null 2>&1; then
  echo "graphify: تعذّر تثبيتُ graphifyy==$GRAPHIFY_VERSION (الشبكة؟) — مهارةُ graphify لن تعمل في هذه الجلسة" >&2
  exit 0
fi
