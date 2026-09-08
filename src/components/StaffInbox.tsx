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
import { AlertTriangle, ChevronLeft, Clock, Inbox, Loader2, RefreshCw } from "lucide-react";
import { apiGet, ApiError } from "@/services/api";

import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import WorkHeader from "@/components/admin/WorkHeader";
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

/* «١ بندٌ» و«٢ بندان» و«٣ بنود» و«١١ بندا» — والعددُ يُقرأ لا يُحسب.
   والبنودُ مختلفةُ الأجناس (شهادةٌ وجلسةٌ واقتراحُ تأجيل)، فالجامعُ بينها
   «بند» لا اسمُ أحدها. */
const ITEM_FORMS = { one: "بندٌ", two: "بندان", few: "بنود", many: "بندا" };

const SEVERITY_RANK: Record<InboxItem["severity"], number> = { urgent: 0, attention: 1, info: 2 };

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

  /* ما عدَدُه صفرٌ ليس بندا ينتظر: عرضُه في القائمة وعدُّه صفرا في الرأس
     يجعل الرأسَ يقول «تمّ» فوق قائمةٍ غيرِ فارغة. فالمصدرُ واحدٌ لهما. */
  const waiting = items?.filter((i) => i.count > 0) ?? [];
  const total = waiting.reduce((n, i) => n + i.count, 0);
  /* أعجلُها أوّلا: الخطرُ ثمّ ما يحتاج انتباها ثمّ الخبر، وعند التساوي
     الأكبرُ عددا — فزرُّ الرأس يفتح ما يُبدأ به فعلا لا أوّلَ ما وصل. */
  const first = [...waiting].sort((a, b) =>
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.count - a.count)[0];

  return (
    <section className="mb-8">
      {/* ── الرأسُ يقول ما يُبدأ به، والقائمةُ تفصّله ──

          كان الرأسُ عنوانا («ما ينتظرك») ولصيقةَ عددٍ بأحدَ عشرَ بكسلا، ثمّ
          شبكةَ بطاقاتٍ متساويةِ الوزن: عشرةُ بنودٍ بلا أوّل. فصار العددُ
          جملةً، وأعجلُ البنود مُسمًّى تحتها، وللزرِّ وجهةٌ واحدة. */}
      {!error && (
        <WorkHeader
          loading={items === null}
          icon={Inbox}
          count={total}
          forms={ITEM_FORMS}
          waitingAr="تنتظر قرارَك"
          stats={first ? [`أعجلُها: ${first.titleAr}`] : []}
          actionAr="افتح أعجلَها"
          to={first?.href}
          doneAr="لا شيءَ ينتظرك الآن — لا اقتراحَ تأجيلٍ ولا طلبَ شهادةٍ ولا جلسةَ ناقصةٍ هذا الأسبوع."
        />
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-black">
          <Inbox className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> ما ينتظرك
        </h2>
        <Button tone="secondary" size="sm" type="button" onClick={() => void load()} disabled={busy}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3 w-3" aria-hidden="true" />} تحديث
        </Button>
      </div>

      {error && (
        <Card as="p" tone="danger" role="alert" className="px-4 py-3 text-read font-bold text-red-200">{error}</Card>
      )}

      {waiting.length > 0 && (
        <ul className="grid gap-3 lg:grid-cols-2">
          {waiting.map((item) => {
            const tone = TONE[item.severity];
            const Icon = tone.icon;
            return (
              <li key={item.key}>
                <Link
                  to={item.href}
                  className={`flex h-full flex-col rounded-2xl border p-4 transition hover:border-white/35 ${tone.box}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex items-center gap-2 text-read font-black text-foreground">
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {item.titleAr}
                    </p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-fine font-black tabular-nums ${tone.chip}`}>
                      {item.count}
                    </span>
                  </div>
                  <p className="mt-1.5 text-read leading-5 text-muted-foreground">{item.whyAr}</p>
                  {item.sample.length > 0 && (
                    <ul className="mt-2.5 space-y-1">
                      {item.sample.map((s) => (
                        <li key={s} className="truncate text-read text-foreground">— {s}</li>
                      ))}
                    </ul>
                  )}
                  <span className="mt-3 flex items-center gap-1 text-fine font-bold text-teal-light-ink">
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
