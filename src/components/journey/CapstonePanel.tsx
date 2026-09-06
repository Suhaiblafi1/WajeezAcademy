/* نهايةُ المسار — مشروعُ التخرّج، ثمّ شهادتُه، ثمّ توصيةٌ مهنيّة.

   بكلام صاحب المنصّة: «ومشروع التخرج يكون في آخر المسار وهو النهاية ليقدّم
   مشروع التخرج… وفي نهاية المسار يظهر له طلب شهادة المسار كاملا وتوصية لعمله
   أو لجماعته وغيرها من الأمور المهمّة لحياته المهنيّة».

   وثلاثةُ قراراتٍ هنا:

   ١) **المشروعُ نهايةٌ لا محطّة.** لا يُعدّ في «المرحلة ن من م» ولا في
      ساعات المسار — فهو عملُ ما بعد الدورات، ونصُّه من الكتالوج لا يُختلق.

   ٢) **لا زرَّ تسليمٍ لا يقود إلى شيء.** لا يوجد في الخادم طابورُ تسليمٍ
      لمشروع التخرّج (تسليماتُ الدورات على تقييمات شعبها)، فالتسليمُ يُرتَّب
      مع الفريق الأكاديميّ على القناة الرسميّة — يُقال ذلك صراحةً بدل زرٍّ
      يوهم بمسارٍ آليّ لا وجودَ له.

   ٣) **التوصيةُ تُكتب لجهةٍ بعينها.** توصيةٌ بلا مُرسَلٍ إليه ورقةٌ عامّة لا
      تنفع في تقديمٍ حقيقيّ، فالحقلُ إلزاميّ — والخادمُ يرفض بدونه. */

import { useEffect, useState } from "react";
import { Award, BadgeCheck, Loader2, Send, Trophy } from "lucide-react";
import AdvisorContact from "@/components/AdvisorContact";
import { ApiError } from "@/services/api";
import {
  createRequest, fetchPathwayCompletion, requestFor, REQUEST_STATUS_AR,
  type LearnerRequest, type PathwayCompletion,
} from "@/services/learner-requests";
import type { JourneyTrack } from "@/application/student/journey";

