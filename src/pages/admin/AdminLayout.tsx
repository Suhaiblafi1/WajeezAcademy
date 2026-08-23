import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { BookMarked, CalendarCog, Crown, FlaskConical, GitBranch, Layers, ShieldAlert, LayoutDashboard, UserPlus, Users, BarChart3, LifeBuoy, Wallet, Bell, PlugZap } from "lucide-react";
import { ADMIN_IDENTITIES, ADMIN_IDENTITY_KEY, adminIdentity } from "./admin-identity";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import SearchPalette from "@/components/SearchPalette";
import PrototypeBanner from "@/components/PrototypeBanner";
import { useRealSession } from "@/services/session";

/** إطار لوحة الإدارة والعمليات.
   من سجّل دخوله بحساب إداري حقيقي يتجاوز شاشة اختيار الهوية التجريبية تلقائيا. */
export default function AdminLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const [me, setMe] = useState(adminIdentity);
  const { user, checked } = useRealSession();
  const location = useLocation();
  const navigate = useNavigate();
  const realAdmin = user?.permissions.some((p) => p.startsWith("admin.") || p.startsWith("catalog.")) ?? false;
  const effectiveMe = me ?? (realAdmin && user
    ? { id: user.userId, name: user.displayName, title: "إدارة — حساب حقيقي" }
    : null);

  if (!effectiveMe && !checked) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-paper text-white">
        <Crown className="h-10 w-10 animate-pulse text-[#FABC05]" />
      </div>
    );
  }

  if (!effectiveMe) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-white">
        <Crown className="h-12 w-12 text-[#FABC05]" />
        <h1 className="mt-5 text-2xl font-black">لوحة الإدارة والعمليات — من أنت؟</h1>
        <p className="mt-2 max-w-md text-center text-sm leading-7 text-white/55">
          صلاحيات منفصلة: العمليات ترى الشعب والحالات، المالية ترى المبالغ لا إجابات الاختبارات — RBAC كامل.
        </p>
        <div className="mt-7 grid w-full max-w-md gap-3">
          {ADMIN_IDENTITIES.map((a) => (
            <button
              key={a.id}
              onClick={() => { localStorage.setItem(ADMIN_IDENTITY_KEY, JSON.stringify(a)); setMe(a); }}
              className="cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-right transition hover:border-gold/50"
            >
              <p className="font-black">{a.name}</p>
              <p className="mt-0.5 text-xs text-gold-ink">{a.title}</p>
            </button>
          ))}
        </div>
        <p className="mt-4 text-[11px] font-bold text-gold-ink/70">نسخة تجريبية — البيانات المعروضة محلية وليست تشغيلية</p>
        <Link to="/" className="mt-6 text-xs text-white/50 hover:text-white/70">العودة للموقع العام</Link>
      </div>
    );
  }

  /* الأقسام الخمسة — كل قسم يجيب سؤالاً واحداً: ماذا نعلّم؟ من معنا؟ كيف المال؟ كيف عملاؤنا؟ */
  const sections: { title: string; items: { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean }[] }[] = [
    {
      title: "نظرة عامة",
      items: [{ to: "/admin", label: "الرئيسية", icon: LayoutDashboard, end: true }],
    },
    {
      title: "التعليم والمحتوى",
      items: [
        { to: "/admin/catalog", label: "الكتالوج", icon: Layers },
        { to: "/admin/publishing", label: "النشر والإصدارات", icon: GitBranch },
        { to: "/admin/cohorts", label: "الشعب", icon: CalendarCog },
        { to: "/admin/content", label: "سير المحتوى", icon: BookMarked },
        { to: "/admin/quality", label: "جودة التشخيص", icon: FlaskConical },
      ],
    },
    {
      title: "الأشخاص",
      items: [
        { to: "/admin/users", label: "المستخدمون والأدوار", icon: Users },
        { to: "/admin/trainers", label: "طلبات المدربين", icon: UserPlus },
        { to: "/admin/exceptions", label: "الاستثناءات", icon: ShieldAlert },
      ],
    },
    {
      title: "المالية",
      items: [
        { to: "/admin/finance", label: "الطلبات والفواتير", icon: Wallet },
        { to: "/admin/reports", label: "التقارير والتصدير", icon: BarChart3 },
      ],
    },
    {
      title: "العملاء",
      items: [
        { to: "/admin/support", label: "تذاكر الدعم", icon: LifeBuoy },
        { to: "/admin/notifications", label: "الإشعارات", icon: Bell },
      ],
    },
    {
      title: "النظام",
      items: [
        { to: "/admin/integrations", label: "التكاملات — الدفع والبريد", icon: PlugZap },
      ],
    },
  ];

  const linkCls = (isActive: boolean) =>
    `flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-bold transition ${
      isActive ? "bg-gold text-on-gold" : "text-white/60 hover:bg-white/[0.04] hover:text-white"
    }`;

  return (
    <div dir="rtl" className="min-h-screen bg-paper text-white">
      <SearchPalette />
      <PrototypeBanner hidden={realAdmin} />
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
            <NotificationBell />
            <ThemeToggle />
            <button
              onClick={() => { localStorage.removeItem(ADMIN_IDENTITY_KEY); setMe(null); }}
              className="max-w-[9rem] cursor-pointer truncate text-xs text-white/60 hover:text-white sm:max-w-none"
              title={`${effectiveMe.name} — ${realAdmin && !me ? "حسابك الحقيقي" : "تبديل الهوية"}`}
            >
              {effectiveMe.name}
            </button>
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
