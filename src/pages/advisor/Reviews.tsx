import { useState } from "react";
import { CheckCircle2, GitBranch, UserCheck } from "lucide-react";
import AdvisorLayout, { advisorIdentity } from "./AdvisorLayout";
import { loadPathReviews, resolvePathReview, logAudit } from "@/data/advisor";
import { pathwayById } from "@/data/pathways";

/** طلبات مراجعة المسار المخصص — القسم 6.2: الثقة المنخفضة لا تُعطى توصية قطعية بل مراجعة بشرية */
export default function Reviews() {
  const [reviews, setReviews] = useState(loadPathReviews);
  const me = advisorIdentity();

  const act = (id: string, status: "approved" | "custom") => {
    resolvePathReview(id, status);
    logAudit(me?.name ?? "مستشار", status === "approved" ? "اعتمد المسار المقترح" : "بنى نسخة مخصصة من قالب المسار", id);
    setReviews(loadPathReviews());
  };

  return (
    <AdvisorLayout title="طلبات مراجعة المسار">
      <p className="mb-5 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-6 text-white/55">
        عندما تنخفض ثقة التشخيص أو تتعارض الإجابات، لا يعرض النظام توصية قطعية — يصلك الطلب هنا،
        فتعتمد المسار المقترح أو تبني نسخة مخصصة من القالب بعد جلستك مع الطالب.
      </p>
      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className={`rounded-3xl border p-5 ${r.status === "pending" ? "border-[#FABC05]/30 bg-[#FABC05]/5" : "border-white/10 bg-white/[0.02]"}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-black">{r.studentName}</p>
                <p className="mt-1 max-w-xl text-xs leading-6 text-white/55">{r.reason}</p>
                <p className="mt-1.5 text-[11px] text-white/40">
                  المقترح آليا: «{pathwayById(r.suggestedPathId)?.name ?? "—"}» · ثقة {r.confidence}% · {r.at}
                </p>
              </div>
              {r.status === "pending" ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => act(r.id, "approved")}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[#38A7B4] px-4 py-2 text-xs font-black text-[#08272B] transition hover:bg-[#6EC7D1]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> اعتماد المقترح
                  </button>
                  <button
                    onClick={() => act(r.id, "custom")}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[#FABC05]/50 px-4 py-2 text-xs font-black text-[#FABC05] transition hover:bg-[#FABC05]/10"
                  >
                    <GitBranch className="h-3.5 w-3.5" /> نسخة مخصصة
                  </button>
                </div>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full bg-[#38A7B4]/15 px-3 py-1.5 text-xs font-bold text-[#6EC7D1]">
                  <UserCheck className="h-3.5 w-3.5" />
                  {r.status === "approved" ? "اعتُمد المقترح" : "بُنيت نسخة مخصصة"} — موثق في السجل
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </AdvisorLayout>
  );
}
