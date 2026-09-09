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
import { fmtDateAr } from "@/utils/format";
import { Panel, Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import ProgressRing from "@/components/ui/ProgressRing";

interface CohortSummary {
  id: string; title: string; courseTitle: string; role: string; status: string;
  startsAt: string | null; endsAt: string | null;
  learners: number; sessions: number;
  planStatus: string; done: number; total: number;
  next: { key: string; labelAr: string } | null;
}

/** حالةُ الخطّة كما تُقرأ على البطاقة — واللونُ من سلّم الأسطح */
const PLAN_AR: Record<string, { label: string; tone: "default" | "accent" | "positive" | "warn" }> = {
  draft: { label: "في التجهيز", tone: "default" },
  submitted: { label: "بانتظار الاعتماد", tone: "accent" },
  changes_requested: { label: "طُلبت تعديلات", tone: "warn" },
  approved: { label: "معتمَدة", tone: "positive" },
  published: { label: "منشورة", tone: "positive" },
  superseded: { label: "نسخةٌ قديمة", tone: "default" },
};

export default function CohortBoard() {
  const [rows, setRows] = useState<CohortSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    try { setRows(await apiGet<CohortSummary[]>("/api/trainer/cohorts/summary")); }
    catch (err) { setOffline(err instanceof ApiError ? err.message : "الخادم غير متصل — هذه الصفحة تتطلب جلسة مدرب حقيقية"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

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
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" aria-label="جارٍ التحميل" /></div>
      ) : rows.length === 0 ? (
        <Panel as="p" className="py-12 text-center text-sm text-muted-foreground">
          لا شعب مسندة إليك بعد — ستظهر هنا فور إسناد الإدارة لك.
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((c) => {
            const st = PLAN_AR[c.planStatus] ?? PLAN_AR.draft;
            const ready = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
            return (
              <Panel as="article" key={c.id} tone={st.tone} className="flex flex-col">
                <div className="flex items-start gap-4">
                  <ProgressRing value={ready} label={`${c.done}/${c.total}`} caption="تجهيز" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-read font-bold text-muted-foreground">{c.courseTitle}</p>
                    <h2 className="mt-0.5 text-lg font-black leading-snug">{c.title}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-read text-muted-foreground">
                      <span className="rounded-full border border-white/10 px-2 py-0.5 font-bold text-foreground">{st.label}</span>
                      <span>دورك: {c.role === "lead" ? "مدرب رئيس" : "مساعد"}</span>
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
                    <p className="text-read font-black leading-6">{c.startsAt ? fmtDateAr(c.startsAt) : "—"}</p>
                    <p className="text-read text-muted-foreground">تبدأ</p>
                  </Card>
                </div>

                {/* الخطوةُ التالية — من الخادم، لا تُخمَّن هنا */}
                <p className="mt-4 flex items-start gap-2 text-read leading-6">
                  <ChevronLeft className="mt-1 h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
                  {c.next ? <span><span className="font-bold text-foreground">التالي:</span> {c.next.labelAr}</span> : <span className="font-bold text-teal-light-ink">التجهيزُ مكتمل — الشعبة في التشغيل.</span>}
                </p>

                <Link to={`/trainer/cohort/${c.id}`} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-teal-deep px-5 text-sm font-black text-white transition hover:bg-teal-darker">
                  افتح الشعبة
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Panel>
            );
          })}
        </div>
      )}

      {/* اقتراحاتُ التأجيل تُقترح من صفحة الشعبة، ومآلُها وسحبُها في «جدولي» */}
      <p className="mt-6 flex items-center gap-2 text-read text-muted-foreground">
        <CalendarDays className="h-4 w-4 text-teal-ink" aria-hidden="true" />
        اقتراحاتُ تأجيل اللقاءات ومآلُها في <Link to="/trainer/schedule" className="font-bold text-teal-light-ink underline decoration-dotted underline-offset-4">جدولي</Link>.
        <Users className="ms-3 h-4 w-4 text-teal-ink" aria-hidden="true" />
        ومتعلّموك كلُّهم في <Link to="/trainer/learners" className="font-bold text-teal-light-ink underline decoration-dotted underline-offset-4">طلبتي</Link>.
      </p>
    </TrainerLayout>
  );
}
