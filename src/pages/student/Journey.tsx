/* «رحلتي» — البوابةُ الواحدة: مسارٌ يُختار، ومرحلةٌ تُنقر، وعملُها أسفلَها.

   حلّت محلّ ثلاث شاشاتٍ كانت تجيب عن سؤالٍ واحد — «ما الذي أفعله الآن؟»:
   «دوراتي» (قائمةٌ مسطّحة بالشعب)، و«مساري» (الخطّة وما لم يُشترَ)، و«محطات
   الدورة» (وحداتُ الكتالوج). وقولُ صاحب المنصّة: «حاول أن تجد حلا للتشتّت
   الذي يصيب الطلبة بوجود خانة دورات وخانة مسارات؟؟ وماذا لو كان لديه
   مسارين؟ … اجعل صفحة التعلم له جميلة ومبنية على مراحل ينجزها وينتقل لما
   بعده… كشريطٍ للمسار أعلاه، وعند النقر تظهر أسفلها ما يجب أن ينجزه من دروس
   وحلقات وواجبات وقراءات ومصادر… ومشروع التخرج يكون في آخر المسار».

   والعنوانُ نفسُه (`/student/learning`) باقٍ على حاله عن قصد: إليه يعود
   المتصفّح من صفحة الدفع (`commerce.service.ts`)، وعليه روابطُ التقويم
   والإشعارات ورسائلُ بريدٍ أُرسلت. تغييرُه يكسر ما هو في الطريق الآن. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  BookOpen, CheckCircle2, CircleSlash, Loader2, RefreshCw, Route as RouteIcon,
  Send, ServerOff,
} from "lucide-react";
import PortalLayout from "./PortalLayout";
import StageRail, { CAPSTONE_ID } from "@/components/journey/StageRail";
import StageWork, { type StageWorkHandlers } from "@/components/journey/StageWork";
import StageOffer from "@/components/journey/StageOffer";
import CapstonePanel from "@/components/journey/CapstonePanel";
import HeldSeatNotice, { type HeldSeat } from "@/components/HeldSeatNotice";
import AdvisorContact from "@/components/AdvisorContact";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { useCourseCohorts } from "@/services/cohort-prices";
import { usePublishedContent } from "@/services/public-content";
import { fetchEnrollmentDetail, type EnrollmentDetail } from "@/services/enrollment-detail";
import { fetchMyRequests, requestFor, type LearnerRequest } from "@/services/learner-requests";
import {
  buildJourney, defaultTrackId,
  type JourneyPlan, type JourneyRow, type JourneyTrack,
} from "@/application/student/journey";
import { courseFullById } from "@/data/courses";
import { toast, toastError } from '@/components/Toast';

import { Panel, Card } from "@/components/ui/Surface";
/** الطلبُ كما يعرضه الشريطُ بعد العودة من صفحة الدفع */
interface PaidOrder {
  id: string;
  status: string;
  total: string | number;
  currency: string;
  items: { id: string; titleAr: string; unitPrice: string | number }[];
  invoice: { number: string; status: string } | null;
}

interface PlanRequestResult {
  requested: { courseId: string }[];
  awaiting: string[];
  alreadyRequested: string[];
}

