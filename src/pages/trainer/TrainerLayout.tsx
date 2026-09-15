import { Link, NavLink } from "react-router";
import { Award, BookPlus, CalendarDays, ClipboardCheck, GraduationCap, LayoutDashboard, Link2, Route, Star, Users, Wallet } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import SearchChip from "@/components/SearchChip";
import ThemeToggle from "@/components/ThemeToggle";
import StaffAccountMenu from "@/components/StaffAccountMenu";
import PortalSearchPalette from "@/components/PortalSearchPalette";
import { useRealSession } from "@/services/session";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadMyPortals } from "@/services/portals";
import { apiGet } from "@/services/api";
import { GRADING_CHANGED } from "@/services/grading-signal";

/** إطار بوابة المدرب: هويته من جلسته وحدها. */
export default function TrainerLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const { user, checked } = useRealSession();
  /* الصلاحيّةُ تكفي للدخول، ولا تكفي للعمل: مديرُ النظام يملكها بلا ملفٍّ في
     هذه البوّابة، فكانت كلُّ شاشةٍ تسقط وحدَها بـ«لا ملف مدرب مرتبطا بهذا
     الحساب». فيُسأل مرّةً هنا، ويُقال مرّةً واحدة. */
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void loadMyPortals().then((p) => { if (alive) setHasProfile(p.trainer); });
    return () => { alive = false };
  }, []);

  /* ---- عددُ ما ينتظر تصحيحَه، في القائمة نفسِها ----

     كان المدرّبُ لا يعرف أنّ أحدا ينتظره حتّى يفتح الطابورَ بيده. والرقمُ
     هنا أنفعُ من إشعارٍ: يُرى بلا فتحِ شيء، ويبقى ما بقي العمل، ويصير صفرا
     وحدَه حين يفرغ. والسقوطُ يُبتلع — عدّادٌ لم يصل لا يمنع أحدا من عمله. */
  const [pending, setPending] = useState(0);
  /* والعددُ يُعاد جلبُه بعد فعلِ المدرّب لا بإعادة تحميل الصفحة: كان يقبل
     آخرَ تسليمٍ فيصير المتنُ «الطابورُ نظيف» والشارةُ فوقه «١». والإطارُ
     لا يرى ما يفعله ابنُه، فيسمع إشارتَه (`GRADING_CHANGED`). */
  const refreshPending = useCallback(() => {
    void apiGet<{ pendingGrading?: number }>("/api/trainer/me")
      .then((me) => setPending(me.pendingGrading ?? 0))
      .catch(() => { /* لا رقمَ خيرٌ من رقمٍ كاذب */ });
  }, []);
  useEffect(() => {
    refreshPending();
    window.addEventListener(GRADING_CHANGED, refreshPending);
    return () => window.removeEventListener(GRADING_CHANGED, refreshPending);
  }, [refreshPending]);
  const realTrainer = user?.permissions.includes("trainer.portal") ?? false;

  /* ═══ ارتفاعُ الشريط يُقاس ويُنشَر — فوق كلّ عودةٍ مبكّرة ═══

     شاشاتٌ تحت هذا الشريط تُلصِق رؤوسَها (`sticky`)، فتحتاج أن تعرف أين
     ينتهي هو. ورقمٌ مكتوبٌ بيدٍ في كلٍّ منها يفترق عنه عند أوّل تبديل:
     الشريطُ يلفّ سطرَه على الهاتف فيطول، ويقصر على الحاسوب، ويتبدّل
     بمعامل التكبير `--app-scale`. فيُقاس بـ`ResizeObserver` ويُنشَر
     متغيّرا واحدا على الجذر تقرؤه من شاءت.

     وموضعُه هنا لا قبل `return` الأخيرة: تحتها ثلاثُ عوداتٍ مبكّرة
     (لم يُفحَص بعد · لا ملفَّ مدرّبٍ له · لا صلاحيّةَ)، فخطّافٌ بعدها
     يُنادى في تصييرٍ ولا يُنادى في آخر — وذاك ما ردّه `rules-of-hooks`.

     و`headerRef` فارغٌ في تلك العودات، فالخطّافُ يخرج بلا عمل. */
  const headerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const publish = () => {
      document.documentElement.style.setProperty("--staff-sticky-top", `${Math.round(el.getBoundingClientRect().height)}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty("--staff-sticky-top"); };
  }, [checked, hasProfile, realTrainer]);


  if (!checked) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-paper text-foreground">
        <GraduationCap className="h-10 w-10 animate-pulse text-[#6EC7D1]" />
      </div>
    );
  }

  /* حُذفت شاشة «من أنت؟» التي كانت تعرض أربعة أسماء مدرّبين مختلَقة ليختار
     الزائر واحدا منها فيدخل البوابة بهويته. أسماءُ أشخاصٍ لا وجود لهم تُعرض
     كمدرّبين — وقاعدةُ هذا المستودع صريحة: لا اسم مدرّب قبل توثيقه. */
  if (!realTrainer) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-foreground">
        <GraduationCap className="h-12 w-12 text-[#6EC7D1]" />
        <h1 className="mt-5 text-2xl font-black">بوابة المدرب</h1>
        <p className="mt-2 max-w-md text-center text-sm leading-7 text-muted-foreground">
          تُفتح هذه البوابة بحساب مدرّب معتمد. إن كنت مدرّبا فسجّل الدخول،
          وإن أردت الانضمام إلى فريق التدريب فابدأ بطلب العضوية.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth" className="rounded-full bg-teal px-6 py-3 font-black text-on-teal transition hover:bg-teal-light">
            تسجيل الدخول
          </Link>
          <Link to="/join-trainer" className="rounded-full border border-white/15 px-6 py-3 font-bold text-foreground hover:border-white/40">
            انضم مدرّبا
          </Link>
        </div>
        <Link to="/" className="mt-6 text-xs text-muted-foreground hover:text-foreground">العودة للموقع العام</Link>
      </div>
    );
  }

  /* «شعبي وجلساتها» دخلت التبويبات — وهي ورشةُ عمله الفعليّة (الحضور والمواد
     والتكليفات والدرجات) ولم تكن فيها، فلا يبلغها إلا من يكتب مسارها بيده. */
  const tabs = [
    { to: "/trainer", label: "الرئيسية", icon: LayoutDashboard, end: true },
    { to: "/trainer/board", label: "شعبي", icon: Users },
    { to: "/trainer/learners", label: "طلبتي", icon: GraduationCap },
    { to: "/trainer/grading", label: "طابور التقييم", icon: ClipboardCheck, count: pending },
    { to: "/trainer/schedule", label: "جدولي", icon: CalendarDays },
    { to: "/trainer/qualifications", label: "مؤهّلاتي وإتاحتي", icon: Award },
    /* ح-٢: بعد «مؤهّلاتي» — السؤالان جارانِ: ما أُهِّلتُ له، وما أقترحه ولم
       يدخل الكتالوجَ بعد. وقرارُ الإدارة يصل هنا، فلا يُدفن في صفحةٍ طويلة. */
    { to: "/trainer/course-proposals", label: "دوراتي المقترحة", icon: BookPlus },
    /* ن-١: بعد «دوراتي المقترحة» — الأولى دوراتٌ ليست عندنا، وهذه ترتيبُ
       ما عندنا في مسارٍ باسمه. والسؤالان متجاوران في ذهنه. */
    { to: "/trainer/paths", label: "مساراتي", icon: Route },
    { to: "/trainer/earnings", label: "مستحقاتي", icon: Wallet },
    { to: "/trainer/ratings", label: "ما قيل عنّي", icon: Star },
    /* ب-٥: بعد «ما قيل عنّي» مباشرةً — قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦) */
    { to: "/trainer/referral", label: "دعوتي", icon: Link2 },
  ];

  /* له الصلاحيّةُ ولا ملفَّ له: شاشةٌ واحدةٌ تشرح، بدل عشرِ شاشاتٍ تسقط */
  if (realTrainer && hasProfile === false) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-foreground">
        <GraduationCap className="h-12 w-12 text-[#6EC7D1]" />
        <h1 className="mt-5 text-2xl font-black">بوّابة المدرّب</h1>
        <p className="mt-2 max-w-md text-center text-sm leading-7 text-muted-foreground">
          حسابُك يملك صلاحيّاتِ المدرّب، لكن لا ملفَّ مدرّبٍ مرتبطا به — والشعبُ والتقييماتُ والمستحقّاتُ كلُّها تُقرأ من ذلك الملفّ. فلا شيءَ هنا لنعرضه لك.
        </p>
        <p className="mt-3 max-w-md text-center text-read leading-6 text-muted-foreground">
          وهذا متوقَّعٌ لمدير النظام: بوّابةُ المدرّب لمن يُدرِّس فعلا. لمعاينتها، ادخل بحساب مدرّب.
        </p>
        <Link to="/admin" className="mt-7 rounded-full border border-white/15 px-6 py-3 font-bold text-foreground transition hover:border-white/40">
          عُد إلى لوحة الإدارة
        </Link>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      {/* ═══ ارتفاعُ الشريط يُقاس ويُنشَر — لا يُخمَّن رقما في مكانٍ آخر ═══

          شاشاتٌ تحت هذا الشريط تُلصِق رؤوسَها (`sticky`)، فتحتاج أن تعرف
          أين ينتهي هو. ورقمٌ مكتوبٌ بيدٍ في كلّ واحدةٍ منها يفترق عنه عند
          أوّل تبديلٍ هنا: الشريطُ يلفّ سطرَه على الهاتف فيطول، ويقصر على
          الحاسوب، ويتبدّل بمعامل التكبير `--app-scale`.

          فيُقاس بـ`ResizeObserver` ويُنشَر متغيّرا واحدا على الجذر تقرؤه
          من شاءت. ولو لم يُقَس بقي `0px` — فالرأسُ يلتصق بأعلى الإطار، وهو
          أسوأُ عرضا لا شاشةٌ مكسورة. */}
      <header ref={headerRef} className="sticky top-0 z-40 border-b border-white/10 bg-paper/90 backdrop-blur">
        {/* ── الشريطُ يأخذ سطرَه ──

            كان تسعةَ رموزٍ **بلا كلمة** بعرض ٣٩٠: النصُّ `hidden sm:inline`،
            فيصير كلُّ عنصرٍ ٣٨×٤٤ بكسلا يُميَّز بالرمز وحدَه. والعرضُ فوق ٢٤
            التي تشترطها WCAG 2.5.8 فليس مخالفةً — لكنّ تسعةَ أهدافٍ متشابهةٍ
            بلا اسمٍ ليست تنقّلا، والمراجعُ توصي بخمسةٍ فأقلَّ في شريطٍ أوّل.

            والجوابُ الأسماءُ لا الحذف: تسعةُ تبويباتٍ كلُّها عملٌ يفعله
            المدرّب، ومن حذف منها أخفى عملا لا زحاما.

            **وامتدادٌ أفقيٌّ كان قبل هذا ولم يره التقرير:** التسعةُ بأسمائها
            ٨٦٧ بكسلا في صفٍّ واحدٍ مع الشعار والأدوات، فكانت `body.scrollWidth`
            تفوق إطارَ العرض عند ٣٩٠ و٨٢٠ و١٤٤٠ **جميعا** (قِيس بالمتصفّح).
            ويشتدّ على الحاسوب بمعامل التكبير ١٫٣ (`--app-scale` في `#80`):
            إطارُ ١٤٤٠ يصير ١١٠٨ فعليّا، فلا يتّسع الصفُّ لثلاثةٍ منها.

            فالشريطُ يأخذ سطرَه في كلّ المقاسات — عرضُ الحاوية كلِّه لا فضلةُ
            ما تركه الشعارُ والأدوات. وهو أصدقُ من صفٍّ يُخفي ثلاثةَ تبويباتٍ
            خلف تمريرٍ بلا علامةٍ تدلّ عليه. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-5 py-2">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 shrink-0 object-contain" />
            <span className="hidden font-black sm:block">وجيز — بوابة المدرب</span>
          </Link>
          <nav className="scrollbar-hide order-last flex w-full items-center justify-start gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.03] p-1">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  /* `shrink-0` كي لا ينضغط النصُّ حين يُمرَّر الشريط،
                     و`min-h-11` هدفُ لمسٍ مريحٌ على الهاتف. */
                  `flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition sm:px-4 ${
                    isActive ? "bg-teal text-on-teal" : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                <t.icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
                {/* العددُ يُقرأ للعين وللقارئ معا: الرقمُ وحدَه لا يقول ماذا يعدّ */}
                {!!t.count && (
                  <span className="rounded-full bg-gold px-1.5 text-fine font-black text-on-gold">
                    <span className="sr-only">ينتظر تصحيحَك: </span>{t.count}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {/* بحث سريع Ctrl+K — لجلسة المدرب الحقيقية فقط: يضرب نقطة الخادم المقيدة بإسناداته */}
            {realTrainer && (
              <SearchChip hintAr="ابحث في شعبك وطلبتك" />
            )}
            <NotificationBell audience="trainer" />
            <ThemeToggle />
            <StaffAccountMenu user={user} />
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
      {realTrainer && <PortalSearchPalette kind="trainer" />}
    </div>
  );
}
