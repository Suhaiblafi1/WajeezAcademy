import { useState } from "react";
import { Link, NavLink } from "react-router";
import { ClipboardList, Headset, LayoutDashboard, Users } from "lucide-react";
import { ADVISOR_IDENTITIES, ADVISOR_IDENTITY_KEY, advisorIdentity } from "./advisor-identity";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import PrototypeBanner from "@/components/PrototypeBanner";
import PortalSearchPalette from "@/components/PortalSearchPalette";
import { useRealSession } from "@/services/session";

/** إطار بوابة المستشار: اختيار هوية المستشار + تنقل.
   من سجّل دخوله بحساب مستشار حقيقي يتجاوز شاشة اختيار الهوية التجريبية تلقائيا. */
export default function AdvisorLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const [me, setMe] = useState(advisorIdentity);
  const { user, checked } = useRealSession();
  const realAdvisor = user?.permissions.includes("advisor.cases.view") ?? false;
  const effectiveMe = me ?? (realAdvisor && user
    ? { id: user.userId, name: user.displayName, title: "مستشار — حساب حقيقي" }
    : null);

  if (!effectiveMe && !checked) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-paper text-white">
        <Headset className="h-10 w-10 animate-pulse text-[#38A7B4]" />
      </div>
    );
  }

  if (!effectiveMe) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-white">
        <Headset className="h-12 w-12 text-[#38A7B4]" />
        <h1 className="mt-5 text-2xl font-black">بوابة المستشار — من أنت؟</h1>
        <p className="mt-2 max-w-md text-center text-sm leading-7 text-white/55">
          يرى كل مستشار الطلبة والعملاء المسندين إليه فقط (RBAC) — اختر هويتك للمتابعة.
        </p>
        <div className="mt-7 grid w-full max-w-md gap-3">
          {ADVISOR_IDENTITIES.map((a) => (
            <button
              key={a.id}
              onClick={() => { localStorage.setItem(ADVISOR_IDENTITY_KEY, JSON.stringify(a)); setMe(a); }}
              className="cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-right transition hover:border-[#38A7B4]/50"
            >
              <p className="font-black">{a.name}</p>
              <p className="mt-0.5 text-xs text-[#6EC7D1]">{a.title}</p>
            </button>
          ))}
        </div>
        <p className="mt-4 text-[11px] font-bold text-[#FABC05]/70">نسخة تجريبية — البيانات المعروضة محلية وليست تشغيلية</p>
        <Link to="/" className="mt-6 text-xs text-white/50 hover:text-white/70">العودة للموقع العام</Link>
      </div>
    );
  }

  const tabs = [
    { to: "/advisor", label: "طلبةي", icon: Users, end: true },
    { to: "/advisor/cases", label: "حالاتي (حقيقي)", icon: Headset },
    { to: "/advisor/reviews", label: "طلبات المراجعة", icon: ClipboardList },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-paper text-white">
      <PrototypeBanner hidden={realAdvisor} />
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
                    isActive ? "bg-[#FABC05] text-[#0D0D0D]" : "text-white/60 hover:text-white"
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
                className="hidden cursor-pointer items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-bold text-white/45 transition hover:border-[#6EC7D1]/50 hover:text-[#6EC7D1] md:flex"
              >
                بحث… <kbd className="rounded border border-white/15 px-1.5 text-[9px]">Ctrl K</kbd>
              </button>
            )}
            <NotificationBell />
            <ThemeToggle />
            <button
              onClick={() => { localStorage.removeItem(ADVISOR_IDENTITY_KEY); setMe(null); }}
              className="flex cursor-pointer items-center gap-2 text-xs text-white/55 hover:text-white"
              title={realAdvisor && !me ? "حسابك الحقيقي" : "تبديل المستشار"}
            >
              <LayoutDashboard className="h-4 w-4 text-[#FABC05]" />
              <span className="max-w-[110px] truncate">{effectiveMe.name}</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="mb-6 text-2xl font-black">{title}</h1>
        {children}
      </main>
      {realAdvisor && <PortalSearchPalette kind="advisor" />}
    </div>
  );
}
