# تدقيق منصّة أكاديمية وجيز وخطّة التنفيذ — سبتمبر ٢٠٢٦

> **الحالة: تدقيقٌ وخطّةٌ فقط. لم يُغيَّر أيّ سطرٍ من شيفرة المنصّة، ولم يُمَسّ الإنتاج، ولا تبدأ أيّ خطوةٍ كبرى قبل موافقة صاحب المنصّة.**
>
> Status: **audit and plan only. No platform code, infrastructure, or data was modified. No major step starts before the owner's approval.**

| الوثيقة | ما فيها |
|---|---|
| [01 · التدقيق الكامل](01-PLATFORM-AUDIT.md) | المشكلات الحرجة · التحسينات عالية القيمة · الميزات الناقصة · التعقيد غير الضروريّ · الدَّين التقنيّ · جولات الأدوار الستّة · مراجعة التجربة · سجلّ الأتمتة · خارطة الطريق أ/ب/ج |
| [02 · تصميم القدرات](02-CAPABILITIES-DESIGN.md) | المُشغِّل الخلفيّ · Calendly · Zoom · الفيديو المسجَّل · المسارات والدورات والشعب · إدارة المحتوى · المستخدمون والأدوار والدعوات · سجلّ الأثر |
| [03 · المعمارية المقترحة](03-ARCHITECTURE.md) | التطبيق · القاعدة · الاستضافة · التكاملات · الفيديو · الأمن · ما لن نبنيه |
| [04 · خطّة النقل](04-MIGRATION-PLAN.md) | الوضع الحاليّ (Vercel + Neon) · Hetzner + PostgreSQL · بيئة التجريب · خطوات النقل بمخاطرها · ما تُقدّمه أنت · ما يجهّزه المطوّرون · قائمة التحويل · خطّة الرجوع |
| [05 · جولةُ المتصفّح](05-BROWSER-TOUR-AR.md) | **ما شُوهد فعلا** بكلّ دورٍ من التسعة والزائر، بالصور: مصفوفةُ التغطية ([tour/COVERAGE-AR.md](tour/COVERAGE-AR.md)) · الأعطابُ المُشاهَدة · الرحلاتُ العشر · وما كان التقرير مخطئا فيه |

---

## الخلاصة التنفيذيّة (عربي)

**ما وجدناه.** المنصّة مبنيّةٌ بجودةٍ هندسيّةٍ أعلى من المعتاد: أنواعٌ من الطرف إلى الطرف، ٨٦١ اختبارَ واجهةٍ خضراء و٨٤ ملفَّ اختبارِ خادم، صلاحيّاتٌ دقيقةٌ بحدودِ تفويض، مسارُ اعتمادٍ للمحتوى (كاتبٌ ومراجع)، ومحرّكُ تشخيصٍ حتميٌّ بحواجزِ انحدار. **هذه شيفرةٌ تستحقّ الاستثمار لا الاستبدال.**

**لكنّها لا تستطيع اليوم أن تفعل ما تفعله الأكاديمية كلَّ يوم:** تُدير حصّةً برابطٍ حيّ، وتُذكّر الناس، وتُظهر التسجيل بعدها. رابطُ Zoom يُلصَق يدويّا، ولم يُرسَل تذكيرٌ واحدٌ قطّ (لا مُشغِّلَ خلفيّ)، ورفعُ التسجيلات والموادّ معطَّلٌ في الإنتاج، والبريدُ غيرُ موصول. وهذه إصلاحاتُ بنيةٍ تحتيّةٍ أكثرَ منها تصميمَ منتج.

**والإنتاجُ يعمل على شكلٍ يعاكس كلَّ إصلاحٍ منها:** دالّةٌ سحابيّةٌ واحدةٌ على Vercel (حزمةُ ١٣ ميغابايت مُلتزَمةٌ في Git) فوق قاعدة Neon. الإقلاعُ البارد هو سببُ بطءِ الدخول الذي شكوتَ منه. فالنقلُ إلى خادمٍ طويلِ التشغيل (الوثيقة ٠٤) شرطٌ للتذكيرات والرفع والتكاملات، لا رفاهية.

**خطرٌ واحدٌ يُصلَح هذا الأسبوع مهما كان القرار:** بناءاتُ المعاينة على Vercel تنفّذ ترحيلاتَ القاعدة على قاعدةِ **الإنتاج** (`scripts/vercel-build.sh`). فرعٌ لم يُدمَج بعدُ يستطيع تغييرَ مخطّط القاعدة الحيّة.

**وقائمةُ مهامّك التشغيليّةُ هي العائقُ الحقيقيّ:** SMTP غيرُ موصول، ومزوّدُ الدفع ربّما ما زال «اختباريّا» (نجاحٌ بلا مال — يُتحقّق منه اليوم)، و٧٧ دورةً بلا سعر، و٣٩٢ من ٤٠٤ وحدةٍ بلا متن. لا معماريّةَ تُصلح هذه؛ تحتاج قراراتَك وبضعَ ضغطاتٍ في `/admin/integrations` و`/admin/cohorts`.

