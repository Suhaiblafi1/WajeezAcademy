/* «ما عليك الآن» — رأسُ الرئيسيّة (المهمّة ٧٢، ثمّ ١٩ أكتوبر ٢٠٢٦).

   كان «مواعيدي»: التسليماتُ التي لها أثرٌ بترتيب الزمن. وصار رأسَ الرئيسيّة كلَّه حين صارت
   الرئيسيّةُ شاشةَ يومه (الخطوة ط من خطّة تبسيط جهة المتعلّم): **قائمةٌ واحدةٌ لكلّ ما عليه
   الآن، لكلّ سطرٍ زرٌّ واحد**. كانت اللوحةُ تعرض ما عليه في أربعة ألواح — «مواعيدي» و«التالي
   الآن» و«بانتظار تسليمك» و«أحدث التنبيهات» — فيرى الواجبَ نفسَه مرّتين، واللقاءَ مرّتين،
   ولا يرى طلبا لم يكتمل دفعُه أصلا.

   فالترتيبُ ترتيبُ ما يضيع إن تأخّر: المالُ (مقعدٌ يُفرَج عنه بعد مهلته)، ثمّ لقاءٌ في
   يومه، ثمّ التسليماتُ القريبة (فات · اليوم · خلال ثلاثة أيّام)، ثمّ رسائلُ لم تُقرأ. والمالُ
   واللقاءُ والرسائلُ تأتي من اللوحة (`before` و`after`) لأنّ مصادرَها هناك، والتسليماتُ من
   الخادم (`/api/learner/deadlines`) — وهو لا يعرض إلّا ما يُقبل تسليمُه الآن (`submitVerdict`).

   ─────────── لمَ يبقى «لاحقا» منفصلا ───────────

   النوعان مختلفان في الأثر لا في الشكل فقط: موعدٌ فائتٌ يعني ورقةً لم تُصحَّح وشهادةً قد
   تتعذّر، وتسليمٌ بعد أسبوعين لا شيءَ عليه اليوم. فلو عُرضا معا بالشكل نفسِه لاعتاد المتعلّمُ
   أنّ ما في القائمة لا يُلحّ فتركه كلَّه. فالبعيدُ سطورٌ هادئةٌ تحت «لاحقا»، وبطاقاتُ الاسترجاع
   سطرٌ واحدٌ يشير إلى شاشتها — لا صفوفٌ تُغرق واجبا.

   واللوحُ يقول معناه بنفسه (`meaningAr` من الخادم): من لا موعدَ عليه يُقرأ له ذلك صريحا، فلا
   يُفهَم الفراغُ عطبا. */

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Bell, CalendarClock, CreditCard, RotateCcw, Send, Video, type LucideIcon } from "lucide-react";
import { apiGet } from "@/services/api";

import { Card, Inset, Panel } from "@/components/ui/Surface";
import type { SurfaceTone } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";

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

/** سطرٌ من خارج التسليمات — مالٌ أو لقاءٌ أو رسائل — بزرٍّ واحد */
export interface NowItem {
  key: string;
  kind: "money" | "session" | "inbox";
  titleAr: string;
  detailAr: string;
  /** داخليٌّ بـ`to`، أو خارجيٌّ بـ`href` (رابطُ اللقاء يُفتح في نافذةٍ جديدة) */
  action: { labelAr: string; to: string } | { labelAr: string; href: string; newTab?: boolean };
}

const TYPE_AR: Record<string, string> = { assignment: "واجب", quiz: "اختبار", project: "مشروع" };

/* اللونُ يتبع الأثرَ لا الشكل: الفائتُ أحمرُ، واليومُ والمالُ ذهبيّ، وما بعده هادئ.
   ولا يُعتمد على اللون وحدَه — النصُّ يقول الحالةَ أيضا (شرط ١.٤.١). */
const TASK_TONE: Record<Deadline["urgency"], SurfaceTone> = {
  overdue: "danger", today: "warn", soon: "default", later: "default",
};
const KIND: Record<NowItem["kind"], { icon: LucideIcon; tone: SurfaceTone }> = {
  money: { icon: CreditCard, tone: "warn" },
  session: { icon: Video, tone: "accent" },
  inbox: { icon: Bell, tone: "default" },
};

