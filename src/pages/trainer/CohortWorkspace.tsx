/* صفحةُ الشعبة — ملكُ مدرّبها، بمرحلتين: التجهيزُ ثمّ التشغيل.

   ═══ ما كان ═══

   للمدرّب أن **يقترح** تعديلا من صفحة «اقتراحاتي»، فينتظر في طابورٍ عند
   الإدارة. ثمّ صارت «ورشةً» يعدّل فيها كلَّ شيءٍ عدا السعر ويرسلها للاعتماد
   (٨ سبتمبر ٢٠٢٦) — لكنّ تشغيلَها (الحضورُ والموادُّ والتكاليفُ والرسائل)
   بقي في شاشة «شعبي»، فسأل صاحبُ المنصّة: «أين المصادر وأين تفاصيل
   الواجبات؟ أرى فقط عنوانا».

   ═══ القرار (٨ سبتمبر ٢٠٢٦) ═══

   صفحةٌ واحدةٌ للشعبة، ومراحلُ ينجزها المدرّبُ واحدةً بعد الأخرى على خطٍّ
   يمتلئ — لا قائمةُ تحقّقٍ مسطّحة:

     التجهيز:  ① الاسمُ والمواعيد → ② المحاور → ③ المصادر → ④ اللقاءات
               → ⑤ التكاليف → ⑥ الاعتماد
     التشغيل:  الحضورُ والاجتماعُ والتسجيلاتُ والرسائلُ والموادُّ والتسليمات

   والحلقةُ في الرأس تقول كم أُنجز، والمرحلةُ التالية مضاءةٌ بالذهبيّ،
   والمكتملةُ بعلامة، وباعتماد الإدارة تستقرّ شارةُ «شعبةٌ معتمَدة» بحركةٍ
   واحدةٍ هادئة. أسلوبٌ مؤسّسيّ: لا نقاطَ ولا أوسمةَ ولا مقارنةَ بغيره —
   الشعبةُ نفسُها هي اللعبة، وإتمامُها هو الفوز.

   ═══ ثلاثةُ حرّاسٍ تحكم الشكل ═══

   • `staff-surface`: المتنُ أربعةَ عشر — `text-read` لا `text-xs` في فقرة.
   • `design-system`: لا سطحَ مكتوبا بيده — `Panel` و`Card` و`Inset` وحدَها.
   • `one-primary-per-screen`: ذهبيٌّ واحد — «أرسلها للاعتماد». */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, ChevronUp, ClipboardCheck, ClipboardList, FileText, Film, Link2, Loader2, Lock, MessageSquarePlus, Send, Sparkles,
} from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import TrainerSchedule from "./TrainerSchedule";
import CohortOps from "./CohortOps";
import CourseTitleProposal from "./CourseTitleProposal";
import SessionsAndAttendance from "./SessionsAndAttendance";
import CohortSubmissions from "./CohortSubmissions";
import { apiGet, apiPatch, apiPost, apiPut, apiDelete, ApiError } from "@/services/api";
import ConfirmAction from "@/components/ConfirmAction";
import { nextTrainerModuleId, moveModule, isCatalogModule } from "@/application/trainer/plan-modules";
import { RESOURCE_KINDS, RESOURCE_CATEGORIES, readTypedLinks, resourceKind, resourceCategory, kindForCategory } from "@/application/trainer/plan-overlay";
import { RESOURCE_META } from "@/components/resource-kind-meta";
import BodyEditor from "@/components/BodyEditor";
import ModuleBodyUpload from "@/components/ModuleBodyUpload";
import { moduleBodyDone, resourceHasSource } from "@/application/trainer/module-body";
import { blockingBeforeSubmit, trainerOwned } from "@/application/trainer/plan-gate";
import { toast, toastError } from "@/components/Toast";
import { Panel, Bar, Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import TabBar from "@/components/ui/TabBar";
import ProgressRing from "@/components/ui/ProgressRing";
import { controlCls, areaCls, StaffField } from "@/components/FormKit";
import { daysLabelAr, fmtDateAr, fmtDateTimeAr } from "@/utils/format";
import { countAr } from "@/application/text/count-ar";

/* ─────────── ما يصل من الخادم ─────────── */

interface PlanModule {
  moduleId: string; titleAr: string; outcomeAr?: string | null; activityAr?: string | null;
  artifactAr?: string | null; bodyAr?: string | null;
  /* ع-٢: ملفٌّ يُغني عن الكتابة */
  bodyFileKey?: string | null; bodyFileName?: string | null; bodyFileMime?: string | null;
}
interface PlanResource {
  title: string; url?: string | null; kind?: string | null; noteAr?: string | null;
  /* ١٥ سبتمبر ٢٠٢٦: الصنفُ يُختار، والنوعُ يُشتقّ منه */
  category?: string | null; opensAt?: string | null;
  /* د-٣: مصدرٌ مرفوعٌ لا مُلصَق — «ملفّ» كان نوعا يُختار بلا ما يُرفَع */
  bodyFileKey?: string | null; bodyFileName?: string | null; bodyFileMime?: string | null;
}
/* ما بقي من صندوق «اقتراحٌ للإدارة» المحذوف (د-٦): خطّةٌ حُفظت قبل حذفه قد
   تحمل `proposals` في عمود JSON. يُقرأ منه اسمُ الدورة وحدَه ليُعرض مهيّأً في
   القناة الجديدة، فلا يضيع ما كتبه مدرّبٌ بيده. ولا يُكتب من هنا أبدا.
   واسمُ المسار سقط ولم يُقرأ: لا قناةَ له — المدرّبُ يبني مسارَه هو (القسم «ن»). */
interface LegacyPlanProposals { courseTitleAr?: string | null }
/** الفصلُ الدراسيّ — حدودُه هي حدودُ الشعبة ونافذةُ جدولتها */
interface Term { id: string; titleAr: string; season: string; year: number; startsOn: string; endsOn: string; status: string }
interface PlanContent { kind: "trainer"; summaryAr?: string | null; modules: PlanModule[]; resources: PlanResource[]; liveNoteAr?: string | null; proposals?: LegacyPlanProposals | null }
interface Workspace {
  role: string;
  trainer: { name: string };
  cohort: {
    id: string; title: string; status: string; startsAt: string | null; endsAt: string | null; daysOfWeek: string[];
    startTime: string | null; timezone: string | null; language: string; deliveryMode: string;
    termId: string | null; term: Term | null;
    readOnly: { price: number | null; currency: string; capacity: number | null };
  };
  course: { id: string; titleAr: string; baseModules: PlanModule[] };
  plan: {
    id: string; status: string; content: PlanContent | null; reviewerNote: string | null;
    submittedAt: string | null; trainerConfirmedAt: string | null; reviewedAt: string | null;
  } | null;
  sessions: { id: string; title: string; startsAt: string; endsAt: string | null; status: string; joinUrl: string | null; recordings: { id: string; title: string; externalUrl: string | null; readUrl: string | null }[] }[];
  materials: { id: string; title: string; kind: string; externalUrl: string | null; readUrl: string | null }[];
  learners: { enrollmentId: string; name: string; status: string; progress: number; referredByMe: boolean }[];
  assessments: { id: string; title: string; briefAr: string | null; attachments?: unknown; type: string; maxScore: number; dueAt: string | null; status: string; submissions: number }[];
  checklist: { key: string; labelAr: string; done: boolean; optional: boolean }[];
}

const PLAN_STATUS_AR: Record<string, { label: string; tone: "default" | "accent" | "positive" | "warn" }> = {
  draft: { label: "مسودّة — لم تُرسَل بعد", tone: "default" },
  submitted: { label: "بانتظار اعتماد الإدارة", tone: "accent" },
  changes_requested: { label: "طُلبت تعديلات — راجع الملاحظة وأعد الإرسال", tone: "warn" },
  approved: { label: "معتمَدة — الشعبة جاهزة", tone: "positive" },
  published: { label: "منشورة", tone: "positive" },
  superseded: { label: "نسخةٌ قديمة", tone: "default" },
};

/* المراحلُ الستّ — بترتيبها على الخطّ. ومفاتيحُها مفاتيحُ قائمة الخادم، فحالةُ
   كلٍّ (تمّ / لم يتمّ) تُقرأ من هناك لا تُخمَّن هنا. و«التسجيلات» الاختياريّةُ
   تُطوى داخل «اللقاءات»: مرحلةٌ واحدةٌ لهما. */
type Stage = "identity" | "modules" | "resources" | "sessions" | "assignments" | "approval";
const STAGES: { key: Stage; label: string; icon: typeof BookOpen }[] = [
  { key: "identity", label: "الاسمُ والنبذة", icon: ClipboardList },
  { key: "modules", label: "المحاور", icon: BookOpen },
  { key: "resources", label: "المصادر", icon: FileText },
  { key: "sessions", label: "لقاءات مباشرة", icon: CalendarDays },
  { key: "assignments", label: "المهامّ والتطبيق العمليّ", icon: ClipboardCheck },
  { key: "approval", label: "الاعتماد", icon: Send },
];
type Phase = "prepare" | "run";
const ASSESSMENT_TYPES: Record<string, string> = { assignment: "واجب", quiz: "اختبار", project: "مشروع تخرج" };
const MODULE_FORMS = { one: "محور", two: "محوران", few: "محاور", many: "محورا" } as const;

/* ═══ الأصنافُ الثلاثةُ كما يقرؤها المدرّب ═══

   ثلاثُ خاناتٍ سمّاها صاحبُ المنصّة بنفسه (١٥ سبتمبر ٢٠٢٦)، ولكلٍّ بابُها:
   المسجَّلُ بتاريخ فتحه، والكتبُ بهدفها، والعامُّ بلا شرط. والنصُّ هنا لا في
   `plan-overlay`: ذاك محضٌ يقرؤه الخادمُ كذلك، وهذا عرضٌ بأيقونات. */
const RESOURCE_CATEGORY_META: Record<string, {
  label: string; hint: string; icon: typeof BookOpen; titlePlaceholder: string; notePlaceholder: string; addLabel: string;
}> = {
  recorded: {
    label: "دوراتٌ مسجّلةٌ لك",
    hint: "جلساتُك التدريبيّةُ المسجَّلة. تحدّد متى تُفتح لكلّ واحدةٍ على مدى الفصل — وقبل موعدها لا تصل المتعلّمَ أصلا.",
    icon: Film,
    titlePlaceholder: "اسمُ الجلسة — «اللقاء الثاني · التحليل العمليّ»",
    notePlaceholder: "ماذا في هذه الجلسة، ومتى يشاهدها (اختياريّ)",
    addLabel: "+ جلسةٌ مسجّلة",
  },
  reading: {
    label: "كتبٌ وملفّات",
    hint: "كرّاسةٌ أو مقالٌ أو نموذجٌ يملؤه. وقل لكلّ واحدٍ ما الهدفُ منه — فملفٌّ بلا هدفٍ يُفتح مرّةً ولا يُعاد إليه.",
    icon: FileText,
    titlePlaceholder: "سمِّ المحتوى لا المنصّة — «كرّاسة التحرير» لا «ملفّ PDF»",
    notePlaceholder: "ما الهدفُ منه؟ ما فيه، ومتى يقرؤه",
    addLabel: "+ كتابٌ أو ملفّ",
  },
  public: {
    label: "فيديوهاتٌ وروابطُ عامّةٌ للفائدة",
    hint: "ما ينفعه ولم تصنعه أنت: فيديو، أو بودكاست، أو أيُّ مصدرٍ مفتوحٍ يفيد الطلبة.",
    icon: Link2,
    titlePlaceholder: "اسمُ المصدر كما يراه المتعلّم",
    notePlaceholder: "لماذا هذا المصدر؟ ما فيه، ومتى يقرؤه (اختياريّ)",
    addLabel: "+ رابطٌ عامّ",
  },
};

/* ── رأسُ كلّ خطوة: ما هي، ولمَ هي، وكم تأخذ ──

   كان المدرّبُ يفتح الخطوةَ فيجد حقولا بلا مقدّمة، فلا يعرف أهي دقيقتان
   أم ساعة، ولا لمن يُكتب ما يكتبه. والوقتُ المذكور تقديرٌ صادقٌ لا وعد:
   يُقال ليقرّر أيبدأها الآن أم يؤجّلها، وهو أنفعُ ما يُقال له قبلها. */
const STAGE_INTRO: Record<Stage, { title: string; purpose: string; minutes: string }> = {
  identity: {
    title: "اسمُ الشعبة ونبذتُها",
    /* وكان يَعِدُ بما لم يعد فيها: «متى تبدأ وتنتهي وأيّامُ لقاءاتها» —
       والبدءُ والانتهاءُ يُشتقّان من الفصل الذي تسمّيه الإدارة، ومواعيدُ
       اللقاءات تُحدَّد لقاءً لقاءً في خطوتها. ومقدّمةٌ تَعِدُ بحقولٍ لا
       وجودَ لها تجعل المدرّبَ يبحث عمّا ليس هنا ويظنّ الشاشةَ ناقصة. */
    purpose: "تعريفُ الدفعة كما يراها المتعلّمُ قبل أن يسجّل: اسمُها وسطرانِ عمّا يخرج به منها.",
    minutes: "نحو دقيقتين",
  },
  modules: {
    title: "المحاور والتطبيق العمليّ",
    purpose: "خارطةُ ما ستدرّسه. تبدأ من محاور الكتالوج وتعدّلها لهذه الشعبة — ولا تمسّ الكتالوجَ نفسَه.",
    minutes: "نحو ١٥ دقيقة",
  },
  resources: {
    title: "المصادر",
    purpose: "ما يحتاجه المتعلّمُ خارجَ اللقاء: كرّاسةٌ أو مقالٌ أو فيديو. تُفتح له مع أوّل يوم.",
    minutes: "نحو ٥ دقائق",
  },
  sessions: {
    title: "اللقاءات والتسجيلات",
    purpose: "مواعيدُ اللقاءات المباشرة داخلَ النافذة التي حدّدتها الإدارة، وتسجيلاتُها بعد انتهائها.",
    minutes: "نحو ٧ دقائق",
  },
  assignments: {
    title: "المهامّ والتطبيق العمليّ",
    purpose: "ما يُسلّمه المتعلّمُ ويعود إليك في طابور التقييم. خطوةٌ اختياريّة — ويُنصح بواحدٍ على الأقلّ.",
    minutes: "نحو ٥ دقائق",
  },
  approval: {
    title: "الموافقة والإرسال للاعتماد",
    purpose: "مراجعةٌ أخيرةٌ ثمّ إرسال. بعد الإرسال تُقفل الشعبةُ للتعديل حتّى يصل قرارُ الإدارة.",
    minutes: "دقيقة",
  },
};

function StageIntro({ stage }: { stage: Stage }) {
  const it = STAGE_INTRO[stage];
  const Icon = STAGES.find((s) => s.key === stage)?.icon ?? BookOpen;
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-black">
        <Icon className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> {it.title}
      </h3>
      <p className="mt-1.5 text-read leading-7 text-muted-foreground">
        {it.purpose} <span className="whitespace-nowrap text-teal-light-ink">· {it.minutes}</span>
      </p>
    </div>
  );
}

