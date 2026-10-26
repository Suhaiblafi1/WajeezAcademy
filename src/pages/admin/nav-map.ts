/* خريطةُ لوحة الإدارة — بياناتٌ لا مكوّن.
 *
 * وهي في ملفٍّ وحدَها لسببَين: يقرؤها الإطارُ ودليلُ «كلّ الشاشات» معا،
 * و`react-refresh` يمنع تصديرَ ما ليس مكوّنا من ملفّ مكوّن — فتصديرُها من
 * `AdminLayout.tsx` يكسر التحديثَ الساخن.
 */

import { Activity, Award, BadgePercent, Gift, BarChart3, Bell, BookPlus, CalendarCog, CalendarRange, ClipboardCheck, ClipboardList, Coins, FileSignature, FlaskConical, GitBranch, GraduationCap, Handshake, HandCoins, History, Inbox, Languages, Layers, LayoutDashboard, LifeBuoy, Megaphone, PenLine, PlugZap, Presentation, Route, School, Settings, ShieldAlert, Star, UserCheck, UserMinus, UserPlus, Users, Wallet } from "lucide-react";

/* ═══ سبعةُ أقسامٍ في الشريط، وصفحاتُ كلِّ قسمٍ ألسنةٌ في أعلاه (٢٤ أكتوبر ٢٠٢٦) ═══

   كانت تسعَ مجموعاتٍ وخمسا وثلاثين شاشةً في الشريط الجانبيّ، والمجموعةُ بين اثنتين وخمس.
   فقال صاحبُ المنصّة: القائمةُ اليمنى طويلةٌ مشتّتة، ويريد «خطّا أفقيّا في الأعلى للتنقّل بين
   صفحات القسم نفسِه». فعُرضت عليه المرحلةُ الثانيةُ من المقترح — سبعةُ أقسام: «اليوم ·
   المدربون · الشعب · الدورات · المستشارون · المال · الإدارة» — وقال «اختر أنت» فاخترناها أوّلا.

   ── وما يتغيّر وما لا يتغيّر ──

   · **الأقسامُ** هي ما تديره: في الشريط سبعةٌ لا خمسٌ وثلاثون. و**الألسنةُ** صفحاتُ القسم في
     أعلى المحتوى (`PortalTabs`، الشريطُ نفسُه في بوّابات المدرّب والمستشار والمتعلّم).
   · **كلُّ شاشةٍ باقيةٌ بعنوانها**: لا مسارَ تغيّر، فلا رابطَ قديمٌ يسقط — في رسالةٍ ولا في
     إشعار. والدمجُ الذي في المقترح (الانضمامُ، والظهورُ، والنظامُ) مراحلُ بعدها.
   · لكلّ شاشةٍ اسمان: `label` اسمُها الكامل في الدليل والبحث، و`tab` اسمُها القصيرُ في
     اللسان — فالقسمُ يقول نصفَ الاسم ولا يُكرَّر: «المدربون › العقود» لا «المدربون › عقود المدربين».
   · **والصلاحيةُ لا تنقل شاشةً من قسمها** كما كانت: `need` باقٍ حرفا بحرف، والترشيحُ في
     `sectionsFor` يخفي ما لا يملكه الداخل، والقسمُ الفارغُ يختفي باسمه. فحسابُ الماليّة يرى تحت
     «المدربون» العقودَ والأتعابَ وحدَهما — والأتعابُ هناك بقرار ١٦ سبتمبر: «كل شيء يخص المدربين
     في خانة معينة».

   ── وحدّا القسم ──

   بين لسانين وتسعة (`admin-nav.test.ts`). تسعةٌ للمدربين اليومَ لأنّ كلَّ شاشةٍ باقية، وتنزل
   حين تُدمج الطلباتُ والعقود («الانضمام»)، والمساراتُ والتسويق («الظهور»)، ويصير الرحيلُ زرّا
   في ملفّ المدرّب. والحدُّ ينزل معها ولا يرتفع ليمرّ. */

