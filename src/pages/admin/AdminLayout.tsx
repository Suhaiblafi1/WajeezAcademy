import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { Crown, Search, X } from "lucide-react";
import { sectionsFor } from "./nav-map";
import { matchesQuery } from "@/application/text/search-ar";
import NotificationBell from "@/components/NotificationBell";
import SearchChip from "@/components/SearchChip";
import ThemeToggle from "@/components/ThemeToggle";
import StaffAccountMenu from "@/components/StaffAccountMenu";
import SearchPalette from "@/components/SearchPalette";
import { useRealSession } from "@/services/session";
import { apiGet } from "@/services/api";

import BuildStampLine from "@/components/BuildStampLine";
/** إطار لوحة الإدارة والعمليات — هويّة الإداريّ من جلسته وحدها.

    حُذفت شاشة «من أنت؟» التي كانت تعرض ثلاثة أسماء إداريّين مختلَقين
    («م. عبدالله الرشيد» و«د. سارة العمري» و«أ. محمد الحربي») ليختار الداخلُ
    واحدا منها فيُحفظ في متصفّحه، ومعها سطر «نسخة تجريبية». وهي القاعدة نفسها
    التي حُذفت من بوابة المدرب: لا اسمَ يُعرض كحقيقة قبل توثيقه.

    وكانت تُصيَّر لمن جاز حارسَ المسار ولم يملك صلاحية `admin.*` أو `catalog.*`
    — أي لحساب المالية بالضبط — فلا يبلغ شاشاته ويُدعى إلى انتحال اسم. */
