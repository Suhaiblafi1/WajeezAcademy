/* تعديلاتٌ تقترحها الإدارةُ على خطّة المدرّب — يقبل كلًّا أو يرفضه (٨ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «التعديلُ يطول على المدرّب — نكتبه نحن ويختار هو». والوجهان هنا:
   لمساحة المراجعة حالُها (`hooks/usePlanEdits.ts`) ولسانا «اقتراحات Claude» (`PlanEditsDrafts`) و«بطاقات للمدرب»
   (`PlanEditsSent`)، والرفعُ والسحبُ في «أدوات Claude» (`TrainerPlanReview.tsx`)؛ و`PlanEditsPanel` لصفحة
   المدرّب (يقرأ كلَّ تعديلٍ بما قبله وما بعده، ويقبله أو يرفضه). والرفعُ دفعةً من «خططٌ تنتظر اعتمادك» في `ReviewUpload.tsx`. والقاعدةُ والعرضُ في
   `application/trainer/plan-edits.ts` — والشاشتان تعرضان ما يحسبه الخادمُ منها، لا تحسبان. */

import { useCallback, useEffect, useState } from "react";
import { Check, PencilLine, X } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import type { EditView, PlanEditStatus } from "@/application/trainer/plan-edits";
import { draftsWaitingAr } from "@/application/trainer/plan-workspace";
import type { PlanEditsState } from "@/hooks/usePlanEdits";
import { GapList, NoteSubs } from "@/components/LongText";
import { gapLayout } from "@/application/trainer/text-layout";
import { SCHEDULE_REJECT_REASONS, withRejectReason } from "@/application/terms/schedule-clash";

export interface PlanEditItem {
  id: string;
  seq: number;
  kind: string;
  step: string;
  required: boolean;
  reasonAr: string;
  status: PlanEditStatus;
  decidedAt: string | null;
  noteAr: string | null;
  view: EditView;
  stale: boolean;
  goneAr: string | null;
}

const STATUS_AR: Record<PlanEditStatus, { label: string; tone: "warn" | "positive" | "neutral" | "danger" | "info" }> = {
  proposed: { label: "ينتظر مراجعتك", tone: "warn" },
  dropped: { label: "حذفته — لم يصل المدرّب", tone: "neutral" },
  pending: { label: "اعتمدته — عند المدرّب", tone: "info" },
  accepted: { label: "قبل", tone: "positive" },
  rejected: { label: "رفض", tone: "danger" },
  withdrawn: { label: "سحب", tone: "neutral" },
  lapsed: { label: "سقط بالاعتماد", tone: "neutral" },
};

const errText = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback);