export interface AdminNavItem {
  to: string;
  /** اسمُ الشاشة الكامل — في دليل «كلّ الشاشات» وفي البحث */
  label: string;
  /** اسمُها في لسان القسم — قصيرٌ لأنّ القسمَ يقول ما قبله */
  tab: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  need?: string | string[];
  open?: true;
  /** صفحاتُ تفصيلٍ تحت هذا اللسان — يبقى مضاءً فيها (بادئةُ مسار) */
  match?: string[];
  /** لسانٌ يعدّ ما ينتظرك كلَّه — وقسمُه يعدّ عددَه لا مجموعَ ألسنته */
  all?: true;
  /** شارةُ عددٍ تُعرَض إلى جانب الاسم — ومفتاحُها يقول أيَّ عددٍ تقرأ.

      ولمَ مفتاحٌ لا رقم: الخريطةُ ثابتةٌ تُقرأ مرّةً، والعددُ يتغيّر مع
      كلّ توقيع. فالخريطةُ تقول **أين** تُعرض الشارة، والإطارُ يجلب **كم**. */
  badge?: 'awaitingCountersign' | 'awaitingPlans';
  /** سطرٌ يقول ما تفعله الشاشة — يقرؤه دليلُ «كلّ الشاشات» في الرئيسية.
      وهو لازمٌ لا زينة: العنوانُ وحدَه لا يفرّق بين «طلبات المتعلّمين»
      و«الطلبة المسجَّلون»، ومن لا يفرّق يفتح الاثنتين ليعرف. */
  descAr: string;
}

export interface AdminNavSection {
  title: string;
  icon: typeof LayoutDashboard;
  items: AdminNavItem[];
}

