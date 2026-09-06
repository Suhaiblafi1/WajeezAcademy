import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { LayoutDashboard, Award, Lock, LogOut, Bell, CheckCheck, UserCircle, ReceiptText, X, LifeBuoy, BookOpen, ChevronDown, Inbox, Library } from "lucide-react";
import { signOut } from "@/services/auth";
import { apiGet, apiPost } from "@/services/api";
import { useRealSession } from "@/services/session";
import { useAutoRefresh } from "@/services/useAutoRefresh";
import ThemeToggle from "@/components/ThemeToggle";
import EcosystemNote from "@/components/EcosystemNote";
import VerifyEmailNotice from "@/components/VerifyEmailNotice";
import { usePublishedContent } from "@/services/public-content";
import { getLibraryResources } from "@/data/core-catalog-source";

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
   اليسار، كما في المنصّات التي يعرفها المتعلم.

   ═══ وبابٌ واحدٌ للرسائل، باسمٍ يقول ما فيه ═══

   كان هنا **صندوقان**: «صندوقي» يجمع التنبيهاتَ وتعليقاتِ المدرّب وملاحظاتِ
   التسليم وردودَ الدعم، و«الإشعارات» تعرض التنبيهاتَ وحدَها — أي جزءا من
   الأوّل. ومعهما جرسٌ في الشريط يعرضها ثالثةً. فثلاثةُ أبوابٍ لشيءٍ واحد،
   واختيارُ البابِ صار قرارا على المتعلّم أن يتّخذه قبل أن يقرأ رسالة.

   فبقي بابٌ واحد. وصفحةُ التنبيهات وحدَها باقيةٌ على مسارها — لا رابطَ
   يُكسَر — ويقود إليها الجرسُ نفسُه. */
