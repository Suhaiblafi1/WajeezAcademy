/* صحّةُ النظام — الجوابُ عن «هل كلُّ شيءٍ يعمل؟» في صفحةٍ واحدة.

   كان السؤالُ بلا جوابٍ إلّا في سجلّات الخادم — ولم يكن للخادم سجلٌّ أصلا
   قبل هذا الفرع. وحين يشكو متعلّمٌ أنّه لم يصله إشعار، لم يكن ثمّ موضعٌ
   يقول للمالك إنّ ثلاثةً وأربعين إشعارا في الطابور منذ يومَين، وإنّ السببَ
   غيابُ عاملٍ خلفيٍّ لا عطبٌ في البريد.

   وكلُّ بندٍ هنا محسوبٌ من حالة القاعدة عند فتح الصفحة — لا عدّادٌ يُخزَّن
   فيبلى — ويقول ما يعنيه لصاحب المنصّة لا رقما مجرّدا. */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Activity, AlertTriangle, CheckCircle2, ChevronLeft, CircleHelp, Clock, Loader2, RefreshCw,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, ApiError, permissionMessage } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";

import { Panel } from "@/components/ui/Surface";
type Level = "ok" | "attention" | "broken" | "unknown";

interface HealthItem {
  key: string;
  titleAr: string;
  valueAr: string;
  level: Level;
  meaningAr: string;
  actionAr?: string;
  href?: string;
}
interface HealthGroup { titleAr: string; items: HealthItem[] }
interface Snapshot { groups: HealthGroup[]; worst: Level; checkedAt: string }

const TONE: Record<Level, { chip: string; box: string; icon: typeof AlertTriangle; labelAr: string }> = {
  broken: { chip: "bg-red-500/20 text-red-200", box: "border-red-400/35", icon: AlertTriangle, labelAr: "معطَّل" },
  attention: { chip: "bg-gold/20 text-gold-ink", box: "border-gold/30", icon: Clock, labelAr: "يحتاج نظرة" },
  ok: { chip: "bg-teal/20 text-teal-light-ink", box: "border-white/10", icon: CheckCircle2, labelAr: "سليم" },
  unknown: { chip: "bg-white/10 text-muted-foreground", box: "border-white/10", icon: CircleHelp, labelAr: "لم يُقرأ" },
};

const HEADLINE: Record<Level, string> = {
  broken: "فيه ما هو معطَّلٌ الآن — اقرأ البنودَ الحمراء أوّلا",
  attention: "لا شيءَ معطَّل، وفيه ما يحتاج نظرة",
  ok: "كلُّ ما يُقاس سليم",
  unknown: "بعضُ ما يُقاس لم يُقرأ",
};

export default function SystemHealth() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setData(await apiGet<Snapshot>("/api/admin/system-health"));
      setError("");
    } catch (e) {
      setError(permissionMessage(e, e instanceof ApiError ? e.message : "تعذّر قراءةُ حالة النظام"));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const worst = data?.worst ?? "unknown";
  const tone = TONE[worst];
  const Icon = tone.icon;
  /* عدُّ ما ليس سليما: الرقمُ في الأعلى يُغني عن مسحِ الصفحة كلِّها */
  const notOk = (data?.groups ?? []).flatMap((g) => g.items).filter((i) => i.level !== "ok").length;

  return (
    <AdminLayout title="صحّة النظام">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-6 text-muted-foreground">
          محسوبةٌ من حالة القاعدة عند فتح الصفحة — لا رقمَ محفوظا هنا.
          {data && <span className="mr-2 text-muted-foreground">آخرُ قراءة: {fmtDateTime(new Date(data.checkedAt))}</span>}
        </p>
        <button
          type="button" onClick={() => void load()} disabled={busy}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-muted-foreground transition hover:border-white/40 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />} اقرأ الآن
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs font-bold leading-6 text-red-200">{error}</p>
      )}

      {data === null && !error && (
        <Panel className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="تُقرأ الحالة" />
        </Panel>
      )}

      {data && (
        <>
          {/* الحكمُ العامّ أوّلا: ما يحتاج قرارا يُقرأ قبل التفصيل */}
          <div className={`mb-7 flex flex-wrap items-center gap-3 rounded-3xl border bg-white/[0.03] px-5 py-4 ${tone.box}`}>
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="text-sm font-black">{HEADLINE[worst]}</p>
            {notOk > 0 && (
              <span className={`rounded-full px-3 py-0.5 text-[11px] font-black tabular-nums ${tone.chip}`}>
                {notOk} بندا
              </span>
            )}
            <Activity className="mr-auto h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
          </div>

          <div className="space-y-8">
            {data.groups.map((g) => (
              <section key={g.titleAr}>
                <h2 className="mb-3 text-[11px] font-black tracking-wide text-muted-foreground">{g.titleAr}</h2>
                <ul className="grid gap-3 lg:grid-cols-2">
                  {g.items.map((item) => {
                    const t = TONE[item.level];
                    const ItemIcon = t.icon;
                    return (
                      <li key={item.key} className={`flex h-full flex-col rounded-2xl border bg-white/[0.02] p-4 ${t.box}`}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="flex items-center gap-2 text-xs font-black text-foreground">
                            <ItemIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {item.titleAr}
                          </p>
                          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-micro font-black ${t.chip}`}>{t.labelAr}</span>
                        </div>
                        <p className="mt-2 text-[13px] font-bold leading-6 text-foreground">{item.valueAr}</p>
                        <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{item.meaningAr}</p>
                        {item.actionAr && (
                          <p className="mt-2 rounded-xl border border-white/8 bg-paper/20 px-3 py-2 text-[11px] leading-5 text-foreground">
                            {item.actionAr}
                          </p>
                        )}
                        {item.href && (
                          <Link to={item.href} className="mt-3 flex items-center gap-1 text-[11px] font-bold text-teal-light-ink hover:underline">
                            افتح الشاشة <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
