/* «شعبي» — بطاقةٌ لكلّ شعبةٍ بحلقة تقدّمها، وصفحةُ الشعبة وراءها.

   ═══ ما كان ═══

   لوحٌ من ستّمئة سطر: كلُّ شعبةٍ طيّةٌ تُفتح على الجدولة والحضور والموادّ
   والتكاليف والرسائل دفعةً واحدة — بينما تجهيزُها (الاسمُ والمحاورُ
   والمصادرُ والاعتماد) في شاشةٍ أخرى. فمن أراد أن يعرف «أين وصلت شعبتي»
   قرأ الطيّتين ولم يجد رقما.

   ═══ القرار (٨ سبتمبر ٢٠٢٦) ═══

   «شعبي» قائمةُ بطاقات لا لوحُ عمل: كلُّ بطاقةٍ تقول حالةَ الشعبة، وكم أُنجز
   من تجهيزها (حلقةٌ من الخادم — الدالّةُ نفسُها التي تحسب قائمةَ الورشة)،
   وما الخطوةُ التالية، وكم التحق وكم لقاء. والعملُ كلُّه في صفحة الشعبة
   الواحدة بمرحلتيها. وما بقي هنا من اللوح القديم رابطٌ إلى «جدولي» حيث
   مآلُ اقتراحات التأجيل. */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, CalendarDays, ChevronLeft, Loader2, RefreshCw, ServerOff, Users } from "lucide-react";
