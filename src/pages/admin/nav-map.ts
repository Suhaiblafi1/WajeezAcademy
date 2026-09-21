/* خريطةُ لوحة الإدارة — بياناتٌ لا مكوّن.
 *
 * وهي في ملفٍّ وحدَها لسببَين: يقرؤها الشريطُ الجانبيُّ ودليلُ «كلّ
 * الشاشات» معا، و`react-refresh` يمنع تصديرَ ما ليس مكوّنا من ملفّ
 * مكوّن — فتصديرُها من `AdminLayout.tsx` يكسر التحديثَ الساخن.
 */

import { Activity, Award, BadgePercent, BarChart3, Bell, BookPlus, CalendarCog, CalendarRange, ClipboardList, Coins, FileSignature, FlaskConical, GitBranch, GraduationCap, Handshake, HandCoins, History, Layers, LayoutDashboard, LifeBuoy, PenLine, PlugZap, Presentation, Route, School, Settings, ShieldAlert, Star, UserCheck, UserMinus, UserPlus, Users, Wallet } from "lucide-react";

/* ═══ سبعُ مجموعاتٍ لا ثلاثةُ أبواب ═══

   كانت ثلاثةً بقرارِ صاحب المنصّة حين كانت الشاشاتُ سبعَ عشرة، وكان القرارُ
   صوابا يومَها: ستُّ عناوينَ لسبعَ عشرةَ شاشةً عناوينُ أكثرُ من أن تُقرأ.

   ثمّ صارت الشاشاتُ **ثمانيا وعشرين**، فانقلب الصوابُ عطبا: بابُ «الأكاديمية»
   وحدَه يحمل ثمانيَ عشرةَ منها — كتالوجا وتأليفا ونشرا وشعبا ومواسمَ وطلبةً
   وخمسَ شاشاتِ مدرّبين وثلاثَ شاشاتِ مستشارين وجودةَ تشخيصٍ وتقييمات. وذاك
   ليس تصنيفا بل درج.

   وأسوأُ منه أنّ شاشاتِ المدرّبين **مفرَّقةٌ على بابين**: خمسٌ في «الأكاديمية»
   و«أتعاب المدربين» في «الأمور الفنّية» — وُضعت هناك لأنّ صلاحيّتَها ماليّة،
   فصار **حارسُ الصلاحية يرسم التصنيف**. وهما شيئان مختلفان: الصلاحيةُ تقرّر
   من يرى، والتصنيفُ يقرّر أين يبحث. فمن يسأل «أين أمورُ المدرّبين؟» يجد
   نصفَها.

   وقالها صاحبُ المنصّة (١٦ سبتمبر ٢٠٢٦): «كل شيء يخص المدربين في خانة معينة،
   وكل شيء يخص الإدارة، وكل شيء يخص الدورات والكتالوج، وكل شيء في المستخدمين».
   فهذا نصُّ التصنيف.

   ── وقاعدتان تحكمان الجدول ──

   ١) **المجموعةُ بين ثلاثٍ وخمسِ شاشات.** أقلُّ من ثلاثٍ عنوانٌ لا يستحقّ
      عنوانا، وأكثرُ من خمسٍ أوّلُ درجٍ جديد. ويحرسه `admin-nav.test.ts`.
   ٢) **الصلاحيةُ لا تنقل شاشةً من مجموعتها.** `need` يبقى كما هو حرفا بحرف
      — الترشيحُ في `sections` أدناه يخفي ما لا يملكه الداخل، والمجموعةُ
      الفارغةُ تختفي بعنوانها. فحسابُ الماليّة يرى «أتعاب المدربين» وحدَها
      تحت «المدرّبون»، ولا يرى الأربعَ الأخريات.

   و«ابدأ من هنا» مجموعةٌ تفسّر نفسَها: هي الشاشتان المفتوحتان بلا صلاحية —
   نظرتُك ومهامُّك أنت. */

