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

نصّا الرخصتين محفوظان: `LICENSE-superpowers.txt` و`webapp-testing/LICENSE.txt`.
كلتاهما تشترط بقاء إشعار الرخصة مع النسخة — وهو هنا.

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
