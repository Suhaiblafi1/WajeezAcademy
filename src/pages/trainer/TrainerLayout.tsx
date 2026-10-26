import { Link } from "react-router";
import { BookCheck, BookOpen, CalendarDays, ClipboardCheck, GraduationCap, Inbox, Languages, LayoutDashboard, Megaphone, Share2, Users, Wallet } from "lucide-react";
import { PortalTabs, type PortalTab } from "@/components/ui/PortalTabs";
import NotificationBell from "@/components/NotificationBell";
import SearchChip from "@/components/SearchChip";
import ThemeToggle from "@/components/ThemeToggle";
import StaffAccountMenu from "@/components/StaffAccountMenu";
import PortalSearchPalette from "@/components/PortalSearchPalette";
import ConditionStrip, { type ConditionContract } from "@/components/ConditionStrip";
import { useRealSession } from "@/services/session";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadMyPortals } from "@/services/portals";
import { apiGet } from "@/services/api";
import { GRADING_CHANGED } from "@/services/grading-signal";
import { TRAINER_GUIDE_PATH } from "@/application/trainer/trainer-guide";
import { hasOpenCondition } from "@/application/trainer/conditional-offer";
import { tabsForStage } from "@/application/trainer/setup-tabs";
import { useUnreadCount } from "@/services/unread-count";
import TrainerAnnouncement from "./TrainerAnnouncement";

/* ما يقرؤه الإطارُ من `/api/trainer/me` — لا الملفُّ كلُّه.
   ونداءٌ واحدٌ يخدم اثنين: عدّادَ التصحيح، وشريطَ العرض المشروط.
   فنداءان لمسارٍ واحدٍ في الإطار نفسِه طلبٌ زائدٌ في كلّ شاشةٍ تُفتح. */
