/* تعديلاتٌ تقترحها الإدارةُ على خطّة المدرّب — يقبل كلًّا أو يرفضه (٨ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «التعديلُ يطول على المدرّب — نكتبه نحن ويختار هو». والوجهان هنا:
   `PlanEditsUploader` لبطاقة المراجعة (يُرفع الملفّ، ويُرى حالُ كلّ بند، ويُسحب ما لم
   يُقرَّر)، و`PlanEditsPanel` لصفحة المدرّب (يقرأ كلَّ تعديلٍ بما قبله وما بعده، ويقبله
   أو يرفضه). والقاعدةُ والعرضُ في `application/trainer/plan-edits.ts` — والشاشتان
   تعرضان ما يحسبه الخادمُ منها، لا تحسبان. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, FileJson, X } from "lucide-react";
import { apiDelete, apiGet, apiPost, ApiError } from "@/services/api";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import type { EditView, PlanEditStatus } from "@/application/trainer/plan-edits";

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
  /* والرابطُ يُفتح في لسانٍ جديد — يتحقّق منه قبل أن يقبله */
  const body = text === null
    ? <span className="text-muted-foreground">— فارغ</span>
    : href
      ? <a href={href} target="_blank" rel="noreferrer" dir="ltr" className="break-all font-bold text-teal-light-ink underline">{text}</a>
      : <span className={`whitespace-pre-wrap break-words ${muted ? "text-muted-foreground" : "text-foreground"}`}>{text}</span>;
  return (
    <div className="rounded-md border border-border/60 px-2 py-1.5 text-read leading-6">
      <span className="me-1 text-fine font-black text-muted-foreground">{label}:</span>
      {long && text !== null && text.length > 280
        ? <details><summary className="cursor-pointer">{text.slice(0, 200)}…</summary>{body}</details>
        : body}
    </div>
  );
}

/* ═══════════ بطاقةُ المراجعة ═══════════ */