const ACCOUNT_ITEMS: { to: string; label: string; icon: typeof LayoutDashboard }[] = [
  { to: "/student/account", label: "الملف الشخصي", icon: UserCircle },
  { to: "/student/billing", label: "فواتيري", icon: ReceiptText },
  { to: "/student/inbox", label: "الرسائل والتنبيهات", icon: Inbox },
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
  const { user: sessionUser, checked: sessionChecked, emailChannel } = useRealSession();
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
    apiGet<RealNotif[]>("/api/learner/notifications?audience=learner").then((rows) => setRealNotifs(rows.slice(0, 6))).catch(() => setRealNotifs(null));
  }, []);

  /* عداد الخادم الرسمي للشارة — يُفضَّل على الحساب المحلي، ويُحدَّث كل دقيقة */
  const [serverUnread, setServerUnread] = useState<number | null>(null);
  const refreshUnread = useCallback(() => {
    apiGet<{ unread: number }>("/api/learner/notifications/unread-count?audience=learner")
      .then((r) => setServerUnread(r.unread))
      .catch(() => setServerUnread(null));
  }, []);
  useEffect(() => { refreshUnread(); }, [refreshUnread]);
  useAutoRefresh(refreshUnread, 60_000);

  const unreadCount = serverUnread ?? (realNotifs?.filter((n) => n.status !== "read").length ?? 0);

  /* عدد موادّ المكتبة المنشورة — من لقطة الكتالوج العامة نفسها التي تقرأها
     صفحة المكتبة، فلا يظهر التبويب ثم تُفتح صفحةٌ فارغة. */
  usePublishedContent();
  const libraryCount = getLibraryResources().length;

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
      <div dir="rtl" className="grid min-h-screen place-items-center bg-paper text-foreground">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#38A7B4]" aria-label="يُحمَّل" />
      </div>
    );
  }

  /* حسابٌ وظيفيّ بلا بوابة تعلّم — يُقال له لماذا، لا يُترك أمام خطأٍ عامّ.

     الشريط يعرض «تعلّمي» و«خزانتي» لكلّ من دخل، والخادم يردّ ٤٠٣ «لا تملك
     الصلاحية المطلوبة» لمن لا يحمل `learner`. فيقرأ صاحب الحساب رسالةً
     لا تخصّه ويظنّ الموقع معطوبا — وقع هذا لصاحب المنصّة نفسه. والسبب
     ليس عطبا: حسابُه إداريّ بلا دور متعلّم، وهذا اختيارٌ مشروع. */
  if (sessionChecked && sessionUser && !sessionUser.permissions.includes("learner.portal")) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-foreground">
        <Lock className="h-12 w-12 text-muted-foreground/50" />
        <h1 className="mt-5 text-2xl font-black">هذا حسابٌ وظيفيّ — لا بوابة تعلّم له</h1>
        <p className="mt-3 max-w-md text-center text-sm leading-7 text-muted-foreground">
          حسابك <span className="font-bold text-foreground">{sessionUser.email}</span> يحمل
          {" "}{sessionUser.roles.length === 1 ? "دورا وظيفيّا" : "أدوارا وظيفيّة"} بلا دور «متعلّم»،
          وبوابة التعلّم تُفتح بذلك الدور. أضِفه للحساب من إدارة المستخدمين إن أردتَ أن
          تتعلّم به أيضا — أو ادخل ببوابتك الوظيفيّة.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link to="/admin" className="rounded-full bg-teal px-6 py-3 font-black text-on-teal hover:bg-teal-light">
            بوابتي الوظيفيّة
          </Link>
          <Link to="/" className="rounded-full border border-white/15 px-6 py-3 font-bold text-foreground hover:border-white/40">
            الصفحة الرئيسة
          </Link>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-foreground">
        <Lock className="h-12 w-12 text-[#FABC05]" />
        <h1 className="mt-5 text-2xl font-black">منصتك تُفتح بحسابك</h1>
        <p className="mt-3 max-w-md text-center text-sm leading-7 text-muted-foreground">
          سجّل دخولك إن كان لك حساب. وإن لم تكن سجّلت في شعبة بعد، فابدأ بالتشخيص
          ليُقترح عليك مسار، أو تصفّح الشعب المفتوحة واطلب التسجيل.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth" className="rounded-full bg-teal px-6 py-3 font-black text-on-teal hover:bg-teal-light">
            تسجيل الدخول
          </Link>
          <Link to="/diagnostic" className="rounded-full border border-white/15 px-6 py-3 font-bold text-foreground hover:border-white/40">
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
      /* «دوراتي» و«مساري» كانتا تبويبين متجاورين يجيبان عن سؤالٍ واحد —
         وهو التشتّتُ الذي شُكي منه: «حاول أن تجد حلا للتشتّت الذي يصيب
         الطلبة بوجود خانة دورات وخانة مسارات؟؟». فصارتا «رحلتي»: شريطُ
         مراحلَ واحد، وعملُ المرحلة أسفلَه، ومبدّلُ مساراتٍ عند تعدّدها. */
      items: [
        { to: "/student/learning", label: "رحلتي" },
        /* «مراجعتي» كانت اسمَ صفحةِ الاسترجاع المتباعد — و«مراجعة» في
           المنصّة ثلاثةُ معانٍ: مراجعةُ المحتوى عند الموظّف، ومراجعةُ تعليقِ
           التقييم، وهذه. والمتعلّمُ يقرؤها «ما سأراجعه» أو «رأيي»، لا
           «تدريبا على التذكّر». فالاسمُ يقول الغرض. */
        { to: "/student/review", label: "تثبيتُ ما تعلّمت" },
      ],
      /* صفحتا الوحدة وإعادة القياس تتبعان القسم وإن لم تكونا في شريطه */
      match: ["/student/learning", "/student/pathway", "/student/review", "/student/course", "/student/remeasure"],
    },
    {
      id: "vault", label: "خزانتي", icon: Award, to: "/student/certificates",
      items: [
        /* «ناتج» مصطلحٌ داخليّ: مخرَجُ النشاطِ في الوحدة. والمتعلّمُ يسمّيه عملَه. */
        { to: "/student/vault", label: "أعمالي" },
        { to: "/student/certificates", label: "شهاداتي" },
        { to: "/student/cv", label: "سيرتي" },
        { to: "/student/skills", label: "مهاراتي" },
        /* «تقييمي» كان يعني رأيَه في مدرّبه — و«تقييم» في المنصّة يعني أيضا
           الواجبَ والاختبارَ والدرجة. فمن رآها بين «مهاراتي» و«شهاداتي»
           قرأها «درجاتي». والاسمُ يقول من يُقيَّم. */
        { to: "/student/rate", label: "رأيي في التدريب" },
      ],
      match: ["/student/vault", "/student/certificates", "/student/cv", "/student/skills", "/student/rate"],
    },
  ];
  /* ١د — المكتبة قسمٌ رابع، ولا يظهر إلا حين تكون فيه مادّة منشورة.
     تبويبٌ يَعِد بمكتبة ثم يفتح على فراغ أسوأ من غيابه: المتعلم ينقره مرة
     ثم يتعلّم ألّا يثق بالشريط كله. */
  if (libraryCount > 0) {
    sections.push({
      id: "library", label: "المكتبة", icon: Library, to: "/student/library",
      items: [], match: ["/student/library"],
    });
  }
  /* القسم النشط: «الرئيسية» بمطابقة تامة، وغيرُها ببادئة المسار */
  const activeSection =
    pathname === "/student"
      ? sections[0]
      : sections.find((sec) => sec.id !== "home" && sec.match.some((m) => pathname.startsWith(m)));
  const accountActive = ACCOUNT_ITEMS.some((a) => pathname.startsWith(a.to));

  return (
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 shrink-0 object-contain" />
            <span className="hidden font-black sm:block">أكاديمية وجيز</span>
          </Link>
          <nav aria-label="أقسام المنصة" className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 md:flex">
            {sections.map((sec) => (
              <Link
                key={sec.id}
                to={sec.to}
                aria-current={activeSection?.id === sec.id ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  activeSection?.id === sec.id ? "bg-teal text-on-teal" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <sec.icon className="h-3.5 w-3.5" />
                {sec.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {/* جرس الإشعارات */}
            <div className="relative">
              <button
                onClick={() => setBellOpen((v) => !v)}
                aria-label="الإشعارات"
                className="relative grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-white/10 text-muted-foreground transition hover:border-teal-light/50 hover:text-teal-light-ink"
              >
                <Bell className="h-3.5 w-3.5" />
                {unreadCount > 0 && (
                  <span className="absolute -left-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-micro font-black text-on-gold">{unreadCount}</span>
                )}
              </button>
              {bellOpen && (
                <>
                  <button aria-label="إغلاق الإشعارات" onClick={() => setBellOpen(false)} className="fixed inset-0 z-40 cursor-default" />
                  <div className="absolute left-0 top-10 z-50 w-80 max-w-[85vw] rounded-2xl border border-white/10 bg-surface p-3 shadow-2xl">
                    <div className="flex items-center justify-between px-1 pb-2">
                      <p className="text-xs font-black text-foreground">التنبيهات</p>
                      <button onClick={markAllRead} className="flex cursor-pointer items-center gap-1 text-micro font-bold text-teal-light-ink transition hover:text-foreground">
                        <CheckCheck className="h-3 w-3" /> تعليم الكل كمقروء
                      </button>
                    </div>
                    <div className="max-h-72 space-y-1.5 overflow-y-auto">
                      {realNotifs ? (
                        <>
                          {realNotifs.length === 0 && <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">لا إشعارات بعد</p>}
                          {realNotifs.map((n) => (
                            <button key={n.id} onClick={() => markOneRead(n.id)}
                              className={`block w-full cursor-pointer rounded-xl border px-3 py-2 text-right text-[11px] leading-5 ${n.status === "read" ? "border-white/5 text-muted-foreground" : "border-teal/25 bg-teal/5 text-foreground"}`}>
                              <span className="block font-bold">{n.title}</span>
                              {n.body}
                            </button>
                          ))}
                        </>
                      ) : (
                        /* تعذّر نداء الخادم — لا بديل محليّ يُعرض */
                        <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">تعذّر جلب إشعاراتك الآن</p>
                      )}
                    </div>
                    {/* والجرسُ لا ينتهي عند ستّة: يقود إلى البابِ الواحد الذي
                        يجمع التنبيهاتَ وتعليقاتِ المدرّب وردودَ الدعم. */}
                    <Link
                      to="/student/inbox"
                      onClick={() => setBellOpen(false)}
                      className="mt-2 block rounded-xl border border-white/10 px-3 py-2 text-center text-[11px] font-bold text-teal-light-ink transition hover:border-white/30"
                    >
                      افتح «الرسائل والتنبيهات»
                    </Link>
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
                  accountActive || accountOpen ? "border-teal/50 bg-teal/10 text-teal-light-ink" : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground"
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
                    <p className="px-3 pb-2 pt-1 text-[11px] text-muted-foreground">{user}</p>
                    {ACCOUNT_ITEMS.map((a) => (
                      <NavLink
                        key={a.to}
                        to={a.to}
                        onClick={() => setAccountOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                            isActive ? "bg-teal/15 text-teal-light-ink" : "text-foreground hover:bg-white/[0.04] hover:text-foreground"
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
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-foreground transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-60"
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
        {/* ١هـ — يظهر لغير الموثَّق وحده، ويزول بمجرّد التوثيق.

            ولا يُعرض والقناةُ مغلقة: الحاجزُ غيرُ مفروضٍ حينها (الخادمُ يُسقطه)،
            وزرُّ الإرسال لا يمكن أن ينجح. فالشريطُ يصير تحذيرا من قيدٍ لا وجودَ
            له، ودعوةً إلى فعلٍ لا يقع. */}
        {sessionUser && !sessionUser.emailVerified && emailChannel !== false && (
          <VerifyEmailNotice email={sessionUser.email} className="mb-6" />
        )}
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
                    isActive ? "border-teal/60 bg-teal/15 text-teal-light-ink" : "border-white/10 text-muted-foreground hover:border-white/30 hover:text-foreground"
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
      <nav aria-label="أقسام المنصة" className={`fixed inset-x-0 bottom-0 z-40 grid ${sections.length >= 4 ? "grid-cols-5" : "grid-cols-4"} border-t border-white/10 bg-paper/95 pb-[max(env(safe-area-inset-bottom),0.25rem)] backdrop-blur-xl md:hidden`}>
        {sections.map((sec) => (
          <Link
            key={sec.id}
            to={sec.to}
            aria-current={activeSection?.id === sec.id ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-2.5 text-micro font-bold transition ${
              activeSection?.id === sec.id ? "text-teal-light-ink" : "text-muted-foreground"
            }`}
          >
            <sec.icon className="h-5 w-5" />
            {sec.label}
          </Link>
        ))}
        <button
          onClick={() => setAccountOpen(true)}
          aria-expanded={accountOpen}
          className={`flex cursor-pointer flex-col items-center gap-1 py-2.5 text-micro font-bold transition ${
            accountActive ? "text-teal-light-ink" : "text-muted-foreground"
          }`}
        >
          <UserCircle className="h-5 w-5" />
          حسابي
        </button>
      </nav>

      {/* ورقة الحساب للجوال — نفس عناصر قائمة سطح المكتب */}
      {accountOpen && (
        <>
          <button aria-label="إغلاق قائمة الحساب" onClick={() => setAccountOpen(false)} className="fixed inset-0 z-50 cursor-default bg-paper/60 backdrop-blur-sm md:hidden" />
          <div dir="rtl" className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-white/10 bg-surface p-5 pb-[max(env(safe-area-inset-bottom),1rem)] md:hidden">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-black">{user}</p>
              <button onClick={() => setAccountOpen(false)} aria-label="إغلاق" className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-1.5">
              {ACCOUNT_ITEMS.map((a) => (
                <NavLink
                  key={a.to}
                  to={a.to}
                  onClick={() => setAccountOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                      isActive ? "border-teal/50 bg-teal/10 text-teal-light-ink" : "border-white/10 text-foreground hover:border-white/25"
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
                className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-foreground transition hover:border-red-400/50 hover:text-red-300 disabled:opacity-60"
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
