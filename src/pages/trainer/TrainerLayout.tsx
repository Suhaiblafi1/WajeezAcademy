import { Link, NavLink, useLocation } from "react-router";
import { flushSync } from "react-dom";
import { Award, BookPlus, CalendarDays, ChevronDown, ClipboardCheck, FileSignature, GraduationCap, Handshake, LayoutDashboard, Link2, Route, Star, Users, Wallet, type LucideIcon } from "lucide-react";
import { Inset } from "@/components/ui/Surface";
import { NavPill, NavPillButton, NavPillGhost } from "@/components/ui/NavPill";
import { fitCount, reservedCount } from "@/components/ui/nav-fit";
import NotificationBell from "@/components/NotificationBell";
import SearchChip from "@/components/SearchChip";
import ThemeToggle from "@/components/ThemeToggle";
import StaffAccountMenu from "@/components/StaffAccountMenu";
import PortalSearchPalette from "@/components/PortalSearchPalette";
import ConditionStrip, { type ConditionContract, type OnboardingTask } from "@/components/ConditionStrip";
import { useRealSession } from "@/services/session";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { loadMyPortals } from "@/services/portals";
import { apiGet } from "@/services/api";
import { GRADING_CHANGED } from "@/services/grading-signal";

/** تبويبٌ في شريط البوّابة — وترتيبُه في القائمة أولويّتُه */
interface Tab {
  to: string;
  label: string;
  /** يُرسم في قائمة «المزيد» وحدَها: الشريطُ بلا رموز (انظر `TabsBar`) */
  icon: LucideIcon;
  end?: boolean;
  count?: number;
}

/* العددُ يُقرأ للعين وللقارئ معا: الرقمُ وحدَه لا يقول ماذا يعدّ. ويختفي عند
   الصفر — «٠ ينتظر» ضجيجٌ لا خبر.

   وصار مكوّنا لأنّه يُرسم في أربعة مواضع: حبّةِ التبويب، وشبحِها الذي يُقاس
   به عرضُها، وبندِه في «المزيد»، وزرِّ «المزيد» حين يكون التبويبُ خلفه.
   وأربعُ نسخٍ تفترق — وافتراقُ الشبح عن الحبّة خاصّةً يُفسد القياس بصمت. */
function CountBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="rounded-full bg-gold px-1.5 text-fine font-black text-on-gold">
      <span className="sr-only">ينتظر تصحيحَك: </span>{count}
    </span>
  );
}

/* ═══ «المزيد» — لما لم يسعه الشريط، بابٌ يُرى لا تمريرٌ لا يُرى ═══

   الشريطُ كان يحمل أحدَ عشرَ بندا في `overflow-x-auto` و`scrollbar-hide`:
   فالبنودُ بعد الحافّة موجودةٌ ولا شيءَ في الشاشة يقول إنّها هناك. فجاء
   هذا الزرّ (قرارُ صاحب المنصّة، ١٨ سبتمبر ٢٠٢٦): نقرةٌ معلومةٌ خيرٌ من
   تمريرٍ مقدَّر. وكان يحمل ثمانيةً ثابتةً على كلّ شاشة، فصار يحمل ما لم
   يسعه الشريطُ وحدَه (٢٧ سبتمبر ٢٠٢٦، انظر `TabsBar`) — ولا يظهر أصلا حين
   يسع الكلّ.

   ── وأربعةٌ تبيت في البنية ──

   · المستمعُ على `document` لا ستارةٌ `fixed`: الترويسةُ تحمل `backdrop-blur`
     و`backdrop-filter` يجعل حاملَه كتلةً حاضنةً لكلّ `fixed` في ذرّيّته،
     فالستارةُ تمتدّ على الترويسة وحدَها. وهي علّةٌ وقعت في هذه الترويسة
     بعينها مع `StaffAccountMenu`، فلا تُعاد.
   · والزرُّ **خارجَ** الصفّ القاصّ: `overflow-hidden` يقصُّ كلَّ `absolute`
     في داخله، فالقائمةُ كانت ستُقصّ عند حافّته.
   · والزرُّ يحمل حالةَ النشاط حين يكون المفتوحُ من بنوده: من فتح
     «مستحقّاتي» يرى أين هو، وإلّا بدا الشريطُ بلا موضعٍ نشط.
   · ويحمل عدّادَ ما خلفه: «طابورُ التقييم» رابعُ القائمة، فيخرج إليه على
     الهاتف — ورقمُه وُضع في الشريط ليُرى بلا فتحِ شيء، فلا يُدفن خلف نقرة.
     وهو مجموعُ عدّادات المخفيّ، والطابورُ اليومَ وحدَه يعدّ؛ فمن أضاف عدّادا
     بمعنًى آخر فرّق بينهما هنا، وإلّا قرأ القارئُ «ينتظر تصحيحَك» لغير التصحيح.

   وتُغلَق عند تبدّل المسار بـ`key={pathname}` من أبيها لا بأثرٍ جانبيٍّ
   يكتب الحالةَ في `useEffect`: النقرُ في بنودها يغلقها بيده، والباقي رجوعُ
   المتصفّح وما جرى خارجَها — وإعادةُ التركيب تضبطها بلا دَينِ تلويم. */
