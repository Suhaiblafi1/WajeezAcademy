/* «المدربون» — من صار مدرّبا: طلباتُ التأهيل، ودوراتٌ قيد الإعداد، وملفُّه العامّ، والإيقاف.

   ═══ وصارت شاشةً واحدة (١٨ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة: «لماذا هناك تكرار في صفحات أخرى مثل صفحة التأهيل والإسناد وإسناد من
   المدرب؟». فضُمّتا هنا باسم «المدربون»، وسقط ما يتكرّر: «أهّله مباشرة» (التصنيفُ يؤهّل —
   `qualifyOnClassify` — وصفحةُ الشعبة تؤهّل وتسند معا)، و«أسنده» (صفحةُ الشعبة بابُه)، وشاشةُ
   «إسنادٌ من المدرّب» كلُّها — ورابطُها القديمُ يحوَّل إلى هنا. وبقي ما لا يقع إلّا هنا.

   ═══ وما كُتب لها أوّلَ مرّة ═══

   خمسةُ مساراتٍ كان الخادمُ يعرفها ولا شاشةَ تصل إليها.

   المسارات: البتُّ في طلبات التأهيل · التأهيلُ المباشر · الإسنادُ لشعبة ·
   اعتمادُ الظهور العامّ · الإيقاف. وكلُّها مكتوبةٌ ومُختبَرةٌ في الخادم منذ
   شهور، **ولا زرَّ واحدا يطلبها**. فالنتيجةُ أنّ مدرّبا لا يمكن أن يصير
   مؤهَّلا أبدا، وصفحةَ المدرّبين العامّةَ لا يمكن أن تعرض أحدا، ولا يُسنَد
   أحدٌ إلى شعبة — لا لعطبٍ في المنطق بل لغياب مدخل.

   ── وترتيبُ الشاشة ترتيبُ السلسلة لا ترتيبُ الأهمّيّة ──

   الطابورُ أوّلا لأنّه ما ينتظر قرارا **من غيرك**؛ ثمّ المدرّبون، وفي بطاقة
   كلٍّ منهم **ما يمنع خطوتَه التالية** لا قائمةُ أزرارٍ متساوية: بلا حسابٍ لا
   يُسنَد، وبلا اعتمادِ نشرٍ لا يظهر للعامّة. */

import PrepReminderRow, { ReminderDeadline, type ReminderRow } from "@/components/admin/PrepReminders";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, BadgeCheck, CheckCircle2, ChevronDown, Clock, Download, GraduationCap, ImagePlus, Loader2, Search,
  Send, ServerOff, ShieldAlert, UserPlus, Users, XCircle,
} from "lucide-react";
import { toast, toastError } from "@/components/Toast";
import { apiDownload, apiGet, apiPost, apiPut, ApiError } from "@/services/api";
import ImageFramer from "@/components/ImageFramer";
import { PHOTO_OUT_MIME } from "@/lib/prepare-image";

/* أصلُ الـAPI: في التطوير منفذٌ آخرُ غيرُ خادم Vite */
const API_BASE: string = import.meta.env.VITE_API_URL ?? "";
import { controlCls, staffAreaCls } from "@/components/FormKit";
import { matchesQuery } from "@/application/text/search-ar";
import { fmtDate, fmtDateTime } from "@/application/text/format-ar";
import ConfirmAction from "@/components/ConfirmAction";
import { Link, useNavigate } from "react-router";
import { OVERRIDE_MIN_REASON } from "@/application/trainer/readiness";
import { useRealSession } from "@/services/session";

import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import TabBar from "@/components/ui/TabBar";
import { BIO_MAX_WORDS, countWords } from "@/application/trainer/public-text";
import { PITCH_MAX_CHARS, PITCH_MAX_LINES, PITCH_MAX_WORDS, bioSuggestionProblemAr, cleanPitchLines, pitchHeadingAr, pitchProblemAr } from "@/application/trainer/pitch";
import {
  cohortLineAr, cohortsTallyAr, photoTrailAr, planMarkAr, planMarkOf, PLAN_MARK, textTrailAr,
  type CardCohort, type ProfileTrail,
} from "@/application/trainer/trainer-card";
import {
  approvedToAccept, firstActOf, quietLineAr, stateChipAr, STEP_ACT_AR, stepsLineAr, TRAINER_STATES, trainerStateOf,
  trainerSteps, type StepAct, type TrainerState,
} from "@/application/trainer/trainer-status";
interface OpsQualification { courseId: string; courseTitle: string; status: string }
interface OpsTrainer {
  profileId: string;
  applicationId: string;
  name: string;
  email: string;
  applicationStatus: string;
  hasAccount: boolean;
  suspended: boolean;
  publiclyVisible: boolean;
  /** له دورةٌ منشورةٌ هذا الفصلَ أو بعده — وإلّا فلا يظهر ولو اعتُمد نشرُه */
  hasLiveCourse: boolean;
  isVerified: boolean;
  headline: string | null;
  bioPublic: string | null;
  photoUrl: string | null;
  /* صورةٌ رفعها هو من حسابه وتنتظر قرارَنا — ولا تراها العامّةُ حتّى تُعتمد */
  pendingPhotoUrl: string | null;
  /* وعنوانٌ ونبذةٌ كتبهما هو من حسابه — يُعدَّلان هنا إن شئتَ ثمّ يُعتمَدان */
  pendingText: { headline: string | null; bio: string | null; at: string } | null;
  /* «لماذا نفتخر به»: المعروضُ، وآخرُ اقتراح، ومسوّدتُه الأولى لمن لم يُقترح عليه شيء */
  pitchLines: string[];
  pitchLatest: OpsSuggestion | null;
  pitchDraft: string[] | null;
  /* ونبذتُه بصياغتنا — «قبل/بعد» عنده (`trainer-suggestion.service.ts`) */
  bioLatest: OpsSuggestion | null;
  bioDraft: string | null;
  qualifications: OpsQualification[];
  /* شعبُه بحالها ومواعيدها وخطّتها — من `CohortTrainer` (`trainer-card.ts`) */
  cohorts: CardCohort[];
  /* ومن وضع صورتَه ومن كتب نبذتَه — من الأثر */
  trail: ProfileTrail;
  /* آخرُ عقدٍ غيرِ مُزاح — من عليه الخطوةُ ما دام طلبُه غيرَ نشط (`trainer-status.ts`) */
  contract: { status: string } | null;
  /* يُعتمَد من بطاقته: `null` = لا، ومصفوفةٌ فيها ما ينقص تجهيزَه — فارغةٌ إن تمّ (`listForOps`) */
  approveBlockersAr: string[] | null;
}

/** ترتيبُ الحال في القائمة — ترتيبُ الفلاتر نفسُه */
const STATE_ORDER = Object.fromEntries(TRAINER_STATES.map((x, i) => [x.id, i])) as Record<TrainerState, number>;
type TrainerFilter = TrainerState | "all";

interface OpsSuggestion {
  id: string;
  kind: "pitch" | "bio";
  lines: string[];
  editedLines: string[];
  status: "pending" | "edited" | "accepted" | "rejected";
  noteAr: string | null;
  decidedAt: string | null;
}

interface PendingRequest {
  id: string;
  courseId: string;
  note: string | null;
  requestedAt: string | null;
  profile: { id: string; application: { fullName: string; status: string } };
  course: { id: string; versions: { titleAr: string }[] };
  requestedCohort: { id: string; title: string; startsAt: string | null; status: string } | null;
  /** طلبٌ من جدولة شعبة، أم دورةٌ يعدّها (`pending-kind.ts`) */
  kind: "request" | "preparing";
  /** حالُ إعدادها وشعبتُه — للدورة التي يعدّها وحدَها */
  prep: { state: PrepState; cohortId: string | null; cohortTitle: string | null } | null;
}

/* ═══ الدورةُ التي يعدّها ليست طلبا (١٣ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة عن ٥٥ بطاقةً تحت «طلبات التأهيل المعلّقة»، أكثرُها «من طلب
   الانضمام»، وعليها «أهّله وأسنده» و«ارفض». وتلك دوراتٌ قال المدرّبُ إنّه
   يدرّسها، يقرّر فيها **اعتمادُ خطّة شعبة إعدادها** — والزرُّ كان يعتمدها قبل
   أن تُقرأ خطّتُها، ولا شعبةَ يسنده إليها. فاختار «افصلهما»:

     · الطابورُ للطلبات وحدَها، وعددُه عددُها.
     · والدوراتُ قيد الإعداد قائمةٌ وحدَها مطويّة، لكلٍّ حالُها ورابطُ خطّتها،
       وزرٌّ صريحٌ «اعتمدها دون انتظار الخطة» يقول قبل التنفيذ ما يقع به.

   ولا «ارفض» عليها هنا: من يعتذر عنها هو المدرّب في «دوراتي»، وما يُسحب منه
   يُسحب من شاشة العقود حيث عقدُه. */
