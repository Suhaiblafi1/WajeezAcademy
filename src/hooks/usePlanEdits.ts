/* حالُ تعديلات الخطّة لمساحة مراجعتها — لسانا «اقتراحات Claude» و«بطاقات للمدرب» و«أدوات Claude» وزرُّ القرار
   تقرؤه معا (`src/components/admin/TrainerPlanReview.tsx`). وفي ملفّه لا في `PlanEdits.tsx`: ملفُّ المكوّنات لا يصدّر
   غيرَها، وإلّا لم يعمل التحديثُ الحيّ (`react-refresh/only-export-components`). */
import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, ApiError } from "@/services/api";
import type { PlanEditsUploadCounts } from "@/application/trainer/plan-edits";
import { uploadedLineAr } from "@/application/trainer/plan-edits-bulk";
import type { PlanEditItem } from "@/components/PlanEdits";

const errText = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback);

/* ═══ وحالُ التعديلات واحدٌ لمواضعها الثلاثة (٢٦ أكتوبر ٢٠٢٦، المرحلة الخامسة) ═══
   «خطّة لوحة الإدارة» (٣د): ما اقترحه Claude في لسانه، وما اعتمدته للمدرّب في لسانه، والرفعُ في «أدوات Claude». وكان
   صندوقا واحدا يحمل حالَه (`PlanEditsUploader`) — فصار الحالُ هنا تقرؤه المواضعُ الثلاثة: ما يُعتمد في لسانٍ يُعدّ في
   الآخر بلا تحميلٍ ثان، ويُعدّ على زرّ القرار. */
export interface PlanEditsState {
  items: PlanEditItem[];
  /** مسوّداتٌ لم تُعتمد للمدرّب — لسانُ «اقتراحات Claude» */
  drafts: PlanEditItem[];
  /** ما يُعدّ للردّ: بطاقاتٌ عند المدرّب لا ملاحظات — كما يعدّها الخادم (`pendingEdits`) */
  pendingCards: number;
  /** ما لم يُقرَّر فيه — يسحبه «اسحب ما لم يقرّر» */
  open: number;
  busy: boolean;
  reviewing: string | null;
  msg: string;
  say: (msg: string) => void;
  upload: (file: File) => Promise<void>;
  schedule: () => Promise<void>;
  withdraw: () => Promise<void>;
  review: (key: string, run: () => Promise<PlanEditItem[]>, done: string) => Promise<void>;
}

/** حالُ تعديلات الخطّة — `planId` ما لم تُحمَّل الخطّةُ بعد `null`: يُقرأ ولا يُرفع */
export function usePlanEdits(planId: string | null, cohortId: string): PlanEditsState {
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
    if (!planId) return;
    setBusy(true); setMsg("");
    try {
      let body: unknown;
      try { body = JSON.parse(await file.text()); }
      catch { throw new Error(`«${file.name}» ليس ملفّ JSON مقروءا`); }
      /* وما رُفع قبلُ يُتجاهَل، والأحدثُ يحلّ محلّ ما لم يُقرَّر فيه — ويُقال ما وقع (٢٦ أكتوبر ٢٠٢٦، `upload`) */
      const r = await apiPost<{ edits: PlanEditItem[] } & PlanEditsUploadCounts>(`/api/admin/cohort-plans/${planId}/edits`, body);
      setItems(r.edits);
      setMsg(`«${file.name}»: ${uploadedLineAr(r)}`);
    } catch (e) {
      setMsg(errText(e, "تعذّر الرفع"));
    } finally {
      setBusy(false);
    }
  };

  /* ═══ جدولٌ ثابتٌ بسلسلته تبنيه المنصّة (١١ أكتوبر ٢٠٢٦) ═══
     «في حال قمنا بتعديل شيءٍ قد يؤثّر على توقيتاتٍ أخرى يجب أن يكون التعديلُ كاملا بسلسلة» (صاحب
     المنصّة). فبندٌ واحدٌ باللقاءات ومواعيد المهامّ التي تتبعها — مسوّدةً تراجعها قبل المدرّب. */
  const schedule = async () => {
    if (!planId) return;
    setBusy(true); setMsg("");
    try {
      setItems(await apiPost<PlanEditItem[]>(`/api/admin/cohort-plans/${planId}/edits/schedule`, {}));
      setMsg("جهّز الجدول مسوّدة — راجعه في «اقتراحات Claude»: كلّ لقاء بموعده قبل وبعد، ومعه مواعيد المهامّ التي تتبعه.");
    } catch (e) {
      setMsg(errText(e, "تعذّر تجهيز الجدول"));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!planId) return;
    setBusy(true); setMsg("");
    try {
      setItems(await apiDelete<PlanEditItem[]>(`/api/admin/cohort-plans/${planId}/edits`));
      setMsg("سحب ما لم يقرّر فيه. ولتعيده ارفع ملفه من جديد.");
    } catch (e) {
      setMsg(errText(e, "تعذّر السحب"));
    } finally {
      setBusy(false);
    }
  };

  /* ═══ ولا يصل المدرّبَ ما لم تعتمده الإدارة (١٠ أكتوبر ٢٠٢٦) ═══
     «كلُّ ما يُطلب من المدرّب قبولُه يقبله المديرُ أو المديرُ الأكاديميُّ أو مديرُ المحتوى
     أوّلا» (صاحب المنصّة). فالمسوّدةُ تُعرض كاملةً بما قبلها وما بعدها، ولكلٍّ زرّان. */
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
  /* وما يُعدّ للردّ بطاقاتٌ لا ملاحظات — كما يعدّها الخادم (`pendingEdits`) */
  const pendingCards = items.filter((x) => x.status === "pending" && x.kind !== "note").length;
  return { items, drafts, pendingCards, open: drafts.length + pending, busy, reviewing, msg, say: setMsg, upload, schedule, withdraw, review };
}