/** التاريخُ كما يقبله `<input type="date">` */
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/* بصمتا المرحلتين اللتين تتقاسمان `content` — «المحاور» و«المصادر» تُحفظان
   معا بـ`savePlan`، لكنّ المدرّبَ يحرّر واحدةً في كلّ مرّة. فلو قيست
   البصمةُ على الكائن كلِّه لأضاءت المرحلتان معا بتعديلٍ في إحداهما. */
const modulesKey = (c: PlanContent) => JSON.stringify(c.modules);
const resourcesKey = (c: PlanContent) => JSON.stringify(c.resources);


/* والوصفُ صار مع الاسم والنبذة، والملاحظةُ صارت مع اللقاءات — فبصمةُ كلٍّ
   حيث صار الحقلُ لا حيث كان. */
const summaryKey = (c: PlanContent) => c.summaryAr ?? "";
/* ═══ ولم تعد لخطوة «اللقاءات» مسودّةٌ تُحفظ ═══

   كانت تحمل حقلا واحدا (`liveNoteAr`) يُحفظ مع الخطّة، فتُعلَّم «لم يُحفَظ»
   إن كُتب فيه. وقد ذهب إلى كلّ لقاءٍ على حدة (١٥ سبتمبر ٢٠٢٦)، واللقاءُ
   يُحفظ بنداءٍ خاصٍّ به لحظةَ إرساله للاعتماد — فلا شيءَ في هذه الخطوة
   ينتظر زرَّ حفظ.

   و`liveNoteAr` يبقى في النوع وفي `content`: ما كتبه مدرّبٌ قبل اليوم لا
   يُمحى بترحيلِ شاشةٍ — يُحمل كما هو ولا يُعرض ولا يُكتب. */

