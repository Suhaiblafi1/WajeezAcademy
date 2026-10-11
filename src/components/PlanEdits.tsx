/* تعديلاتٌ تقترحها الإدارةُ على خطّة المدرّب — يقبل كلًّا أو يرفضه (٨ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «التعديلُ يطول على المدرّب — نكتبه نحن ويختار هو». والوجهان هنا:
   `PlanEditsUploader` لبطاقة المراجعة (يُرفع الملفّ، ويُرى حالُ كلّ بند، ويُسحب ما لم
   يُقرَّر)، و`PlanEditsBulkUpload` لـ«خططٌ تنتظر اعتمادك» (ملفّاتٌ كثيرةٌ دفعةً واحدة، كلٌّ
   إلى خطّته)، و`PlanEditsPanel` لصفحة المدرّب (يقرأ كلَّ تعديلٍ بما قبله وما بعده، ويقبله
   أو يرفضه). والقاعدةُ والعرضُ في `application/trainer/plan-edits.ts` — والشاشتان
   تعرضان ما يحسبه الخادمُ منها، لا تحسبان. */

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, Check, ExternalLink, FileJson, Files, X } from "lucide-react";
import { apiDelete, apiGet, apiPost, ApiError } from "@/services/api";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import type { EditView, PlanEditStatus } from "@/application/trainer/plan-edits";
import { bulkSummaryAr, readEditsFile, replacedLineAr, uploadedLineAr } from "@/application/trainer/plan-edits-bulk";
import { GapList } from "@/components/LongText";
import { gapLayout } from "@/application/trainer/text-layout";

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
  dropped: { label: "حذفتَه — لم يصل المدرّب", tone: "neutral" },
  pending: { label: "اعتمدتَه — عند المدرّب", tone: "info" },
  accepted: { label: "قُبل", tone: "positive" },
  rejected: { label: "رُفض", tone: "danger" },
  withdrawn: { label: "سُحب", tone: "neutral" },
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

/* ═══════════ بطاقةُ المراجعة ═══════════ */

