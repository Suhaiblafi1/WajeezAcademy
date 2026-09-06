import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowDownRight, ArrowUpRight, Banknote, CalendarCog, ClipboardList, LifeBuoy, Loader2,
  Minus, RotateCcw, ServerOff, Users,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import StaffInbox from "@/components/StaffInbox";
import { apiGet } from "@/services/api";
import { useRealSession } from "@/services/session";
import DiagnosticFunnel from "@/components/DiagnosticFunnel";
import AdminCharts from "@/components/AdminCharts";
import { useAutoRefresh } from "@/services/useAutoRefresh";
import { countWindows, flowTrend, stockTrend, trendBadgeAr, type Trend } from "@/application/metrics/trend";
import { fmtNum, fmtTime } from "@/application/text/format-ar";
import { isLiveCohort } from "@/application/schedule/cohort-status";

/* اللوحة العليا — نظرة تنفيذية من مصادر الخادم الحقيقية فقط.
   كل بطاقة تتحمل غياب الصلاحية (403) فتختفي بهدوء بدل كسر الصفحة. */

/* الطوابع الزمنية مطلوبة لحساب الاتجاه (إد-١) — كلها موجودة في ردود الخادم */
interface EnrollReq { id: string; status: string; createdAt?: string }
/* الخادم يعيد `amount` على الفاتورة و`total` على الطلب المرتبط — كلاهما موصوف
   حتى لا يُقرأ الحقل الخاطئ صامتا كما حدث (انظر تعليق الإيراد أدناه). */
interface Invoice {
  id: string; status: string; currency: string; paidAt?: string | null
  amount?: string; total?: string; order?: { total?: string }
}
interface Refund { id: string; status: string; amount: string; createdAt?: string }
interface CohortRow { id: string; status: string }
interface TicketRow { id: string; status: string; createdAt?: string }
interface UserRow { id: string; createdAt?: string }

interface Card {
  to: string; label: string; value: string; hint: string;
  icon: typeof Banknote; tone: "gold" | "teal" | "red" | "plain";
  /* إد-١ · الاتجاه ومقارنته. كل رقم كبير هنا **طابور عمل أو إجمالي منذ البداية**،
     والاتجاه يقيس الوارد الذي يغذّيه — شيئان مختلفان. لذلك الشارة والسهم داخل
     سطر الاتجاه نفسه لا ملتصقين بالرقم: «+3» جوار «0» تُقرأ نموّا في الطابور
     وهي وصف الوارد. و`trendPrefixAr` يسمّي المقيس صراحة فلا يبقى لبس. */
  trend: Trend;
  trendPrefixAr: string;
}

const REQ_FORMS = { one: "طلب", two: "طلبان", few: "طلبات", many: "طلبا" };
const REFUND_FORMS = { one: "استرداد", two: "استردادان", few: "استردادات", many: "استردادا" };
const TICKET_FORMS = { one: "تذكرة", two: "تذكرتان", few: "تذاكر", many: "تذكرة" };
const INVOICE_FORMS = { one: "فاتورة مدفوعة", two: "فاتورتان مدفوعتان", few: "فواتير مدفوعة", many: "فاتورة مدفوعة" };
const USER_FORMS = { one: "مستخدم جديد", two: "مستخدمان جديدان", few: "مستخدمين جدد", many: "مستخدما جديدا" };

const TREND_TONE: Record<Trend["direction"], string> = {
  up: "border-emerald-400/40 text-emerald-300",
  new: "border-emerald-400/40 text-emerald-300",
  down: "border-amber-400/40 text-amber-300",
  gone: "border-amber-400/40 text-amber-300",
  flat: "border-white/20 text-muted-foreground",
  quiet: "border-white/20 text-muted-foreground",
  none: "border-white/20 text-muted-foreground",
};

function TrendArrow({ d }: { d: Trend["direction"] }) {
  if (d === "up" || d === "new") return <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />;
  if (d === "down" || d === "gone") return <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Minus className="h-3.5 w-3.5" aria-hidden="true" />;
}