export default function Journey() {
  const catalogVersion = usePublishedContent();
  const [params, setParams] = useSearchParams();
  /* الإلغاءُ يُقرأ إلغاءً لا نجاحا: المزوّد يبني الرابطين من `callbackUrl`
     نفسِه، فكلاهما يحمل `paid=<orderId>` — و`cancelled` أخصُّ فتُفحص أوّلا. */
  const paidOrder = params.get("paid");
  const cancelledOrder = params.get("cancelled") ? paidOrder : null;
  const stageParam = params.get("stage");
  const trackParam = params.get("track");

  const [rows, setRows] = useState<JourneyRow[] | null>(null);
  const [plan, setPlan] = useState<JourneyPlan | null>(null);
  const [held, setHeld] = useState<HeldSeat[]>([]);
  const [requests, setRequests] = useState<LearnerRequest[]>([]);
  const [offline, setOffline] = useState<string | null>(null);
  const [paid, setPaid] = useState<PaidOrder | null>(null);

  const [detail, setDetail] = useState<EnrollmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [pickedCohort, setPickedCohort] = useState<Record<string, string>>({});

  const { cohorts } = useCourseCohorts();

  /* ولا تصفيرَ عند القراءة الثانية: القائمةُ القديمة تبقى معروضةً حتى تصل
     الجديدة، فلا تنقلب الصفحةُ دوّارةً فوق ما يقرأه المتعلّم. */
  const load = useCallback(async () => {
    setOffline(null);
    try {
      const [enrolled, seats, planRes, reqs] = await Promise.all([
        apiGet<JourneyRow[]>("/api/learner/my-learning"),
        apiGet<HeldSeat[]>("/api/learner/held-seats").catch(() => [] as HeldSeat[]),
        apiGet<{ plan: JourneyPlan | null }>("/api/learner/plan").catch(() => ({ plan: null })),
        fetchMyRequests().catch(() => [] as LearnerRequest[]),
      ]);
      setRows(enrolled);
      setHeld(seats);
      setPlan(planRes.plan);
      setRequests(reqs);
    } catch (err) {
      setRows([]);
      setOffline(
        err instanceof ApiError && err.status === 401
          ? "سجّل دخولك بحسابك الحقيقي لتصل إلى رحلتك وجلساتك وواجباتك هنا."
          : err instanceof ApiError ? err.message : "الخادم غير متصل — أعد المحاولة بعد قليل",
      );
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!paidOrder || cancelledOrder) { setPaid(null); return; }
    let on = true;
    apiGet<PaidOrder[]>("/api/learner/orders")
      .then((orders) => { if (on) setPaid(orders.find((o) => o.id === paidOrder) ?? null); })
      .catch(() => undefined);
    return () => { on = false; };
  }, [paidOrder, cancelledOrder]);

  /* العائدُ من صفحة الدفع لا يُطلب منه أن يحدّث بيده: التسويةُ تصل بـwebhook
     بعد ثوانٍ أو دقائق، فتُقرأ الصفحةُ كلَّ عشر ثوانٍ لدقيقتين ثمّ يكفي —
     انتظارٌ أطولُ من ذلك حالةٌ تُراجَع لا شاشةٌ تدور. */
  useEffect(() => {
    if (!paidOrder || cancelledOrder) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (tries > 12) { clearInterval(timer); return; }
      void load();
    }, 10_000);
    return () => clearInterval(timer);
  }, [paidOrder, cancelledOrder, load]);

  /* الرحلةُ تُبنى من المملوك والخطّة — والكتالوجُ يصل بعد أوّل رسم، فالحسبةُ
     معلَّقةٌ على إصداره وإلّا بقيت على كتالوجٍ فارغ. */
  const tracks = useMemo(() => {
    void catalogVersion;
    return buildJourney(rows ?? [], plan);
  }, [rows, plan, catalogVersion]);

  /* المسارُ المعروض: ما في الرابط إن كان موجودا، وإلّا ما فيه عملٌ قائم */
  const activeTrack: JourneyTrack | null = useMemo(() => {
    if (tracks.length === 0) return null;
    /* مرحلةٌ في الرابط تفرض مسارَها: `/student/learning?stage=C-…` يأتي من
       رابطٍ قديم لصفحة الدورة، فيجب أن يفتح المسارَ الذي هي فيه. */
    if (stageParam) {
      const owner = tracks.find((t) => t.stages.some((s) => s.courseId === stageParam));
      if (owner) return owner;
    }
    return tracks.find((t) => t.id === trackParam) ?? tracks.find((t) => t.id === defaultTrackId(tracks)) ?? tracks[0];
  }, [tracks, trackParam, stageParam]);

  /* المرحلةُ المعروضة: ما في الرابط، وإلّا «أنت هنا» */
  const selectedId = useMemo(() => {
    if (!activeTrack) return "";
    if (stageParam && activeTrack.stages.some((s) => s.courseId === stageParam)) return stageParam;
    if (stageParam === CAPSTONE_ID && activeTrack.capstoneAr) return CAPSTONE_ID;
    const i = activeTrack.currentIndex;
    if (i >= 0 && activeTrack.stages[i]) return activeTrack.stages[i].courseId;
    /* أنجز مراحلَه كلَّها: المشروعُ الختاميّ هو ما بقي له */
    return activeTrack.capstoneAr ? CAPSTONE_ID : (activeTrack.stages[0]?.courseId ?? "");
  }, [activeTrack, stageParam]);

  const stage = activeTrack?.stages.find((s) => s.courseId === selectedId) ?? null;

  /* تفصيلُ التسجيل يُقرأ للمرحلة المفتوحة وحدَها — لا لكلّ مراحل المسار */
  useEffect(() => {
    const enrollmentId = stage?.enrollmentId;
    if (!enrollmentId) { setDetail(null); return; }
    let on = true;
    setDetailLoading(true);
    fetchEnrollmentDetail(enrollmentId)
      .then((d) => { if (on) setDetail(d); })
      .catch((e) => {
        if (!on) return;
        setDetail(null);
        toastError(e instanceof ApiError ? e.message : "تعذّر فتح محتوى هذه المرحلة");
      })
      .finally(() => { if (on) setDetailLoading(false); });
    return () => { on = false; };
  }, [stage?.enrollmentId]);

  const select = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("stage", id);
    if (activeTrack) next.set("track", activeTrack.id);
    /* شريطُ الدفع لا يُعاد إظهاره عند كلّ نقرة */
    next.delete("paid");
    next.delete("cancelled");
    setParams(next, { replace: true });
  };

  const switchTrack = (trackId: string) => {
    const next = new URLSearchParams(params);
    next.set("track", trackId);
    next.delete("stage");
    next.delete("paid");
    next.delete("cancelled");
    setParams(next, { replace: true });
  };

  const reloadDetail = useCallback(async () => {
    await load();
    if (stage?.enrollmentId) {
      try { setDetail(await fetchEnrollmentDetail(stage.enrollmentId)); } catch { /* القراءةُ التالية تُصحّح */ }
    }
  }, [load, stage?.enrollmentId]);

  const submit = async (assessmentId: string, isResubmit: boolean) => {
    const text = (answers[assessmentId] ?? "").trim();
    if (busy || !text) return;
    setBusy(assessmentId);
    try {
      await apiPost(`/api/learner/assessments/${assessmentId}/${isResubmit ? "resubmit" : "submissions"}`, { textAnswer: text });
      setAnswers((prev) => ({ ...prev, [assessmentId]: "" }));
      toast(isResubmit ? "أُعيد التسليم — سيراجعه مدرّبك" : "سُلّم الواجب — سيراجعه مدرّبك");
      await reloadDetail();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "تعذّر التسليم");
    } finally {
      setBusy(null);
    }
  };

  const submitQuiz = async (assessmentId: string, responses: { itemId: string; answer: string }[]) => {
    if (busy || responses.length === 0) return;
    setBusy(assessmentId);
    try {
      await apiPost(`/api/learner/assessments/${assessmentId}/attempts`, { responses });
      toast("سُلّمت إجاباتك — تُقيَّم وتظهر درجتك هنا");
      await reloadDetail();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "تعذّر تسليم الاختبار");
    } finally {
      setBusy(null);
    }
  };

  const handlers: StageWorkHandlers = {
    answers, setAnswers, busy,
    onSubmit: submit,
    onSubmitQuiz: submitQuiz,
    onChanged: () => { void reloadDetail(); },
  };

  /* مقاعدُ دُفع ثمنُها ولم تصر تسجيلا، ولا مرحلةَ لها في المسار المعروض —
     تُقال أعلى الصفحة، وما له مرحلةٌ يُقال في موضعها. */
  const stagedCourseIds = new Set(activeTrack?.stages.map((s) => s.courseId) ?? []);
  const looseHeld = held.filter((h) => !stagedCourseIds.has(h.courseId));
  const heldOf = new Map(held.map((h) => [h.courseId, h]));

  return (
    <PortalLayout title="رحلتي">
      <div className="mx-auto max-w-4xl">
        {cancelledOrder && (
          <div className="mb-5 rounded-2xl border border-gold/40 bg-gold/[0.07] px-4 py-3.5">
            <p className="flex items-center gap-2 text-sm font-black text-gold-ink">
              <CircleSlash className="h-4 w-4 shrink-0" /> لم تكتمل دفعتك — ولم يُخصم منك شيء
            </p>
            <p className="mt-1.5 text-[12px] leading-6 text-muted-foreground">
              طلبك محفوظ كما تركته. أكمل الدفع متى شئت من{" "}
              <Link to="/student/billing" className="font-bold text-gold-ink underline underline-offset-4">الفواتير</Link>
              {" "}— ولن تفقد مقعدك ما دامت الشعبة مفتوحة.
            </p>
          </div>
        )}
        {paidOrder && !cancelledOrder && (
          <div className="mb-5 rounded-2xl border border-teal/40 bg-teal/10 px-4 py-3.5">
            <p className="flex items-center gap-2 text-sm font-black text-teal-light-ink">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> شكرا لك — عدنا بك إلى رحلتك
            </p>
            {paid && (
              <div className="mt-3 rounded-xl border border-white/10 bg-paper/20 p-3.5">
                <ul className="space-y-1">
                  {paid.items.map((it) => (
                    <li key={it.id} className="flex items-start justify-between gap-3 text-[12px]">
                      <span className="min-w-0 text-foreground">{it.titleAr}</span>
                      {/* الهديّةُ تُقرأ هديّةً لا صفرا — صفرٌ في فاتورةٍ يُقرأ عطبا */}
                      <span dir="ltr" className="shrink-0 font-bold text-muted-foreground">
                        {Number(it.unitPrice) === 0 ? "هديّة" : `${Number(it.unitPrice).toLocaleString("en-US")} ${paid.currency}`}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2.5 flex items-end justify-between border-t border-white/10 pt-2">
                  <span className="text-[11px] text-muted-foreground">
                    {paid.invoice ? <>فاتورة <span dir="ltr" className="font-mono">{paid.invoice.number}</span></> : "المجموع المدفوع"}
                  </span>
                  <span dir="ltr" className="text-lg font-black text-foreground">
                    {Number(paid.total).toLocaleString("en-US")} {paid.currency}
                  </span>
                </div>
              </div>
            )}
            <p className="mt-2.5 text-[12px] leading-6 text-muted-foreground">
              نؤكّد دفعتك مع البنك، ومراحلُك تظهر أدناه فور تأكيدها — عادةً خلال دقائق.
              وتفصيل الفاتورة في <Link to="/student/billing" className="font-bold text-teal-light-ink underline underline-offset-4">الفواتير</Link>.
            </p>
          </div>
        )}

        {looseHeld.length > 0 && (
          <div className="mb-5 space-y-3">
            {looseHeld.map((seat) => <HeldSeatNotice key={seat.requestId} seat={seat} />)}
          </div>
        )}

        {offline ? (
          <Panel className="grid place-items-center py-20 text-center">
            <ServerOff className="h-12 w-12 text-muted-foreground/50" />
            <h2 className="mt-4 text-xl font-black">لا يمكن الوصول لرحلتك</h2>
            <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
            <button
              onClick={() => void load()}
              className="mt-5 flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-xs font-bold text-foreground hover:border-white/40"
            >
              <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
            </button>
          </Panel>
        ) : rows === null ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-ink" aria-label="يُحمَّل" /></div>
        ) : !activeTrack ? (
          <EmptyJourney />
        ) : (
          <>
            {/* مسارٌ أو أكثر: المبدّلُ يظهر حين يكون له أكثرُ من واحد — وهو
                جوابُ «ماذا لو كان لديه مسارين»، لا شاشةٌ تخلطهما. */}
            {tracks.length > 1 && (
              <nav aria-label="مساراتك" className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {tracks.map((t) => {
                  const on = t.id === activeTrack.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => switchTrack(t.id)}
                      aria-current={on ? "true" : undefined}
                      className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-[12px] font-bold transition ${
                        on ? "border-teal bg-teal/15 text-teal-light-ink" : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/30"
                      }`}
                    >
                      <RouteIcon className="h-3.5 w-3.5" />
                      {t.titleAr}
                      <span className="tabular-nums text-muted-foreground">
                        {t.counts.completed}/{t.counts.total}
                      </span>
                    </button>
                  );
                })}
              </nav>
            )}

            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="text-lg font-black">{activeTrack.titleAr}</h2>
              {activeTrack.subtitleAr && <p className="text-[11px] text-muted-foreground">{activeTrack.subtitleAr}</p>}
            </div>

            <StageRail track={activeTrack} selectedId={selectedId} onSelect={select} />

            {/* طلبُ الخطّة كاملةً — فاتورةٌ واحدة لا أربع */}
            {activeTrack.kind === "plan" && <PlanRequest track={activeTrack} onDone={() => void load()} />}

            <div className="mt-4">
              {selectedId === CAPSTONE_ID ? (
                <CapstonePanel track={activeTrack} requests={requests} onChanged={() => void load()} />
              ) : !stage ? null : stage.enrollmentId ? (
                detailLoading || !detail ? (
                  <Panel className="grid place-items-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-teal-ink" aria-label="يُحمَّل" />
                  </Panel>
                ) : (
                  <StageWork
                    stage={stage}
                    detail={detail}
                    full={courseFullById(stage.courseId)}
                    request={requestFor(requests, "course_certificate", { enrollmentId: stage.enrollmentId })}
                    handlers={handlers}
                  />
                )
              ) : (
                <StageOffer
                  stage={stage}
                  options={cohorts.get(stage.courseId) ?? []}
                  selectedCohortId={pickedCohort[stage.courseId] ?? null}
                  onPickCohort={(cohortId) => setPickedCohort((p) => ({ ...p, [stage.courseId]: cohortId }))}
                  heldSeat={heldOf.get(stage.courseId) ?? null}
                  onChanged={() => void load()}
                />
              )}
            </div>
          </>
        )}
      </div>
    </PortalLayout>
  );
}

function EmptyJourney() {
  return (
    <section className="grid place-items-center rounded-3xl border border-teal/25 bg-gradient-to-b from-teal/[0.08] to-transparent py-16 text-center">
      <BookOpen className="h-12 w-12 text-teal-light-ink" />
      <h2 className="mt-5 text-2xl font-black">رحلتك تبدأ بأوّل دورة</h2>
      <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
        حين تشتري دورتك الأولى تظهر هنا مراحلُك: دروسُها وجلساتُها وواجباتُها ومصادرُها، ومعها شهادتُها في آخرها.
        وابدأ بالتشخيص إن أردت مسارا يُقترح على هدفك.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link to="/pathways" className="rounded-full bg-teal px-6 py-3 font-black text-on-teal transition hover:bg-teal-light">
          تصفّح المسارات
        </Link>
        <Link to="/diagnostic" className="rounded-full border border-white/15 px-6 py-3 font-bold text-foreground hover:border-white/40">
          ابدأ التشخيص
        </Link>
      </div>
    </section>
  );
}

/* طلبُ الخطّة كاملةً بنداءٍ واحد.

   كان على المتعلّم أن يطلب دورةً دورة فيدفع أربع فواتير، وفي كلٍّ منها فرصةٌ
   للتوقّف. والخادمُ يقرأ خطّته: يطلب ما له شعبة، ويسمّي ما لا شعبةَ له بدل أن
   يبيعه صامتا. */
function PlanRequest({ track, onDone }: { track: JourneyTrack; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PlanRequestResult | null>(null);

  const askable = track.stages.filter((s) => s.state === "schedulable" && !s.requestPending).length;
  const pending = track.stages.filter((s) => s.requestPending).length;
  const awaiting = track.stages.filter((s) => s.state === "awaiting_cohort").length;
  const reviewMsg = `مرحبا، أنا صاحب «${track.titleAr}» وأريد مراجعة خطّتي (تبديل/إضافة دورة).`;

  if (done) {
    return (
      <p className="mt-3 rounded-2xl border border-teal/35 bg-teal/[0.07] px-4 py-3 text-[12px] leading-6 text-teal-light-ink">
        وصلنا طلبك على {done.requested.length === 1 ? "دورة واحدة" : `${done.requested.length} دورات`}.
        نراجعها ونحجز مقاعدك، ثمّ تصلك فاتورةٌ واحدة للخطّة كلها.
        {done.awaiting.length > 0 && ` و${done.awaiting.length} من دوراتك تنتظر فتح شعبتها — لا تُحتسب عليك الآن.`}
      </p>
    );
  }

  if (askable === 0) {
    if (pending > 0) {
      return (
        <p className="mt-3 rounded-2xl border border-gold/30 bg-gold/[0.06] px-4 py-3 text-[12px] leading-6 text-gold-ink">
          طلبك على {pending === 1 ? "دورة واحدة" : `${pending} دورات`} قيد المراجعة. نحجز مقاعدك ثمّ تصلك
          فاتورةٌ واحدة للخطّة كلها — دفعةٌ واحدة لا أربع.
        </p>
      );
    }
    if (awaiting === 0) return null;
    return (
      <Card className="mt-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="min-w-0 text-[12px] leading-6 text-muted-foreground">
          <span className="font-bold text-foreground">{awaiting} من دوراتك لم تُفتح لها شعبة بعد.</span>{" "}
          لا تُطلب ولا يُدفع ثمنُها — نُعلمك فور جدولتها، أو راجعها مع مستشارك.
        </p>
        <AdvisorContact
          text={reviewMsg}
          label="مراجعة خطّتي"
          className="flex shrink-0 items-center gap-2 rounded-full border border-gold/40 px-4 py-2 text-[12px] font-bold text-gold-ink transition hover:bg-gold/10"
        />
      </Card>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-teal/30 bg-teal/[0.06] px-4 py-3.5">
      <button
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            setDone(await apiPost<PlanRequestResult>("/api/learner/plan/enrollment-request"));
            onDone();
          } catch (e) {
            setError(e instanceof ApiError ? e.message : "تعذّر إرسال الطلب — أعد المحاولة");
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="flex cursor-pointer items-center gap-2 rounded-full bg-teal px-5 py-2.5 text-[12.5px] font-black text-on-teal transition hover:bg-teal-light disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        اطلب تسجيلك في {askable === 1 ? "دورتك المتاحة" : `دوراتك الـ${askable} المتاحة`}
      </button>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        طلبٌ واحد لخطّتك كلها، وفاتورةٌ واحدة بعد حجز مقاعدك — لا دورةً دورة.
        {awaiting > 0 && " وما لم تُفتح شعبتُه لا يُطلب ولا يُدفع ثمنه."}
      </p>
      {error && <p className="mt-2 text-[11px] font-bold text-gold-ink">{error}</p>}
    </div>
  );
}
