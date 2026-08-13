import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router";
import { GraduationCap, LayoutDashboard, Route as RouteIcon, Trophy, Award, Lock, Eye } from "lucide-react";
import { canAccessPortal, enablePreview, getEnrollment } from "@/services/access";
import { readUserName } from "@/data/student";

/** إطار بوابة الطالب: شريط علوي + تنقل + حارس الوصول (دفع سابق أو معاينة تجريبية) */
export default function PortalLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const user = readUserName();
  const enrollment = getEnrollment();

  useEffect(() => {
    setAllowed(canAccessPortal());
  }, []);

  if (allowed === null) return null;

  if (!allowed) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-[#0D0D0D] px-5 text-white">
        <Lock className="h-12 w-12 text-[#FABC05]" />
        <h1 className="mt-5 text-2xl font-black">منصة الطالب تُفتح بعد أول دفع ناجح</h1>
        <p className="mt-3 max-w-md text-center text-sm leading-7 text-white/60">
          وفق سياسة وجيز: حدث دفع واحد ينشئ تسجيلا واحدا، يرسل فاتورتك، ويفتح وصولك تلقائيا دون تدخل يدوي.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link to="/diagnostic" className="rounded-full bg-[#38A7B4] px-6 py-3 font-bold text-[#0D0D0D] hover:bg-[#6EC7D1]">
            ابدأ بالتشخيص
          </Link>
          <Link to="/" className="rounded-full border border-white/15 px-6 py-3 font-bold text-white/80 hover:border-white/40">
            الرئيسية
          </Link>
          <button
            onClick={() => { enablePreview(); setAllowed(true); }}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-white/20 px-4 py-2 text-xs text-white/40 hover:border-[#6EC7D1]/50 hover:text-[#6EC7D1]"
          >
            <Eye className="h-3.5 w-3.5" /> معاينة تجريبية (للمالك)
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { to: "/student", label: "لوحتي", icon: LayoutDashboard, end: true },
    { to: "/student/pathway", label: "مساري", icon: RouteIcon },
    { to: "/student/project", label: "مشروع التخرج", icon: Trophy },
    { to: "/student/certificates", label: "شهاداتي", icon: Award },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-[#0D0D0D] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0D0D0D]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#38A7B4] font-black text-[#08272B]">و</span>
            <span className="hidden font-black sm:block">أكاديمي وجيز</span>
          </Link>
          <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end as boolean | undefined}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition sm:px-4 ${
                    isActive ? "bg-[#38A7B4] text-[#08272B]" : "text-white/60 hover:text-white"
                  }`
                }
              >
                <t.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-xs text-white/55">
            <GraduationCap className="h-4 w-4 text-[#6EC7D1]" />
            <span className="max-w-[110px] truncate">{user}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black">{title}</h1>
          {enrollment && (
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/50">
              طلب {enrollment.ref} · {enrollment.kind === "pathway" ? "مسار كامل" : "دورة"}
            </span>
          )}
        </div>
        {children}
      </main>
    </div>
  );
}
