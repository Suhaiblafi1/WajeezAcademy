/* اقتراحُ اسمٍ آخرَ للدورة — إصدارٌ منها لا دورةٌ ثانية (ح-٣).

   ═══ ما كان ═══

   حقلان في خطّة الشعبة اسمُهما «اقتراحٌ للإدارة (اختياريّ)»: اسمٌ للدورة
   واسمٌ للمسار. يركبان مع الخطّة، ويختار المعتمِدُ ما يقبله، فيُكتب الاسمُ
   **على النسخة الحاليّة من الدورة** بـ`updateMany`.

   وثلاثةُ أعطابٍ فيه، لا واحد:

   ① الكتابةُ فوق النسخة القائمة تُعيد تسميةَ **كلِّ شهادةٍ صدرت** — صفحةُ
      التحقّق العامّة كانت تقرأ آخرَ إصدار. (أُصلحت القراءةُ في `ك-٢`،
      وأُغلق البابُ هنا.)
   ② ولا سجلَّ لمن اقترح ولا لِمَ — الاسمُ يتبدّل ولا يبقى منه إلّا أثرٌ واحد.
   ③ واسمُ المسار ليس اقتراحا أصلا: المدرّبُ لا يعيد تسميةَ مسارٍ مشترك، بل
      يبني **مسارَه هو** من دوراته باسمه (القسم «ن») — فالحقلُ يَعِدُ بما لا
      يُنفَّذ.

   ═══ وما صار ═══

   الاسمُ نوعُ تغييرٍ في القناة التي بُنيت له: `TrainerChangeService` —
   maker-checker (لا يعتمد المدرّبُ اقتراحَه)، ودائرةُ أثرٍ تُعرض للمعتمِد،
   وسببٌ مكتوبٌ يبقى، ونهايتُه **إصدارٌ جديد** يحمل الاسمَ الجديد ويترك ما
   قبله كما كان. وهو نصُّ ح-٣: «النسخة رقم ٢» لا دورةٌ مستقلّة.

   ولا بوّابةَ صلاحيّةٍ عليه: علّةُ `catalogScopeGate` الأثرُ البنيويّ، والاسمُ
   لا ساعةً يزيد ولا محورا. والتعليلُ مكتوبٌ في `scope-policy.ts`.

   ═══ والاقتراحُ القديمُ لا يُهجَر ═══

   خطّةٌ محفوظةٌ فيها `proposals.courseTitleAr` مكتوبٌ بيد مدرّبٍ حقيقيّ
   تبقى كما هي في القاعدة — لا تُمحى ولا يُعاد تفسيرُها — ويُعرض ما كتبه
   هنا مهيّأً ليُرسَل في القناة الجديدة. فلا يضيع ما كتبه، ولا يُرسَل باسمه
   شيءٌ لم يضغط عليه. */

import { useCallback, useEffect, useState } from "react";
import { Tag } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { staffControlCls, StaffField } from "@/components/FormKit";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";

/** حدّا الاسم — نسخةُ الواجهة ممّا يفرضه الخادم في `trainer-change.service` */
const MIN_TITLE = 4;
const MAX_TITLE = 120;
const MIN_REASON = 10;

interface Proposal {
  id: string;
  courseId: string;
  status: string;
  createdAt: string;
  reason: string;
  titleAr: string | null;
}

/** ما يُقال للمدرّب عن حالة اقتراحه — بلغته لا بحالة قاعدة البيانات */
const STATUS_AR: Record<string, string> = {
  draft: "مسودّة",
  submitted: "عند الإدارة — لم يُبتّ فيه بعد",
  under_review: "قيد المراجعة",
  changes_requested: "رُدَّ إليك بطلب تعديل",
  approved_for_catalog: "قُبل — ينتظر النشر",
  published: "نُشر — صار إصدارا جديدا للدورة",
  rejected: "لم يُقبل",
  withdrawn: "سحبتَه",
  superseded: "تجاوزه اقتراحٌ بعده",
};

/** الاقتراحُ الحيُّ وحدَه يمنع اقتراحا ثانيا — والمبتوتُ لا يمنع */
const LIVE = ["draft", "submitted", "under_review", "changes_requested", "approved_for_catalog"];