export default function CapstonePanel({
  track,
  requests,
  onChanged,
}: {
  track: JourneyTrack;
  requests: LearnerRequest[];
  onChanged: () => void;
}) {
  const pathwayId = track.pathwayId;
  const [completion, setCompletion] = useState<PathwayCompletion | null>(null);

  useEffect(() => {
    if (!pathwayId) return;
    let on = true;
    fetchPathwayCompletion(pathwayId)
      .then((c) => { if (on) setCompletion(c); })
      .catch(() => { if (on) setCompletion(null); });
    return () => { on = false; };
  }, [pathwayId]);

  if (!pathwayId) return null;
  const certRequest = requestFor(requests, "pathway_certificate", { pathwayId });
  const recRequest = requestFor(requests, "recommendation", { pathwayId });

  return (
    <div className="space-y-4">
      {/* ══ المشروع الختاميّ ══ */}
      <section className="rounded-3xl border border-gold/30 bg-gold/[0.05] p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-base font-black text-gold-ink">
          <Trophy className="h-4.5 w-4.5" /> مشروع تخرّجك
        </h3>
        <p className="mt-0.5 text-fine text-muted-foreground">
          نهاية «{track.titleAr}» — بعد دوراته، لا مرحلةً فيه.
        </p>
        {track.capstoneAr ? (
          <p className="mt-3 text-[13px] leading-7 text-foreground">{track.capstoneAr}</p>
        ) : (
          <p className="mt-3 text-[12px] leading-6 text-muted-foreground">
            لم يُكتب نصُّ مشروع هذا المسار في الكتالوج بعد.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gold/20 pt-3.5">
          <p className="min-w-0 flex-1 text-fine leading-5 text-muted-foreground">
            تسليمُ المشروع يُرتَّب مع فريقنا الأكاديميّ: تراسله، فيُسنَد لك مقيّمٌ وموعد.
            {completion && !completion.eligible && " ويُقدَّم بعد إنجاز دورات المسار."}
          </p>
          <AdvisorContact
            text={`مرحبا، أنهيت دورات «${track.titleAr}» وأريد ترتيب تسليم مشروع التخرج.`}
            label="راسلنا لتسليم المشروع"
            className="flex shrink-0 items-center gap-2 rounded-full border border-gold/50 px-4 py-2 text-[12px] font-black text-gold-ink transition hover:bg-gold/10"
          />
        </div>
      </section>

      {/* ══ إنجازُ المسار — عليه تقوم الشهادةُ والتوصية ══ */}
      {completion && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-[12px] font-black text-foreground">
              أنجزت <span className="tabular-nums">{completion.done}</span> من{" "}
              <span className="tabular-nums">{completion.total}</span> دورات المسار
            </p>
            <p className="text-fine tabular-nums text-muted-foreground">{completion.percent}٪</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${Math.max(2, completion.percent)}%` }} />
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* ══ شهادةُ المسار كاملا ══ */}
        <RequestCard
          icon={<Award className="h-4 w-4 text-gold-ink" />}
          title="شهادة المسار كاملا"
          bodyAr="وثيقةٌ واحدة تقول إنّك أنجزت المسار كلّه لا دوراتٍ متفرّقة — برقم تحقّق عامّ باسمك."
          request={certRequest}
          eligible={completion?.eligible ?? false}
          reasonsAr={completion?.reasonsAr ?? []}
          loading={completion === null}
          cta="اطلب شهادة المسار"
          onSend={() => createRequest({ kind: "pathway_certificate", pathwayId })}
          onChanged={onChanged}
        />

        {/* ══ التوصية المهنيّة ══ */}
        <RequestCard
          icon={<BadgeCheck className="h-4 w-4 text-teal-light-ink" />}
          title="توصية مهنيّة"
          bodyAr="يكتبها فريقنا الأكاديميّ عمّا أنجزته فعلا في المسار — لجهةٍ تسمّيها: عملك، أو جامعة، أو منحة."
          request={recRequest}
          eligible={completion?.eligible ?? false}
          reasonsAr={completion?.reasonsAr ?? []}
          loading={completion === null}
          cta="اطلب التوصية"
          needsAudience
          onSend={(audienceAr) => createRequest({ kind: "recommendation", pathwayId, audienceAr })}
          onChanged={onChanged}
        />
      </div>
    </div>
  );
}

function RequestCard({
  icon,
  title,
  bodyAr,
  request,
  eligible,
  reasonsAr,
  loading,
  cta,
  needsAudience = false,
  onSend,
  onChanged,
}: {
  icon: React.ReactNode;
  title: string;
  bodyAr: string;
  request: LearnerRequest | null;
  eligible: boolean;
  reasonsAr: string[];
  loading: boolean;
  cta: string;
  needsAudience?: boolean;
  onSend: (audienceAr: string) => Promise<unknown>;
  onChanged: () => void;
}) {
  const [audience, setAudience] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = request ? (REQUEST_STATUS_AR[request.status] ?? REQUEST_STATUS_AR.pending) : null;

  return (
    <section className="flex flex-col rounded-2xl border border-white/12 bg-white/[0.03] p-4">
      <p className="flex items-center gap-2 text-[13px] font-black">{icon}{title}</p>
      <p className="mt-1.5 text-fine leading-6 text-muted-foreground">{bodyAr}</p>

      {request || sent ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-paper/20 p-3">
          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-fine font-bold ${meta?.cls ?? REQUEST_STATUS_AR.pending.cls}`}>
            {meta?.label ?? REQUEST_STATUS_AR.pending.label}
          </span>
          {request?.audienceAr && (
            <p className="mt-2 text-fine leading-5 text-muted-foreground">
              <span className="font-bold text-foreground">الجهة: </span>{request.audienceAr}
            </p>
          )}
          {request?.decisionAr && <p className="mt-2 text-fine leading-5 text-muted-foreground">{request.decisionAr}</p>}
        </div>
      ) : loading ? (
        <p className="mt-3 flex items-center gap-2 text-fine text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> نقرأ إنجازك…
        </p>
      ) : !eligible ? (
        <ul className="mt-3 space-y-1 border-r-2 border-white/10 ps-3">
          {reasonsAr.map((r) => (
            <li key={r} className="text-fine leading-5 text-muted-foreground">{r}</li>
          ))}
        </ul>
      ) : (
        <div className="mt-3">
          {needsAudience && (
            <label className="block">
              <span className="text-fine font-bold text-muted-foreground">لأيّ جهةٍ تريدها؟</span>
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                maxLength={300}
                placeholder="مثال: إدارة الموارد البشرية في شركتي، أو لجنة منحة"
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-paper/30 px-3 py-2 text-[12.5px] text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none"
              />
            </label>
          )}
          <button
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onSend(audience.trim());
                setSent(true);
                onChanged();
              } catch (e) {
                setError(e instanceof ApiError ? e.message : "تعذّر إرسال الطلب — أعد المحاولة");
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy || (needsAudience && audience.trim().length < 3)}
            className="mt-2.5 flex cursor-pointer items-center gap-1.5 rounded-full bg-teal px-5 py-2 text-[12px] font-black text-on-teal transition hover:bg-teal-light disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            {cta}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-fine font-bold text-gold-ink">{error}</p>}
    </section>
  );
}
