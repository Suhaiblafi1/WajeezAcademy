import { useState } from "react";
import { Link, NavLink } from "react-router";
import { BookMarked, CalendarCog, Crown, ShieldAlert, LayoutDashboard } from "lucide-react";

const KEY = "wajeez_admin_identity";
const ADMINS = [
  { id: "adm-ops", name: "م. عبدالله الرشيد", title: "مدير العمليات" },
  { id: "adm-academic", name: "د. سارة العمري", title: "مديرة الشؤون الأكاديمية" },
  { id: "adm-finance", name: "أ. محمد الحربي", title: "مدير المالية" },
];

export function adminIdentity(): { id: string; name: string; title: string } | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** إطار لوحة الإدارة والعمليات */
export default function AdminLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const [me, setMe] = useState(adminIdentity);

  if (!me) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-[#0D0D0D] px-5 text-white">
        <Crown className="h-12 w-12 text-[#FABC05]" />
        <h1 className="mt-5 text-2xl font-black">لوحة الإدارة والعمليات — من أنت؟</h1>
        <p className="mt-2 max-w-md text-center text-sm leading-7 text-white/55">
          صلاحيات منفصلة: العمليات ترى الشعب والحالات، المالية ترى المبالغ لا إجابات الاختبارات — RBAC كامل.
        </p>
        <div className="mt-7 grid w-full max-w-md gap-3">
          {ADMINS.map((a) => (
            <button
              key={a.id}
              onClick={() => { localStorage.setItem(KEY, JSON.stringify(a)); setMe(a); }}
              className="cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-right transition hover:border-[#FABC05]/50"
            >
              <p className="font-black">{a.name}</p>
              <p className="mt-0.5 text-xs text-[#FABC05]">{a.title}</p>
            </button>
          ))}
        </div>
        <Link to="/" className="mt-6 text-xs text-white/40 hover:text-white/70">العودة للموقع العام</Link>
      </div>
    );
  }

  const tabs = [
    { to: "/admin", label: "اللوحة العليا", icon: LayoutDashboard, end: true },
    { to: "/admin/cohorts", label: "الشعب", icon: CalendarCog },
    { to: "/admin/exceptions", label: "الاستثناءات", icon: ShieldAlert },
    { to: "/admin/content", label: "المحتوى", icon: BookMarked },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-[#0D0D0D] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0D0D0D]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#FABC05] font-black text-[#0D0D0D]">و</span>
            <span className="hidden font-black sm:block">وجيز — الإدارة والعمليات</span>
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
          <button
            onClick={() => { localStorage.removeItem(KEY); setMe(null); }}
            className="cursor-pointer text-xs text-white/55 hover:text-white"
            title="تبديل الهوية"
          >
            {me.name}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="mb-6 text-2xl font-black">{title}</h1>
        {children}
      </main>
    </div>
  );
}
