/* تكاليفُ الشعبة كما يراها مؤلّفُها.

   ── العطبُ ──

   المدرّبُ يُنشئ تكليفا في لوح شعبته، فتصل رسالةُ «أُنشئ التكليف» ويصل
   المسجَّلين — ولا يظهر في اللوح، ولا بعد إعادة التحميل. `TrainerCohort`
   كانت تحمل الجلساتِ والمسجَّلين والموادّ ولا تحمل تكاليف، وكلمةُ
   `assessment` ترد في اللوح مرّةً واحدةً: في `POST` الذي يُنشئها.

   فلا تأكيدَ أنّه أُنشئ، ولا ما يمنع تكرارَه مرّتَين، ولا عددَ من سلّم.
   **والمؤلِّفُ وحدَه لا يرى ما ألّف.**

   ── ولمَ ملفٌّ على حدة ──

   لأنّ اللوحَ محروسٌ بخطّ أساسٍ لطوله (`staff-screens.test.ts`): كان من
   ٧٢٤ سطرا يحمل كلَّ شيء، فنُقل منه التصحيحُ والجدولةُ وبقي الحدُّ يمنع
   عودةَ الكثافة. وهذا القسمُ من عمله لا من عمل غيره — فيُضاف قسما مستقلًّا
   لا سطورا في لوحٍ منتفخ. وخطُّ الأساس لا يُرفع ليمرّ ما يُضاف. */

import { Link } from "react-router";
import { ClipboardCheck } from "lucide-react";
import { Inset } from "@/components/ui/Surface";
import { fmtDateTimeAr } from "@/utils/format";

/** الأنواعُ الثلاثةُ التي يؤلّفها المدرّب — تُعرض معرَّبةً لا `assignment` خامّا */
const ASSESSMENT_TYPES: Record<string, string> = {
  assignment: "واجب", quiz: "اختبار", project: "مشروع تخرج",
};

export interface CohortAssessment {
  id: string; title: string; type: string; maxScore: number;
  dueAt: string | null; status: string;
  submissions: { id: string; status: string }[];
}

export default function CohortAssignments({ items, learners }: {
  items: CohortAssessment[];
  /** المسجَّلون فعلا — مقامُ «سلّم ٣ من ١٢»، فقائمةُ الانتظار لا تُسلّم */
  learners: number;
}) {
  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <h3 className="flex items-center gap-2 text-sm font-black text-foreground">
        <ClipboardCheck className="h-4 w-4 text-gold-ink" /> تكاليفُ هذه الشعبة
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-read text-muted-foreground">
          لا تكليفَ في هذه الشعبة بعد — وما تؤلّفه أدناه يظهر هنا.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((a) => {
            /* ما ينتظر المدرّبَ هو ما لم يُبتّ فيه: المقبولُ والمرفوضُ خرجا من يده */
            const waiting = a.submissions.filter(
              (s) => s.status === "submitted" || s.status === "under_review",
            ).length;
            return (
              <Inset as="li" key={a.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 text-read font-bold text-foreground">{a.title}</p>
                  <span className="shrink-0 text-fine text-muted-foreground">
                    {ASSESSMENT_TYPES[a.type] ?? a.type} · من {a.maxScore}
                  </span>
                </div>
                <p className="mt-1 text-read text-muted-foreground">
                  سلّم {a.submissions.length} من {learners}
                  {a.dueAt && <> · يُسلَّم قبل {fmtDateTimeAr(a.dueAt)}</>}
                  {waiting > 0 && (
                    <>
                      {" · "}
                      <Link to="/trainer/grading" className="font-bold text-gold-ink underline decoration-dotted underline-offset-4">
                        {waiting} ينتظر تصحيحَك
                      </Link>
                    </>
                  )}
                </p>
              </Inset>
            );
          })}
        </ul>
      )}
    </div>
  );
}