/** «قبل» و«بعد» — والطويلُ يُطوى كي لا يبتلع الشاشة */
function Rows({ view }: { view: EditView }) {
  return (
    <dl className="mt-2 space-y-2">
      {view.rows.map((r, i) => (
        <div key={i} className="grid gap-1 sm:grid-cols-[8rem_1fr]">
          <dt className="text-read font-bold text-muted-foreground">{r.labelAr}</dt>
          <dd className="grid gap-1 sm:grid-cols-2">
            <Cell label="قبل" text={r.beforeAr} href={r.beforeHref} long={r.long} muted />
            <Cell label="بعد" text={r.afterAr} href={r.afterHref} long={r.long} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Cell({ label, text, href, long, muted }: { label: string; text: string | null; href?: string; long?: boolean; muted?: boolean }) {
  return (
    <div className="rounded-md border border-border/60 px-2 py-1.5 text-read leading-6">
      <span className="me-1 text-fine font-black text-muted-foreground">{label}:</span>
      <Value text={text} href={href} long={long} muted={muted} />
    </div>
  );
}

/** نصُّ الحقل — والطويلُ مطويٌّ بأوّله، والرابطُ رابط */
function Value({ text, href, long, muted }: { text: string | null; href?: string; long?: boolean; muted?: boolean }) {
  /* والرابطُ يُفتح في لسانٍ جديد — يتحقّق منه قبل أن يقبله */
  const body = text === null
    ? <span className="text-muted-foreground">— فارغ</span>
    : href
      ? <a href={href} target="_blank" rel="noreferrer" dir="ltr" className="break-all font-bold text-teal-light-ink underline">{text}</a>
      : <span className={`whitespace-pre-wrap break-words ${muted ? "text-muted-foreground" : "text-foreground"}`}>{text}</span>;
  return long && text !== null && text.length > 280
    ? <details><summary className="cursor-pointer">{text.slice(0, 200)}…</summary>{body}</details>
    : body;
}

/* ═══════════ مساحةُ المراجعة ═══════════ */

/** «اقتراحات Claude» — كلُّ مسوّدةٍ كما سيراها المدرّب، بما قبلها وما بعدها، وزرّا المراجعة */
export function PlanEditsDrafts({ edits, planId, canReview }: { edits: PlanEditsState; planId: string; canReview: boolean }) {
  const { drafts, busy, reviewing, review } = edits;
  /* البندُ كما سيراه المدرّب — بما قبله وما بعده، وزرّا المراجعة */
  const draftItem = (x: PlanEditItem) => (
    <li key={x.id} className="rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-read font-black text-foreground">{x.view.titleAr}</span>
        <Chip tone={x.required ? "danger" : "info"}>{x.required ? "مطلوب" : "مقترح"}</Chip>
        <span className="text-fine text-muted-foreground">{x.view.stepAr}</span>
      </div>
      <p className="mt-1 text-read leading-6 text-muted-foreground">لماذا: {x.reasonAr}</p>
      <Rows view={x.view} />
      {x.goneAr && <p className="mt-2 text-read font-bold text-gold-ink">لا يقع الآن: {x.goneAr}</p>}
      {canReview && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            tone="confirm" size="sm" icon={Check} disabled={busy}
            onClick={() => void review(x.id, () => apiPost<PlanEditItem[]>(`/api/admin/plan-edits/${x.id}/approve`, {}), `اعتمد «${x.view.titleAr}» للمدرّب.`)}
          >
            {reviewing === x.id ? "…" : "اعتمده للمدرّب"}
          </Button>
          <Button
            tone="ghost" size="sm" icon={X} disabled={busy}
            onClick={() => void review(x.id, () => apiPost<PlanEditItem[]>(`/api/admin/plan-edits/${x.id}/drop`, {}), `حذف «${x.view.titleAr}» — لن يصل المدرّب.`)}
          >
            احذفه
          </Button>
        </div>
      )}
    </li>
  );
  if (drafts.length === 0) return null;
  return (
    <div className="space-y-3" role="group" aria-label="مسوّدات تنتظر مراجعتك">
      <p className="text-read font-bold text-gold-ink">
        {draftsWaitingAr(drafts.length)}
        {" "}<span className="font-normal text-muted-foreground">— مطلوب {drafts.filter((x) => x.required).length} · مقترح {drafts.filter((x) => !x.required).length}</span>
      </p>
      {canReview && drafts.length > 1 && (
        <Button
          tone="confirm" size="sm" icon={Check} disabled={busy}
          onClick={() => void review("all", () => apiPost<PlanEditItem[]>(`/api/admin/cohort-plans/${planId}/edits/approve-all`, {}), "اعتمدت كلّها للمدرّب.")}
        >
          اعتمدها كلّها للمدرّب ({drafts.length})
        </Button>
      )}
      {/* في مجموعتين تُفتحان بنقرة — المطلوبُ مفتوحٌ والمقترحُ مطويّ («كثيرُ الكلام»، ١١ أكتوبر ٢٠٢٦)،
          إلّا أن يكون فيه جدولٌ ثابت: جهّزه المعتمِدُ بزرّه الآن، فيراه بلا نقرةٍ ثانية */}
      {([["required", "المطلوب"], ["suggested", "المقترح"]] as const).map(([kind, label]) => {
        const list = drafts.filter((x) => x.required === (kind === "required"));
        return list.length > 0 && (
          <details key={kind} className="rounded-lg border border-border/60 p-3" open={kind === "required" || list.some((x) => x.kind === "schedule")}>
            <summary className="cursor-pointer text-read font-bold text-teal-light-ink">{label} ({list.length})</summary>
            <ol className="mt-3 space-y-3">{list.map((x) => draftItem(x))}</ol>
          </details>
        );
      })}
    </div>
  );
}

/* ═══ وما مرّ من بين يديك: «بطاقات للمدرب» ما وصله، وما حذفته أو سحبته قبل أن يصله تحت «اقتراحات Claude» ═══
   الحالُ نفسُه بلسانين: ما عنده ينتظر قرارَه، وما قبله أو رفضه بكلمته، وما سقط باعتماد الخطّة. */
const SENT: readonly PlanEditStatus[] = ["pending", "rejected", "accepted", "lapsed"];

function EditRow({ x }: { x: PlanEditItem }) {
  return (
    <li className="text-read leading-6">
      <span className="font-bold text-foreground">{x.view.titleAr}</span>
      {" "}· <span className="text-muted-foreground">{x.view.stepAr}</span>
      {" "}· <Chip tone={STATUS_AR[x.status].tone}>{isNote(x) ? NOTE_STATUS_AR[x.status] ?? STATUS_AR[x.status].label : STATUS_AR[x.status].label}</Chip>
      {x.required && <> · <Chip tone="danger">مطلوب</Chip></>}
      {x.status === "rejected" && x.noteAr && <p className="text-muted-foreground">كلمته: {x.noteAr}</p>}
    </li>
  );
}

/** «بطاقات للمدرب» — ما اعتمدته له، ما عنده أوّلا ثمّ ما رفضه بكلمته ثمّ ما قبله */
export function PlanEditsSent({ edits }: { edits: PlanEditsState }) {
  const sent = edits.items.filter((x) => SENT.includes(x.status))
    .sort((a, b) => SENT.indexOf(a.status) - SENT.indexOf(b.status));
  if (sent.length === 0) return null;
  return <ol className="space-y-2">{sent.map((x) => <EditRow key={x.id} x={x} />)}</ol>;
}

/** وما حذفته أو سحبته قبل أن يصله — مطويٌّ تحت «اقتراحات Claude»، يعود برفع ملفّه */
export function PlanEditsSetAside({ edits }: { edits: PlanEditsState }) {
  const aside = edits.items.filter((x) => x.status === "dropped" || x.status === "withdrawn");
  if (aside.length === 0) return null;
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-read font-bold text-teal-light-ink">ما حذفته أو سحبته ({aside.length})</summary>
      <ol className="mt-2 space-y-2">{aside.map((x) => <EditRow key={x.id} x={x} />)}</ol>
    </details>
  );
}

/* وكانت هنا أدواتُ الجملة لـ«خططٌ تنتظر اعتمادك»: رفعُ ملفّات التعديلات بثلاث طرق، و«احذف المكرر من كل الخطط».
   وقال صاحبُ المنصّة (٢٦ أكتوبر ٢٠٢٦): «فقط تحميل ورفع» — فصار صندوقا واحدا لما رجع كلِّه (`ReviewUpload.tsx`). */

/* ═══════════ صفحةُ المدرّب ═══════════ */

/** لصفحة المدرّب — ما اقترحته الإدارةُ على خطّته، يقبل كلًّا أو يرفضه.
    `inHand` الخطّةُ في يده (مسودّةٌ أو مردودة) — وإلّا تُقرأ ولا يُقرَّر فيها.
    `approved` خطّتُه معتمدة: ما بقي اقتراحاتٌ اختياريّة، وما يقبله يُكتب فيها مباشرة (١٧ أكتوبر ٢٠٢٦).
    `unsaved` في يده تعديلٌ لم يُحفظ — فلا يُكتب فوقه بإعادة التحميل.
    `onApplied` يعيد تحميل الصفحة بعد ما يُكتب في الخطّة. */
export function PlanEditsPanel({ cohortId, inHand, approved = false, unsaved, onApplied, onCounts, onOpenStep }: {
  cohortId: string;
  inHand: boolean;
  approved?: boolean;
  unsaved: boolean;
  onApplied: () => void | Promise<unknown>;
  /** «افتح الخطوة» في بند الملاحظة — يعدّل فيها ما تطلبه */
  onOpenStep?: (step: string) => void;
  /** عددُ البنود وما ينتظر منها بعد كلّ قراءة — فالرفضُ لا يُعيد الصفحة، وزرُّ الإرسال ينتظر آخرَ قرار */
  onCounts?: (c: { total: number; pending: number }) => void;
}) {
  const [items, setItems] = useState<PlanEditItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const list = await apiGet<PlanEditItem[]>(`/api/trainer/cohorts/${cohortId}/plan-edits`);
      setItems(list);
      onCounts?.({ total: list.length, pending: list.filter((x) => x.status === "pending").length });
    } catch { /* الصفحةُ تُقرأ بلا القائمة */ }
  }, [cohortId, onCounts]);
  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, run: () => Promise<unknown>, done: string, wrote: boolean) => {
    setBusy(key); setMsg("");
    try {
      await run();
      setMsg(done);
      await load();
      if (wrote) await onApplied();
    } catch (e) {
      setMsg(errText(e, "تعذّر"));
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) return null;
  const pending = items.filter((x) => x.status === "pending");
  const blocked = !inHand && !approved ? "تقبل التعديلات حين تعود الخطّة إليك." : unsaved ? "احفظ ما كتبته أوّلا — فالقبول يكتب في الخطّة المحفوظة." : null;

  /* ═══ «المراجعة»: بطاقاتٌ مرقّمةٌ واحدةٌ بعد واحدة (١١ أكتوبر ٢٠٢٦) ═══

     قرارُ صاحب المنصّة: «كثيرُ الكلام… كن منصّةً محترفةً لا جريدةً يُقرأ فيها كلُّ شيءٍ في صفحةٍ
     واحدة: واحد — نقترح هذا بدلَ هذا — اقبل أو ارفض. صندوقٌ، ثمّ الثاني، ثمّ الثالث». فالرأسُ
     عدٌّ وشريطُ تقدّمٍ و«اقبلها كلَّها»، ثمّ ما ينتظر قرارَه بطاقاتٍ مرقّمة، وما قرّر فيه سطرٌ
     واحدٌ لكلٍّ مطويٌّ تحتها. والمنطقُ كما كان: القبولُ يكتب في المحفوظ، والمعدَّلُ بيده بزرّه. */
  /* والملاحظاتُ أوّلا ثمّ التعديلات — «ما لم يُذكر في التعديلات أدناه» (صاحب المنصّة، ١١ أكتوبر ٢٠٢٦) */
  const ordered = [...items.filter(isNote), ...items.filter((x) => !isNote(x))];
  const decided = ordered.filter((x) => x.status !== "pending");
  const numberOf = (x: PlanEditItem) => ordered.indexOf(x) + 1;
  const pendingNotes = pending.filter(isNote);
  const pendingEdits = pending.filter((x) => !isNote(x));
  const pct = Math.round((decided.length / items.length) * 100);

  /* «لماذا؟» حين يرفض أو لا يوافق — اختياريّةٌ يقرؤها المعتمِد */
  const whyBox = (x: PlanEditItem, confirmAr: string, doneAr: string) => rejecting === x.id && (
    <div className="mt-2 space-y-2">
      <label className="block text-read text-muted-foreground">
        لماذا؟ (اختياريّ — يقرؤه المعتمد)
        <textarea
          rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background p-2 text-read text-foreground"
        />
      </label>
      <Button
        tone="secondary" size="sm" disabled={busy !== null}
        onClick={() => void act(x.id, async () => { await apiPost(`/api/trainer/plan-edits/${x.id}/reject`, note.trim() ? { noteAr: note.trim() } : {}); setRejecting(null); }, doneAr, false)}
      >
        {confirmAr}
      </Button>
    </div>
  );

  /* ═══ بندُ الملاحظة: نقاطُها، ثمّ «سأعدّله» يفتح خطوتَها (١١ أكتوبر ٢٠٢٦) ═══

     كان «موافق» و«لا أوافق». فقال صاحبُ المنصّة: «إن اقترحتَ عليه ما يقبله أو يرفضه فقبولُه يغيّر
     الشيء. وإن لم تغيّره أنت فلا تطلب منه أن يوافق — أعطه زرّا: سأعدّله، يأخذه إلى موضعه». فالملاحظةُ لا
     تكتب في الخطّة شيئا: زرُّها «سأعدّله» يُعلِّمها ويفتح خطوتَها، والعامّةُ «اطّلعتُ عليها». ويبقى له —
     بقاعدة «لا إجبارَ على فعل» — أن يُبقي الموضعَ كما هو ويقول لماذا. */
  const noteCard = (x: PlanEditItem) => (
    <Card as="li" key={x.id} className="p-4">
      <div className="flex items-start gap-3">
        <span className="w-7 shrink-0 text-center text-xl font-black leading-8 text-teal-light-ink" aria-hidden="true">
          {numberOf(x)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-read font-black text-foreground">{x.view.titleAr}</span>
            <Chip tone={x.required ? "danger" : "info"}>{x.required ? "فيها مطلوب" : "ملاحظة"}</Chip>
          </div>
          <NotePoints view={x.view} />
          <div className="mt-3 flex flex-wrap gap-2">
            {x.step === "general" ? (
              !blocked && (
                <Button
                  tone="confirm" size="sm" icon={Check} disabled={busy !== null}
                  onClick={() => void act(x.id, () => apiPost(`/api/trainer/plan-edits/${x.id}/accept`, {}), "قرأتها.", false)}
                >
                  اطّلعت عليها
                </Button>
              )
            ) : (
              <Button
                tone="confirm" size="sm" icon={PencilLine} disabled={busy !== null}
                onClick={() => blocked
                  ? onOpenStep?.(x.step)
                  : void act(x.id, () => apiPost(`/api/trainer/plan-edits/${x.id}/accept`, {}), `افتح «${x.view.stepAr}» وعدّل فيها.`, false)
                    .then(() => onOpenStep?.(x.step))}
              >
                سأعدّله
              </Button>
            )}
            {!blocked && (
              <Button tone="ghost" size="sm" disabled={busy !== null} onClick={() => { setRejecting(rejecting === x.id ? null : x.id); setNote(""); }}>
                {x.step === "general" ? "لي رأي آخر" : "أبقيه كما هو"}
              </Button>
            )}
          </div>
          {whyBox(x, "أرسل رأيك", `وصل رأيك في «${x.view.titleAr}» الإدارة.`)}
        </div>
      </div>
    </Card>
  );

  const editCard = (x: PlanEditItem) => (
      <Card as="li" key={x.id} className="p-4">
        <div className="flex items-start gap-3">
          <span className="w-7 shrink-0 text-center text-xl font-black leading-8 text-teal-light-ink" aria-hidden="true">
            {numberOf(x)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-read font-black text-foreground">{x.view.titleAr}</span>
              <Chip tone={x.required ? "danger" : "info"}>{x.required ? "مطلوب" : "مقترح"}</Chip>
              <span className="text-fine text-muted-foreground">{x.view.stepAr}</span>
            </div>
            <p className="mt-1 text-read leading-6 text-muted-foreground">{x.reasonAr}</p>
            <SuggestRows view={x.view} />
            {x.goneAr && (
              <p className="mt-2 text-read font-bold text-gold-ink">لا يقع الآن: {x.goneAr}. لك أن ترفضه.</p>
            )}
            {x.stale && !x.goneAr && (
              <p className="mt-2 text-read font-bold text-gold-ink">
                عدّلت هذا الموضع بعد أن اقترحناه — «بدل» ما كان فيه يومها، لا ما فيه الآن. لك أن تقبله فوق ما كتبت، أو ترفضه.
              </p>
            )}
            {x.status === "pending" && !blocked && (
              <div className="mt-3 flex flex-wrap gap-2">
                {!x.goneAr && (
                  <Button
                    tone="confirm" size="sm" icon={Check} disabled={busy !== null}
                    onClick={() => void act(x.id, () => apiPost(`/api/trainer/plan-edits/${x.id}/accept`, x.stale ? { force: true } : {}), `قبل «${x.view.titleAr}» وكتب في خطّتك.`, true)}
                  >
                    {x.stale ? "اقبله فوق ما كتبت" : "اقبله"}
                  </Button>
                )}
                <Button tone="ghost" size="sm" icon={X} disabled={busy !== null} onClick={() => { setRejecting(rejecting === x.id ? null : x.id); setNote(""); }}>
                  ارفضه
                </Button>
              </div>
            )}
            {rejecting === x.id && (
              <div className="mt-2 space-y-2">
                {/* ═══ وموعدٌ مقترحٌ يُرفض بسببه بنقرة (٢٢ أكتوبر ٢٠٢٦) ═══
                    «إذا رفض الموعدَ يبلغنا لماذا، لكي نقترح له غيرَه» (صاحب المنصّة). فاليومُ أو الساعةُ أوّلَ السطر،
                    فلا يُقترح عليه ثانيةً ما رفضه (`rejectedScope` في `schedule-clash.ts`). */}
                {x.kind === "schedule" && (
                  <div className="flex flex-wrap gap-2">
                    {SCHEDULE_REJECT_REASONS.map((r) => (
                      <Button
                        key={r.scope} size="sm" tone={note.startsWith(r.labelAr) ? "secondary" : "ghost"}
                        aria-pressed={note.startsWith(r.labelAr)}
                        onClick={() => setNote(withRejectReason(note, r.labelAr))}
                      >
                        {r.labelAr}
                      </Button>
                    ))}
                  </div>
                )}
                <label className="block text-read text-muted-foreground">
                  لماذا؟ (اختياريّ — يقرؤه المعتمد)
                  <textarea
                    rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background p-2 text-read text-foreground"
                  />
                </label>
                <Button
                  tone="secondary" size="sm" disabled={busy !== null}
                  onClick={() => void act(x.id, async () => { await apiPost(`/api/trainer/plan-edits/${x.id}/reject`, note.trim() ? { noteAr: note.trim() } : {}); setRejecting(null); }, `رفض «${x.view.titleAr}» — لم يمسّ شيء.`, false)}
                >
                  أكّد الرفض
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
  );

  return (
    <section className="mt-2 space-y-3" role="region" aria-label="تعديلات اقترحتها الإدارة">
      <Inset className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-read font-black text-foreground">
            {pending.length === 0 ? `قرّرت فيها كلّها (${items.length})` : `قرّرت في ${decided.length} من ${items.length}`}
          </p>
          <p className="mt-0.5 text-read leading-6 text-muted-foreground">
            {approved
              ? "خطتك معتمدة، وهذه اقتراحات اختيارية: ما تقبله يدخل خطتك مباشرة، وما ترفضه لا يغير شيئا."
              : "ما تقبله يكتب في خطّتك، وما ترفضه لا يمسّ شيئا."}
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10" role="progressbar"
            aria-label="ما قرّرت فيه" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={decided.length}>
            <span className="block h-full rounded-full bg-teal transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {pending.length > 1 && !blocked && (
          <Button
            tone="confirm" size="sm" icon={Check} disabled={busy !== null}
            onClick={() => void act("all", async () => {
              const r = await apiPost<{ accepted: number; skipped: { titleAr: string; problemAr: string }[] }>(
                `/api/trainer/cohorts/${cohortId}/plan-edits/accept-all`, {},
              );
              /* وما قُبل منها كُتب في الخطّة ولو بقي بعضُها (٢٠ أكتوبر ٢٠٢٦) — فالصفحةُ تُعاد قبل أن يُقال ما بقي،
                 وإلّا بقيت على ما قبل القبول وكتب حفظُها التلقائيُّ القديمَ فوق ما قُبل */
              if (r.skipped.length) {
                if (r.accepted > 0) await onApplied();
                throw new Error(`قبل ${r.accepted}، وبقي ${r.skipped.length} ينتظر:\n${r.skipped.map((s) => `«${s.titleAr}»: ${s.problemAr}`).join("\n")}`);
              }
            }, "قبلت كلّها وكتبت في خطّتك.", true)}
          >
            اقبلها كلّها ({pending.length})
          </Button>
        )}
      </Inset>
      {blocked && pending.length > 0 && <p className="text-read font-bold text-gold-ink">{blocked}</p>}
      {msg && <p className="whitespace-pre-wrap text-read font-bold text-teal-light-ink" role="status">{msg}</p>}

      {pendingNotes.length > 0 && (
        <>
          <h3 className="pt-1 text-read font-black text-foreground">ملاحظاتنا — ما لم تذكره التعديلات</h3>
          <ol className="space-y-3">
            {pendingNotes.map((x) => noteCard(x))}
          </ol>
        </>
      )}
      {pendingEdits.length > 0 && (
        <>
          {pendingNotes.length > 0 && <h3 className="pt-1 text-read font-black text-foreground">التعديلات المقترحة</h3>}
          <ol className="space-y-3">
            {pendingEdits.map((x) => editCard(x))}
          </ol>
        </>
      )}

      {decided.length > 0 && (
        <Inset as="details" className="p-3">
          <summary className="cursor-pointer text-read font-bold text-teal-light-ink">ما قرّرت فيه ({decided.length})</summary>
          <ol className="mt-2 space-y-1.5">
            {decided.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2 text-read leading-6">
                <span className="w-6 shrink-0 text-center font-black text-muted-foreground">{numberOf(x)}</span>
                <span className="font-bold text-foreground">{x.view.titleAr}</span>
                <Chip tone={STATUS_AR[x.status].tone}>{x.status === "accepted" ? (isNote(x) ? (x.step === "general" ? "قرأتها" : "ستعدّله") : "قبلته") : x.status === "rejected" ? (isNote(x) ? "أبقيته" : "رفضته") : STATUS_AR[x.status].label}</Chip>
                {x.status === "rejected" && x.noteAr && <span className="text-muted-foreground">— كلمتك: {x.noteAr}</span>}
              </li>
            ))}
          </ol>
        </Inset>
      )}
    </section>
  );
}

