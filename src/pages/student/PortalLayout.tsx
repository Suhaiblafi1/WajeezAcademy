import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { LayoutDashboard, Award, Lock, LogOut, Bell, CheckCheck, UserCircle, ReceiptText, X, LifeBuoy, BookOpen, ChevronDown, Inbox } from "lucide-react";
import { signOut } from "@/services/auth";
import { apiGet, apiPost } from "@/services/api";
import { useRealSession } from "@/services/session";
import { useAutoRefresh } from "@/services/useAutoRefresh";
import ThemeToggle from "@/components/ThemeToggle";
import EcosystemNote from "@/components/EcosystemNote";

interface RealNotif { id: string; title: string; body: string; status: string; sentAt: string | null; queuedAt: string }

/** قسمٌ في التنقّل الرئيسي: عنوانه وسؤاله، وصفحاتُه تنقّلٌ ثانويّ تحته */
interface SubTab { to: string; label: string }
interface Section {
  id: string
  label: string
  icon: typeof LayoutDashboard
  /** وجهة النقر على القسم — أوّل صفحاته */
  to: string
  end?: boolean
  items: SubTab[]
  /** بوادئ المسارات التي تُعدّ داخل القسم (تشمل صفحاتٍ لا تظهر في شريطه) */
  match: string[]
}

/* شؤون الحساب لا تكون تبويبا في شريط التعلّم — مكانها قائمة الحساب أعلى
   اليسار، كما في المنصّات التي يعرفها المتعلم. */
const ACCOUNT_ITEMS: { to: string; label: string; icon: typeof LayoutDashboard }[] = [
  { to: "/student/account", label: "الملف الشخصي", icon: UserCircle },
  { to: "/student/billing", label: "فواتيري", icon: ReceiptText },
  { to: "/student/inbox", label: "صندوقي", icon: Inbox },
  { to: "/student/notifications", label: "الإشعارات", icon: Bell },
  { to: "/student/support", label: "الدعم", icon: LifeBuoy },
]

/** إطار بوابة الطالب: شريط علوي + تنقل + إشعارات + حارس الوصول.
    جلسة الخادم الحقيقية أولاً — الاسم والوصول والإشعارات منها؛ المحاكاة المحلية للديمو فقط. */
