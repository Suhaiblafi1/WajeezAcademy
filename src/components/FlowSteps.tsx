import { ChevronLeft } from "lucide-react";

/** شريط «سير العمل» — يعرض سلسلة الحالات بترتيبها ومن يحرّك كل خطوة.
   يظهر أعلى الشاشات التشغيلية ليجيب: ماذا يحدث الآن؟ ومن دوره التالي؟ */
export default function FlowSteps({
  steps,
  current,
}: {
  steps: { label: string; actor: string }[];
  current?: number;
}) {
  return (
    <div className="mb-6 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="flex min-w-max items-center gap-1">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1">
            <div
              className={`rounded-xl px-3 py-1.5 text-center ${
                current === i
                  ? "border border-gold/60 bg-gold/10"
                  : i < (current ?? -1)
                    ? "border border-teal/30 bg-teal/5 opacity-70"
                    : "border border-white/10 bg-black/20"
              }`}
            >
              <p className={`text-[11px] font-black ${current === i ? "text-gold-ink" : "text-white/80"}`}>{s.label}</p>
              <p className="mt-0.5 text-[9px] text-white/40">{s.actor}</p>
            </div>
            {i < steps.length - 1 && <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-white/25" />}
          </div>
        ))}
      </div>
    </div>
  );
}
