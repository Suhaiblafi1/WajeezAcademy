import { useMemo, useState } from "react";
import { ArrowLeft, BookMarked, CheckCircle2 } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { loadContent, advanceContent, CONTENT_STAGE_LABEL, type ContentStage } from "@/data/admin";

const STAGES: ContentStage[] = ["draft", "academic_review", "qa", "published", "retired"];
const STAGE_CLS: Record<ContentStage, string> = {
  draft: "bg-white/10 text-white/50",
  academic_review: "bg-[#FABC05]/15 text-[#FABC05]",
  qa: "bg-purple-500/15 text-purple-300",
  published: "bg-[#38A7B4]/15 text-[#6EC7D1]",
  retired: "bg-white/5 text-white/30",
};

/** سير مراجعة المحتوى الأكاديمي — 16.2: Draft → Academic Review → QA → Published → Retired */
export default function ContentWorkflow() {
  const [tick, setTick] = useState(0);
  const items = useMemo(() => { void tick; return loadContent(); }, [tick]); // tick عداد إبطال مقصود بعد كل كتابة

  return (
    <AdminLayout title="المحتوى الأكاديمي — سير المراجعة والإصدارات">
      {/* شريط المراحل */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {STAGES.map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${STAGE_CLS[s]}`}>{CONTENT_STAGE_LABEL[s]}</span>
            {i < STAGES.length - 1 && <ArrowLeft className="h-3 w-3 text-white/25" />}
          </span>
        ))}
      </div>

      <div className="space-y-3">
        {items.map((c) => {
          const stageIdx = STAGES.indexOf(c.stage);
          return (
            <div key={c.id} className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex flex-wrap items-center gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#38A7B4]/10 text-[#6EC7D1]">
                  <BookMarked className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-black">{c.title} <span className="text-xs text-white/40">({c.version})</span></p>
                  <p className="mt-0.5 text-xs text-white/50">
                    المالك: {c.owner} · {c.skillsCount} مهارات مربوطة · آخر تحديث {c.updatedAt}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${STAGE_CLS[c.stage]}`}>
                  {CONTENT_STAGE_LABEL[c.stage]}
                </span>
                {c.stage !== "retired" && (
                  <button
                    onClick={() => { advanceContent(c.id); setTick(tick + 1); }}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[#38A7B4]/40 px-4 py-2 text-xs font-bold text-[#6EC7D1] transition hover:bg-[#38A7B4]/10"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {c.stage === "published" ? "أرشف" : "انقل للمرحلة التالية"}
                  </button>
                )}
              </div>
              {/* شريط تقدم المراحل */}
              <div className="mt-4 flex gap-1">
                {STAGES.map((s, i) => (
                  <span
                    key={s}
                    className={`h-1.5 flex-1 rounded-full ${i <= stageIdx ? "bg-[#38A7B4]" : "bg-white/10"}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-[11px] leading-6 text-white/55">
        إنشاء نسخة جديدة لا يغير تجربة الطلاب في النسخ السابقة — كل تسجيل مثبت على إصدار المسار وقت الشراء (20.2).
      </p>
    </AdminLayout>
  );
}