export default function CourseTitleProposal({
  courseId, currentTitleAr, legacyDraft, locked,
}: {
  courseId: string;
  currentTitleAr: string;
  /** اسمٌ كتبه في الصندوق القديم ولم يُطبَّق — يُعرض مهيّأً لا مُرسَلا */
  legacyDraft?: string | null;
  locked: boolean;
}) {
  const [rows, setRows] = useState<Proposal[] | null>(null);
  const [titleAr, setTitleAr] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    apiGet<Proposal[]>(`/api/trainer/course-title-proposals?courseId=${encodeURIComponent(courseId)}`)
      .then(setRows)
      .catch(() => setRows([]));
  }, [courseId]);
  useEffect(() => { load(); }, [load]);

  /* ما كتبه في الصندوق القديم يملأ الحقلَ مرّةً واحدة — ولا يُرسَل بنفسه */
  useEffect(() => {
    const draft = legacyDraft?.trim();
    if (draft && draft !== currentTitleAr.trim()) {
      setTitleAr(draft);
      setOpen(true);
    }
  }, [legacyDraft, currentTitleAr]);

  if (rows === null) return null;

  const live = rows.find((r) => LIVE.includes(r.status)) ?? null;
  const last = rows[0] ?? null;
  const canSend =
    !busy && !locked &&
    titleAr.trim().length >= MIN_TITLE && titleAr.trim().length <= MAX_TITLE &&
    titleAr.trim() !== currentTitleAr.trim() &&
    reason.trim().length >= MIN_REASON;

  const send = async () => {
    setBusy(true);
    try {
      await apiPost("/api/trainer/course-title-proposals", {
        courseId, titleAr: titleAr.trim(), reason: reason.trim(),
      });
      setTitleAr("");
      setReason("");
      setOpen(false);
      load();
      toast("وصل اقتراحُك الإدارةَ — ونتيجتُه تظهر هنا");
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر إرسالُ الاقتراح");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (id: string) => {
    setBusy(true);
    try {
      await apiPost(`/api/trainer/course-title-proposals/${id}/withdraw`, {});
      load();
      toast("سُحب الاقتراح");
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر سحبُ الاقتراح");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Inset className="mt-5">
      <p className="flex items-center gap-2 text-read font-black text-foreground">
        <Tag className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> اسمُ الدورة في الكتالوج
      </p>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        الاسمُ الآنَ «<b className="text-foreground">{currentTitleAr}</b>». وإن رأيتَ اسما أدقَّ فاقترحه —
        تعتمده الإدارةُ فيصير <b className="text-foreground">إصدارا جديدا</b> من الدورة نفسِها،
        ولا يُمَسُّ ما صدر من شهاداتٍ باسمها القديم.
      </p>

      {/* حالةُ ما أرسله — قبل أن يُعرض له بابُ إرسالٍ ثانٍ */}
      {last && (
        <p className="mt-3 text-read leading-6 text-muted-foreground">
          آخرُ اقتراحٍ لك: «<b className="text-foreground">{last.titleAr}</b>» — {STATUS_AR[last.status] ?? last.status}.
          {live && live.id === last.id && (
            <Button tone="secondary" size="sm" disabled={busy} onClick={() => withdraw(live.id)} className="mr-2">
              اسحبه
            </Button>
          )}
        </p>
      )}

      {live ? (
        <p className="mt-3 text-read leading-6 text-muted-foreground">
          ولا يُرسَل اقتراحان في وقتٍ واحدٍ على الدورة نفسِها — انتظر قرارَها أو اسحب اقتراحَك.
        </p>
      ) : open ? (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <StaffField label="الاسمُ الذي تقترحه" hint="أربعةُ أحرفٍ فأكثر — وهو ما سيقرؤه المتعلّمُ في الكتالوج مكانَ الاسم الحاليّ.">
              <input value={titleAr} disabled={locked} maxLength={MAX_TITLE}
                onChange={(e) => setTitleAr(e.target.value)}
                placeholder={currentTitleAr} className={staffControlCls} />
            </StaffField>
            <StaffField label="لماذا هو أدقّ؟" hint="يقرؤه المعتمِدُ ويبقى في سجلّ الدورة — فسطرٌ واحدٌ صريحٌ يكفي.">
              <input value={reason} disabled={locked} maxLength={2000}
                onChange={(e) => setReason(e.target.value)}
                placeholder="مثال: الاسمُ الحاليُّ يصف الأداةَ لا المهارة" className={staffControlCls} />
            </StaffField>
          </div>
          <Button tone="secondary" size="sm" disabled={!canSend} onClick={() => void send()} className="mt-3">
            أرسل الاقتراح للإدارة
          </Button>
        </>
      ) : (
        <Button tone="secondary" size="sm" disabled={busy || locked} onClick={() => setOpen(true)} className="mt-3">
          اقترح اسما آخر
        </Button>
      )}
    </Inset>
  );
}
