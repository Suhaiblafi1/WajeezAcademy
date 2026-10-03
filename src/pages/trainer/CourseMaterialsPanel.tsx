/* دوراتُك قيد الإعداد — في «مؤهّلاتي» أثناء طور العرض المشروط.

   ═══ ولم يعد لوحَ موادّ (٢ أكتوبر ٢٠٢٦) ═══

   كان هنا لكلّ دورةٍ محرّرٌ يكتب فيه المدرّبُ محاورَها ورابطَها ومهمّتَها
   ومصادرَها، ثمّ يكتبها ثانيةً مفصّلةً في «شعبي» بعد تفعيله. وقرارُ صاحب
   المنصّة: «هذا تكرارٌ للعمل! دعهم يقبلون الدورةَ ثمّ يذهبون إلى «شعبي»
   ليعبّئوا كلَّ شيءٍ مرّةً واحدة». فصار هنا **قرارٌ** لكلّ دورة لا محرّر:

   · «اقبلها وابدأ إعدادها» — تُنشأ لها شعبةُ إعدادٍ في «شعبي» يعبّئها.
   · «اعتذرْ عنها» — بسببٍ يصل من اختارها له.
   · وما قبِله يُفتح من هنا إلى شعبته، بحاله: يُعَدّ، أُرسل، رُدّ بملاحظات.

   والعلّةُ كاملةً في `server/services/trainer-prep.service.ts`. */

import { useState } from "react";
import { Link } from "react-router";
import { CalendarPlus, Check, FileStack, Users, X } from "lucide-react";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
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

const STATE_AR: Record<PrepState, { label: string; tone: "warn" | "info" | "positive" | "neutral" }> = {
  to_decide: { label: "بانتظار قرارك", tone: "warn" },
  preparing: { label: "تُعِدّها في «شعبي»", tone: "info" },
  returned: { label: "رُدّت بملاحظات", tone: "warn" },
  submitted: { label: "أُرسلت — تنتظر اعتمادَنا", tone: "positive" },
  approved: { label: "اعتُمدت", tone: "positive" },
  declined: { label: "اعتذرتَ عنها", tone: "neutral" },
};

export default function CourseMaterialsPanel({ rows, onChanged }: {
  rows: PrepRow[];
  onChanged: () => void;
}) {
  if (rows.length === 0) return null;
  const live = rows.filter((r) => r.state !== "declined");
  const decided = rows.filter((r) => r.state !== "to_decide").length;
  /* أُرسلت كلُّها: ما يُعان عليه انتهى، فلا تُعرض دعوةُ الجلسة */
  const underReview = live.length > 0 && live.every((r) => r.state === "submitted");
  /* ═══ والمعتمَدةُ بلا شعبةٍ معها (٣ أكتوبر ٢٠٢٦) ═══
     قرارُ صاحب المنصّة («B»): المدرّبُ النشطُ يقبل دورتَه المعتمَدةَ بنفسه هنا.
     فمن لا دورةَ له في طور الإعداد يُقال له ما يخصّه، ولا يُدعى إلى جلسة
     تهيئةٍ عن طورٍ لم يعد فيه، ولا يُذكَر له «لا أتعابَ قبل اعتماد دوراتك». */
  const inSetup = live.some((r) => !r.approved);

  return (
    <section aria-labelledby="materials-h" className="mb-8">
      <h2 id="materials-h" className="flex items-center gap-2 text-lg font-black">
        <FileStack className="h-5 w-5 text-teal-light-ink" aria-hidden="true" /> {inSetup ? "دوراتُك قيد الإعداد" : "دوراتُك المعتمَدة بلا شعبة"}
      </h2>
      {inSetup ? (
        <p className="mt-1 max-w-3xl text-sm leading-7 text-muted-foreground">
          لكلّ دورةٍ اخترناها لك: اقبلها أو اعتذر عنها. وكلُّ دورةٍ تقبلها تُنشأ لها شعبةُ إعدادٍ في «شعبي»
          تعبّئ فيها كلَّ شيءٍ مرّةً واحدة — المحاورَ والكرّاسةَ واللقاءاتِ والمهامَّ والمصادر — ثمّ ترسلها لاعتمادنا.
          وشعبةُ الإعداد لا متعلّمين فيها ولا تُنشَر، ولا أتعابَ قبل اعتماد دوراتك.
          {" "}<span className="font-bold text-foreground">قرّرتَ في {decided} من {rows.length}.</span>
        </p>
      ) : (
        <p className="mt-1 max-w-3xl text-sm leading-7 text-muted-foreground">
          دوراتٌ اعتُمدت لك وليس لك فيها شعبة. اقبل ما تريد تدريسَه فتُنشأ له شعبةٌ في «شعبي» باسم الدورة،
          تعبّئها مرّةً واحدةً وترسلها لاعتمادنا. ولا متعلّمين فيها حتّى نعتمدها ونفتحها للتسجيل. وما لا تريده الآن اتركه.
        </p>
      )}
      {/* ═══ وجلسةُ التهيئة حيث يُعَدّ ما تُعين عليه (٣٠ سبتمبر ٢٠٢٦) ═══
          قرارُ صاحب المنصّة: «أضِفه في موادّ دوراتك». ويغيب حين تُرسَل كلُّها. */}
      {inSetup && !underReview && (
        <Inset tone="accent" className="mt-3 flex flex-wrap items-center justify-between gap-3 p-3.5">
          <p className="min-w-0 flex-1 text-sm leading-7">{ORIENTATION_INVITE_AR}</p>
          <Button as="a" href={ORIENTATION_BOOKING_URL} target="_blank" rel="noreferrer noopener" size="sm" icon={CalendarPlus}>
            {ORIENTATION_CTA_AR}
          </Button>
        </Inset>
      )}
      {inSetup && underReview && (
        <Inset tone="default" className="mt-3 p-3 text-sm leading-6">
          أرسلتَ شعبَ دوراتك كلَّها، فهي عندنا للاعتماد — وتُفعَّل مدرّبا حين نعتمدها، ويصلك خبرُ ذلك.
        </Inset>
      )}
      <ul className="mt-4 grid gap-2.5">
        {rows.map((r) => <CourseCard key={r.courseId} row={r} onChanged={onChanged} />)}
      </ul>
    </section>
  );
}