interface PortalMe {
  pendingGrading?: number;
  /** شعبُه التي تُشغَّل — من له واحدةٌ لا يُعامَل معاملةَ طور الإعداد */
  liveCohorts?: number;
  /** دوراتٌ تنتظر قرارَه في «دوراتي» — عرضٌ أو دورةٌ أو خطّةٌ رُدّت (٢٠ أكتوبر ٢٠٢٦) */
  coursesWaiting?: number;
  contracts?: ConditionContract[];
}

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
  /* غيرُ المقروء — المخزنُ نفسُه الذي يقرؤه الجرس، فنداءٌ واحدٌ للاثنين (`unread-count.ts`) */
  const unread = useUnreadCount("trainer", realTrainer);

  /* ═══ ارتفاعُ الشريط يُقاس ويُنشَر — فوق كلّ عودةٍ مبكّرة ═══

     شاشاتٌ تحت هذا الشريط تُلصِق رؤوسَها (`sticky`)، فتحتاج أن تعرف أين
     ينتهي هو. ورقمٌ مكتوبٌ بيدٍ في كلٍّ منها يفترق عنه عند أوّل تبديل:
     الشريطُ يلفّ سطرَه على الهاتف فيطول، ويقصر على الحاسوب، ويتبدّل
     بمعامل التكبير `--app-scale`. فيُقاس بـ`ResizeObserver` ويُنشَر
     متغيّرا واحدا على الجذر تقرؤه من شاءت.

     وموضعُه هنا لا قبل `return` الأخيرة: تحتها ثلاثُ عوداتٍ مبكّرة
     (لم يُفحَص بعد · لا ملفَّ مدرّبٍ له · لا صلاحيّةَ)، فخطّافٌ بعدها
     يُنادى في تصييرٍ ولا يُنادى في آخر — وذاك ما ردّه `rules-of-hooks`.

     و`headerRef` فارغٌ في تلك العودات، فالخطّافُ يخرج بلا عمل.

     ويُقاس بـ`offsetHeight` لا `getBoundingClientRect` (١٠ أكتوبر ٢٠٢٦):
     الثاني يعيد الطولَ **بعد** `zoom` الذي على `body`، والمتغيّرُ يُقرأ في
     `top` داخل `body` نفسِه فيُضرَب في المعامل ثانيةً. فعلى الحاسوب (١٫٣)
     كان شريطُ مراحل الشعبة يلتصق أسفلَ الرأس بنحو ثلثِ طوله فراغا يمرّ
     تحته المحتوى (قِيس: رأسٌ ١٠٠ ← ١٣٠ ← ١٦٩ على الشاشة). و`offsetHeight`
     بمقاسات التخطيط قبل المعامل — وهي ما يفهمه `top`. */
  const headerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const publish = () => {
      document.documentElement.style.setProperty("--staff-sticky-top", `${el.offsetHeight}px`);
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
          للمدرّبين المعتمدين. سجّل الدخول، أو اطلب الانضمام.
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
  const tabs: PortalTab[] = [
    /* ═══ الترتيبُ أولويّة — كلُّها تُرى ما وسعها الشريط (٢٧ سبتمبر ٢٠٢٦) ═══

       لا سقفَ على ما يُرى: الشريطُ يقيس ويعرض ما وسعه (`ui/PortalTabs`)، وما لم
       يسعه يخرج إلى «المزيد» **من آخر القائمة**. فالترتيبُ هو الذي يقرّر ما
       يبقى على الهاتف: أوّلُها ما يفتحه في يومه — لوحتُه، وشعبُه، وطلبتُه،
       وما ينتظر تصحيحَه، وجدولُه — ثمّ ما يُقصَد كلٌّ منه قصدا. وكانت الخمسةُ
       الأولى وحدَها تُرى على كلّ شاشة (١٨ سبتمبر ٢٠٢٦) حتّى نُسخ ذلك. */
    { to: "/trainer", label: "الرئيسية", icon: LayoutDashboard, end: true },
    { to: "/trainer/board", label: "شعبي", icon: Users },
    { to: "/trainer/learners", label: "طلبتي", icon: GraduationCap },
    { to: "/trainer/grading", label: "طابور التقييم", icon: ClipboardCheck, count: pending },
    { to: "/trainer/schedule", label: "جدولي", icon: CalendarDays },
    /* «دوراتي» — وكانت «مؤهّلاتي» حتّى ٦ أكتوبر ٢٠٢٦ (اختار صاحبُ المنصّة «B»:
       «نؤهّلك» قد تُقرأ «ندرّبك»؛ والمسارُ باقٍ لروابط الرسائل). وكانت وحدَها: ذهبت الإتاحةُ من صفحتها بقرار صاحب المنصّة
       (٢٧ سبتمبر ٢٠٢٦)، فاسمٌ يَعِد بـ«إتاحتي» يقود إلى ما لا وجودَ له.
       و«عروضي» دخلتها (٢٩ سبتمبر ٢٠٢٦): العرضُ حالُ مؤهَّلٍ يُقرَّر عنده،
       لا بابٌ ثانٍ يُقابَل بالأوّل بالعين. */
    { to: "/trainer/qualifications", label: "دوراتي", icon: BookCheck, count: me?.coursesWaiting ?? 0, countLabel: "تنتظر قرارك: " },
    /* وكانت بعدها «دوراتي المقترحة» و«مساراتي» لسانين — وصارتا قسمين في «دوراتي» (الخطوة F،
       ١٩ أكتوبر ٢٠٢٦): ما أُهِّل له، وما يقترحه، وما يرتّبه في مسار — أسئلةٌ ثلاثةٌ عن دوراته
       في بابٍ واحد. وكانت قبلهما «تعديلاتي على دوراتي» وذهبت (٢٩ سبتمبر ٢٠٢٦). */
    /* ═══ «شارك دوراتك» بعدها — كانت «دعوتي» قسما في «مستحقاتي» (٢٦ أكتوبر ٢٠٢٦) ═══
       قال صاحبُ المنصّة: «خانة دعوتي يجب أن تكون بالخارج، واسمها شارك دوراتك». روابطُه وأكوادُه — ما ينشره
       هو باسمه — جارُ دوراته. */
    { to: "/trainer/share", label: "شارك دوراتك", icon: Share2 },
    /* وبعدها «موادك الإعلانية» — وكانت «التسويق» (٢٩ سبتمبر ٢٠٢٦). قال صاحبُ المنصّة (٢٦ أكتوبر ٢٠٢٦): «لا يجب
       أن يكون تسويق لأنّه غير تسويق، هو materials نحتاجها لغايات التسويق لدينا». فيديوهاتُه وصورُه وملصقاتُها. */
    { to: "/trainer/marketing", label: "موادك الإعلانية", icon: Megaphone },
    /* و«عقدي» قسمٌ فيها (و«دعوتي» كانت معه حتّى خرجت «شارك دوراتك»)، و«ما قيل عنّي» قسمٌ في «الرئيسية» (الخطوة G، ١٩ أكتوبر ٢٠٢٦):
       القائمةُ ثمانيةُ ألسنةٍ بعد أربعة عشر. وكان «عقدي» لسانا بجانبها بقرار ٢٥ سبتمبر ٢٠٢٦ («الملف
       يكون في منصته ضمن قسم المستحقات والعقد») — فصار فيها كما قال. */
    { to: "/trainer/earnings", label: "مستحقاتي", icon: Wallet },
    /* «الرسائل والتنبيهات» (٢١ أكتوبر ٢٠٢٦) — والجرسُ يفتحها كذلك، فلا يضيع إن خرج إلى «المزيد» */
    { to: "/trainer/inbox", label: "الرسائل والتنبيهات", icon: Inbox, count: unread, countLabel: "غير مقروء: " },
    /* مراجعةُ اختبار تحديد المستوى (٨ أكتوبر ٢٠٢٦) — لا تُرى إلّا لمن مُنح
       `placement.review`: مدرّبُ الإنجليزيّة بعينه، لا كلُّ مدرّب. */
    ...(user?.permissions.includes("placement.review")
      ? [{ to: "/trainer/placement-review", label: "اختبار المستوى", icon: Languages }]
      : []),
  ];
  /* ومن في طور الإعداد يرى ما يعمل به وحدَه (الخطوة H، `setup-tabs.ts`) — وطورُه من عقده كما يقرؤه
     شريطُ المهلة تحت القائمة، لا من ظنٍّ ثانٍ. ومن له شعبةٌ تُشغَّل أو تسليمٌ ينتظره يرى القائمةَ كلَّها */
  const contract = me?.contracts?.[0];
  const inSetup = Boolean(contract && hasOpenCondition(contract)) && (me?.liveCohorts ?? 0) === 0 && pending === 0;
  const shownTabs = tabsForStage(tabs, inSetup);

  /* له الصلاحيّةُ ولا ملفَّ له: شاشةٌ واحدةٌ تشرح، بدل عشرِ شاشاتٍ تسقط */
  if (realTrainer && hasProfile === false) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-foreground">
        <GraduationCap className="h-12 w-12 text-[#6EC7D1]" />
        <h1 className="mt-5 text-2xl font-black">بوّابة المدرّب</h1>
        <p className="mt-2 max-w-md text-center text-sm leading-7 text-muted-foreground">
          لا ملفّ مدرّب مرتبطا بحسابك، فلا شيء هنا لعرضه.
        </p>
        <p className="mt-3 max-w-md text-center text-read leading-6 text-muted-foreground">
          لمعاينتها، ادخل بحساب مدرّب.
        </p>
        <Link to="/admin" className="mt-7 rounded-full border border-white/15 px-6 py-3 font-bold text-foreground transition hover:border-white/40">
          عد إلى لوحة الإدارة
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
        {/* ── الشريطُ يأخذ سطرَه، وفيه ما وسعه ──

            كان تسعةَ رموزٍ **بلا كلمة** بعرض ٣٩٠: النصُّ `hidden sm:inline`،
            فيصير كلُّ عنصرٍ ٣٨×٤٤ بكسلا يُميَّز بالرمز وحدَه. والعرضُ فوق ٢٤
            التي تشترطها WCAG 2.5.8 فليس مخالفةً — لكنّ تسعةَ أهدافٍ متشابهةٍ
            بلا اسمٍ ليست تنقّلا.

            فصارت بأسمائها وأخذ الشريطُ سطرَه كاملا. ولم يكفِ: البنودُ بأسمائها
            تفوق إطارَ العرض، ويشتدّ على الحاسوب بمعامل التكبير ١٫٣
            (`--app-scale` في `#80`) — إطارُ ١٤٤٠ يصير ١١٠٨ فعليّا. فبقي
            `overflow-x-auto` و`scrollbar-hide` يخفيان الأخيرةَ بلا علامةٍ تدلّ
            عليها؛ ثمّ صارت خمسةً ثابتةً وزرَّ «المزيد» (١٨ سبتمبر ٢٠٢٦)؛ ثمّ
            صار الشريطُ يقيس ويعرض ما وسعه (٢٧ سبتمبر ٢٠٢٦) — وتفصيلُه في
            `ui/PortalTabs`، وهو نفسُه في بوّابتَي المستشار والمتعلّم. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-5 py-2">
          {/* ═══ الدليلُ جنبَ الاسم، والبحثُ في وسط الرأس (٣ أكتوبر ٢٠٢٦) ═══

              قولُ صاحب المنصّة: «أوضِحْ مكانَ الدليل، وغيِّر مكانَ البحث إلى مكانٍ
              مناسبٍ احترافيّ». كان الدليلُ زرّا شبحيّا بين البحث والجرس يُقرأ أداةً
              من الأدوات، والبحثُ قبله يسبقه إلى العين. فصار:
              · **الدليلُ** شارةً ملوّنةً باسمها كاملا («دليلُ المدرّب») لصقَ اسم
                البوّابة — أوّلَ ما يُرى، وعلى الهاتف كذلك. وليست ذهبيّة: الذهبيُّ
                فعلُ الصفحة (`one-primary-per-screen`).
              · **والبحثُ** حقلا في وسط الرأس بين الاسم والأدوات — موضعُه في
                المحرّرات والبوّابات التي يعرفها الناس — يتّسع لما وسعه. */}
          <div className="flex shrink-0 items-center gap-3">
            <Link to="/" className="flex shrink-0 items-center gap-2">
              <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 shrink-0 object-contain" />
              <span className="hidden font-black sm:block">وجيز — بوابة المدرب</span>
            </Link>
            {/* ويُفتح في لسانٍ آخر: الدليلُ شرحٌ يُقرأ بجانب البوّابة لا بدلا منها،
                فلا يغادر المدرّبُ شاشتَه ليقرأ عنها (٣٠ سبتمبر ٢٠٢٦). */}
            <a href={TRAINER_GUIDE_PATH} target="_blank" rel="noopener" aria-label="دليل المدرّب — يفتح في لسان جديد"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-teal/50 bg-teal/10 px-3.5 py-1.5 text-fine font-black text-teal-light-ink transition hover:border-teal hover:bg-teal/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-paper">
              <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>دليل المدرّب</span>
            </a>
          </div>
          {/* بحث سريع Ctrl+K — لجلسة المدرب الحقيقية فقط: يضرب نقطة الخادم المقيدة بإسناداته */}
          {realTrainer && (
            <div className="hidden min-w-0 flex-1 justify-center px-4 md:flex">
              <SearchChip hintAr="ابحث في شعبك وطلبتك" className="w-full max-w-sm" />
            </div>
          )}
          <PortalTabs
            tabs={shownTabs}
            label="تبويبات بوّابة المدرّب"
            countLabel="ينتظر تصحيحك: "
            className="order-last w-full"
          />
          <div className="flex items-center gap-3">
            <NotificationBell audience="trainer" href="/trainer/inbox" />
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
        <ConditionStrip contract={me?.contracts?.[0]} onDone={refreshMe} />
        <h1 className="mb-6 text-2xl font-black">{title}</h1>
        {children}
      </div>
      {realTrainer && <PortalSearchPalette kind="trainer" />}
      {/* وإعلانُ الإدارة نافذةً في أيّ شاشةٍ يفتحها — حتّى يضغط «قرأتُه»، ولا تمنعه من
          عمله: «ذكّرني لاحقا» يغلقها (٤ أكتوبر ٢٠٢٦، `TrainerAnnouncement.tsx`) */}
      {realTrainer && <TrainerAnnouncement />}
    </div>
  );
}