type PrepState = "to_decide" | "preparing" | "submitted" | "returned" | "approved" | "declined";

const PREP_AR: Record<PrepState, { label: string; tone: "warn" | "info" | "positive" | "neutral" | "accent" }> = {
  to_decide: { label: "لم يقبلها بعد", tone: "neutral" },
  preparing: { label: "يعدها في «شعبي»", tone: "info" },
  returned: { label: "ردت إليه بملاحظات", tone: "warn" },
  submitted: { label: "خطتها تنتظر قرارك", tone: "accent" },
  approved: { label: "معتمدة", tone: "positive" },
  declined: { label: "اعتذر عنها", tone: "neutral" },
};

interface CourseOpt { id: string; titleAr?: string; title?: string }

const QUAL_LABEL: Record<string, string> = {
  qualified: "مؤهّل", pending: "طلب معلّق", rejected: "مرفوض", retired: "متقاعد",
};

/* دوراتُه وشعبُه — كلُّ دورةٍ بتأهيله فيها، وتحتها شعبُه: حالُها، وأوّلُ لقاء، وحالُ خطّته.
   وكان هنا عمودُ «مسند إلى» يقرأ جدولَ الإسناد القديم، فيقول «لا إسناد نشط» لمن له شعبٌ قائمة.
   والعلّةُ في `src/application/trainer/trainer-card.ts`. */