**ما نختلف فيه مع الطلب:**
- «برامج ودورات وشُعَب» **موجودةٌ فعلا** باسم مسار → دورة → شعبة → جلسة. لا تُضَف جدولٌ جديد؛ يُوحَّد المصطلحُ وتُؤتمَت الخطوات.
- «تكاملُ تقويم Gmail» يُقرأ على أنّه OAuth كتابةٍ في التقويم — مكلفٌ وهشّ. مرفقُ ICS ورابطُ تقويمٍ مُشترَك (webcal) يعطيان النتيجةَ نفسَها بلا مراجعةِ Google.
- Zoom داخلَ صفحتنا (SDK) تجربةٌ أسوأ من تطبيق Zoom؛ يُبنى الفيديو المسجَّل داخلَ الصفحة، ويُفتَح البثُّ الحيّ في Zoom.
- Calendly صحيحٌ الآن، لكن خلفَ واجهةٍ قابلةٍ للتبديل، وبعد فحصِ صفحتِه العربيّة بمستخدمٍ حقيقيّ.
- سجلُّ الأثر **موجودٌ وجيّد**؛ العملُ في التغطية والاحتفاظ لا في التصميم.

**التوصية للبنية التحتيّة:** Hetzner + PostgreSQL مستضافٌ ذاتيّا — نعم. وليس نقلَ قاعدةٍ أصلا (المنصّةُ على PostgreSQL منذ البداية)؛ القيمةُ في شكلِ الخادم (مُشغِّل خلفيّ، رفعُ ملفّات، بيئةُ تجريب)، والخطرُ في الانضباطِ التشغيليّ (نسخٌ احتياطيّةٌ مُثبَتة، مراقبة، بيئةُ تجريب) — والوثيقةُ ٠٤ تحوّله إلى قوائمِ تحقّق. تصميمُ الخادم الواحد بـDocker وCaddy **موجودٌ في `deploy/` ولم يُستعمل بعد**؛ ما ينقصه: بيئةُ تجريب، وحاويةُ المُشغِّل، والمراقبة، وتمرينُ النقل، ونافذةُ تحويلٍ منضبطة (٣٠–٦٠ دقيقة، والجلساتُ لا تنقطع لأنّها صفوفٌ في القاعدة).

**ترتيبُ العمل المقترح**
1. هذا الأسبوع: إصلاحُ ترحيلاتِ المعاينة · ضبطُ `STORAGE_SECRET` · وصلُ البريد · التحقّقُ من مزوّد الدفع وجعلُ سقوطِه صريحا · حراسةُ مساراتِ الطالب · إغلاقُ `/docs` · تشغيلُ السجلّ وSentry.
2. ٣–٤ أسابيع: النقلُ إلى Hetzner مع بيئةِ تجريبٍ ومُشغِّلٍ خلفيّ ونسخٍ مُثبَتة (الوثيقة ٠٤) · تخزينُ الكائنات للموادّ · دعواتٌ تصلح سبعةَ أيّام · أرشفةٌ بدلَ الحذف.
3. ٦–٨ أسابيع: معالجُ الشعب وتوليدُ الجلسات · Zoom API والحضورُ والتذكيرات · منصّةُ فيديو ومسارُ اعتمادِ التسجيلات · بحثٌ بدلَ إدخالِ المعرّفات · دورُ «المنسّق الأكاديميّ».
4. لاحقا: Calendly للاستشارات والمقابلات · محرّرٌ مرئيّ للمتون · تسجيلُ الشركات.

**ما نحتاجه منك قبل النقل** مُفصَّلٌ في [الوثيقة ٠٤ §٦](04-MIGRATION-PLAN.md#6--what-i-need-from-you-owner--and-how-to-hand-it-over-safely): حسابُ Hetzner، صلاحيّةُ DNS، عضويّةُ Vercel وStripe، دورٌ للقراءة فقط على Neon، مزوّدُ بريد، حسابُ Zoom، وقراراتُ النطاقِ النهائيّ وموعدِ النافذة — **ولا سرٌّ يُرسَل في محادثة**؛ كلُّ قيمةٍ تُوضَع في خزنةٍ مشتركةٍ أو في شاشتها مباشرة.

---

## Executive summary (English)

**Verdict.** A well-engineered codebase (typed end to end, 861 green browser tests, 84 server test files, fine-grained RBAC with delegation limits, maker-checker content flow, deterministic diagnostic engine with regression gates) that cannot yet perform an academy's daily job: run a class with a live link, remind people, and publish the recording. Zoom is a pasted link, no reminder has ever been sent (no background worker), uploads are broken in production, email is disconnected. The Vercel-serverless-plus-Neon shape works against every one of those fixes and already causes the reported login slowness.

**Fix this week regardless:** preview deployments run migrations against the production database.

**Owner actions unblock more than any code:** connect SMTP, verify the payment driver is not still `test`, price the 77 unpriced courses, decide on content authoring.

**Where the brief is challenged:** the academic model already exists (Pathway → Course → Cohort → Session), do not add a Program table; calendar "integration" should be ICS + webcal, not Google OAuth; live Zoom should open the Zoom app, only recorded video plays in-page; Calendly yes, behind an interface, after an Arabic UX check; the audit log exists and is good.

**Infrastructure:** Hetzner + self-hosted PostgreSQL is right and is not a database migration (already PostgreSQL). The single-server Docker/Caddy design in `deploy/` is complete and unused; add staging, a worker, monitoring, a rehearsal and a 30–60 minute cutover window with a full rollback path (doc 04).

**Quality gates run on this branch:** types clean · 0 lint errors · 861/861 browser tests · 139/139 models migrated · API bundle in sync · build OK · `npm audit` 0 critical (highs are build tooling, mostly removed by dropping `@vercel/node`).

---

### How to read the documents
Start with **01 §1** (ten headline findings) and **01 §J** (roadmap). Then **04 §0** for the migration verdict and **04 §6/§7** for the two checklists. **02** is for the developers who will build the capabilities; **03** is the decision record they should keep updated.
