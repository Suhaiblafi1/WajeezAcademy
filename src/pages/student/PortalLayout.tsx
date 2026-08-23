import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { GraduationCap, LayoutDashboard, Route as RouteIcon, Trophy, Award, Lock, Eye, LogOut, Bell, CheckCheck, UserCircle, ReceiptText, FileText, MoreHorizontal, X, LifeBuoy, CalendarDays, BookOpen, ChevronDown } from "lucide-react";
import { canAccessPortal, enablePreview, getEnrollment, isOwnerUnlocked, unlockOwner } from "@/services/access";
import { signOut } from "@/services/auth";
import { apiGet, apiPost } from "@/services/api";
import { useRealSession } from "@/services/session";
import { useAutoRefresh } from "@/services/useAutoRefresh";
import { loadPortal, readUserName, savePortal, type PortalNotification } from "@/data/student";
import { pathways } from "@/data/pathways";
import { pathwayCourses } from "@/data/courses";
import PrototypeBanner from "@/components/PrototypeBanner";
import ThemeToggle from "@/components/ThemeToggle";
import EcosystemNote from "@/components/EcosystemNote";

interface RealNotif { id: string; title: string; body: string; status: string; sentAt: string | null; queuedAt: string }

/** إطار بوابة الطالب: شريط علوي + تنقل + إشعارات + حارس الوصول.
    جلسة الخادم الحقيقية أولاً — الاسم والوصول والإشعارات منها؛ المحاكاة المحلية للديمو فقط. */
