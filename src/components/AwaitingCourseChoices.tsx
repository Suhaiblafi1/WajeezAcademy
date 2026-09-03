/* الدورة التي لا شعبةَ لها — ثلاثة أبواب لا بابٌ مسدود.

   كانت تُعرض في الخطّة ويُقال «نُعلمك عند فتحها». وهو صادق، لكنّه لا يترك
   للمتعلّم شيئا يفعله: قد ينتظر شهورا، وقد لا يريدها أصلا، وقد يكون في
   الكتالوج ما يخدم المهارات نفسَها وله شعبةٌ اليوم.

   فالأبواب ثلاثة، وكلُّها قرارُ المتعلّم في خطّته لا في التزامٍ قائم:

   **استبدالها** — بديلٌ له شعبةٌ الآن ويشارك أكثرَ مهاراتها. والترتيب بعدد
   المهارات المشتركة، ويُقال العدد صراحةً كي يكون الاختيار على بيّنة.

   **حذفها** — وتُطلب تأكيدةً واحدة، لأنّه حذفٌ لا يُستردّ بضغطة.

   **إبقاؤها** — بإشعارٍ عند الفتح أو بلا إشعار. والإشعار هو الافتراض: من
   أبقاها في خطّته يريدها. ومن أطفأه لا يُلاحَق برسائل. */

import { useState } from "react";
import { AlertTriangle, ArrowLeftRight, Bell, BellOff, Loader2, Trash2, X } from "lucide-react";
import { apiGet, apiPut, apiDelete, ApiError } from "@/services/api";

interface Alternative {
  courseId: string;
  titleAr: string;
  sharedSkills: number;
  startsAt: string | null;
  price: string | number | null;
  currency: string;
}

type Mode = null | "replace" | "remove";

export default function AwaitingCourseChoices({
  courseId,
  courseTitle,
  notifyOnCohort,
  onChanged,
}: {
  courseId: string;
  courseTitle: string;
  notifyOnCohort: boolean;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [alts, setAlts] = useState<Alternative[] | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const openReplace = async () => {
    setMode("replace");
    setError("");
    if (alts) return;
    setBusy("alts");
    try {
      const r = await apiGet<{ alternatives: Alternative[] }>(
        `/api/learner/plan/items/${encodeURIComponent(courseId)}/alternatives`,
      );
      setAlts(r.alternatives);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر جلب البدائل");
    } finally {
      setBusy("");
    }
  };

  const act = async (kind: "replace" | "remove" | "notify", withCourseId?: string) => {
    setBusy(kind);
    setError("");
    try {
      const base = `/api/learner/plan/items/${encodeURIComponent(courseId)}`;
      if (kind === "replace") await apiPut(`${base}/replace`, { withCourseId });
      else if (kind === "remove") await apiDelete(base);
      else await apiPut(`${base}/notify`, { on: !notifyOnCohort });
      setMode(null);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر تنفيذ الإجراء");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="w-full border-t border-white/8 pt-3">
      <p className="text-[11px] leading-5 text-muted-foreground">
        لا شعبةَ لها بعد. تستطيع أن تنتظرها، أو تستبدلها بما يخدم المهارات نفسَها الآن، أو تحذفها من خطّتك.
      </p>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">
          <AlertTriangle className="h-3 w-3 shrink-0" /> {error}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button" onClick={() => void openReplace()} disabled={busy !== ""}
          className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-foreground transition hover:border-teal/50 hover:text-teal-light-ink disabled:opacity-40"
        >
          <ArrowLeftRight className="h-3 w-3" /> استبدلها
        </button>

        <button
          type="button" onClick={() => setMode(mode === "remove" ? null : "remove")} disabled={busy !== ""}
          className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-foreground transition hover:border-red-500/50 hover:text-red-300 disabled:opacity-40"
        >
          <Trash2 className="h-3 w-3" /> احذفها من خطّتي
        </button>

        <button
          type="button" onClick={() => void act("notify")} disabled={busy !== ""}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-40 ${
            notifyOnCohort
              ? "border-teal/40 text-teal-light-ink hover:border-white/25 hover:text-foreground"
              : "border-white/15 text-muted-foreground hover:border-teal/50 hover:text-teal-light-ink"}`}
        >
          {busy === "notify" ? <Loader2 className="h-3 w-3 animate-spin" />
            : notifyOnCohort ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
          {notifyOnCohort ? "سنُعلمك عند فتحها" : "بلا إشعار"}
        </button>
      </div>

      {/* ── تأكيد الحذف ── */}
      {mode === "remove" && (
        <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/[0.06] p-3">
          <p className="text-[11.5px] leading-6 text-foreground">
            تُحذف «{courseTitle}» من خطّتك. تستطيع إضافتها لاحقا من الكتالوج.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button" onClick={() => void act("remove")} disabled={busy !== ""}
              className="rounded-full bg-red-500/85 px-4 py-1.5 text-[11px] font-black text-white hover:bg-red-500 disabled:opacity-40"
            >
              {busy === "remove" ? <Loader2 className="h-3 w-3 animate-spin" /> : "احذفها"}
            </button>
            <button
              type="button" onClick={() => setMode(null)}
              className="rounded-full border border-white/15 px-4 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground"
            >
              تراجع
            </button>
          </div>
        </div>
      )}

      {/* ── البدائل ── */}
      {mode === "replace" && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-foreground">بدائلُ لها شعبةٌ الآن</p>
            <button type="button" onClick={() => setMode(null)} aria-label="إغلاق البدائل" className="text-white/40 hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {busy === "alts" ? (
            <div className="grid place-items-center py-6"><Loader2 className="h-4 w-4 animate-spin text-white/40" /></div>
          ) : !alts || alts.length === 0 ? (
            <p className="py-4 text-[11px] leading-6 text-muted-foreground">
              لا بديلَ الآن يخدم مهاراتها وله شعبةٌ مفتوحة. أبقِها منتظرةً ونُعلمك عند فتحها.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {alts.map((a) => (
                <li key={a.courseId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[11.5px] font-bold">{a.titleAr}</p>
                    <p className="mt-0.5 text-micro text-muted-foreground">
                      تشترك في {a.sharedSkills} {a.sharedSkills === 1 ? "مهارة" : a.sharedSkills === 2 ? "مهارتين" : "مهارات"}
                      {a.price !== null && <> · {Number(a.price)} {a.currency}</>}
                    </p>
                  </div>
                  <button
                    type="button" onClick={() => void act("replace", a.courseId)} disabled={busy !== ""}
                    className="shrink-0 rounded-full bg-teal px-3.5 py-1.5 text-[11px] font-black text-on-teal hover:bg-teal-light disabled:opacity-40"
                  >
                    {busy === "replace" ? <Loader2 className="h-3 w-3 animate-spin" /> : "ضعها بدلها"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