export default function PortalLayout({ children, title }: { children: React.ReactNode; title: string }) {
  /* البوابة بجلسة حقيقية وحدها. كان يفتحها أيضا «وضع المعاينة» (‏?preview=owner
     أو علمٌ في localStorage) أو «استحقاقٌ» مكتوب محليا — أي بلا حساب على
     الخادم. ولمّا زالت البيانات المحاكاة لم يبق للمعاينة ما تعرضه. */
  const [bellOpen, setBellOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  /* الخروج ينتظر مسح الجلسة عند الخادم قبل التنقّل. كان `void signOut()`
     فيسبق التنقّلُ المسحَ، فيعود المستخدم داخلا وهو يظنّ أنه خرج. */
  const doSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    navigate("/", { replace: true });
  };
  const { user: sessionUser, checked: sessionChecked } = useRealSession();
  /* كان useEffect يقلب allowed عند ظهور الجلسة، فيصيّر مرة بالمنع ثم مرة
     بالسماح — ومضة يراها المستخدم، وتحذير «setState داخل تأثير». العطف هنا
     يعطي النتيجة نفسها في تصيير واحد. */
  const allowed = !!sessionUser;
  /* الهوية من الجلسة وحدها. كان `readUserName()` يقرأ اسما محليا ويعيد
     «متعلم وجيز» حين لا يجد — اسمٌ لا صاحب له. */
  const user = sessionUser?.displayName ?? "";
  /* الإشعارات من الخادم وحده. كان بجانبها متجرٌ محليّ مبذور — منه «وصلت
     فاتورتك وتأكيد الدفع على بريدك» — ويُعرض حين يتعذّر نداء الخادم. */
  const [realNotifs, setRealNotifs] = useState<RealNotif[] | null>(null);

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

  const unreadCount = serverUnread ?? (realNotifs?.filter((n) => n.status !== "read").length ?? 0);

  const markAllRead = () => {
    if (realNotifs) {
      const unread = realNotifs.filter((n) => n.status !== "read");
      setRealNotifs(realNotifs.map((n) => ({ ...n, status: "read" })));
      setServerUnread(0);
      void Promise.allSettled(unread.map((n) => apiPost(`/api/learner/notifications/${n.id}/read`)));
    }
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
        <h1 className="mt-5 text-2xl font-black">منصتك تُفتح بحسابك</h1>
        <p className="mt-3 max-w-md text-center text-sm leading-7 text-white/60">
          سجّل دخولك إن كان لك حساب. وإن لم تكن سجّلت في شعبة بعد، فابدأ بالتشخيص
          ليُقترح عليك مسار، أو تصفّح الشعب المفتوحة واطلب التسجيل.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth" className="rounded-full bg-teal px-6 py-3 font-black text-on-teal hover:bg-teal-light">
            تسجيل الدخول
          </Link>
          <Link to="/diagnostic" className="rounded-full border border-white/15 px-6 py-3 font-bold text-white/80 hover:border-white/40">
            ابدأ بالتشخيص
          </Link>
        </div>
        {/* تعريف المنظومة عند مدخل البوابة — سطر ثقة ثانوي لا ينافس الرسالة */}
        <EcosystemNote className="mt-10" />
      </div>
    );
  }

  /* ١أ — التنقّل حول سؤال المتعلم لا حول جداول قاعدة البيانات.
     كانت ثلاثة عشر تبويبا في صفٍّ واحد: خمسة على سطح المكتب وثمانية تحت
     «المزيد»، وأربعة على الجوال وتسعة تحت «المزيد». وأربعةٌ منها — تعلّمي
     ومساري ومهاراتي ومراجعتي — تجيب عن سؤال واحد: «أين أنا من هدفي؟» فلم
     يكن يُفرَّق بينها. صارت ثلاثة أقسام لكلٍّ سؤالُه، وما تحتها تنقّلٌ ثانوي
     داخل القسم لا في الشريط الأعلى. والمساراتُ كلها كما هي — لا صفحة تُحذف
     ولا عنوانٌ يتغيّر؛ هذه الدفعة تنقّلٌ فقط. */
  const sections: Section[] = [
    { id: "home", label: "الرئيسية", icon: LayoutDashboard, to: "/student", end: true, items: [], match: ["/student"] },
    {
      id: "learn", label: "تعلّمي", icon: BookOpen, to: "/student/learning",
      items: [
        { to: "/student/learning", label: "دوراتي" },
        { to: "/student/pathway", label: "مساري" },
        { to: "/student/review", label: "مراجعتي" },
        { to: "/student/cohorts", label: "الشعب المفتوحة" },
      ],
      /* صفحتا الدورة وإعادة القياس تتبعان القسم وإن لم تكونا في شريطه */
      match: ["/student/learning", "/student/pathway", "/student/review", "/student/cohorts", "/student/course", "/student/remeasure"],
    },
    {
      id: "vault", label: "خزانتي", icon: Award, to: "/student/certificates",
      items: [
        { to: "/student/vault", label: "نواتجي" },
        { to: "/student/certificates", label: "شهاداتي" },
        { to: "/student/cv", label: "سيرتي" },
        { to: "/student/skills", label: "مهاراتي" },
      ],
      match: ["/student/vault", "/student/certificates", "/student/cv", "/student/skills"],
    },
  ];
  /* القسم النشط: «الرئيسية» بمطابقة تامة، وغيرُها ببادئة المسار */
  const activeSection =
    pathname === "/student"
      ? sections[0]
      : sections.find((sec) => sec.id !== "home" && sec.match.some((m) => pathname.startsWith(m)));
  const accountActive = ACCOUNT_ITEMS.some((a) => pathname.startsWith(a.to));

  return (
    <div dir="rtl" className="min-h-screen bg-paper text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 object-contain" />
            <span className="hidden font-black sm:block">أكاديمية وجيز</span>
          </Link>
          <nav aria-label="أقسام المنصة" className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 md:flex">
            {sections.map((sec) => (
              <Link
                key={sec.id}
                to={sec.to}
                aria-current={activeSection?.id === sec.id ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  activeSection?.id === sec.id ? "bg-teal text-on-teal" : "text-white/60 hover:text-white"
                }`}
              >
                <sec.icon className="h-3.5 w-3.5" />
                {sec.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-xs text-white/55">
            {/* جرس الإشعارات */}
            <div className="relative">
              <button
                onClick={() => setBellOpen((v) => !v)}
                aria-label="الإشعارات"
                className="relative grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-white/10 text-white/45 transition hover:border-teal-light/50 hover:text-teal-light-ink"
              >
                <Bell className="h-3.5 w-3.5" />
                {unreadCount > 0 && (
                  <span className="absolute -left-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[9px] font-black text-on-gold">{unreadCount}</span>
                )}
              </button>
              {bellOpen && (
                <>
                  <button aria-label="إغلاق الإشعارات" onClick={() => setBellOpen(false)} className="fixed inset-0 z-40 cursor-default" />
                  <div className="absolute left-0 top-10 z-50 w-80 max-w-[85vw] rounded-2xl border border-white/10 bg-surface p-3 shadow-2xl">
                    <div className="flex items-center justify-between px-1 pb-2">
                      <p className="text-xs font-black text-white/80">الإشعارات</p>
                      <button onClick={markAllRead} className="flex cursor-pointer items-center gap-1 text-[10px] font-bold text-teal-light-ink transition hover:text-white">
                        <CheckCheck className="h-3 w-3" /> تعليم الكل كمقروء
                      </button>
                    </div>
                    <div className="max-h-72 space-y-1.5 overflow-y-auto">
                      {realNotifs ? (
                        <>
                          {realNotifs.length === 0 && <p className="px-2 py-6 text-center text-[11px] text-white/55">لا إشعارات بعد</p>}
                          {realNotifs.map((n) => (
                            <button key={n.id} onClick={() => markOneRead(n.id)}
                              className={`block w-full cursor-pointer rounded-xl border px-3 py-2 text-right text-[11px] leading-5 ${n.status === "read" ? "border-white/5 text-white/50" : "border-teal/25 bg-teal/5 text-white/75"}`}>
                              <span className="block font-bold">{n.title}</span>
                              {n.body}
                            </button>
                          ))}
                        </>
                      ) : (
                        /* تعذّر نداء الخادم — لا بديل محليّ يُعرض */
                        <p className="px-2 py-6 text-center text-[11px] text-white/55">تعذّر جلب إشعاراتك الآن</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <ThemeToggle />
            {/* قائمة الحساب — شؤون الحساب كلها هنا لا تبويباتٍ في شريط التعلّم.
                وفيها زرُّ الخروج نصّا صريحا: كان أيقونةَ سهمٍ في الشريط. */}
            <div className="relative hidden md:block">
              <button
                onClick={() => setAccountOpen((v) => !v)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className={`flex h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-bold transition ${
                  accountActive || accountOpen ? "border-teal/50 bg-teal/10 text-teal-light-ink" : "border-white/10 text-white/60 hover:border-white/25 hover:text-white"
                }`}
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-teal/20 text-[11px] font-black text-teal-light-ink">
                  {user.trim().charAt(0) || "و"}
                </span>
                <span className="max-w-[90px] truncate">{user.split(" ")[0]}</span>
                <ChevronDown className={`h-3 w-3 transition ${accountOpen ? "rotate-180" : ""}`} />
              </button>
              {accountOpen && (
                <>
                  <button aria-label="إغلاق قائمة الحساب" onClick={() => setAccountOpen(false)} className="fixed inset-0 z-40 cursor-default" />
                  <div role="menu" className="absolute left-0 top-14 z-50 w-60 rounded-2xl border border-white/10 bg-surface p-2 shadow-2xl">
                    <p className="px-3 pb-2 pt-1 text-[11px] text-white/45">{user}</p>
                    {ACCOUNT_ITEMS.map((a) => (
                      <NavLink
                        key={a.to}
                        to={a.to}
                        onClick={() => setAccountOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                            isActive ? "bg-teal/15 text-teal-light-ink" : "text-white/65 hover:bg-white/[0.04] hover:text-white"
                          }`
                        }
                      >
                        <a.icon className="h-4 w-4" />
                        {a.label}
                      </NavLink>
                    ))}
                    <div className="my-1.5 border-t border-white/10" />
                    <button
                      onClick={doSignOut}
                      disabled={signingOut}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-white/65 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-60"
                    >
                      <LogOut className="h-4 w-4" />
                      {signingOut ? "يُسجَّل الخروج…" : "تسجيل الخروج"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      {/* ب-٢: حاوية تخطيط لا منطقة landmark — منطقة main واحدة في التطبيق
                (App.tsx) وهي هدف رابط «تجاوز إلى المحتوى». main متداخلة تجعل
                التخطي غامضا وتُجبر قارئ الشاشة على الاختيار بين منطقتين. */}
      <div className="mx-auto max-w-6xl px-5 py-8 pb-28 md:pb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black">{title}</h1>
        </div>
        {/* التنقّل الثانوي داخل القسم — صفحاتُه هنا لا في الشريط الأعلى.
            يُمرَّر أفقيا داخل حاويته وحدها كي لا تُمرَّر الصفحة كلها (ت-٤). */}
        {activeSection && activeSection.items.length > 0 && (
          <nav aria-label={`صفحات ${activeSection.label}`} className="-mx-1 mb-6 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {activeSection.items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) =>
                  `shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold transition ${
                    isActive ? "border-teal/60 bg-teal/15 text-teal-light-ink" : "border-white/10 text-white/55 hover:border-white/30 hover:text-white"
                  }`
                }
              >
                {it.label}
              </NavLink>
            ))}
          </nav>
        )}
        {children}
      </div>
      {/* تعريف المنظومة — تذييل ثقة خفيف داخل البوابة (يظهر مرة واحدة أسفل المحتوى) */}
      <EcosystemNote className="mx-auto max-w-6xl px-5 pb-24 md:pb-6" />
      {/* شريط الجوال: ثلاثة أقسام + الحساب — أربع خانات بلا «المزيد».
          كان خمسَ خاناتٍ رابعُها «مهاراتي» وتحت «المزيد» تسعُ صفحات مخبّأة. */}
      <nav aria-label="أقسام المنصة" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 bg-paper/95 pb-[max(env(safe-area-inset-bottom),0.25rem)] backdrop-blur-xl md:hidden">
        {sections.map((sec) => (
          <Link
            key={sec.id}
            to={sec.to}
            aria-current={activeSection?.id === sec.id ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition ${
              activeSection?.id === sec.id ? "text-teal-light-ink" : "text-white/50"
            }`}
          >
            <sec.icon className="h-5 w-5" />
            {sec.label}
          </Link>
        ))}
        <button
          onClick={() => setAccountOpen(true)}
          aria-expanded={accountOpen}
          className={`flex cursor-pointer flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition ${
            accountActive ? "text-teal-light-ink" : "text-white/50"
          }`}
        >
          <UserCircle className="h-5 w-5" />
          حسابي
        </button>
      </nav>

      {/* ورقة الحساب للجوال — نفس عناصر قائمة سطح المكتب */}
      {accountOpen && (
        <>
          <button aria-label="إغلاق قائمة الحساب" onClick={() => setAccountOpen(false)} className="fixed inset-0 z-50 cursor-default bg-black/60 backdrop-blur-sm md:hidden" />
          <div dir="rtl" className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-white/10 bg-surface p-5 pb-[max(env(safe-area-inset-bottom),1rem)] md:hidden">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-black">{user}</p>
              <button onClick={() => setAccountOpen(false)} aria-label="إغلاق" className="cursor-pointer text-white/50 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-1.5">
              {ACCOUNT_ITEMS.map((a) => (
                <NavLink
                  key={a.to}
                  to={a.to}
                  onClick={() => setAccountOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                      isActive ? "border-teal/50 bg-teal/10 text-teal-light-ink" : "border-white/10 text-white/70 hover:border-white/25"
                    }`
                  }
                >
                  <a.icon className="h-4 w-4" />
                  {a.label}
                </NavLink>
              ))}
              <button
                onClick={doSignOut}
                disabled={signingOut}
                className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-white/70 transition hover:border-red-400/50 hover:text-red-300 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                {signingOut ? "يُسجَّل الخروج…" : "تسجيل الخروج"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
