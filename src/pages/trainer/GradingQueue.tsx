import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  CheckCircle2, FileText, Loader2,
} from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import { apiGet } from "@/services/api";
import { fmtShortDateTimeAr } from "@/utils/format";

import { Panel } from "@/components/ui/Surface";
interface RealQueueItem {
  id: string; status: string; submittedAt: string;
  assessment: { title: string; cohort: { title: string } };
}


/** طابور تقييم الواجبات — US-09: قائمة submissions + rubric + filters + feedback + audit */
/* حُذف `LocalGradingQueue`: طابورُ تقييمٍ كامل من تسليماتٍ مولَّدة في
   المتصفّح، بدرجاتٍ وملاحظاتٍ تُكتب وتُحفظ محليا كأنها تقييمُ مدرّب. */
function RealGradingQueue() {
  const [realQueue, setRealQueue] = useState<RealQueueItem[] | null>(null);
  useEffect(() => {
    apiGet<RealQueueItem[]>("/api/trainer/grading-queue").then(setRealQueue).catch(() => setRealQueue([]));
  }, []);
  const actionable = (realQueue ?? []).filter((q) => q.status === "submitted" || q.status === "under_review");
  return (
    <TrainerLayout title="طابور التقييم">
      {realQueue === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> أحضر الطابور…
        </div>
      ) : actionable.length === 0 ? (
        <Panel className="p-10 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-teal-light-ink" />
          <h2 className="mt-4 text-lg font-black">الطابور نظيف — لا تسليمات بانتظارك</h2>
          <p className="mt-2 text-sm text-muted-foreground">كل ما وصلك قيّمته. أحسنت.</p>
          {/* الفراغ فرصة توجيه لا مساحة ميتة — خطوات تالية نافعة بدل صفحة خالية */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link
              to="/trainer/board"
              className="inline-flex min-h-11 items-center rounded-full border border-teal/40 bg-teal/10 px-5 text-sm font-bold text-teal-light transition hover:bg-teal/20"
            >
              افتح شعبي وسجّل الحضور
            </Link>
            <Link
              to="/trainer/proposals"
              className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-bold text-foreground transition hover:border-white/30 hover:text-foreground"
            >
              اقترح تحسينا على المحتوى
            </Link>
            <Link
              to="/trainer/earnings"
              className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-bold text-foreground transition hover:border-white/30 hover:text-foreground"
            >
              راجع مستحقاتي
            </Link>
          </div>
        </Panel>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">لديك {actionable.length} {actionable.length === 1 ? "تسليم يحتاج" : "تسليمات تحتاج"} تقييمك:</p>
          {actionable.map((q) => (
            <Link key={q.id} to="/trainer/board" className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/5 px-5 py-4 text-sm transition hover:border-gold/60">
              <FileText className="h-4 w-4 shrink-0 text-gold-ink" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-foreground">{q.assessment.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {q.assessment.cohort.title} · أُرسل {fmtShortDateTimeAr(q.submittedAt)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-gold px-3 py-1 text-[11px] font-black text-on-gold">قيّمه من «شعبي»</span>
            </Link>
          ))}
        </div>
      )}
    </TrainerLayout>
  );
}

/** الغلاف: جلسة مدرب حقيقية بلا هوية استعراض → الطابور الحقيقي؛ وإلا النسخة المحلية */
export default function GradingQueue() {
  return <RealGradingQueue />;
}
