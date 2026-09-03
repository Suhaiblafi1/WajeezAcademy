/* «ما ينتظرك» — أوّلُ ما يراه الموظّف، وآخرُ ما يحتاج البحثَ عنه.

   قبله: عشرونَ شاشةً في القائمة، وما ينتظر قرارا موزَّعٌ عليها — اقتراحُ
   تأجيلٍ لا يُرى إلّا بفتح بطاقةِ شعبةٍ بعينها، وجلسةٌ غدا بلا مدرّبٍ لا
   يُنبّه عليها شيء (جولة ٢٠٢٦-٠٩). فكان على الموظّف أن يعرف أين يبحث قبل
   أن يعمل.

   والبنودُ محسوبةٌ من حالة القاعدة لا من طابورٍ يُكتب، فلا عدّادَ يفترق
   عمّا في الشاشة. ولا يُعرض بندٌ لا يملك صاحبُ الجلسة صلاحيّتَه — الخادمُ
   يرشّح، فالمالية لا ترى طابورَ المحتوى. */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, CheckCircle2, ChevronLeft, Clock, Inbox, Loader2, RefreshCw } from "lucide-react";
import { apiGet, ApiError } from "@/services/api";

interface InboxItem {
  key: string;
  titleAr: string;
  whyAr: string;
  count: number;
  href: string;
  severity: "urgent" | "attention" | "info";
  sample: string[];
}

const TONE: Record<InboxItem["severity"], { box: string; chip: string; icon: typeof AlertTriangle }> = {
  urgent: { box: "border-red-400/35 bg-red-500/[0.07]", chip: "bg-red-500/20 text-red-200", icon: AlertTriangle },
  attention: { box: "border-gold/30 bg-gold/[0.06]", chip: "bg-gold/20 text-gold-ink", icon: Clock },
  info: { box: "border-white/12 bg-white/[0.03]", chip: "bg-white/10 text-foreground", icon: Inbox },
};

export default function StaffInbox() {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setItems(await apiGet<InboxItem[]>("/api/staff/inbox"));
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر قراءةُ ما ينتظرك");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const total = items?.reduce((n, i) => n + i.count, 0) ?? 0;

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-black">
          <Inbox className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> ما ينتظرك
          {items !== null && total > 0 && (
            <span className="rounded-full bg-teal/20 px-2 py-0.5 text-[11px] font-black tabular-nums text-teal-light-ink">{total}</span>
          )}
        </h2>
        <button
          type="button" onClick={() => void load()} disabled={busy}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/12 px-3 py-1 text-[11px] font-bold text-muted-foreground transition hover:border-white/35 hover:text-foreground disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3 w-3" aria-hidden="true" />} تحديث
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-200">{error}</p>
      )}

      {items === null && !error && (
        <div className="grid place-items-center rounded-2xl border border-white/10 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-white/35" aria-label="يُحمَّل" />
        </div>
      )}

      {items !== null && items.length === 0 && (
        <p className="flex items-center gap-2 rounded-2xl border border-teal/25 bg-teal/[0.05] px-4 py-3.5 text-xs font-bold text-teal-light-ink">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          لا شيءَ ينتظرك الآن — لا اقتراحَ تأجيلٍ ولا طلبَ شهادةٍ ولا جلسةَ ناقصةٍ هذا الأسبوع.
        </p>
      )}

      {items !== null && items.length > 0 && (
        <ul className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => {
            const tone = TONE[item.severity];
            const Icon = tone.icon;
            return (
              <li key={item.key}>
                <Link
                  to={item.href}
                  className={`flex h-full flex-col rounded-2xl border p-4 transition hover:border-white/35 ${tone.box}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex items-center gap-2 text-xs font-black text-white">
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {item.titleAr}
                    </p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-black tabular-nums ${tone.chip}`}>
                      {item.count}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{item.whyAr}</p>
                  {item.sample.length > 0 && (
                    <ul className="mt-2.5 space-y-1">
                      {item.sample.map((s) => (
                        <li key={s} className="truncate text-[11px] text-foreground">— {s}</li>
                      ))}
                    </ul>
                  )}
                  <span className="mt-3 flex items-center gap-1 text-[11px] font-bold text-teal-light-ink">
                    افتح <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
