/* شهاداتي — API حقيقي: شهادات المتعلم بأرقام التحقق وحالاتها، ورابط التحقق العام */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Award, BadgeCheck, Loader2, RefreshCw, ShieldOff } from "lucide-react";
import PortalLayout from "./PortalLayout";
import { apiGet, ApiError } from "@/services/api";

interface Cert {
  id: string; number: string; learnerName: string; courseId: string; courseVersion: number;
  issuedAt: string; status: string; revocation: { reason: string; createdAt?: string } | null;
}

export default function Certificates() {
  const [rows, setRows] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRows(await apiGet<Cert[]>("/api/learner/certificates")); }
    catch (e) { setError(e instanceof ApiError ? e.message : "تعذر تحميل الشهادات"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <PortalLayout title="شهاداتي">
      {error && <p className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#38A7B4]" /></div>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
          <Award className="h-12 w-12 text-white/20" />
          <h2 className="mt-4 text-xl font-black">لا شهادات بعد</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-white/55">
            تُصدر الشهادة بعد تحقق قواعد الإكمال على شعبتك — تظهر هنا فور إصدارها برقم تحقق عام.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((c) => (
            <article key={c.id} className={`rounded-3xl border p-6 ${c.status === "revoked" ? "border-red-500/30 bg-red-500/5" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="flex items-start justify-between gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-2xl ${c.status === "revoked" ? "bg-red-500/10 text-red-400" : "bg-[#FABC05]/10 text-[#FABC05]"}`}>
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
                    className="flex items-center gap-1.5 rounded-full border border-[#38A7B4]/40 px-3 py-1 text-[11px] font-bold text-[#6EC7D1] transition hover:bg-[#38A7B4]/10">
                    <BadgeCheck className="h-3.5 w-3.5" /> صفحة التحقق العامة
                  </Link>
                )}
              </div>
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