function TrainerCourses({ trainer: t }: { trainer: OpsTrainer }) {
  const courses = [
    ...t.qualifications.map((q) => ({ courseId: q.courseId, title: q.courseTitle, status: q.status as string | null })),
    ...[...new Map(t.cohorts.filter((c) => !t.qualifications.some((q) => q.courseId === c.courseId))
      .map((c) => [c.courseId, { courseId: c.courseId, title: c.courseTitle, status: null as string | null }])).values()],
  ];
  return (
    <div className="mt-2.5">
      <p className="text-read font-black text-muted-foreground">
        دوراته وشعبه <span className="font-bold">· {cohortsTallyAr(t.cohorts)}</span>
      </p>
      {courses.length === 0 ? (
        <p className="mt-1 text-read text-muted-foreground">لا دورة له بعد.</p>
      ) : (
        <ul className="mt-1 space-y-1.5 text-fine leading-6">
          {courses.map((x) => {
            const mine = t.cohorts.filter((c) => c.courseId === x.courseId);
            return (
              <li key={x.courseId}>
                <span className="font-bold">{x.title}</span>
                {x.status && (
                  <span className={x.status === "qualified" ? "text-teal-light-ink" : "text-muted-foreground"}> · {QUAL_LABEL[x.status] ?? x.status}</span>
                )}
                {mine.length === 0 ? (
                  <p className="ps-4 text-muted-foreground">لا شعبة له فيها بعد.</p>
                ) : (
                  <ul className="ps-4">
                    {mine.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center gap-x-2">
                        <Link to={`/admin/cohorts?cohort=${c.id}`} className="font-bold text-teal-light-ink underline-offset-2 hover:underline">{c.title}</Link>
                        <span className="text-muted-foreground">{cohortLineAr(c, fmtDate)}</span>
                        <Chip tone={PLAN_MARK[planMarkOf(c)].tone}>{planMarkAr(c, fmtDate)}</Chip>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ملفُّ المدرّب العامّ — ما تعرضه صفحةُ الفريق، يُحرَّر حيث يُقرَّر نشرُه.

   ═══ العطبُ الذي كُتب له ═══

   `headline` و`bioPublic` كانا يُبذران مرّةً من نصّ الطلب ثمّ لا يُعدَّلان
   أبدا — لا في الإدارة ولا في بوّابة المدرّب. فنبذةٌ كُتبت في نموذج تقديمٍ
   قبل أشهرٍ هي وجهُ المدرّب إلى الناس. و`photoUrl` عمودٌ **لا يكتبه شيءٌ في
   الشيفرة كلِّها**.

   ═══ ورابطٌ أو رفعٌ — واحدٌ يعمل اليومَ والآخرُ ينتظر قرارَ تشغيل ═══

   حقلُ الرابط يعمل الآنَ بلا تخزين. وزرُّ الرفع يحتاج `FILE_UPLOADS=on`،
   فيُقال ذلك في الشاشة لا في رسالة خطأ بعد الضغط. */
/* ═══ ما نقترحه على بطاقته — «لماذا نفتخر به» ونبذتُه بصياغتنا (١٩ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «لماذا نفتخر بك» **إضافةٌ** تصله «نريد أن نضيف عنك هذا» فيعدّلها
   ويضيف إليها — وما عدّله يعود هنا فيُعتمد (`edited`)؛ والنبذةُ بصياغتنا **«قبل/بعد»** يقبلها
   أو يرفضها. والحقولُ تبدأ بآخر ما يُعرف: تعديلُه، أو المعلَّقُ عنده، أو المرفوضُ لتُعدَّل،
   أو المعروضُ، أو مسوّدتُه الأولى من نبذته (`server/services/trainer-suggestion-drafts.ts`).
   ولا يظهر منها للعامّة شيءٌ قبل قراره — فالإرسالُ هنا اقتراحٌ لا نشر. */

/** حالُ آخر اقتراح — شارةٌ واحدةٌ تقول أين هو */
function SuggestionChip({ latest, shown, draft }: { latest: OpsSuggestion | null; shown: boolean; draft: boolean }) {
  if (latest?.status === "pending") return <Chip tone="warn" srPrefixAr="الحالة">عند المدرب — ينتظر قراره</Chip>;
  if (latest?.status === "edited") return <Chip tone="info" srPrefixAr="الحالة">عدّله المدرب — راجعه واعتمده</Chip>;
  if (latest?.status === "rejected") return <Chip tone="danger" srPrefixAr="الحالة">رفضه</Chip>;
  if (shown) return <Chip tone="positive" srPrefixAr="الحالة">يظهر في بطاقته</Chip>;
  if (draft) return <Chip tone="neutral" srPrefixAr="الحالة">مسودة من نبذته — راجعها ثم أرسلها</Chip>;
  return null;
}

function useRun(onSaved: () => Promise<void> | void) {
  const [busy, setBusy] = useState(false);
  const run = async (path: string, body: unknown, ok: string) => {
    setBusy(true);
    try {
      await apiPost(path, body);
      toast(ok);
      await onSaved();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    } finally { setBusy(false); }
  };
  return { busy, run };
}

function PitchEditor({ trainer, onSaved }: { trainer: OpsTrainer; onSaved: () => Promise<void> | void }) {
  const latest = trainer.pitchLatest;
  const open = latest?.status === "pending" || latest?.status === "edited" ? latest : null;
  const edited = latest?.status === "edited" ? latest : null;
  const start = edited?.editedLines
    ?? (latest?.status === "pending" || latest?.status === "rejected" ? latest.lines : null)
    ?? (trainer.pitchLines.length > 0 ? trainer.pitchLines : trainer.pitchDraft ?? []);
  const [lines, setLines] = useState<string[]>(() =>
    Array.from({ length: PITCH_MAX_LINES }, (_, i) => start[i] ?? ""));
  const { busy, run } = useRun(onSaved);
  const clean = cleanPitchLines(lines);
  const problem = pitchProblemAr(clean);
  const base = `/api/admin/trainers/${trainer.profileId}/suggestions`;
  const unchanged = !edited && clean.join("\n") === (open?.lines ?? trainer.pitchLines).join("\n");

  return (
    <Inset className="mt-2.5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-read font-black">{pitchHeadingAr(trainer.name)}</p>
        <SuggestionChip latest={latest} shown={trainer.pitchLines.length > 0} draft={Boolean(trainer.pitchDraft)} />
      </div>
      {latest?.status === "rejected" && latest.noteAr && (
        <p className="mt-1.5 text-read leading-6 text-muted-foreground">سببه: {latest.noteAr}</p>
      )}
      {/* تعديلُه «قبل/بعد» — ما أرسلناه وما أرسله، والحقولُ تبدأ بتعديله */}
      {edited && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-border/60 px-3 py-2 text-read leading-6">
            <span className="font-black text-muted-foreground">ما أرسلناه: </span>
            <span className="text-muted-foreground">{edited.lines.join(" · ")}</span>
          </div>
          <div className="rounded-md border border-border/60 px-3 py-2 text-read leading-6">
            <span className="font-black text-muted-foreground">تعديله: </span>
            {edited.editedLines.join(" · ")}
          </div>
        </div>
      )}
      <div className="mt-2 grid gap-2">
        {lines.map((l, i) => (
          <div key={i}>
            <input
              value={l}
              maxLength={PITCH_MAX_CHARS}
              aria-label={`السطر ${i + 1}`}
              placeholder={i === 0 ? "حقيقة من نبذته بصوت الفخر، مثل: 15 سنة يصنع مدربين، لا متدربين فقط" : "سطر اختياري"}
              onChange={(e) => setLines((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
              className={`${controlCls} w-full`}
            />
            {l.trim() && <span className="mt-0.5 block text-read text-muted-foreground">{countWords(l)} / {PITCH_MAX_WORDS} كلمة</span>}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {edited ? (
          <Button tone="confirm" size="sm" loading={busy} disabled={Boolean(problem)}
            onClick={() => void run(`${base}/pitch/approve-edit`, { lines: clean }, "اعتمدت تعديله — ظهر في بطاقته")}>
            اعتمد تعديله
          </Button>
        ) : (
          <Button tone="confirm" size="sm" loading={busy} disabled={Boolean(problem) || unchanged}
            onClick={() => void run(base, { kind: "pitch", lines: clean }, "أرسلت للمدرب — تظهر حين يقبلها")}>
            {open ? "أرسل التعديل للمدرب" : "أرسلها للمدرب"}
          </Button>
        )}
        {open && (
          <Button tone="ghost" size="sm" disabled={busy}
            onClick={() => void run(`${base}/pitch/withdraw`, {}, "سحبت الاقتراح")}>
            اسحب الاقتراح
          </Button>
        )}
        {problem && <span className="text-read text-muted-foreground">{problem}</span>}
      </div>
    </Inset>
  );
}

/* والنبذةُ بصياغتنا — تصله «قبل/بعد». وهي غيرُ «حفظ الملفّ العامّ» أعلاه: ذاك يكتب النبذةَ
   مباشرةً، وهذا يقترحها عليه فلا تتغيّر إلّا بقبوله. */
function BioSuggestEditor({ trainer, onSaved }: { trainer: OpsTrainer; onSaved: () => Promise<void> | void }) {
  const latest = trainer.bioLatest;
  const pending = latest?.status === "pending" ? latest : null;
  const start = latest && latest.status !== "accepted" ? latest.lines[0] ?? "" : trainer.bioDraft ?? "";
  const [text, setText] = useState(start);
  const { busy, run } = useRun(onSaved);
  const problem = bioSuggestionProblemAr(text);
  const unchanged = text.trim() === (pending?.lines[0] ?? trainer.bioPublic ?? "").trim();
  const base = `/api/admin/trainers/${trainer.profileId}/suggestions`;

  return (
    <Inset className="mt-2.5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-read font-black">نبذة بصياغتنا — يقبلها أو يرفضها</p>
        <SuggestionChip latest={latest} shown={latest?.status === "accepted"} draft={Boolean(trainer.bioDraft)} />
      </div>
      {latest?.status === "rejected" && latest.noteAr && (
        <p className="mt-1.5 text-read leading-6 text-muted-foreground">سببه: {latest.noteAr}</p>
      )}
      <textarea
        rows={4} value={text} onChange={(e) => setText(e.target.value)} aria-label="النبذة المقترحة"
        className={`${controlCls} mt-2 w-full`}
      />
      <span className="mt-0.5 block text-read text-muted-foreground">{countWords(text)} / {BIO_MAX_WORDS} كلمة</span>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button tone="confirm" size="sm" loading={busy} disabled={Boolean(problem) || unchanged}
          onClick={() => void run(base, { kind: "bio", lines: [text] }, "أرسلت للمدرب — يراها قبل وبعد")}>
          {pending ? "أرسل التعديل للمدرب" : "أرسلها للمدرب"}
        </Button>
        {pending && (
          <Button tone="ghost" size="sm" disabled={busy}
            onClick={() => void run(`${base}/bio/withdraw`, {}, "سحبت الاقتراح")}>
            اسحب الاقتراح
          </Button>
        )}
        {problem && text.trim() && <span className="text-read text-muted-foreground">{problem}</span>}
      </div>
    </Inset>
  );
}

function PublicProfileEditor({
  trainer, onSaved,
}: {
  trainer: OpsTrainer
  onSaved: () => Promise<void> | void
}) {
  const [form, setForm] = useState({
    headline: trainer.headline ?? "",
    bioPublic: trainer.bioPublic ?? "",
    photoUrl: trainer.photoUrl?.startsWith("/api/") ? "" : trainer.photoUrl ?? "",
  });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  /* المختارُ يُؤطَّر قبل رفعه — كشاشة الحساب سواءً بسواء */
  const [framing, setFraming] = useState<File | null>(null);
  /* الصورةُ المعروضةُ من الخادم لا من الحقل: الحقلُ للرابط الخارجيّ، والمرفوعةُ
     عنوانُها `/api/v1/trainer-photos/…` وليست ممّا يُكتب بيد. */
  const shown = trainer.photoUrl;

  const save = async () => {
    setBusy(true);
    try {
      await apiPut(`/api/admin/trainers/${trainer.profileId}/public-profile`, {
        headline: form.headline.trim() || null,
        bioPublic: form.bioPublic.trim() || null,
        /* حقلُ الرابط فارغٌ حين تكون الصورةُ مرفوعةً عندنا — فلا يُرسَل
           `photoUrl` أصلا، وإلّا محا الفراغُ صورةً لم يُردْ أحدٌ محوَها. */
        ...(form.photoUrl.trim() || !shown?.startsWith("/api/")
          ? { photoUrl: form.photoUrl.trim() || null }
          : {}),
      });
      toast("حفظ الملفّ العامّ");
      await onSaved();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    } finally { setBusy(false); }
  };

  /* اعتمادُ الصورة المعلّقة أو ردُّها — قرارُ عرضٍ عامّ لا قرارُ تخزين */
  const decidePhoto = async (approve: boolean) => {
    setBusy(true);
    try {
      await apiPost(`/api/admin/trainers/${trainer.profileId}/photo/${approve ? "approve" : "reject"}`, {});
      toast(approve ? "اعتمدت الصورة" : "ردّت الصورة");
      await onSaved();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر تنفيذ القرار");
    } finally { setBusy(false); }
  };

  /* الرفعُ خطوتان: رابطٌ موقّتٌ من الخادم، ثمّ البايتاتُ إليه مباشرةً.
     ولا يمرّ الملفُّ في JSON — فذاك يضخّمه الثلثَ ويقرؤه الخادمُ نصّا. */
  const upload = async (blob: Blob) => {
    setBusy(true);
    try {
      const r = await apiPost<{ uploadUrl: string; maxBytes: number }>(
        `/api/admin/trainers/${trainer.profileId}/photo-upload`, { mime: PHOTO_OUT_MIME },
      );
      if (blob.size > r.maxBytes) {
        toastError(`الصورة أكبر من الحدّ (${Math.round(r.maxBytes / 1024)} ك.ب)`);
        return;
      }
      const res = await fetch(`${API_BASE}${r.uploadUrl}`, {
        method: "PUT", headers: { "content-type": PHOTO_OUT_MIME }, body: blob,
      });
      if (!res.ok) { toastError(`تعذّر رفع الصورة (${res.status})`); return; }
      toast("رفعت الصورة");
      setFraming(null);
      setForm((f) => ({ ...f, photoUrl: "" }));
      await onSaved();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر رفع الصورة");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <p className="text-read font-black text-muted-foreground">ملفّه العامّ — ما تعرضه صفحة الفريق</p>
      <ul className="mt-1 text-fine leading-6 text-muted-foreground">
        <li>{photoTrailAr({ hasPhoto: Boolean(trainer.photoUrl), pending: Boolean(trainer.pendingPhotoUrl), trail: trainer.trail }, fmtDate)}</li>
        <li>{textTrailAr({ hasText: Boolean(trainer.headline || trainer.bioPublic), pending: Boolean(trainer.pendingText), trail: trainer.trail }, fmtDate)}</li>
      </ul>
      <div className="mt-2 grid gap-2.5 md:grid-cols-2">
        <div>
          <label className="block text-fine font-bold text-muted-foreground" htmlFor={`hl-${trainer.profileId}`}>
            العنوان المهنيّ
          </label>
          <input
            id={`hl-${trainer.profileId}`}
            value={form.headline}
            onChange={(e) => setForm({ ...form, headline: e.target.value })}
            placeholder="مثال: مهندس بيانات ومدرّب تحليل تطبيقيّ"
            className={`${controlCls} mt-1 w-full`}
          />
        </div>
        <div>
          <label className="block text-fine font-bold text-muted-foreground" htmlFor={`ph-${trainer.profileId}`}>
            رابط الصورة — أو ارفعها أدناه
          </label>
          <input
            id={`ph-${trainer.profileId}`}
            dir="ltr"
            value={form.photoUrl}
            onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
            placeholder={shown?.startsWith("/api/") ? "صورة مرفوعة عندنا" : "https://…"}
            className={`${controlCls} mt-1 w-full font-mono`}
          />
        </div>
      </div>
      <div className="mt-2.5">
        <label className="block text-fine font-bold text-muted-foreground" htmlFor={`bio-${trainer.profileId}`}>
          نبذته — تقرأ في صفحة الفريق كما تكتب هنا
        </label>
        <textarea
          id={`bio-${trainer.profileId}`}
          rows={3}
          value={form.bioPublic}
          onChange={(e) => setForm({ ...form, bioPublic: e.target.value })}
          className={`${controlCls} mt-1 w-full`}
        />
      </div>
      {trainer.pendingText && <PendingTextReview trainer={trainer} onSaved={onSaved} />}
      {trainer.pendingPhotoUrl && (
        <Inset className="mt-2.5 flex flex-wrap items-center gap-3">
          <img
            src={trainer.pendingPhotoUrl}
            alt="صورة تنتظر الاعتماد"
            className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-amber-400/60"
          />
          <div className="min-w-40 flex-1">
            <p className="text-read font-black">صورة رفعها بنفسه — تنتظر اعتمادك</p>
            <p className="text-read leading-5 text-muted-foreground">
              لا تظهر في صفحة الفريق قبل اعتمادها. والرفض يخفيها عن العامّة فقط ولا يحذفها.
            </p>
          </div>
          <Button
            tone="confirm"
            size="sm"
            disabled={busy}
            onClick={() => void decidePhoto(true)}
          >
            اعتمدها للصفحة العامّة
          </Button>
          <Button tone="ghost" size="sm" disabled={busy} onClick={() => void decidePhoto(false)}>
            ردّها
          </Button>
        </Inset>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {shown && (
          <img src={shown} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-white/15" />
        )}
        <Button tone="confirm" size="sm" disabled={busy} onClick={() => void save()}>حفظ الملفّ العامّ</Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setFraming(f); }}
        />
        <Button tone="secondary" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          <ImagePlus className="h-3.5 w-3.5" /> ارفع صورة
        </Button>
        <span className="text-fine leading-5 text-muted-foreground">
          JPEG أو PNG أو WebP — الرفع يحتاج تفعيل التخزين على الخادم.
        </span>
      </div>
      {framing && (
        <ImageFramer
          file={framing}
          onDone={upload}
          onCancel={() => {
            setFraming(null);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
      )}
    </div>
  );
}

/* ═══ عنوانُه ونبذتُه كما أرسلهما — تعدّلهما ثمّ تعتمد (٣ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «let me edit it in case I want to before approval».
   فالحقلان معبّآن بما أرسله، ويُحرَّران هنا، و«اعتمِدْ» يكتب ما فيهما لحظةَ
   الضغط — كما أرسله أو كما عدّلتَه. والردُّ بسببٍ يقرؤه في حسابه.
   والعلّةُ في `server/services/trainer-public-text.service.ts`. */
function PendingTextReview({
  trainer, onSaved,
}: {
  trainer: OpsTrainer
  onSaved: () => Promise<void> | void
}) {
  const p = trainer.pendingText!;
  const [headline, setHeadline] = useState(p.headline ?? "");
  const [bio, setBio] = useState(p.bio ?? "");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const words = countWords(bio);
  const edited = headline.trim() !== (p.headline ?? "") || bio.trim() !== (p.bio ?? "");

  const decide = async (approve: boolean) => {
    setBusy(true);
    try {
      if (approve) {
        await apiPost(`/api/admin/trainers/${trainer.profileId}/public-text/approve`,
          { headline: headline.trim(), bioPublic: bio.trim() });
        toast(edited ? "اعتمدت بتعديلك — ووصله خبرها" : "اعتمدت كما كتبها — ووصله خبرها");
      } else {
        await apiPost(`/api/admin/trainers/${trainer.profileId}/public-text/reject`, { reasonAr: reason.trim() });
        toast("ردّت — ويقرأ سببك في حسابه");
      }
      await onSaved();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر تنفيذ القرار");
    } finally { setBusy(false); }
  };

  return (
    <Inset tone="warn" className="mt-2.5 p-3">
      <p className="text-read font-black">
        أرسل عنوانه ونبذته {fmtDateTime(p.at)} — تنتظر اعتمادك
      </p>
      <p className="mt-0.5 text-read leading-6 text-muted-foreground">
        عدّل الحقلين إن شئت ثمّ اعتمد، فيظهر ما فيهما في صفحة «المدربون». ويبقى المعتمد الحاليّ ظاهرا حتّى تقرّر.
      </p>
      <label className="mt-2.5 block text-fine font-bold text-muted-foreground" htmlFor={`phl-${trainer.profileId}`}>
        العنوان المهنيّ
      </label>
      <input id={`phl-${trainer.profileId}`} value={headline} maxLength={160}
        onChange={(e) => setHeadline(e.target.value)} className={`${controlCls} mt-1 w-full`} />
      <label className="mt-2.5 block text-fine font-bold text-muted-foreground" htmlFor={`pbio-${trainer.profileId}`}>
        النبذة
      </label>
      <textarea id={`pbio-${trainer.profileId}`} rows={4} value={bio} maxLength={1200}
        onChange={(e) => setBio(e.target.value)} className={`${staffAreaCls} mt-1 w-full`} />
      <p className={`mt-1 text-read ${words > BIO_MAX_WORDS ? "text-gold-ink" : "text-muted-foreground"}`}>
        {words} / {BIO_MAX_WORDS} كلمة{edited ? " · عدّلتها — يعتمد تعديلك" : ""}
      </p>
      {rejecting ? (
        <div className="mt-2.5 grid gap-2">
          <textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="سبب الردّ — يقرؤه المدرّب في حسابه بحرفه"
            className={`${controlCls} w-full`} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" tone="danger" disabled={busy || reason.trim().length < 3}
              onClick={() => void decide(false)}>أرسل الردّ</Button>
            <Button size="sm" tone="ghost" disabled={busy} onClick={() => setRejecting(false)}>تراجع</Button>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button size="sm" tone="confirm" icon={CheckCircle2} disabled={busy || headline.trim().length < 3 || bio.trim().length < 3}
            onClick={() => void decide(true)}>
            {edited ? "اعتمدها بتعديلك" : "اعتمدها كما كتبها"}
          </Button>
          <Button size="sm" tone="ghost" disabled={busy} onClick={() => setRejecting(true)}>ردّها بسبب</Button>
        </div>
      )}
    </Inset>
  );
}

export default function TrainerRunOps() {
  const [trainers, setTrainers] = useState<OpsTrainer[] | null>(null);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [offline, setOffline] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");
  /* الفلترُ حالٌ واحدة، والمفتوحُ من البطاقات ما فتحه هو (`trainer-status.ts`) */
  const [filter, setFilter] = useState<TrainerFilter>("all");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggleOpen = (id: string) => setOpenIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const [note, setNote] = useState<Record<string, string>>({});
  const [suspendTarget, setSuspendTarget] = useState<OpsTrainer | null>(null);
  const [approveTarget, setApproveTarget] = useState<OpsTrainer | null>(null);
  const [prepOpen, setPrepOpen] = useState(false);
  const [skipPlan, setSkipPlan] = useState<PendingRequest | null>(null);
  /* تعيينُ مدرّبٍ داخليّا — ثلاثةُ حقولٍ ونقرة (البند ٢٢) */
  const { user: sessionUser } = useRealSession();
  const navigate = useNavigate();
  const canAddTrainer =
    (sessionUser?.permissions.includes("admin.users.manage") ?? false) &&
    (sessionUser?.permissions.includes("trainer.applications.decide") ?? false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: "", email: "", headline: "" });
  /* وتجاوزُ ما ينقص التجهيزَ للمدير الأعلى وحدَه — والخادمُ يحكم به كذلك (`decide`) */
  const canOverride = sessionUser?.roles.includes("super_admin") ?? false;
  /* «ما بقي من دوراتك» — من بقي عليه شيء، وموعدٌ واحدٌ لرسائلهم (٢٠ أكتوبر ٢٠٢٦، `PrepReminders.tsx`) */
  const [reminders, setReminders] = useState<Map<string, ReminderRow>>(new Map());
  const [deadline, setDeadline] = useState(() => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));

  const load = useCallback(async () => {
    try {
      const [ops, reqs, cs] = await Promise.all([
        apiGet<OpsTrainer[]>("/api/admin/trainers/ops"),
        apiGet<PendingRequest[]>("/api/admin/qualification-requests"),
        apiGet<CourseOpt[]>("/api/admin/catalog/courses").catch(() => [] as CourseOpt[]),
      ]);
      setTrainers(ops);
      /* ومن لا يملك بابَ العقود لا يرى الرسائل — والصفحةُ تعمل بدونها */
      const rs = await apiGet<ReminderRow[]>("/api/admin/prep-reminders").catch(() => [] as ReminderRow[]);
      setReminders(new Map(rs.map((r) => [r.profileId, r])));
      setRequests(reqs);
      setCourses(cs);
      setOffline(null);
    } catch (e) {
      setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast(ok);
      await load();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر تنفيذ الإجراء");
    } finally {
      setBusy("");
    }
  };

  const courseName = useCallback(
    (id: string) => courses.find((c) => c.id === id)?.titleAr ?? courses.find((c) => c.id === id)?.title ?? id,
    [courses],
  );

  /* وما ينتظر قرارَك في ملفّه العامّ — نبذةٌ أو صورة — يُقدَّم فلا يضيع بين الصفوف */
  /* الطابورُ للطلبات وحدَها، والدوراتُ قيد الإعداد مجموعةٌ بمدرّبها */
  const asks = useMemo(() => requests.filter((r) => r.kind !== "preparing"), [requests]);
  const preparing = useMemo(() => requests.filter((r) => r.kind === "preparing"), [requests]);
  const prepByTrainer = useMemo(() => {
    const by = new Map<string, { name: string; rows: PendingRequest[] }>();
    for (const r of preparing) {
      const g = by.get(r.profile.id) ?? { name: r.profile.application.fullName, rows: [] };
      g.rows.push(r);
      by.set(r.profile.id, g);
    }
    return [...by.values()];
  }, [preparing]);

  /* ═══ اعتمادُ كلِّ الصور المعلَّقة بضغطة (١٩ أكتوبر ٢٠٢٦) ═══
     قرارُ صاحب المنصّة: «اضف زر اعتماد كل الصور المعلقة». والزرُّ يحمل عددَها
     فيُعرف ما سيُعتمد قبل الضغط، ويغيب حين لا شيءَ ينتظر. والاعتمادُ الفرديُّ
     والردُّ باقيان في بطاقة كلٍّ لمن أراد أن يردّ واحدة. */
  const pendingPhotos = useMemo(() => (trainers ?? []).filter((t) => t.pendingPhotoUrl).length, [trainers]);
  const approveAllPhotos = async () => {
    setBusy("approve-photos");
    try {
      const r = await apiPost<{ approved: number; failed: number }>("/api/admin/trainers/photos/approve-pending", {});
      if (r.failed === 0) toast(`اعتمدت الصور المعلقة: ${r.approved}`);
      else toastError(`اعتمدت ${r.approved}، وتعذّر اعتماد ${r.failed}`);
      await load();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر اعتماد الصور");
    } finally {
      setBusy("");
    }
  };

  /* ═══ وإرسالُ كلِّ المسوّدات بضغطة (١٩ أكتوبر ٢٠٢٦) ═══
     قرارُ صاحب المنصّة: «أضف زرّ إرسال الكلّ». والعددُ ما تعرضه البطاقاتُ مسوّدةً
     لم تُرسَل، والخادمُ يرسلها كما كُتبت (`sendAllDrafts`) — فما حرّرته في بطاقةٍ ولم
     ترسله يُرسَل منها لا من هنا.
     ولا يُعدّ إلّا من يصله الإرسالُ (٢٠ أكتوبر ٢٠٢٦): النشطون ومن نُشرت دوراتُهم — شرطُ الخادم نفسُه. */
  const draftCount = useMemo(
    () => (trainers ?? [])
      .filter((t) => t.applicationStatus === "active" || t.hasLiveCourse)
      .reduce((n, t) => n + (t.pitchDraft ? 1 : 0) + (t.bioDraft ? 1 : 0), 0),
    [trainers],
  );
  const sendAllDrafts = async () => {
    setBusy("send-drafts");
    try {
      const r = await apiPost<{ sent: number; failed: number }>("/api/admin/trainers/suggestions/send-drafts", {});
      if (r.failed === 0) toast(`أرسلت الاقتراحات للمدربين: ${r.sent}`);
      else toastError(`أرسلت ${r.sent}، وتعذر إرسال ${r.failed}`);
      await load();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذر إرسال الاقتراحات");
    } finally {
      setBusy("");
    }
  };

  /* ═══ وملفّاتُ من لا مسوّدةَ له — لنكتب له (٢٠ أكتوبر ٢٠٢٦) ═══
     ZIP فيه ما كتبه كلٌّ وسيرتُه وشهاداتُه (`trainer-drafting-bundle.service.ts`)، بصلاحيّة قراءة الطلبات */
  const canDownloadFiles = sessionUser?.permissions.includes("trainer.applications.view") ?? false;
  /* وأجزاءً لا يجاوز الجزءُ ٢٠MB — «الملفّ كبيرٌ جدّا» (٢٠ أكتوبر ٢٠٢٦)، ولمن له دورةٌ معتمدةٌ وحدَه */
  const [draftingParts, setDraftingParts] = useState<{ parts: number; trainers: number } | null>(null);
  useEffect(() => {
    if (!canDownloadFiles) return;
    apiGet<{ parts: number; trainers: number }>("/api/admin/trainers/drafting-bundle/parts")
      .then(setDraftingParts).catch(() => setDraftingParts(null));
  }, [canDownloadFiles, trainers]);
  const downloadDraftingFiles = async (part: number) => {
    setBusy(`drafting-files-${part}`);
    try {
      await apiDownload(`/api/admin/trainers/drafting-bundle?part=${part}`, `ملفات-المدربين-للاقتراحات-${part}.zip`);
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذر تنزيل الملفات");
    } finally {
      setBusy("");
    }
  };

  /* ═══ زرُّ البطاقة يذهب إلى ما ينتظرك (٢١ أكتوبر ٢٠٢٦) ═══
     العقدُ في «العقود» مفتوحا عليه، والطلباتُ في طابورها أعلى الصفحة، والخطةُ في شعبتها إن كانت واحدة،
     وما سوى ذلك في بطاقته نفسِها مفتوحةً على موضعه. */
  const goTo = (t: OpsTrainer, step: StepAct) => {
    const openAt = (anchor: string) => {
      setOpenIds((prev) => new Set(prev).add(t.profileId));
      requestAnimationFrame(() =>
        document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };
    if (step === "contract_new" || step === "contract") {
      const p = new URLSearchParams({ q: t.name });
      if (step === "contract_new") p.set("prepare", t.applicationId);
      navigate(`/admin/trainer-contracts?${p}`);
    } else if (step === "approve") setApproveTarget(t);
    else if (step === "publish") {
      void act(`${t.profileId}:publish`, () => apiPost(`/api/admin/trainers/${t.profileId}/publish-approval`), "اعتمد ظهوره العامّ");
    } else if (step === "requests") {
      document.getElementById("qualification-requests")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (step === "plans") {
      const waiting = t.cohorts.filter((c) => !["completed", "cancelled"].includes(c.status) && planMarkOf(c) === "submitted");
      if (waiting.length === 1) navigate(`/admin/cohorts?cohort=${waiting[0].id}`);
      else openAt(`${t.profileId}-plans`);
    } else openAt(`${t.profileId}-${step}`);
  };

  /* ═══ حالُ كلِّ مدرّبٍ وما ينتظره — سطرٌ واحدٌ مطويّ (٢٠ أكتوبر ٢٠٢٦، `trainer-status.ts`) ═══
     «هذه الصفحةُ طويلةٌ ومعقّدة.. فلاترُ واضحةٌ لكلّ الحالات، وكلُّ مدرّبٍ مضمومٌ مكتوبٌ حالُه وما المطلوبُ منّي
     أو منه». والطابورُ يقول ما لا تقوله بياناتُه: طلباتُ تأهيلٍ تنتظرك، ودوراتٌ عُرضت عليه لم يقبلها. */
  const rows = useMemo(() => (trainers ?? []).map((t) => {
    const input = {
      ...t,
      queue: {
        requests: asks.filter((r) => r.profile.id === t.profileId).length,
        /* ومعها المعتمَدةُ بلا شعبة — يقبلها هو في «مؤهّلاتي» (`approvedToAccept`) */
        toAccept: preparing.filter((r) => r.profile.id === t.profileId && (r.prep?.state ?? "to_decide") === "to_decide").length
          + approvedToAccept(t),
      },
    };
    const steps = trainerSteps(input);
    return { t, steps, state: trainerStateOf(input, steps) };
  }), [trainers, asks, preparing]);
  const counts = useMemo(() => {
    const m: Record<TrainerState, number> = { hidden: 0, you: 0, trainer: 0, ready: 0, idle: 0, suspended: 0 };
    for (const r of rows) m[r.state] += 1;
    return m;
  }, [rows]);
  const shown = useMemo(
    () => rows
      .filter((r) => (filter === "all" || r.state === filter) && matchesQuery(q, [r.t.name, r.t.email]))
      .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.t.name.localeCompare(b.t.name, "ar")),
    [rows, filter, q],
  );

  if (offline) {
    return (
      <Panel className="grid place-items-center py-20 text-center">
        <ServerOff className="h-12 w-12 text-muted-foreground/50" />
        <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للبيانات</h2>
        <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
      </Panel>
    );
  }

  if (trainers === null) {
    return <div className="grid place-items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>;
  }

  return (
    <div className="space-y-8">
      {/* ── الطابور: ما ينتظر قرارك من غيرك ── */}
      <section id="qualification-requests" className="scroll-mt-4">
        <h3 className="flex items-center gap-2 text-sm font-black">
          <Clock className="h-4 w-4 text-gold-ink" />
          طلبات التأهيل المعلّقة
          {asks.length > 0 && (
            <span className="rounded-full bg-gold/20 px-2 py-0.5 text-fine font-black text-gold-ink">{asks.length}</span>
          )}
        </h3>
        <p className="mt-1 text-read leading-6 text-muted-foreground">
          يطلبها من يجدول الشعبة، ويقرّر فيها صاحب صلاحية التأهيل — <b>فمن يطلب ليس من يقرّر</b>.
          والموافقة <b>تؤهّل وتسند إلى الشعبة المطلوبة معا</b>.
        </p>

        {asks.length === 0 ? (
          <Card className="mt-3 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-teal-light-ink/50" />
            <p className="mt-2 text-read text-muted-foreground">لا طلب ينتظر قرارك.</p>
          </Card>
        ) : (
          <ul className="mt-3 space-y-3">
            {asks.map((r) => (
              <Card as="li" tone="warn" key={r.id}>
                <p className="text-sm font-black">{r.profile.application.fullName}</p>
                <p className="mt-1 text-read leading-6 text-muted-foreground">
                  للدورة: <b className="text-foreground">{r.course.versions[0]?.titleAr ?? courseName(r.courseId)}</b>
                  {r.requestedCohort && (
                    <> · للشعبة: <b className="text-foreground">{r.requestedCohort.title}</b>
                      {r.requestedCohort.startsAt && <> — تبدأ {fmtDateTime(new Date(r.requestedCohort.startsAt))}</>}
                    </>
                  )}
                  {r.requestedAt && <> · طلب {fmtDateTime(new Date(r.requestedAt))}</>}
                </p>
                {r.note && <p className="mt-2 rounded-xl bg-paper/30 p-2.5 text-read leading-6">{r.note}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={note[r.id] ?? ""}
                    onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))}
                    placeholder="ملاحظة تسجّل مع القرار (اختيارية)"
                    aria-label="ملاحظة القرار"
                    className={`${controlCls} min-w-[16rem] flex-1`}
                  />
                  <Button tone="confirm" type="button" disabled={busy === r.id}
                    onClick={() => void act(r.id,
                      () => apiPost(`/api/admin/qualification-requests/${r.id}/decide`, { approve: true, note: note[r.id]?.trim() || undefined }),
                      "أهّل وأسند إلى الشعبة")}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> أهّله وأسنده
                  </Button>
                  <Button tone="danger" type="button" disabled={busy === r.id}
                    onClick={() => void act(r.id,
                      () => apiPost(`/api/admin/qualification-requests/${r.id}/decide`, { approve: false, note: note[r.id]?.trim() || undefined }),
                      "رفض الطلب")}>
                    <XCircle className="h-3.5 w-3.5" /> ارفض
                  </Button>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </section>

      {/* ── دوراتٌ يعدّها المدرّبون — ليست طلبات ── */}
      {preparing.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-black">
            <GraduationCap className="h-4 w-4 text-teal-light-ink" />
            دورات قيد الإعداد
            <span className="rounded-full bg-paper/60 px-2 py-0.5 text-fine font-black text-muted-foreground">{preparing.length}</span>
          </h3>
          <p className="mt-1 text-read leading-6 text-muted-foreground">
            دورات قال المدرب في طلبه إنه يدرسها. <b>تعتمد حين تعتمد خطتها</b> في «خطط تنتظر اعتمادك» — لا من هنا.
          </p>
          <Button size="sm" className="mt-2" onClick={() => setPrepOpen((v) => !v)}>
            {prepOpen ? "أخفها" : `اعرضها (${preparing.length})`}
          </Button>
          {prepOpen && (
            <ul className="mt-3 space-y-3">
              {prepByTrainer.map(({ name, rows }) => (
                <Card as="li" key={rows[0].profile.id}>
                  <p className="text-sm font-black">{name}</p>
                  <ul className="mt-2 grid gap-2">
                    {rows.map((r) => {
                      const st = PREP_AR[r.prep?.state ?? "to_decide"];
                      return (
                        <li key={r.id}>
                          <Inset tone="default" className="p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="min-w-0 flex-1 text-read font-bold">{r.course.versions[0]?.titleAr ?? courseName(r.courseId)}</p>
                              <Chip tone={st.tone} srPrefixAr="الحال">{st.label}</Chip>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              {r.prep?.cohortId && (
                                <Link to={`/admin/plans/${r.prep.cohortId}`} className="text-read font-bold text-teal-light-ink underline">
                                  افتح خطتها
                                </Link>
                              )}
                              <Button size="sm" type="button" disabled={busy === r.id} onClick={() => setSkipPlan(r)}>
                                اعتمدها دون انتظار الخطة
                              </Button>
                            </div>
                          </Inset>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── المدرّبون ── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-black">
            <Users className="h-4 w-4 text-teal-light-ink" /> المدرّبون ({shown.length})
          </h3>
          {reminders.size > 0 && <ReminderDeadline value={deadline} onChange={setDeadline} count={reminders.size} />}
          <div className="flex flex-wrap items-center gap-3">
            {pendingPhotos > 0 && (
              <Button
                tone="confirm" icon={CheckCircle2} loading={busy === "approve-photos"} disabled={busy !== ""}
                onClick={() => void approveAllPhotos()}
              >
                اعتمد كل الصور المعلقة ({pendingPhotos})
              </Button>
            )}
            {draftCount > 0 && (
              <Button
                tone="confirm" icon={Send} loading={busy === "send-drafts"} disabled={busy !== ""}
                onClick={() => void sendAllDrafts()}
              >
                أرسل للنشطين ومن نشرت دوراتهم ({draftCount})
              </Button>
            )}
            {canDownloadFiles && draftingParts && draftingParts.trainers > 0 && (
              Array.from({ length: draftingParts.parts }, (_, i) => i + 1).map((part) => (
                <Button
                  key={part} icon={Download} loading={busy === `drafting-files-${part}`} disabled={busy !== ""}
                  onClick={() => void downloadDraftingFiles(part)}
                >
                  {draftingParts.parts > 1 ? `نزّل ملفات المدربين — الجزء ${part} من ${draftingParts.parts}` : "نزّل ملفات المدربين للاقتراحات"}
                </Button>
              ))
            )}
            {canAddTrainer && (
              <Button onClick={() => setAddOpen((v) => !v)} icon={UserPlus} className="text-teal-light-ink">
                {addOpen ? "أغلق" : "أضف مدرّبا"}
              </Button>
            )}
            <label className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم أو بريد"
                aria-label="ابحث في المدرّبين"
                className={`${controlCls} w-64 pr-9`}
              />
            </label>
          </div>
        </div>

        {/* فلاترُ الحال — مجموعُها عددُ المدرّبين، وكلُّ مدرّبٍ في واحدٍ منها */}
        <TabBar className="mt-3" ariaLabel="حالات المدربين" value={filter} onChange={setFilter}
          items={[
            { id: "all" as const, label: `الكل (${rows.length})` },
            ...TRAINER_STATES.map((x) => ({ id: x.id, label: `${x.ar} (${counts[x.id]})` })),
          ]} />

        {/* ── تعيينُ مدرّبٍ داخليّا ──

            لم يكن للمدير طريقٌ إلى هذا أصلا: ملفُّ المدرّب لا يُنشأ إلّا من
            البتّ في طلبٍ عامّ، فمن أراد تعيينَ زميلٍ أو متعاقدٍ من خارج
            الطابور كان يملأ له النموذجَ العامّ بنفسه — أو يُنشئ حسابا بدور
            «مدرّب» فيصطدم صاحبُه بجدارِ «بلا ملفّ مدرّب». */}
        {addOpen && canAddTrainer && (
          <Card as="form" tone="accent"
            className="mt-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fullName = addForm.fullName.trim();
              const email = addForm.email.trim();
              if (fullName.length < 2 || !email) return;
              /* الرسالةُ من الخادم لا من الشاشة: هو وحدَه يعلم أوصلت الدعوةُ
                 أم أنّ قناةَ البريد مغلقة — و«أُرسلت» كاذبةً أسوأُ من صمت. */
              void (async () => {
                setBusy("add-trainer");
                try {
                  const res = await apiPost<{ noteAr: string }>("/api/admin/trainers/direct", {
                    fullName, email, headline: addForm.headline.trim() || undefined,
                  });
                  setAddForm({ fullName: "", email: "", headline: "" });
                  setAddOpen(false);
                  toast(res.noteAr);
                  await load();
                } catch (err) {
                  toastError(err instanceof ApiError ? err.message : "تعذّر تعيين المدرّب");
                } finally {
                  setBusy("");
                }
              })();
            }}
          >
            <p className="text-read leading-6 text-muted-foreground">
              ينشأ في خطوة واحدة: <b className="text-foreground">حسابه</b> و<b className="text-foreground">ملفّ مدرّب نشط</b> و<b className="text-foreground">دوره</b> —
              ثم تسنده من صفحة الشعبة. ولا يظهر للعامّة حتّى تعتمد صورته ونبذته.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-fine font-bold text-muted-foreground">الاسم الكامل</span>
                <input
                  required minLength={2} maxLength={120}
                  value={addForm.fullName}
                  onChange={(e) => setAddForm((f) => ({ ...f, fullName: e.target.value }))}
                  className={`${controlCls} w-full`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-fine font-bold text-muted-foreground">البريد</span>
                <input
                  required type="email" dir="ltr"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  className={`${controlCls} w-full text-right`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-fine font-bold text-muted-foreground">المسمّى (اختياريّ)</span>
                <input
                  maxLength={160}
                  value={addForm.headline}
                  onChange={(e) => setAddForm((f) => ({ ...f, headline: e.target.value }))}
                  className={`${controlCls} w-full`}
                />
              </label>
            </div>
            <Button
              type="submit" tone="confirm" icon={UserPlus} loading={busy === "add-trainer"}
              disabled={addForm.fullName.trim().length < 2 || !addForm.email.trim()}
              className="mt-3"
            >
              عيّنه مدرّبا
            </Button>
          </Card>
        )}

        {shown.length === 0 ? (
          <Card className="mt-3 p-8 text-center">
            <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground/50" />
            {rows.length === 0 ? (
              <>
                <p className="mt-3 text-sm font-black">لا مدرّب بعد</p>
                <p className="mt-1 text-read leading-6 text-muted-foreground">
                  يظهر هنا كل من تقبله في «طلبات المدربين».
                </p>
              </>
            ) : (
              <p className="mt-3 text-read text-muted-foreground">لا مدرب في هذه الحال.</p>
            )}
          </Card>
        ) : (
          <ul className="mt-3 space-y-3">
            {shown.map(({ t, steps, state }) => {
              const k = (a: string) => `${t.profileId}:${a}`;
              const meta = TRAINER_STATES.find((x) => x.id === state)!;
              const isOpen = openIds.has(t.profileId);
              /* في «ينتظرك» أولى خطواتك في الوسم، والسطرُ لما بعدها (`stateChipAr`) */
              const yours = stepsLineAr(steps, "you", state === "you" ? 1 : 0);
              const next = firstActOf(steps);
              const his = stepsLineAr(steps, "trainer");
              const quiet = quietLineAr(state, t.applicationStatus);
              return (
                <Card as="li" key={t.profileId}>
                  {/* السطرُ المطويّ: اسمُه وحالُه، وما المطلوبُ ومن مَن، وعدّادُ شعبه — ويُفتح للبطاقة كلِّها */}
                  <button type="button" onClick={() => toggleOpen(t.profileId)} aria-expanded={isOpen}
                    className="flex w-full cursor-pointer items-start gap-3 rounded-xl text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-paper">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-black">
                        {t.name}
                        <Chip tone={meta.tone} srPrefixAr="حاله">{stateChipAr(state, steps)}</Chip>
                      </p>
                      {yours && <p className="mt-1.5 text-read font-bold leading-6 text-gold-ink">{yours}</p>}
                      {his && <p className="mt-1 text-read leading-6 text-teal-light-ink">{his}</p>}
                      {quiet && <p className="mt-1.5 text-read leading-6 text-muted-foreground">{quiet}</p>}
                      <p className="mt-1 text-read text-muted-foreground">{cohortsTallyAr(t.cohorts)}</p>
                    </div>
                    <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  {/* زرُّ البطاقة بابُ أولى خطواتك (٢١ أكتوبر ٢٠٢٦، `firstActOf`) — لا «اعتمده مدربا» لكلّ من لم ينشط */}
                  {next?.act && (
                    <Button tone="confirm" size="sm" type="button" icon={ArrowLeft} className="mt-2"
                      disabled={busy === k(next.act)} onClick={() => goTo(t, next.act!)}>
                      {STEP_ACT_AR[next.act]}
                    </Button>
                  )}

                  {isOpen && (<>
                  <p dir="ltr" className="mt-3 border-t border-white/10 pt-3 text-right text-read text-muted-foreground">{t.email}</p>
                  {t.publiclyVisible && t.hasLiveCourse && (
                    <p className="mt-1 flex items-center gap-1 text-read font-bold text-teal-light-ink">
                      <BadgeCheck className="h-3 w-3" /> ظاهر للعامّة
                    </p>
                  )}
                  {/* قرارُ ١٩ أكتوبر ٢٠٢٦: لا يظهر للعامّة من لا دورةَ منشورةً له هذا الفصلَ أو بعده */}
                  {t.publiclyVisible && !t.hasLiveCourse && (
                    <p className="mt-1 text-read text-muted-foreground">معتمد ولا يظهر: لا دورة منشورة له هذا الفصل</p>
                  )}

                  {/* ما يمنع الخطوةَ التالية — يُقال قبل الضغط لا بعده */}
                  {!t.hasAccount && (
                    <Inset as="p" tone="warn" className="mt-2.5 flex items-start gap-1.5 p-2.5 text-read leading-6 text-gold-ink">
                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      لا حساب مربوط بهذا الملف، فلن يدخل بوابته ولو أسند. يربط حين تعتمده مدربا، أو حين تعتمد توقيعه على العقد.
                    </Inset>
                  )}

                  <div id={`${t.profileId}-plans`} className="scroll-mt-4" />
                  <TrainerCourses trainer={t} />
                  {reminders.has(t.profileId) && <PrepReminderRow row={reminders.get(t.profileId)!} deadline={deadline} />}

                  <div id={`${t.profileId}-profile`} className="scroll-mt-4" />
                  <PublicProfileEditor trainer={t} onSaved={load} />
                  <div id={`${t.profileId}-suggest`} className="scroll-mt-4" />
                  {/* والمفتاحُ يحمل آخرَ اقتراح: كلُّ إرسالٍ أو قرارٍ يبدأ الحقولَ من جديد */}
                  <PitchEditor key={`${t.profileId}:${t.pitchLatest?.id ?? ""}:${t.pitchLatest?.status ?? ""}:${t.pitchLines.join("|")}`} trainer={t} onSaved={load} />
                  <BioSuggestEditor key={`${t.profileId}:bio:${t.bioLatest?.id ?? ""}:${t.bioLatest?.status ?? ""}`} trainer={t} onSaved={load} />

                  {/* الإجراءات — والتأهيلُ والإسنادُ من صفحة الشعبة */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                    {/* واعتمادُه قبل عقده خيارٌ يبقى هنا لا زرَّ البطاقة — والنافذةُ تقول ما ينقص وما يقع بكلّ خيار */}
                    {t.approveBlockersAr && next?.act !== "approve" && (
                      <Button tone="secondary" type="button" icon={CheckCircle2} disabled={busy === k("approve")}
                        onClick={() => setApproveTarget(t)} className="px-3.5">
                        اعتمده مدربا
                      </Button>
                    )}
                    {!t.publiclyVisible && (
                      <Button tone="secondary" type="button" disabled={busy === k("publish")}
                        onClick={() => void act(k("publish"),
                          () => apiPost(`/api/admin/trainers/${t.profileId}/publish-approval`),
                          "اعتمد ظهوره العامّ")} className="px-3.5">
                        <BadgeCheck className="h-3.5 w-3.5" /> اعتمد ظهوره العامّ
                      </Button>
                    )}

                    {!t.suspended && (
                      <Button tone="danger" type="button" disabled={busy === k("suspend")}
                        onClick={() => setSuspendTarget(t)} className="px-3.5">
                        <XCircle className="h-3.5 w-3.5" /> أوقفه
                      </Button>
                    )}
                  </div>
                  </>)}
                </Card>
              );
            })}
          </ul>
        )}
      </section>

      {/* الإيقافُ فعلٌ يمسّ حسابا وجلساتٍ مجدولة — فسببُه يُكتب ولا يُفترض */}
      {suspendTarget && (
        <ConfirmAction
          titleAr={`إيقاف ${suspendTarget.name}`}
          confirmLabelAr="أوقفه"
          tone="danger"
          busy={busy === `${suspendTarget.profileId}:suspend`}
          reason={{ labelAr: "السبب — يبقى في سجلّ الأثر", minLength: 5 }}
          onCancel={() => setSuspendTarget(null)}
          onConfirm={(reason) => {
            const target = suspendTarget;
            setSuspendTarget(null);
            void act(`${target.profileId}:suspend`,
              () => apiPost(`/api/admin/trainers/${target.profileId}/suspend`, { note: reason?.trim() || undefined }),
              "أوقف المدرّب");
          }}
        >
          يخفى فورا من الصفحات العامّة، وتلغى جلساته القادمة، ويوقف حسابه.
          وترفع الإيقاف من ملفه في «طلبات المدربين».
        </ConfirmAction>
      )}

      {/* ═══ اعتمادُه مدرّبا من بطاقته ═══
          قرارُ ٢ أكتوبر ٢٠٢٦: لا يُسدّ البابُ بزرٍّ واحد. فإن تمّ تجهيزُه فنقرةٌ تقول ما يقع، وإلّا قيل ما ينقص
          والخياران: انتظارُ العقد، أو اعتمادُه الآن بسببٍ يُكتب — وهذا للمدير الأعلى وحدَه. */}
      {approveTarget && (() => {
        const target = approveTarget;
        const missing = target.approveBlockersAr ?? [];
        const run = (reason?: string) => {
          setApproveTarget(null);
          void act(`${target.profileId}:approve`,
            () => apiPost(`/api/admin/trainer-applications/${target.applicationId}/decision`, {
              action: "approve", overrideReasonAr: reason?.trim() || undefined,
            }),
            "اعتمد مدربا — وأبلغ بذلك");
        };
        const effects = (
          <ul className="mt-2 list-disc space-y-1 pe-5">
            <li>يربط حسابه ويفتح بوابته.</li>
            <li>يصبح نشطا، ويؤهل للدورات التي ذكرها في طلبه.</li>
            <li>ويصله بريد بذلك.</li>
          </ul>
        );
        if (missing.length === 0) {
          return (
            <ConfirmAction titleAr={`اعتماد ${target.name} مدربا`} confirmLabelAr="اعتمده" tone="default"
              busy={busy === `${target.profileId}:approve`} onCancel={() => setApproveTarget(null)} onConfirm={() => run()}>
              {effects}
            </ConfirmAction>
          );
        }
        const options = (
          <>
            <p className="font-bold">ينقصه:</p>
            <ul className="mt-1 list-disc space-y-1 pe-5">{missing.map((m) => <li key={m}>{m}</li>)}</ul>
            <p className="mt-3 font-bold">لك خياران:</p>
            <ul className="mt-1 list-disc space-y-1 pe-5">
              <li>
                <span className="font-bold">تنتظر العقد:</span> ترسل عقده من{" "}
                <Link to="/admin/trainer-contracts" className="font-bold text-teal-light-ink underline">العقود</Link>.
                حين يوقعه وتعتمد توقيعه، يربط حسابه وحده.
              </li>
              <li>
                <span className="font-bold">تعتمده الآن:</span>{" "}
                {canOverride
                  ? "يصبح نشطا دون ما ينقصه، ويحفظ سببك في سجل الأثر."
                  : "يحتاج المدير الأعلى، فهو وحده يعتمد قبل تمام التجهيز."}
              </li>
            </ul>
          </>
        );
        if (!canOverride) {
          return (
            <ConfirmAction titleAr={`اعتماد ${target.name} مدربا`} confirmLabelAr="افتح العقود" tone="default"
              onCancel={() => setApproveTarget(null)}
              onConfirm={() => { setApproveTarget(null); navigate("/admin/trainer-contracts"); }}>
              {options}
            </ConfirmAction>
          );
        }
        return (
          <ConfirmAction titleAr={`اعتماد ${target.name} مدربا`} confirmLabelAr="اعتمده الآن" tone="default"
            busy={busy === `${target.profileId}:approve`}
            reason={{ labelAr: "سبب اعتماده الآن — يحفظ في سجل الأثر", minLength: OVERRIDE_MIN_REASON }}
            onCancel={() => setApproveTarget(null)} onConfirm={(reason) => run(reason)}>
            {options}
            <p className="mt-3 font-bold">وإن اعتمدته الآن:</p>
            {effects}
          </ConfirmAction>
        );
      })()}

      {/* اعتمادُ دورةٍ قيد الإعداد قبل خطّتها — خيارٌ مفتوح، يقول ما يقع به قبل أن يقع */}
      {skipPlan && (
        <ConfirmAction
          titleAr="اعتمدها دون انتظار الخطة؟"
          confirmLabelAr="اعتمدها الآن"
          busy={busy === skipPlan.id}
          onCancel={() => setSkipPlan(null)}
          onConfirm={() => {
            const r = skipPlan;
            setSkipPlan(null);
            void act(r.id,
              () => apiPost(`/api/admin/qualification-requests/${r.id}/decide`, { approve: true, note: "اعتمدت دون انتظار الخطة" }),
              "اعتمدت الدورة");
          }}
        >
          <p>
            «{skipPlan.course.versions[0]?.titleAr ?? courseName(skipPlan.courseId)}» لـ{skipPlan.profile.application.fullName}.
          </p>
          <ul className="mt-2 list-disc space-y-1 pe-5">
            <li>تضاف إلى دوراته الآن، دون أن تقرأ خطتها.</li>
            <li>ويصله تنبيه: «أضيفت دورة إلى دوراتك».</li>
            {skipPlan.prep?.cohortId && <li>وتبقى شعبة إعدادها وخطتها كما هي.</li>}
            <li>وإن لم يكن نشطا، يفعّل حسابه ويوقّع عقده من جهتنا.</li>
          </ul>
        </ConfirmAction>
      )}
    </div>
  );
}
