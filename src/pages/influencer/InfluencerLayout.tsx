/* إطارُ حساب المؤثّر — ترويستُه وشريطُه (٢٦ أكتوبر ٢٠٢٦).

   كان «حسابي» من صفحة المؤثّر يفتح إعداداتِ حساب المتعلّم بإطار بوّابة المتعلّم، فمن كان مدرّبا أيضا رأى فيها
   بطاقاتِ المدرّب — فسأل صاحبُ المنصّة: «لماذا إعداداتُ الحساب للمؤثّر فيها تفاصيلُ كمدرّب؟». فصار للمؤثّر
   بابُه (`/influencer`) وإعداداتُه بإطاره (`/influencer/account`)، وفيها بياناتُه وأمانُ حسابه وحدَها. */

import { Link } from "react-router";
import { Megaphone, Settings } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import StaffAccountMenu from "@/components/StaffAccountMenu";
import { PortalTabs, type PortalTab } from "@/components/ui/PortalTabs";
import { useRealSession } from "@/services/session";

const TABS: PortalTab[] = [
  { to: "/influencer", label: "كودي وعمولتي", icon: Megaphone, end: true },
  { to: "/influencer/account", label: "إعدادات الحساب", icon: Settings },
];

export default function InfluencerLayout({ children, title }: { children: React.ReactNode; title?: string }) {
  const { user } = useRealSession();
  return (
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-y-2 px-5 py-2">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 shrink-0 object-contain" />
            <span className="font-black">وجيز — حساب المؤثر</span>
          </Link>
          <PortalTabs tabs={TABS} label="تبويبات حساب المؤثر" look="gold" className="order-last w-full" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <StaffAccountMenu user={user} />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-5 py-8">
        {title && <h1 className="mb-6 text-2xl font-black">{title}</h1>}
        {children}
      </div>
    </div>
  );
}
