import { Link, NavLink } from "react-router";
import { GraduationCap, Headset, Star, Wallet } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import StaffAccountMenu from "@/components/StaffAccountMenu";
import PortalSearchPalette from "@/components/PortalSearchPalette";
import { useRealSession } from "@/services/session";
import { useEffect, useState } from "react";
import { loadMyPortals } from "@/services/portals";

/** إطار بوابة المستشار: هويته من جلسته وحدها. */
export default function AdvisorLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const { user, checked } = useRealSession();
  /* الصلاحيّةُ تكفي للدخول، ولا تكفي للعمل: مديرُ النظام يملكها بلا ملفٍّ في
     هذه البوّابة، فكانت كلُّ شاشةٍ تسقط وحدَها بـ«لا ملف مستشار مرتبطا بهذا
     الحساب». فيُسأل مرّةً هنا، ويُقال مرّةً واحدة. */
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void loadMyPortals().then((p) => { if (alive) setHasProfile(p.advisor); });
    return () => { alive = false };
  }, []);
  const realAdvisor = user?.permissions.includes("advisor.cases.view") ?? false;

  if (!checked) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-paper text-foreground">
        <Headset className="h-10 w-10 animate-pulse text-[#38A7B4]" />
      </div>
    );
  }

  /* حُذفت شاشة «من أنت؟» التي كانت تعرض أربعة أسماء مستشارين مختلَقين ليختار
     الزائر واحدا منها فيدخل البوابة بهويته — وهي الأسماء نفسها التي حُذفت من
     صفحة المسار ولوحة المتعلم من قبل. */
  if (!realAdvisor) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-foreground">
        <Headset className="h-12 w-12 text-[#38A7B4]" />
        <h1 className="mt-5 text-2xl font-black">بوابة المستشار</h1>
        <p className="mt-2 max-w-md text-center text-sm leading-7 text-muted-foreground">
          تُفتح هذه البوابة بحساب مستشار معتمد، ويرى كلٌّ منهم الحالات المسندة إليه وحدها.
        </p>
        <Link to="/auth" className="mt-7 rounded-full bg-teal px-6 py-3 font-black text-on-teal transition hover:bg-teal-light">
          تسجيل الدخول
        </Link>
        <Link to="/" className="mt-6 text-xs text-muted-foreground hover:text-foreground">العودة للموقع العام</Link>
      </div>
    );
  }

  /* صفحتان أُضيفتا لاحقا لأن ما تراه الإدارة عن المستشار الآن — عمولته
     وتقييمه — لم يكن للمستشار نفسه نافذة عليه. */
  const tabs = [
    { to: "/advisor", label: "حالاتي", icon: Headset, end: true },
    { to: "/advisor/learners", label: "طلبتي", icon: GraduationCap },
    { to: "/advisor/earnings", label: "عمولتي", icon: Wallet },
    { to: "/advisor/ratings", label: "ما قيل عنّي", icon: Star },
  ];

  /* له الصلاحيّةُ ولا ملفَّ له: شاشةٌ واحدةٌ تشرح، بدل عشرِ شاشاتٍ تسقط */
  if (realAdvisor && hasProfile === false) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-foreground">
        <Headset className="h-12 w-12 text-[#38A7B4]" />
        <h1 className="mt-5 text-2xl font-black">بوّابة المستشار</h1>
        <p className="mt-2 max-w-md text-center text-sm leading-7 text-muted-foreground">
          حسابُك يملك صلاحيّاتِ المستشار، لكن لا ملفَّ مستشارٍ مرتبطا به — والحالاتُ والعمولةُ والتقييماتُ كلُّها تُقرأ من ذلك الملفّ. فلا شيءَ هنا لنعرضه لك.
        </p>
        <p className="mt-3 max-w-md text-center text-xs leading-6 text-muted-foreground">
          وهذا متوقَّعٌ لمدير النظام: بوّابةُ المستشار لمن يُرشد فعلا. لمعاينتها، ادخل بحساب مستشار.
        </p>
        <Link to="/admin" className="mt-7 rounded-full border border-white/15 px-6 py-3 font-bold text-foreground transition hover:border-white/40">
          عُد إلى لوحة الإدارة
        </Link>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 shrink-0 object-contain" />
            <span className="hidden font-black sm:block">وجيز — بوابة المستشار</span>
          </Link>
          <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition sm:px-4 ${
                    isActive ? "bg-gold text-on-gold" : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                <t.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {/* بحث سريع Ctrl+K — لجلسة المستشار الحقيقية فقط: مقيد بحالاته المسندة */}
            {realAdvisor && (
              <button
                onClick={() => window.dispatchEvent(new Event("wajeez:open-search"))}
                aria-label="بحث سريع — Ctrl+K"
                title="بحث سريع — Ctrl+K"
                className="hidden cursor-pointer items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-micro font-bold text-muted-foreground transition hover:border-teal-light/50 hover:text-teal-light-ink md:flex"
              >
                بحث… <kbd className="rounded border border-white/15 px-1.5 text-micro">Ctrl K</kbd>
              </button>
            )}
            <NotificationBell audience="staff" />
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
      {realAdvisor && <PortalSearchPalette kind="advisor" />}
    </div>
  );
}