function MoreTabs({ items, pathname }: { items: Tab[]; pathname: string }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  /* و`end` يُحترَم هنا كما في `NavLink`: «الرئيسية» جذرُ البوّابة، فلو طوبق
     بالبادئة لنشِط الزرُّ في كلّ صفحاتها متى خرجت إليه على شاشةٍ ضيّقة. */
  const here = items.some((t) => pathname === t.to || (!t.end && pathname.startsWith(`${t.to}/`)));
  const waiting = items.reduce((sum, t) => sum + (t.count ?? 0), 0);

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
        label="المزيد"
        expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <CountBadge count={waiting} />
        <ChevronDown className={`h-3 w-3 shrink-0 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </NavPillButton>

      {open && (
        <Inset role="menu" tone="solid" className="absolute left-0 top-12 z-50 w-64 p-1.5 shadow-2xl">
          {items.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
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
              <CountBadge count={t.count} />
            </NavLink>
          ))}
        </Inset>
      )}
    </div>
  );
}

/* ═══ الشريطُ يعرض ما وسعه، و«المزيد» لما لم يسعه ═══

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «اجعل قائمةَ العناوين مكتملةً ليست
   داخلَ المزيد، إلّا إذا استُخدم الهاتفُ والشاشةُ صغيرة — هناك نستخدم
   المزيدَ لمن لا يظهر». نسخا لـ«خمسةٍ تُرى والباقي في المزيد» (١٨ سبتمبر):
   كانت الخمسةُ على كلّ شاشة، حتّى العريضةِ التي يبقى فيها نصفُ الشريط
   فارغا بين «جدولي» والزرّ. فالعددُ لا يُكتب: يُقاس.

   ── كيف يُقاس ──

   صفٌّ ثانٍ لا يُرى (`invisible` و`aria-hidden`) يحمل **كلَّ** التبويبات
   وزرَّ «المزيد» بعرضها الطبيعيّ، ويُقرأ منه عرضُ كلِّ حبّة. والصفُّ
   المرئيُّ لا يصلح للقياس: ما خرج منه لا عرضَ له، فلا يُعرف متى يعود إن
   اتّسعت الشاشة. ثمّ تقرّر `fitCount` كم يُعرض (`ui/nav-fit.ts`).

   و`ResizeObserver` على الاثنين: على المسار لأنّ عرضَه يتبدّل بالشاشة
   وبمعامل التكبير `--app-scale`، وعلى صفّ الأشباح لأنّ عرضَ الحبّات يتبدّل
   بالخطّ حين يصل وبشارة العدّاد حين تظهر.

   والأشباحُ تحجز مكانَ الشارة قبل أن يصل عددُها (`reservedCount`): العدّادُ
   يصل بعد التركيب، فبلا حجزٍ يقفز «طابورُ التقييم» إلى «المزيد» على الهاتف
   في كلّ انتقال. وشبحُ «المزيد» يحمل عدّادَ الكلّ لا عدّادَ المخفيّ:
   المخفيُّ لا يُعرف إلّا بعد القياس. وأسوأُ ما في الحجزين تبويبٌ يخرج قبل
   أوانه بعرض شارة — لا حبّةٌ تُقَصّ، ولا شريطٌ يقفز.

   ── ولماذا `flushSync` ──

   التحديثُ من مراقب الحجم يُجدوَل بعد الرسم، فيرى الهاتفُ إطارا فيه
   التبويباتُ كلُّها مقصوصةً بلا «المزيد» ثمّ تُصحَّح. والمراقبُ يُنادى بعد
   التخطيط وقبل الرسم، فالتصييرُ المتزامنُ فيه يجعل أوّلَ ما يُرسم صحيحا —
   والإطارُ يُعاد تركيبُه مع كلّ شاشةٍ في البوّابة، فذاك الإطارُ الخاطئُ كان
   سيُرى في كلّ انتقال. ويُركَّب المراقبُ في `useLayoutEffect` لا `useEffect`
   كي يسبق أوّلَ رسمٍ هو أيضا.

   ── ولماذا بلا رموز ──

   قِيس بالمتصفّح وخطُّ IBM Plex Sans Arabic محمَّل (بكسلاتٌ فعليّةٌ قبل
   معامل التكبير): التبويباتُ الثلاثةَ عشرَ برموزها وحشوِها الأوّل تطلب ١٣٠٨،
   وبأضيق حشوٍ يُحتمل ١١٠٤ — والشريطُ يقف عند ١١٠٢ على أعرض شاشة
   (`max-w-6xl`). فما بقيت الرموزُ لا تسع سطرَها على أيّ حاسوب، وتبقى
   «المزيد» حيث أراد صاحبُ المنصّة ألّا تكون. وبلا رموزٍ ٨٩٦، فتسع كلُّها من
   إطارٍ عرضُه نحوُ ١٢٣٠ فما فوق. والاسمُ هو ما يُقرأ، فحُذف الرمزُ من الشريط
   وبقي في قائمة «المزيد» حيث يُمسَح بالعين عموديّا.

   ── وما يبيت في البنية ──

   · الصفُّ المرئيُّ يقصّ (`overflow-hidden`): قياسٌ بائتٌ لإطارٍ واحدٍ
     يُخفي طرفَ حبّةٍ ولا يمدّ الصفحةَ عرضا.
   · ولا تمريرَ فيه: ما لم يسعه يُبلَغ من «المزيد» بنقرةٍ معلومة، لا بتمريرٍ
     لا علامةَ عليه — وذاك من قرار ١٨ سبتمبر وما زال قائما.
   · ولا فراغَ بين الحبّات (`gap`): غيرُ النشطة بلا خلفية، فحشوُها هو ما
     بين اسمين (٢٤ بكسلا) — و`gap-1` كان يزيد ٤٨ بكسلا لا تُرى إلّا في
     الحساب. وهو واحدٌ في المسار والصفّين: الحسابُ يقرؤه من الأشباح ويطبّقه
     على المرئيّ، فلو افترقا لقاس غيرَ ما يُرسم. */
function TabsBar({ tabs, pathname }: { tabs: Tab[]; pathname: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(tabs.length);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const ghost = ghostRef.current;
    if (!track || !ghost || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const rects = Array.from(ghost.children, (el) => el.getBoundingClientRect());
      const more = rects.pop();
      if (!more) return;
      /* الفراغُ من موضع حبّتين لا من الأسلوب المحسوب: `getBoundingClientRect`
         يعيد القيمَ مكبَّرةً بمعامل `--app-scale` و`getComputedStyle` يعيدها
         بلا تكبير — ومزجُهما خطأٌ بنسبة ١٫٣ على الحاسوب. وأيُّ الفرقين موجبٌ
         هو الفراغ، في اليمين إلى اليسار وعكسِه. */
      const gap = rects.length > 1
        ? Math.max(0, rects[0].left - rects[1].right, rects[1].left - rects[0].right)
        : 0;
      const next = fitCount(rects.map((r) => r.width), gap, more.width, track.getBoundingClientRect().width);
      flushSync(() => setShown(next));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    ro.observe(ghost);
    return () => ro.disconnect();
  }, []);

  const counted = tabs.filter((t) => t.count !== undefined);
  const waitingAll = counted.length ? counted.reduce((sum, t) => sum + (t.count ?? 0), 0) : undefined;

  return (
    <nav aria-label="تبويبات بوّابة المدرّب" className="order-last w-full rounded-full border border-white/10 bg-white/[0.03] p-1">
      <div ref={trackRef} className="relative flex items-center">
        <div className="flex min-w-0 flex-1 items-center overflow-hidden">
          {/* والحبّةُ درجةٌ في السلّم (`ui/NavPill`) لا صيغةٌ تُكتب هنا:
              الزرُّ والشبحُ إلى جانبها يجب أن يطابقاها شكلا، ونسختان تفترقان. */}
          {tabs.slice(0, shown).map((t) => (
            <NavPill key={t.to} to={t.to} end={t.end} label={t.label}>
              <CountBadge count={t.count} />
            </NavPill>
          ))}
        </div>
        {shown < tabs.length && <MoreTabs key={pathname} items={tabs.slice(shown)} pathname={pathname} />}
        <div aria-hidden="true" className="pointer-events-none invisible absolute inset-0 overflow-hidden">
          <div ref={ghostRef} className="flex w-max items-center">
            {tabs.map((t) => (
              <NavPillGhost key={t.to} label={t.label}>
                <CountBadge count={reservedCount(t.count)} />
              </NavPillGhost>
            ))}
            <NavPillGhost label="المزيد">
              <CountBadge count={reservedCount(waitingAll)} />
              <ChevronDown className="h-3 w-3 shrink-0" />
            </NavPillGhost>
          </div>
        </div>
      </div>
    </nav>
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
  const tabs: Tab[] = [
    /* ═══ الترتيبُ أولويّة — كلُّها تُرى ما وسعها الشريط (٢٧ سبتمبر ٢٠٢٦) ═══

       لا سقفَ على ما يُرى: الشريطُ يقيس ويعرض ما وسعه (`TabsBar`)، وما لم
       يسعه يخرج إلى «المزيد» **من آخر القائمة**. فالترتيبُ هو الذي يقرّر ما
       يبقى على الهاتف: أوّلُها ما يفتحه في يومه — لوحتُه، وشعبُه، وطلبتُه،
       وما ينتظر تصحيحَه، وجدولُه — ثمّ ما يُقصَد كلٌّ منه قصدا. وكانت الخمسةُ
       الأولى وحدَها تُرى على كلّ شاشة (١٨ سبتمبر ٢٠٢٦) حتّى نُسخ ذلك. */
    { to: "/trainer", label: "الرئيسية", icon: LayoutDashboard, end: true },
    { to: "/trainer/board", label: "شعبي", icon: Users },
    { to: "/trainer/learners", label: "طلبتي", icon: GraduationCap },
    { to: "/trainer/grading", label: "طابور التقييم", icon: ClipboardCheck, count: pending },
    { to: "/trainer/schedule", label: "جدولي", icon: CalendarDays },
    { to: "/trainer/qualifications", label: "مؤهّلاتي وإتاحتي", icon: Award },
    /* وبعدها «عروضي» مباشرةً: ما أُهِّلتُ له، ثمّ ما عُرض عليّ منه. ولم
       تتقدّم على الخمسة الأولى — والعرضُ يصله جرسُه بوجهته، والبطاقةُ في
       رئيسته، فلا يُكتشَف بتصفّحٍ مصادفةً. */
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
            `TabsBar`. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-5 py-2">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 shrink-0 object-contain" />
            <span className="hidden font-black sm:block">وجيز — بوابة المدرب</span>
          </Link>
          <TabsBar tabs={tabs} pathname={pathname} />
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
