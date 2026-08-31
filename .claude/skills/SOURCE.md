# مصدر المهارات المستوردة — من أين جاء كل ملف، وبأي رخصة

هذه المهارات **تعليمات يتبعها كلود** وهو يعمل على مستودع حيّ فيه مدفوعات. فمن
كتبها يوجّه سلوكه هنا — ولهذا يُسجَّل مصدر كل ملف والتزامُه بالضبط، لا «من
GitHub» ولا «من الفرع الرئيسي». وأي تحديث لاحق يقارَن بهذه الالتزامات.

جُلبت بـ`curl` من `raw.githubusercontent.com` بلا استنساخ المستودعات.
تاريخ الجلب: 2026-08-28، ودفعةٌ ثانية 2026-08-31.

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
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills) · `skills/frontend-design/` | `3b3fad9` | Apache 2.0 |
| `mcp-builder` (+ أربعة مراجع) | anthropics/skills · `skills/mcp-builder/` | `3b3fad9` | Apache 2.0 |
| `ui-ux-pro-max` (٤٢ ملفا: بيانات وسكربتات) | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) · `.claude/skills/ui-ux-pro-max/` | `d279284` | MIT |
| عشر مهارات KST + `shared-references` | [vanderbilt-data-science/knowledge-spaces](https://github.com/vanderbilt-data-science/knowledge-spaces) · `.claude/skills/` | `08e7aef` | MIT |
| `lecture-to-study-guide` · `rubric` · `concept-map` | [Jellypod-Inc/school-skills](https://github.com/Jellypod-Inc/school-skills) · `skills/` | `cd48479` | MIT |
| `product-marketing` · `cro` · `signup` · `pricing` · `copywriting` | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) · `skills/` | `e55de88` | MIT |

نصوص الرخص محفوظة: `LICENSE-superpowers.txt` و`webapp-testing/LICENSE.txt`
و`LICENSE-education-skills.txt` و`frontend-design/LICENSE.txt`
و`mcp-builder/LICENSE.txt` و`ui-ux-pro-max/LICENSE`
و`shared-references/LICENSE-knowledge-spaces.txt` و`LICENSE-school-skills.txt`
و`LICENSE-marketingskills.txt`. كلُّها تشترط بقاء إشعار الرخصة مع النسخة —
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

### من دفعة 2026-08-31 — مستودعاتٌ طُلبت ولم تُستورد

| المستودع | ما هو فعلا | القرار |
|---|---|---|
| `bnaveenbharathi/PERSONALIZED-LEARNING-PLATFORM` | وصفُ تطبيقِ تعلُّمٍ في ملف README، لا مهارات | لا شيء يُستورد: ليس فيه `SKILL.md` واحد |
| `affaan-m/ECC` | إطارُ تشغيلٍ كاملٌ لوكلاء («agent harness OS») | لا: يستبدل طريقةَ عملنا كلَّها لا يضيف إليها |
| `xbtlin/ai-berkshire` | عشرون مهارةَ بحثٍ استثماريّ بالصينيّة | لا: لا صلة لها بأكاديمية تدريبٍ عربيّة |
| `public-apis/public-apis` | فهرسُ واجهاتٍ عامّة، لا مهارة | لا: قائمةُ روابطَ لا تعليماتٌ يتبعها كلود |
| `awesomeclaude.ai/awesome-claude-skills` | موقعٌ لا مستودع | لا ملفّاتٍ تُجلب بـ`curl`؛ ولو أردناه فهو دليلٌ يُقرأ لا يُثبَّت |
| `alirezarezvani/claude-skills` | ٣٨٨ مهارة و٧٠٦ سكربت بايثون | لم تُثبَّت جملةً: ٣٨٨ ملفَّ تعليماتٍ في مستودعٍ فيه مدفوعات لا يمكن قراءتها كلَّها قبل الإدخال — وقاعدةُ المراجعة أدناه تمنع الإدخال بلا قراءة. حُفظ فهرسُها في `_catalogs/` لنختار منها واحدةً واحدة عند الحاجة |
| `w95/awesome-claude-corporate-skills` | ١٦٦ مهارةً بحسب الدور الوظيفيّ | المثل: حُفظ `INDEX.md` و`README.md` في `_catalogs/` فهرسا، ولم يُثبَّت منها شيء بعد |

ومن `Jellypod-Inc/school-skills` تُركت `lesson-plan` و`socratic-tutor`
و`circle-time` و`arts-crafts`: الأوليان يغطّيهما ما عندنا
(`backwards-design-unit-planner`)، والأخريان لرياض الأطفال والصفوف الأولى
ونحن نُدرّب بالغين. وملفّان تشير إليهما ولا وجود لهما في المستودع الأصل عند
هذا الالتزام: `shared/scripts/pdf_render.py` و`rubric/references/examples/`.

ومن `coreyhaines31/marketingskills` أُخذت خمسٌ تمسّ قِمعنا فعلا (السياق،
والتحويل، والتسجيل، والتسعير، والنصّ)، وتُركت البقيّة. وفُحصت الخمسُ من
جهةِ ما يقلق في مكتبةٍ تموّلها «شراكاتٌ موثّقة»: لا رابطَ خارجيّا واحدا في
نصوصها، ولا ذكرَ لشريكٍ ولا لأداةٍ بعينها. فإن ظهر ذلك في تحديثٍ لاحق
فهو سببٌ لعدم الترقية.

ومن `nextlevelbuilder/ui-ux-pro-max-skill` أُخذت المهارةُ وبياناتُها
وسكربتاتُها كاملةً (٤٢ ملفا، ٢ ميغابايت)، ولم يُؤخذ `cli/` ولا `src/`:
الأوّل مثبِّتُ npm لا نحتاجه، والثاني نسخةُ المطوّر من البيانات نفسها.
وجُرّبت هنا قبل الإدخال: `python3 .claude/skills/ui-ux-pro-max/scripts/search.py`
يعمل بمكتبة بايثون القياسية وحدها، ولا يكتب خارج مجلَّده (سوى `__pycache__`،
وقد أُضيف إلى `.gitignore`).

## ما أُضيف من عندنا — ولم يُعدَّل من الأصل

الملفات المستوردة **كما هي حرفا**، ولم يُغيَّر فيها شيء: تعديلُها يمنع مقارنة
التحديثات القادمة بالأصل، ويُلزم بتوثيق التعديل في Apache 2.0 (§4ب). وما
يخصّنا في ملفات مجاورة تحمل اللاحقة `WAJEEZ-`:

- `webapp-testing/WAJEEZ-RUNTIME.md` — الأصل يفترض بايثون، وهذه البيئة Node
  بمتصفّح مثبّت المسار. بلا هذا الملف تكون المهارة صحيحة المبدأ ومستحيلة التنفيذ.
- `test-driven-development/WAJEEZ-SCOPE.md` — أين يُلزم قانونها الحديدي في هذا
  المستودع، وما البديل المكافئ حيث لا يصلح اختبارٌ فاشل أولا.
- `shared-references/WAJEEZ-PATHS.md` — مهاراتُ KST العشر تشير إلى
  `scripts/kst_utils.py` بمسارٍ نسبيٍّ إلى جذر مستودعها لا جذرِنا. الملفُّ
  يصحّح المسار بلا أن يمسّ نصّها، ويقول أين تنفع عندنا وأين لا تنفع.

و`_catalogs/` ليست مهاراتٍ بل فهارسُ محفوظة (لا `SKILL.md` فيها فلا
يلتقطها كلود مهارةً): ما في المكتبتين الكبيرتين لنختار منه لاحقا بالقراءة.

## قاعدة المراجعة

كلُّ مهارةٍ تُضاف هنا تُقرأ كاملة قبل إدخالها، وتُلتزَم في التزام مستقل عن عمل
المنتج — كي يراها المراجع وحدها. وإن أمرت مهارةٌ بما يخالف قواعد هذا المستودع
(القياس قبل التغيير، البوابات السبع، لا دفع إلى فرع غير الفرع المعتمد، لا أسماء
تُعرض كحقيقة قبل توثيقها) فقواعد المستودع هي التي تُتّبع، ويُقال ذلك صراحة.
