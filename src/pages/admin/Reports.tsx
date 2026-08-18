import { useState } from "react";
import { BarChart3, Download, Play } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { REPORTS } from "@/data/admin-extras";

/** التقارير — فهرس بطريقة حساب كل مؤشر، تشغيل بفلاتر، تصدير CSV/XLSX (يوافق reports.routes) */
export default function AdminReports() {
  const [activeId, setActiveId] = useState(REPORTS[0].id);
  const [from, setFrom] = useState("2026-08-01");
  const [to, setTo] = useState("2026-08-18");
  const [scope, setScope] = useState("الكل");
  const [ran, setRan] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const report = REPORTS.find((r) => r.id === activeId)!;

  const run = () => {
    setRan(true);
    setNote(`شُغّل تقرير «${report.title}» — الفلاتر: ${from} إلى ${to} · النطاق: ${scope}.`);
  };

  const exportAs = (fmt: "CSV" | "XLSX") => {
    setNote(`طُلب تصدير «${report.title}» بصيغة ${fmt} — في الربط الحقيقي يولّده الخادم ويُحمّل مباشرة.`);
  };

  return (
    <AdminLayout title="التقارير — مؤشرات بطريقة حساب موثقة">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* فهرس التقارير */}
        <div className="space-y-3">
          {REPORTS.map((r) => (
            <button
              key={r.id}
              onClick={() => { setActiveId(r.id); setRan(false); setNote(null); }}
              className={`w-full cursor-pointer rounded-2xl border p-4 text-right transition ${
                r.id === activeId ? "border-[#FABC05]/50 bg-[#FABC05]/[0.06]" : "border-white/10 bg-white/[0.02] hover:border-white/25"
              }`}
            >
              <p className="flex items-center gap-2 text-sm font-black">
                <BarChart3 className="h-4 w-4 text-[#FABC05]" /> {r.title}
              </p>
              <p className="mt-1.5 text-[11px] leading-5 text-white/45">{r.method}</p>
            </button>
          ))}
        </div>

        {/* منطقة التشغيل */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-bold text-white/60">
              من
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr"
                className="mt-1 block rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:border-[#38A7B4] focus:outline-none" />
            </label>
            <label className="text-xs font-bold text-white/60">
              إلى
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr"
                className="mt-1 block rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:border-[#38A7B4] focus:outline-none" />
            </label>
            <label className="text-xs font-bold text-white/60">
              الدورة / الشعبة
              <select value={scope} onChange={(e) => setScope(e.target.value)}
                className="mt-1 block rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:border-[#38A7B4] focus:outline-none">
                {["الكل", "تحليل الأعمال — مسائية", "أساسيات البيانات — صباحية", "التسويق الرقمي — مسائية"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <button onClick={run}
              className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[#FABC05] px-5 py-2.5 text-xs font-black text-[#0D0D0D] transition hover:bg-[#FABC05]/90">
              <Play className="h-3.5 w-3.5" /> شغّل التقرير
            </button>
            <div className="mr-auto flex gap-2">
              {(["CSV", "XLSX"] as const).map((fmt) => (
                <button key={fmt} onClick={() => exportAs(fmt)} disabled={!ran}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-4 py-2.5 text-xs font-bold text-white/60 transition hover:border-[#38A7B4]/50 hover:text-[#6EC7D1] disabled:cursor-not-allowed disabled:opacity-40">
                  <Download className="h-3.5 w-3.5" /> {fmt}
                </button>
              ))}
            </div>
          </div>

          {note && <p className="mt-4 rounded-xl border border-[#38A7B4]/30 bg-[#38A7B4]/10 px-4 py-2.5 text-xs font-semibold text-[#6EC7D1]">{note}</p>}

          {ran ? (
            <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                    {report.columns.map((c) => (
                      <th key={c} className="px-4 py-3 text-xs font-black text-white/60">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, i) => (
                    <tr key={i} className="border-b border-white/5 last:border-0">
                      {row.map((cell, j) => (
                        <td key={j} className={`px-4 py-3 ${j === 0 ? "font-bold text-white/85" : "text-white/60"}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-8 text-center text-sm text-white/40">اختر الفلاتر ثم شغّل التقرير لعرض النتائج</p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
