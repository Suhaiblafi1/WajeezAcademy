/* «مواعيدي» — التسليماتُ التي لها أثرٌ، بترتيب الزمن (المهمّة ٧٢).

   لمَ لوحٌ منفصلٌ عن «مراجعتي»: النوعان مختلفان في الأثر لا في الشكل فقط.
   موعدُ تسليمٍ فائتٌ يعني ورقةً لم تُصحَّح وشهادةً قد تتعذّر؛ وبطاقةُ
   استرجاعٍ استُحقّت لا يفوتها إلّا التباعد. فلو عُرضا معا بالشكل نفسِه
   لَاعتاد المتعلّمُ أنّ ما في اللوح لا أثرَ له فتركه كلَّه — ومنه التسليم.
   فالبطاقاتُ سطرٌ واحدٌ يشير إلى شاشتها، لا صفوفٌ تُغرق واجبا.

   واللوحُ يقول معناه بنفسه (`meaningAr` من الخادم): من لا موعدَ عليه
   يُقرأ له ذلك صريحا، فلا يُفهَم الفراغُ عطبا.

   ─────────── وموضعُه في الصفحة، وحجمُه ───────────

   كان أسفلَ «زخمك»، أي **تحت الطيّة** في شاشةٍ عاديّة — فموعدٌ فات موعدُه
   يُرى بعد تمريرٍ طويل. والموعدُ أعجلُ ما في الصفحة، فصعد إلى أعلاها.

   ولأنّه صعد، لا يجوز أن يشغل صدرَ الصفحة بلا سبب: **من لا موعدَ عليه يقرأ
   سطرا واحدا**، ومن عليه مواعيدُ يرى اللوحَ كاملا. فالمساحةُ تتبع الحاجةَ
   لا العكس — وهي القاعدةُ نفسُها التي طُبِّقت على بلاغ البريد. */

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CalendarClock, RotateCcw } from "lucide-react";
import { apiGet } from "@/services/api";

import { Inset } from "@/components/ui/Surface";
interface Deadline {
  assessmentId: string;
  title: string;
  type: string;
  dueAt: string;
  dueLabelAr: string;
  urgency: "overdue" | "today" | "soon" | "later";
  enrollmentId: string;
  cohortId: string;
  courseId: string;
  cohortTitle: string;
  courseTitle: string;
  resubmitRequested: boolean;
}

interface Payload {
  items: Deadline[];
  overdue: number;
  retrievalDue: number;
  meaningAr: string;
}

const TYPE_AR: Record<string, string> = { assignment: "واجب", quiz: "اختبار", project: "مشروع" };

/* اللونُ يتبع الأثرَ لا الشكل: الفائتُ أحمرُ، واليومُ ذهبيّ، وما بعده هادئ.
   ولا يُعتمد على اللون وحدَه — النصُّ يقول الحالةَ أيضا (شرط ١.٤.١). */
const TONE: Record<Deadline["urgency"], string> = {
  overdue: "border-rose-400/40 bg-rose-500/[0.07] text-danger-ink",
  today: "border-gold/40 bg-gold/[0.07] text-gold-ink",
  soon: "border-white/15 bg-white/[0.03] text-foreground",
  later: "border-white/10 bg-white/[0.02] text-muted-foreground",
};

export default function MyDeadlines({ className = "" }: { className?: string }) {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    let on = true;
    apiGet<Payload>("/api/learner/deadlines")
      .then((d) => on && setData(d))
      .catch(() => undefined); /* لوحٌ مساندٌ لا يُسقط الصفحة إن تعذّر */
    return () => { on = false; };
  }, []);

  if (!data) return null;

  /* لا موعدَ عليه: سطرٌ واحدٌ يقول ذلك ويشير إلى المراجعة إن استُحقّت */
  if (data.items.length === 0) {
    return (
      <p className={`flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-fine leading-6 text-muted-foreground ${className}`.trim()}>
        <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {data.meaningAr}
        {data.retrievalDue > 0 && (
          <Link to="/student/review" className="font-bold text-teal-light-ink underline">
            افتح «مراجعتي»
          </Link>
        )}
      </p>
    );
  }

  return (
    <section
      aria-labelledby="deadlines-h"
      className={`rounded-3xl border border-white/10 bg-white/[0.03] p-6 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="deadlines-h" className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
          مواعيدي
        </h2>
        {data.overdue > 0 && (
          <span className="rounded-full border border-rose-400/40 bg-rose-500/[0.08] px-3 py-1 text-fine font-black text-danger-ink">
            {data.overdue} فات موعدُه
          </span>
        )}
      </div>

      <p className="mt-2 text-sm leading-7">{data.meaningAr}</p>

      <ul className="mt-4 space-y-2">
          {data.items.map((d) => (
            <li key={d.assessmentId} className={`rounded-2xl border p-3 ${TONE[d.urgency]}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    {TYPE_AR[d.type] ?? d.type}: {d.title}
                  </p>
                  <p className="mt-0.5 text-fine text-muted-foreground">
                    {d.courseTitle} · {d.cohortTitle}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {d.resubmitRequested && (
                    <span className="rounded-full border border-white/20 px-2 py-0.5 text-fine font-bold">
                      طُلبت إعادةُ التسليم
                    </span>
                  )}
                  <span className="text-xs font-black">{d.dueLabelAr}</span>
                  <Inset as={Link} interactive /* الرابطُ يفتح مرحلةَ الدورة في «تعلّمي» حيث نموذجُ
                       التسليم — لا صفحةً عامّةً يبحث فيها عن واجبه */
                    to={`/student/learning?stage=${encodeURIComponent(d.courseId)}`} className="inline-flex min-h-[44px] items-center px-3 text-xs font-bold hover:bg-white/5">
                    افتح للتسليم
                  </Inset>
                </div>
              </div>
            </li>
          ))}
      </ul>

      {/* البطاقاتُ تُذكَر ولا تُعرَض — أثرُها مختلف، وموضعُها شاشتُها */}
      {data.retrievalDue > 0 && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-fine text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          و{data.retrievalDue} بطاقةَ استرجاعٍ استُحقّت — لا موعدَ نهائيَّ لها، لكنّها تُنسى إن تباعدت.
          <Link to="/student/review" className="font-bold text-teal-light-ink underline">
            افتح «مراجعتي»
          </Link>
        </p>
      )}
    </section>
  );
}