export const allSections: AdminNavSection[] = [
  /* «اليوم» — ما ينتظرك ومهامّك: الشاشتان المفتوحتان بلا صلاحية (كانتا «ابدأ من هنا») */
  {
    title: "اليوم",
    icon: Inbox,
    items: [
      { to: "/admin", label: "الرئيسية", tab: "ينتظرك", icon: LayoutDashboard, end: true, open: true, all: true,
        descAr: "ما ينتظر قرارَك اليوم، وأرقامُ المنصّة الحيّة، ودليلُ الشاشات" },
      /* `open` لا غيابَ شرط: التبويب الذي لا يعرض إلّا ما يخصّ صاحبَه
         يُعلن ذلك صراحةً فيُقرأ ويُحصى، ولا يمرّ سهوا.

         و«مهامّي» منه: كلُّ من جاز حارسَ اللوحة قد يُكلَّف — ولو حُرس
         التبويب بصلاحية التكليف لما رأى المكلَّفُ تكليفَه. وأقسامُ
         التكليف داخل الصفحة محروسةٌ بـ`staff.task.assign` وحدها. */
      { to: "/admin/tasks", label: "المهامّ والتكليفات", tab: "مهامي", icon: ClipboardList, open: true,
        descAr: "ما كُلِّفتَ به، ومن كلّفك، وما كلّفتَ به غيرَك" },
    ],
  },
  /* ═══ «المدربون» — الانضمامُ ثمّ العملُ في قسمٍ واحد ═══

     كانا مجموعتين: «الانضمامُ والتعاقد» لمن يدخل (الطلبُ ثمّ العقدُ ثمّ الأجر)، و«التشغيل» لمن دخل
     (يُسنَد ويُعرض ويرحل) — وانقسما لأنّ سقفَ المجموعة في الشريط كان خمسا. وصار القسمُ ألسنةً في
     أعلاه فعادا قسما، والألسنةُ بترتيب خطّ المدرّب: يدخل، ثمّ يعمل، ثمّ يُعرض، ثمّ يرحل. */
  {
    title: "المدربون",
    icon: Presentation,
    items: [
      { to: "/admin/trainers", label: "طلبات المدربين", tab: "الطلبات", icon: UserPlus, need: "trainer.applications.view",
        descAr: "طابورُ الانضمام: الملفّ والمقابلةُ والتأهيلُ ثمّ القبول" },
      /* ص-١: العقدُ بيدِ من يقرّر لا بيدِ من يدفع — `trainer.contract.manage`
         عند المدير الأكاديميّ، و`trainer.compensation.manage` تبقى للماليّة. */
      { to: "/admin/trainer-contracts", label: "العقود", tab: "العقود", icon: FileSignature, need: "trainer.contract.manage",
        badge: "awaitingCountersign",
        descAr: "وثيقةٌ تُركَّب من أجره ودوراته المؤهَّل لها، وتُجمَّد ثمّ تُوقَّع" },
      /* من صار مدرّبا: طلباتُ التأهيل · الدوراتُ قيد الإعداد · ملفُّه العامّ · الإيقاف. وكانت لسانا في
         «طلبات المدربين»، وبابُ تلك `trainer.applications.view` وهذه `trainer.qualify` — فيراها من لا
         يملكها ويُردّ عند تحميلها (٢١ سبتمبر ٢٠٢٦). ثمّ ضُمّت إليها «إسنادٌ من المدرّب» وسُمّيتا «المدربون»
         (١٨ أكتوبر ٢٠٢٦) — والإسنادُ من صفحة الشعبة؛ والقولُ في رأس `TrainerRunOps.tsx`. */
      { to: "/admin/trainer-run", label: "المدربون", tab: "المدربون", icon: GraduationCap, need: "trainer.qualify",
        descAr: "طلبات التأهيل، ودورات قيد الإعداد، وملف كل مدرب العام، والإيقاف" },
      /* ═══ وخططُ الشعب بعد العقد — تسلسلُ اليوم نفسُه (٣ أكتوبر ٢٠٢٦) ═══

         مدرّبُ الإعداد يعبّئ شعبَ دوراته ويرسلها، واعتمادُ آخرها يفعّله ويختم
         عقدَه. وكانت تُعتمَد من بطاقة كلّ شعبةٍ وحدَها، ولا موضعَ يقول كم ينتظر.
         وصلاحيّتُها صلاحيّةُ الاعتماد نفسِه (`cohort.plan.approve`) — وفيها خططُ
         المدرّبين النشطين لشعبهم كذلك، فلا تُخفى عن معتمِدٍ خطّةٌ لأنّها ليست
         خطّةَ إعداد. ومنهاجُ الشعبة في صفحته يُفتح منها (`/admin/plans/:cohortId`).
         ولسانُها «الخطط» لا «اعتماد الدورات» الذي في المقترح: قِيس فكان أعرضَ لسانٍ في القسم، وبه لا تسع
         الألسنةُ التسعةُ الحاسوبَ — والصفحةُ تعتمد خططَ الشعب لا الدورات. */
      { to: "/admin/pending-plans", label: "خططٌ تنتظر اعتمادك", tab: "الخطط", icon: ClipboardCheck, need: "cohort.plan.approve",
        badge: "awaitingPlans", match: ["/admin/plans/"],
        descAr: "خططُ الشعب التي أرسلها مدرّبوها — تُقرأ كاملةً وتُعتمَد أو تُردّ بملاحظات، من المدرّبين كلِّهم" },
      /* ═══ ولماذا الأتعابُ هنا لا في «المال» ═══

         كانت في «التشغيل والمالية» لأنّ صلاحيّتَها `trainer.compensation.manage`
         ماليّة، فرسم الحارسُ التصنيفَ. والصلاحيةُ لم تتغيّر حرفا — ترشيحُ القائمة
         يخفيها عمّن لا يملكها كما كان. الذي تغيّر أنّ من يسأل «أين أمورُ
         المدرّبين؟» يجدها كلَّها في موضعٍ واحد (١٦ سبتمبر ٢٠٢٦). */
      { to: "/admin/trainer-compensation", label: "أتعاب المدربين", tab: "الأتعاب", icon: HandCoins, need: "trainer.compensation.manage",
        descAr: "قاعدةُ الأتعاب وكشوفُ المستحقّات — وبلا قاعدةٍ لا كشفَ يُولَّد" },
      /* ن-١: وصلاحيّتُه `trainer.publish` — «الموافقة على ظهور المدرب للعامة»،
         وهذا إدراجٌ عامٌّ يحمل اسمَه. */
      { to: "/admin/trainer-paths", label: "مساراتُ المدرّبين", tab: "المسارات", icon: Route, need: "trainer.publish",
        descAr: "ما يُعرض على الرفّ باسم مدرّب — يُراجَع قبل أن يراه أحد" },
      /* التسويق (٢٩ سبتمبر ٢٠٢٦): وصلاحيّتُه `trainer.publish` — الملصقُ ظهورُ
         المدرّب للعامّة بعينه، ولا يُستعمل إلّا بموافقته. */
      { to: "/admin/trainer-marketing", label: "تسويقُ المدرّبين", tab: "التسويق", icon: Megaphone, need: "trainer.publish",
        descAr: "فيديوهاتُهم وصورُهم، وملصقاتٌ تُصمَّم لهم ويوافقون عليها" },
      /* ═══ وإعلاناتٌ للمدرّبين (٤ أكتوبر ٢٠٢٦) ═══

         نصيحةُ موعد البدء وُلدت من خطط الإعداد، ومن يعتمدها يرى من قرأها. وصلاحيّتُها
         `staff.notify` — «من يبثّ الإعلانات» — لا حبّةٌ جديدة. */
      { to: "/admin/trainer-announcements", label: "إعلاناتٌ للمدرّبين", tab: "الإعلانات", icon: Megaphone, need: "staff.notify",
        descAr: "إعلانٌ يظهر نافذةً في بوّابة كلِّ مدرّبٍ حتّى يضغط «قرأتُه» — ومن قرأه ومن لم يقرأ" },
      /* ن-٩: رحيلُ مدرّب — وصلاحيّتُه `trainer.assign`، فالبديلُ إسنادٌ
         والنقلُ إسناد، وهما عملُ هذا الباب لا عملُ الماليّة. */
      { to: "/admin/trainer-departures", label: "رحيلُ مدرّب", tab: "الرحيل", icon: UserMinus, need: "trainer.assign",
        descAr: "بديلٌ ثمّ نظيرٌ ثمّ اختيارُ صاحبه — فلا شعبةَ تبقى بلا مدرّب" },
    ],
  },
  {
    title: "الشعب",
    icon: School,
    items: [
      /* «تشغيل الشعب» (١٨ أكتوبر ٢٠٢٦): سأل صاحبُ المنصّة «وصفحة الشعب ما فائدتها إن كان بإمكاني أن أفتح
         الشعب فورا من الصفحات الأخرى؟». فالفتحُ صار من «خطط تنتظر اعتمادك» (`TrainerNextSteps`)، وهذه
         موضعُ ما بعده وحدَها: اللقاءاتُ وروابطُها، والمتعلّمون والموادّ والمهامّ، والشهادات، وإنهاءُ
         الشعبة الذي تُولد منه المستحقّات، وإلغاؤها، وطلباتُ النقل. فسُمّيت بما تفعل، ولم يسقط منها شيء. */
      { to: "/admin/cohorts", label: "تشغيل الشعب", tab: "الشعب", icon: CalendarCog, need: "cohort.manage",
        descAr: "متابعة كل شعبة: الحضور والتسليمات ورسائل المدرب، والمال، وما يبدأ قريبا، وإنهاؤها أو إلغاؤها" },
      /* ومواعيدُ الفصل بلا تعارض لفصلٍ بعينه تُفتح من بطاقته (`/admin/terms/:id/clashes`) — تحت لسانه */
      { to: "/admin/terms", label: "المواسم والتقويم", tab: "التقويم", icon: CalendarRange, need: "cohort.manage",
        descAr: "مواسمُ السنة وخطّةُ ما يُفتح فيها — وتزاحمُ الدورات" },
      /* الطلبةُ المسجَّلون — نطاقُ كلِّ دورٍ يُشتقّ في الخادم، واللوحُ نفسُه
         يُركَّب في بوابتَي المدرّب والمستشار. */
      { to: "/admin/learners", label: "الطلبة المسجَّلون", tab: "الطلبة", icon: GraduationCap, need: "enrollment.manage",
        descAr: "من سجّل في ماذا، وأين وصل، ونقلُه بين الشعب" },
      /* طابورُ شهاداتِ المتعلّمين وتوصياتِهم — كان الإصدارُ لا يُطلب أصلا،
         فمن أنهى دورتَه في شعبةٍ لا أحدَ يفتحها بقي بلا شهادة. */
      { to: "/admin/learner-requests", label: "طلبات المتعلّمين", tab: "الشهادات", icon: Award, need: "certificate.issue",
        descAr: "طابورُ الشهادات والتوصيات لمن أنهى واستوفى قواعدَ الإكمال" },
      { to: "/admin/ratings", label: "مراجعة التقييمات", tab: "التقييمات", icon: Star, need: "rating.moderate",
        descAr: "ما كتبه المتعلّمون عن دوراتهم ومدرّبيهم قبل أن يُعرض" },
    ],
  },
  /* ═══ «الدورات» — الكتالوجُ ومحتواه، والتشخيصُ معه ═══

     كان التشخيصُ مجموعةً وحدَه (٨ أكتوبر ٢٠٢٦) لأنّ سقفَ المجموعة خمس. وسؤالُه — **كيف نعرف أين
     يقف المتعلّم؟** — سؤالٌ عن الدورات التي يُرشَّح لها، فصار لسانين في قسمها. و«دوراتٌ مقترحة»
     هنا حتّى يُقضى في اقتراح المدرّب من ملفّه (المرحلةُ الرابعة)، فلا تنتقل مرّتين. */
  {
    title: "الدورات",
    icon: Layers,
    items: [
      { to: "/admin/catalog", label: "الكتالوج", tab: "الكتالوج", icon: Layers, need: "catalog.view",
        descAr: "المسارات والدورات والمهارات والأسئلة — وإنشاءُ الجديد منها" },
      { to: "/admin/authoring", label: "تأليف المتون", tab: "المحتوى", icon: PenLine, need: "catalog.course.edit",
        descAr: "محتوى كلّ وحدة: الدرسُ وتمرينُ الاسترجاع والفيديو والسيناريو" },
      { to: "/admin/publishing", label: "النشر والإصدارات", tab: "النشر", icon: GitBranch, need: "catalog.impact.view",
        descAr: "سيرُ الاعتماد من مسودّة إلى منشور، وأثرُ كلّ نشرةٍ قبل وقوعها" },
      /* ح-٤: طابورُ الدورات المقترحة — وصلاحيّتُه `trainer.change.review`،
         هي بنصّها «مراجعة اقتراحات تعديل الدورات من المدربين»، وهذا منها. */
      { to: "/admin/course-proposals", label: "دوراتٌ مقترحة", tab: "المقترحة", icon: BookPlus, need: "trainer.change.review",
        descAr: "ما اقترحه المدرّبون من دورات — يُصنَّف قبل أن يدخل الكتالوج" },
      { to: "/admin/quality", label: "جودة التشخيص", tab: "التشخيص", icon: FlaskConical, need: "diagnostic.simulate",
        descAr: "محاكاةُ المحرّك التشخيصيّ: أيُّ مسارٍ يُرشَّح لأيّ حال، ولمَ" },
      { to: "/admin/placement-review", label: "اختبار تحديد المستوى", tab: "تحديد المستوى", icon: Languages, need: "placement.review",
        descAr: "أسئلةُ اختبار الإنجليزيّة وفحوصِ المهارة في المجالات: تُعدَّل وتُعتمَد أو تُسقَط" },
    ],
  },
  {
    title: "المستشارون",
    icon: Handshake,
    items: [
      { to: "/admin/advisors", label: "المستشارون والعمولة", tab: "المستشارون", icon: UserCheck, need: "advisor.manage",
        descAr: "من يستشير من، وقاعدةُ العمولة، وما استُحقّ منها" },
      { to: "/admin/advisor-requests", label: "طلبات المستشارين", tab: "الطلبات", icon: BadgePercent, need: "advisor.request.review",
        descAr: "خصمٌ يطلبه مستشارٌ لعميله أو تعديلٌ على خطّته — بسببه كاملا" },
      /* «الاستثناءات» كان اسما لا يدلّ على شيء، وحارسا لا يحرس ما وراءه:
         التبويبُ مشروطٌ بـ`enrollment.request.review` والشاشةُ تقرأ
         `/api/admin/advisor-cases/unassigned` المحروسَ بـ`advisor.assign`.
         فمن مُنح مراجعةَ طلبات التسجيل يرى بابا يفتحه فيُردّ عند الخادم،
         **وطابورُه هو في شاشةٍ أخرى لا يراها أصلا**. والاسمُ الآن يقول
         محتواه، والحارسُ هو حارسُ مساره. */
      { to: "/admin/exceptions", label: "حالات بلا مستشار", tab: "بلا مستشار", icon: ShieldAlert, need: "advisor.assign",
        descAr: "حالةٌ وصلت ولا مستشارَ عليها — تُسنَد قبل أن تبرد" },
      { to: "/admin/advisor-payouts", label: "كشوف عمولة المستشارين", tab: "العمولات", icon: HandCoins, need: "advisor.payout.manage",
        descAr: "كشفُ كلّ شهرٍ ببنوده: يُعتمد ثمّ يُصرف — والاستردادُ يُحسم في التالي" },
    ],
  },
  /* «المال» — ما يدفعه المتعلّمون وما نعرضه من أرقام. وأتعابُ المدرّبين وعمولاتُ المستشارين مع
     أصحابها، بقرار ١٦ سبتمبر ٢٠٢٦. */
  {
    title: "المال",
    icon: Coins,
    items: [
      { to: "/admin/finance", label: "الطلبات والفواتير", tab: "التسجيل والفواتير", icon: Wallet, need: ["finance.view", "enrollment.request.review"],
        descAr: "طابورُ طلبات التسجيل، والفواتيرُ والاستردادات" },
      /* «منحة وجيز» (٢٠ أكتوبر ٢٠٢٦، وكانت «منحة أعضاء وجيز»): نسبتُها بيد صاحب المنصّة يغيّرها متى شاء، وفحصُ الهامش
         تحتها — بصلاحيّة الكوبونات، فالمنحةُ كوبونٌ بحملة. */
      { to: "/admin/member-grant", label: "منحة وجيز", tab: "المنحة", icon: Gift, need: "commerce.manage",
        descAr: "نسبة المنحة وعددها وآخر يوم لها، وهامش كل شعبة بعدها" },
      /* «منحة مؤثرين وجيز» (٢٦ أكتوبر ٢٠٢٦): إعداداتُها، والمؤثّرون بأكوادهم وعمولاتهم وما دُفع لهم */
      { to: "/admin/influencer-grant", label: "منحة مؤثرين وجيز", tab: "منحة المؤثرين", icon: Megaphone, need: "commerce.manage",
        descAr: "نسبة منحة المؤثرين، والمؤثرون بأكوادهم وعمولاتهم وما دفع لهم" },
      { to: "/admin/reports", label: "التقارير والتصدير", tab: "التقارير", icon: BarChart3, need: "reports.view",
        descAr: "أرقامُ المنصّة مفصَّلةً، وتصديرُها إلى ملفّ" },
    ],
  },
  /* «الإدارة» — من يدخل ومن يُبلَّغ ومن فعل ماذا، وحالُ النظام وتكاملاتُه. والدعمُ والإشعاراتُ
     هنا لأنّهما يخدمان المنصّةَ كلَّها لا قسما واحدا. */
  {
    title: "الإدارة",
    icon: Settings,
    items: [
      { to: "/admin/support", label: "تذاكر الدعم", tab: "الدعم", icon: LifeBuoy, need: "support.operate",
        descAr: "ما يشتكي منه المستخدمون — ومن يردّ عليه ومتى" },
      { to: "/admin/notifications", label: "الإشعارات", tab: "الإشعارات", icon: Bell, need: "notifications.manage",
        descAr: "ما تُرسله المنصّة تلقائيّا: نصُّه ووقتُه ومن يبلغه" },
      { to: "/admin/users", label: "المستخدمون والأدوار", tab: "المستخدمون", icon: Users, need: "admin.users.view",
        descAr: "الحسابات وأدوارُها، ومنحُ صلاحيةٍ بعينها أو منعُها" },
      { to: "/admin/audit", label: "سجلّ الأثر", tab: "السجل", icon: History, need: "audit.view",
        descAr: "من فعل ماذا ومتى — وما كان قبلَه وما صار بعدَه" },
      /* «هل النظامُ سليم؟» — بصلاحيّةِ الإعدادات: بنودُها تكشف حالةَ
         مزوّد الدفع والبريد وأرقامَ محاولاتِ الدخول الفاشلة. */
      { to: "/admin/system-health", label: "صحّة النظام", tab: "صحة النظام", icon: Activity, need: "settings.manage",
        descAr: "حالةُ مزوّد الدفع والبريد، ومحاولاتُ الدخول الفاشلة" },
      { to: "/admin/integrations", label: "التكاملات — الدفع والبريد", tab: "التكاملات", icon: PlugZap, need: "settings.manage",
        descAr: "ربطُ بوّابة الدفع والبريد وZoom وCalendly — واختبارُ كلٍّ منها" },
    ],
  },
];

