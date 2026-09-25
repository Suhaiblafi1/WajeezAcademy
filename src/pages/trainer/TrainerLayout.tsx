import { Link, NavLink, useLocation } from "react-router";
import { Award, BookPlus, CalendarDays, ChevronDown, ClipboardCheck, FileSignature, GraduationCap, Handshake, LayoutDashboard, Link2, MoreHorizontal, Route, Star, Users, Wallet } from "lucide-react";
import { Inset } from "@/components/ui/Surface";
import { NavPill, NavPillButton } from "@/components/ui/NavPill";
import NotificationBell from "@/components/NotificationBell";
import SearchChip from "@/components/SearchChip";
import ThemeToggle from "@/components/ThemeToggle";
import StaffAccountMenu from "@/components/StaffAccountMenu";
import PortalSearchPalette from "@/components/PortalSearchPalette";
import ConditionStrip, { type ConditionContract, type OnboardingTask } from "@/components/ConditionStrip";
import { useRealSession } from "@/services/session";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadMyPortals } from "@/services/portals";
import { apiGet } from "@/services/api";
import { GRADING_CHANGED } from "@/services/grading-signal";

/* ═══ «المزيد» — ستّةُ تبويباتٍ خلف بابٍ يُرى، لا خلف تمريرٍ لا يُرى ═══

   الشريطُ كان يحمل أحدَ عشرَ بندا في `overflow-x-auto` و`scrollbar-hide`:
   فالبنودُ بعد الحافّة موجودةٌ ولا شيءَ في الشاشة يقول إنّها هناك. وتعليقُ
   الشريط نفسُه كان يَعِد بألّا «يُخفي ثلاثةَ تبويباتٍ خلف تمريرٍ بلا علامةٍ
   تدلّ عليه» — وهو ما كان يفعله، لأنّ أخذَ الشريطِ سطرَه كاملا لم يكن
   يكفيه: أحدَ عشرَ بندا بأسمائها تفوق ١١٠٨ بكسلا الفعليّة على الحاسوب.

   ── ولماذا زرٌّ لا حافّةٌ تتلاشى ──

   التلاشي والسهمُ يجعلان المخفيَّ **مرئيَّ الوجود** ولا يجعلانه مبلوغا:
   يبقى التنقّلُ تمريرا أفقيّا بالفأرة، و«مستحقّاتي» وراءَ تمريرَتين.
   وقرارُ صاحب المنصّة (١٨ سبتمبر ٢٠٢٦) على الزرّ: نقرةٌ معلومةٌ خيرٌ من
   تمريرٍ مقدَّر.

   ── وثلاثةٌ تبيت في البنية ──

   · المستمعُ على `document` لا ستارةٌ `fixed`: الترويسةُ تحمل `backdrop-blur`
     و`backdrop-filter` يجعل حاملَه كتلةً حاضنةً لكلّ `fixed` في ذرّيّته،
     فالستارةُ تمتدّ على الترويسة وحدَها. وهي علّةٌ وقعت في هذه الترويسة
     بعينها مع `StaffAccountMenu`، فلا تُعاد.
   · والزرُّ **خارجَ** الشريط المُمرَّر: `overflow-x-auto` يقصُّ كلَّ
     `absolute` في داخله، فالقائمةُ كانت ستُقصّ عند حافّته.
   · والزرُّ يحمل حالةَ النشاط حين يكون المفتوحُ من بنوده: من فتح
     «مستحقّاتي» يرى أين هو، وإلّا بدا الشريطُ بلا موضعٍ نشط.

   وتُغلَق عند تبدّل المسار بـ`key={pathname}` من أبيها لا بأثرٍ جانبيٍّ
   يكتب الحالةَ في `useEffect`: النقرُ في بنودها يغلقها بيده، والباقي رجوعُ
   المتصفّح وما جرى خارجَها — وإعادةُ التركيب تضبطها بلا دَينِ تلويم. */
function MoreTabs({ items, pathname }: { items: { to: string; label: string; icon: typeof Users }[]; pathname: string }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const here = items.some((t) => pathname === t.to || pathname.startsWith(`${t.to}/`));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="relative shrink-0">
      <NavPillButton
        active={here}
        icon={MoreHorizontal}
        label="المزيد"
        expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown className={`h-3 w-3 shrink-0 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </NavPillButton>

      {open && (
        <Inset role="menu" tone="solid" className="absolute left-0 top-12 z-50 w-64 p-1.5 shadow-2xl">
          {items.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-xs font-bold transition ${
                  isActive ? "bg-teal text-on-teal" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                }`
              }
            >
              <t.icon className="h-4 w-4 shrink-0" />
              <span>{t.label}</span>
            </NavLink>
          ))}
        </Inset>
      )}
    </div>
  );
}

