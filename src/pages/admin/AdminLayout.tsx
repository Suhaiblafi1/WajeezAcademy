import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Crown } from "lucide-react";
import { placeOf, sectionsFor, waitingCounts, type AdminNavItem, type WaitingInput } from "./nav-map";
import NotificationBell from "@/components/NotificationBell";
import SearchChip from "@/components/SearchChip";
import ThemeToggle from "@/components/ThemeToggle";
import StaffAccountMenu from "@/components/StaffAccountMenu";
import SearchPalette from "@/components/SearchPalette";
import { PortalTabs } from "@/components/ui/PortalTabs";
import { useRealSession } from "@/services/session";
import { apiGet } from "@/services/api";
import { knownInboxCounts, loadInboxCounts, type InboxCount } from "@/services/inbox-counts";
import { PLANS_CHANGED } from "@/services/plans-signal";

import BuildStampLine from "@/components/BuildStampLine";

/* ما يُقرأ قبل عدد كلّ لسانٍ لمن يسمعه بقارئ شاشة — «٣» وحدَها لا تقول ماذا تعدّ،
   وعددان بنصٍّ واحدٍ يقول أحدُهما ما ليس له. */
const COUNT_LABEL_AR: Record<NonNullable<AdminNavItem["badge"]> | "inbox", string> = {
  awaitingCountersign: "عقود موقّعة تنتظر ختمك: ",
  awaitingPlans: "خطط تنتظر اعتمادك: ",
  inbox: "ينتظرك: ",
};

/* آخرُ ما عُرف من الشارتين لصاحب الجلسة — الإطارُ يُركَّب من جديدٍ مع كلّ شاشة، فيُرسم به أوّلُ
   إطارٍ فيها ولا تقفز الألسنةُ حين يصل العدد. ولصاحبه وحدَه: الخروجُ لا يعيد تحميلَ الصفحة. */
let knownBadges: { userId: string; badges: WaitingInput["badges"] } | null = null;

/** إطار لوحة الإدارة والعمليات — هويّة الإداريّ من جلسته وحدها.

    حُذفت شاشة «من أنت؟» التي كانت تعرض ثلاثة أسماء إداريّين مختلَقين
    («م. عبدالله الرشيد» و«د. سارة العمري» و«أ. محمد الحربي») ليختار الداخلُ
    واحدا منها فيُحفظ في متصفّحه، ومعها سطر «نسخة تجريبية». وهي القاعدة نفسها
    التي حُذفت من بوابة المدرب: لا اسمَ يُعرض كحقيقة قبل توثيقه.

    ═══ سبعةُ أقسامٍ وألسنةٌ في أعلاها (٢٤ أكتوبر ٢٠٢٦) ═══

    كان الشريطُ الجانبيُّ خمسا وثلاثين شاشةً في تسع مجموعات، وعلى الهاتف قائمةٌ منسدلةٌ بها كلِّها.
    فصار: **الأقسامُ السبعةُ سكّةٌ ضيّقةٌ** على الحاسوب — رمزٌ واسمُه تحته وعددُ ما ينتظرك فيه — و**صفحاتُ
    القسم ألسنةٌ في أعلى المحتوى** (`PortalTabs`، الشريطُ نفسُه في البوّابات الثلاث). وعلى الهاتف الأقسامُ
    شريطٌ بالصيغة نفسِها تحت الترويسة، لا قائمةٌ منسدلة. والتصنيفُ وعلّتُه في `nav-map.ts`.

    ── ولماذا سكّةٌ لا شريطٌ عريض ──

    قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): ألسنةُ الشريط تُرى كلُّها على الحاسوب، و«المزيد» للهاتف وحدَه.
    وألسنةُ «المدربون» تسعةٌ اليوم. فقِيس بالمتصفّح: شريطٌ جانبيٌّ بعرض ١٢rem يُخرج منها اثنين إلى
    «المزيد» على ١٣٦٦ وثلاثةً على ١٢٨٠، والسكّةُ بعرض ٦rem تُبقيها كلَّها من ١٢٨٠ فما فوق. وسبعُ وجهاتٍ
    عددُ ما صُنعت له السكّة. ومرشِّحُ «ابحث في الشاشات» الذي كان فوق المجموعات صار أوّلَ ما تجده لوحةُ
    البحث (`Ctrl K`): بحثٌ واحدٌ في الشاشات والبيانات معا، لا خانتان. */