export default function CohortWorkspace() {
  const { id } = useParams();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [err, setErr] = useState("");
  const [phase, setPhase] = useState<Phase>("prepare");
  const [stage, setStage] = useState<Stage>("identity");
  const [busy, setBusy] = useState(false);

  /* النسخةُ التي يحرّرها — تبدأ من الخطّة إن كانت، وإلّا من محاور الكتالوج */
  const [content, setContent] = useState<PlanContent | null>(null);
  /* ما بقي من الهُويّة بعد الشطب (١٥ سبتمبر ٢٠٢٦): اسمٌ ونبذة. والمواعيدُ
     تُشتقّ من الفصل، واللقاءاتُ تُحدَّد لقاءً لقاءً في خطوتها. */
  const [identity, setIdentity] = useState({ title: "" });
  /* الفصولُ التي يسعه اختيارُها — تُقرأ مرّةً عند فتح الشعبة */
  const [confirm, setConfirm] = useState(false);
  /* نموذجُ التكليف — واحدٌ للإنشاء والتعديل. `editingId` يقرّر أيَّهما:
     فارغٌ فإنشاء، وفيه معرّفٌ فتعديلُ ذاك التكليف بعينه. */
  const [taskForm, setTaskForm] = useState({ title: "", briefAr: "", type: "assignment", maxScore: 100, dueAt: "" });
  /* مرفقاتُ التكليف تحت اليد — منفصلةٌ عن `taskForm` لأنّها مصفوفةٌ تُضاف
     ويُحذف منها، لا حقلٌ نصّيّ. */
  const [taskAttachments, setTaskAttachments] = useState<PlanResource[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  /* ═══ نموذجُ المهمّة انسدالٌ يُفتح، لا جدارٌ مفتوحٌ أبدا ═══

     قال صاحبُ المنصّة (١٥ سبتمبر ٢٠٢٦): «هنا التصميمُ مبعثر — يجب أن تكون
     لائحةُ المهامّ التي قدّمها مع حقّ التعديل والحذف، وإضافةُ مهمّةٍ جديدةٍ
     تفتح انسدالا يقوم بتعديل المطلوب فيها ويؤكّد».

     وكان ثمانيةَ حقولٍ مفتوحةً تحت اللائحة أبدا، فتُقرأ الصفحةُ نموذجا
     تتقدّمه قائمةٌ لا قائمةً يليها فعل. ومن جاء ليراجع مهامَّه وجد نفسَه
     في نموذجِ إنشاء. */
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  /* التكليفُ المطلوبُ حذفُه — الحذفُ لا يقع بنقرةٍ واحدة */
  const [pendingDelete, setPendingDelete] = useState<Workspace["assessments"][number] | null>(null);
  /* والمحورُ المطلوبُ حذفُه — ومعه موضعُه، فالعناوينُ تتكرّر */
  const [pendingModule, setPendingModule] = useState<{ index: number; module: PlanModule } | null>(null);
  /* المحورُ المفتوح — واحدٌ في كلّ مرّة. والمطويُّ يُقرأ سطرا فلا تصير
     الصفحةُ جدارا من ثلاثين حقلا. */
  const [openModule, setOpenModule] = useState<string | null>(null);
  /* بصمةُ آخرِ ما حُفظ — يُقاس عليها «فيه تغييرٌ لم يُحفظ» لكلّ مرحلةٍ وحدَها.
     كانت المرحلةُ تُغادَر بتعديلٍ في يدها فيضيع بلا كلمة. */
  const [baseline, setBaseline] = useState({ identity: "", modules: "", resources: "" });

  const load = useCallback(async (first = false) => {
    if (!id) return;
    try {
      const w = await apiGet<Workspace>(`/api/trainer/cohorts/${id}/workspace`);
      setWs(w);
      const nextContent: PlanContent = w.plan?.content ?? { kind: "trainer", summaryAr: "", modules: w.course.baseModules, resources: [], liveNoteAr: "" };
      const nextIdentity = { title: w.cohort.title };
      setContent(nextContent);
      setIdentity(nextIdentity);
      /* البصمةُ تُؤخذ ممّا وصل لا ممّا في اليد — فبعد كلّ حفظٍ يعود كلُّ شيءٍ نظيفا */
      setBaseline({
        identity: JSON.stringify(nextIdentity) + summaryKey(nextContent),
        modules: modulesKey(nextContent),
        resources: resourcesKey(nextContent),
      });
      /* أوّلُ فتح: المعتمَدةُ تُفتح على التشغيل، وغيرُها على أوّل مرحلةٍ لم تتمّ */
      if (first) {
        const status = w.plan?.status ?? "draft";
        if (status === "approved" || status === "published") setPhase("run");
        else {
          const next = w.checklist.find((c) => !c.done && !c.optional && STAGES.some((s) => s.key === c.key));
          setStage((next?.key as Stage) ?? "identity");
        }
      }
    } catch (e) { setErr(e instanceof ApiError ? e.message : "تعذّر فتح صفحة الشعبة"); }
  }, [id]);
  useEffect(() => { void load(true); }, [load]);

  /* الخروجُ بتعديلٍ في اليد يُستأذَن فيه. والقراءةُ من مرجعٍ لا من حالة:
     الخطّافُ يُسجَّل مرّةً فوق الشرط (قواعدُ الخطّافات)، والقيمةُ تُحسب
     بعد الحارس — فالمرجعُ هو ما يصل بينهما. */
  /* ═══ الرأسُ يلتصق ويضمر — لا يذهب ولا يبتلع الشاشة ═══

     طلبُ صاحب المنصّة (١٥ سبتمبر ٢٠٢٦): «الشريطُ العلويُّ لتعديل الشعب يجب
     أن يبقى ظاهرا للمدرّب حتّى يخرج من خانة الشعب كلِّها»، ثمّ: «اجعل
     الستبر أصغرَ عندما نرفع للأعلى ليتبقّى مساحةٌ جيّدةٌ للمدرّب بتعبئة ما
     هو مطلوبٌ منه».

     فالرأسُ لاصقٌ في الطورين معا — لا في التجهيز وحدَه — ويضمر بالتمرير:
     تسقط الحلقةُ والعنوانُ وأسطرُ الحالة، وتصغر دوائرُ الخطوات، وتبقى
     الخطواتُ الستُّ وحدَها شريطا رفيعا يُنقر.

     والعتبةُ ٩٦ بكسلا لا صفرا: ارتعاشةُ إصبعٍ على لوحةٍ لمسيّةٍ تبدّل
     الحالةَ عند الصفر فيهتزّ الرأسُ صاعدا هابطا. */
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 96);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const dirtyRef = useRef(false);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirtyRef.current) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(done); await load(); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "تعذّر الحفظ"); }
    finally { setBusy(false); }
  };

  if (err) {
    return (
      <TrainerLayout title="صفحة الشعبة">
        <Card tone="danger" role="alert" className="text-center text-read font-bold text-red-300">{err}</Card>
        <Link to="/trainer/board" className="mt-4 inline-flex items-center gap-2 text-read font-bold text-teal-light-ink"><ArrowRight className="h-4 w-4" /> إلى شعبي</Link>
      </TrainerLayout>
    );
  }
  if (!ws || !content) {
    return (
      <TrainerLayout title="صفحة الشعبة">
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" /></div>
      </TrainerLayout>
    );
  }

  const planStatus = ws.plan?.status ?? "draft";
  const st = PLAN_STATUS_AR[planStatus] ?? PLAN_STATUS_AR.draft;
  const locked = planStatus === "submitted";
  const approved = planStatus === "approved" || planStatus === "published";
  /* حالةُ كلّ مرحلةٍ من قائمة الخادم — والمفتاحُ واحدٌ هنا وهناك */
  const byKey = new Map(ws.checklist.map((c) => [c.key, c]));
  /* ما يحجب الإرسال — من `plan-gate`، القاعدةِ نفسِها التي يحتجّ بها الخادم.
     وكان يُحسب هنا بيدٍ فيَعُدّ «الاعتمادَ» شرطا لنفسه: لا يتمّ حتّى يُرسَل،
     ولا يُرسَل حتّى يتمّ — فالزرُّ مطفأٌ أبدا وإن أتمّ المدرّبُ كلَّ شيء. */
  const blocking = blockingBeforeSubmit(ws.checklist);
  const remaining = blocking.length;
  /* وأوّلُ ما يستطيع هو فتحَه من الباقي — لا كلُّ الباقي خطوةٌ في يده */
  const firstMine = blocking.find((b) => STAGES.some((s) => s.key === b.key)) ?? null;
  /* والخطُّ يمتلئ بقدر ما **يملك المدرّبُ** إنجازَه — فيبلغ تمامَه حين لا يبقى
     إلّا قرارُ الإدارة، لا يقف دون التمام ينتظر قرارا ليس بيده. وصفُّ الفصل
     مثلُ صفِّ الاعتماد في هذا: تسمّيه الإدارةُ عند الإسناد، فلا يُعدُّ عليه. */
  const gated = trainerOwned(ws.checklist).filter((c) => !c.optional);
  const doneCount = gated.filter((c) => c.done).length;
  /* المحاورُ التي ينقصها المحتوى النظريّ — بالأرقام والعناوين، لا بعدد.
     والقاعدةُ قاعدةُ الخادم نفسُها (`moduleBodyDone`): مكتوبٌ بأربعين حرفا
     **أو** ملفٌّ مرفوع (ع-٢). وقاعدتان تقولان الشيءَ نفسَه تفترقان، فيُقال
     له «تمّ» ويُردّ إرسالُه. */
  const missingBody = content.modules
    .map((m, i) => ({ ...m, n: i + 1 }))
    .filter((m) => !moduleBodyDone(m));
  const ready = gated.length ? Math.round((doneCount / gated.length) * 100) : 0;
  const nextStage = STAGES.find((s) => { const c = byKey.get(s.key); return c && !c.done && !c.optional; }) ?? null;

  /* ── «فيه تغييرٌ لم يُحفظ» ──

     كلُّ مرحلةٍ تحفظ بزرٍّ في ذيلها، ولا شيءَ كان يقول للمدرّب إنّ في يده
     تعديلا: يفتح «المحاور» ويكتب مخرَجا ثمّ ينتقل إلى «المصادر» فيذهب ما
     كتب بلا كلمة. فصارت المرحلةُ المعدَّلةُ تُعلَّم على الخطّ، وزرُّ حفظها
     لا يعمل بلا تغيير، والخروجُ من الصفحة يُستأذَن فيه. */
  const dirty: Record<string, boolean> = {
    identity: JSON.stringify(identity) + summaryKey(content) !== baseline.identity,
    modules: modulesKey(content) !== baseline.modules,
    resources: resourcesKey(content) !== baseline.resources,
    /* واللقاءاتُ تُحفظ بنفسها — لا مسودّةَ لها في اليد */
    sessions: false,
  };
  dirtyRef.current = Object.values(dirty).some(Boolean);

  const openStage = (s: Stage) => { setPhase("prepare"); setStage(s); };
  const savePlan = () => act(() => apiPut(`/api/trainer/cohorts/${ws.cohort.id}/plan`, content), "حُفظت مسودّتك");
  /* زرٌّ واحدٌ يحفظ الاثنين: بياناتُ الشعبة في الشعبة، ووصفُها في الخطّة.
     وزرّان في خطوةٍ واحدةٍ يجعل المدرّبَ يحفظ أحدَهما ويظنّ الآخرَ محفوظا. */
  const saveIdentity = () => act(async () => {
    await apiPut(`/api/trainer/cohorts/${ws.cohort.id}/plan`, content);
    await apiPatch(`/api/trainer/cohorts/${ws.cohort.id}`, { title: identity.title.trim() });
  }, "حُفظت بياناتُ الشعبة");
  /* الفصلُ يُحفظ وحدَه لا مع الاسم: اختيارُه يحرّك حدودَ الشعبةَ ونافذةَ
     جدولتها، وقد يُردّ إن كان في الجدول لقاءٌ خارجَه — فلا يُبتلع في زرٍّ
     اسمُه «احفظ البيانات» ويظنُّ صاحبُه أنّ الاسمَ لم يُحفظ. */
  const submit = () => act(() => apiPost(`/api/trainer/cohorts/${ws.cohort.id}/plan/submit`, { confirm }), "أُرسلت للاعتماد — يصلك القرار هنا وبالبريد");
  /* ── التكاليف: إنشاءٌ وتعديلٌ وحذف ──

     النموذجُ واحدٌ للفعلين: ما كُتب فيه يُرسَل `POST` إن لم يكن تحت اليد
     تكليفٌ يُعدَّل، و`PATCH` إن كان. فلا شاشةٌ ثانيةٌ ولا حقولٌ تُكرَّر. */
  const blankTask = { title: "", briefAr: "", type: "assignment", maxScore: 100, dueAt: "" };
  const cancelEdit = () => { setEditingId(null); setTaskForm(blankTask); setTaskAttachments([]); setTaskFormOpen(false); };
  const editAssessment = (a: Workspace["assessments"][number]) => {
    setEditingId(a.id);
    /* «عدّل» يفتح الانسدالَ نفسَه — لا شاشةَ ثانيةً ولا حقولٌ تُكرَّر */
    setTaskFormOpen(true);
    setTaskForm({ title: a.title, briefAr: a.briefAr ?? "", type: a.type, maxScore: a.maxScore, dueAt: toDateInput(a.dueAt) });
    setTaskAttachments(readTypedLinks(a.attachments));
  };
  const saveAssessment = () => act(async () => {
    const payload = {
      title: taskForm.title.trim(), type: taskForm.type, maxScore: taskForm.maxScore,
      /* الفراغُ يعني «بلا تعليمات» — يُرسَل `null` عند التعديل كي يُمحى ما كان */
      briefAr: taskForm.briefAr.trim() || null,
      dueAt: taskForm.dueAt ? new Date(taskForm.dueAt).toISOString() : null,
      /* الناقصُ يُسقَط لا يُرسَل نصفَ مرفق — والمصفوفةُ الفارغةُ محوٌ مقصود */
      attachments: taskAttachments
        .filter((r) => r.title.trim() && /^https?:\/\//.test((r.url ?? "").trim()))
        .map((r) => ({ title: r.title.trim(), url: (r.url ?? "").trim(), kind: resourceKind(r.kind) })),
    };
    if (editingId) await apiPatch(`/api/trainer/assessments/${editingId}`, payload);
    else await apiPost(`/api/trainer/cohorts/${ws.cohort.id}/assessments`, { ...payload, briefAr: payload.briefAr ?? undefined, dueAt: payload.dueAt ?? undefined });
    cancelEdit();
  }, editingId ? "حُفظ التعديل — يراه المسجّلون كما هو الآن" : "أُنشئت المهمّة — تظهر للمسجّلين ويعود إليك تسليمُهم في طابور المراجعة");
  const deleteAssessment = (a: Workspace["assessments"][number]) => act(async () => {
    await apiDelete(`/api/trainer/assessments/${a.id}`);
    if (editingId === a.id) cancelEdit();
  }, "حُذفت المهمّة");

  const setModule = (i: number, patch: Partial<PlanModule>) =>
    setContent({ ...content, modules: content.modules.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  const whenLine = [
    ws.cohort.startsAt ? `تبدأ ${fmtDateAr(ws.cohort.startsAt)}` : "بلا موعدِ بدءٍ بعد",
    daysLabelAr(ws.cohort.daysOfWeek) || null,
    ws.cohort.startTime ? `الساعة ${ws.cohort.startTime}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <TrainerLayout title={`شعبة «${ws.cohort.title}»`}>
      <style>{`
        @keyframes stage-seal { 0% { opacity: 0; transform: scale(.85) } 60% { opacity: 1; transform: scale(1.04) } 100% { opacity: 1; transform: scale(1) } }
        .stage-seal { animation: stage-seal .7s cubic-bezier(.2,.9,.3,1.2) both; }
        .stage-fill { transition: width .8s cubic-bezier(.22,1,.36,1); }
      `}</style>

      <Link to="/trainer/board" className="mb-4 inline-flex items-center gap-2 text-read font-bold text-teal-light-ink hover:text-foreground">
        <ArrowRight className="h-4 w-4" /> شعبي
      </Link>

      {/* ═══ الرأس: أين وصلت الشعبة ═══ */}
      {/* ═══ الشريطُ يُلحَم بالسقف، ولا فراغَ ميّتٌ فوقه ═══

          شكا صاحبُ المنصّة (١٧ سبتمبر ٢٠٢٦): «ألغِ الفراغَ فوقها واجعلها
          ملاصقةً للسقف عند النزول للأسفل». وثلاثةُ أشياءَ كانت تمنع ذلك:

          ① **فراغٌ ميّتٌ مقدارُه عشرون بكسلا**: صفُّ الهويّة يُخفى عند
            الضمور بـ`display:none`، **فلا ينطوي هامشُ `mt-5` الذي على
            أخيه** — يبقى معلّقا فوق اللسانَين. وهذا هو «الفراغ» بعينه.
          ② **بطاقةٌ مقوّسةٌ لا تلتصق**: `rounded-3xl` وحدٌّ محيطٌ و`mb-5`
            تجعلها تجلس في الصفحة لا تُلحَم بحافّتها. فصارت `Bar` — شكلُ
            جلوسٍ آخرُ لا زخرفةً أخرى، وتفيض عن حشو الحاضن بـ`-mx-5`
            لتبلغ حافّتَي الإطار.
          ③ **أرضيّةٌ شفّافة**: `bg-paper/95` مع `backdrop-blur` تتبع ما
            يمرّ تحتها، والقياسُ لا يجوز أن يتبع المتنَ المارّ. فصارت
            `tone="solid"` صمّاء.

          ونغمةُ الحالة (`st.tone`) سقطت من السطح عمدا: تينتُها ستّةٌ في
          المئة، فهي شفّافةٌ بحكمها ولا تصلح لسطحٍ يمرّ تحته متن. والحالةُ
          لم تُفقَد — تُقرأ من حبّتها ومن ختم «شعبةٌ معتمَدة» داخلَ الشريط. */}
      <Bar
        as="section"
        tone="solid"
        className={`sticky z-30 -mx-5 mb-5 px-5 transition-[padding] ${compact ? "py-3" : ""}`}
        style={{ top: "var(--staff-sticky-top, 0px)" }}
      >
        <div className={`flex flex-wrap items-start gap-5 ${compact ? "hidden" : ""}`}>
          <ProgressRing value={ready} label={`${doneCount}/${gated.length}`} caption="تجهيز" size={76} />
          <div className="min-w-0 flex-1">
            <p className="text-read font-bold text-muted-foreground">{ws.course.titleAr}</p>
            <h2 className="mt-0.5 text-xl font-black leading-snug">{ws.cohort.title}</h2>
            <p className="mt-1 text-read text-muted-foreground">{whenLine} · {ws.learners.length} التحقوا · {ws.sessions.length} لقاء</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {approved ? (
                <span className="stage-seal inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-read font-black text-emerald-300">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> شعبةٌ معتمَدة
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-read font-bold text-foreground">{st.label}</span>
              )}
              {!approved && nextStage && (
                <Button tone="secondary" size="sm" type="button" onClick={() => openStage(nextStage.key)}>
                  التالي: {nextStage.label}
                </Button>
              )}
            </div>
          </div>
        </div>
        {ws.plan?.reviewerNote && planStatus === "changes_requested" && (
          <Inset tone="warn" className="mt-4">
            <p className="text-read font-black text-gold-ink">ملاحظةُ الإدارة</p>
            <p className="mt-1 whitespace-pre-line text-read leading-7 text-foreground">{ws.plan.reviewerNote}</p>
          </Inset>
        )}

        {/* ═══ المرحلتان — قبل خطِّ الخطوات لا بعده ═══

            كان خطُّ الخطوات الستّ يُصيَّر أوّلا ثمّ لسانا «التجهيز/التشغيل»
            تحته، ويبقى الخطُّ ظاهرا في التشغيل أيضا. فيُقرأ «التشغيل» كأنّه
            خانةٌ تتكرّر عند كلّ خطوة، ولا يُدرى أيُّهما يحوي الآخر.

            والصوابُ أنّ الخطواتِ الستَّ **من التجهيز** لا من الشعبة: فالطورُ
            يُختار أوّلا، ثمّ تظهر خطواتُه إن كان تجهيزا. */}
        <TabBar
          ariaLabel="طورا الشعبة"
          /* ولا يُكتب `mt-5` ثابتا: أخوه يُخفى بـ`display:none` فلا ينطوي
             هامشُه معه — عشرون بكسلا ميّتةً فوق اللسانَين عند الضمور. */
          className={compact ? "" : "mt-5"}
          items={[
            { id: "prepare", label: <span className="inline-flex items-center gap-2"><ClipboardList className="h-4 w-4" aria-hidden="true" />التجهيز</span> },
            /* ع-١: «التشغيل» صار «مركزَ التواصل» — ولم يبقَ فيه إلّا المخاطبة.
               فاللقاءاتُ والحضورُ ذهبت إلى «لقاءات مباشرة» (د-٤)، والموادُّ إلى
               «المصادر»، ولوحتان كانتا تكرارَ تبويبَي «طلبتي» و«طابور التقييم». */
            { id: "run", label: <span className="inline-flex items-center gap-2"><MessageSquarePlus className="h-4 w-4" aria-hidden="true" />مركز التواصل</span> },
          ]}
          value={phase}
          onChange={setPhase}
        />

        {/* ═══ خطُّ الخطوات — يمتلئ بقدر ما أُنجز، والتاليةُ مضاءة ═══

            ويبقى في «مركز التواصل» كذلك: نقرةٌ على خطوةٍ تعيده إلى التجهيز
            عندها (`openStage` تبدّل الطورَ والخطوةَ معا). وكان يختفي بتبديل
            الطور، فيفقد المدرّبُ سلّمَه ولا يجد طريقَ العودة إلّا بلسانٍ
            فوقه لا يدلّ عليه شيء. */}
        <div className={`relative ${compact ? "mt-3" : "mt-5"}`}>
          {!compact && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-[8.3%] top-5 hidden h-1 rounded-full bg-white/10 md:block">
              <div className="stage-fill h-full rounded-full bg-teal" style={{ width: `${ready}%` }} />
            </div>
          )}
          <ol className="grid gap-2 md:grid-cols-6">
            {STAGES.map((s, i) => {
              const item = byKey.get(s.key);
              const done = item?.done ?? false;
              const optional = item?.optional ?? false;
              const isNext = nextStage?.key === s.key;
              const selected = phase === "prepare" && stage === s.key;
              return (
                <li key={s.key} className="relative">
                  <button
                    type="button"
                    onClick={() => openStage(s.key)}
                    aria-current={selected ? "step" : undefined}
                    className={`group flex w-full items-center rounded-2xl text-start transition md:flex-col md:items-center md:text-center ${compact ? "gap-2 px-1 py-1 md:gap-1" : "gap-3 px-2 py-1.5 md:gap-2"} ${selected ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"}`}
                  >
                    <span className={`relative z-10 grid shrink-0 place-items-center rounded-full border-2 font-black transition ${compact ? "h-7 w-7 text-fine" : "h-10 w-10 text-sm"} ${
                      done ? "border-teal bg-teal text-on-teal"
                        : isNext ? "border-gold bg-gold/15 text-gold-ink shadow-[0_0_0_4px_rgba(250,188,5,0.15)]"
                        : "border-white/15 bg-surface text-muted-foreground"
                    }`}>
                      {done ? <Check className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" /> : i + 1}
                      {/* نقطةٌ ذهبيّةٌ على الرقم: في هذه المرحلة تعديلٌ لم يُحفظ */}
                      {dirty[s.key] && (
                        <span className="absolute -end-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-surface bg-gold" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className={`block font-bold leading-5 ${compact ? "text-fine" : "text-read"} ${done || isNext || selected ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                      {/* والسطرُ الثاني يُطوى بالضمور — إلّا «لم يُحفَظ»:
                          تعديلٌ في اليد لا يُكتم لتوفير سطر. */}
                      {(!compact || dirty[s.key]) && (
                        <span className={`block text-fine leading-4 ${dirty[s.key] ? "font-bold text-gold-ink" : "text-muted-foreground"}`}>
                          {dirty[s.key] ? "لم يُحفَظ" : done ? "تمّ" : isNext ? "التالي" : optional ? "اختياريّ" : "لم يتمّ بعد"}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </Bar>

      {phase === "prepare" && locked && stage !== "approval" && (
        <Inset tone="accent" className="mb-4 flex items-start gap-2 text-read leading-6">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          خطّتك بانتظار الاعتماد — لا تُعدَّل حتّى يصل القرار. ولو أردت تعديلها الآن، اطلب من الإدارة ردَّها إليك.
        </Inset>
      )}

      {/* ─────────── ① الاسمُ والنبذة ─────────── */}
      {phase === "prepare" && stage === "identity" && (
        <Panel as="section">
          <StageIntro stage="identity" />

          {/* ═══ الفصلُ حقيقةٌ تُقرأ، لا سؤالٌ يُسأل ═══

              كانت هنا شبكةُ فصولٍ ينقر فيها المدرّب. وصحّح صاحبُ المنصّة
              (١٧ سبتمبر ٢٠٢٦): «القصدُ كان لدينا في الإدارة نكون قد اعتمدنا
              الدورةَ في فصلٍ معيّن فتتقيّد إجاباتُه حول أوقات الجلسات في هذه
              المدّة فقط»، وصاغ الفعلَ: «عندما نقوم بإسناد دورةٍ لمدرّب نحدّد
              لأيّ فصلٍ ستكون، وبهذا نكون فتحنا شعبةً له».

              فالفصلُ يحكم نافذةَ التسجيل والتقويمَ المنشورَ وموسمَ الإيراد،
              ويكتب `startsAt` الذي يقرؤه الكتالوجُ العامُّ — وكان القرارَ
              الإداريَّ المحضَ الوحيدَ المفوَّضَ في هذه الشاشة، ويُكتب بنقرةٍ
              بلا بوّابةٍ بينما كلُّ ما عداه يمرّ باعتماد. */}
          {ws.cohort.term ? (
            <Inset tone="accent" className="flex items-start gap-2 text-read leading-7">
              <CalendarDays className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                هذه الشعبةُ معتمَدةٌ لـ<b className="text-foreground">«{ws.cohort.term.titleAr}»</b> —
                من <b className="text-foreground">{fmtDateAr(ws.cohort.term.startsOn)}</b> إلى{" "}
                <b className="text-foreground">{fmtDateAr(ws.cohort.term.endsOn)}</b>.
                ولقاءاتُك تُجدوَل داخلَ هذه الأشهر وحدَها، لقاءً لقاءً في خطوة «لقاءات مباشرة».
              </span>
            </Inset>
          ) : (
            /* ═══ وحالةٌ لم يكن لها اسم ═══

               شعبةٌ بلا فصلٍ ليست معطوبةً بل **لم تُفتَح بعد**. وكان يُقال
               له «اخترْه في خطوة الاسم والمواعيد» — أي يُؤمَر بفعلٍ صار ليس
               له. والصوابُ أن يُقال ما يقع، ومن يفعله، وما يستطيعه هو الآن. */
            <Inset tone="warn" className="flex items-start gap-2 text-read leading-7 text-gold-ink">
              <CalendarDays className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                <b>لم تُفتَح هذه الشعبةُ بعد</b> — تسمّي الإدارةُ فصلَها عند الإسناد، ومنه تُشتقّ حدودُها
                وتُفتح لك جدولةُ اللقاءات. ويصلك إشعارٌ حين يُسمَّى.
                {" "}وحتّى ذلك الحين أعِدَّ محاورَك ومصادرَك — فهي لا تنتظر الفصل.
              </span>
            </Inset>
          )}

          <div className="mt-5 grid gap-5">
            <StaffField wide label="اسم الشعبة" hint="ما يراه المتعلّم في الكتالوج وفي شهادته. صِفِ الدفعةَ لا الدورة — «الدفعة الثالثة · مساء الأحد».">
              <input value={identity.title} onChange={(e) => setIdentity({ title: e.target.value })} disabled={locked} className={controlCls} />
            </StaffField>
            {/* وصفُ الشعبة موضعُه هنا لا في «المحاور»: هو تعريفُ الشعبة
                نفسِها، وكان في خطوةٍ اسمُها «المحاور» فلا يجده من يبحث عنه. */}
            <StaffField wide label="نبذةٌ عن الشعبة" hint="سطران يقرؤهما المتعلّم قبل أن يدفع. قل ما سيخرج به، لا ما ستشرحه.">
              <textarea rows={2} value={content.summaryAr ?? ""} onChange={(e) => setContent({ ...content, summaryAr: e.target.value })} disabled={locked} className={areaCls} />
            </StaffField>
          </div>

          {/* السعرُ يُقرأ ولا يُكتب — ويُقال لماذا، لا يُخفى */}
          <Inset className="mt-5 flex items-start gap-2 text-read leading-6 text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              السعرُ والسعةُ بيد الإدارة: {ws.cohort.readOnly.price === null ? "لم يُحدَّد بعد" : <b dir="ltr" className="font-mono text-foreground">{ws.cohort.readOnly.price} {ws.cohort.readOnly.currency}</b>}
              {ws.cohort.readOnly.capacity ? <> · السعة {ws.cohort.readOnly.capacity}</> : null}. وما تقبضه عن كلّ متعلّم في «مستحقاتي».
            </span>
          </Inset>
          <Button tone="confirm" disabled={busy || locked || !dirty.identity || identity.title.trim().length < 3} onClick={saveIdentity} className="mt-4">احفظ البيانات</Button>

          {/* ═══ اسمُ الدورة — قناتُه الصحيحة لا صندوقٌ في الخطّة (ح-٣ · د-٦) ═══

              حلَّ محلَّ «اقتراحٌ للإدارة (اختياريّ)»: كان يكتب الاسمَ على
              النسخة الحاليّة فيُعيد تسميةَ الشهادات الصادرة، ولا يترك سجلَّ
              من اقترح ولا لِمَ. والعلّةُ كاملةً في رأس `CourseTitleProposal`. */}
          <CourseTitleProposal
            courseId={ws.course.id}
            currentTitleAr={ws.course.titleAr}
            legacyDraft={content.proposals?.courseTitleAr ?? null}
            locked={locked}
          />
        </Panel>
      )}

      {/* ─────────── ② المحاور والتطبيق ─────────── */}
      {phase === "prepare" && stage === "modules" && (
        <Panel as="section">
          <StageIntro stage="modules" />
          {content.modules.length === 0 && (
            <Inset tone="warn" className="mt-4 text-read leading-6 text-gold-ink">لا محاورَ لهذه الدورة في الكتالوج بعد — أضف محورا أدناه وابدأ منه.</Inset>
          )}
          <p className="mt-4 text-read text-muted-foreground">{countAr(content.modules.length, MODULE_FORMS)} · اضغط العنوانَ لتفتحه</p>
          <ol className="mt-3 space-y-3">
            {content.modules.map((m, i) => {
              const open = openModule === m.moduleId;
              const filled = m.titleAr.trim().length > 1 && (m.outcomeAr ?? "").trim().length > 1;
              /* ═══ ولماذا يتلوّن المحورُ المفتوح ═══

                 شكا صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦): «لا أميّز متى تنتهي
                 الشاشةُ المنسدلة». وثمانيةُ محاورَ مطويّةٍ بحافّةٍ واحدةٍ خافتة
                 (`border-white/10`)، فإذا فُتح أحدُها امتدّ خمسةَ حقولٍ بالأرضيّة
                 نفسِها وبالحافّة نفسِها — فلا تُرى بدايتُه من نهايةِ ما قبله،
                 ولا نهايتُه من بدايةِ ما بعده.

                 والعلاجُ نبرةٌ قائمةٌ في نظام الأسطح لا لونٌ يُكتب باليد:
                 المفتوحُ `accent` والمطويُّ `default`. فحدُّه ظاهرٌ من طرفَيه،
                 ويعرف الناظرُ أين هو من القائمة بلا أن يعدّ. */
              return (
              <Card as="li" key={m.moduleId} tone={open ? "accent" : "default"}>
                <div className="flex flex-wrap items-center gap-2">
                  {/* العنوانُ زرٌّ يطوي البطاقةَ ويفتحها — فستّةُ محاورَ في خمسةِ
                      حقولٍ جدارٌ لا يُقرأ، والمطويُّ منها يُرى سطرا واحدا. */}
                  <button
                    type="button"
                    onClick={() => setOpenModule(open ? null : m.moduleId)}
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 items-center gap-2 text-start"
                  >
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-read font-black text-teal-light-ink">
                        المحور {i + 1}
                        {!open && m.titleAr.trim() && <span className="font-bold text-foreground"> — {m.titleAr}</span>}
                      </span>
                      {!open && (
                        <span className={`mt-0.5 block truncate text-read ${filled ? "text-muted-foreground" : "text-gold-ink"}`}>
                          {filled ? (m.outcomeAr ?? "") : "ينقصه العنوانُ أو المخرَج"}
                        </span>
                      )}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button tone="ghost" size="sm" disabled={locked || i === 0}
                      aria-label={`انقل «${m.titleAr || `المحور ${i + 1}`}» إلى أعلى`}
                      onClick={() => setContent({ ...content, modules: moveModule(content.modules, i, -1) })}
                    ><ChevronUp className="h-4 w-4" aria-hidden="true" /></Button>
                    <Button tone="ghost" size="sm" disabled={locked || i === content.modules.length - 1}
                      aria-label={`انقل «${m.titleAr || `المحور ${i + 1}`}» إلى أسفل`}
                      onClick={() => setContent({ ...content, modules: moveModule(content.modules, i, 1) })}
                    ><ChevronDown className="h-4 w-4" aria-hidden="true" /></Button>
                    <Button tone="ghost" size="sm" disabled={locked}
                      aria-label={`احذف «${m.titleAr || `المحور ${i + 1}`}»`}
                      onClick={() => setPendingModule({ index: i, module: m })}
                    >احذف</Button>
                  </div>
                </div>
                {open && (
                <div className="mt-4 grid gap-5">
                  <p className="text-read text-muted-foreground">المعرّف <span className="font-mono">{m.moduleId}</span></p>
                  <StaffField label="عنوان المحور" hint="اسمٌ قصيرٌ يظهر في قائمة المتعلّم. ابدأه باسمٍ لا بفعل: «بنية المقال» لا «نتعلّم بنية المقال».">
                    <input value={m.titleAr} onChange={(e) => setModule(i, { titleAr: e.target.value })} disabled={locked} aria-label={`عنوان المحور ${i + 1}`} className={controlCls} />
                  </StaffField>
                  <StaffField label="مخرَج المحور" hint="ما يستطيع المتعلّمُ فعلَه بعده ولم يكن يستطيعه قبله. ابدأه بفعلٍ يُقاس: «يميّز»، «يكتب»، «يحلّل».">
                    <textarea rows={2} value={m.outcomeAr ?? ""} onChange={(e) => setModule(i, { outcomeAr: e.target.value })} disabled={locked} aria-label={`مخرج المحور ${i + 1}`} className={areaCls} />
                  </StaffField>
                  <StaffField label="التطبيق العمليّ" hint="ما يفعله بيده في هذا المحور. إن لم يكن فيه شيءٌ يفعله فهو محاضرةٌ لا محور.">
                    <textarea rows={2} value={m.activityAr ?? ""} onChange={(e) => setModule(i, { activityAr: e.target.value })} disabled={locked} aria-label={`تطبيق المحور ${i + 1}`} className={areaCls} />
                  </StaffField>
                  <StaffField label="ما يُسلّمه المتعلّم (اختياريّ)" hint="إن ذكرتَ مُسلَّما هنا فاجعل له مهمّةً في خطوة «المهامّ والتطبيق العمليّ» — وإلّا فلا سبيل لتسليمه.">
                    <input value={m.artifactAr ?? ""} onChange={(e) => setModule(i, { artifactAr: e.target.value })} disabled={locked} aria-label={`مُسلَّم المحور ${i + 1}`} className={controlCls} />
                  </StaffField>
                  <StaffField label="المحتوى النظريّ" hint="الشرحُ المكتوب الذي يقرؤه المتعلّم داخل المنصّة — ابدأ كلَّ درسٍ بعنوانٍ من الشريط، فالمحتوى يُقسَّم عنده دروسا. و«عايِنْ» تريكه كما يراه هو. والروابطُ والملفّاتُ موضعُها «المصادر». ويلزم لاعتماد الشعبة — لا لحفظها.">
                    <BodyEditor
                      value={m.bodyAr ?? ""}
                      onChange={(next) => setModule(i, { bodyAr: next })}
                      disabled={locked}
                      ariaLabel={`المحتوى النظريّ للمحور ${i + 1}`}
                      /* ═══ سطحُ كتابةٍ بقَدرِ ما يُكتب فيه ═══

                         طلب صاحبُ المنصّة سطحا «بسعة صفحة Word ليرى ما
                         يكتب». وكانت ستّةُ أسطرٍ نافذةً يُمرَّر فيها متنٌ
                         متوسّطُه ٢٣ ألفَ حرفٍ في الكتالوج — فلا يرى كاتبُه
                         ما قبله ولا ما بعده وهو يكتب. */
                      rows={20}
                    />
                    <ModuleBodyUpload
                      cohortId={ws.cohort.id}
                      refId={m.moduleId}
                      value={m}
                      onChange={(next) => setModule(i, next)}
                      disabled={locked}
                      label="أو أرفِق ملفّا بدلا من الكتابة"
                    />
                  </StaffField>
                </div>
                )}
              </Card>
              );
            })}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            {/* المعرّفُ من أكبرِ ما أُعطي لا من الطول — فلا يرث محورٌ جديدٌ
                معرّفَ محذوف. الشرحُ في `application/trainer/plan-modules`. */}
            <Button tone="secondary" disabled={locked} onClick={() => {
              const moduleId = nextTrainerModuleId(ws.course.id, content.modules);
              setContent({ ...content, modules: [...content.modules, { moduleId, titleAr: "" }] });
              setOpenModule(moduleId);
            }}>+ محور</Button>
            <Button tone="confirm" disabled={busy || locked || !dirty.modules || content.modules.some((m) => m.titleAr.trim().length < 2)} onClick={savePlan}>احفظ المحاور</Button>
          </div>
        </Panel>
      )}

      {/* ─────────── ③ المصادر ─────────── */}
      {phase === "prepare" && stage === "resources" && (
        <div className="space-y-5">
        <Panel as="section">
          <StageIntro stage="resources" />
          {/* ═══ ثلاثةُ أصنافٍ لا قائمةُ أنواعٍ لكلّ صفّ ═══

              كانت الصفحةُ صفوفا متشابهةً في كلٍّ منها قائمةُ أنواعٍ من ستّة
              يختار منها المدرّبُ بنفسه — «عشوائيّة» كما سمّاها صاحبُ المنصّة
              (١٥ سبتمبر ٢٠٢٦). فيختلف ترتيبُ شعبتين لمدرّبٍ واحد، ولا يعرف
              المتعلّمُ أين يبحث.

              فصارت ثلاثَ خاناتٍ لكلٍّ بابُها: المسجَّلُ بتاريخ فتحه، والكتبُ
              بهدفها، والعامُّ بلا شرط. والنوعُ يُشتقّ من الصنف فلا يُسأل. */}
          <div className="mt-4 space-y-5">
            {RESOURCE_CATEGORIES.map((cat) => {
              const meta = RESOURCE_CATEGORY_META[cat];
              /* الموضعُ الأصليُّ يُحمل مع الصفّ: التعديلُ والحذفُ يقعان على
                 المصفوفة الواحدة، والترشيحُ يعيد ترقيما لا يطابقها. */
              const rows = content.resources
                .map((r, i) => ({ r, i }))
                .filter(({ r }) => resourceCategory(r) === cat);
              return (
                <section key={cat}>
                  <h4 className="flex items-center gap-2 text-read font-black text-foreground">
                    <meta.icon className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" /> {meta.label}
                  </h4>
                  <p className="mt-1 text-read leading-6 text-muted-foreground">{meta.hint}</p>
                  <ul className="mt-3 space-y-3">
                    {rows.map(({ r, i }) => {
                      const patch = (next: Partial<PlanResource>) =>
                        setContent({ ...content, resources: content.resources.map((x, j) => (j === i ? { ...x, ...next } : x)) });
                      return (
                        <Card as="li" key={i} className="grid gap-3">
                          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                            <input value={r.title} onChange={(e) => patch({ title: e.target.value })} disabled={locked} placeholder={meta.titlePlaceholder} aria-label={`اسم المصدر ${i + 1}`} className={controlCls} />
                            {/* المرفوعُ حيث يُرفَع، والمُلصَقُ حيث يُلصَق —
                                والصنفُ يقرّر أيُّهما، لا قائمةٌ يختار منها. */}
                            {cat === "reading" ? (
                              <ModuleBodyUpload
                                cohortId={ws.cohort.id}
                                purpose="plan_resource"
                                refId={`r${i}`}
                                value={r}
                                onChange={(next) => patch(next)}
                                disabled={locked}
                                label="ارفع الملفّ"
                                hint="PDF وصورةٌ يُقرآن في الصفحة، وWord وشرائحُ وجداولُ تُنزَّل. أو ألصِق رابطا بدلَه."
                              />
                            ) : (
                              <input dir="ltr" value={r.url ?? ""} onChange={(e) => patch({ url: e.target.value })} disabled={locked} placeholder="https://…" aria-label={`رابط المصدر ${i + 1}`} className={`${controlCls} text-left`} />
                            )}
                            <Button tone="ghost" size="sm" disabled={locked} onClick={() => setContent({ ...content, resources: content.resources.filter((_, j) => j !== i) })}>أزل</Button>
                          </div>
                          {/* والرابطُ يبقى متاحا للكتب كذلك — كتابٌ على الشبكة لا يُرفَع */}
                          {cat === "reading" && (
                            <input dir="ltr" value={r.url ?? ""} onChange={(e) => patch({ url: e.target.value })} disabled={locked} placeholder="أو رابطٌ إليه — https://…" aria-label={`رابط المصدر ${i + 1}`} className={`${controlCls} text-left`} />
                          )}
                          <input
                            value={r.noteAr ?? ""}
                            onChange={(e) => patch({ noteAr: e.target.value })}
                            disabled={locked}
                            maxLength={500}
                            placeholder={meta.notePlaceholder}
                            aria-label={`وصف المصدر ${i + 1}`}
                            className={controlCls}
                          />
                          {/* ═══ «ويحدّد متى تفتح للطالب طيلةَ الفصل» ═══

                              للمسجَّل وحدَه: جلسةٌ تدريبيّةٌ تُفتح في أسبوعها
                              لا مع أوّل يوم. والفارغُ يعني «مفتوحةٌ من البداية»
                              — لا «مغلقةٌ أبدا». */}
                          {cat === "recorded" && (
                            <StaffField label="متى تُفتح للمتعلّم" hint="اتركه فارغا لتُفتح مع أوّل يومٍ في الفصل. وقبل موعده لا تصل المتعلّمَ أصلا.">
                              <input
                                type="date" dir="ltr"
                                value={r.opensAt ? r.opensAt.slice(0, 10) : ""}
                                min={ws.cohort.term ? ws.cohort.term.startsOn.slice(0, 10) : undefined}
                                max={ws.cohort.term ? ws.cohort.term.endsOn.slice(0, 10) : undefined}
                                onChange={(e) => patch({ opensAt: e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : null })}
                                disabled={locked}
                                aria-label={`متى يُفتح المصدر ${i + 1}`}
                                className={`${controlCls} text-left`}
                              />
                            </StaffField>
                          )}
                        </Card>
                      );
                    })}
                  </ul>
                  <Button
                    tone="secondary" size="sm" className="mt-3" disabled={locked}
                    onClick={() => setContent({
                      ...content,
                      resources: [...content.resources, { title: "", url: "", category: cat, kind: kindForCategory(cat, false) }],
                    })}
                  >
                    {meta.addLabel}
                  </Button>
                </section>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {/* والمرفوعُ لا يُشترط له رابط: شرطُ `https://` كان يمنع حفظَ
                مصدرٍ ملفُّه في المخزن — فيُرفع ثمّ لا يُحفظ. */}
            <Button tone="confirm" disabled={busy || locked || !dirty.resources || content.resources.some((r) => !r.title.trim() || !resourceHasSource(r))} onClick={savePlan}>احفظ المصادر</Button>
          </div>
        </Panel>

        {/* ═══ و«موادُّ الشعبة» حُذفت كلّيّا (١٥ سبتمبر ٢٠٢٦) ═══

            كانت لوحةً ثانيةً تحت المصادر ترفع ملفّاتٍ لا تمرّ باعتماد.
            وقال صاحبُ المنصّة: «لا داعيَ لخانة مواد الشعبة كلّيّا».

            وما كانت تحمله له بابُه الآن: ملفٌّ للمتعلّم يُرفع في «كتبٌ
            وملفّات» ويمرّ بالاعتماد كسائر المصادر، وملفُّ لقاءٍ بعينه
            يُرفق باللقاء في خطوته. ولوحتان ترفعان ملفّاتٍ للمتعلّم
            إحداهما محروسةٌ والأخرى لا — بابٌ حول الاعتماد لا خانةُ راحة. */}
        </div>
      )}

      {/* ─────────── ④ اللقاءات المباشرة ─────────── */}
      {phase === "prepare" && stage === "sessions" && (
        <div className="space-y-5">
          <Panel as="section"><StageIntro stage="sessions" /></Panel>

          {/* الجدولةُ بيده داخلَ أشهر فصله، والاعتمادُ بيد الإدارة */}
          <TrainerSchedule
            cohortId={ws.cohort.id}
            onDone={() => void load()}
            minSessions={Math.max(1, content.modules.length)}
            haveSessions={ws.sessions.length}
          />

          {/* واللقاءاتُ المجدولةُ وحضورُها — انتقلت من «التشغيل» (د-٤). من
              جدول لقاءه يرى في الموضع نفسِه ما جدوله ومن حضره. */}
          <SessionsAndAttendance cohortId={ws.cohort.id} />

          {/* ═══ وسقطت «ملاحظاتٌ عن اللقاءات المباشرة» من هنا (١٥ سبتمبر ٢٠٢٦) ═══

              كانت خانةً واحدةً لكلّ لقاءات الشعبة: «ما تودّ أن يعرفه المتعلّم
              عن أسلوب لقاءاتك». وقال صاحبُ المنصّة: «لا داعيَ لوجود ملاحظاتٌ
              عن اللقاءات المباشرة (اختياريّ) بالأسفل» — وصارت **لكلّ لقاءٍ
              على حدة** في نموذج إنشائه.

              وملاحظةٌ واحدةٌ عن عشرة لقاءاتٍ تُكتب عامّةً فلا تقول شيئا عن
              أيٍّ منها؛ ومن أراد أن يقول «هذا اللقاء يُسجَّل وذاك لا» لم يكن
              يملك أين يقوله. */}
        </div>
      )}

      {/* ─────────── ⑤ التكاليف ─────────── */}
      {phase === "prepare" && stage === "assignments" && (
        <div className="space-y-5">
        <Panel as="section">
          <StageIntro stage="assignments" />
          {ws.assessments.length === 0 ? (
            <p className="mt-3 text-read text-muted-foreground">لا مهمّةَ في هذه الشعبة بعد — وما تؤلّفه أدناه يظهر هنا.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {ws.assessments.map((a) => (
                <Inset as="li" key={a.id} className={editingId === a.id ? "ring-1 ring-teal/50" : undefined}>
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-read font-bold text-foreground">{a.title}</p>
                      {/* التعليماتُ تُرى في القائمة: من يراجع تكاليفَه قبل الإرسال
                          يقرأ ما سيقرؤه المتعلّم، لا عنوانا وحدَه. */}
                      {a.briefAr
                        ? <p className="mt-1 whitespace-pre-line text-read leading-6 text-muted-foreground">{a.briefAr}</p>
                        : <p className="mt-1 text-read text-gold-ink">بلا تعليمات — المتعلّم يرى العنوانَ وحدَه</p>}
                      <p className="mt-1 text-read text-muted-foreground">
                        {ASSESSMENT_TYPES[a.type] ?? a.type} · من {a.maxScore}
                        {a.dueAt && <> · يُسلَّم قبل {fmtDateTimeAr(a.dueAt)}</>}
                        {" · "}سلّم {a.submissions}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button tone="ghost" size="sm" disabled={busy} onClick={() => editAssessment(a)}>عدّل</Button>
                      {/* ما سُلّم فيه لا يُحذف — والسببُ يُقال قبل النقر لا بعده */}
                      <Button
                        tone="ghost" size="sm"
                        disabled={busy || a.submissions > 0}
                        title={a.submissions > 0 ? "سلّم فيه متعلّمون — أغلِقه بدل حذفه" : undefined}
                        onClick={() => setPendingDelete(a)}
                      >احذف</Button>
                    </div>
                  </div>
                </Inset>
              ))}
            </ul>
          )}

          {/* ── نموذجٌ واحدٌ: يؤلّف تكليفا أو يعدّل واحدا قائما — وينسدل ── */}
          <div className="mt-5 border-t border-white/10 pt-4">
            {!taskFormOpen ? (
              <Button tone="secondary" disabled={locked} onClick={() => setTaskFormOpen(true)}>
                + مهمّةٌ جديدة
              </Button>
            ) : (
              <>
            <button
              type="button"
              onClick={cancelEdit}
              aria-expanded
              className="flex w-full items-center justify-between gap-2 text-start"
            >
              <span className="text-read font-black text-foreground">
                {editingId ? "تعديلُ المهمّة" : "مهمّةٌ جديدة"}
              </span>
              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
            <div className="mt-3 grid gap-3">
              <label className="block">
                <span className="block text-read font-bold text-foreground">العنوان</span>
                <span className="mt-0.5 mb-2 block text-read leading-6 text-muted-foreground">يظهر في قائمة مهامّ المتعلّم وفي طابور تقييمك.</span>
                <input aria-label="عنوان المهمّة" placeholder="عنوان الواجب أو المشروع" value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} className={controlCls} />
              </label>
              <label className="block">
                <span className="block text-read font-bold text-foreground">التعليمات</span>
                <span className="mt-0.5 mb-2 block text-read leading-6 text-muted-foreground">ما يفعله بالضبط، ومقدارُه، وما يُسلَّم. العنوانُ وحدَه لا يكفي للعمل.</span>
                <textarea rows={3} aria-label="تعليمات المهمّة" value={taskForm.briefAr}
                  placeholder="اذكر المطلوبَ ومقدارَه وما يُسلَّم — فالعنوانُ وحدَه لا يكفي للعمل."
                  onChange={(e) => setTaskForm({ ...taskForm, briefAr: e.target.value })} className={areaCls} />
              </label>
              {/* مرفقاتُ التكليف — نموذجٌ يُملأ أو مرجعٌ يُقرأ قبل التسليم */}
              <div className="block">
                <span className="block text-read font-bold text-foreground">المرفقات</span>
                <span className="mt-0.5 mb-2 block text-read leading-6 text-muted-foreground">نموذجٌ يملؤه، أو مرجعٌ يقرؤه قبل التسليم. يراها المتعلّمُ تحت التعليمات بنوعِ كلٍّ منها.</span>
                <ul className="space-y-2">
                  {taskAttachments.map((att, i) => {
                    const patch = (next: Partial<PlanResource>) =>
                      setTaskAttachments(taskAttachments.map((x, j) => (j === i ? { ...x, ...next } : x)));
                    return (
                      <li key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                        <input value={att.title} onChange={(e) => patch({ title: e.target.value })} placeholder="اسم المرفق" aria-label={`اسم المرفق ${i + 1}`} className={controlCls} />
                        <input dir="ltr" value={att.url ?? ""} onChange={(e) => patch({ url: e.target.value })} placeholder="https://…" aria-label={`رابط المرفق ${i + 1}`} className={`${controlCls} text-left`} />
                        <select value={resourceKind(att.kind)} onChange={(e) => patch({ kind: e.target.value })} aria-label={`نوع المرفق ${i + 1}`} className={controlCls}>
                          {RESOURCE_KINDS.map((k) => (<option key={k} value={k}>{RESOURCE_META[k].label}</option>))}
                        </select>
                        <Button tone="ghost" size="sm" onClick={() => setTaskAttachments(taskAttachments.filter((_, j) => j !== i))}>أزل</Button>
                      </li>
                    );
                  })}
                </ul>
                <Button tone="ghost" size="sm" className="mt-2" onClick={() => setTaskAttachments([...taskAttachments, { title: "", url: "", kind: "link" }])}>+ مرفق</Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="block text-read font-bold text-foreground">النوع</span>
                    <span className="mt-0.5 mb-2 block text-read leading-6 text-muted-foreground">«واجب» يُسلَّم مرّة، و«اختبار» له درجة، و«مشروع تخرّج» يُحتسب في الإكمال.</span>
                  <select aria-label="نوع المهمّة" value={taskForm.type} onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value })} className={`${controlCls} [&>option]:bg-surface`}>
                    {Object.entries(ASSESSMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-read font-bold text-foreground">الدرجة العظمى</span>
                    <span className="mt-0.5 mb-2 block text-read leading-6 text-muted-foreground">عليها تُحسب نسبتُه. لا تُخفَض بعد رصد درجةٍ أعلى منها.</span>
                  <input type="number" min={1} dir="ltr" aria-label="الدرجة العظمى" value={taskForm.maxScore}
                    onChange={(e) => setTaskForm({ ...taskForm, maxScore: Math.max(1, Number(e.target.value) || 1) })}
                    className={`${controlCls} text-left`} />
                </label>
                <label className="block">
                  <span className="block text-read font-bold text-foreground">آخر موعد</span>
                    <span className="mt-0.5 mb-2 block text-read leading-6 text-muted-foreground">بعده يظهر المتعلّم في «من يحتاج تدخّلك» إن لم يسلّم.</span>
                  <input type="date" dir="ltr" aria-label="آخر موعد للتسليم" value={taskForm.dueAt}
                    onChange={(e) => setTaskForm({ ...taskForm, dueAt: e.target.value })} className={`${controlCls} text-left`} />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button tone="confirm" disabled={busy || taskForm.title.trim().length < 3} onClick={saveAssessment}>
                  {editingId ? "احفظ التعديل" : "أكِّدِ المهمّة"}
                </Button>
                {/* والإلغاءُ يُطوى بالانسدال: من فتحه ليجرّب يغلقه بلا أثر */}
                <Button tone="ghost" disabled={busy} onClick={cancelEdit}>
                  {editingId ? "أَلْغِ التعديل" : "أغلِق"}
                </Button>
              </div>
            </div>
              </>
            )}
          </div>
        </Panel>

        {/* ما سُلّم وما ينتظر — انتقلت من «التشغيل» (ع-١). من كتب المهمّةَ
            يرى تحتها من استجاب لها، بالمقام الصحيح لا بعدد قائمة الانتظار. */}
        <CohortSubmissions cohortId={ws.cohort.id} />
        </div>
      )}

      {pendingModule && (
        <ConfirmAction
          titleAr="حذفُ المحور"
          confirmLabelAr="احذفه من خطّتي"
          onCancel={() => setPendingModule(null)}
          onConfirm={() => {
            setContent({ ...content, modules: content.modules.filter((_, j) => j !== pendingModule.index) });
            setPendingModule(null);
          }}
        >
          <p className="text-read leading-7">
            يُرفع «{pendingModule.module.titleAr || `المحور ${pendingModule.index + 1}`}» من خطّة هذه الشعبة،
            ومعه مخرَجُه وتطبيقُه ومتنُه. ولا يقع شيءٌ حتّى تحفظ المحاور.
          </p>
          {/* محورُ الكتالوج يبقى في الدورة — والفرقُ يُقال كي لا يُظنَّ محوَه منها */}
          {isCatalogModule(pendingModule.module.moduleId, ws.course.baseModules) && (
            <Inset tone="warn" className="mt-3 text-read leading-6 text-gold-ink">
              هذا محورٌ من الكتالوج — حذفُه من خطّتك لا يحذفه من الدورة نفسِها، ويظلّ محسوبا في تقدّم المتعلّم.
            </Inset>
          )}
        </ConfirmAction>
      )}

      {pendingDelete && (
        <ConfirmAction
          titleAr="حذفُ المهمّة"
          confirmLabelAr="احذفه"
          busy={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => { const a = pendingDelete; setPendingDelete(null); void deleteAssessment(a); }}
        >
          <p className="text-read leading-7">
            يُحذف «{pendingDelete.title}» من الشعبة فلا يراه المسجّلون بعد الآن. ولا تسليمَ فيه، فلا عملَ لأحدٍ يضيع.
          </p>
        </ConfirmAction>
      )}

      {/* ─────────── ⑥ الاعتماد ─────────── */}
      {phase === "prepare" && stage === "approval" && (
        <Panel as="section" tone={st.tone}>
          <StageIntro stage="approval" />
          <p className="mt-2 text-read leading-7 text-foreground">
            بإرسالك تقرّ أنّك راجعتَ كلَّ ما في الشعبة ووافقتَ عليه: اسمَها ومواعيدَها، ومحاورَها وتطبيقَها العمليّ، ومصادرَها، ومواعيدَ لقاءاتها المباشرة، ومهامَّها، وجلساتِها المسجّلة إن وُجدت. ثمّ يعتمدها المديرُ الأكاديميُّ أو المديرُ الأعلى — ويصلك القرارُ هنا وبالبريد.
          </p>
          {ws.plan?.submittedAt && <p className="mt-2 text-read text-muted-foreground">آخرُ إرسال: {fmtDateTimeAr(ws.plan.submittedAt)}{ws.plan.reviewedAt ? ` · آخرُ قرار: ${fmtDateTimeAr(ws.plan.reviewedAt)}` : ""}</p>}
          {/* والباقي يُسمّى بأسمائه لا بعدد: «بقي ١» تركت المدرّبَ يفتح
              المراحلَ واحدةً واحدةً ليجد أيَّها — وكان الواحدُ الباقي هو هذه
              المرحلةَ نفسَها فلا يجده أبدا. */}
          {remaining > 0 && !approved && (
            <Inset tone="warn" className="mt-3 text-read leading-6 text-gold-ink">
              بقي قبل الإرسال: {blocking.map((b) => b.labelAr).join(" · ")}
              {/* والزرُّ يفتح أوّلَ ما **هو** فاعلُه: في الباقي صفوفٌ بيدِ
                  الإدارة (تسميةُ الفصل)، وزرٌّ يقود إلى خطوةٍ لا وجودَ لها
                  يترك الشاشةَ بيضاءَ ويبدو عطبا. */}
              {firstMine && (
                <Button tone="ghost" size="sm" className="mt-2" onClick={() => openStage(firstMine.key as Stage)}>
                  افتح أوّلَها
                </Button>
              )}
            </Inset>
          )}
          {/* ═══ ولماذا تُسمّى المحاورُ الناقصةُ بأسمائها ═══

              «المحتوى النظريّ» صار شرطا للاعتماد (د-١). وشرطٌ يقول «ينقص
              شيءٌ» بلا أن يقول **ما هو** يترك المدرّبَ يفتح ثمانيةَ محاورَ
              واحدا واحدا ليجد أيَّها الناقص — وهو بعينه ما شُكي منه في
              مواضعَ أخرى. فتُذكر أرقامُها وعناوينُها، ويُفتح منها الأوّل
              بنقرة. */}
          {!approved && missingBody.length > 0 && (
            <Inset tone="warn" className="mt-3 text-read leading-6 text-gold-ink">
              ينقص المحتوى النظريُّ في {missingBody.length === 1 ? "محورٍ واحد" : `${missingBody.length} محاور`}:{" "}
              {missingBody.map((m) => `${m.n}. ${m.titleAr || "بلا عنوان"}`).join(" · ")}
              <Button
                tone="ghost" size="sm" className="mt-2"
                onClick={() => { setStage("modules"); setOpenModule(missingBody[0].moduleId); }}
              >
                افتح أوّلَها
              </Button>
            </Inset>
          )}
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-read leading-6">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} disabled={locked || approved} className="mt-1 h-4 w-4 accent-teal" />
            <span>أوافق على كلّ ما في هذه الشعبة — مواعيدَها ومحاورَها ومصادرَها ولقاءاتِها ومهامَّها وتسجيلاتِها — وأتحمّل تقديمَها كما هي.</span>
          </label>
          <Button tone="primary" disabled={busy || locked || !confirm || remaining > 0 || approved} onClick={submit} className="mt-4">
            <Send className="h-4 w-4" /> أرسلها للاعتماد
          </Button>
        </Panel>
      )}

      {/* ═══ التشغيل ═══ */}
      {phase === "run" && (
        <div className="space-y-5">
          {/* ═══ ورابطُ الدعوة خرج من هنا (١٥ سبتمبر ٢٠٢٦) ═══

              كان بطاقةً في رأس «مركز التواصل»، فيراها المدرّبُ في شعبةٍ
              ولا يجد في يده روابطَ شعبه الأخرى إلّا بفتح كلِّ واحدةٍ على
              حدة. وقرارُ صاحب المنصّة: تُجمع كلُّها في «دعوتي» خارجَ الشعب
              — رابطُ حسابه الكاملُ ورابطُ كلّ شعبةٍ مفتوحةٍ بجانبه.

              ولا يُترك مركزُ التواصل يحمل نسخةً ثانية: رابطان لشيءٍ واحدٍ
              في شاشتين يفترقان يوما، ومن نسخ أحدَهما لا يدري أيَّهما نسخ. */}
          <CohortOps cohortId={ws.cohort.id} />
        </div>
      )}
    </TrainerLayout>
  );
}