/** لبطاقة المراجعة — يُرفع الملفّ والخطّةُ بانتظار القرار أو في يد مدرّبها */
export function PlanEditsUploader({ planId, cohortId, canUpload, canReview, onPending, offerSchedule = false }: {
  planId: string;
  cohortId: string;
  canUpload: boolean;
  /** في بطاقة المعايير نصيحةٌ في الإيقاع أو أوقات اللقاءات — فتبني المنصّةُ جدولا ثابتا بسلسلته (١١ أكتوبر ٢٠٢٦) */
  offerSchedule?: boolean;
  /** يعتمد كلَّ بندٍ للمدرّب أو يحذفه — `cohort.plan.edits.review` (١٠ أكتوبر ٢٠٢٦) */
  canReview: boolean;
  /** كم ينتظر المدرّبَ — تقرؤه البطاقةُ فيكفي سببا لـ«اطلب تعديلات» */
  onPending?: (n: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<PlanEditItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [reviewing, setReviewing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setItems(await apiGet<PlanEditItem[]>(`/api/admin/cohorts/${cohortId}/plan-edits`)); }
    catch { /* البطاقةُ تُقرأ بلا القائمة */ }
  }, [cohortId]);
  useEffect(() => { void load(); }, [load]);

  const upload = async (file: File) => {
    setBusy(true); setMsg("");
    try {
      let body: unknown;
      try { body = JSON.parse(await file.text()); }
      catch { throw new Error(`«${file.name}» ليس ملفَّ JSON مقروءا`); }
      setItems(await apiPost<PlanEditItem[]>(`/api/admin/cohort-plans/${planId}/edits`, body));
      setMsg(`رُفع «${file.name}» مسوّدةً — لا يراه المدرّبُ حتّى تعتمد كلَّ بندٍ أدناه أو تحذفه.`);
    } catch (e) {
      setMsg(errText(e, "تعذّر الرفع"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  /* ═══ جدولٌ ثابتٌ بسلسلته تبنيه المنصّة (١١ أكتوبر ٢٠٢٦) ═══
     «في حال قمنا بتعديل شيءٍ قد يؤثّر على توقيتاتٍ أخرى يجب أن يكون التعديلُ كاملا بسلسلة» (صاحب
     المنصّة). فبندٌ واحدٌ باللقاءات ومواعيد المهامّ التي تتبعها — مسوّدةً تراجعها قبل المدرّب. */
  const schedule = async () => {
    setBusy(true); setMsg("");
    try {
      setItems(await apiPost<PlanEditItem[]>(`/api/admin/cohort-plans/${planId}/edits/schedule`, {}));
      setMsg("جُهّز الجدولُ مسوّدةً — راجعه أدناه: كلُّ لقاءٍ بموعده قبلُ وبعدُ، ومعه مواعيدُ المهامّ التي تتبعه.");
    } catch (e) {
      setMsg(errText(e, "تعذّر تجهيزُ الجدول"));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    setBusy(true); setMsg("");
    try {
      setItems(await apiDelete<PlanEditItem[]>(`/api/admin/cohort-plans/${planId}/edits`));
      setMsg("سُحب ما لم يُقرَّر فيه.");
    } catch (e) {
      setMsg(errText(e, "تعذّر السحب"));
    } finally {
      setBusy(false);
    }
  };

  /* ═══ ولا يصل المدرّبَ ما لم تعتمده الإدارة (١٠ أكتوبر ٢٠٢٦) ═══
     «كلُّ ما يُطلب من المدرّب قبولُه يقبله المديرُ أو المديرُ الأكاديميُّ أو مديرُ المحتوى
     أوّلا» (صاحب المنصّة). فالمسوّدةُ تُعرض هنا كاملةً بما قبلها وما بعدها، ولكلٍّ زرّان. */
  const review = async (key: string, run: () => Promise<PlanEditItem[]>, done: string) => {
    setBusy(true); setMsg(""); setReviewing(key);
    try {
      setItems(await run());
      setMsg(done);
    } catch (e) {
      setMsg(errText(e, "تعذّر"));
      await load();
    } finally {
      setBusy(false); setReviewing(null);
    }
  };

  const drafts = items.filter((x) => x.status === "proposed");
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
            onClick={() => void review(x.id, () => apiPost<PlanEditItem[]>(`/api/admin/plan-edits/${x.id}/approve`, {}), `اعتُمد «${x.view.titleAr}» للمدرّب.`)}
          >
            {reviewing === x.id ? "…" : "اعتمِدْه للمدرّب"}
          </Button>
          <Button
            tone="ghost" size="sm" icon={X} disabled={busy}
            onClick={() => void review(x.id, () => apiPost<PlanEditItem[]>(`/api/admin/plan-edits/${x.id}/drop`, {}), `حُذف «${x.view.titleAr}» — لن يصل المدرّب.`)}
          >
            احذفه
          </Button>
        </div>
      )}
    </li>
  );
  const pending = items.filter((x) => x.status === "pending").length;
  const open = drafts.length + pending;
  useEffect(() => { onPending?.(pending); }, [pending, onPending]);
  const counts = (["proposed", "pending", "accepted", "rejected", "dropped"] as const)
    .map((s) => [s, items.filter((x) => x.status === s).length] as const)
    .filter(([, n]) => n > 0);

  return (
    <Inset className="mt-3" role="region" aria-label="تعديلاتٌ مقترحة">
      <p className="text-read font-black text-foreground">تعديلاتٌ مقترحةٌ على الخطّة (اختياريّ)</p>
      {/* سطرٌ واحد — «كثيرُ الكلام» (صاحب المنصّة، ١١ أكتوبر ٢٠٢٦) */}
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        تُرفع مسوّدةً لا يراها المدرّب حتّى تعتمد بنودَها، ثمّ «اطلب تعديلات» فيقبل كلًّا أو يرفضه.
      </p>
      {counts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {counts.map(([s, n]) => <Chip key={s} tone={STATUS_AR[s].tone}>{STATUS_AR[s].label}: {n}</Chip>)}
        </div>
      )}
      {drafts.length > 0 && (
        <div className="mt-3 space-y-3" role="group" aria-label="مسوّداتٌ تنتظر مراجعتك">
          <p className="text-read font-bold text-gold-ink">
            {drafts.length} {drafts.length === 1 ? "بندٌ ينتظر" : "بنودٍ تنتظر"} مراجعتك
            {" "}<span className="font-normal text-muted-foreground">— مطلوب {drafts.filter((x) => x.required).length} · مقترح {drafts.filter((x) => !x.required).length}</span>
          </p>
          {canReview && drafts.length > 1 && (
            <Button
              tone="confirm" size="sm" icon={Check} disabled={busy}
              onClick={() => void review("all", () => apiPost<PlanEditItem[]>(`/api/admin/cohort-plans/${planId}/edits/approve-all`, {}), "اعتُمدت كلُّها للمدرّب.")}
            >
              اعتمِدها كلَّها للمدرّب ({drafts.length})
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
      )}
      {items.length > drafts.length && (
        <details className="mt-2">
          <summary className="cursor-pointer text-read font-bold text-teal-light-ink">ما رُوجع ({items.length - drafts.length})</summary>
          <ol className="mt-2 space-y-2">
            {items.filter((x) => x.status !== "proposed").map((x) => (
              <li key={x.id} className="text-read leading-6">
                <span className="font-bold text-foreground">{x.view.titleAr}</span>
                {" "}· <span className="text-muted-foreground">{x.view.stepAr}</span>
                {" "}· <Chip tone={STATUS_AR[x.status].tone}>{isNote(x) ? NOTE_STATUS_AR[x.status] ?? STATUS_AR[x.status].label : STATUS_AR[x.status].label}</Chip>
                {x.required && <> · <Chip tone="danger">مطلوب</Chip></>}
                {x.status === "rejected" && x.noteAr && <p className="text-muted-foreground">كلمتُه: {x.noteAr}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
      {canUpload && (
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            className="sr-only"
            aria-label="ملفُّ التعديلات المقترحة"
            accept="application/json,.json"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
          />
          <Button tone="secondary" size="sm" icon={FileJson} disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "يُفحص…" : "ارفع ملفَّ التعديلات"}
          </Button>
          {offerSchedule && (
            <Button tone="secondary" size="sm" icon={CalendarClock} disabled={busy} onClick={() => void schedule()}>
              جهّز جدولًا ثابتًا مقترحًا
            </Button>
          )}
          {open > 0 && (
            <Button tone="ghost" size="sm" disabled={busy} onClick={() => void withdraw()}>
              اسحب ما لم يُقرَّر ({open})
            </Button>
          )}
        </div>
      )}
      {msg && <p className="mt-2 whitespace-pre-wrap text-read font-bold text-teal-light-ink" role="status">{msg}</p>}
    </Inset>
  );
}

/* ═══════════ دفعةً واحدة — «خططٌ تنتظر اعتمادك» (١٠ أكتوبر ٢٠٢٦) ═══════════
   «I need one place to upload all of them same time!» (صاحب المنصّة). كلُّ ملفٍّ يحمل خطّتَه
   فيُرفع إليها بالمسلك الذي في البطاقة نفسِه — واحدا بعد واحد، وما رُدّ منها لا يوقف ما بعده. */

interface BulkResult {
  name: string;
  planId: string | null;
  labelAr: string | null;
  okAr: string | null;
  problemAr: string | null;
}

/** `plans` الخططُ المنتظِرة — لتُسمّى كلُّ نتيجةٍ بشعبتها ومدرّبها، ويُفتح ما فيها.
    `onUploaded` يُقال لكلّ خطّةٍ رُفع إليها — فتُعاد بطاقتُها إن كانت مفتوحة.
    `onOpen` يفتح بطاقتَها في الصفحة نفسِها لتُراجَع بنودُها. */
export function PlanEditsBulkUpload({ plans, onUploaded, onOpen }: {
  plans: readonly { id: string; labelAr: string }[];
  onUploaded: (planId: string) => void;
  onOpen: (planId: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [results, setResults] = useState<BulkResult[]>([]);
  const [summary, setSummary] = useState("");
  const [over, setOver] = useState(false);
  /* ويُرفع الملفُّ مكانَ مسوّداتٍ قديمةٍ لم تُعتمد — يختاره المعتمِد، ولا يُفترض (١٠ أكتوبر ٢٠٢٦) */
  const [replace, setReplace] = useState(false);

  const run = async (files: readonly File[]) => {
    if (progress || files.length === 0) return;
    setResults([]); setSummary("");
    const out: BulkResult[] = [];
    for (const [i, file] of files.entries()) {
      setProgress(`${i + 1} من ${files.length}`);
      const read = readEditsFile(file.name, await file.text());
      if (!read.ok) {
        out.push({ name: file.name, planId: null, labelAr: null, okAr: null, problemAr: read.problemAr });
      } else {
        const labelAr = plans.find((p) => p.id === read.planId)?.labelAr ?? read.titleAr;
        try {
          let okAr = uploadedLineAr(read.count, read.required);
          if (replace) {
            const r = await apiPost<{ replacedDrafts: number }>(`/api/admin/cohort-plans/${read.planId}/edits/replace-drafts`, read.body);
            okAr += replacedLineAr(r.replacedDrafts);
          } else {
            await apiPost<PlanEditItem[]>(`/api/admin/cohort-plans/${read.planId}/edits`, read.body);
          }
          out.push({ name: file.name, planId: read.planId, labelAr, okAr, problemAr: null });
          onUploaded(read.planId);
        } catch (e) {
          out.push({ name: file.name, planId: read.planId, labelAr, okAr: null, problemAr: errText(e, "تعذّر الرفع") });
        }
      }
      setResults([...out]);
    }
    setProgress(null);
    setSummary(bulkSummaryAr(out.filter((r) => r.okAr).length, out.filter((r) => !r.okAr).length));
    if (input.current) input.current.value = "";
  };

  return (
    <Inset className="mb-4 px-4 py-3" role="region" aria-label="ملفّاتُ التعديلات دفعةً واحدة">
      <p className="text-read font-black text-foreground">ارفع ملفّاتِ التعديلات المقترحة كلَّها دفعةً واحدة</p>
      <p className="mt-1 max-w-3xl text-read leading-6 text-muted-foreground">
        كلُّ ملفٍّ يعرف خطّتَه فيُرفع إليها وحدَه، ويُفحص كما يُفحص في بطاقتها: يُرفع كلُّه أو يُردّ كلُّه بسببه. وتُرفع
        مسوّداتٍ لا يراها المدرّبون — تراجع بنودَ كلِّ خطّةٍ في بطاقتها فتعتمدها أو تحذفها.
      </p>
      <div
        className={`mt-3 flex flex-wrap items-center gap-3 rounded-lg border-2 border-dashed p-4 ${over ? "border-teal-light-ink bg-teal-light-ink/5" : "border-border"}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void run(Array.from(e.dataTransfer.files)); }}
      >
        <input
          ref={input}
          type="file"
          multiple
          className="sr-only"
          aria-label="ملفّاتُ التعديلات المقترحة"
          accept="application/json,.json"
          onChange={(e) => void run(Array.from(e.target.files ?? []))}
        />
        <Button tone="secondary" size="sm" icon={Files} disabled={progress !== null} onClick={() => input.current?.click()}>
          {progress ? `يُرفع ${progress}…` : "اختر الملفّات"}
        </Button>
        <span className="text-read text-muted-foreground">أو اسحبها كلَّها إلى هنا وأفلتها.</span>
      </div>
      <label className="mt-3 flex items-start gap-2 text-read leading-6">
        <input type="checkbox" className="mt-1.5" checked={replace} disabled={progress !== null} onChange={(e) => setReplace(e.target.checked)} />
        <span>
          <span className="font-bold text-foreground">استبدل المسودات التي لم تعتمدها بعد</span>
          <span className="block text-muted-foreground">
            لكل خطة: تسحب المسودات القديمة وترفع الملف الجديد مكانها. لا تسحب شيئا إن رد الملف، وما اعتمدته للمدرب يبقى كما هو.
          </span>
        </span>
      </label>
      {summary && <p className="mt-3 text-read font-bold text-teal-light-ink" role="status">{summary}</p>}
      {results.length > 0 && (
        <ol className="mt-2 space-y-2">
          {results.map((r, i) => {
            const here = r.okAr && r.planId && plans.some((p) => p.id === r.planId);
            return (
              <li key={`${i}-${r.name}`} className="rounded-lg border border-border/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={r.okAr ? "positive" : "danger"}>{r.okAr ? "رُفع" : "رُدّ"}</Chip>
                  <span className="text-read font-bold text-foreground" dir="auto">{r.labelAr ?? r.name}</span>
                </div>
                {r.labelAr && <p className="mt-1 text-read text-muted-foreground" dir="auto">{r.name}</p>}
                {r.okAr && <p className="mt-1 text-read text-foreground">{r.okAr}</p>}
                {r.problemAr && <p className="mt-1 whitespace-pre-wrap text-read leading-6 text-danger-ink">{r.problemAr}</p>}
                {here && (
                  <Button className="mt-2" tone="ghost" size="sm" icon={ExternalLink} onClick={() => onOpen(r.planId!)}>
                    افتح خطّتَه وراجع بنودَها
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Inset>
  );
}

/* ═══════════ صفحةُ المدرّب ═══════════ */

/** لصفحة المدرّب — ما اقترحته الإدارةُ على خطّته، يقبل كلًّا أو يرفضه.
    `inHand` الخطّةُ في يده (مسودّةٌ أو مردودة) — وإلّا تُقرأ ولا يُقرَّر فيها.
    `unsaved` في يده تعديلٌ لم يُحفظ — فلا يُكتب فوقه بإعادة التحميل.
    `onApplied` يعيد تحميل الصفحة بعد ما يُكتب في الخطّة. */
export function PlanEditsPanel({ cohortId, inHand, unsaved, onApplied, onCounts, onOpenStep }: {
  cohortId: string;
  inHand: boolean;
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
  const blocked = !inHand ? "تُقبل التعديلاتُ حين تعود الخطّةُ إليك." : unsaved ? "احفظ ما كتبتَه أوّلا — فالقبولُ يكتب في الخطّة المحفوظة." : null;

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
        لماذا؟ (اختياريّ — يقرؤه المعتمِد)
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

  /* ═══ بندُ الملاحظة: نقاطُها، ثمّ «موافق» أو «لا أوافق» — وزرٌّ إلى خطوتها يعدّل فيها ═══ */
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
          {!blocked && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                tone="confirm" size="sm" icon={Check} disabled={busy !== null}
                onClick={() => void act(x.id, () => apiPost(`/api/trainer/plan-edits/${x.id}/accept`, {}), `وافقتَ على «${x.view.titleAr}».`, false)}
              >
                موافق
              </Button>
              <Button tone="ghost" size="sm" icon={X} disabled={busy !== null} onClick={() => { setRejecting(rejecting === x.id ? null : x.id); setNote(""); }}>
                لا أوافق
              </Button>
              {onOpenStep && x.step !== "general" && (
                <Button tone="secondary" size="sm" disabled={busy !== null} onClick={() => onOpenStep(x.step)}>
                  افتح «{x.view.stepAr}»
                </Button>
              )}
            </div>
          )}
          {whyBox(x, "أكّد أنّك لا توافق", `لم توافق على «${x.view.titleAr}» — وصلت كلمتُك الإدارة.`)}
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
                عدّلتَ هذا الموضعَ بعد أن اقترحناه — «بدلَ» ما كان فيه يومَها، لا ما فيه الآن. لك أن تقبله فوق ما كتبتَ، أو ترفضه.
              </p>
            )}
            {x.status === "pending" && !blocked && (
              <div className="mt-3 flex flex-wrap gap-2">
                {!x.goneAr && (
                  <Button
                    tone="confirm" size="sm" icon={Check} disabled={busy !== null}
                    onClick={() => void act(x.id, () => apiPost(`/api/trainer/plan-edits/${x.id}/accept`, x.stale ? { force: true } : {}), `قُبل «${x.view.titleAr}» وكُتب في خطّتك.`, true)}
                  >
                    {x.stale ? "اقبله فوق ما كتبتُ" : "اقبله"}
                  </Button>
                )}
                <Button tone="ghost" size="sm" icon={X} disabled={busy !== null} onClick={() => { setRejecting(rejecting === x.id ? null : x.id); setNote(""); }}>
                  ارفضه
                </Button>
              </div>
            )}
            {rejecting === x.id && (
              <div className="mt-2 space-y-2">
                <label className="block text-read text-muted-foreground">
                  لماذا؟ (اختياريّ — يقرؤه المعتمِد)
                  <textarea
                    rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background p-2 text-read text-foreground"
                  />
                </label>
                <Button
                  tone="secondary" size="sm" disabled={busy !== null}
                  onClick={() => void act(x.id, async () => { await apiPost(`/api/trainer/plan-edits/${x.id}/reject`, note.trim() ? { noteAr: note.trim() } : {}); setRejecting(null); }, `رُفض «${x.view.titleAr}» — لم يُمسّ شيء.`, false)}
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
    <section className="mt-2 space-y-3" role="region" aria-label="تعديلاتٌ اقترحتها الإدارة">
      <Inset className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-read font-black text-foreground">
            {pending.length === 0 ? `قرّرتَ فيها كلِّها (${items.length})` : `قرّرتَ في ${decided.length} من ${items.length}`}
          </p>
          <p className="mt-0.5 text-read leading-6 text-muted-foreground">ما تقبله يُكتب في خطّتك، وما ترفضه لا يمسّ شيئا.</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10" role="progressbar"
            aria-label="ما قرّرتَ فيه" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={decided.length}>
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
              if (r.skipped.length) throw new Error(`قُبل ${r.accepted}، وبقي ${r.skipped.length} ينتظر:\n${r.skipped.map((s) => `«${s.titleAr}»: ${s.problemAr}`).join("\n")}`);
            }, "قُبلت كلُّها وكُتبت في خطّتك.", true)}
          >
            اقبلها كلَّها ({pending.length})
          </Button>
        )}
      </Inset>
      {blocked && pending.length > 0 && <p className="text-read font-bold text-gold-ink">{blocked}</p>}
      {msg && <p className="whitespace-pre-wrap text-read font-bold text-teal-light-ink" role="status">{msg}</p>}

      {pendingNotes.length > 0 && (
        <>
          <h3 className="pt-1 text-read font-black text-foreground">ملاحظاتُنا — ما لم تذكره التعديلات</h3>
          <ol className="space-y-3">
            {pendingNotes.map((x) => noteCard(x))}
          </ol>
        </>
      )}
      {pendingEdits.length > 0 && (
        <>
          {pendingNotes.length > 0 && <h3 className="pt-1 text-read font-black text-foreground">التعديلاتُ المقترحة</h3>}
          <ol className="space-y-3">
            {pendingEdits.map((x) => editCard(x))}
          </ol>
        </>
      )}

      {decided.length > 0 && (
        <Inset as="details" className="p-3">
          <summary className="cursor-pointer text-read font-bold text-teal-light-ink">ما قرّرتَ فيه ({decided.length})</summary>
          <ol className="mt-2 space-y-1.5">
            {decided.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2 text-read leading-6">
                <span className="w-6 shrink-0 text-center font-black text-muted-foreground">{numberOf(x)}</span>
                <span className="font-bold text-foreground">{x.view.titleAr}</span>
                <Chip tone={STATUS_AR[x.status].tone}>{x.status === "accepted" ? (isNote(x) ? "وافقتَ" : "قبلتَه") : x.status === "rejected" ? (isNote(x) ? "لم توافق" : "رفضتَه") : STATUS_AR[x.status].label}</Chip>
                {x.status === "rejected" && x.noteAr && <span className="text-muted-foreground">— كلمتُك: {x.noteAr}</span>}
              </li>
            ))}
          </ol>
        </Inset>
      )}
    </section>
  );
}

const isNote = (x: PlanEditItem) => x.kind === "note";
/** والملاحظةُ يوافق عليها أو لا — لا «قُبل» و«رُفض» كالتعديل */
const NOTE_STATUS_AR: Partial<Record<PlanEditStatus, string>> = { pending: "عند المدرّب", accepted: "وافق", rejected: "لم يوافق" };

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
              {/* وقائمةُ النواقص محورا محورا ثمّ «كيف تُصلحه» — لا سطرا مكتظّا في خانة (١١ أكتوبر ٢٠٢٦) */}
              {gapLayout(r.beforeAr) ? (
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
            {r.beforeAr !== null && <Cell label="بدلَ" text={r.beforeAr} href={r.beforeHref} long={r.long} muted />}
          </dd>
        </div>
      ))}
    </dl>
  );
}
