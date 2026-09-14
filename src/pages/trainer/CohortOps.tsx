/* تشغيلُ الشعبة — المرحلةُ الثانية من صفحة الشعبة الواحدة.

   ═══ ما كان ═══

   شاشتان لشعبةٍ واحدة: «ورشةُ الشعبة» للتجهيز (الاسمُ والمحاورُ والمصادرُ
   والاعتماد)، و«شعبي» للتشغيل (الحضورُ والموادُّ والتكاليفُ والرسائل) — وكلُّ
   شعبةٍ في «شعبي» طيّةٌ تُفتح على كلّ ذلك دفعةً واحدة. فسأل صاحبُ المنصّة:
   «أين المصادر وأين تفاصيل الواجبات؟ أرى فقط عنوانا» — كانت في الشاشة
   الأخرى.

   ═══ القرار (٨ سبتمبر ٢٠٢٦) ═══

   صفحةٌ واحدةٌ للشعبة بمرحلتين: «التجهيز» ثمّ «التشغيل». وهذا الملفُّ هو
   التشغيل: ما يفعله المدرّبُ والشعبةُ جارية — يسجّل الحضور، ويفتح الاجتماع،
   ويرفع التسجيل، ويقترح تأجيلا، ويخاطب متعلّميه، ويضيف موادّ، ويرى تكاليفَه
   وما سُلّم منها. وأمّا تأليفُ التكاليف فمرحلةٌ في التجهيز، ومن هنا بابٌ
   إليها.

   والحرّاسُ الذين كانوا على «شعبي» انتقلوا إلى هنا بحمولتهم نفسِها
   (`cohort-messaging.test.ts` · `cohort-board-assignments.test.ts`): الرسالةُ
   تُسجَّل ثمّ تُوصَّل والسجلُّ يُعاد تحميلُه، والتأجيلُ يُقترح ولا يُغيَّر،
   وأزرارُ الحضور تقول حالتَها لمن لا يرى. */

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import { fmtDateTimeAr } from "@/utils/format";
import { Panel, Card, Inset } from "@/components/ui/Surface";
import BookAdminMeeting from "@/components/BookAdminMeeting";
import { useRealSession } from "@/services/session";
import Button from "@/components/ui/Button";
import { controlCls, areaCls } from "@/components/FormKit";

interface TrainerCohort {
  role: string;
  cohort: {
    id: string; title: string; status: string;
    course: { versions: { titleAr: string }[] };
    sessions: {
      id: string; title: string; startsAt: string; status: string;
      zoom: { joinUrl: string; passcode: string | null } | null;
      recordings: { id: string; title: string; readUrl: string | null }[];
    }[];
    /* المخاطبةُ وحدَها تحتاج المسجَّلين — اسما وحالةً لا أكثر. والتقدّمُ
       والحضورُ والإحالةُ خرجت مع لوحاتها (ع-١ · د-٤). */
    enrollments: {
      id: string; status: string;
      user: { displayName: string };
    }[];
  };
}

interface CohortMessage {
  id: string; audience: string; body: string; recipients: number; createdAt: string;
  author: { displayName: string };
  enrollment: { user: { displayName: string } } | null;
}

