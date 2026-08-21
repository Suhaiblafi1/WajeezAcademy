/* شهاداتي — API حقيقي: شهادات المتعلم بأرقام التحقق وحالاتها، ورابط التحقق العام.

   ومع كل شهادة نموها المقيس (البند ح-٧): الشهادة وحدها تقول «حضر وأكمل»، والفرق
   المقيس يقول «كان هنا وصار هنا». فمن قِيس نموه نعرضه بأرقامه، ومن لم يُقس نعرض
   دعوة للقياس — ولا نلفّق رقما لتزيين ورقة. */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Award, BadgeCheck, Loader2, RefreshCw, Ruler, ShieldOff } from "lucide-react";
import PortalLayout from "./PortalLayout";
import { apiGet, ApiError } from "@/services/api";
import { buildGrowthSummary, type CourseGrowth, type RemeasureRecord } from "@/application/student/skill-growth";
import EmptyState from "@/components/EmptyState";

interface Cert {
  id: string; number: string; learnerName: string; courseId: string; courseVersion: number;
  enrollmentId: string;
  issuedAt: string; status: string; revocation: { reason: string; createdAt?: string } | null;
}

/** شريط النمو المقيس تحت الشهادة — أرقام محفوظة أو دعوة للقياس، لا شيء بينهما */
function GrowthStrip({ growth, enrollmentId }: { growth: CourseGrowth | null; enrollmentId: string }) {
  if (!growth) {
    return (
      <Link
        to={`/student/remeasure/${enrollmentId}`}
        className="mt-3 flex items-center gap-2 rounded-2xl border border-teal/25 bg-teal-ink/[0.06] px-3 py-2 text-[11px] font-bold text-teal-light-ink transition hover:border-teal/50"
      >
        <Ruler className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        قِس نموك في مهارات هذه الدورة ليصير مع الشهادة دليل مقيس
      </Link>
    );
  }
  return (
    <div className="mt-3 rounded-2xl border border-teal/25 bg-teal-ink/[0.06] px-3 py-2">
      <p className="flex items-center gap-2 text-[11px] font-bold text-teal-light-ink">
        <Ruler className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        نمو مقيس بعد هذه الدورة
      </p>
      <p className="mt-1 text-[11px] leading-6 tabular-nums text-white/70">
        ارتفعت {growth.improved} مهارة · بلغت المستهدف {growth.crossedTarget} · مجموع الدرجات{" "}
        {/* dir=ltr على الرقم المُوقَّع فلا يُقرأ «+4» بصورة «4+» */}
        <span dir="ltr">{growth.netPoints > 0 ? `+${growth.netPoints}` : growth.netPoints}</span>
        {growth.declined > 0 ? ` · تراجعت ${growth.declined}` : ""}
      </p>
      <Link to="/student/skills" className="mt-1 inline-block text-[11px] font-bold text-teal-light-ink underline underline-offset-4">
        التفصيل في ملف مهاراتي
      </Link>
    </div>
  );
}

export default function Certificates() {
  const [rows, setRows] = useState<Cert[]>([]);
  const [growthByCourse, setGrowthByCourse] = useState<Record<string, CourseGrowth>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRows(await apiGet<Cert[]>("/api/learner/certificates")); }
    catch (e) { setError(e instanceof ApiError ? e.message : "تعذر تحميل الشهادات"); }
    finally { setLoading(false); }
    /* النمو رفاهية على الشهادة: فشل جلبه لا يمنع عرضها ولا يُظهر خطأ */
    try {
      const g = await apiGet<{ records: RemeasureRecord[]; nameBySlug: Record<string, string> }>("/api/learner/skill-growth");
      const summary = buildGrowthSummary(g.records, g.nameBySlug);
      setGrowthByCourse(Object.fromEntries(summary.courses.map((c) => [c.courseId, c])));
    } catch { setGrowthByCourse({}); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <PortalLayout title="شهاداتي">
      {error && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" /></div>
      ) : rows.length === 0 ? (
        /* ط-٤ · الشهادة نتيجةُ إكمال لا زرٌّ يُضغط — فالتوجيه إلى ما يُقرّبها فعلا */
        <EmptyState
          icon={Award}
          titleAr="لا شهادات بعد"
          reasonAr="تُصدر الشهادة بعد تحقق قواعد الإكمال على شعبتك — حضورا وتسليمات — وتظهر هنا فور إصدارها برقم تحقق عام. ما يُقرّبها:"
          actions={[
            { to: "/student/learning", labelAr: "أكمل وحدات شعبتك", hintAr: "الحضور والتسليمات" },
            { to: "/student/pathway", labelAr: "اعرف موضعك من المسار", hintAr: "ما بقي وما تمّ" },
          ]}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((c) => (
            <article key={c.id} className={`rounded-3xl border p-6 ${c.status === "revoked" ? "border-red-500/30 bg-red-500/5" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="flex items-start justify-between gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-2xl ${c.status === "revoked" ? "bg-red-500/10 text-red-400" : "bg-gold/10 text-gold-ink"}`}>
                  {c.status === "revoked" ? <ShieldOff className="h-5 w-5" /> : <Award className="h-5 w-5" />}
                </span>
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${c.status === "revoked" ? "border-red-500/40 text-red-400" : "border-emerald-400/30 text-emerald-300"}`}>
                  {c.status === "revoked" ? "ملغاة" : "سارية"}
                </span>
              </div>
              <h3 className="mt-4 font-black">دورة <span dir="ltr" className="font-mono text-sm">{c.courseId}</span> — إصدار {c.courseVersion}</h3>
              <p className="mt-1 text-xs text-white/55">باسم: {c.learnerName}</p>
              <p className="mt-1 text-xs text-white/55">أُصدرت في {new Date(c.issuedAt).toLocaleDateString("ar")}</p>
              {c.revocation && <p className="mt-2 rounded-xl border border-red-500/30 bg-black/20 p-2 text-[11px] text-red-300">سبب الإلغاء: {c.revocation.reason}</p>}
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/8 pt-3">
                <span className="font-mono text-[11px] text-white/50" dir="ltr">{c.number}</span>
                {c.status !== "revoked" && (
                  <Link to={`/verify/${c.number}`}
                    className="flex items-center gap-1.5 rounded-full border border-teal/40 px-3 py-1 text-[11px] font-bold text-teal-light-ink transition hover:bg-teal/10">
                    <BadgeCheck className="h-3.5 w-3.5" /> صفحة التحقق العامة
                  </Link>
                )}
              </div>
              {c.status !== "revoked" && (
                <GrowthStrip growth={growthByCourse[c.courseId] ?? null} enrollmentId={c.enrollmentId} />
              )}
            </article>
          ))}
        </div>
      )}

      <button onClick={() => void load()} className="mt-6 flex cursor-pointer items-center gap-1.5 text-xs text-white/50 hover:text-white">
        <RefreshCw className="h-3.5 w-3.5" /> تحديث
      </button>
    </PortalLayout>
  );
}
