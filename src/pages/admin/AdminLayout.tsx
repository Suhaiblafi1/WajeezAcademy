import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { BadgePercent, CalendarCog, Crown, FlaskConical, GitBranch, ClipboardList, GraduationCap, Layers, PenLine, ShieldAlert, LayoutDashboard, UserPlus, Users, BarChart3, LifeBuoy, Wallet, Bell, PlugZap, Star, ScrollText } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import StaffAccountMenu from "@/components/StaffAccountMenu";
import SearchPalette from "@/components/SearchPalette";
import { useRealSession } from "@/services/session";

/** إطار لوحة الإدارة والعمليات — هويّة الإداريّ من جلسته وحدها.

    حُذفت شاشة «من أنت؟» التي كانت تعرض ثلاثة أسماء إداريّين مختلَقين
    («م. عبدالله الرشيد» و«د. سارة العمري» و«أ. محمد الحربي») ليختار الداخلُ
    واحدا منها فيُحفظ في متصفّحه، ومعها سطر «نسخة تجريبية». وهي القاعدة نفسها
    التي حُذفت من بوابة المدرب: لا اسمَ يُعرض كحقيقة قبل توثيقه.

    وكانت تُصيَّر لمن جاز حارسَ المسار ولم يملك صلاحية `admin.*` أو `catalog.*`
    — أي لحساب المالية بالضبط — فلا يبلغ شاشاته ويُدعى إلى انتحال اسم. */