/* ما يقرؤه الإطارُ من `/api/trainer/me` — لا الملفُّ كلُّه.
   ونداءٌ واحدٌ يخدم اثنين: عدّادَ التصحيح، وشريطَ العرض المشروط.
   فنداءان لمسارٍ واحدٍ في الإطار نفسِه طلبٌ زائدٌ في كلّ شاشةٍ تُفتح. */
interface PortalMe {
  pendingGrading?: number;
  contracts?: ConditionContract[];
  onboardingTasks?: OnboardingTask[];
}

/** إطار بوابة المدرب: هويته من جلسته وحدها. */
export default function TrainerLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const { user, checked } = useRealSession();
  const { pathname } = useLocation();
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
  const [me, setMe] = useState<PortalMe | null>(null);
  /* ويُعاد جلبُه بعد فعلِ المدرّب لا بإعادة تحميل الصفحة: كان يقبل
     آخرَ تسليمٍ فيصير المتنُ «الطابورُ نظيف» والشارةُ فوقه «١». والإطارُ
     لا يرى ما يفعله ابنُه، فيسمع إشارتَه (`GRADING_CHANGED`).

     وشريطُ الشرط يركب النداءَ نفسَه: فمن أعلن اكتمالَ موادّه يجب أن
     يرى السطرَ يتبدّل في مكانه لا أن يُعيد التحميل ليصدّق أنّ شيئا وقع. */
  const refreshMe = useCallback(() => {
    void apiGet<PortalMe>("/api/trainer/me")
      .then(setMe)
      .catch(() => { /* لا رقمَ خيرٌ من رقمٍ كاذب */ });
  }, []);
  useEffect(() => {
    refreshMe();
    window.addEventListener(GRADING_CHANGED, refreshMe);
    return () => window.removeEventListener(GRADING_CHANGED, refreshMe);
  }, [refreshMe]);
  const pending = me?.pendingGrading ?? 0;
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
    /* ═══ خمسةٌ تُرى، والباقي في «المزيد» — قرارُ صاحب المنصّة (١٨ سبتمبر ٢٠٢٦) ═══

       الخمسةُ الأولى ما يفتحه في يومه: لوحتُه، وشعبُه، وطلبتُه، وما ينتظر
       تصحيحَه، وجدولُه. والباقيةُ يُقصَد كلٌّ منها قصدا (مؤهّلاتي · عروضي ·
       مقترحاتي · مساراتي · مستحقّاتي · عقدي · ما قيل عنّي · دعوتي) فلا
       تُزاحم. والقرارُ في «خمسةٍ تُرى» لا في عدد ما خلفها — وهو ما يحرسه
       `mobile-and-domain.test.ts`: سقفٌ على `primary` وحدَه. */
    { to: "/trainer", label: "الرئيسية", icon: LayoutDashboard, end: true, primary: true },
    { to: "/trainer/board", label: "شعبي", icon: Users, primary: true },
    { to: "/trainer/learners", label: "طلبتي", icon: GraduationCap, primary: true },
    { to: "/trainer/grading", label: "طابور التقييم", icon: ClipboardCheck, count: pending, primary: true },
    { to: "/trainer/schedule", label: "جدولي", icon: CalendarDays, primary: true },
    { to: "/trainer/qualifications", label: "مؤهّلاتي وإتاحتي", icon: Award },
    /* وبعدها «عروضي» مباشرةً: ما أُهِّلتُ له، ثمّ ما عُرض عليّ منه. والخمسةُ
       الأولى لا تُمسّ (قرارُ ١٨ سبتمبر ٢٠٢٦) — والعرضُ يصله جرسُه بوجهته،
       والبطاقةُ في رئيسته، فلا يُكتشَف بتصفّحٍ مصادفةً. */
    { to: "/trainer/offers", label: "عروضي", icon: Handshake },
    /* ح-٢: بعد «مؤهّلاتي» — السؤالان جارانِ: ما أُهِّلتُ له، وما أقترحه ولم
       يدخل الكتالوجَ بعد. وقرارُ الإدارة يصل هنا، فلا يُدفن في صفحةٍ طويلة. */
    { to: "/trainer/course-proposals", label: "دوراتي المقترحة", icon: BookPlus },
    /* ن-١: بعد «دوراتي المقترحة» — الأولى دوراتٌ ليست عندنا، وهذه ترتيبُ
       ما عندنا في مسارٍ باسمه. والسؤالان متجاوران في ذهنه. */
    { to: "/trainer/paths", label: "مساراتي", icon: Route },
    { to: "/trainer/earnings", label: "مستحقاتي", icon: Wallet },
    /* وبعدها «عقدي» مباشرةً — قرارُ صاحب المنصّة (٢٥ سبتمبر ٢٠٢٦): «الملف
       يكون في منصته ضمن قسم المستحقات والعقد». فهما بابان متجاوران: ما
       تستحقّه، والوثيقةُ التي على أساسها تستحقّه. */
    { to: "/trainer/contract", label: "عقدي", icon: FileSignature },
    { to: "/trainer/ratings", label: "ما قيل عنّي", icon: Star },
    /* ب-٥: بعد «ما قيل عنّي» مباشرةً — قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦) */
    { to: "/trainer/referral", label: "دعوتي", icon: Link2 },
  ];
  const primaryTabs = tabs.filter((t) => t.primary);
  const moreTabs = tabs.filter((t) => !t.primary);

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
        {/* ── الشريطُ يأخذ سطرَه، وخمسةٌ فيه لا أحدَ عشر ──

            كان تسعةَ رموزٍ **بلا كلمة** بعرض ٣٩٠: النصُّ `hidden sm:inline`،
            فيصير كلُّ عنصرٍ ٣٨×٤٤ بكسلا يُميَّز بالرمز وحدَه. والعرضُ فوق ٢٤
            التي تشترطها WCAG 2.5.8 فليس مخالفةً — لكنّ تسعةَ أهدافٍ متشابهةٍ
            بلا اسمٍ ليست تنقّلا، والمراجعُ توصي بخمسةٍ فأقلَّ في شريطٍ أوّل.

            فصارت بأسمائها وأخذ الشريطُ سطرَه كاملا. ولم يكفِ: أحدَ عشرَ بندا
            بأسمائها تفوق إطارَ العرض، ويشتدّ على الحاسوب بمعامل التكبير ١٫٣
            (`--app-scale` في `#80`) — إطارُ ١٤٤٠ يصير ١١٠٨ فعليّا. فبقي
            `overflow-x-auto` و`scrollbar-hide` يخفيان الأربعةَ الأخيرة بلا
            علامةٍ تدلّ عليها، وهو ما كان هذا التعليقُ نفسُه يَعِد بألّا يقع.

            والجوابُ خمسةٌ تُرى وستٌّ خلف زرِّ «المزيد» — لا تلاشٍ عند الحافّة:
            التلاشي يجعل المخفيَّ مرئيَّ الوجود ولا يجعله مبلوغا (قرارُ صاحب
            المنصّة، ١٨ سبتمبر ٢٠٢٦). والتمريرُ باقٍ على الخمسة للهاتف وحدَه،
            و«المزيد» خارجَه فلا يُمرَّر معها ولا تُقصُّ قائمتُه. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-5 py-2">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 shrink-0 object-contain" />
            <span className="hidden font-black sm:block">وجيز — بوابة المدرب</span>
          </Link>
          <nav aria-label="تبويبات بوّابة المدرّب" className="order-last flex w-full items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            <div className="scrollbar-hide flex min-w-0 flex-1 items-center justify-start gap-1 overflow-x-auto">
              {/* والحبّةُ درجةٌ في السلّم (`ui/NavPill`) لا صيغةٌ تُكتب هنا:
                  الزرُّ إلى جانبها يجب أن يطابقها شكلا، ونسختان تفترقان. */}
              {primaryTabs.map((t) => (
                <NavPill key={t.to} to={t.to} end={t.end} icon={t.icon} label={t.label}>
                  {/* العددُ يُقرأ للعين وللقارئ معا: الرقمُ وحدَه لا يقول ماذا يعدّ */}
                  {!!t.count && (
                    <span className="rounded-full bg-gold px-1.5 text-fine font-black text-on-gold">
                      <span className="sr-only">ينتظر تصحيحَك: </span>{t.count}
                    </span>
                  )}
                </NavPill>
              ))}
            </div>
            <MoreTabs key={pathname} items={moreTabs} pathname={pathname} />
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
        {/* وفوقَ عنوان الشاشة لا داخلَها: المهلةُ حالُ المدرّب لا حالُ
            صفحة، فتُرى في كلّ شاشةٍ يفتحها وهو في يومه السادس. */}
        <ConditionStrip contract={me?.contracts?.[0]} tasks={me?.onboardingTasks} onDone={refreshMe} />
        <h1 className="mb-6 text-2xl font-black">{title}</h1>
        {children}
      </div>
      {realTrainer && <PortalSearchPalette kind="trainer" />}
    </div>
  );
}