/* ═══ مصدرٌ واحدٌ للإطار وللدليل ═══

   «كلّ الشاشات» في الرئيسية يعرض الأقسامَ نفسَها التي يعرضها الإطار.
   ولو رشّح كلٌّ منهما بنسخته لَافترقا عند أوّل تعديل — فيقول الدليلُ إنّ
   شاشةً متاحةٌ ولا يجد صاحبُها بابَها في القائمة. فالترشيحُ هنا مرّةً واحدة.

   `need` واحدةٌ أو عدّة — و«عدّة» تعني **أيًّا منها**، لا كلَّها. شاشةٌ تخدم
   صلاحيتين لا تُحرَس بواحدةٍ منهما: «الطلبات والفواتير» تحمل طابورَ طلبات
   التسجيل والفواتيرَ معا، وكانت تُحرَس بـ`finance.view` وحدها — فمن مُنح
   مراجعةَ طلبات التسجيل لا يرى طابورَه أصلا.

   والمفتوحُ (`open`) يمرّ بلا صلاحية: «الرئيسية» ليقف عليها من جاز حارسَ
   المسار، و«المهامّ» لأنّها لا تعرض إلّا ما يخصّ صاحبَها. */
export function sectionsFor(permissions: readonly string[] | undefined): AdminNavSection[] {
  const canAny = (need?: string | string[]) =>
    !need || (Array.isArray(need) ? need : [need]).some((k) => permissions?.includes(k) ?? false);
  return allSections
    .map((sec) => ({ ...sec, items: sec.items.filter((it) => canAny(it.need)) }))
    .filter((sec) => sec.items.length > 0);
}