export default function AdminLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const { user, checked } = useRealSession();
  /* ═══ ومرشِّحٌ فوق القائمة ═══

     سبعُ مجموعاتٍ تجيب «أين أبحث؟»، ولا تُغني عن «أعرف اسمَها وأريدها الآن».
     وهو نمطُ `Quick Find` في لوحات الإدارة الكبيرة: حرفان يختصران ثمانيا
     وعشرين سطرا إلى ثلاثة. وهو **غيرُ** لوحة البحث (`Ctrl K`): تلك تبحث في
     البيانات — حسابا وشعبةً وتذكرة — وهذا يبحث في **أسماء الشاشات**.

     ولا يُحفظ في المتصفّح: مرشِّحٌ يبقى بعد إغلاق الصفحة يُخفي شاشاتٍ
     لا يعرف صاحبُها لمَ غابت. */
  const [navQuery, setNavQuery] = useState("");
  /* ═══ ما ينتظر ختمَنا — شارةٌ تبقى بعد أن يمضي الإشعار ═══

     الإشعارُ يُرسَل ساعةَ التوقيع ثمّ يمضي. ومن لم يقرأه ساعتَه لا يجد
     ما يناديه، والعقدُ الموقَّعُ يقف حتّى نختمه — وبه يُفعَّل حسابُ
     المدرّب وتُعتمَد موادُّه. فعددٌ يبقى إلى جانب «العقود» في كلّ شاشة.

     ويُجلَب مرّةً عند فتح الإطار لا دوريّا: تواترُ التوقيع بالأيّام لا
     بالثواني، ونداءٌ كلَّ نصفِ دقيقةٍ في كلّ شاشةِ إدارةٍ حِملٌ بلا مقابل.

     ويسقط صامتا: من لا يملك `trainer.contract.manage` يُردّ نداؤه،
     وشارةٌ غائبةٌ أهونُ من خطأٍ يُعرَض له في كلّ شاشة. */
  const [badges, setBadges] = useState<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    void apiGet<{ count: number }>("/api/admin/trainer-contracts/awaiting-countersign-count")
      .then((r) => { if (alive) setBadges((b) => ({ ...b, awaitingCountersign: r.count })); })
      .catch(() => { /* لا صلاحيّةَ أو لا شبكة — لا شارة، ولا خطأٌ يُعرَض */ });
    return () => { alive = false; };
  }, []);
  const location = useLocation();
  const navigate = useNavigate();

  if (!checked) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-paper text-foreground">
        <Crown className="h-10 w-10 animate-pulse text-[#FABC05]" />
      </div>
    );
  }

  const sections = sectionsFor(user?.permissions);

  /* المرشَّحُ للعرض وحدَه — و`sections` تبقى كاملةً لأنّ قائمةَ الجوّال
     وحارسَ «لا صلاحية» يقرآنها، وكلاهما لا شأنَ له بما كُتب في المرشِّح.

     ولا `useMemo`: ثمانيةٌ وعشرون بندا تُرشَّح في كلّ تصيير بلا أن يُقاس
     فرقٌ، والذاكرةُ هنا كانت **خطأً** لا تحسينا — تقع بعد ارتدادِ «لم
     تُقرأ الجلسةُ بعد»، فتُنادى الحُبيبةُ في تصييرٍ ولا تُنادى في آخر.
     وأمسكه `react-hooks/rules-of-hooks` في بوّابة دين التلويم. */
  const q = navQuery.trim();
  /* والمطابقةُ بمطابِق المنصّة لا بـ`includes` خامّ: كُتبت أوّلا حرفيّةً،
     فأظهرت المعاينةُ أنّ «مدرّب» لا يجد «طلبات المدربين» — شدّةٌ في
     الاستعلام وليست في العنوان. و`matchesQuery` يُسقط التشكيلَ ويوحّد
     الهمزةَ ويوسّع «أل»، وهو نفسُه الذي تبحث به بقيّةُ الشاشات. */
  const shown = !q ? sections
    : sections
        .map((sec) => ({ ...sec, items: sec.items.filter((it) => matchesQuery(q, [it.label, it.descAr])) }))
        .filter((sec) => sec.items.length > 0);

  /* من لا تبويبَ له لا يُترك في لوحةٍ فارغة يظنّها معطوبة */
  if (sections.every((sec) => sec.items.every((it) => it.open))) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-foreground">
        <Crown className="h-12 w-12 text-[#FABC05]" />
        <h1 className="mt-5 text-2xl font-black">لا صلاحيات مفعّلة لحسابك</h1>
        <p className="mt-2 max-w-md text-center text-sm leading-7 text-muted-foreground">
          حسابك <b className="text-foreground">{user?.displayName}</b> يدخل اللوحة، ولا صلاحية إداريّة مفعّلة عليه بعد.
          راجع مدير النظام ليمنحك ما يخصّ عملك.
        </p>
        <Link to="/" className="mt-6 text-xs text-muted-foreground hover:text-foreground">العودة للموقع العام</Link>
      </div>
    );
  }

  const linkCls = (isActive: boolean) =>
    `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold transition ${
      isActive ? "bg-gold text-on-gold" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
    }`;

  return (
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      <SearchPalette />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/90 backdrop-blur">
        <div className="shell flex h-16 items-center justify-between">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 shrink-0 object-contain" />
            <span className="hidden font-black sm:block">وجيز — الإدارة والعمليات</span>
          </Link>
          {/* جوال: القائمةُ نفسُها بأبوابها الثلاثة.

              كانت تُسطَّح: عشرونَ خيارا في قائمةٍ واحدة بلا عنوان، فأبوابُ
              الشريط الجانبيّ الثلاثة تختفي على الهاتف ويصير الاختيارُ قراءةَ
              عشرين سطرا بحثا عن واحد. و`optgroup` يُعيد التقسيمَ نفسَه —
              الأقسامُ هي أقسامُ الشريط لا تقسيمٌ ثانٍ يفترق عنه. */}
          {/* ─────────── سقفُ عرضِ القائمة — تخفيفُ ضغطٍ لا إصلاحُ عطبٍ مُثبَت ───────────

              شُكي (١٢ سبتمبر ٢٠٢٦) أنّ الترويسةَ تُقَصُّ من يسارها على
              الهاتف فيغيب طرفُها. **ولم يُعَد إنتاجُ القصّ** في متصفّحٍ بلا
              رأسٍ عند ٣٢٠ و٣٦٠ و٣٩٠: قيست حوافُّ بنود الصفّ فوقعت كلُّها
              داخلَ الإطار. والفرضيّةُ الأولى — أنّ `<select>` يرفض
              الانضغاطَ لأنّ مقاسَه الأصغرَ عرضُ أطولِ خياراته — **سقطت
              بالقياس**: انضغطت إلى ١٩٦ بكسلا من تلقائها.

              ولا يُقاس القصُّ بـ`scrollWidth`: `body` عليه `overflow-x: clip`
              (في `index.css`)، فالفائضُ يُقَصُّ ولا يصير تمريرا — ولذلك
              كان القياسُ على حوافّ البنود لا على عرض المستند.

              فما بقي هنا **احتياطٌ لا تشخيص**: القائمةُ أوسعُ بندٍ مرنٍ في
              الصفّ، وسقفُها يفرّغ نحوَ ٧٦ بكسلا لمن ضاقت شاشتُه أو كبّر
              خطَّه — ولا تخسر شيئا، فخياراتُها تُقرأ كاملةً حين تُفتح.
              وإن عاد القصُّ فالعلّةُ في غير هذا الموضع، ويُطلب معها اسمُ
              الشاشة والجهاز. */}
          <select
            aria-label="التنقل بين شاشات الإدارة"
            className="min-w-0 max-w-[7.5rem] truncate rounded-xl border border-white/15 bg-paper px-3 py-2 text-xs font-bold text-foreground sm:max-w-[12rem] lg:hidden"
            value={location.pathname}
            onChange={(e) => navigate(e.target.value)}
          >
            {sections.map((s) => (
              <optgroup key={s.title} label={s.title}>
                {s.items.map((t) => (
                  <option key={t.to} value={t.to}>{t.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
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

      <div className="shell flex items-start gap-6">
        {/* الشريط الجانبي — شاشات كبيرة */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-l border-white/10 py-6 pl-5 lg:block">
          {/* المرشِّحُ فوق المجموعات — ولا يُخفيها كلَّها بلا أن يقول لمَ */}
          <div className="relative mb-5">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            {/* `text` لا `search`: الأخيرةُ تُلحق زرَّ مسحٍ من المتصفّح
                فيقف إلى جانب زرِّنا — زرّان لفعلٍ واحد. */}
            <input
              type="text"
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="ابحث في الشاشات…"
              aria-label="ترشيح شاشات الإدارة بالاسم"
              className="w-full rounded-xl border border-white/10 bg-black/20 py-2 pe-8 ps-8 text-fine text-foreground outline-none placeholder:text-muted-foreground focus:border-teal/50"
            />
            {navQuery && (
              <button
                type="button"
                onClick={() => setNavQuery("")}
                aria-label="مسح الترشيح"
                className="absolute left-2 top-1/2 grid h-6 w-6 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {shown.map((s, i) => (
            /* ═══ الرأسُ لا يُشبه البند ═══

               كُتب أوّلا بأيقونةٍ إلى جانبه، فحاذت أيقونتُه أيقوناتِ البنود
               تحته — فقُرئ الرأسُ بندا سادسا في مجموعته. وأظهرته المعاينةُ
               الحيّة لا المراجعة.

               فسقطت الأيقونةُ من الرأس (وتبقى في دليل «كلّ الشاشات»، وهناك
               بطاقاتٌ لا صفٌّ واحد فلا تلتبس)، وحلّ محلَّها خيطٌ يفصل
               المجموعةَ عمّا قبلها. والفصلُ بفراغٍ وخطٍّ لا بزينة. */
            <div key={s.title} className={i === 0 ? "mb-6" : "mb-6 border-t border-white/[0.07] pt-5"}>
              <p className="mb-2 px-3 text-fine font-black tracking-wider text-muted-foreground">
                {s.title}
              </p>
              <nav className="space-y-1">
                {s.items.map((t) => (
                  <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => linkCls(isActive)}>
                    <t.icon className="h-4 w-4 shrink-0" />
                    {t.label}
                    {/* والعددُ يُقرأ بلسانه لا بالرقم وحدَه: «٣» إلى جانب
                        «العقود» لا تقول ماذا تعدّ لمن يسمعها بقارئ شاشة. */}
                    {!!t.badge && badges[t.badge] > 0 && (
                      <span
                        className="mr-auto grid h-5 min-w-[1.25rem] shrink-0 place-items-center rounded-full bg-[#FABC05] px-1.5 text-fine font-black tabular-nums text-[#161F1D]"
                        title={`${badges[t.badge]} عقدٍ موقَّعٍ ينتظر ختمَك واعتمادَ صاحبه`}
                      >
                        <span aria-hidden="true">{badges[t.badge]}</span>
                        <span className="sr-only">{badges[t.badge]} عقدٍ موقَّعٍ ينتظر ختمَك</span>
                      </span>
                    )}
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}

          {shown.length === 0 && (
            <p className="px-3 text-fine leading-6 text-muted-foreground">
              لا شاشةَ تطابق «{q}» — جرّب كلمةً أقصر، أو
              <button type="button" onClick={() => setNavQuery("")} className="mx-1 cursor-pointer font-bold text-teal-light-ink hover:underline">امسح الترشيح</button>
              لترى المجموعات كلَّها.
            </p>
          )}
        </aside>

        {/* ب-٢: حاوية تخطيط لا منطقة landmark — منطقة main واحدة في التطبيق

                  (App.tsx) وهي هدف رابط «تجاوز إلى المحتوى». main متداخلة تجعل

                  التخطي غامضا وتُجبر قارئ الشاشة على الاختيار بين منطقتين. */}

        <div className="min-w-0 flex-1 py-8">
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