const isNote = (x: PlanEditItem) => x.kind === "note";
/** والملاحظةُ «سيعدّلها» أو «أبقاها كما هي» — لا «قُبل» و«رُفض» كالتعديل (١١ أكتوبر ٢٠٢٦) */
const NOTE_STATUS_AR: Partial<Record<PlanEditStatus, string>> = { pending: "عند المدرّب", accepted: "سيعدّله", rejected: "أبقاه كما هو" };

/** نقاطُ الملاحظة — سطرٌ لكلّ نقطة، و«مطلوب»/«مقترَح» وسمُها إن كان (`notePoints` في `plan-edits.ts`).
    والنقطةُ من بطاقة المعايير خانتان: «الآن» و«نقترح» — «ماذا كان وماذا نقترح» (صاحب المنصّة، ١١ أكتوبر ٢٠٢٦) */
export function NotePoints({ view }: { view: EditView }) {
  return (
    <ul className="mt-3 space-y-3">
      {view.rows.map((r, i) => (
        <li key={i} className="min-w-0">
          {r.beforeAr !== null ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {r.tagAr && <Chip tone={r.tagAr === "مطلوب" ? "danger" : "info"}>{r.tagAr}</Chip>}
                <span className="text-read font-bold text-foreground">{r.labelAr}</span>
              </div>
              {/* ونقطةُ البطاقة: ما ينقص نقاطا ثمّ ما يفعله (١٢ أكتوبر ٢٠٢٦، `NoteSubs`) — والقديمةُ: قائمةُ
                  النواقص محورا محورا ثمّ «كيف تُصلحه» — لا سطرا مكتظّا في خانة (١١ أكتوبر ٢٠٢٦) */}
              {r.subs ? (
                <div className="mt-1.5"><NoteSubs subs={r.subs} /></div>
              ) : gapLayout(r.beforeAr) ? (
                <div className="mt-1.5 grid gap-2">
                  <GapList layout={gapLayout(r.beforeAr)!} />
                  <p className="text-read leading-6 text-foreground"><b className="text-teal-light-ink">نقترح:</b> {r.afterAr}</p>
                </div>
              ) : (
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                <Cell label="الآن" text={r.beforeAr} muted />
                <Cell label="نقترح" text={r.afterAr} />
              </div>
              )}
            </>
          ) : (
            <div className="flex items-start gap-2 text-read leading-7">
              <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                {r.tagAr && <Chip tone={r.tagAr === "مطلوب" ? "danger" : "info"} className="me-2">{r.tagAr}</Chip>}
                <span className="whitespace-pre-wrap break-words text-foreground">{r.afterAr}</span>
              </span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** للمدرّب: «نقترح هذا بدلَ هذا» — المقترحُ أوّلا، وما كان بعده، والجديدُ وحدَه (١١ أكتوبر ٢٠٢٦) */
function SuggestRows({ view }: { view: EditView }) {
  /* والإضافةُ الخالصة (مصدرٌ جديد…) صندوقٌ واحدٌ بحقوله سطرا سطرا — لا «نضيف» على كلّ حقلٍ في صندوقه */
  if (view.rows.length > 0 && view.rows.every((r) => r.beforeAr === null)) {
    return (
      <Inset className="mt-3 p-3">
        <p className="text-read font-black text-teal-light-ink">نضيف</p>
        <dl className="mt-1.5 space-y-1.5">
          {view.rows.map((r, i) => (
            <div key={i} className="grid gap-x-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
              <dt className="text-fine font-bold leading-6 text-muted-foreground">{r.labelAr}</dt>
              <dd className="min-w-0 text-read leading-6"><Value text={r.afterAr} href={r.afterHref} long={r.long} /></dd>
            </div>
          ))}
        </dl>
      </Inset>
    );
  }
  return (
    <dl className="mt-3 space-y-3">
      {view.rows.map((r, i) => (
        <div key={i}>
          <dt className="text-fine font-bold text-muted-foreground">{r.labelAr}</dt>
          <dd className={`mt-1 grid gap-2 ${r.beforeAr === null ? "" : "sm:grid-cols-2"}`}>
            <Cell label={r.beforeAr === null ? "نضيف" : "نقترح"} text={r.afterAr} href={r.afterHref} long={r.long} />
            {r.beforeAr !== null && <Cell label="بدل" text={r.beforeAr} href={r.beforeHref} long={r.long} muted />}
          </dd>
        </div>
      ))}
    </dl>
  );
}