/* ═══ أين أنا؟ — القسمُ واللسانُ من المسار ═══

   المسارُ نفسُه أو صفحةٌ تحته (`/admin/terms/…/clashes` تحت «التقويم»)، أو بادئةٌ معلنة
   (`match`) لصفحة تفصيلٍ مسارُها من غير أهله (`/admin/plans/…` تحت «الخطط»).
   و«الرئيسية» (`end`) بالمطابقة التامّة وحدَها — وإلّا أضاءت في كلّ صفحة. وما لا مكانَ له
   (`/admin/account` من قائمة الحساب) لا يضيء شيئا، ولا تُعرض له ألسنة. */
export function placeOf(
  pathname: string,
  sections: readonly AdminNavSection[],
): { section: AdminNavSection; item: AdminNavItem } | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  let best: { section: AdminNavSection; item: AdminNavItem; len: number } | null = null;
  for (const section of sections) {
    for (const item of section.items) {
      const hits = [
        path === item.to ? item.to.length + 1 : 0,
        !item.end && path.startsWith(`${item.to}/`) ? item.to.length : 0,
        ...(item.match ?? []).map((m) => (path.startsWith(m) ? m.length : 0)),
      ];
      const len = Math.max(...hits);
      if (len > 0 && (!best || len > best.len)) best = { section, item, len };
    }
  }
  return best && { section: best.section, item: best.item };
}