export default function AdminLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const { user, checked } = useRealSession();
  const location = useLocation();
  const navigate = useNavigate();
  const can = (key: string) => user?.permissions.includes(key) ?? false;

  if (!checked) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-paper text-white">
        <Crown className="h-10 w-10 animate-pulse text-[#FABC05]" />
      </div>
    );
  }

  /* الأقسام الخمسة — كل قسم يجيب سؤالاً واحداً: ماذا نعلّم؟ من معنا؟ كيف المال؟ كيف عملاؤنا؟ */
  /* لكلّ تبويبٍ صلاحيتُه المعلَنة، والقائمة تُرشَّح بها.

     كانت تُعرض كاملةً لكلّ إداريّ: ثلاثة عشر بابا يفتح من لا يملكها فيُردّ
     عند الخادم — الحارس يعمل، لكنّه يكتشف حدّه بالاصطدام لا بالقراءة. */
  const allSections: { title: string; items: { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; need?: string; open?: true }[] }[] = [
    {
      title: "نظرة عامة",
      items: [{ to: "/admin", label: "الرئيسية", icon: LayoutDashboard, end: true, open: true }],
    },
    {
      title: "التعليم والمحتوى",
      items: [
        { to: "/admin/catalog", label: "الكتالوج", icon: Layers , need: "catalog.view"},
        { to: "/admin/authoring", label: "تأليف المتون", icon: PenLine , need: "catalog.course.edit"},
        { to: "/admin/publishing", label: "النشر والإصدارات", icon: GitBranch , need: "catalog.impact.view"},
        { to: "/admin/cohorts", label: "الشعب", icon: CalendarCog , need: "cohort.manage"},
        { to: "/admin/quality", label: "جودة التشخيص", icon: FlaskConical , need: "diagnostic.simulate"},
      ],
    },
    {
      title: "الأشخاص",
      items: [
        { to: "/admin/users", label: "المستخدمون والأدوار", icon: Users , need: "admin.users.view"},
        /* الطلبةُ المسجَّلون — نطاقُ كلِّ دورٍ يُشتقّ في الخادم، واللوحُ نفسُه
           يُركَّب في بوابتَي المدرّب والمستشار. */
        { to: "/admin/learners", label: "الطلبة المسجَّلون", icon: GraduationCap , need: "enrollment.manage"},
        { to: "/admin/trainers", label: "طلبات المدربين", icon: UserPlus , need: "trainer.applications.view"},
        { to: "/admin/exceptions", label: "الاستثناءات", icon: ShieldAlert , need: "enrollment.request.review"},
        { to: "/admin/advisor-requests", label: "طلبات المستشارين", icon: BadgePercent , need: "advisor.request.review"},
      ],
    },
    {
      title: "المالية",
      items: [
        { to: "/admin/finance", label: "الطلبات والفواتير", icon: Wallet , need: "finance.view"},
        { to: "/admin/reports", label: "التقارير والتصدير", icon: BarChart3 , need: "reports.view"},
      ],
    },
    {
      title: "العملاء",
      items: [
        { to: "/admin/support", label: "تذاكر الدعم", icon: LifeBuoy , need: "support.operate"},
        { to: "/admin/ratings", label: "مراجعة التقييمات", icon: Star , need: "rating.moderate"},
        { to: "/admin/notifications", label: "الإشعارات", icon: Bell , need: "notifications.manage"},
        /* `open` لا غيابَ شرط: التبويب الذي لا يعرض إلّا ما يخصّ صاحبَه
           يُعلن ذلك صراحةً فيُقرأ ويُحصى، ولا يمرّ سهوا.

           و«مهامّي» منه: كلُّ من جاز حارسَ اللوحة قد يُكلَّف — ولو حُرس
           التبويب بصلاحية التكليف لما رأى المكلَّفُ تكليفَه. وأقسامُ
           التكليف داخل الصفحة محروسةٌ بـ`staff.task.assign` وحدها. */
        { to: "/admin/tasks", label: "المهامّ والإشعارات", icon: ClipboardList, open: true },
      ],
    },
    {
      title: "النظام",
      items: [
        { to: "/admin/integrations", label: "التكاملات — الدفع والبريد", icon: PlugZap , need: "settings.manage"},
        { to: "/admin/audit-log", label: "سجل التدقيق", icon: ScrollText , need: "audit.view"},
      ],
    },
  ];

  /* المفتوحُ (`open`) يمرّ بلا صلاحية: «الرئيسية» ليقف عليها من جاز حارسَ
     المسار، و«المهامّ» لأنّها لا تعرض إلّا ما يخصّ صاحبَها. */
  const sections = allSections
    .map((sec) => ({ ...sec, items: sec.items.filter((it) => !it.need || can(it.need)) }))
    .filter((sec) => sec.items.length > 0);

  /* من لا تبويبَ له لا يُترك في لوحةٍ فارغة يظنّها معطوبة */
  if (sections.every((sec) => sec.items.every((it) => it.open))) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-white">
        <Crown className="h-12 w-12 text-[#FABC05]" />
        <h1 className="mt-5 text-2xl font-black">لا صلاحيات مفعّلة لحسابك</h1>
        <p className="mt-2 max-w-md text-center text-sm leading-7 text-white/55">
          حسابك <b className="text-white/75">{user?.displayName}</b> يدخل اللوحة، ولا صلاحية إداريّة مفعّلة عليه بعد.
          راجع مدير النظام ليمنحك ما يخصّ عملك.
        </p>
        <Link to="/" className="mt-6 text-xs text-white/50 hover:text-white/70">العودة للموقع العام</Link>
      </div>
    );
  }

  const linkCls = (isActive: boolean) =>
    `flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-bold transition ${
      isActive ? "bg-gold text-on-gold" : "text-white/60 hover:bg-white/[0.04] hover:text-white"
    }`;

  return (
    <div dir="rtl" className="min-h-screen bg-paper text-white">
      <SearchPalette />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 object-contain" />
            <span className="hidden font-black sm:block">وجيز — الإدارة والعمليات</span>
          </Link>
          {/* جوال: قائمة منسدلة بسيطة بكل الشاشات */}
          <select
            aria-label="التنقل بين شاشات الإدارة"
            className="rounded-xl border border-white/15 bg-paper px-3 py-2 text-xs font-bold text-white lg:hidden"
            value={location.pathname}
            onChange={(e) => navigate(e.target.value)}
          >
            {sections.flatMap((s) => s.items).map((t) => (
              <option key={t.to} value={t.to}>{t.label}</option>
            ))}
          </select>
          {/* ب-٣: min-w-0 يسمح للصفّ بالتقلّص عند التكبير ٤٠٠٪ (٣٢٠ بكسل CSS).
              بلا ذلك كان اسم الحساب يفيض ٣٨ بكسل خارج الشاشة فيظهر تمرير أفقي
              على مستوى المستند — والقراءة تصير سطرا سطرا بتمرير يمينا ويسارا. */}
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => window.dispatchEvent(new Event("wajeez:open-search"))}
              aria-label="بحث سريع — Ctrl+K"
              title="بحث سريع — Ctrl+K"
              className="hidden cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold text-white/45 transition hover:border-white/30 hover:text-white sm:flex"
            >
              بحث… <kbd className="rounded border border-white/15 px-1.5 text-[9px]">Ctrl K</kbd>
            </button>
            <NotificationBell audience="staff" />
            <ThemeToggle />
            <StaffAccountMenu user={user} />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl items-start gap-6 px-5">
        {/* الشريط الجانبي — شاشات كبيرة */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 overflow-y-auto border-l border-white/10 py-8 pl-5 lg:block">
          {sections.map((s) => (
            <div key={s.title} className="mb-7">
              <p className="mb-2 px-3 text-[10px] font-black tracking-wide text-white/55">{s.title}</p>
              <nav className="space-y-1">
                {s.items.map((t) => (
                  <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => linkCls(isActive)}>
                    <t.icon className="h-4 w-4 shrink-0" />
                    {t.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
        </aside>

        {/* ب-٢: حاوية تخطيط لا منطقة landmark — منطقة main واحدة في التطبيق

                  (App.tsx) وهي هدف رابط «تجاوز إلى المحتوى». main متداخلة تجعل

                  التخطي غامضا وتُجبر قارئ الشاشة على الاختيار بين منطقتين. */}

        <div className="min-w-0 flex-1 py-8">
          <h1 className="mb-6 text-2xl font-black">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}