/* إد-٣ · توازن الشبكة: الأساس ستة أعمدة والبطاقة تحتل عمودين، فحين يبقى في
   الصف الأخير بطاقةٌ أو بطاقتان تتمدّدان لتملأ الصف. عدد البطاقات ليس ثابتا —
   بطاقةٌ تختفي عند غياب الصلاحية (403) — وثلاثٌ ثم اثنتان موسّطتان انكسارٌ
   بصري يلفت النظر بلا سبب. */
function spanOf(index: number, total: number): string {
  const rest = total % 3;
  const lgSpan = rest === 0 || index < total - rest
    ? "lg:col-span-2"
    : rest === 1 ? "lg:col-span-6" : "lg:col-span-3";
  const smSpan = total % 2 === 1 && index === total - 1 ? "sm:col-span-2" : "";
  return `${smSpan} ${lgSpan}`;
}

const TONE: Record<Card["tone"], string> = {
  gold: "border-gold/30 bg-gold/5 text-gold-ink",
  teal: "border-teal/30 bg-teal/5 text-teal-light-ink",
  red: "border-red-500/30 bg-red-500/5 text-red-400",
  plain: "border-white/10 bg-white/[0.03] text-foreground",
};

export default function AdminDashboard() {
  const { user } = useRealSession();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  /* الجلب — silent=true للتحديث الخلفي: لا وميض سبينر ولا إخفاء للبطاقات القائمة */
  const load = useCallback(async (silent = false) => {
    const safe = <T,>(p: Promise<T>) => p.then((v) => v).catch(() => null);
    const [reqs, invoices, refunds, cohorts, tickets, users] = await Promise.all([
      safe(apiGet<EnrollReq[]>("/api/admin/enrollment-requests")),
      safe(apiGet<Invoice[]>("/api/admin/invoices")),
      safe(apiGet<Refund[]>("/api/admin/refunds")),
      safe(apiGet<CohortRow[]>("/api/admin/cohorts")),
      safe(apiGet<TicketRow[]>("/api/admin/support/tickets")),
      safe(apiGet<UserRow[]>("/api/admin/users")),
    ]);
    if (!reqs && !invoices && !cohorts) {
      if (!silent) setFailed(true); // تحديث خلفي فاشل يُبقي الأرقام القائمة
      return;
    }

    /* لحظة واحدة لكل الحسابات — كي لا تنتمي بطاقتان إلى أسبوعين مختلفين */
    const now = Date.now();
    const out: Card[] = [];
    if (reqs) {
      const n = reqs.filter((r) => r.status === "pending").length;
      const w = countWindows(reqs, (r) => r.createdAt, now);
      out.push({
        to: "/admin/finance", label: "طلبات تسجيل تنتظر المراجعة", value: String(n),
        hint: "راجعها ووافق أو اعتذر", icon: ClipboardList, tone: n > 0 ? "gold" : "plain",
        trend: flowTrend(w.current, w.previous, REQ_FORMS), trendPrefixAr: "الوارد",
      });
    }
    if (invoices) {
      const paid = invoices.filter((i) => i.status === "paid");
      const byCur = new Map<string, number>();
      /* عيب قائم كُشف عند العمل على هذه البطاقة: الفاتورة تحمل `amount` لا `total`،
         فكان `Number(undefined)` = NaN ثم 0 — الرقم الكبير يقول «0 JOD» ومخطط
         «الإيراد بالشهر» في الشاشة نفسها يقول ٢٥٠. الرقم المعلن يناقض المخطط. */
      for (const i of paid) {
        const raw = i.amount ?? i.total ?? i.order?.total;
        byCur.set(i.currency, (byCur.get(i.currency) ?? 0) + (Number(String(raw).replace(/[^\d.-]/g, "")) || 0));
      }
      const top = [...byCur.entries()].sort((a, b) => b[1] - a[1])[0];
      /* الاتجاه على عدد الفواتير المدفوعة لا على المبلغ: مبلغٌ واحدٌ كبير يقلب
         النسبة فتُقرأ نموّا وهو صفقة واحدة. العدد أصدق عن حركة التحصيل. */
      const w = countWindows(paid, (i) => i.paidAt, now);
      out.push({
        to: "/admin/finance", label: "إيراد محصّل (فواتير مدفوعة)",
        value: top ? `${fmtNum(Math.round(top[1]))} ${top[0]}` : "0",
        hint: `${paid.length} فاتورة مدفوعة — الإجمالي منذ البداية`, icon: Banknote, tone: "teal",
        trend: flowTrend(w.current, w.previous, INVOICE_FORMS), trendPrefixAr: "المحصَّل",
      });
    }
    if (refunds) {
      const n = refunds.filter((r) => r.status === "requested").length;
      const w = countWindows(refunds, (r) => r.createdAt, now);
      out.push({
        to: "/admin/finance", label: "استردادات بانتظار التنفيذ", value: String(n),
        hint: n > 0 ? "تحتاج قرارك اليوم" : "لا شيء معلق", icon: RotateCcw, tone: n > 0 ? "red" : "plain",
        trend: flowTrend(w.current, w.previous, REFUND_FORMS), trendPrefixAr: "الوارد",
      });
    }
    if (cohorts) {
      const n = cohorts.filter((c) => isLiveCohort(c.status)).length;
      /* رقمُ لحظة بلا سجل: لا نعرف كم كانت نشطة الأسبوع الماضي، فلا نخترع اتجاها */
      out.push({
        to: "/admin/cohorts", label: "شعب نشطة الآن", value: String(n),
        hint: `من أصل ${cohorts.length} شعبة`, icon: CalendarCog, tone: "plain",
        trend: stockTrend(), trendPrefixAr: "",
      });
    }
    if (tickets) {
      const n = tickets.filter((t) => ["open", "in_progress", "reopened"].includes(t.status)).length;
      const w = countWindows(tickets, (t) => t.createdAt, now);
      out.push({
        to: "/admin/support", label: "تذاكر دعم تحتاج معالجة", value: String(n),
        hint: n > 0 ? "عملاء ينتظرون رداً" : "صندوق الدعم نظيف", icon: LifeBuoy, tone: n > 0 ? "gold" : "plain",
        trend: flowTrend(w.current, w.previous, TICKET_FORMS), trendPrefixAr: "الوارد",
      });
    }
    if (users) {
      const w = countWindows(users, (u) => u.createdAt, now);
      out.push({
        to: "/admin/users", label: "مستخدمو المنصة", value: String(users.length),
        hint: "إدارة الأدوار والصلاحيات", icon: Users, tone: "plain",
        trend: flowTrend(w.current, w.previous, USER_FORMS), trendPrefixAr: "المنضمّ",
      });
    }
    setFailed(false);
    setCards(out);
    setUpdatedAt(new Date());
  }, []);

  /* استدعاء غير متزامن: لا setState يجري قبل أول await، فالتصيير
     المتتالي الذي تحذّر منه القاعدة لا يقع هنا. القاعدة لا ترى عبر
     الحدّ غير المتزامن فتَعُدّ كل دالة تنتهي بـsetState متزامنة. */
  // eslint-disable-next-line react-hooks/set-state-in-effect -- setState بعد await لا قبله
  useEffect(() => { void load(); }, [load]);
  /* نبضة كل 45 ثانية طالما التبويب ظاهر — الأرقام حية دون تحديث يدوي */
  useAutoRefresh(() => void load(true), 45_000);

  const firstName = (user?.displayName ?? "").split(" ")[0] || "بك";
  const hour = new Date().getHours();
  const greet = hour < 12 ? "صباح الخير" : hour < 17 ? "طاب يومك" : "مساء الخير";

  return (
    <AdminLayout title="الرئيسية — نظرة عامة">
      <p className="mb-6 text-sm text-muted-foreground">{greet} يا {firstName} — هذا ما يحتاج انتباهك اليوم:</p>

      {/* «ما ينتظرك» قبل العدّادات: العدّادُ يقول كم، وهذا يقول ما تعمله الآن */}
      <StaffInbox />

      {/* من أين أبدأ؟ — التسلسل التشغيلي الصحيح: محتوى ← نشر ← شعبة ← تسجيلات */}
      <div className="mb-8 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-[11px] text-muted-foreground">
        <span className="font-black text-foreground">من أين أبدأ؟</span>
        {/* الترقيمُ لاتينيّ كبقيّة أرقام اللوحة — ورقمان مختلفا الرسم في
            البطاقة الواحدة يُقرآن واجهتين مركّبتين لا واجهةً واحدة */}
        {[
          { label: "أضف دورة", to: "/admin/catalog" },
          { label: "انشرها", to: "/admin/publishing" },
          { label: "أنشئ شعبة وعيّن مدربها", to: "/admin/cohorts" },
          { label: "راجع طلبات التسجيل", to: "/admin/finance" },
        ].map((s, i) => (
          <span key={s.to} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true" className="text-muted-foreground/50">←</span>}
            {/* `py-1` كان يعطي سبعا وعشرين بكسلا — قِيس على هاتفٍ عرضُه ٣٩٠ */}
            <Link to={s.to} className="flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 font-bold transition hover:border-gold/60 hover:text-gold-ink">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-gold/15 text-micro text-gold-ink">{i + 1}</span>
              {s.label}
            </Link>
          </span>
        ))}
      </div>

      {cards === null && !failed && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> أجمع لك الصورة من المصادر الحية…
        </div>
      )}

      {failed && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-muted-foreground">
          <ServerOff className="h-5 w-5" /> تعذر الوصول للخادم — تأكد أنه يعمل ثم حدّث الصفحة.
        </div>
      )}

      <DiagnosticFunnel />
      {/* إد-٢ · مخططات من تقارير موجودة — بلا استعلام جديد */}
      <AdminCharts className="mt-6" />

      {cards && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {cards.map((c, i) => {
            const badge = trendBadgeAr(c.trend);
            return (
              <Link key={c.label} to={c.to} className={`${spanOf(i, cards.length)} rounded-3xl border p-6 transition hover:scale-[1.01] hover:border-white/30 ${TONE[c.tone]}`}>
                <p className="flex items-center gap-2 text-xs font-bold opacity-80"><c.icon className="h-4 w-4" aria-hidden="true" /> {c.label}</p>
                <p className="mt-3 text-4xl font-black">{c.value}</p>

                {/* إد-١ · سطر الاتجاه: شارة وسهم ونص «كذا مقابل كذا».
                    الرقم الموقَّع داخل dir="ltr" — «+3» في سياق عربي يُقلب «3+». */}
                <p className={`mt-3 flex flex-wrap items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[11px] leading-5 ${TREND_TONE[c.trend.direction]}`}>
                  {c.trend.showArrow && <TrendArrow d={c.trend.direction} />}
                  {badge && <span dir="ltr" className="font-black">{badge}</span>}
                  <span className="text-foreground">
                    {c.trendPrefixAr && `${c.trendPrefixAr}: `}{c.trend.sentenceAr}
                  </span>
                </p>

                <p className="mt-2 text-[11px] text-muted-foreground">{c.hint}</p>
              </Link>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-center text-[11px] text-muted-foreground">
        كل الأرقام هنا حية من قاعدة البيانات وتُحدَّث تلقائيا كل 45 ثانية
        {updatedAt && ` — آخر تحديث ${fmtTime(updatedAt)}`}.
        التقارير التفصيلية والتصدير في شاشة «التقارير».
      </p>
    </AdminLayout>
  );
}
