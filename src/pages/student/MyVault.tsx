/* خزانة النواتج — ما صنعتَه، لا شريط تقدّم.
   ------------------------------------------------------------------
   كلُّ وحدة في وجيز تُعرّف ناتجا ملموسا (`evidence_artifact_ar`) — ٤٠٤ من ٤٠٤
   — وكان هذا التعريف مهدورا: لا شاشة تعرض ما أنتجه المتعلم فعلا. وهذه
   الصفحة تعرضه من مصدره الوحيد: تسليماتُه عبر `/api/learner/artifacts`.

   ولا يظهر هنا ناتجٌ لم يُسلَّم، ولا يُوصف بالاعتماد ما لم يعتمده مدرّب —
   الحالة من الخادم كما هي. */

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Award, CheckCircle2, Clock3, FileText, Loader2, RotateCcw, Sparkles } from "lucide-react";
import PortalLayout from "./PortalLayout";
import { apiGet } from "@/services/api";
import { useRealSession } from "@/services/session";
import { usePublishedContent } from "@/services/public-content";
import { courseFullById } from "@/data/courses";
import { fmtWhen } from "@/utils/format";

import { Panel, Card } from "@/components/ui/Surface";
interface Artifact {
  id: string;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  hasFile: boolean;
  textAnswer: string | null;
  moduleId: string | null;
  assessmentTitle: string;
  assessmentType: string;
  cohortTitle: string;
  courseId: string;
  courseTitleAr: string;
  grade: { score: number; maxScore: number } | null;
  feedbackAr: string | null;
}

/* حالات التسليم كما يكتبها الخادم — لا نخترع حالة رابعة */
const STATUS: Record<string, { label: string; cls: string; icon: typeof Clock3 }> = {
  submitted: { label: "سُلِّم — بانتظار مدرّبك", cls: "border-white/20 text-muted-foreground", icon: Clock3 },
  under_review: { label: "قيد المراجعة", cls: "border-gold/40 text-gold-ink", icon: Clock3 },
  resubmit_requested: { label: "طُلب تعديله", cls: "border-gold/50 text-gold-ink", icon: RotateCcw },
  accepted: { label: "معتمد", cls: "border-teal/50 text-teal-ink", icon: CheckCircle2 },
  rejected: { label: "غير مقبول", cls: "border-red-400/40 text-red-300", icon: RotateCcw },
};

export default function MyVault() {
  const { user: sessionUser, checked } = useRealSession();
  const catalogVersion = usePublishedContent();
  const [rows, setRows] = useState<Artifact[] | null>(null);

  useEffect(() => {
    if (!sessionUser) return;
    let on = true;
    apiGet<Artifact[]>("/api/learner/artifacts")
      .then((r) => { if (on) setRows(r); })
      .catch(() => { if (on) setRows([]); });
    return () => { on = false; };
  }, [sessionUser]);

  if (!checked || (sessionUser && rows === null)) {
    return (
      <PortalLayout title="أعمالي">
        <div className="grid place-items-center py-24"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" aria-label="يُحمَّل" /></div>
      </PortalLayout>
    );
  }

  const list = rows ?? [];
  const accepted = list.filter((a) => a.status === "accepted").length;

  return (
    <PortalLayout title="أعمالي">
      <Panel as="section" tone="warn" className="bg-gradient-to-b from-warmglow/30 to-transparent">
        <h2 className="flex items-center gap-2 text-lg font-black text-gold-ink">
          <Sparkles className="h-5 w-5" /> ما صنعتَه حتى الآن
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
          كلُّ محطة في وجيز تُنتج شيئا تملكه — لا درسا تشاهده. وهذه أعمالك:
          {list.length > 0
            ? ` ${list.length} عملا سلّمتَه، منها ${accepted} معتمدا من مدرّبك.`
            : " تمتلئ مع أوّل تسليم."}
        </p>
      </Panel>

      {list.length === 0 ? (
        <Panel as="section" className="mt-6 grid place-items-center border-dashed py-16 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-4 font-black">لا أعمال بعد</p>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-muted-foreground">
            أوّلُ عملٍ لك يظهر هنا فور تسليمه. افتح محطات دورتك وابدأ بالتطبيق
            العملي — فهو ما يُراجعه مدرّبك ويبقى في سيرتك.
          </p>
          <Link to="/student/learning" className="mt-5 rounded-full bg-teal px-6 py-2.5 text-sm font-black text-on-teal transition hover:bg-teal-light">
            دوراتي
          </Link>
        </Panel>
      ) : (
        <ul className="mt-6 space-y-3">
          {list.map((a) => (
            <ArtifactCard key={a.id} a={a} catalogVersion={catalogVersion} />
          ))}
        </ul>
      )}
    </PortalLayout>
  );
}

function ArtifactCard({ a, catalogVersion }: { a: Artifact; catalogVersion: number }) {
  /* وصفُ الناتج من الكتالوج: ما كان يُفترض أن تُخرجه هذه المحطة */
  void catalogVersion;
  const mod = a.moduleId ? courseFullById(a.courseId)?.modules.find((m) => m.id === a.moduleId) ?? null : null;
  const meta = STATUS[a.status] ?? { label: a.status, cls: "border-white/20 text-muted-foreground", icon: Clock3 };

  return (
    <li className={`rounded-3xl border p-5 ${a.status === "accepted" ? "border-teal/40 bg-teal/[0.04]" : "border-white/10 bg-white/[0.02]"}`}>
      <div className="flex flex-wrap items-start gap-4">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${a.status === "accepted" ? "bg-teal/20 text-teal-light-ink" : "bg-white/5 text-muted-foreground"}`}>
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-black leading-snug">{mod?.artifact ?? a.assessmentTitle}</p>
          <p className="mt-1 text-fine text-muted-foreground">
            {mod ? `${mod.title} · ` : ""}دورة {a.courseTitleAr} · سُلِّم {fmtWhen(a.submittedAt)}
          </p>
        </div>
        <span className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-fine font-bold ${meta.cls}`}>
          <meta.icon className="h-3 w-3" /> {meta.label}
        </span>
      </div>

      {(a.grade || a.feedbackAr) && (
        <Card className="mt-4 bg-paper/20">
          {a.grade && (
            <p className="flex items-center gap-2 text-xs font-black text-teal-light-ink">
              <Award className="h-3.5 w-3.5" /> {a.grade.score} من {a.grade.maxScore}
            </p>
          )}
          {a.feedbackAr && <p className="mt-2 text-xs leading-6 text-foreground">{a.feedbackAr}</p>}
        </Card>
      )}

      <Link
        to={`/student/course/${a.courseId}`}
        className="mt-3 inline-block text-fine font-bold text-teal-light-ink hover:text-foreground"
      >
        افتح محطة هذا العمل ←
      </Link>
    </li>
  );
}
