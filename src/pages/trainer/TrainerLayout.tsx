import { useState } from "react";
import { Link, NavLink } from "react-router";
import { GraduationCap, ClipboardCheck, GitPullRequest, Users, Wallet } from "lucide-react";
import { TRAINER_IDENTITIES } from "@/data/trainer";
import { TRAINER_IDENTITY_KEY, trainerIdentity } from "./trainer-identity";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import PrototypeBanner from "@/components/PrototypeBanner";
import { useRealSession } from "@/services/session";

/** إطار بوابة المدرب: هوية المدرب + تنقل + حدوده معلنة.
   من سجّل دخوله بحساب مدرب حقيقي يتجاوز شاشة اختيار الهوية التجريبية تلقائيا. */
export default function TrainerLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const [me, setMe] = useState(trainerIdentity);
  const { user, checked } = useRealSession();
  const realTrainer = user?.permissions.includes("trainer.portal") ?? false;
  const effectiveMe = me ?? (realTrainer && user
    ? { id: user.userId, name: user.displayName, role: "مدرب — حساب حقيقي" }
    : null);

  if (!effectiveMe && !checked) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-[#0D0D0D] text-white">
        <GraduationCap className="h-10 w-10 animate-pulse text-[#6EC7D1]" />
      </div>
    );
  }

  if (!effectiveMe) {
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-[#0D0D0D] px-5 text-white">
        <GraduationCap className="h-12 w-12 text-[#6EC7D1]" />
        <h1 className="mt-5 text-2xl font-black">بوابة المدرب — من أنت؟</h1>
        <p className="mt-2 max-w-md text-center text-sm leading-7 text-white/55">
          يرى المدرب شعبه وطلابه وتسليماتهم فقط — لا بيانات دفع الطلاب ولا مسارات غير مسندة إليه.
        </p>
        <div className="mt-7 grid w-full max-w-md gap-3">
          {TRAINER_IDENTITIES.map((t) => (
            <button
              key={t.id}
              onClick={() => { localStorage.setItem(TRAINER_IDENTITY_KEY, JSON.stringify(t)); setMe(t); }}
              className="cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-right transition hover:border-[#38A7B4]/50"
            >
              <p className="font-black">{t.name}</p>
              <p className="mt-0.5 text-xs text-[#6EC7D1]">{t.role}</p>
            </button>
          ))}
        </div>
        <p className="mt-4 text-[11px] font-bold text-[#FABC05]/70">نسخة تجريبية — البيانات المعروضة محلية وليست تشغيلية</p>
        <Link to="/" className="mt-6 text-xs text-white/50 hover:text-white/70">العودة للموقع العام</Link>
      </div>
    );
  }

  const tabs = [
    { to: "/trainer", label: "شعبي", icon: Users, end: true },
    { to: "/trainer/grading", label: "طابور التقييم", icon: ClipboardCheck },
    { to: "/trainer/proposals", label: "اقتراحاتي", icon: GitPullRequest },
    { to: "/trainer/earnings", label: "مستحقاتي", icon: Wallet },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-[#0D0D0D] text-white">
      <PrototypeBanner hidden={realTrainer} />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0D0D0D]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 object-contain" />
            <span className="hidden font-black sm:block">وجيز — بوابة المدرب</span>
          </Link>
          <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition sm:px-4 ${
                    isActive ? "bg-[#38A7B4] text-[#08272B]" : "text-white/60 hover:text-white"
                  }`
                }
              >
                <t.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <ThemeToggle />
            <button
              onClick={() => { localStorage.removeItem(TRAINER_IDENTITY_KEY); setMe(null); }}
              className="cursor-pointer text-xs text-white/55 hover:text-white"
              title={realTrainer && !me ? "حسابك الحقيقي" : "تبديل المدرب"}
            >
              {effectiveMe.name}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="mb-6 text-2xl font-black">{title}</h1>
        {children}
      </main>
    </div>
  );
}
