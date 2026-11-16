/* لوحةُ ممثّل الشريك — جامعةٌ أو شركة (١٦ نوفمبر ٢٠٢٦).

   يرى فيها كشفَ شريكه وحدَه: رابطَ منحتهم، ومن أكّد بريدَه، ومن دفع، وحصّتَهم عن كلّ طلبٍ قبل أجور المدرّبين، وما صُرف
   لهم — ويُنزّله ملفّا يدقّقه (`PartnerRevenueView`). والخادم: `server/services/partner-revenue.service.ts`. */

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Handshake, Loader2, ServerOff } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import StaffAccountMenu from "@/components/StaffAccountMenu";
import { Panel } from "@/components/ui/Surface";
import { apiGet, ApiError } from "@/services/api";
import { useRealSession } from "@/services/session";
import PartnerRevenueView, { type PartnerStatement } from "@/components/partner/PartnerRevenueView";

export default function PartnerHome() {
  const { user } = useRealSession();
  const [st, setSt] = useState<PartnerStatement | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiGet<PartnerStatement>("/api/partner/me").then(setSt).catch((e) => setError(e instanceof ApiError ? e.message : "تعذر تحميل اللوحة"));
  }, []);
  return (
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-2">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 shrink-0 object-contain" />
            <span className="font-black">وجيز — لوحة الشراكة</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <StaffAccountMenu user={user} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">
        {error ? (
          <Panel className="grid place-items-center py-16 text-center">
            <ServerOff className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
            <p className="mt-3 text-read text-muted-foreground">{error}</p>
          </Panel>
        ) : !st ? (
          <p className="flex items-center gap-2 text-read text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> يحمل…</p>
        ) : (
          <>
            <h1 className="flex items-center gap-2 text-2xl font-black"><Handshake className="h-6 w-6 text-teal-light-ink" aria-hidden="true" /> {st.nameAr}</h1>
            <p className="mt-2 text-read text-muted-foreground">رابط منحتكم: <a href={st.link} dir="ltr" className="font-bold text-teal-light-ink underline">{st.link}</a></p>
            <div className="mt-6"><PartnerRevenueView st={st} csvHref="/api/partner/me.csv" /></div>
          </>
        )}
      </main>
    </div>
  );
}