import { apiGet, ApiError } from "@/services/api";
import TrainerLayout from "./TrainerLayout";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { trainerOrdinalNoteAr } from "@/application/learning/cohort-title";
import { boardStart } from "@/application/trainer/plan-gate";
import { Panel, Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import ProgressRing from "@/components/ui/ProgressRing";
import { usePrepCohorts } from "@/components/trainer/usePrepCohorts";
import CohortMoveBox, { type MoveRequestRow } from "@/components/trainer/CohortMoveBox";
import { boardPlace } from "@/application/trainer/board-place";
import { countAr } from "@/application/text/count-ar";

interface CohortSummary {
  id: string; title: string; courseTitle: string; role: string; status: string;
  startsAt: string | null; endsAt: string | null;
  /* يومُ خطّته قبل الاعتماد — يُقال «مقترحا» (⑩) */
  proposedStartsOn?: string | null;
  /* ترتيبُها بين شعبه في دورتها — «شعبتك الأولى» بجانب «شعبة ٤» (⑫) */
  trainerOrdinal?: number | null;
  learners: number; sessions: number;
  planStatus: string; done: number; total: number;
  /* اعتُمدت لها خطّةٌ قطّ — فهي حاليّةٌ ولو لم تُفتح بعد (`board-place.ts`) */
  approvedOnce?: boolean;
  /* فصلُها — وما بعد الفصل الذي نعمل له في «دوراتي» (`board-place.ts`، ٢١ أكتوبر ٢٠٢٦) */
  term?: { year: number; season: string } | null;
  /* «التالي» بحال الخطّة والشعبة — و`waiting` انتظارٌ لا فعل (`boardNextStep`) */
  next: { key: string; labelAr: string; waiting?: boolean } | null;
}

/** حالةُ الخطّة كما تُقرأ على البطاقة — واللونُ من سلّم الأسطح */
const PLAN_AR: Record<string, { label: string; tone: "default" | "accent" | "positive" | "warn" }> = {
  draft: { label: "في التجهيز", tone: "default" },
  submitted: { label: "بانتظار الاعتماد", tone: "accent" },
  changes_requested: { label: "طلبت تعديلات", tone: "warn" },
  approved: { label: "معتمدة", tone: "positive" },
  published: { label: "منشورة", tone: "positive" },
  superseded: { label: "نسخة قديمة", tone: "default" },
};
const PLAN_POSTPONED = { label: "مؤجّلة", tone: "default" } as const;
const COHORT_FORMS = { one: "شعبة", two: "شعبتان", few: "شعب", many: "شعبة" } as const;

export default function CohortBoard() {
  const [rows, setRows] = useState<CohortSummary[]>([]);
  /* طلباتُ نقل الشعب إلى فصلٍ آخر — المعلَّقُ منها يُرى في بطاقته (١٧ أكتوبر ٢٠٢٦) */
  const [moves, setMoves] = useState<MoveRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  /* شعبُ الإعداد تُوسَم — لا متعلّمين فيها ولا تُنشَر (٢ أكتوبر ٢٠٢٦) */
  const prepIds = usePrepCohorts();

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    try {
      const [summary, mine] = await Promise.all([
        apiGet<CohortSummary[]>("/api/trainer/cohorts/summary"),
        apiGet<MoveRequestRow[]>("/api/trainer/cohort-moves").catch(() => [] as MoveRequestRow[]),
      ]);
      setRows(summary); setMoves(mine);
    }
    catch (err) { setOffline(err instanceof ApiError ? err.message : "الخادم غير متصل"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const current = rows.filter((c) => boardPlace(c) === "current");
  const finished = rows.filter((c) => boardPlace(c) === "finished");
  const elsewhere = rows.filter((c) => boardPlace(c) === "courses").length;
  const later = rows.filter((c) => boardPlace(c) === "later").length;

  /* بطاقةُ الشعبة — والمنتهيةُ بلا نقل: لا تُنقل إلى فصل */
  const card = (c: CohortSummary, movable: boolean) => {
    /* والمؤجَّلةُ تُرى مؤجَّلةً لا «طلبت تعديلات» (٢٠ أكتوبر ٢٠٢٦) — التأجيلُ يكتب `changes_requested` */
    const st = c.next?.key === "postponed" ? PLAN_POSTPONED : PLAN_AR[c.planStatus] ?? PLAN_AR.draft;
    const ready = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
    const start = boardStart(c);
    const ordinalNote = trainerOrdinalNoteAr(c.title, c.trainerOrdinal);
    return (
      <Panel as="article" key={c.id} tone={st.tone} className="flex flex-col">
        <div className="flex items-start gap-4">
          <ProgressRing value={ready} label={`${c.done}/${c.total}`} caption="تجهيز" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-read font-bold text-muted-foreground">{c.courseTitle}</p>
            <h2 className="mt-0.5 text-lg font-black leading-snug">
              {c.title}
              {ordinalNote && <span className="font-bold text-muted-foreground"> · {ordinalNote}</span>}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-read text-muted-foreground">
              <span className="rounded-full border border-white/10 px-2 py-0.5 font-bold text-foreground">{st.label}</span>
              <span>دورك: {c.role === "lead" ? "مدرب رئيس" : "مساعد"}</span>
              {prepIds.has(c.id) && (
                <span className="rounded-full border border-gold/40 px-2 py-0.5 font-bold text-foreground">شعبة إعداد — بلا متعلّمين</span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Card className="p-2.5">
            <p className="text-lg font-black">{c.learners}</p>
            <p className="text-read text-muted-foreground">التحقوا</p>
          </Card>
          <Card className="p-2.5">
            <p className="text-lg font-black">{c.sessions}</p>
            <p className="text-read text-muted-foreground">لقاء</p>
          </Card>
          <Card className="p-2.5">
            <p className="text-read font-black leading-6">{start.at ? cohortDayAr(start.at) : "—"}</p>
            <p className="text-read text-muted-foreground">
              تبدأ{start.proposed && <> · <span className="font-bold text-gold-ink">مقترح</span></>}
            </p>
          </Card>
        </div>

        {/* الخطوةُ التالية — من الخادم، لا تُخمَّن هنا */}
        <p className="mt-4 flex items-start gap-2 text-read leading-6">
          <ChevronLeft className="mt-1 h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
          {c.next
            ? c.next.waiting
              ? <span className="text-muted-foreground">{c.next.labelAr}</span>
              : <span><span className="font-bold text-foreground">التالي:</span> {c.next.labelAr}</span>
            : <span className="font-bold text-teal-light-ink">التجهيز مكتمل — الشعبة في التشغيل.</span>}
        </p>

        {/* نقلُها إلى فصلٍ آخر — طلبٌ للإدارة لا تغييرٌ من هنا. وفي بطاقة كلّ شعبة، والإعدادُ منها
            (٢٠ أكتوبر ٢٠٢٦): كانت تُستثنى بلا سبب مكتوب، فسأل صاحبُ المنصّة «أين خيار التأجيل للفصول القادمة؟»
            واختار أن يظهر فيها كغيرها. وفصلُها من بدئها المقترح حتّى يُعتمد (`cohort-move.service.ts`).
            ثمّ صارت شعبُ الإعداد في «دوراتي» تحت دورتها ومعها بابُ تأجيلها، وبقي هنا للحاليّة (`board-place.ts`). */}
        {movable && <CohortMoveBox cohortId={c.id} status={c.status} startsAt={c.startsAt} proposedStartsOn={c.proposedStartsOn ?? null}
          pending={moves.find((m) => m.cohortId === c.id && m.status === "pending") ?? null}
          onChange={() => void load()} />}

        <Link to={`/trainer/cohort/${c.id}`} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-teal-deep px-5 text-sm font-black text-white transition hover:bg-teal-darker">
          افتح الشعبة
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Panel>
    );
  };

  return (
    <TrainerLayout title="شعبي">
      {offline ? (
        <Panel className="grid place-items-center py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول لشعبك</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
          <Button tone="secondary" onClick={() => void load()} className="mt-5">
            <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
          </Button>
        </Panel>
      ) : loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" aria-label="جار التحميل" /></div>
      ) : rows.length === 0 ? (
        <Panel as="p" className="py-12 text-center text-sm text-muted-foreground">
          لا شعب مسندة إليك بعد.
        </Panel>
      ) : (
        /* ═══ «شعبي» للحاليّة وحدَها (٢٠ أكتوبر ٢٠٢٦) ═══
           اقتراحُ صاحب المنصّة: «تبقى صفحة شعبي نظيفة لما هو حالي». فما لم تُعتمد خطّتُه قطّ — في التجهيز أو
           أُرسلت أو رُدّت أو أُجّلت — يُرى في «دوراتي» تحت دورته، ويُقال هنا عددُه وبابُه. والمنتهيةُ مطويّةٌ في
           الذيل. والقسمةُ واحدةٌ في الصفحتين (`board-place.ts`). */
        <>
          {current.length === 0 ? (
            <Panel className="py-10 text-center">
              <p className="text-read text-muted-foreground">لا شعبة حاليّة بعد.</p>
              {elsewhere > 0 && (
                <Button as={Link} to="/trainer/qualifications" tone="secondary" className="mt-4">
                  ما تعدّه في «دوراتي» ({elsewhere})
                </Button>
              )}
              {later > 0 && (
                <Button as={Link} to="/trainer/qualifications#later" tone="secondary" className="mt-4 ms-2">
                  الفصول القادمة ({later})
                </Button>
              )}
            </Panel>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {current.map((c) => card(c, true))}
            </div>
          )}
          {current.length > 0 && elsewhere > 0 && (
            <p className="mt-4 text-read text-muted-foreground">
              {`و${countAr(elsewhere, COHORT_FORMS)} تعدّها أو تنتظر قرارك في `}
              <Link to="/trainer/qualifications" className="font-bold text-teal-light-ink underline decoration-dotted underline-offset-4">«دوراتي»</Link>.
            </p>
          )}
          {/* والمؤجَّلةُ إلى فصلٍ بعد الذي نعمل له تُعدّ هنا ولا تُعرض — قسمُها في «دوراتي» (٢١ أكتوبر ٢٠٢٦) */}
          {current.length > 0 && later > 0 && (
            <p className="mt-2 text-read text-muted-foreground">
              {`و${countAr(later, COHORT_FORMS)} للفصول القادمة في `}
              <Link to="/trainer/qualifications#later" className="font-bold text-teal-light-ink underline decoration-dotted underline-offset-4">«دوراتي»</Link>.
            </p>
          )}
          {finished.length > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer text-read font-bold text-muted-foreground">منتهية ({finished.length})</summary>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {finished.map((c) => card(c, false))}
              </div>
            </details>
          )}
        </>
      )}

      {/* ولا «اقتراحات تأجيل» بعد اليوم: المدرّبُ ينقل لقاءَه من صفحة الشعبة بنفسه (١٩ أكتوبر ٢٠٢٦) */}
      <p className="mt-6 flex items-center gap-2 text-read text-muted-foreground">
        <CalendarDays className="h-4 w-4 text-teal-ink" aria-hidden="true" />
        لقاءاتك كلها في <Link to="/trainer/schedule" className="font-bold text-teal-light-ink underline decoration-dotted underline-offset-4">جدولي</Link>، وتنقل موعد لقاء من صفحة شعبته.
        <Users className="ms-3 h-4 w-4 text-teal-ink" aria-hidden="true" />
        ومتعلّموك كلّهم في <Link to="/trainer/learners" className="font-bold text-teal-light-ink underline decoration-dotted underline-offset-4">طلبتي</Link>.
      </p>
    </TrainerLayout>
  );
}
