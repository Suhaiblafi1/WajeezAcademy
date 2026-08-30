import { Link, NavLink } from "react-router";
import { Headset, LayoutDashboard } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import PortalSearchPalette from "@/components/PortalSearchPalette";
import { useRealSession } from "@/services/session";

/** إطار بوابة المستشار: هويته من جلسته وحدها. */
export default function AdvisorLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const { user, checked } = useRealSession();
  const realAdvisor = user?.permissions.includes("advisor.cases.view") ?? false;

  if (!checked) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-paper text-white">
        <Headset className="h-10 w-10 animate-pulse text-[#38A7B4]" />
      </div>
    );
  }

  /* حُذفت شاشة «من أنت؟» التي كانت تعرض أربعة أسماء مستشارين مختلَقين ليختار
     الزائر واحدا منها فيدخل البوابة بهويته — وهي الأسماء نفسها التي حُذفت من
     صفحة المسار ولوحة المتعلم من قبل. */
  if (!realAdvisor) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-white">
        <Headset className="h-12 w-12 text-[#38A7B4]" />
        <h1 className="mt-5 text-2xl font-black">بوابة المستشار</h1>
        <p className="mt-2 max-w-md text-center text-sm leading-7 text-white/55">
          تُفتح هذه البوابة بحساب مستشار معتمد، ويرى كلٌّ منهم الحالات المسندة إليه وحدها.
        </p>
        <Link to="/auth" className="mt-7 rounded-full bg-teal px-6 py-3 font-black text-on-teal transition hover:bg-teal-light">
          تسجيل الدخول
        </Link>
        <Link to="/" className="mt-6 text-xs text-white/50 hover:text-white/70">العودة للموقع العام</Link>
      </div>
    );
  }

  /* صفحة واحدة لأنها الحقيقية وحدها: «طلابي» و«طلبات المراجعة» كانتا
     مبنيّتين على `data/advisor` — بيانات مولَّدة في المتصفّح. */
  const tabs = [
    { to: "/advisor", label: "حالاتي", icon: Headset, end: true },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-paper text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 object-contain" />
            <span className="hidden font-black sm:block">وجيز — بوابة المستشار</span>
          </Link>
          <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition sm:px-4 ${
                    isActive ? "bg-gold text-on-gold" : "text-white/60 hover:text-white"
                  }`
                }
              >
                <t.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {/* بحث سريع Ctrl+K — لجلسة المستشار الحقيقية فقط: مقيد بحالاته المسندة */}
            {realAdvisor && (
              <button
                onClick={() => window.dispatchEvent(new Event("wajeez:open-search"))}
                aria-label="بحث سريع — Ctrl+K"
                title="بحث سريع — Ctrl+K"
                className="hidden cursor-pointer items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-bold text-white/45 transition hover:border-teal-light/50 hover:text-teal-light-ink md:flex"
              >
                بحث… <kbd className="rounded border border-white/15 px-1.5 text-[9px]">Ctrl K</kbd>
              </button>
            )}
            <NotificationBell audience="staff" />
            <ThemeToggle />
            <span className="flex items-center gap-2 text-xs text-white/55">
              <LayoutDashboard className="h-4 w-4 text-gold-ink" />
              <span className="max-w-[110px] truncate">{user?.displayName}</span>
            </span>
          </div>
        </div>
      </header>
      {/* ب-٢: حاوية تخطيط لا منطقة landmark — منطقة main واحدة في التطبيق
                (App.tsx) وهي هدف رابط «تجاوز إلى المحتوى». main متداخلة تجعل
                التخطي غامضا وتُجبر قارئ الشاشة على الاختيار بين منطقتين. */}
      <div className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="mb-6 text-2xl font-black">{title}</h1>
        {children}
      </div>
      {realAdvisor && <PortalSearchPalette kind="advisor" />}
    </div>
  );
}