/* ═══ ما ينتظرك — في كلّ لسانٍ وكلّ قسم ═══

   مصدران لا ثالثَ لهما: شارةُ اللسان إن كانت له (`badge` — «العقود» و«الخطط»، عدٌّ
   دقيقٌ يُجلَب لهما وحدهما)، وإلّا بنودُ «ما ينتظرك» (`/api/staff/inbox`) التي يقود رابطُها
   إليه. فلا يُعدّ شيءٌ مرّتين: بندُ الخطط في «ما ينتظرك» لا يُضاف إلى شارة الخطط.

   والقسمُ مجموعُ ألسنته، إلّا قسما فيه لسانٌ يعدّ كلَّ شيء (`all` — «ينتظرك»): عددُه عددُ ذاك
   اللسان، وإلّا عُدّت «مهامّي» مرّتين. وما لا يرى صاحبُ الجلسة لسانَه لا يُعدّ له. */
export interface WaitingInput {
  /** شاراتُ الألسنة كما جُلبت — والغائبُ صفر */
  badges: Partial<Record<NonNullable<AdminNavItem["badge"]>, number>>;
  /** بنودُ «ما ينتظرك» — رابطُها وعددُها */
  inbox: readonly { href: string; count: number }[];
}

export function waitingCounts(sections: readonly AdminNavSection[], input: WaitingInput) {
  const byTab: Record<string, number> = {};
  for (const sec of sections) for (const it of sec.items) byTab[it.to] = it.badge ? input.badges[it.badge] ?? 0 : 0;
  for (const entry of input.inbox) {
    const place = placeOf(entry.href.split(/[?#]/)[0], sections);
    if (place && !place.item.badge && !place.item.all) byTab[place.item.to] += entry.count;
  }
  const total = Object.values(byTab).reduce((n, c) => n + c, 0);
  const bySection: Record<string, number> = {};
  for (const sec of sections) {
    const whole = sec.items.find((it) => it.all);
    if (whole) byTab[whole.to] = total;
    bySection[sec.title] = whole ? total : sec.items.reduce((n, it) => n + byTab[it.to], 0);
  }
  return { byTab, bySection, total };
}
