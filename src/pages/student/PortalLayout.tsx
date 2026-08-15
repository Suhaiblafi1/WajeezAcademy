import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { GraduationCap, LayoutDashboard, Route as RouteIcon, Trophy, Award, Lock, Eye, LogOut, Bell, CheckCheck } from "lucide-react";
import { canAccessPortal, enablePreview, getEnrollment, isOwnerUnlocked, unlockOwner } from "@/services/access";
import { signOut } from "@/services/auth";
import { loadPortal, readUserName, savePortal, type PortalNotification } from "@/data/student";
import { pathways } from "@/data/pathways";
import { pathwayCourses } from "@/data/courses";
import PrototypeBanner from "@/components/PrototypeBanner";

/** إطار بوابة الطالب: شريط علوي + تنقل + إشعارات + حارس الوصول (دفع سابق أو معاينة تجريبية) */
export default function PortalLayout({ children, title }: { children: React.ReactNode; title: string }) {
  /* فتح علم المالك عبر ?preview=owner في العنوان — مشتق أثناء التصيير لا في تأثير */
  const previewOwner = new URLSearchParams(window.location.search).get("preview") === "owner";
  const [allowed, setAllowed] = useState<boolean>(() => canAccessPortal() || previewOwner);
  const [bellOpen, setBellOpen] = useState(false);
  const navigate = useNavigate();
  const user = readUserName();
  const enrollment = getEnrollment();
  const pathwayId = enrollment?.pathwayId ?? pathways.find((p) => (pathwayCourses[p.id] ?? []).length >= 4)?.id ?? "";
  const [notifs, setNotifs] = useState<PortalNotification[]>(() =>
    pathwayId ? loadPortal(pathwayId).notifications.slice(0, 6) : []
  );

  useEffect(() => {
    if (previewOwner) unlockOwner();
  }, [previewOwner]);

  const unreadCount = notifs.filter((n) => !n.read).length;
  const markAllRead = () => {
    if (!pathwayId) return;
    const s = loadPortal(pathwayId);
    s.notifications = s.notifications.map((n) => ({ ...n, read: true }));
    savePortal(s);
    setNotifs(s.notifications.slice(0, 6));
  };

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
          {isOwnerUnlocked() && (
            <button
              onClick={() => { enablePreview(); setAllowed(true); }}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-white/20 px-4 py-2 text-xs text-white/40 hover:border-[#6EC7D1]/50 hover:text-[#6EC7D1]"
            >
              <Eye className="h-3.5 w-3.5" /> معاينة تجريبية (للمالك)
            </button>
          )}
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
      <PrototypeBanner />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0D0D0D]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 object-contain" />
            <span className="hidden font-black sm:block">أكاديمي وجيز</span>
          </Link>
          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 sm:flex">
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
            {/* جرس الإشعارات */}
            <div className="relative">
              <button
                onClick={() => setBellOpen((v) => !v)}
                aria-label="الإشعارات"
                className="relative grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-white/10 text-white/45 transition hover:border-[#6EC7D1]/50 hover:text-[#6EC7D1]"
              >
                <Bell className="h-3.5 w-3.5" />
                {unreadCount > 0 && (
                  <span className="absolute -left-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#FABC05] px-1 text-[9px] font-black text-[#0D0D0D]">{unreadCount}</span>
                )}
              </button>
              {bellOpen && (
                <>
                  <button aria-label="إغلاق الإشعارات" onClick={() => setBellOpen(false)} className="fixed inset-0 z-40 cursor-default" />
                  <div className="absolute left-0 top-10 z-50 w-80 max-w-[85vw] rounded-2xl border border-white/10 bg-[#141414] p-3 shadow-2xl">
                    <div className="flex items-center justify-between px-1 pb-2">
                      <p className="text-xs font-black text-white/80">الإشعارات</p>
                      <button onClick={markAllRead} className="flex cursor-pointer items-center gap-1 text-[10px] font-bold text-[#6EC7D1] transition hover:text-white">
                        <CheckCheck className="h-3 w-3" /> تعليم الكل كمقروء
                      </button>
                    </div>
                    <div className="max-h-72 space-y-1.5 overflow-y-auto">
                      {notifs.length === 0 && <p className="px-2 py-6 text-center text-[11px] text-white/55">لا إشعارات بعد</p>}
                      {notifs.map((n) => (
                        <p key={n.id} className={`rounded-xl border px-3 py-2 text-[11px] leading-5 ${n.read ? "border-white/5 text-white/40" : "border-[#38A7B4]/25 bg-[#38A7B4]/5 text-white/75"}`}>{n.text}</p>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <GraduationCap className="h-4 w-4 text-[#6EC7D1]" />
            <span className="max-w-[110px] truncate">{user}</span>
            <button
              onClick={() => { signOut(); navigate("/"); }}
              aria-label="تسجيل الخروج"
              title="تسجيل الخروج"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/45 transition hover:border-red-400/50 hover:text-red-300"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 pb-28 sm:pb-8">
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
      {/* شريط تنقل سفلي للجوال — التبويبات الأربعة كاملة بالنص في متناول الإبهام */}
      <nav aria-label="تنقل المنصة" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 bg-[#0D0D0D]/95 pb-[max(env(safe-area-inset-bottom),0.25rem)] backdrop-blur-xl sm:hidden">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end as boolean | undefined}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition ${
                isActive ? "text-[#6EC7D1]" : "text-white/45"
              }`
            }
          >
            <t.icon className="h-5 w-5" />
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