export default function AdminLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const { user, checked } = useRealSession();
  /* ═══ ما ينتظر ختمَنا — شارةٌ تبقى بعد أن يمضي الإشعار ═══

     الإشعارُ يُرسَل ساعةَ التوقيع ثمّ يمضي. ومن لم يقرأه ساعتَه لا يجد
     ما يناديه، والعقدُ الموقَّعُ يقف حتّى نختمه — وبه يُفعَّل حسابُ
     المدرّب وتُعتمَد موادُّه. فعددٌ يبقى على لسان «العقود» وعلى قسمه.

     ويُجلَب مرّةً عند فتح الإطار لا دوريّا: تواترُ التوقيع بالأيّام لا
     بالثواني، ونداءٌ كلَّ نصفِ دقيقةٍ في كلّ شاشةِ إدارةٍ حِملٌ بلا مقابل.

     ويسقط صامتا: من لا يملك `trainer.contract.manage` يُردّ نداؤه،
     وشارةٌ غائبةٌ أهونُ من خطأٍ يُعرَض له في كلّ شاشة. */
  const [badges, setBadges] = useState<WaitingInput["badges"]>(() =>
    knownBadges && knownBadges.userId === user?.userId ? knownBadges.badges : {});
  useEffect(() => {
    let alive = true;
    void apiGet<{ count: number }>("/api/admin/trainer-contracts/awaiting-countersign-count")
      .then((r) => { if (alive) setBadges((b) => ({ ...b, awaitingCountersign: r.count })); })
      .catch(() => { /* لا صلاحيّةَ أو لا شبكة — لا شارة، ولا خطأٌ يُعرَض */ });
    return () => { alive = false; };
  }, []);
  /* ═══ وخططٌ تنتظر اعتمادك — العلّةُ نفسُها (٣ أكتوبر ٢٠٢٦) ═══
     جرسُ «أرسل خطّتَه» يمضي كما يمضي إشعارُ التوقيع، ومدرّبُ الإعداد لا يُفعَّل
     حتّى تُعتمَد خططُه. ولا يُنادى إلّا لمن يملك الاعتماد: نداءٌ يُردّ في كلّ
     شاشةٍ لمن لا يملكه حِملٌ بلا مقابل. */
  const canApprovePlans = user?.permissions.includes("cohort.plan.approve") ?? false;
  useEffect(() => {
    if (!canApprovePlans) return;
    let alive = true;
    const load = () => {
      void apiGet<{ count: number }>("/api/admin/cohort-plans/pending-count")
        .then((r) => { if (alive) setBadges((b) => ({ ...b, awaitingPlans: r.count })); })
        .catch(() => { /* لا شبكة — لا شارة، ولا خطأٌ يُعرَض */ });
    };
    load();
    /* ويُعاد بعد كلّ قضاءٍ في خطّة — في الطابور أو في بطاقة الشعبة (`plans-signal.ts`) */
    window.addEventListener(PLANS_CHANGED, load);
    return () => { alive = false; window.removeEventListener(PLANS_CHANGED, load); };
  }, [canApprovePlans]);
  /* ═══ وبقيّةُ ما ينتظرك — من «ما ينتظرك» نفسِه (٢٤ أكتوبر ٢٠٢٦) ═══
     عددُ كلِّ قسمٍ في الشريط مجموعُ ما ينتظرك في ألسنته، ومصدرُه بنودُ «ما ينتظرك» في الرئيسية لا
     عدّادٌ ثانٍ يفترق عنها (`waitingCounts`). ويُجلب مرّةً في الدقيقة لصاحب الجلسة (`inbox-counts.ts`). */
  const userId = user?.userId;
  const [inbox, setInbox] = useState<InboxCount[]>(() => knownInboxCounts(userId) ?? []);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void loadInboxCounts(userId).then((r) => { if (alive) setInbox(r); });
    return () => { alive = false; };
  }, [userId]);
  useEffect(() => { if (userId) knownBadges = { userId, badges }; }, [userId, badges]);
  const location = useLocation();

  if (!checked) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-paper text-foreground">
        <Crown className="h-10 w-10 animate-pulse text-[#FABC05]" />
      </div>
    );
  }

  const sections = sectionsFor(user?.permissions);

  /* من لا تبويبَ له لا يُترك في لوحةٍ فارغة يظنّها معطوبة */
  if (sections.every((sec) => sec.items.every((it) => it.open))) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-foreground">
        <Crown className="h-12 w-12 text-[#FABC05]" />
        <h1 className="mt-5 text-2xl font-black">لا صلاحيات مفعّلة لحسابك</h1>
        <p className="mt-2 max-w-md text-center text-sm leading-7 text-muted-foreground">
          حسابك <b className="text-foreground">{user?.displayName}</b> يدخل اللوحة، لكن بلا صلاحيات إداريّة بعد.
          اطلب من مدير النظام صلاحيات عملك.
        </p>
        <Link to="/" className="mt-6 text-xs text-muted-foreground hover:text-foreground">العودة للموقع العام</Link>
      </div>
    );
  }

  /* أين أنا — والقسمُ يضيء في الشريط، وألسنتُه في الأعلى. و«حسابي» لا قسمَ له فلا ألسنة */
  const place = placeOf(location.pathname, sections);
  const waiting = waitingCounts(sections, { badges, inbox });

  return (
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      <SearchPalette />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/90 backdrop-blur">
        <div className="flex h-16 w-full items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 shrink-0 object-contain" />
            <span className="hidden font-black sm:block">وجيز — الإدارة والعمليات</span>
          </Link>
          {/* ب-٣: min-w-0 يسمح للصفّ بالتقلّص عند التكبير ٤٠٠٪ (٣٢٠ بكسل CSS).
              بلا ذلك كان اسم الحساب يفيض ٣٨ بكسل خارج الشاشة فيظهر تمرير أفقي
              على مستوى المستند — والقراءة تصير سطرا سطرا بتمرير يمينا ويسارا. */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <SearchChip hintAr="ابحث في الحسابات والشعب" />
            <NotificationBell audience="staff" />
            <ThemeToggle />
            <StaffAccountMenu user={user} />
          </div>
        </div>
      </header>

      {/* ═══ الهاتف: الأقسامُ شريطٌ تحت الترويسة لا قائمةٌ منسدلة ═══

          كانت `<select>` بخمسٍ وثلاثين شاشةً في تسع مجموعات: من على هاتفه يفتحها ليقرأ، أو لا يفتحها
          فلا يعرف ما عنده. فالأقسامُ السبعةُ حبّاتٌ تُرى بعددِ ما ينتظر في كلٍّ، وما لم يسعه السطرُ في
          «المزيد». وخارجَ الترويسة اللاصقة بقصد: ارتفاعُها ستّةَ عشرَ في كلّ مقاس، وصفوفٌ لاصقةٌ في
          الشاشات تُحاذي حافّتَها (`decision-bar.test.ts`). */}
      <div className="w-full px-5 pt-3 sm:px-8 lg:hidden">
        <PortalTabs
          look="gold"
          label="أقسام الإدارة"
          countLabel={COUNT_LABEL_AR.inbox}
          tabs={sections.map((s) => ({
            to: s.items[0].to,
            label: s.title,
            icon: s.icon,
            count: waiting.bySection[s.title] || undefined,
            active: place?.section.title === s.title,
          }))}
        />
      </div>

      <div className="flex w-full items-start gap-5 px-5 sm:px-8">
        {/* السكّة — شاشات كبيرة: الأقسامُ السبعة، رمزٌ واسمُه تحته وعددُ ما ينتظرك فيه. وحشوُها من الجانبين:
            حلقةُ التركيز ترتسم خارج البند، والسكّةُ تقصّ ما يفيض منها (`overflow-y-auto`) — فكانت تُقطع من يمينها. */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-24 shrink-0 overflow-y-auto border-l border-white/10 px-2 py-4 lg:block">
          <nav aria-label="أقسام الإدارة" className="flex flex-col gap-1">
            {sections.map((s) => {
              const on = place?.section.title === s.title;
              const n = waiting.bySection[s.title] ?? 0;
              return (
                <Link
                  key={s.title}
                  to={s.items[0].to}
                  aria-current={on ? "page" : undefined}
                  className={`relative flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-fine font-bold transition ${
                    on ? "bg-gold text-on-gold" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                  }`}
                >
                  <s.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="leading-4">{s.title}</span>
                  {/* والصفرُ لا يُعرَض: «٠» تُقرأ عملا ينتظر، ومن رآها ففتح فلم يجد شيئا كفّ عن النظر
                      إليها. والعددُ يُقرأ بلسانه لمن يسمع. وعلى القسم المضيء ينقلب لونُه — ذهبيٌّ على
                      ذهبيٍّ لا يُرى. */}
                  {n > 0 && (
                    <span className={`absolute left-1.5 top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full px-1 text-fine font-black tabular-nums ${
                      on ? "bg-on-gold text-gold" : "bg-gold text-on-gold"
                    }`}>
                      <span className="sr-only">{COUNT_LABEL_AR.inbox}</span>{n}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* ب-٢: حاوية تخطيط لا منطقة landmark — منطقة main واحدة في التطبيق
                  (App.tsx) وهي هدف رابط «تجاوز إلى المحتوى». main متداخلة تجعل
                  التخطي غامضا وتُجبر قارئ الشاشة على الاختيار بين منطقتين. */}
        <div className="min-w-0 flex-1 py-6 lg:py-8">
          {/* صفحاتُ القسم — ولسانٌ واحدٌ لا يُعرض: من يرى «الأتعاب» وحدَها تحت «المدربون» لا يحتاج شريطا.
              ولا يُطبع: تنقّلٌ لا مستند. */}
          {place && place.section.items.length > 1 && (
            <PortalTabs
              look="chip"
              label={`صفحات ${place.section.title}`}
              className="mb-6 print:hidden"
              tabs={place.section.items.map((it) => ({
                to: it.to,
                end: it.end,
                label: it.tab,
                icon: it.icon,
                count: waiting.byTab[it.to] || undefined,
                countLabel: COUNT_LABEL_AR[it.badge ?? "inbox"],
                active: place.item.to === it.to,
              }))}
            />
          )}
          {/* ولا يُطبع: عنوانُ الشاشة يكرّر ما في ترويسة المطبوع («الطلب
              WJ-TR-…» فوق الاسم ورقمِه)، وهو عنوانُ أداةٍ لا عنوانُ مستند. */}
          <h1 className="mb-6 text-2xl font-black print:hidden">{title}</h1>
          {children}
          {/* البند ٦: أيَّ نسخةٍ تنظر إليها؟ — الجوابُ في الشاشة لا في curl */}
          <BuildStampLine />
        </div>
      </div>
    </div>
  );
}