function CourseCard({ row: r, onChanged }: { row: PrepRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const s = STATE_AR[r.state];

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

  return (
    <Card as="li" className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 flex-1 text-read font-bold leading-6">{r.titleAr}</span>
        <Chip tone={s.tone} srPrefixAr="الحال">{s.label}</Chip>
      </div>

      {r.state === "declined" && r.declineReasonAr && (
        <p className="mt-1 text-sm leading-6 text-muted-foreground">سببُك: {r.declineReasonAr}</p>
      )}

      {r.state === "to_decide" && !declining && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button tone="confirm" size="sm" icon={Check} loading={busy}
            onClick={() => void act("accept", {}, "قبِلتَها — وشعبةُ إعدادها في «شعبي»")}>
            اقبلها وابدأ إعدادها
          </Button>
          {!r.approved && (
            <Button tone="secondary" size="sm" icon={X} disabled={busy} onClick={() => setDeclining(true)}>
              اعتذرْ عنها
            </Button>
          )}
        </div>
      )}

      {r.state === "to_decide" && declining && (
        <div className="mt-3 grid gap-2">
          <label className="grid gap-1 text-sm">
            <span className="font-bold">سببُ الاعتذار — يقرؤه من اختار لك الدورة</span>
            <textarea className={staffAreaCls} rows={2} maxLength={1000} value={reason}
              onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button tone="secondary" size="sm" icon={X} loading={busy} disabled={reason.trim().length < 3}
              onClick={() => void act("decline", { reasonAr: reason.trim() }, "اعتذرتَ عنها — ووصل سببُك")}>
              أرسلِ الاعتذار
            </Button>
            <Button tone="ghost" size="sm" disabled={busy} onClick={() => setDeclining(false)}>تراجعْ</Button>
          </div>
        </div>
      )}

      {r.cohortId && r.state !== "declined" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button as={Link} to={`/trainer/cohort/${r.cohortId}`} size="sm" icon={Users}>
            افتح شعبتَها في «شعبي»
          </Button>
          {r.cohortTitle && <span className="text-sm text-muted-foreground">{r.cohortTitle}</span>}
        </div>
      )}
    </Card>
  );
}
