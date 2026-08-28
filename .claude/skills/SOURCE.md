# مصدر المهارات المستوردة — من أين جاء كل ملف، وبأي رخصة

هذه المهارات **تعليمات يتبعها كلود** وهو يعمل على مستودع حيّ فيه مدفوعات. فمن
كتبها يوجّه سلوكه هنا — ولهذا يُسجَّل مصدر كل ملف والتزامُه بالضبط، لا «من
GitHub» ولا «من الفرع الرئيسي». وأي تحديث لاحق يقارَن بهذه الالتزامات.

جُلبت بـ`curl` من `raw.githubusercontent.com` بلا استنساخ المستودعات.
تاريخ الجلب: 2026-08-28.

## ما استُورد

| المهارة | المصدر | الالتزام | الرخصة |
|---|---|---|---|
| `verification-before-completion` | [obra/superpowers](https://github.com/obra/superpowers) · `skills/verification-before-completion/` | `b36e082` | MIT |
| `systematic-debugging` (+ ثلاثة ملفات شقيقة) | obra/superpowers · `skills/systematic-debugging/` | `b36e082` | MIT |
| `test-driven-development` | obra/superpowers · `skills/test-driven-development/` | `b36e082` | MIT |
| `webapp-testing` | [anthropics/skills](https://github.com/anthropics/skills) · `skills/webapp-testing/` | `3b3fad9` | Apache 2.0 |
| `retrieval-practice-generator` | [GarethManning/claude-education-skills](https://github.com/GarethManning/claude-education-skills) · `skills/memory-learning-science/` | سجلّ ‎2026-08-10T12:45:42Z | CC BY-SA 4.0 |
| `cognitive-load-analyser` | المصدر نفسه · `skills/memory-learning-science/` | السجلّ نفسه | CC BY-SA 4.0 |
| `backwards-design-unit-planner` | المصدر نفسه · `skills/curriculum-assessment/` | السجلّ نفسه | CC BY-SA 4.0 |
| `assessment-validity-checker` | المصدر نفسه · `skills/curriculum-assessment/` | السجلّ نفسه | CC BY-SA 4.0 |

نصوص الرخص محفوظة: `LICENSE-superpowers.txt` و`webapp-testing/LICENSE.txt`
و`LICENSE-education-skills.txt`. كلُّها تشترط بقاء إشعار الرخصة مع النسخة —
وهو هنا.

## تنبيه على CC BY-SA 4.0

مكتبة التعليم بالمشاركة بالمثل: النسخُ حرفا مع النسبة والرخصة — كما هنا —
لا يُلزم شيئا زائدا. لكنّ **أيَّ تعديل على ملفّاتها الأربعة يجعله عملا مشتقّا
يجب نشره بالرخصة نفسها**. فلا تُعدَّل، وما يخصّنا في ملفٍّ مجاور مستقلّ لا
يقتبس نصّها (`WAJEEZ-AUTHORING.md`).

المكتبة `GarethManning/claude-education-skills`: ١٦٥ مهارة في ٢٠ نطاقا، كلٌّ
منها بأدلّةٍ مُسمّاة وتقديرٍ صريح لقوّتها (strong · moderate · emerging)،
ومعها `docs/EXCLUSIONS.md` يوثّق ما استُبعد لضعف دليله — ومنه «أنماط التعلّم»
وVAK. وهذا التوثيقُ للاستبعاد هو ما رجّحها على غيرها: مكتبةٌ تُعلن ما لا
تُصدّقه أوثقُ من مكتبةٍ تجمع كل شيء.

والمثبَّت أربعٌ من الأربع والستّين المرشّحة، وكلُّها `evidence_strength:
strong`، وكلُّها تطابق ما نؤلّفه فعلا. وتُركت `learning-target-authoring-guide`
مع حاجتنا إليها لأن المكتبة نفسها تصنّفها `emerging`.

## ما لم يُستورد ولماذا

`anthropics/skills` تحوي `scripts/with_server.py` و`examples/*.py` التي تشير
إليها `webapp-testing`. لم تُجلب: بايثون Playwright غير مثبّتة في هذه البيئة
(`ModuleNotFoundError: No module named 'playwright'`)، والمثبّت هو
`playwright-core` على Node. فجلبُها يضع في المستودع ملفات لا تعمل.

## ما أُضيف من عندنا — ولم يُعدَّل من الأصل

الملفات المستوردة **كما هي حرفا**، ولم يُغيَّر فيها شيء: تعديلُها يمنع مقارنة
التحديثات القادمة بالأصل، ويُلزم بتوثيق التعديل في Apache 2.0 (§4ب). وما
يخصّنا في ملفات مجاورة تحمل اللاحقة `WAJEEZ-`:

- `webapp-testing/WAJEEZ-RUNTIME.md` — الأصل يفترض بايثون، وهذه البيئة Node
  بمتصفّح مثبّت المسار. بلا هذا الملف تكون المهارة صحيحة المبدأ ومستحيلة التنفيذ.
- `test-driven-development/WAJEEZ-SCOPE.md` — أين يُلزم قانونها الحديدي في هذا
  المستودع، وما البديل المكافئ حيث لا يصلح اختبارٌ فاشل أولا.

## قاعدة المراجعة

كلُّ مهارةٍ تُضاف هنا تُقرأ كاملة قبل إدخالها، وتُلتزَم في التزام مستقل عن عمل
المنتج — كي يراها المراجع وحدها. وإن أمرت مهارةٌ بما يخالف قواعد هذا المستودع
(القياس قبل التغيير، البوابات السبع، لا دفع إلى فرع غير الفرع المعتمد، لا أسماء
تُعرض كحقيقة قبل توثيقها) فقواعد المستودع هي التي تُتّبع، ويُقال ذلك صراحة.