export default function PortalLayout({ children, title }: { children: React.ReactNode; title: string }) {
  /* فتح علم المالك عبر ?preview=owner في العنوان — مشتق أثناء التصيير لا في تأثير */
  const previewOwner = new URLSearchParams(window.location.search).get("preview") === "owner";
  const [allowed, setAllowed] = useState<boolean>(() => canAccessPortal() || previewOwner);
  const [bellOpen, setBellOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [deskMoreOpen, setDeskMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user: sessionUser, checked: sessionChecked } = useRealSession();
  /* الهوية: اسم الجلسة الحقيقية أولاً، ثم الاسم المحلي التجريبي */
  const user = sessionUser?.displayName ?? readUserName();
  const enrollment = getEnrollment();
  const pathwayId = enrollment?.pathwayId ?? pathways.find((p) => (pathwayCourses[p.id] ?? []).length >= 4)?.id ?? "";
  const [notifs, setNotifs] = useState<PortalNotification[]>(() =>
    pathwayId ? loadPortal(pathwayId).notifications.slice(0, 6) : []
  );
  /* إشعارات الخادم الحقيقية — عند توفر جلسة تحل محل المحلية */
  const [realNotifs, setRealNotifs] = useState<RealNotif[] | null>(null);

  useEffect(() => {
    if (previewOwner) { unlockOwner(); enablePreview(); } // يستمر عبر التنقلات لا لصفحة واحدة
  }, [previewOwner]);

  /* حساب الخادم الحقيقي يفتح البوابة فورا — حتى قبل أول تسجيل في شعبة.
     الحساب المسجل يملك لوحته وإشعاراته وطلباته من يومه الأول. */
  useEffect(() => {
    if (!allowed && sessionUser) setAllowed(true);
  }, [allowed, sessionUser]);

  useEffect(() => {
    apiGet<RealNotif[]>("/api/learner/notifications").then((rows) => setRealNotifs(rows.slice(0, 6))).catch(() => setRealNotifs(null));
  }, []);

  /* عداد الخادم الرسمي للشارة — يُفضَّل على الحساب المحلي، ويُحدَّث كل دقيقة */
  const [serverUnread, setServerUnread] = useState<number | null>(null);
  const refreshUnread = useCallback(() => {
    apiGet<{ unread: number }>("/api/learner/notifications/unread-count")
      .then((r) => setServerUnread(r.unread))
      .catch(() => setServerUnread(null));
  }, []);
  useEffect(() => { refreshUnread(); }, [refreshUnread]);
  useAutoRefresh(refreshUnread, 60_000);

  const unreadCount = serverUnread ?? (realNotifs
    ? realNotifs.filter((n) => n.status !== "read").length
    : notifs.filter((n) => !n.read).length);

  const markAllRead = () => {
    if (realNotifs) {
      const unread = realNotifs.filter((n) => n.status !== "read");
      setRealNotifs(realNotifs.map((n) => ({ ...n, status: "read" })));
      setServerUnread(0);
      void Promise.allSettled(unread.map((n) => apiPost(`/api/learner/notifications/${n.id}/read`)));
      return;
    }
    if (!pathwayId) return;
    const s = loadPortal(pathwayId);
    s.notifications = s.notifications.map((n) => ({ ...n, read: true }));
    savePortal(s);
    setNotifs(s.notifications.slice(0, 6));
  };

  const markOneRead = (id: string) => {
    if (!realNotifs) return;
    setRealNotifs(realNotifs.map((n) => (n.id === id ? { ...n, status: "read" } : n)));
    setServerUnread((c) => (c != null && c > 0 ? c - 1 : c));
    void apiPost(`/api/learner/notifications/${id}/read`).catch(() => undefined);
  };

  /* بوابة القفل لا تظهر قبل اكتمال فحص الجلسة — زائر الديمو يراها فورا، وصاحب الحساب لا يراها أبدا */
  if (!allowed && !sessionChecked) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-paper text-white">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#38A7B4]" aria-label="يُحمَّل" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-white">
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
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-white/20 px-4 py-2 text-xs text-white/50 hover:border-[#6EC7D1]/50 hover:text-[#6EC7D1]"
            >
              <Eye className="h-3.5 w-3.5" /> معاينة تجريبية (للمالك)
            </button>
          )}
        </div>
        {/* تعريف المنظومة عند مدخل البوابة — سطر ثقة ثانوي لا ينافس الرسالة */}
        <EcosystemNote className="mt-10" />
      </div>
    );
  }

  const tabs = [
    { to: "/student", label: "لوحتي", icon: LayoutDashboard, end: true },
    { to: "/student/learning", label: "تعلّمي", icon: BookOpen },
    { to: "/student/pathway", label: "مساري", icon: RouteIcon },
    { to: "/student/project", label: "مشروع التخرج", icon: Trophy },
    { to: "/student/cohorts", label: "الشعب المفتوحة", icon: CalendarDays },
    { to: "/student/certificates", label: "شهاداتي", icon: Award },
    { to: "/student/billing", label: "فواتيري", icon: ReceiptText },
    { to: "/student/cv", label: "سيرتي", icon: FileText },
    { to: "/student/account", label: "حسابي", icon: UserCircle },
    { to: "/student/notifications", label: "إشعاراتي", icon: Bell },
    { to: "/student/support", label: "الدعم", icon: LifeBuoy },
  ];
  /* سطح المكتب: خمسة أساسية + «المزيد» منسدلة — لا شريط مكتظ يضغط التبويبات */
  const deskPrimary = tabs.slice(0, 5);
  const deskOverflow = tabs.slice(5);
  const deskMoreActive = deskOverflow.some((t) => pathname.startsWith(t.to));
  /* جوال: أربعة تبويبات أساسية ثابتة + «المزيد» يفتح الباقي — لا تمرير أفقي يُخفي الصفحات */
  const mainTabs = [tabs[0], tabs[1], tabs[2], tabs[8]];
  const moreTabs = [tabs[3], tabs[4], tabs[5], tabs[6], tabs[7], tabs[9], tabs[10]];
  const moreActive = moreTabs.some((t) => pathname.startsWith(t.to));

  return (
    <div dir="rtl" className="min-h-screen bg-paper text-white">
      <PrototypeBanner hidden={!!sessionUser} />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 object-contain" />
            <span className="hidden font-black sm:block">أكاديمية وجيز</span>
          </Link>
          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 md:flex">
            {deskPrimary.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end as boolean | undefined}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition lg:px-4 ${
                    isActive ? "bg-[#38A7B4] text-[#08272B]" : "text-white/60 hover:text-white"
                  }`
                }
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </NavLink>
            ))}
            {/* «المزيد» لسطح المكتب — بقية الصفحات في منسدلة واحدة أنيقة */}
            <div className="relative">
              <button
                onClick={() => setDeskMoreOpen((v) => !v)}
                aria-label="المزيد من الصفحات"
                className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition lg:px-4 ${
                  deskMoreActive ? "bg-[#38A7B4] text-[#08272B]" : "text-white/60 hover:text-white"
                }`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
                المزيد
                <ChevronDown className={`h-3 w-3 transition ${deskMoreOpen ? "rotate-180" : ""}`} />
              </button>
              {deskMoreOpen && (
                <>
                  <button aria-label="إغلاق القائمة" onClick={() => setDeskMoreOpen(false)} className="fixed inset-0 z-40 cursor-default" />
                  <div className="absolute left-0 top-10 z-50 w-56 rounded-2xl border border-white/10 bg-surface p-2 shadow-2xl">
                    {deskOverflow.map((t) => (
                      <NavLink
                        key={t.to}
                        to={t.to}
                        onClick={() => setDeskMoreOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                            isActive ? "bg-[#38A7B4]/15 text-[#6EC7D1]" : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                          }`
                        }
                      >
                        <t.icon className="h-4 w-4" />
                        {t.label}
                      </NavLink>
                    ))}
                  </div>
                </>
              )}
            </div>
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
                  <div className="absolute left-0 top-10 z-50 w-80 max-w-[85vw] rounded-2xl border border-white/10 bg-surface p-3 shadow-2xl">
                    <div className="flex items-center justify-between px-1 pb-2">
                      <p className="text-xs font-black text-white/80">الإشعارات</p>
                      <button onClick={markAllRead} className="flex cursor-pointer items-center gap-1 text-[10px] font-bold text-[#6EC7D1] transition hover:text-white">
                        <CheckCheck className="h-3 w-3" /> تعليم الكل كمقروء
                      </button>
                    </div>
                    <div className="max-h-72 space-y-1.5 overflow-y-auto">
                      {realNotifs ? (
                        <>
                          {realNotifs.length === 0 && <p className="px-2 py-6 text-center text-[11px] text-white/55">لا إشعارات بعد</p>}
                          {realNotifs.map((n) => (
                            <button key={n.id} onClick={() => markOneRead(n.id)}
                              className={`block w-full cursor-pointer rounded-xl border px-3 py-2 text-right text-[11px] leading-5 ${n.status === "read" ? "border-white/5 text-white/50" : "border-[#38A7B4]/25 bg-[#38A7B4]/5 text-white/75"}`}>
                              <span className="block font-bold">{n.title}</span>
                              {n.body}
                            </button>
                          ))}
                        </>
                      ) : (
                        <>
                          {notifs.length === 0 && <p className="px-2 py-6 text-center text-[11px] text-white/55">لا إشعارات بعد</p>}
                          {notifs.map((n) => (
                            <p key={n.id} className={`rounded-xl border px-3 py-2 text-[11px] leading-5 ${n.read ? "border-white/5 text-white/50" : "border-[#38A7B4]/25 bg-[#38A7B4]/5 text-white/75"}`}>{n.text}</p>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <GraduationCap className="h-4 w-4 text-[#6EC7D1]" />
            <ThemeToggle />
            <span className="max-w-[110px] truncate">{user}</span>
            <button
              onClick={() => { void signOut(); navigate("/"); }}
              aria-label="تسجيل الخروج"
              title="تسجيل الخروج"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/45 transition hover:border-red-400/50 hover:text-red-300"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 pb-28 md:pb-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black">{title}</h1>
          {enrollment && !sessionUser && (
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/50">
              طلب {enrollment.ref} · {enrollment.kind === "pathway" ? "مسار كامل" : "دورة"}
            </span>
          )}
        </div>
        {children}
      </main>
      {/* تعريف المنظومة — تذييل ثقة خفيف داخل البوابة (يظهر مرة واحدة أسفل المحتوى) */}
      <EcosystemNote className="mx-auto max-w-6xl px-5 pb-24 md:pb-6" />
      {/* شريط تنقل سفلي للجوال — أربعة أساسية + «المزيد» بقائمة منبثقة */}
      <nav aria-label="تنقل المنصة" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-paper/95 pb-[max(env(safe-area-inset-bottom),0.25rem)] backdrop-blur-xl md:hidden">
        {mainTabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end as boolean | undefined}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition ${
                isActive ? "text-[#6EC7D1]" : "text-white/50"
              }`
            }
          >
            <t.icon className="h-5 w-5" />
            {t.label}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          aria-label="المزيد من الصفحات"
          className={`flex cursor-pointer flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition ${
            moreActive ? "text-[#6EC7D1]" : "text-white/50"
          }`}
        >
          <MoreHorizontal className="h-5 w-5" />
          المزيد
        </button>
      </nav>

      {/* قائمة «المزيد» للجوال — بقية الصفحات */}
      {moreOpen && (
        <>
          <button aria-label="إغلاق القائمة" onClick={() => setMoreOpen(false)} className="fixed inset-0 z-50 cursor-default bg-black/60 backdrop-blur-sm md:hidden" />
          <div dir="rtl" className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-white/10 bg-surface p-5 pb-[max(env(safe-area-inset-bottom),1rem)] md:hidden">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-black">صفحات أخرى</p>
              <button onClick={() => setMoreOpen(false)} aria-label="إغلاق" className="cursor-pointer text-white/50 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-1.5">
              {moreTabs.map((t) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                      isActive ? "border-[#38A7B4]/50 bg-[#38A7B4]/10 text-[#6EC7D1]" : "border-white/10 text-white/70 hover:border-white/25"
                    }`
                  }
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </NavLink>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
