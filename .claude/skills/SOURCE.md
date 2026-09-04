# مصدر المهارات المستوردة — من أين جاء كل ملف، وبأي رخصة

هذه المهارات **تعليمات يتبعها كلود** وهو يعمل على مستودع حيّ فيه مدفوعات. فمن
كتبها يوجّه سلوكه هنا — ولهذا يُسجَّل مصدر كل ملف والتزامُه بالضبط، لا «من
GitHub» ولا «من الفرع الرئيسي». وأي تحديث لاحق يقارَن بهذه الالتزامات.

جُلبت الدفعتان الأولى والثانية بـ`curl` من `raw.githubusercontent.com`.
وفي الثالثة أُغلق `api.github.com` على هذه الجلسة (٤٠٣: المستودعُ غيرُ مُصرَّحٍ به)
فتعذَّر سردُ الأشجار بلا استنساخ، فاستُنسخت الخمسةُ استنساخا سطحيّا
(`--depth 1`) إلى مجلَّدٍ مؤقّتٍ **خارج** المستودع، وقُرئت منه، ونُقل المثبَّت
منه نسخا حرفيّا. ولم يُستنسخ شيءٌ داخل المستودع.
تواريخ الجلب: 2026-08-28، و2026-08-31، ودفعةٌ ثالثة 2026-09-03.

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
| إحدى عشرة مهارةً من Superpowers (`brainstorming` · `dispatching-parallel-agents` · `executing-plans` · `finishing-a-development-branch` · `receiving-code-review` · `requesting-code-review` · `subagent-driven-development` · `using-git-worktrees` · `using-superpowers` · `writing-plans` · `writing-skills`) | obra/superpowers · `skills/` | `b36e082` | MIT |
| `find-skills` | [vercel-labs/skills](https://github.com/vercel-labs/skills) · `skills/find-skills/` | `435076e` | MIT |
| `task-observer` | [rebelytics/one-skill-to-rule-them-all](https://github.com/rebelytics/one-skill-to-rule-them-all) · الجذر و`references/` و`scripts/` | `510caad` | CC BY 4.0 |
| `impeccable` (١٦٣ ملفا) وأربعةُ وكلاءَ في `.claude/agents/` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) · `.claude/skills/impeccable/` و`.claude/agents/` | `fcc271c` | Apache 2.0 |

نصوص الرخص محفوظة: `LICENSE-superpowers.txt` و`webapp-testing/LICENSE.txt`
و`LICENSE-education-skills.txt` و`frontend-design/LICENSE.txt`
و`mcp-builder/LICENSE.txt` و`ui-ux-pro-max/LICENSE`
و`shared-references/LICENSE-knowledge-spaces.txt` و`LICENSE-school-skills.txt`
و`LICENSE-marketingskills.txt` و`LICENSE-vercel-skills.txt`
و`LICENSE-task-observer.txt` و`impeccable/LICENSE` (ومعه `impeccable/NOTICE.md`،
وهو إشعارُ الأصلِ نفسِه عن مادّةٍ اقتبسها من `ehmo/platform-design-skills`).
وSuperpowers تُغطّيها `LICENSE-superpowers.txt` الموجودة: الالتزامُ لم يتغيَّر
(`b36e082` نفسه)، فالإحدى عشرةُ الجديدةُ من الشجرة عينِها. كلُّها تشترط بقاء
إشعار الرخصة مع النسخة — وهو هنا.

## تنبيه على CC BY-SA 4.0

مكتبة التعليم بالمشاركة بالمثل: النسخُ حرفا مع النسبة والرخصة — كما هنا —
لا يُلزم شيئا زائدا. لكنّ **أيَّ تعديل على ملفّاتها الأربعة يجعله عملا مشتقّا
يجب نشره بالرخصة نفسها**. فلا تُعدَّل، وما يخصّنا في ملفٍّ مجاور مستقلّ لا
يقتبس نصّها (`WAJEEZ-AUTHORING.md`).

## تنبيه على CC BY 4.0 — `task-observer`

نسبةٌ بلا مشاركةٍ بالمثل، وهي أخفُّ من CC BY-SA: التعديلُ مباحٌ ما بقيت
النسبة. ومع ذلك **لا تُعدَّل** على قاعدتنا العامّة أدناه (النسخُ حرفا كي
تُقارَن التحديثات بالأصل). والنسبةُ مكتوبةٌ في متن `SKILL.md` نفسِه —
Eoghan Henn / rebelytics.com — فلا تُحذَف منه، ونصُّ الرخصة في
`LICENSE-task-observer.txt`.

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
- `WAJEEZ-SUPERPOWERS.md` — أين تصطدم الإحدى عشرةُ الجديدةُ بقواعد هذا
  المستودع (الفرعُ المعتمد، وأدواتُ الرسم الغائبة، والمسارات).
- `impeccable/WAJEEZ-RUNTIME.md` — الخُطّافانِ لم يُوصَلا، وما يصل إلى الشبكة،
  وأين تتقاطع المهارةُ مع `ui-ux-pro-max`.
- `task-observer/WAJEEZ-ACTIVATION.md` — التنشيطُ الدائمُ لم يُوصَل، ومساحةُ
  العملِ التي يطلبها تموت مع حاويةِ الجلسة البعيدة.
- `find-skills/WAJEEZ-REVIEW-RULE.md` — المهارةُ تأمر بتثبيتٍ بلا تأكيد
  (`-g -y`)، وقاعدةُ المراجعة تمنعه.
- `shared-references/WAJEEZ-PATHS.md` — مهاراتُ KST العشر تشير إلى
  `scripts/kst_utils.py` بمسارٍ نسبيٍّ إلى جذر مستودعها لا جذرِنا. الملفُّ
  يصحّح المسار بلا أن يمسّ نصّها، ويقول أين تنفع عندنا وأين لا تنفع.

و`_catalogs/` ليست مهاراتٍ بل فهارسُ محفوظة (لا `SKILL.md` فيها فلا
يلتقطها كلود مهارةً): ما في المكتبتين الكبيرتين لنختار منه لاحقا بالقراءة.

### من دفعة 2026-09-03 — ما طُلب وما استُثني

| المستودع | ما هو فعلا | القرار |
|---|---|---|
| `thedotmack/claude-mem` | تطبيقٌ كامل (`claude-mem` v13.24.0): خادمُ MCP، وعمليةُ عاملٍ على منفذٍ محليّ، وقاعدةُ SQLite في `~/.claude-mem/`، وخُطّافاتٌ تضغط سجلَّ الجلسة، ومزامنةٌ سحابيّةٌ مدفوعة عبر cmem.ai | **لا يُنسخ في المستودع، وقد ثُبِّت إضافةً** — انظر القسمَ التالي |

ومن `obra/superpowers` كانت ثلاثٌ مثبَّتةً من الدفعة الأولى بالالتزام نفسِه،
فأُكملت الشجرةُ إلى أربعَ عشرةَ — لم تُرقَّ ولم تُمسَّ الثلاثُ القديمة:
`git ls-remote` يُرجع `b36e082` نفسَه، أي أنّ المنبع لم يتحرَّك منذ الدفعة الأولى.

### `claude-mem` — إضافةٌ لا نسخةٌ في الشجرة

مهاراتُه التسعُ والعشرون **عملاءُ** لتشغيلٍ مثبَّت: تنادي أداةَ MCP باسم
`search`، وتستعلم منفذَ عاملٍ محليّ، وتقرأ `~/.claude-mem/claude-mem.db`.
فنسخُ `SKILL.md` منها إلى `.claude/skills/` يضع في المستودع تعليماتٍ تشير
إلى أدواتٍ لا وجود لها — وهي عينُ العلَّةِ التي مُنع بها جلبُ سكربتات
`webapp-testing`. **فلا شيءَ منه في هذه الشجرة، ولا سطرَ له في جدول
«ما استُورد» أعلاه.**

وثُبِّت بطريقته الصحيحة في 2026-09-03 بأمرِ صاحبِ الطلب:

```
claude plugin marketplace add thedotmack/claude-mem
claude plugin install claude-mem@thedotmack
```

**ونطاقُه `user` لا `project`:** مُسجَّلٌ في `~/.claude/settings.json`
(`extraKnownMarketplaces` و`enabledPlugins`)، لا في المستودع. فلا يُفرَض على
من يستنسخ المستودع، ولا يراه مراجعٌ في طلب دمج — وهو المقصود: تثبيتُه قرارُ
كلِّ جهازٍ على حدة.

**وما يجلبه فعلا** (من `claude plugin details`): تسعَ عشرةَ مهارة، وستةَ
خُطّافات — ومنها `PreToolUse` و`PostToolUse` و`Stop`، أي أنّه يقرأ سجلَّ
الجلسة كلَّه — وخادمَ MCP واحدا (`mcp-search`)، وكُلفةً دائمةً نحوَ
١٧٥٥ رمزا **تُضاف إلى كلِّ جلسة**. وقاعدةُ SQLite تُنشأ عند أوّلِ جلسةٍ
لاحقةٍ بخُطّافِ `Setup`؛ ولم تكن موجودةً بعدَ التثبيت مباشرةً.

**وتنبيهانِ يلزمان:**

1. **في الجلسات البعيدة يموت التثبيتُ مع الحاوية.** `~/.claude/` داخلَ
   حاويةٍ تُستعاد بعد سكون، فالإضافةُ تُثبَّت من جديدٍ في كلِّ جلسةٍ بعيدة.
   والدائمُ إنّما يكون على جهاز المستخدم نفسِه، أو بتصريحٍ في
   `.claude/settings.json` مُلتزَمٍ في المستودع — وذاك يفرضه على كلِّ من
   يستنسخ، فلم يُفعَل بلا طلب.
2. **المزامنةُ السحابيّةُ مغلقةٌ ما لم يُوصَل حسابُ cmem.ai** بمهارة
   `cloud-sync`. فالبياناتُ إلى الآن محليّةٌ في `~/.claude-mem/` وحدَها.

وفيه مهارةُ `babysit` — تُشابه في اسمها ما تشير إليه قواعدُ متابعةِ طلبات
الدمج (`.claude/skills/babysit/SKILL.md`)، وهي **ليست** إيّاها: تلك مسارٌ في
المستودع، وهذه مهارةُ إضافةٍ باسمها. فلا تُقرأ إحداهما مكانَ الأخرى.

### استثناءٌ مُعلَن على قاعدة المراجعة — حِزَمُ `impeccable` المُصغَّرة

القاعدةُ أدناه تقول: تُقرأ المهارةُ كاملةً قبل إدخالها. و`impeccable` ١٦٣ ملفا
و٥ ميغابايت، منها نحوُ ٩٠٠ كيلوبايت جافاسكربت مُصغَّرةٌ للمتصفِّح
(`live-browser.js` و`detect-antipatterns-browser.js` و`detector/browser/injected/`)
ومليونٌ فهرسُ خطوطٍ JSON. **وهذه لم تُقرأ، ولا يمكن أن تُقرأ قراءةً مفيدة.**
فالمُقروءُ فعلا: `SKILL.md` و٤٥ ملفَّ `reference/` وسكربتاتُ المدخل
(`context.mjs` و`doctor.mjs`) وجَرْدُ ما تستورده الحِزَمُ كلُّها وما تصل إليه
من الشبكة. وهذا استثناءٌ اختاره صاحبُ الطلب صراحةً بعد عرضِ البديلين عليه
(الوثائقُ وحدَها بلا سكربتات، أو التثبيتُ إضافةً لا نسخا) — ويُسجَّل هنا
استثناءً مُعلَنا لا سابقةً تُقاس عليها.

## قاعدة المراجعة

كلُّ مهارةٍ تُضاف هنا تُقرأ كاملة قبل إدخالها، وتُلتزَم في التزام مستقل عن عمل
المنتج — كي يراها المراجع وحدها. وإن أمرت مهارةٌ بما يخالف قواعد هذا المستودع
(القياس قبل التغيير، البوابات السبع، لا دفع إلى فرع غير الفرع المعتمد، لا أسماء
تُعرض كحقيقة قبل توثيقها) فقواعد المستودع هي التي تُتّبع، ويُقال ذلك صراحة.