export default function MyDeadlines({ className = "", before = [], after = [], hideAssessmentIds = [], afterNextStep = false }: {
  className?: string;
  before?: NowItem[];
  after?: NowItem[];
  /* ═══ وتحت «خطوتك التالية» (٢٧ أكتوبر ٢٠٢٦) ═══
     صارت الرئيسيّةُ تفتح على خطوةٍ واحدة («C both»). فما تقوله البطاقةُ لا يُعاد هنا —
     كان سيُرى مرّتين في شاشةٍ شُكي من اكتظاظها — والعنوانُ يقول إنّ هذه القائمةَ ما بعدها. */
  hideAssessmentIds?: readonly string[];
  afterNextStep?: boolean;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let on = true;
    apiGet<Payload>("/api/learner/deadlines")
      .then((d) => on && setData(d))
      .catch(() => undefined) /* تعذّرُ التسليمات لا يُسقط القائمة — يبقى المالُ واللقاءُ والرسائل */
      .finally(() => on && setSettled(true));
    return () => { on = false; };
  }, []);

  if (!settled) return null;

  const tasks = (data?.items ?? []).filter((d) => !hideAssessmentIds.includes(d.assessmentId));
  const now = tasks.filter((d) => d.urgency !== "later");
  const later = tasks.filter((d) => d.urgency === "later");
  const nothingNow = before.length + now.length + after.length === 0;

  return (
    <Panel as="section" aria-labelledby="now-h" className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="now-h" className="flex items-center gap-2 text-base font-black">
          <CalendarClock className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />
          {afterNextStep
            ? nothingNow ? "لا شيء غيرها الآن" : "وما عليك غيرها"
            : nothingNow ? "لا شيء عليك الآن" : "ما عليك الآن"}
        </h2>
        {data && data.overdue > 0 && (
          <span className="rounded-full border border-rose-400/40 bg-rose-500/[0.08] px-3 py-1 text-fine font-black text-danger-ink">
            {data.overdue} فات موعده
          </span>
        )}
      </div>
      {/* والمعنى يُقال حين تفرغ القائمة — فلا يُقرأ الفراغُ عطبا. وحين تمتلئ تقوله سطورُها */}
      {data && nothingNow && !afterNextStep && <p className="mt-1 text-read leading-6 text-muted-foreground">{data.meaningAr}</p>}

      {!nothingNow && (
        <ul className="mt-4 space-y-2">
          {before.map((it) => <NowRow key={it.key} item={it} />)}
          {now.map((d) => (
            <Card as="li" key={d.assessmentId} tone={TASK_TONE[d.urgency]} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Send className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-bold leading-6">{TYPE_AR[d.type] ?? d.type}: {d.title}</p>
                  <p className="mt-0.5 text-read text-muted-foreground">
                    <span className="font-bold text-foreground">{d.dueLabelAr}</span> · {d.courseTitle}
                    {d.resubmitRequested && " · طلبت إعادة التسليم"}
                  </p>
                </div>
              </div>
              {/* الرابطُ يفتح مرحلةَ الدورة في «تعلّمي» حيث نموذجُ التسليم — لا صفحةً عامّةً
                  يبحث فيها عن واجبه */}
              <Button as={Link} size="sm" tone={d.urgency === "overdue" ? "primary" : "secondary"}
                to={`/student/learning?stage=${encodeURIComponent(d.courseId)}`}>
                افتح للتسليم
              </Button>
            </Card>
          ))}
          {after.map((it) => <NowRow key={it.key} item={it} />)}
        </ul>
      )}

      {later.length > 0 && (
        <div className="mt-5">
          <h3 className="text-read font-bold text-muted-foreground">لاحقا</h3>
          <ul className="mt-2 space-y-1.5">
            {later.map((d) => (
              <li key={d.assessmentId}>
                <Inset as={Link} interactive to={`/student/learning?stage=${encodeURIComponent(d.courseId)}`}
                  className="flex min-h-[44px] flex-wrap items-center justify-between gap-2 px-3 py-2 text-read hover:bg-white/5">
                  <span className="min-w-0 truncate">{TYPE_AR[d.type] ?? d.type}: {d.title}</span>
                  <span className="shrink-0 text-muted-foreground">{d.dueLabelAr}</span>
                </Inset>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* البطاقاتُ تُذكَر ولا تُعرَض — أثرُها مختلف، وموضعُها شاشتُها */}
      {data && data.retrievalDue > 0 && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-read text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          و{data.retrievalDue} بطاقة استرجاع استحقّت — لا موعد نهائيّ لها، لكنّها تنسى إن تباعدت.
          <Link to="/student/review" className="font-bold text-teal-light-ink underline">
            افتح «تثبيت ما تعلّمت»
          </Link>
        </p>
      )}
    </Panel>
  );
}

function NowRow({ item }: { item: NowItem }) {
  const { icon: Icon, tone } = KIND[item.kind];
  const a = item.action;
  return (
    <Card as="li" tone={tone} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-bold leading-6">{item.titleAr}</p>
          <p className="mt-0.5 text-read text-muted-foreground">{item.detailAr}</p>
        </div>
      </div>
      {"to" in a ? (
        <Button as={Link} size="sm" tone={item.kind === "inbox" ? "secondary" : "primary"} to={a.to}>{a.labelAr}</Button>
      ) : (
        <Button as="a" size="sm" tone="primary" href={a.href}
          {...(a.newTab ? { target: "_blank", rel: "noreferrer" } : {})}>
          {a.labelAr}
        </Button>
      )}
    </Card>
  );
}
