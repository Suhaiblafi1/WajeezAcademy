import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Banknote, CalendarCog, ClipboardList, LifeBuoy, Loader2,
  RotateCcw, ServerOff, Users,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet } from "@/services/api";
import { useRealSession } from "@/services/session";
import DiagnosticFunnel from "@/components/DiagnosticFunnel";
import { useAutoRefresh } from "@/services/useAutoRefresh";

/* اللوحة العليا — نظرة تنفيذية من مصادر الخادم الحقيقية فقط.
   كل بطاقة تتحمل غياب الصلاحية (403) فتختفي بهدوء بدل كسر الصفحة. */

interface EnrollReq { id: string; status: string }
interface Invoice { id: string; status: string; total: string; currency: string }
interface Refund { id: string; status: string; amount: string }
interface CohortRow { id: string; status: string }
interface TicketRow { id: string; status: string }
interface UserRow { id: string }

interface Card {
  to: string; label: string; value: string; hint: string;
  icon: typeof Banknote; tone: "gold" | "teal" | "red" | "plain";
}

const TONE: Record<Card["tone"], string> = {
  gold: "border-gold/30 bg-gold/5 text-gold-ink",
  teal: "border-teal/30 bg-teal/5 text-teal-light-ink",
  red: "border-red-500/30 bg-red-500/5 text-red-400",
  plain: "border-white/10 bg-white/[0.03] text-white",
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

    const out: Card[] = [];
    if (reqs) {
      const n = reqs.filter((r) => r.status === "pending").length;
      out.push({ to: "/admin/finance", label: "طلبات تسجيل تنتظر المراجعة", value: String(n), hint: "راجعها ووافق أو اعتذر", icon: ClipboardList, tone: n > 0 ? "gold" : "plain" });
    }
    if (invoices) {
      const paid = invoices.filter((i) => i.status === "paid");
      const byCur = new Map<string, number>();
      for (const i of paid) byCur.set(i.currency, (byCur.get(i.currency) ?? 0) + (Number(String(i.total).replace(/[^\d.-]/g, "")) || 0));
      const top = [...byCur.entries()].sort((a, b) => b[1] - a[1])[0];
      out.push({ to: "/admin/finance", label: "إيراد محصّل (فواتير مدفوعة)", value: top ? `${Math.round(top[1]).toLocaleString("ar-SA")} ${top[0]}` : "0", hint: `${paid.length} فاتورة مدفوعة`, icon: Banknote, tone: "teal" });
    }
    if (refunds) {
      const n = refunds.filter((r) => r.status === "requested").length;
      out.push({ to: "/admin/finance", label: "استردادات بانتظار التنفيذ", value: String(n), hint: n > 0 ? "تحتاج قرارك اليوم" : "لا شيء معلق", icon: RotateCcw, tone: n > 0 ? "red" : "plain" });
    }
    if (cohorts) {
      const n = cohorts.filter((c) => c.status === "open" || c.status === "running" || c.status === "full").length;
      out.push({ to: "/admin/cohorts", label: "شعب نشطة الآن", value: String(n), hint: `من أصل ${cohorts.length} شعبة`, icon: CalendarCog, tone: "plain" });
    }
    if (tickets) {
      const n = tickets.filter((t) => ["open", "in_progress", "reopened"].includes(t.status)).length;
      out.push({ to: "/admin/support", label: "تذاكر دعم تحتاج معالجة", value: String(n), hint: n > 0 ? "عملاء ينتظرون رداً" : "صندوق الدعم نظيف", icon: LifeBuoy, tone: n > 0 ? "gold" : "plain" });
    }
    if (users) {
      out.push({ to: "/admin/users", label: "مستخدمو المنصة", value: String(users.length), hint: "إدارة الأدوار والصلاحيات", icon: Users, tone: "plain" });
    }
    setFailed(false);
    setCards(out);
    setUpdatedAt(new Date());
  }, []);

  useEffect(() => { void load(); }, [load]);
  /* نبضة كل 45 ثانية طالما التبويب ظاهر — الأرقام حية دون تحديث يدوي */
  useAutoRefresh(() => void load(true), 45_000);

  const firstName = (user?.displayName ?? "").split(" ")[0] || "بك";
  const hour = new Date().getHours();
  const greet = hour < 12 ? "صباح الخير" : hour < 17 ? "طاب يومك" : "مساء الخير";

  return (
    <AdminLayout title="الرئيسية — نظرة عامة">
      <p className="mb-6 text-sm text-white/60">{greet} يا {firstName} — هذا ما يحتاج انتباهك اليوم:</p>

      {/* من أين أبدأ؟ — التسلسل التشغيلي الصحيح: محتوى ← نشر ← شعبة ← تسجيلات */}
      <div className="mb-8 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-[11px] text-white/55">
        <span className="font-black text-white/75">من أين أبدأ؟</span>
        {[
          { n: "١", label: "أضف دورة", to: "/admin/catalog" },
          { n: "٢", label: "انشرها", to: "/admin/publishing" },
          { n: "٣", label: "أنشئ شعبة وعيّن مدربها", to: "/admin/cohorts" },
          { n: "٤", label: "راجع طلبات التسجيل", to: "/admin/finance" },
        ].map((s, i) => (
          <span key={s.n} className="flex items-center gap-2">
            {i > 0 && <span className="text-white/20">←</span>}
            <Link to={s.to} className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 font-bold transition hover:border-gold/60 hover:text-gold-ink">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-gold/15 text-[10px] text-gold-ink">{s.n}</span>
              {s.label}
            </Link>
          </span>
        ))}
      </div>

      {cards === null && !failed && (
        <div className="flex items-center justify-center gap-2 py-16 text-white/50">
          <Loader2 className="h-5 w-5 animate-spin" /> أجمع لك الصورة من المصادر الحية…
        </div>
      )}

      {failed && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-white/50">
          <ServerOff className="h-5 w-5" /> تعذر الوصول للخادم — تأكد أنه يعمل ثم حدّث الصفحة.
        </div>
      )}

      <DiagnosticFunnel />

      {cards && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Link key={c.label} to={c.to} className={`rounded-3xl border p-6 transition hover:scale-[1.01] hover:border-white/30 ${TONE[c.tone]}`}>
              <p className="flex items-center gap-2 text-xs font-bold opacity-80"><c.icon className="h-4 w-4" /> {c.label}</p>
              <p className="mt-3 text-4xl font-black">{c.value}</p>
              <p className="mt-2 text-[11px] text-white/45">{c.hint}</p>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-[11px] text-white/35">
        كل الأرقام هنا حية من قاعدة البيانات وتُحدَّث تلقائيا كل 45 ثانية
        {updatedAt && ` — آخر تحديث ${updatedAt.toLocaleTimeString("ar-JO", { hour: "2-digit", minute: "2-digit" })}`}.
        التقارير التفصيلية والتصدير في شاشة «التقارير».
      </p>
    </AdminLayout>
  );
}
