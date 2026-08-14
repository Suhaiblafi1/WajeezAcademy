import { useMemo } from "react";
import { Link } from "react-router";
import {
  AlertTriangle, ArrowLeft, Banknote, BookOpenCheck, CalendarCog,
  GraduationCap, ShieldAlert, TrendingUp, Users,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import { execKpis, pathwayProfitability, loadExceptions } from "@/data/admin";

/** اللوحة العليا للإدارة — 16.1 + ربحية المسارات US-12 بتعريفات 21.4 الثابتة */
export default function AdminDashboard() {
  const kpis = useMemo(() => execKpis(), []);
  const profit = useMemo(() => pathwayProfitability(), []);
  const exceptions = useMemo(() => loadExceptions(), []);
  const pendingExceptions = exceptions.filter((e) => e.status === "pending").length;
  const completionRate = Math.round((kpis.completed / Math.max(1, kpis.enrolled)) * 100);

  return (
    <AdminLayout title="اللوحة العليا — نظرة تنفيذية">
      {/* الإيراد بتعريفات ثابتة */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <p className="flex items-center gap-2 text-sm font-black text-white/75">
          <Banknote className="h-4 w-4 text-[#FABC05]" /> الإيراد هذا الربع — بالتعريفات المثبتة (21.4)
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "إجمالي (Gross)", value: kpis.gross, cls: "text-white" },
            { label: "خصومات", value: kpis.discounts, cls: "text-[#FABC05]" },
            { label: "مستردات", value: kpis.refunds, cls: "text-red-400" },
            { label: "صافي (Net)", value: kpis.net, cls: "text-[#6EC7D1]" },
          ].map((x) => (
            <div key={x.label} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
              <p className={`text-2xl font-black ${x.cls}`}>{x.value.toLocaleString()}$</p>
              <p className="mt-1 text-[11px] text-white/45">{x.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* قمع التعلم — Enrolled ≠ Started ≠ Active (21.4) */}
      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="flex items-center gap-2 text-xs text-white/50"><Users className="h-4 w-4" /> مسجلون</p>
          <p className="mt-2 text-3xl font-black">{kpis.enrolled}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="flex items-center gap-2 text-xs text-white/50"><BookOpenCheck className="h-4 w-4" /> بدأوا فعلا</p>
          <p className="mt-2 text-3xl font-black">{kpis.started}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="flex items-center gap-2 text-xs text-white/50"><TrendingUp className="h-4 w-4" /> نشطون الآن</p>
          <p className="mt-2 text-3xl font-black">{kpis.active}</p>
        </div>
        <div className="rounded-2xl border border-[#38A7B4]/30 bg-[#38A7B4]/5 p-5">
          <p className="flex items-center gap-2 text-xs text-[#6EC7D1]"><GraduationCap className="h-4 w-4" /> إتمام المسارات</p>
          <p className="mt-2 text-3xl font-black text-[#6EC7D1]">{completionRate}%</p>
        </div>
      </div>

      {/* تنبيهات تشغيلية */}
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Link to="/admin/exceptions" className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 transition hover:border-red-500/60">
          <p className="flex items-center gap-2 text-xs text-red-300"><ShieldAlert className="h-4 w-4" /> استثناءات معلقة</p>
          <p className="mt-2 text-3xl font-black text-red-400">{pendingExceptions}</p>
        </Link>
        <div className="rounded-2xl border border-[#FABC05]/30 bg-[#FABC05]/5 p-5">
          <p className="flex items-center gap-2 text-xs text-[#FABC05]"><AlertTriangle className="h-4 w-4" /> طلبة معرضون للتعثر</p>
          <p className="mt-2 text-3xl font-black text-[#FABC05]">{kpis.atRisk}</p>
        </div>
        <Link to="/admin/cohorts" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[#38A7B4]/50">
          <p className="flex items-center gap-2 text-xs text-white/50"><CalendarCog className="h-4 w-4" /> شعب مفتوحة الآن</p>
          <p className="mt-2 text-3xl font-black">{kpis.openCohorts}</p>
        </Link>
      </div>

      {/* ربحية المسارات — US-12 */}
      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-black text-white/75">
            <TrendingUp className="h-4 w-4 text-[#6EC7D1]" /> ربحية المسارات — مرتبة بالهامش
          </p>
          <span className="text-[11px] text-white/40">الفترة: هذا الربع · العملة: دولار</span>
        </div>
        <div className="scrollbar-hide mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-right text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/40">
                <th className="pb-3 pr-2 font-medium">المسار</th>
                <th className="pb-3 font-medium">تسجيلات</th>
                <th className="pb-3 font-medium">إجمالي</th>
                <th className="pb-3 font-medium">خصومات</th>
                <th className="pb-3 font-medium">مسترد</th>
                <th className="pb-3 font-medium">صافي</th>
                <th className="pb-3 font-medium">تكلفة مباشرة</th>
                <th className="pb-3 font-medium">الهامش</th>
              </tr>
            </thead>
            <tbody>
              {profit.map((p) => (
                <tr key={p.id} className="border-b border-white/5 transition hover:bg-white/[0.02]">
                  <td className="max-w-[220px] py-3 pr-2 font-bold text-white/85">{p.name}</td>
                  <td className="py-3">{p.enrollments}</td>
                  <td className="py-3">{p.gross.toLocaleString()}$</td>
                  <td className="py-3 text-[#FABC05]">-{p.discounts.toLocaleString()}$</td>
                  <td className="py-3 text-red-400">-{p.refunds.toLocaleString()}$</td>
                  <td className="py-3 font-bold">{p.net.toLocaleString()}$</td>
                  <td className="py-3 text-white/60">-{p.directCost.toLocaleString()}$</td>
                  <td className="py-3">
                    <span className={`font-black ${p.marginPct >= 65 ? "text-[#6EC7D1]" : p.marginPct >= 55 ? "text-[#FABC05]" : "text-red-400"}`}>
                      {p.margin.toLocaleString()}$ ({p.marginPct}%)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-[10px] text-white/55">
          <ArrowLeft className="h-3 w-3" />
          التعريفات: الصافي = الإجمالي − الخصومات − المستردات · الهامش = الصافي − التكلفة المباشرة (أجور مدربين ومحتوى) — لا تكاليف عامة هنا.
        </p>
      </section>
    </AdminLayout>
  );
}