export default function CohortOps({ cohortId }: { cohortId: string }) {
  const { user: me } = useRealSession();
  const [row, setRow] = useState<TrainerCohort | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgForm, setMsgForm] = useState({ body: "", enrollmentId: "" });
  const [msgLog, setMsgLog] = useState<Record<string, CohortMessage[]>>({});

  const load = useCallback(async () => {
    try { setRow(await apiGet<TrainerCohort>(`/api/trainer/cohorts/${cohortId}/ops`)); setErr(""); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "تعذّر قراءة تشغيل الشعبة"); }
  }, [cohortId]);
  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, doneMsg: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(doneMsg); await load(); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر تنفيذ الإجراء"); }
    finally { setBusy(false); }
  };

  /* رفعُ ملفٍّ — تسجيلٌ ثمّ رفعٌ موقّع. والخادمُ يفكّ جسمَ الرفع كـoctet-stream
     فقط؛ النوعُ الحقيقيُّ مسجَّلٌ في خطوة التسجيل التي قبله. */
  /* ── مخاطبة الشعبة ──
     الرسالة تُسجَّل ثم تُوصَّل، والسجلّ يُعاد تحميله فورا: من أرسل يرى أثره
     لا رسالةَ نجاحٍ تختفي. */
  const loadMessages = useCallback(async (cohortId: string) => {
    try {
      const list = await apiGet<CohortMessage[]>(`/api/trainer/cohorts/${cohortId}/messages`);
      setMsgLog((prev) => ({ ...prev, [cohortId]: list }));
    } catch { /* السجلّ رفاهية — غيابه لا يمنع الإرسال */ }
  }, []);

  const sendMessage = (cohortId: string) => {
    if (!msgForm.body.trim()) return;
    void act(async () => {
      await apiPost(`/api/trainer/cohorts/${cohortId}/messages`, {
        audience: msgForm.enrollmentId === "advisors" ? "advisors" : msgForm.enrollmentId ? "learner" : "cohort",
        enrollmentId: msgForm.enrollmentId && msgForm.enrollmentId !== "advisors" ? msgForm.enrollmentId : undefined,
        body: msgForm.body.trim(),
      });
      setMsgForm({ body: "", enrollmentId: "" });
      await loadMessages(cohortId);
    }, msgForm.enrollmentId === "advisors"
      ? "وصلت رسالتك مستشاري متعلّميك — وبقيت في السجلّ"
      : msgForm.enrollmentId
        ? "وصلت رسالتك المتعلّم — وبقيت في السجلّ"
        : "بلغ إعلانك الشعبة — وبقي في السجلّ");
  };

  if (err) return <Card tone="danger" role="alert" className="text-center text-read font-bold text-red-300">{err}</Card>;
  if (!row) return <div className="grid place-items-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" /></div>;

  const c = row.cohort;
  const active = c.enrollments.filter((e) => e.status !== "waitlisted");

  return (
    <div className="space-y-5">
      {/* ── وانتقلت «اللقاءاتُ والحضور» إلى «لقاءات مباشرة» (د-٤) ──
         موضعُها `SessionsAndAttendance.tsx` في مرحلة التجهيز، حيث يجدول
         المدرّبُ لقاءَه. نُقلت ولم تُنسَخ: شبكةُ الحضور تُعيد حسابَ التقدّم،
         ونسختان منها بابان لرقمٍ واحدٍ يُبنى عليه استحقاقُ شهادة. */}
      {/* ── وسقطت «من التحق وتقدّمُه» (ع-١) ──
         تكرارُ تبويب «طلبتي» (`MyLearners`): الأسماءُ نفسُها والنسبُ نفسُها
         وفيه بحثٌ ليس هنا. ولم تُنقل لأنّ لها موضعا قائما. */}
      <Panel as="section">
        <h3 className="flex items-center gap-2 text-sm font-black text-foreground">
          <MessageSquarePlus className="h-4 w-4 text-teal-light-ink" /> مخاطبة الشعبة
        </h3>
        <p className="mt-1 text-read leading-relaxed text-muted-foreground">
          إعلانٌ يبلغ كلّ مسجَّل، أو رسالةٌ إلى متعلّم بعينه، أو إلى المستشارين الذين يتابعون متعلّميك.
          وكلُّها تبقى في السجلّ أدناه.
        </p>
        <div className="mt-3 space-y-2.5">
          <select aria-label="إلى من" value={msgForm.enrollmentId}
            onChange={(e) => setMsgForm((f) => ({ ...f, enrollmentId: e.target.value }))}
            className={`${controlCls} [&>option]:bg-surface`}>
            <option value="">إلى الشعبة كلّها ({active.length} متعلّما)</option>
            {/* ع-١: ومستشارو متعلّمي هذه الشعبة — لا رابطَ بين مستشارٍ ودورة
                في البيانات، والطريقُ الوحيدُ المسنود: متعلّموك ← حالاتُهم ←
                من يتابعها إسنادا قائما. */}
            <option value="advisors">إلى مستشاري متعلّميك</option>
            {active.map((e) => <option key={e.id} value={e.id}>إلى {e.user.displayName} وحده</option>)}
          </select>
          <textarea aria-label="نصّ الرسالة" rows={3} maxLength={2000} value={msgForm.body}
            onChange={(e) => setMsgForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="اكتب ما تريد أن يبلغهم…" className={areaCls} />
          <Button tone="confirm" size="sm" type="button" disabled={busy || msgForm.body.trim().length < 2}
            onClick={() => sendMessage(c.id)} className="min-h-9 disabled:cursor-not-allowed">
            <MessageSquarePlus className="h-3 w-3" /> أرسل
          </Button>
        </div>
        <div className="mt-4 border-t border-white/8 pt-3">
          <Button type="button" tone="ghost" size="sm" className="px-0 text-teal-light-ink" onClick={() => void loadMessages(c.id)}>
            {msgLog[c.id] ? "حدّث السجلّ" : "اعرض سجلّ ما أُرسل"}
          </Button>
          {msgLog[c.id] && (
            msgLog[c.id].length === 0 ? (
              <p className="mt-2 text-read text-muted-foreground">لم تُرسل شيئا في هذه الشعبة بعد.</p>
            ) : (
              <ul className="mt-2.5 space-y-2">
                {msgLog[c.id].map((m) => (
                  <Inset as="li" key={m.id}>
                    <p className="text-read text-muted-foreground">
                      {m.audience === "cohort"
                        ? `إلى الشعبة · ${m.recipients} متعلّما`
                        : m.audience === "advisors"
                          ? `إلى المستشارين · ${m.recipients}`
                          : `إلى ${m.enrollment?.user.displayName ?? "متعلّم"}`}
                      {" · "}{fmtDateTimeAr(m.createdAt)}
                    </p>
                    <p className="mt-1.5 whitespace-pre-line text-read leading-6 text-foreground">{m.body}</p>
                  </Inset>
                ))}
              </ul>
            )
          )}
        </div>
      </Panel>

      {/* ── وانتقلت «موادُّ الشعبة» إلى «المصادر» (ع-١) ──
         موضعُها `CohortMaterials.tsx`. ولم تُحذف كأختَيها: لا تبويبَ يحملها،
         فحذفُها يسلب المدرّبَ بابَ الكرّاسة والرابط. */}
      {/* ع-١ نصًّا: «وأضف السطرَ: تريد أن تسأل أو تفهم شيئا؟ احجز اجتماعا مع
          الإدارة». ومن فتح شعبتَه ليخاطب أحدا قد يكون سؤالُه للإدارة لا
          لمتعلّميه — والمكوّنُ هو هو الذي في لوحة المدرّب، لا نسخةٌ ثانية. */}
      <BookAdminMeeting name={me?.displayName ?? ""} email={me?.email ?? ""} />

      {/* ── وسقطت «المهامُّ وتسليماتُها» (ع-١) ──
         التصحيحُ في «طابور التقييم» (`GradingQueue`) — وهو التبويبُ الذي
         يَفعل لا الذي يَعرض، ورأسُ ملفّه يروي كيف جُمع التصحيحُ فيه بعد أن
         كان في موضعين. والتأليفُ مرحلةٌ في التجهيز. */}
    </div>
  );
}
