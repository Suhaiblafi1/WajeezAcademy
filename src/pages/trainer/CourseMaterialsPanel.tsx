/* دوراتُك قيد الإعداد — في «مؤهّلاتي» أثناء طور العرض المشروط.

   ═══ ولم يعد لوحَ موادّ (٢ أكتوبر ٢٠٢٦) ═══

   كان هنا لكلّ دورةٍ محرّرٌ يكتب فيه المدرّبُ محاورَها ورابطَها ومهمّتَها
   ومصادرَها، ثمّ يكتبها ثانيةً مفصّلةً في «شعبي» بعد تفعيله. وقرارُ صاحب
   المنصّة: «هذا تكرارٌ للعمل! دعهم يقبلون الدورةَ ثمّ يذهبون إلى «شعبي»
   ليعبّئوا كلَّ شيءٍ مرّةً واحدة». فصار هنا **قرارٌ** لكلّ دورة لا محرّر:

   · «اقبلها وابدأ إعدادها» — تُنشأ لها شعبةُ إعدادٍ في «شعبي» يعبّئها.
   · «اعتذرْ عنها» — بسببٍ يصل من اختارها له.
   · وما قبِله يُفتح من هنا إلى شعبته، بحاله: يُعَدّ، أُرسل، رُدّ بملاحظات.

   والعلّةُ كاملةً في `server/services/trainer-prep.service.ts`.

   ═══ ثمّ صار قطعتين في صفوف «دوراتي» لا لوحا فوقها (الخطوة F، ١٩ أكتوبر ٢٠٢٦) ═══

   كان لوحا بعنوانه («دوراتك قيد الإعداد») فوق قائمة العروض، فالدورةُ الواحدةُ تُقرأ في موضعين بكلمتين.
   وصارت «دوراتي» صفّا لكلّ دورة (`application/trainer/my-courses.ts`)، فبقي من اللوح ما لا يقوله الصفّ:
   **قرارُ الدورة** (`PrepDecision`) في صفّها، و**ما يخصّ طورَ الإعداد** (`PrepSetupNote`) فوق القائمة. */

import { useState } from "react";
import { CalendarPlus, Check, X } from "lucide-react";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { staffAreaCls } from "@/components/FormKit";
import { toast, toastError } from "@/components/Toast";
import { apiPost, ApiError } from "@/services/api";
import {
  ORIENTATION_BOOKING_URL, ORIENTATION_CTA_AR, ORIENTATION_INVITE_AR,
} from "@/application/trainer/orientation-session";

export type PrepState = "to_decide" | "preparing" | "submitted" | "returned" | "approved" | "declined";

export interface PrepRow {
  courseId: string;
  titleAr: string;
  state: PrepState;
  cohortId: string | null;
  cohortTitle: string | null;
  declineReasonAr: string | null;
  /** معتمَدةٌ له أصلا — يقبلها ولا يعتذر عنها (٣ أكتوبر ٢٠٢٦) */
  approved?: boolean;
}

/** ما يخصّ طورَ الإعداد — فوق القائمة، ويغيب عمّن تجاوزه */
export function PrepSetupNote({ rows }: { rows: PrepRow[] }) {
  const live = rows.filter((r) => r.state !== "declined");
  /* أُرسلت كلُّها: ما يُعان عليه انتهى، فلا تُعرض دعوةُ الجلسة */
  const underReview = live.length > 0 && live.every((r) => r.state === "submitted");
  /* ═══ والمعتمَدةُ بلا شعبةٍ معها (٣ أكتوبر ٢٠٢٦) ═══
     قرارُ صاحب المنصّة («B»): المدرّبُ النشطُ يقبل دورتَه المعتمَدةَ بنفسه هنا.
     فمن لا دورةَ له في طور الإعداد لا يُدعى إلى جلسة تهيئةٍ عن طورٍ لم يعد فيه،
     ولا يُذكَر له «لا أتعابَ قبل اعتماد دوراتك». */
  const inSetup = live.some((r) => !r.approved);
  if (!inSetup) return null;
  return (
    <div className="mb-4 grid gap-3">
      {!underReview && (
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
          ما تقبله تنشأ له شعبة إعداد في «شعبي» تعبّئها وترسلها لاعتمادنا. لا متعلّمين فيها ولا تنشر، ولا أتعاب قبل اعتماد دوراتك.
        </p>
      )}
      {/* ═══ وجلسةُ التهيئة حيث يُعَدّ ما تُعين عليه (٣٠ سبتمبر ٢٠٢٦) ═══
          قرارُ صاحب المنصّة: «أضِفه في موادّ دوراتك». ويغيب حين تُرسَل كلُّها. */}
      {inSetup && !underReview && (
        <Inset tone="accent" className="flex flex-wrap items-center justify-between gap-3 p-3.5">
          <p className="min-w-0 flex-1 text-sm leading-7">{ORIENTATION_INVITE_AR}</p>
          <Button as="a" href={ORIENTATION_BOOKING_URL} target="_blank" rel="noreferrer noopener" size="sm" icon={CalendarPlus}>
            {ORIENTATION_CTA_AR}
          </Button>
        </Inset>
      )}
      {inSetup && underReview && (
        <Inset tone="default" className="p-3 text-sm leading-6">
          أرسلت شعب دوراتك كلّها للاعتماد — وتفعّل مدرّبا حين نعتمدها.
        </Inset>
      )}
    </div>
  );
}

/** قرارُ دورة الإعداد — «اقبلها وابدأ إعدادها»، أو الاعتذارُ بسببٍ يصل من اختارها له */
export function PrepDecision({ row: r, onChanged }: { row: PrepRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");

  async function act(path: string, body: unknown, ok: string) {
    setBusy(true);
    try {
      await apiPost(`/api/trainer/prep/${encodeURIComponent(r.courseId)}/${path}`, body);
      toast(ok);
      setDeclining(false);
      onChanged();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر الإجراء — أعد المحاولة");
    } finally {
      setBusy(false);
    }
  }

  if (!declining) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <Button tone="confirm" size="sm" icon={Check} loading={busy}
          onClick={() => void act("accept", {}, "قبلتها — وشعبة إعدادها في «شعبي»")}>
          اقبلها وابدأ إعدادها
        </Button>
        {!r.approved && (
          <Button tone="secondary" size="sm" icon={X} disabled={busy} onClick={() => setDeclining(true)}>
            اعتذر عنها
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="mt-3 grid gap-2">
      <label className="grid gap-1 text-sm">
        <span className="font-bold">سبب الاعتذار — يقرؤه من اختار لك الدورة</span>
        <textarea className={staffAreaCls} rows={2} maxLength={1000} value={reason}
          onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button tone="secondary" size="sm" icon={X} loading={busy} disabled={reason.trim().length < 3}
          onClick={() => void act("decline", { reasonAr: reason.trim() }, "اعتذرت عنها — ووصل سببك")}>
          أرسل الاعتذار
        </Button>
        <Button tone="ghost" size="sm" disabled={busy} onClick={() => setDeclining(false)}>تراجع</Button>
      </div>
    </div>
  );
}