/** لبطاقة المراجعة — يُرفع الملفّ والخطّةُ بانتظار القرار أو في يد مدرّبها */
export function PlanEditsUploader({ planId, cohortId, canUpload, canReview, onPending }: {
  planId: string;
  cohortId: string;
  canUpload: boolean;
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
  const pending = items.filter((x) => x.status === "pending").length;
  const open = drafts.length + pending;
  useEffect(() => { onPending?.(pending); }, [pending, onPending]);
  const counts = (["proposed", "pending", "accepted", "rejected", "dropped"] as const)
    .map((s) => [s, items.filter((x) => x.status === s).length] as const)
    .filter(([, n]) => n > 0);

  return (
    <Inset className="mt-3" role="region" aria-label="تعديلاتٌ مقترحة">
      <p className="text-read font-black text-foreground">تعديلاتٌ مقترحةٌ على الخطّة (اختياريّ)</p>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        ملفٌّ (JSON) بالتعديلات بندا بندا: يُفحص كلُّه على الخطّة الآن، ويُرفع كلُّه أو يُردّ كلُّه بما لا يقع فيه.
        ويُرفع مسوّدةً لا يراها المدرّب: تراجع كلَّ بندٍ هنا فتعتمده له أو تحذفه. ثمّ «اطلب تعديلات» — ويكفي
        ما اعتمدتَه سببا — فيراه المدرّبُ بما قبله وما بعده، ويقبل كلًّا أو يرفضه.
      </p>
      {counts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {counts.map(([s, n]) => <Chip key={s} tone={STATUS_AR[s].tone}>{STATUS_AR[s].label}: {n}</Chip>)}
        </div>
      )}
      {drafts.length > 0 && (
        <div className="mt-3 space-y-3" role="group" aria-label="مسوّداتٌ تنتظر مراجعتك">
          <p className="text-read font-bold text-gold-ink">
            {drafts.length} {drafts.length === 1 ? "بندٌ ينتظر" : "بنودٍ تنتظر"} مراجعتك — لا يصل المدرّبَ منها شيءٌ حتّى تعتمده.
          </p>
          {canReview && drafts.length > 1 && (
            <Button
              tone="confirm" size="sm" icon={Check} disabled={busy}
              onClick={() => void review("all", () => apiPost<PlanEditItem[]>(`/api/admin/cohort-plans/${planId}/edits/approve-all`, {}), "اعتُمدت كلُّها للمدرّب.")}
            >
              اعتمِدها كلَّها للمدرّب ({drafts.length})
            </Button>
          )}
          <ol className="space-y-3">
            {drafts.map((x) => (
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
            ))}
          </ol>
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
                {" "}· <Chip tone={STATUS_AR[x.status].tone}>{STATUS_AR[x.status].label}</Chip>
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

/* ═══════════ صفحةُ المدرّب ═══════════ */

/** لصفحة المدرّب — ما اقترحته الإدارةُ على خطّته، يقبل كلًّا أو يرفضه.
    `inHand` الخطّةُ في يده (مسودّةٌ أو مردودة) — وإلّا تُقرأ ولا يُقرَّر فيها.
    `unsaved` في يده تعديلٌ لم يُحفظ — فلا يُكتب فوقه بإعادة التحميل.
    `onApplied` يعيد تحميل الصفحة بعد ما يُكتب في الخطّة. */
export function PlanEditsPanel({ cohortId, inHand, unsaved, onApplied }: {
  cohortId: string;
  inHand: boolean;
  unsaved: boolean;
  onApplied: () => void | Promise<unknown>;
}) {
  const [items, setItems] = useState<PlanEditItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try { setItems(await apiGet<PlanEditItem[]>(`/api/trainer/cohorts/${cohortId}/plan-edits`)); }
    catch { /* الصفحةُ تُقرأ بلا القائمة */ }
  }, [cohortId]);
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

  return (
    <Inset className="mt-2" role="region" aria-label="تعديلاتٌ اقترحتها الإدارة">
      <p className="text-read font-black text-foreground">
        تعديلاتٌ اقترحتها الإدارة{pending.length > 0 ? ` — ${pending.length} تنتظر قرارك` : ""}
      </p>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        كتبناها عنك لتوفّر وقتك: ترى كلًّا بما قبله وما بعده ولماذا. ما تقبله يُكتب في خطّتك كأنّك كتبته، وما ترفضه لا يمسّ شيئا.
        والمطلوبُ منها شرطُ الاعتماد — وإن رفضته فعدّل موضعَه بطريقتك.
      </p>
      {pending.length > 1 && !blocked && (
        <div className="mt-2">
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
        </div>
      )}
      {blocked && pending.length > 0 && <p className="mt-2 text-read font-bold text-gold-ink">{blocked}</p>}
      {msg && <p className="mt-2 whitespace-pre-wrap text-read font-bold text-teal-light-ink" role="status">{msg}</p>}
      <ol className="mt-3 space-y-3">
        {items.map((x) => (
          <li key={x.id} className="rounded-lg border border-border/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-read font-black text-foreground">{x.view.titleAr}</span>
              <Chip tone={x.required ? "danger" : "info"}>{x.required ? "مطلوب" : "مقترح"}</Chip>
              <span className="text-fine text-muted-foreground">{x.view.stepAr}</span>
              {x.status !== "pending" && <Chip tone={STATUS_AR[x.status].tone}>{x.status === "accepted" ? "قبلتَه" : x.status === "rejected" ? "رفضتَه" : STATUS_AR[x.status].label}</Chip>}
            </div>
            <p className="mt-1 text-read leading-6 text-muted-foreground">لماذا: {x.reasonAr}</p>
            <Rows view={x.view} />
            {x.status === "pending" && x.goneAr && (
              <p className="mt-2 text-read font-bold text-gold-ink">لا يقع الآن: {x.goneAr}. لك أن ترفضه.</p>
            )}
            {x.status === "pending" && x.stale && !x.goneAr && (
              <p className="mt-2 text-read font-bold text-gold-ink">
                عدّلتَ هذا الموضعَ بعد أن اقترحناه — «قبل» أعلاه ما كان فيه يومَها، لا ما فيه الآن. لك أن تقبله فوق ما كتبتَ، أو ترفضه.
              </p>
            )}
            {x.status === "pending" && !blocked && (
              <div className="mt-2 flex flex-wrap gap-2">
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
            {rejecting === x.id && x.status === "pending" && (
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
            {x.status === "rejected" && x.noteAr && <p className="mt-1 text-read text-muted-foreground">كلمتُك: {x.noteAr}</p>}
          </li>
        ))}
      </ol>
    </Inset>
  );
}