export interface AdminNavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  need?: string | string[];
  open?: true;
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
  {
    title: "ابدأ من هنا",
    icon: LayoutDashboard,
    items: [
      { to: "/admin", label: "الرئيسية", icon: LayoutDashboard, end: true, open: true,
        descAr: "ما ينتظر قرارَك اليوم، وأرقامُ المنصّة الحيّة، ودليلُ الشاشات" },
      /* `open` لا غيابَ شرط: التبويب الذي لا يعرض إلّا ما يخصّ صاحبَه
         يُعلن ذلك صراحةً فيُقرأ ويُحصى، ولا يمرّ سهوا.

         و«مهامّي» منه: كلُّ من جاز حارسَ اللوحة قد يُكلَّف — ولو حُرس
         التبويب بصلاحية التكليف لما رأى المكلَّفُ تكليفَه. وأقسامُ
         التكليف داخل الصفحة محروسةٌ بـ`staff.task.assign` وحدها. */
      { to: "/admin/tasks", label: "المهامّ والتكليفات", icon: ClipboardList, open: true,
        descAr: "ما كُلِّفتَ به، ومن كلّفك، وما كلّفتَ به غيرَك" },
    ],
  },
  {
    title: "الكتالوج والمحتوى",
    icon: Layers,
    items: [
      { to: "/admin/catalog", label: "الكتالوج", icon: Layers, need: "catalog.view",
        descAr: "المسارات والدورات والمهارات والأسئلة — وإنشاءُ الجديد منها" },
      { to: "/admin/authoring", label: "تأليف المتون", icon: PenLine, need: "catalog.course.edit",
        descAr: "متنُ كلّ وحدة: الدرسُ وتمرينُ الاسترجاع والفيديو والسيناريو" },
      { to: "/admin/publishing", label: "النشر والإصدارات", icon: GitBranch, need: "catalog.impact.view",
        descAr: "سيرُ الاعتماد من مسودّة إلى منشور، وأثرُ كلّ نشرةٍ قبل وقوعها" },
      /* ح-٤: طابورُ الدورات المقترحة — وصلاحيّتُه `trainer.change.review`،
         هي بنصّها «مراجعة اقتراحات تعديل الدورات من المدربين»، وهذا منها. */
      { to: "/admin/course-proposals", label: "دوراتٌ مقترحة", icon: BookPlus, need: "trainer.change.review",
        descAr: "ما اقترحه المدرّبون من دورات — يُصنَّف قبل أن يدخل الكتالوج" },
      { to: "/admin/quality", label: "جودة التشخيص", icon: FlaskConical, need: "diagnostic.simulate",
        descAr: "محاكاةُ المحرّك التشخيصيّ: أيُّ مسارٍ يُرشَّح لأيّ حال، ولمَ" },
    ],
  },
  /* ═══ ولماذا انقسم «المدرّبون» مجموعتين ═══

     كانت مجموعةً واحدةً بخمسة بنود — وهو سقفُ الحارس (`admin-nav.test.ts`
     يردُّ ما نقص عن اثنين وما زاد عن خمسة، كي لا تصير القائمةُ جدارا).
     وجاءت «العقود» سادسةً.

     ورفعُ السقف أسهلُ الأجوبة وأسوأُها: الحارسُ يقيس أنّ التصنيفَ ما زال
     يُقرأ بالعين، ومن يرفعه ليمرّ إنّما يُسكت المقياسَ لا يُصلح المقيس.

     فانقسمت على **معنى** لا على عدد: بابٌ لمن يدخل — الطلبُ ثمّ العقدُ ثمّ
     الأجر، وهو تسلسلُ يومٍ واحد؛ وبابٌ لمن دخل — يُسنَد ويُعرض ويرحل.

     والأتعابُ تبقى تحت «المدرّبين» كما قُرّر في ١٦ سبتمبر — لم تعد إلى
     «التشغيل والمالية»، وإنّما لزمت أختَها: متنُ العقد يحمل الأجرَ نفسَه. */
  {
    title: "المدرّبون — الانضمامُ والتعاقد",
    icon: Presentation,
    items: [
      { to: "/admin/trainers", label: "طلبات المدربين", icon: UserPlus, need: "trainer.applications.view",
        descAr: "طابورُ الانضمام: الملفّ والمقابلةُ والتأهيلُ ثمّ القبول" },
      /* ص-١: العقدُ بيدِ من يقرّر لا بيدِ من يدفع — `trainer.contract.manage`
         عند المدير الأكاديميّ، و`trainer.compensation.manage` تبقى للماليّة. */
      { to: "/admin/trainer-contracts", label: "العقود", icon: FileSignature, need: "trainer.contract.manage",
        descAr: "وثيقةٌ تُركَّب من أجره ودوراته المؤهَّل لها، وتُجمَّد ثمّ تُوقَّع" },
      /* ═══ ولماذا الأتعابُ هنا لا في «التشغيل والمالية» ═══

         كانت هناك لأنّ صلاحيّتَها `trainer.compensation.manage` ماليّة،
         فرسم الحارسُ التصنيفَ. والصلاحيةُ لم تتغيّر حرفا — ترشيحُ القائمة
         يخفيها عمّن لا يملكها كما كان. الذي تغيّر أنّ من يسأل «أين أمورُ
         المدرّبين؟» يجدها كلَّها في موضعٍ واحد. */
      { to: "/admin/trainer-compensation", label: "أتعاب المدربين", icon: HandCoins, need: "trainer.compensation.manage",
        descAr: "قاعدةُ الأتعاب وكشوفُ المستحقّات — وبلا قاعدةٍ لا كشفَ يُولَّد" },
    ],
  },
  {
    title: "المدرّبون — التشغيل",
    icon: UserCheck,
    items: [
      /* سلسلةُ التشغيل: البتُّ في طلبات التأهيل · التأهيلُ المباشر · الإسنادُ
         لشعبة · اعتمادُ الظهور العامّ · الإيقاف. وكانت لسانا في «طلبات
         المدربين»، وبابُ تلك `trainer.applications.view` وهذه `trainer.qualify`
         — فيراها من لا يملكها ويُردّ عند تحميلها (٢١ سبتمبر ٢٠٢٦). */
      { to: "/admin/trainer-run", label: "التأهيلُ والإسناد", icon: GraduationCap, need: "trainer.qualify",
        descAr: "من صار مدرّبا: يُؤهَّل لدورةٍ ويُسنَد لشعبةٍ ويُعتمَد ظهورُه" },
      /* ج-١: «أجد صعوبةً بالبحث عن الدورات» — بابٌ يبدأ من الإنسان. وصلاحيّتُه
         `trainer.assign`: هي ما يفعله، والتأهيلُ في مكانه محروسٌ بمساره. */
      { to: "/admin/assign-by-trainer", label: "إسنادٌ من المدرّب", icon: UserCheck, need: "trainer.assign",
        descAr: "تبدأ من المدرّب لا من الشعبة: ما يُتقنه، وأين يصلح أن يُسنَد" },
      /* ن-١: وصلاحيّتُه `trainer.publish` — «الموافقة على ظهور المدرب للعامة»،
         وهذا إدراجٌ عامٌّ يحمل اسمَه. */
      { to: "/admin/trainer-paths", label: "مساراتُ المدرّبين", icon: Route, need: "trainer.publish",
        descAr: "ما يُعرض على الرفّ باسم مدرّب — يُراجَع قبل أن يراه أحد" },
      /* ن-٩: رحيلُ مدرّب — وصلاحيّتُه `trainer.assign`، فالبديلُ إسنادٌ
         والنقلُ إسناد، وهما عملُ هذا الباب لا عملُ الماليّة. */
      { to: "/admin/trainer-departures", label: "رحيلُ مدرّب", icon: UserMinus, need: "trainer.assign",
        descAr: "بديلٌ ثمّ نظيرٌ ثمّ اختيارُ صاحبه — فلا شعبةَ تبقى بلا مدرّب" },
    ],
  },
  {
    title: "الشعب والمتعلّمون",
    icon: School,
    items: [
      { to: "/admin/cohorts", label: "الشعب", icon: CalendarCog, need: "cohort.manage",
        descAr: "فتحُ الشعبة وجدولتُها وإسنادُ مدرّبها وجاهزيّتُها للانطلاق" },
      { to: "/admin/terms", label: "المواسم والتقويم", icon: CalendarRange, need: "cohort.manage",
        descAr: "مواسمُ السنة وخطّةُ ما يُفتح فيها — وتزاحمُ الدورات" },
      /* الطلبةُ المسجَّلون — نطاقُ كلِّ دورٍ يُشتقّ في الخادم، واللوحُ نفسُه
         يُركَّب في بوابتَي المدرّب والمستشار. */
      { to: "/admin/learners", label: "الطلبة المسجَّلون", icon: GraduationCap, need: "enrollment.manage",
        descAr: "من سجّل في ماذا، وأين وصل، ونقلُه بين الشعب" },
      /* طابورُ شهاداتِ المتعلّمين وتوصياتِهم — كان الإصدارُ لا يُطلب أصلا،
         فمن أنهى دورتَه في شعبةٍ لا أحدَ يفتحها بقي بلا شهادة. */
      { to: "/admin/learner-requests", label: "طلبات المتعلّمين", icon: Award, need: "certificate.issue",
        descAr: "طابورُ الشهادات والتوصيات لمن أنهى واستوفى قواعدَ الإكمال" },
      { to: "/admin/ratings", label: "مراجعة التقييمات", icon: Star, need: "rating.moderate",
        descAr: "ما كتبه المتعلّمون عن دوراتهم ومدرّبيهم قبل أن يُعرض" },
    ],
  },
  {
    title: "المستشارون",
    icon: Handshake,
    items: [
      { to: "/admin/advisors", label: "المستشارون والعمولة", icon: UserCheck, need: "advisor.manage",
        descAr: "من يستشير من، وقاعدةُ العمولة، وما استُحقّ منها" },
      { to: "/admin/advisor-requests", label: "طلبات المستشارين", icon: BadgePercent, need: "advisor.request.review",
        descAr: "خصمٌ يطلبه مستشارٌ لعميله أو تعديلٌ على خطّته — بسببه كاملا" },
      /* «الاستثناءات» كان اسما لا يدلّ على شيء، وحارسا لا يحرس ما وراءه:
         التبويبُ مشروطٌ بـ`enrollment.request.review` والشاشةُ تقرأ
         `/api/admin/advisor-cases/unassigned` المحروسَ بـ`advisor.assign`.
         فمن مُنح مراجعةَ طلبات التسجيل يرى بابا يفتحه فيُردّ عند الخادم،
         **وطابورُه هو في شاشةٍ أخرى لا يراها أصلا**. والاسمُ الآن يقول
         محتواه، والحارسُ هو حارسُ مساره. */
      { to: "/admin/exceptions", label: "حالات بلا مستشار", icon: ShieldAlert, need: "advisor.assign",
        descAr: "حالةٌ وصلت ولا مستشارَ عليها — تُسنَد قبل أن تبرد" },
    ],
  },
  {
    title: "التشغيل والمالية",
    icon: Coins,
    items: [
      { to: "/admin/finance", label: "الطلبات والفواتير", icon: Wallet, need: ["finance.view", "enrollment.request.review"],
        descAr: "طابورُ طلبات التسجيل، والفواتيرُ والاستردادات" },
      { to: "/admin/reports", label: "التقارير والتصدير", icon: BarChart3, need: "reports.view",
        descAr: "أرقامُ المنصّة مفصَّلةً، وتصديرُها إلى ملفّ" },
      { to: "/admin/support", label: "تذاكر الدعم", icon: LifeBuoy, need: "support.operate",
        descAr: "ما يشتكي منه المستخدمون — ومن يردّ عليه ومتى" },
      { to: "/admin/notifications", label: "الإشعارات", icon: Bell, need: "notifications.manage",
        descAr: "ما تُرسله المنصّة تلقائيّا: نصُّه ووقتُه ومن يبلغه" },
    ],
  },
  {
    title: "النظام والصلاحيات",
    icon: Settings,
    items: [
      { to: "/admin/users", label: "المستخدمون والأدوار", icon: Users, need: "admin.users.view",
        descAr: "الحسابات وأدوارُها، ومنحُ صلاحيةٍ بعينها أو منعُها" },
      { to: "/admin/audit", label: "سجلّ الأثر", icon: History, need: "audit.view",
        descAr: "من فعل ماذا ومتى — وما كان قبلَه وما صار بعدَه" },
      /* «هل النظامُ سليم؟» — بصلاحيّةِ الإعدادات: بنودُها تكشف حالةَ
         مزوّد الدفع والبريد وأرقامَ محاولاتِ الدخول الفاشلة. */
      { to: "/admin/system-health", label: "صحّة النظام", icon: Activity, need: "settings.manage",
        descAr: "حالةُ مزوّد الدفع والبريد، ومحاولاتُ الدخول الفاشلة" },
      { to: "/admin/integrations", label: "التكاملات — الدفع والبريد", icon: PlugZap, need: "settings.manage",
        descAr: "ربطُ بوّابة الدفع والبريد وZoom وCalendly — واختبارُ كلٍّ منها" },
    ],
  },
];

/* ═══ مصدرٌ واحدٌ للشريط وللدليل ═══

   «كلّ الشاشات» في الرئيسية يعرض المجموعاتِ نفسَها التي يعرضها الشريط.
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
