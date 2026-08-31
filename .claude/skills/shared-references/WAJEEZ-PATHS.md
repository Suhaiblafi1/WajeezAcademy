# مسارات أدوات «فضاءات المعرفة» في هذا المستودع

مهاراتُ Knowledge Space Theory العشر تقول في نصّها: «استخدم
`scripts/kst_utils.py`» و«يطابق `schemas/knowledge-graph.schema.json`».
هذان مسارانِ نسبيّان إلى جذر مستودعها الأصلي، لا إلى جذر مستودعنا. ولم
يُعدَّل نصُّها — القاعدة في `SOURCE.md` — فالتصحيح هنا:

| ما يقوله النصّ | المسار الفعلي عندنا |
|---|---|
| `scripts/kst_utils.py` | `.claude/skills/shared-references/scripts/kst_utils.py` |
| `schemas/knowledge-graph.schema.json` | `.claude/skills/shared-references/schemas/knowledge-graph.schema.json` |
| `.claude/skills/shared-references/*.md` | كما هو — صحيح عندنا |
| `graphs/*.json` | لا وجود له بعد؛ يُنشأ عند أوّل استعمال حقيقي |

والأداة مجرّبة هنا: `python3 .claude/skills/shared-references/scripts/kst_utils.py`
يطبع قائمة أوامره (validate · closure · enumerate · paths · analytics · cycles).
لا تحتاج إلى `pip`؛ مكتبة بايثون القياسية تكفيها.

## أين تنفع هذه المهارات عندنا — وأين لا

تنفع في **العلاقة القبْليّة بين دورات المسار**: أيُّ دورةٍ شرطٌ لأيّ. هذا
سؤالٌ نجيب عنه اليوم بالحدس في `pathway`، وهو بالضبط ما تحسبه
`building-surmise-relations` ثم تتحقّق منه `validating-knowledge-structure`
(كشف الدوائر، الإغلاق التعدّي).

ولا تنفع في **التشخيص الحالي**: تشخيصُنا استبيانُ سياقٍ ومهنة، لا اختبار
معرفةٍ تكيّفيّ. فـ`assessing-knowledge-state` تفترض بنودا مصحَّحة صحّةً
وخطأً، وليس ذلك ما نقيسه. لا تُستدعى على مسار التشخيص إلّا إن غيّرنا
طبيعته أوّلا واتّفقنا على ذلك.
