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

   ═══ ثمّ صار الشريطُ سلّما يُصعد درجةً درجة (٢٧ سبتمبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «مراحلُ تعديل الشعبة معقّدة، يجب أن تظهر بشريطٍ
   واضح، والمرحلةُ الأولى هي تعديلُ المعلومات الأساسيّة للشعبة وليس زرَّ
   القلم… موضّحةً بشريطٍ سهلٍ معرفةُ أين وصل. زرُّ التالي يجب أن يكون مضاءً
   لأنّه الأهمّ هنا، ولا ينتقل للتالي إلّا بعد أن يتمّ النقطةَ السابقة
   ويقوم: تمّ وحفظ».

   فصار:
   · **ستُّ درجاتٍ بأسمائها** — والأولى «المعلومات الأساسيّة»: الاسمُ والنبذةُ
     ومدّةُ الشعبة من متى إلى متى. بلا قلمٍ ولا لوحةٍ تنبثق، وبلا سعر.
   · **وزرٌّ واحدٌ مضاءٌ في الشريط: «احفظ وتابِع»** — يحفظ الخطوة، ثمّ يسأل
     الخادمَ أتمّت: فإن تمّت انتقل، وإلّا بقي وسمّى ما ينقص بأسمائه.
   · **وما بعد أوّلِ درجةٍ لم تتمّ مقفل**: يُرى اسمُه ولا يُفتح — فالترتيبُ
     قاعدةٌ لا اقتراح. وما تمّ قبلها يُعاد إليه متى شاء.

   ═══ ثلاثةُ حرّاسٍ تحكم الشكل ═══

   • `staff-surface`: المتنُ أربعةَ عشر — `text-read` لا `text-xs` في فقرة.
   • `design-system`: لا سطحَ مكتوبا بيده — `Panel` و`Card` و`Inset` وحدَها.
   • `one-primary-per-screen`: ذهبيٌّ واحد — زرُّ الشريط، يقول «احفظ وتابِع»
     في الدرجات و«أرسِلها للاعتماد» في آخرها. زرٌّ واحدٌ يتبدّل اسمُه، لا
     زرّان يتنازعان العين. */

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft, ArrowRight, BookMarked, BookOpen, CalendarDays, CalendarPlus, Check, ChevronDown, ChevronUp, ClipboardCheck, FileText, GraduationCap, Film, IdCard, Link2, Loader2, Lock, Send, Sparkles,
} from "lucide-react";
import TrainerLayout from "./TrainerLayout";
import TrainerSchedule from "./TrainerSchedule";
import SessionsAndAttendance from "./SessionsAndAttendance";
import SlotSessions from "./SlotSessions";
import CohortSubmissions from "./CohortSubmissions";
import { apiGet, apiPatch, apiPost, apiPut, apiDelete, ApiError } from "@/services/api";
import ConfirmAction from "@/components/ConfirmAction";
import { nextTrainerModuleId, moveModule, isCatalogModule } from "@/application/trainer/plan-modules";
import { RESOURCE_KINDS, RESOURCE_CATEGORIES, readTypedLinks, resourceKind, resourceCategory, kindForCategory } from "@/application/trainer/plan-overlay";
import type { ResourceCategory } from "@/application/trainer/plan-overlay";
import { X } from "lucide-react";
import { RESOURCE_META } from "@/components/resource-kind-meta";
import BodyEditor from "@/components/BodyEditor";
import TabBar from "@/components/ui/TabBar";
import ModuleBodyUpload from "@/components/ModuleBodyUpload";
import { moduleBodyDone, resourceHasSource } from "@/application/trainer/module-body";
import { blockingBeforeSubmit, sendBlock, trainerOwned } from "@/application/trainer/plan-gate";
import { notedSections, notesForTrainer, type ReviewNotes } from "@/application/trainer/review-notes";
import { trainerRegistrationLine } from "@/application/learning/registration-state";
import { ReviewNotesBanner, StageReviewNote } from "@/components/ReviewNotes";
import { toast, toastError } from "@/components/Toast";
import { Panel, Bar, Card, Inset } from "@/components/ui/Surface";
import { PREP_NOTICE_AR, usePrepCohorts } from "@/components/trainer/usePrepCohorts";
import { ORIENTATION_BOOKING_URL, ORIENTATION_CTA_AR } from "@/application/trainer/orientation-session";
import Button from "@/components/ui/Button";
import { controlCls, areaCls, StaffField } from "@/components/FormKit";
import { fmtDateTimeAr } from "@/utils/format";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { asPeriod, periodDays, periodProblem, zonedDay, zonedInstant } from "@/application/trainer/cohort-period";
import {
  appendToSlots, axesLabelAr, canMerge, dayLabelAr, defaultSlots, dropFromSlots, joinClosesAt, mergeSlots, reflowSlots,
  cohortWorkbookProblems, sessionProblems, slotIndexOf, slotProblems, splitSlot, workbookDone, workbookWhere,
  WORKBOOK_WHERE_MAX, type CohortWorkbook, type PlanSlot,
} from "@/application/trainer/axis-timeline";
import { countAr } from "@/application/text/count-ar";
import CurriculumReview from "@/components/CurriculumReview";
import { curriculumView } from "@/application/trainer/curriculum-view";
import { PlanDiffList } from "@/components/PlanDiff";
import { planDiff } from "@/application/trainer/plan-diff";
import Chip from "@/components/ui/Chip";
import {
  TASK_REVIEW_TRAINER_AR, changeLines, proposedTask, readTaskChange, taskReview, taskValues, type TaskValueFormat,
} from "@/application/trainer/task-approval";

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
  /* محورُه ومتى يُفتح (٢٧ سبتمبر ٢٠٢٦): بعد لقاء محوره، أو مع كرّاسته إن كان للقراءة المسبقة */
  moduleId?: string | null; preReading?: boolean | null;
}
/* ما بقي من صندوق «اقتراحٌ للإدارة» المحذوف (د-٦): خطّةٌ حُفظت قبل حذفه قد
   تحمل `proposals` في عمود JSON. يُقرأ منه اسمُ الدورة وحدَه ليُعرض مهيّأً في
   القناة الجديدة، فلا يضيع ما كتبه مدرّبٌ بيده. ولا يُكتب من هنا أبدا.
   واسمُ المسار سقط ولم يُقرأ: لا قناةَ له — المدرّبُ يبني مسارَه هو (القسم «ن»). */
interface LegacyPlanProposals { courseTitleAr?: string | null }
/** الفصلُ الدراسيّ — حدودُه هي حدودُ الشعبة ونافذةُ جدولتها */
interface Term { id: string; titleAr: string; season: string; year: number; startsOn: string; endsOn: string; status: string }
interface PlanContent {
  kind: "trainer"; summaryAr?: string | null; modules: PlanModule[]; resources: PlanResource[]; liveNoteAr?: string | null; proposals?: LegacyPlanProposals | null;
  /* مدّةُ الشعبة — تاريخان بلا ساعة، تُعتمَد مع الخطّة (٢٧ سبتمبر ٢٠٢٦) */
  startsOn?: string | null; endsOn?: string | null;
  /* مواعيدُ المحاور وكرّاساتُها — `application/trainer/axis-timeline.ts` */
  slots?: PlanSlot[] | null;
  /* كرّاسةُ الشعبة — واحدةٌ للمحاور كلِّها، وأين يبدأ كلُّ محورٍ فيها (٣٠ سبتمبر ٢٠٢٦) */
  workbook?: CohortWorkbook | null;
}
/** مدّةٌ كما يرسلها الخادم — تاريخان `YYYY-MM-DD` */
interface Period { startsOn: string; endsOn: string }
interface Workspace {
  role: string;
  trainer: { name: string };
  cohort: {
    id: string; title: string; status: string; startsAt: string | null; endsAt: string | null; daysOfWeek: string[];
    startTime: string | null; timezone: string | null; language: string; deliveryMode: string;
    termId: string | null; term: Term | null;
    /* مدّتُه كما تُحكَم، والمعلَنةُ للمسجَّلين الآن — تُقالان معا إن افترقتا */
    period: Period | null; publicPeriod: Period | null;
    /* وعلمُ التسجيل — يُقرأ ولا يُكتب؛ منه تقول خطوتُه الأخيرةُ متى تُفتح (٣ أكتوبر ٢٠٢٦) */
    readOnly: { price: number | null; currency: string; capacity: number | null; registrationOpen?: boolean };
  };
  course: { id: string; titleAr: string; baseModules: PlanModule[] };
  plan: {
    id: string; status: string; content: PlanContent | null; reviewerNote: string | null;
    /* لكلّ خطوةٍ ملاحظتُها — والقديمُ نصٌّ واحدٌ يصل ملاحظةً عامّة (٣ب) */
    reviewerNotes?: ReviewNotes;
    submittedAt: string | null; trainerConfirmedAt: string | null; reviewedAt: string | null;
  } | null;
  sessions: { id: string; title: string; startsAt: string; endsAt: string | null; status: string; approvalState?: string; moduleIds?: string[]; placeholder: boolean; joinUrl: string | null; recordings: { id: string; title: string; externalUrl: string | null; readUrl: string | null }[] }[];
  materials: { id: string; title: string; kind: string; externalUrl: string | null; readUrl: string | null }[];
  learners: { enrollmentId: string; name: string; status: string; progress: number; referredByMe: boolean }[];
  assessments: { id: string; title: string; briefAr: string | null; attachments?: unknown; type: string; maxScore: number; dueAt: string | null; status: string; moduleId?: string | null; submissions: number; pendingChange?: unknown; reviewerNote?: string | null }[];
  /* اعتُمدت له خطّةٌ قطّ — فما يضيفه ويعدّله ويحذفه من مهامّه ينتظر الإدارة (٣ج-٣) */
  approvedOnce?: boolean;
  /* والمعتمَدةُ التي يراجعها إن كانت أحدثُ خطّته مراجعة — منها «ما غيّرتَه» (٣ج-٤) */
  approvedPlan?: { content: unknown; reviewedAt: string | null } | null;
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

/* ═══ المراحلُ ستٌّ، وأولاها المعلوماتُ الأساسيّة (٢٧ سبتمبر ٢٠٢٦) ═══

   كانت ستًّا وأولاها «الاسمُ والمواعيد»، ثمّ انطوت الأولى (ق٧ · ١٧ سبتمبر
   ٢٠٢٦) إلى بابٍ في اسم الشعبة يُفتح بقلم: لم يبقَ فيها قرار — اسمٌ ونبذة،
   والمواعيدُ حدودُ فصلٍ تسمّيه الإدارة.

   ثمّ عاد فيها القرارُ الأكبر: **مدّةُ الشعبة من متى إلى متى** صارت للمدرّب
   (قرارُ صاحب المنصّة، ٢٧ سبتمبر ٢٠٢٦) — «وهي الفترةُ المخصّصة للّقاءات
   المباشرة ومدّةُ رؤية المتعلّمين موارده». ودرجةٌ فيها قرارٌ تُصعد لا تُفتح
   بقلم: «المرحلةُ الأولى هي تعديلُ المعلومات الأساسيّة للشعبة وليس زرَّ
   القلم».

   والمفاتيحُ مفاتيحُ قائمة الخادم، فحالةُ كلٍّ (تمّ / لم يتمّ) تُقرأ من هناك
   لا تُخمَّن هنا. والأسماءُ قصيرةٌ لتُرى كلُّها في الشريط، والطويلُ في رأس
   كلّ خطوة. و«التسجيلات» الاختياريّةُ تُطوى داخل «اللقاءات». */
/* ═══ ثمّ صار الترتيبُ ترتيبَ المنهج نفسِه (٢٧ سبتمبر ٢٠٢٦) ═══

   «معلوماتٌ عن الشعبة الأساسيّة… وبعدها المحاورُ ومواعيدُها التي يجب أن
   تكون ضمن كلّ فترة الشعبة، وبعدها الكرّاساتُ لكلّ محور… بعدها اللقاءاتُ
   المسجّلة إن وُجدت… بعدها اللقاءاتُ المباشرة… وبعدها المهامُّ والواجباتُ
   وغيرُها… وبعدها المرحلةُ الأخيرة». والمسجَّلُ والمباشرُ خطوةٌ واحدة: «لا
   بأس أن جمعت بينهما لأنّهم نفسُ الأثر».

   فذهبت «المصادر» خطوةً على حدة: المسجَّلُ منها صار جلساتٍ في «اللقاءات»
   بمحاورها، والباقي صار مع المهامّ مربوطا بمحوره. وحلّت محلَّها «الكرّاسات». */
type Stage = "identity" | "modules" | "workbooks" | "sessions" | "assignments" | "approval";
/* والأسماءُ هي أسماءُ أقسام ملاحظات المعتمِد (`STAGE_LABELS` في `review-notes.ts`):
   يكتب ملاحظتَه تحت اسم الخطوة الذي يقرؤه المدرّبُ هنا — ويحرس تطابقَهما
   `review-notes.test.ts` (٣ب) */
const STAGES: { key: Stage; label: string; icon: typeof BookOpen }[] = [
  { key: "identity", label: "المعلومات الأساسيّة", icon: IdCard },
  { key: "modules", label: "المحاور ومواعيدها", icon: BookOpen },
  { key: "workbooks", label: "الكرّاسة", icon: BookMarked },
  { key: "sessions", label: "اللقاءات", icon: CalendarDays },
  { key: "assignments", label: "المهامّ والمصادر", icon: ClipboardCheck },
  { key: "approval", label: "الاعتماد", icon: Send },
];
/* والخطوةُ تتمّ بصفوفها في قائمة الخادم — و«المهامُّ والمصادر» صفّان في درجة */
const STAGE_KEYS: Record<Stage, readonly string[]> = {
  identity: ["identity"],
  modules: ["modules"],
  workbooks: ["workbooks"],
  sessions: ["sessions"],
  assignments: ["assignments", "resources", "project"],
  approval: ["approval"],
};
/** الدرجةُ التي فيها صفُّ القائمة — أو `null` لصفٍّ لا درجةَ له */
const stageOfKey = (key: string): Stage | null =>
  (STAGES.find((s) => STAGE_KEYS[s.key].includes(key))?.key ?? null);
const ASSESSMENT_TYPES: Record<string, string> = { assignment: "واجب", quiz: "اختبار", project: "مشروع تخرج" };

/* ═══ ألسنةُ «المهامّ والمصادر» وتوصياتُ كلٍّ منها (٣٠ سبتمبر ٢٠٢٦) ═══

   ولكلّ لسانٍ صفُّه في قائمة الخادم — منه حالُه على اللسان نفسِه. */
type TaskTab = "tasks" | "resources" | "project";

/** خانةُ الرابط بما يناسب نوعَ المرفق — و«ملفّ» لا رابطَ له بل رفع */
const ATTACHMENT_LINK_HINT: Record<string, { label: string; hint: string }> = {
  link: { label: "الرابط", hint: "صفحةٌ أو مقالٌ يبدأ رابطُه بـ https://" },
  video: { label: "رابطُ الفيديو", hint: "يوتيوب أو فيميو أو Google Drive — بمشاركةٍ مفتوحةٍ لمن معه الرابط." },
  book: { label: "رابطُ الكتاب", hint: "صفحةُ الكتاب أو نسختُه المفتوحة. ولرفع نسخةٍ منه اختر «ملفّ»." },
  audiobook: { label: "رابطُ الكتاب الصوتيّ", hint: "Audible أو Storytel أو ما شابهه." },
  social: { label: "رابطُ المنشور", hint: "منشورٌ أو حسابٌ على لينكدإن أو غيره." },
  file: { label: "الملفّ", hint: "" },
};
const TASK_TABS: Record<TaskTab, { label: string; key: string; tips: readonly string[] }> = {
  tasks: {
    label: "المهامّ العمليّة",
    key: "assignments",
    tips: [
      "مهمّةٌ لكلّ محورٍ على الأقلّ، مربوطةٌ به — تُفتح للمتعلّم بعد أوّل لقاءٍ لمحورها.",
      "اكتب في التعليمات ما يفعله بالضبط، ومقدارَه، وما يسلّمه — العنوانُ وحدَه لا يكفي للعمل.",
      "أرفِق نموذجا يملؤه أو مثالا محلولا: ملفّا ترفعه، أو رابطا لفيديو يشرح الطريقة.",
      "آخرُ موعدها آخرُ يومٍ في موعد محورها ما لم تحدّد غيرَه — واجعله قبل لقاء المحور التالي.",
    ],
  },
  resources: {
    label: "المصادر",
    key: "resources",
    tips: [
      "مصدرٌ أو اثنان لكلّ محورٍ يكفيان — الانتقاءُ أنفعُ للمتعلّم من القائمة الطويلة.",
      "اكتب تحت كلّ مصدرٍ سطرا يقول لماذا يقرؤه، وما الذي يبحث عنه فيه.",
      "اجعل ما يلزم قبل اللقاء «قراءةً مسبقة» — تُفتح مع أوّل يومٍ في موعد محوره.",
      "الكتابُ ملفٌّ يُرفع أو رابط، والفيديو رابطٌ (يوتيوب أو فيميو أو Drive) بمشاركةٍ مفتوحة.",
    ],
  },
  project: {
    label: "مشروع التخرّج",
    key: "project",
    tips: [
      "مشروعٌ واحدٌ يجمع محاورَ الدورة كلَّها في عملٍ حقيقيّ — لا اختبارٌ ولا تلخيص.",
      "اكتب المطلوبَ خطوةً خطوة، وما يُسلَّم في آخره (ملفٌّ أو عرضٌ أو رابط)، وكيف تقيّمه.",
      "اربطه بالمحور الأخير، واجعل موعدَه آخرَ يومٍ في الشعبة — فيبني عليه المتعلّمُ طوالَها.",
      "أرفِق نموذجا للتسليم أو مثالا مكتملا يرى منه المتعلّمُ ما يُنتظر منه.",
    ],
  },
};

/** تعليماتُ اللسان المفتوح وتوصياتُه — تحته مباشرةً، قبل ما يُكتب فيه */
function TaskTabGuide({ tab }: { tab: TaskTab }) {
  return (
    <Inset className="mt-4 text-read leading-7">
      <p className="flex items-center gap-1.5 font-black text-foreground">
        <Sparkles className="h-4 w-4 text-gold-ink" aria-hidden="true" /> تعليماتٌ وتوصيات — {TASK_TABS[tab].label}
      </p>
      <ul className="mt-1.5 list-disc space-y-1 ps-5 text-muted-foreground">
        {TASK_TABS[tab].tips.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </Inset>
  );
}

/* ═══ ما يقوله حفظُ المهمّة — بما حكم به الخادمُ لا بما ظنّته الشاشة (٣ج-٣) ═══

   بعد اعتماد الخطّة لا يصل المسجَّلين ما يُحفظ هنا حتّى تعتمده الإدارة. فرسالةٌ
   ثابتةٌ «يراه المسجّلون كما هو الآن» تكذب على من طلب تعديلا ينتظر. */
function savedTaskMsg(review: string | undefined, editing: boolean): string {
  if (review === "edit") return "أُرسل تعديلُك إلى الإدارة — ويرى المسجّلون المعتمَدَ حتّى تعتمده";
  if (review === "new") {
    return editing
      ? "حُفظت المهمّة — وما زالت تنتظر اعتمادَ الإدارة"
      : "أُضيفت المهمّة — وتنتظر اعتمادَ الإدارة، فلا يراها المسجّلون قبله";
  }
  if (review === "draft") return "حُفظت المهمّة — وتُنشر مع اعتماد خطّتك";
  return editing
    ? "حُفظ التعديل — يراه المسجّلون كما هو الآن"
    : "أُنشئت المهمّة — تظهر للمسجّلين ويعود إليك تسليمُهم في طابور المراجعة";
}
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
    title: "المعلومات الأساسيّة",
    /* وعادت تَعِد بالمدّة لأنّها فيها (٢٧ سبتمبر ٢٠٢٦): كانت قد سقطت يومَ
       صار البدءُ والانتهاءُ حدودَ فصلٍ تسمّيه الإدارة — ومقدّمةٌ تَعِد بحقلٍ
       لا وجودَ له تجعل المدرّبَ يبحث عمّا ليس هنا. واليومَ الحقلُ هنا. */
    purpose: "تعريفُ الدفعة كما يراها المتعلّمُ قبل أن يسجّل — اسمُها ونبذتُها — ومدّتُها كاملةً: من متى إلى متى. فيها تُعقد لقاءاتُك، وفيها يرى المتعلّمون موارده.",
    minutes: "نحو ثلاث دقائق",
  },
  modules: {
    title: "المحاور ومواعيدها",
    purpose: "خارطةُ ما ستدرّسه وموعدُ كلّ محورٍ داخلَ مدّة الشعبة: أوّلَ يومِ الموعد تُفتح للمتعلّم كرّاستُه ومادّتُه النظريّة. ولك أن تجمع محورين متجاورين في موعدٍ واحد ما بقيت المواعيدُ أربعةً فأكثر.",
    minutes: "نحو ١٥ دقيقة",
  },
  workbooks: {
    title: "الكرّاسة",
    purpose: "كرّاسةٌ واحدةٌ للدورة كلِّها — ملفٌّ ترفعه أو رابطٌ تلصقه — فيها المحاورُ كلُّها بترتيبها. واكتب لكلّ محورٍ أين يبدأ فيها، فيتبعها المتعلّمُ محورا محورا. وتُفتح له أوّلَ يومٍ في الشعبة.",
    minutes: "نحو ٥ دقائق",
  },
  sessions: {
    title: "اللقاءات المباشرة والمسجّلة",
    purpose: "لكلّ محورٍ لقاءٌ مباشرٌ على الأقلّ داخلَ موعده، واللقاءُ لمحورٍ أو محورين. والجلساتُ المسجّلةُ اختياريّة، تُربط بمحورها وتُفتح في لحظةٍ تحدّدها داخلَ موعده. وبعد انتهاء أوّل لقاءٍ للمحور تُفتح مهامُّه ومصادرُه.",
    minutes: "نحو ١٠ دقائق",
  },
  assignments: {
    title: "المهامّ والمصادر",
    purpose: "ثلاثةُ ألسنةٍ كلُّها إلزاميّة: المهامُّ العمليّة التي يسلّمها المتعلّمُ في كلّ محور، والمصادرُ التي يقرؤها خارجَ اللقاء، ومشروعُ التخرّج الذي يجمع الدورةَ في آخرها. لا تكون المحاضرةُ إلزاميّةً والمُخرَجُ اختياريّا.",
    minutes: "نحو ١٠ دقائق",
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


/* بصمتا المرحلتين اللتين تتقاسمان `content` — «المحاور» و«المصادر» تُحفظان
   معا في `persist`، لكنّ المدرّبَ يحرّر واحدةً في كلّ مرّة. فلو قيست
   البصمةُ على الكائن كلِّه لأضاءت المرحلتان معا بتعديلٍ في إحداهما. */
/* والمواعيدُ مع المحاور (بلا كرّاساتها)، والكرّاساتُ وحدَها، والمسجَّلُ مع
   اللقاءات، والباقي مع المهامّ — كلٌّ حيث يُحرَّر (٢٧ سبتمبر ٢٠٢٦) */
const modulesKey = (c: PlanContent) =>
  JSON.stringify({ modules: c.modules, slots: (c.slots ?? []).map((x) => ({ startsOn: x.startsOn, endsOn: x.endsOn, moduleIds: x.moduleIds })) });
const workbooksKey = (c: PlanContent) => JSON.stringify([c.workbook ?? null, (c.slots ?? []).map((x) => x.workbook ?? null)]);
const recordedKey = (c: PlanContent) => JSON.stringify(c.resources.filter((r) => resourceCategory(r) === "recorded"));
const resourcesKey = (c: PlanContent) => JSON.stringify(c.resources.filter((r) => resourceCategory(r) !== "recorded"));


/* والوصفُ صار مع الاسم والنبذة، والملاحظةُ صارت مع اللقاءات — فبصمةُ كلٍّ
   حيث صار الحقلُ لا حيث كان. ومعهما المدّةُ منذ صارت في الخطوة الأولى
   (٢٧ سبتمبر ٢٠٢٦): من غيّر تاريخا ولم يحفظ يُعلَّم كمن غيّر الاسم. */
const basicsKey = (c: PlanContent) => `${c.summaryAr ?? ""}|${c.startsOn ?? ""}|${c.endsOn ?? ""}`;
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
  const prepIds = usePrepCohorts();
  const [err, setErr] = useState("");
  const [stage, setStage] = useState<Stage>("identity");
  /* ما ينقص الخطوةَ كي تتمّ — يُقال بعد «احفظ وتابِع» حين لا تتمّ، بأسمائه لا
     بعدد، ويُمحى بأوّل محاولةٍ تالية. «لا ينتقل للتالي إلّا بعد أن يتمّ
     النقطةَ السابقة» — والمنعُ بلا سببٍ يُقال عطبٌ لا قاعدة. */
  const [gaps, setGaps] = useState<string[] | null>(null);
  /* «أرسِلها» وفي يده تعديلٌ لم يُحفظ — يُسأل قبل أن يُرسَل المحفوظُ وحدَه (٣ أكتوبر ٢٠٢٦) */
  const [unsavedAsk, setUnsavedAsk] = useState(false);
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
  const [taskForm, setTaskForm] = useState({ title: "", briefAr: "", type: "assignment", maxScore: 100, dueAt: "", moduleId: "" });
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
  /* ═══ ثلاثةُ ألسنةٍ في «المهامّ والمصادر» (٣٠ سبتمبر ٢٠٢٦) ═══

     قرارُ صاحب المنصّة: «يجب أن يكون هناك ثلاثُ تابات: للمهامّ العمليّة،
     وللمصادر، ولمشروع التخرّج — للسهولة ولكي لا ينسى أيّا منها لأنّها كلُّها
     إجباريّة». واللسانُ يحمل حالَ صفّه في قائمة الخادم، فالناقصُ يُرى قبل فتحه. */
  const [taskTab, setTaskTab] = useState<TaskTab>("tasks");
  /* التكليفُ المطلوبُ حذفُه — الحذفُ لا يقع بنقرةٍ واحدة */
  const [pendingDelete, setPendingDelete] = useState<Workspace["assessments"][number] | null>(null);
  /* والمحورُ المطلوبُ حذفُه — ومعه موضعُه، فالعناوينُ تتكرّر */
  const [pendingModule, setPendingModule] = useState<{ index: number; module: PlanModule } | null>(null);
  /* المحورُ المفتوح — واحدٌ في كلّ مرّة. والمطويُّ يُقرأ سطرا فلا تصير
     الصفحةُ جدارا من ثلاثين حقلا. */
  const [openModule, setOpenModule] = useState<string | null>(null);
  /* بصمةُ آخرِ ما حُفظ — يُقاس عليها «فيه تغييرٌ لم يُحفظ» لكلّ مرحلةٍ وحدَها.
     كانت المرحلةُ تُغادَر بتعديلٍ في يدها فيضيع بلا كلمة. */
  const [baseline, setBaseline] = useState({ identity: "", modules: "", workbooks: "", recorded: "", resources: "" });
  /* طلبُ إعادة توزيع المواعيد — يمحو ترتيبَ المدرّب فلا يقع بنقرةٍ واحدة */
  const [pendingReflow, setPendingReflow] = useState(false);
  /* ═══ «أضف» تفتح مسوّدةً لا صفًّا حقيقيّا ═══

     كانت تدفع صفًّا فارغا إلى `content.resources` فورا. وشرطُ زرِّ الحفظ
     «لا صفَّ بلا عنوانٍ ولا مصدر» يقرؤه ناقصا، **فيُقفَل الحفظُ على اللوحة
     كلِّها** — ومن ضغط «أضف» استطلاعا لا يجد ما يُخرجه منه إلّا «أزل»،
     وقد لا يربط بينهما. فالمسوّدةُ خارجَ الخطّة حتّى تكتمل، ولها ثلاثةُ
     مخارج: × وزرُّ إلغاءٍ وEsc. */
  const [draft, setDraft] = useState<{ category: ResourceCategory; source: "file" | "url" | null; row: PlanResource } | null>(null);
  /* ═══ ومفاتيحُ ملفّاتٍ سقطت صفوفُها — تُحذف بعد الحفظ لا قبله ═══

     «أزِل» كانت تُسقط الصفَّ وتترك الملفَّ في التخزين مدى الحياة. وحذفُه
     **لحظةَ الإزالة** أسوأ: الصفُّ ما زال في الخطّة المحفوظة حتّى يُحفظ
     ما بعده، فمن أزال ثمّ خرج بلا حفظٍ ترك خطّةً تشير إلى ملفٍّ مُحيَ.

     فيُؤجَّل الحذفُ إلى ما بعد أوّل حفظٍ ناجح. ومن خرج قبله ترك ملفّا
     يتيما — وهو أهونُ من صفٍّ يقود إلى لا شيء. */
  const [orphans, setOrphans] = useState<string[]>([]);

  const load = useCallback(async (first = false): Promise<Workspace | null> => {
    if (!id) return null;
    try {
      const w = await apiGet<Workspace>(`/api/trainer/cohorts/${id}/workspace`);
      setWs(w);
      const saved: PlanContent = w.plan?.content ?? { kind: "trainer", summaryAr: "", modules: w.course.baseModules, resources: [], liveNoteAr: "" };
      /* ═══ المواعيدُ الأولى تُرتَّب له — ولا تُحفظ حتّى يحفظها ═══

         «الخطوةُ الثانية تُفتح على مواعيدَ أسبوعيّةٍ مرتّبةٍ من تاريخ البدء،
         والمدرّبُ يعدّلها». فمن حدّد مدّتَه ولا مواعيدَ في خطّته وُجد له
         توزيعٌ أوّل في اليد — والبصمةُ من المحفوظ، فيُعلَّم «لم يُحفَظ» حتّى
         يحفظه. والمرسَلةُ والمعتمَدةُ لا يُرتَّب لها شيء: تُتصفَّح. */
      const status = w.plan?.status ?? "draft";
      const period = asPeriod(saved);
      const editable = status === "draft" || status === "changes_requested";
      const nextContent: PlanContent = editable && !(saved.slots?.length) && period && periodProblem(period) === null
        ? { ...saved, slots: defaultSlots(saved.modules.map((m) => m.moduleId), period) }
        : saved;
      const nextIdentity = { title: w.cohort.title };
      setContent(nextContent);
      setIdentity(nextIdentity);
      /* البصمةُ تُؤخذ ممّا وصل لا ممّا في اليد — فبعد كلّ حفظٍ يعود كلُّ شيءٍ نظيفا */
      setBaseline({
        identity: JSON.stringify(nextIdentity) + basicsKey(saved),
        modules: modulesKey(saved),
        workbooks: workbooksKey(saved),
        recorded: recordedKey(saved),
        resources: resourcesKey(saved),
      });
      /* أوّلُ فتح: المعتمَدةُ تُفتح على خطوة الاعتماد (كانت تُفتح على «مركز
         التواصل» حتّى خرج إلى «طلبتي»)، وغيرُها على أوّل مرحلةٍ لم تتمّ —
         وهي أبعدُ ما يُفتح له، فكلُّ ما قبلها تامّ. */
      if (first) {
        if (status === "approved" || status === "published") setStage("approval");
        else {
          const next = STAGES.find((s) => STAGE_KEYS[s.key].some((k) => {
            const c = w.checklist.find((x) => x.key === k);
            return c && !c.done && !c.optional;
          }));
          setStage(next?.key ?? "identity");
        }
      }
      return w;
    } catch (e) { setErr(e instanceof ApiError ? e.message : "تعذّر فتح صفحة الشعبة"); return null; }
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

  /* ═══ ثلاثةُ مخارجَ من المسوّدة — والملفُّ يُحذف مع إلغائها ═══
     المسوّدةُ لم تدخل الخطّةَ قطّ، فلا خطّةَ محفوظةً تشير إلى ملفّها —
     وحذفُه هنا فوريٌّ لا مؤجَّل. */
  const cancelDraft = useCallback(() => {
    setDraft((d) => {
      const key = (d?.row.bodyFileKey ?? "").trim();
      if (key) void apiDelete(`/api/trainer/cohorts/${id}/files/${encodeURIComponent(key)}`).catch(() => {});
      return null;
    });
  }, [id]);

  useEffect(() => {
    if (!draft) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") cancelDraft(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [draft, cancelDraft]);

  /* والرسالةُ قد تُقرأ ممّا عاد — «أُرسل إلى الإدارة» غيرُ «حُفظ» (٣ج-٣) */
  const act = async (fn: () => Promise<unknown>, done: string | ((r: unknown) => string)) => {
    if (busy) return;
    setBusy(true);
    try { const r = await fn(); toast(typeof done === "function" ? done(r) : done); await load(); }
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
  /* ═══ ملاحظاتُ الإدارة — كلٌّ في خطوته (٣ب) ═══

     تُقرأ ما دامت الخطّةُ مردودةً إليه وحدَه (`notesForTrainer`). */
  const reviewNotes: ReviewNotes = notesForTrainer(ws.plan);
  const notedStages = notedSections(reviewNotes);
  /* حالةُ كلّ مرحلةٍ من قائمة الخادم — والمفتاحُ واحدٌ هنا وهناك */
  const byKey = new Map(ws.checklist.map((c) => [c.key, c]));
  /* ما يحجب الإرسال — من `plan-gate`، القاعدةِ نفسِها التي يحتجّ بها الخادم.
     وكان يُحسب هنا بيدٍ فيَعُدّ «الاعتمادَ» شرطا لنفسه: لا يتمّ حتّى يُرسَل،
     ولا يُرسَل حتّى يتمّ — فالزرُّ مطفأٌ أبدا وإن أتمّ المدرّبُ كلَّ شيء. */
  const blocking = blockingBeforeSubmit(ws.checklist);
  const remaining = blocking.length;
  /* وأوّلُ ما يستطيع هو فتحَه من الباقي — لا كلُّ الباقي خطوةٌ في يده */
  const firstMine = blocking.find((b) => stageOfKey(b.key) !== null) ?? null;
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
  /* موضعُ الخطوة الحاليّة — يُقال بالضمور: المضمورُ يجيب «أين أنا» */
  const here = STAGES.find((s) => s.key === stage) ?? null;
  const stepNo = STAGES.findIndex((s) => s.key === stage) + 1;
  /* ═══ الدرجةُ تُفتح إن تمّ كلُّ ما قبلها (٢٧ سبتمبر ٢٠٢٦) ═══

     «لا ينتقل للتالي إلّا بعد أن يتمّ النقطةَ السابقة». والتمامُ من قائمة
     الخادم لا من ظنّ الشاشة. والمرسَلةُ والمعتمَدةُ تُتصفَّح كلُّها — فيها
     ما يُراجَع لا ما يُبنى. وما صار ناقصا بعد تمامه (مدّةٌ تغيّرت فخرج منها
     لقاء) يُقفل ما بعده ثانيةً حتّى يُصلَح: الترتيبُ قاعدةٌ لا ذكرى. */
  const doneOf = (k: Stage) => STAGE_KEYS[k].every((key) => byKey.get(key)?.done ?? false);
  const canOpen = (i: number) => approved || locked || STAGES.slice(0, i).every((x) => doneOf(x.key));
  /* اليومُ في عمّان — منه يُحكَم على «البدءُ مضى» كما يحكم الخادم */
  const today = zonedDay(new Date());
  /* والدرجةُ الأخيرةُ يُسمّى زرُّها «أرسِلها للاعتماد» — والاسمُ لا يُكتب
     `stage === "approval" &&` في الشريط: تلك صيغةُ **بدءِ لوحة الدرجة** التي
     تُقتطع بها في الحرّاس، ونسخةٌ منها في الشريط تُضلّ من يقتطع. */
  const atApproval = stage === "approval";

  /* ── «فيه تغييرٌ لم يُحفظ» ──

     كلُّ مرحلةٍ تحفظ بزرٍّ في ذيلها، ولا شيءَ كان يقول للمدرّب إنّ في يده
     تعديلا: يفتح «المحاور» ويكتب مخرَجا ثمّ ينتقل إلى «المصادر» فيذهب ما
     كتب بلا كلمة. فصارت المرحلةُ المعدَّلةُ تُعلَّم على الخطّ، وزرُّ حفظها
     لا يعمل بلا تغيير، والخروجُ من الصفحة يُستأذَن فيه. */
  const dirty: Record<string, boolean> = {
    identity: JSON.stringify(identity) + basicsKey(content) !== baseline.identity,
    modules: modulesKey(content) !== baseline.modules,
    workbooks: workbooksKey(content) !== baseline.workbooks,
    /* واللقاءاتُ المباشرةُ تُحفظ بنفسها — والمسجَّلةُ في الخطّة، فهي ما يُحفظ هنا */
    sessions: recordedKey(content) !== baseline.recorded,
    assignments: resourcesKey(content) !== baseline.resources,
  };
  dirtyRef.current = Object.values(dirty).some(Boolean);

  const openStage = (s: Stage) => setStage(s);
  /** يحذف ملفًّا من التخزين — والسقوطُ يُبتلع: ملفٌّ يتيمٌ أهونُ من صفٍّ يبقى */
  const dropFile = async (key: string) => {
    try { await apiDelete(`/api/trainer/cohorts/${ws.cohort.id}/files/${encodeURIComponent(key)}`); }
    catch { /* لا يُعطَّل الحفظُ لأجل ملفٍّ لم يُحذف */ }
  };
  /* ═══ ما يمنع الحفظَ نفسَه — يُقال قبل أن يُرسَل ═══

     الحفظُ يرسل الخطّةَ كاملةً (المدّةَ والمحاورَ والمصادر)، فمحورٌ بلا
     عنوانٍ تُرك في خطوةٍ أخرى يُسقط حفظَ الخطوة الأولى بخطإٍ لا يسمّيه. فيُفحص
     هنا بالقواعد نفسِها التي يردّ بها الخادم، ويُقال بأسمائه. */
  const saveProblems = (): string[] => {
    const out: string[] = [];
    if (identity.title.trim().length < 3) out.push("اسمُ الشعبة ثلاثةُ أحرفٍ فأكثر");
    if (content.startsOn || content.endsOn) {
      const p = periodProblem(content, { today, approvedStart: ws.cohort.publicPeriod?.startsOn ?? null });
      if (p) out.push(p);
    }
    content.modules.forEach((m, i) => {
      if (m.titleAr.trim().length < 2) out.push(`المحور ${i + 1} بلا عنوان — اكتبه أو احذف المحور`);
    });
    content.resources.forEach((r, i) => {
      if (resourceCategory(r) === "recorded" && (!r.title.trim() || !resourceHasSource(r))) {
        out.push(`جلسةٌ مسجّلةٌ ناقصة (${r.title.trim() || `رقم ${i + 1}`}) — لها اسمٌ ورابط، أو أزِلها من خطوة «اللقاءات»`);
      } else if (!r.title.trim() || !resourceHasSource(r)) {
        out.push(`مصدرٌ ناقص (${r.title.trim() || `رقم ${i + 1}`}) — له اسمٌ ورابطٌ أو ملفّ`);
      }
    });
    return out;
  };
  /* ═══ الحفظُ واحدٌ لكلّ الخطوات ═══

     كان لكلّ خطوةٍ زرُّ حفظها («احفظ البيانات» · «احفظ المحاور» · «احفظ
     المصادر») وزرُّ «التالي» في الشريط لا يحفظ شيئا — فمن نقر «التالي» ترك
     ما كتبه. وصار زرُّ الشريط يحفظ ما في اليد كلَّه: الخطّةَ واسمَ الشعبة
     معا — وزرّان في خطوةٍ واحدةٍ يجعلان المدرّبَ يحفظ أحدَهما ويظنّ الآخرَ
     محفوظا. والمرسَلةُ للاعتماد لا تُحفظ، تُتصفَّح. */
  const persist = async (): Promise<boolean> => {
    if (locked) return true;
    if (!Object.values(dirty).some(Boolean)) return true;
    const problems = saveProblems();
    if (problems.length) { setGaps(problems); return false; }
    await apiPut(`/api/trainer/cohorts/${ws.cohort.id}/plan`, content);
    if (identity.title.trim() !== ws.cohort.title) {
      await apiPatch(`/api/trainer/cohorts/${ws.cohort.id}`, { title: identity.title.trim() });
    }
    /* وبعد نجاح الحفظ — لا قبله: الخطّةُ المحفوظةُ لم تعد تشير إليها */
    const keys = orphans;
    setOrphans([]);
    for (const k of keys) await dropFile(k);
    return true;
  };
  /* ما ينقص خطوةً كي تتمّ — بلغة من يصحّحه. والحكمُ على المحفوظ: القائمةُ
     التي قالت «لم تتمّ» قرأت ما في الخادم، فالسببُ يُقرأ منه أيضا. */
  const gapsFor = (k: Stage, w: Workspace): string[] => {
    const saved = w.plan?.content ?? null;
    const label = w.checklist.find((c) => c.key === k)?.labelAr ?? "";
    if (k === "identity") {
      const out: string[] = [];
      if (w.cohort.title.trim().length < 3) out.push("اكتب اسمَ الشعبة — ثلاثةُ أحرفٍ فأكثر");
      const p = periodProblem(w.cohort.period);
      if (p) out.push(p);
      return out.length ? out : [label];
    }
    const ids = (saved?.modules ?? []).map((m) => m.moduleId);
    const legacySlots = !(saved?.slots?.length);
    if (k === "modules") {
      const mods = saved?.modules ?? [];
      if (mods.length === 0) return ["أضِف محورا واحدا على الأقلّ"];
      const out: string[] = [];
      const miss = mods.map((m, i) => ({ m, n: i + 1 })).filter(({ m }) => !moduleBodyDone(m));
      if (miss.length) out.push(`ينقص المحتوى النظريُّ في: ${miss.map(({ m, n }) => `${n}. ${m.titleAr || "بلا عنوان"}`).join(" · ")}`);
      /* والمواعيدُ بالقاعدة نفسِها التي يحكم بها الخادم — `axis-timeline.ts` */
      out.push(...slotProblems(saved?.slots, ids, w.cohort.period));
      return out.length ? out : [label];
    }
    if (k === "workbooks") {
      const out = cohortWorkbookProblems(saved?.workbook, ids);
      return out.length ? out : [label];
    }
    if (k === "sessions") {
      if (legacySlots) return [label];
      const mine = w.sessions.filter((x) => !x.placeholder && x.status !== "cancelled");
      const { blocking: out } = sessionProblems({
        slots: saved?.slots, moduleIds: ids,
        sessions: mine.map((x) => ({ title: x.title, startsAt: x.startsAt, endsAt: x.endsAt, moduleIds: x.moduleIds ?? [] })),
        recordings: (saved?.resources ?? []).filter((r) => resourceCategory(r) === "recorded")
          .map((r) => ({ title: r.title, moduleId: r.moduleId ?? null, opensAt: r.opensAt ?? null })),
        now: new Date(),
      });
      return out.length ? out : [label];
    }
    if (k === "assignments") {
      const out: string[] = [];
      if (w.assessments.length === 0) out.push("ألِّف مهمّةً واحدةً على الأقلّ — واجبا أو مشروعا يُسلَّم ويُقيَّم");
      if (!legacySlots) {
        const loose = w.assessments.filter((a) => !a.moduleId || !ids.includes(a.moduleId));
        if (loose.length) out.push(`اربط كلَّ مهمّةٍ بمحورها: ${loose.map((a) => `«${a.title}»`).join("، ")}`);
      }
      if ((saved?.resources ?? []).length === 0) out.push("أضِف مصدرا واحدا على الأقلّ — كرّاسةً أو كتابا أو رابطا");
      const orphan = (saved?.resources ?? []).filter((r) => r.moduleId && !ids.includes(r.moduleId));
      if (orphan.length) out.push(`مصادرُ مربوطةٌ بمحورٍ حُذف: ${orphan.map((r) => `«${r.title}»`).join("، ")} — اختر لها محورا`);
      return out.length ? out : [label];
    }
    return [label];
  };
  /* ═══ «احفظ وتابِع» — الزرُّ المضاء ═══

     يحفظ، ثمّ يسأل الخادمَ: أتمّت هذه الخطوة؟ فإن تمّت انتقل إلى التي
     تليها، وإلّا بقي وسمّى ما ينقص. فالانتقالُ ثمرةُ التمام لا نقرةٌ تسبقه —
     وهو نصُّ صاحب المنصّة: «ولا ينتقل للتالي إلّا بعد أن يتمّ النقطةَ
     السابقة ويقوم: تمّ وحفظ». */
  const saveAndContinue = async () => {
    if (busy) return;
    setBusy(true);
    setGaps(null);
    try {
      if (!(await persist())) return;
      const fresh = await load();
      if (!fresh) return;
      const at = STAGES.findIndex((x) => x.key === stage);
      if (STAGE_KEYS[stage].every((k) => fresh.checklist.find((c) => c.key === k)?.done)) {
        const next = STAGES[at + 1];
        if (next) {
          setStage(next.key);
          window.scrollTo({ top: 0, behavior: "smooth" });
          toast(locked ? `«${next.label}»` : `حُفظت «${STAGES[at].label}» — إلى «${next.label}»`);
        }
      } else {
        setGaps(gapsFor(stage, fresh));
      }
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  };
  /* والدرجةُ الأخيرة: الزرُّ نفسُه يُرسل. وما يمنع الإرسالَ يُقال بأسمائه
     قبل النداء — والخادمُ يردّ الشيءَ نفسَه إن وصل (`plan-gate`). */
  const submitNow = async () => {
    setGaps(null);
    setUnsavedAsk(false);
    /* ═══ وتعديلٌ لم يُحفظ لا يُطرح صامتا (٣ أكتوبر ٢٠٢٦) ═══
       الإرسالُ يرسل المحفوظ — فمن في يده تعديلٌ يُسأل بخياراتٍ ثلاثةٍ يُقال أثرُ
       كلٍّ منها، والقرارُ له («4a»). والترتيبُ وعلّتُه في `sendBlock` (`plan-gate.ts`). */
    const stop = sendBlock({ confirmed: confirm, unsaved: Object.values(dirty).some(Boolean), blocking: blocking.length });
    if (stop === "confirm") {
      setGaps(["أكّد موافقتك على كلّ ما في الشعبة — المربّعُ أسفلَ هذه الخطوة"]);
      document.getElementById("plan-confirm")?.focus();
      return;
    }
    if (stop === "unsaved") { setUnsavedAsk(true); return; }
    if (stop === "blocking") { setGaps(blocking.map((b) => b.labelAr)); return; }
    await act(() => apiPost(`/api/trainer/cohorts/${ws.cohort.id}/plan/submit`, { confirm }), "أُرسلت للاعتماد — يصلك القرار هنا وبالبريد");
  };
  /** ① يحفظ ثمّ يرسل — وحفظٌ يردّه الخادمُ يُقال، ولا يُرسَل بعده شيء */
  const saveThenSend = async () => {
    setUnsavedAsk(false);
    setGaps(null);
    setBusy(true);
    try {
      if (!(await persist())) return;
      const fresh = await load();
      if (!fresh) return;
      const left = blockingBeforeSubmit(fresh.checklist);
      if (left.length) { setGaps(left.map((b) => b.labelAr)); return; }
    } catch (e) {
      toastError(`${e instanceof ApiError ? e.message : "تعذّر الحفظ"} — ولم تُرسَل`);
      return;
    } finally {
      setBusy(false);
    }
    await act(() => apiPost(`/api/trainer/cohorts/${ws.cohort.id}/plan/submit`, { confirm }), "حُفظ تعديلُك وأُرسلت للاعتماد — يصلك القرار هنا وبالبريد");
  };
  /** ② يرسل المحفوظ — ويُطرح التعديلُ الذي في يده، وهذا يُقال قبل النقر */
  const sendSaved = async () => {
    setUnsavedAsk(false);
    if (blocking.length) { setGaps(blocking.map((b) => b.labelAr)); return; }
    await act(() => apiPost(`/api/trainer/cohorts/${ws.cohort.id}/plan/submit`, { confirm }), "أُرسل المحفوظ للاعتماد — وطُرح تعديلُك الذي لم يُحفظ");
  };
  /** ③ يعود إلى أوّل خطوةٍ فيها تعديلٌ لم يُحفظ — ولا يُرسَل شيء */
  const backToEdit = () => {
    setUnsavedAsk(false);
    const first = STAGES.find((x) => dirty[x.key]);
    if (first) { setStage(first.key); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };
  /* ── التكاليف: إنشاءٌ وتعديلٌ وحذف ──

     النموذجُ واحدٌ للفعلين: ما كُتب فيه يُرسَل `POST` إن لم يكن تحت اليد
     تكليفٌ يُعدَّل، و`PATCH` إن كان. فلا شاشةٌ ثانيةٌ ولا حقولٌ تُكرَّر. */
  const blankTask = { title: "", briefAr: "", type: "assignment", maxScore: 100, dueAt: "", moduleId: "" };
  const cancelEdit = () => { setEditingId(null); setTaskForm(blankTask); setTaskAttachments([]); setTaskFormOpen(false); };
  const editAssessment = (a: Workspace["assessments"][number]) => {
    setEditingId(a.id);
    /* «عدّل» يفتح الانسدالَ نفسَه — لا شاشةَ ثانيةً ولا حقولٌ تُكرَّر */
    setTaskFormOpen(true);
    /* وما طلب تعديلَه بعد الاعتماد يُفتح بطلبه لا بالمعتمَد — فتعديلُه يعدّل الطلب (٣ج-٣) */
    const v = proposedTask(taskValues(a), readTaskChange(a.pendingChange));
    setTaskForm({ title: v.title, briefAr: v.briefAr ?? "", type: v.type, maxScore: v.maxScore, dueAt: v.dueAt ? zonedDay(v.dueAt) : "", moduleId: v.moduleId ?? "" });
    setTaskAttachments(readTypedLinks(v.attachments));
  };
  const saveAssessment = () => act(async () => {
    const payload = {
      title: taskForm.title.trim(), type: taskForm.type, maxScore: taskForm.maxScore,
      /* الفراغُ يعني «بلا تعليمات» — يُرسَل `null` عند التعديل كي يُمحى ما كان */
      briefAr: taskForm.briefAr.trim() || null,
      /* ═══ وآخرُ الموعد آخرُ ذلك اليوم بتوقيت الشعبة (٢٧ سبتمبر ٢٠٢٦) ═══
         كان `new Date(يوم)` — منتصفَ ليلِ أوّله بغرينتش، أي الثالثةَ فجرا في
         عمّان: من اختار «الخميس» أُغلق عليه فجرَ الخميس لا ليلَه. */
      dueAt: taskForm.dueAt ? zonedInstant(taskForm.dueAt, [23, 59, 59, 999]).toISOString() : null,
      /* ومحورُها — منه متى تُفتح للمتعلّم */
      moduleId: taskForm.moduleId || null,
      /* الناقصُ يُسقَط لا يُرسَل نصفَ مرفق — والمصفوفةُ الفارغةُ محوٌ مقصود */
      attachments: taskAttachments
        .filter((r) => r.title.trim() && ((r.bodyFileKey ?? "").trim() || /^https?:\/\//.test((r.url ?? "").trim())))
        .map((r) => ((r.bodyFileKey ?? "").trim()
          ? { title: r.title.trim(), kind: "file", bodyFileKey: (r.bodyFileKey ?? "").trim(), bodyFileName: r.bodyFileName ?? null, bodyFileMime: r.bodyFileMime ?? null }
          : { title: r.title.trim(), url: (r.url ?? "").trim(), kind: resourceKind(r.kind) })),
    };
    const saved = editingId
      ? await apiPatch(`/api/trainer/assessments/${editingId}`, payload)
      : await apiPost(`/api/trainer/cohorts/${ws.cohort.id}/assessments`, { ...payload, briefAr: payload.briefAr ?? undefined, dueAt: payload.dueAt ?? undefined, moduleId: payload.moduleId ?? undefined });
    cancelEdit();
    return saved;
  }, (r) => savedTaskMsg((r as { review?: string } | null)?.review, Boolean(editingId)));
  const deleteAssessment = (a: Workspace["assessments"][number]) => act(async () => {
    const gone = await apiDelete(`/api/trainer/assessments/${a.id}`);
    if (editingId === a.id) cancelEdit();
    return gone;
  }, (r) => ((r as { review?: string } | null)?.review === "remove"
    ? "أُرسل طلبُ حذفها إلى الإدارة — وتبقى عند المسجّلين حتّى تعتمده"
    : "حُذفت المهمّة"));
  /* سحبُ طلبٍ لم تقرّره الإدارةُ بعد — والمعتمَدُ باقٍ كما هو (٣ج-٣) */
  const withdrawChange = (a: Workspace["assessments"][number]) => act(
    () => apiPost(`/api/trainer/assessments/${a.id}/withdraw-change`, {}),
    "سُحب طلبُك — والمهمّةُ كما اعتُمدت",
  );

  const setModule = (i: number, patch: Partial<PlanModule>) =>
    setContent({ ...content, modules: content.modules.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  /* ═══ المحاورُ ومواعيدُها معا — والقاعدةُ في `axis-timeline.ts` ═══

     المواعيدُ تتبع المحاور ولا تنكسر: النقلُ يعيد صبَّ المحاور في المواعيد
     بأحجامها وتواريخها، والجديدُ يلحق آخرَها، والمحذوفُ يخرج من موعده. والمدّةُ
     مدّةُ الخطّة التي في اليد إن صلحت — وإلّا المحفوظةُ كما حكم بها الخادم. */
  const slots = content.slots ?? [];
  const slotsOn = slots.length > 0;
  const moduleIds = content.modules.map((m) => m.moduleId);
  const axisNo = new Map(moduleIds.map((mid, i) => [mid, i + 1]));
  /* قيمُ المهمّة مقروءةً — لسطور «ما طلبتَه» تحت المهمّة */
  const taskFmt: TaskValueFormat = {
    type: (t) => ASSESSMENT_TYPES[t] ?? t,
    date: (v) => fmtDateTimeAr(v),
    axis: (id) => (axisNo.has(id) ? `المحور ${axisNo.get(id)}` : "محورٌ خارجَ الخطّة"),
  };
  const ownPeriod = asPeriod(content);
  const planPeriod = ownPeriod && periodProblem(ownPeriod) === null ? ownPeriod : ws.cohort.period;
  const setSlots = (next: PlanSlot[]) => setContent({ ...content, slots: next });
  /* والمسجَّلُ صار في «اللقاءات» بمحوره — إلّا في شعبةٍ اعتُمدت قبل المواعيد */
  const resourceCats: readonly ResourceCategory[] = slotsOn ? RESOURCE_CATEGORIES.filter((c) => c !== "recorded") : RESOURCE_CATEGORIES;
  const moveAxis = (i: number, delta: -1 | 1) => {
    const modules = moveModule(content.modules, i, delta);
    setContent({ ...content, modules, slots: slotsOn ? reflowSlots(slots, modules.map((m) => m.moduleId)) : content.slots });
  };
  /* كرّاسةُ الشعبة الواحدة، وموضعُ كلّ محورٍ فيها */
  const wb = content.workbook ?? null;
  const setWorkbook = (patch: Partial<CohortWorkbook>) =>
    setContent({ ...content, workbook: { ...(content.workbook ?? {}), ...patch } });
  const setWhere = (moduleId: string, whereAr: string) =>
    setWorkbook({
      parts: [...(wb?.parts ?? []).filter((x) => x.moduleId !== moduleId), { moduleId, whereAr }]
        .filter((x) => moduleIds.includes(x.moduleId))
        .sort((a, b) => moduleIds.indexOf(a.moduleId) - moduleIds.indexOf(b.moduleId)),
    });
  /* كرّاساتُ المواعيد القديمة — تُذكر ليجمعها في واحدة، ولا تُحذف من تحته */
  const slotWorkbooks = slots.filter((x) => workbookDone(x.workbook)).length;
  /* المسجَّلُ من مصادر الخطّة — يُحرَّر في «اللقاءات» بموضعه في المصفوفة الواحدة */
  const patchResource = (i: number, patch: Partial<PlanResource>) =>
    setContent({ ...content, resources: content.resources.map((x, j) => (j === i ? { ...x, ...patch } : x)) });


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

      {/* شعبةُ الإعداد تقول ما هي — فلا يظنّها شعبةً مفتوحةً للتسجيل (٢ أكتوبر ٢٠٢٦) */}
      {prepIds.has(ws.cohort.id) && (
        <Inset tone="accent" className="mb-4 p-3.5 text-read leading-7">{PREP_NOTICE_AR}</Inset>
      )}

      {/* ═══ وحجزُ المساعدة حيث تُعبَّأ الشعبة (٣ أكتوبر ٢٠٢٦) ═══
          قرارُ صاحب المنصّة («A»): كان رابطُ جلسة التهيئة في «مؤهّلاتي» والرسالة
          والدليل — والتعبئةُ هنا، وهنا يقف المدرّبُ حين يحتاجها. فيُعرض ما دامت
          الخطّةُ بيده (مسوّدةً أو مردودةً بملاحظات)، للنشط ومن في الطور معا. */}
      {(!ws.plan || ws.plan.status === "draft" || ws.plan.status === "changes_requested") && (
        <Inset className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <p className="text-read leading-7 text-muted-foreground">تحتاج مساعدةً في تعبئة شعبتك؟ احجز جلسةً معنا في الوقت الذي يناسبك.</p>
          <Button as="a" href={ORIENTATION_BOOKING_URL} target="_blank" rel="noreferrer noopener" size="sm" icon={CalendarPlus}>
            {ORIENTATION_CTA_AR}
          </Button>
        </Inset>
      )}

      {/* ═══ الشريطُ سلّمٌ بأسمائه، وزرٌّ مضاءٌ واحد (٢٧ سبتمبر ٢٠٢٦) ═══

          شكواه الأولى (١٧ سبتمبر ٢٠٢٦): «القائمة العلويّة آخذةٌ حيّزا كبيرا».
          فصار صفًّا واحدا لاصقا بالسقف، والأسماءُ تغيب إلّا اسمَ النشطة.
          ثمّ قال (٢٧ سبتمبر ٢٠٢٦): «يجب أن تظهر بشريطٍ واضح… سهلٍ معرفةُ
          أين وصل. زرُّ التالي يجب أن يكون مضاءً لأنّه الأهمّ».

          فالصفُّ باقٍ صفًّا — والسلّمُ صار **درجاتٍ موصولةً بخطّ** تُرى أسماؤها
          كلُّها على الشاشة العريضة، والتامُّ منها بعلامة، والنشطةُ بحلقةٍ
          ذهبيّة، وما بعد أوّلِ ناقصةٍ مقفلٌ يُرى ولا يُفتح. وزرُّ «التالي»
          الثانويُّ صار **الذهبيَّ الوحيدَ في الشاشة**: «احفظ وتابِع».
          واسمُ الشعبة نزل إلى سطر الحقائق — والمضمورُ يُسقط ذلك السطر.

          ── وأربعةُ عهودٍ لا تُمَسّ (من وثيقة القرار) ──

          ① النقطةُ الذهبيّةُ «لم يُحفَظ» تبقى على علامتها مهما ضمر الشريط.
          ② ملاحظةُ الإدارة حين تُردُّ الخطّةُ تبقى في المنطقة اللاصقة.
          ③ الشريطُ يبقى ظاهرا ولا يُشرَط بالطور (قرارُ ١٥ سبتمبر).
          ④ والأسماءُ تبقى مسموعةً كاملةً: كلُّ علامةٍ تحمل «الخطوة ن من ٦:
            اسمُها — حالُها» وإن غاب الاسمُ عن العين. */}
      <Bar
        as="section"
        tone="solid"
        className="relative sticky z-30 -mx-5 mb-5 px-5"
        style={{ top: "var(--staff-sticky-top, 0px)" }}
      >
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* المضمورُ يقول أين هو — والساكنُ يقوله بالسلّم وأسمائه */}
            {compact && (
              <p className="hidden shrink-0 text-read font-black text-foreground sm:block">
                الخطوة {stepNo} من {STAGES.length}
                <span className="font-bold text-muted-foreground"> · {here?.label}</span>
              </p>
            )}

            <ol className="flex w-full min-w-0 items-center sm:w-auto sm:flex-1">
              {STAGES.map((s, i) => {
                /* تمامُ الدرجة بصفوفها كلِّها — «المهامُّ والمصادر» صفّان، ولا تُعلَّم
                   تامّةً بأحدهما (قِيس في المتصفّح: عُلّمت تامّةً والمصادرُ ناقصة) */
                const done = doneOf(s.key);
                const selected = stage === s.key;
                const open = canOpen(i);
                /* الحالُ يُقال في الاسم المسموع كذلك: من لا يرى اللونَ يقرؤه */
                /* وعليها ملاحظةٌ من الإدارة — تُقال في الاسم المسموع وتُرى علامةً (٣ب) */
                const noted = (notedStages as readonly string[]).includes(s.key);
                const stateAr = `${dirty[s.key] ? "فيها تعديلٌ لم يُحفَظ" : done ? "تمّت" : selected ? "الحاليّة" : !open ? "مقفلةٌ حتّى تُتمّ ما قبلها" : "لم تتمّ بعد"}${noted ? " · عليها ملاحظةٌ من الإدارة" : ""}`;
                const blocker = STAGES.slice(0, i).find((x) => !doneOf(x.key));
                return (
                  /* بلا `min-w-0`: الدرجةُ لا تنضغط دون زرّها فيركب اسمُها على جارتها
                     (قِيس على ٣٢٠ و٣٩٠) — والخطُّ الواصلُ هو ما يتّسع ويضيق */
                  <li key={s.key} className={`flex items-center ${i < STAGES.length - 1 ? "flex-1" : ""}`}>
                    <button
                      type="button"
                      onClick={() => openStage(s.key)}
                      disabled={!open}
                      aria-current={selected ? "step" : undefined}
                      aria-label={`الخطوة ${i + 1} من ${STAGES.length}: ${s.label} — ${stateAr}`}
                      title={!open && blocker ? `أكمِل «${blocker.label}» أوّلا` : undefined}
                      /* وعلى الهاتف مساحةُ لمسٍ ٣٦×٤٤ حول دائرةٍ من ٢٨: ستُّ درجاتٍ
                         وخطوطُها تسع ٢٨٠ بكسلا (شاشةُ ٣٢٠) — وكانت تزيد ستّةَ عشرَ
                         فتُقصّ الدرجةُ الأخيرة عند الحافّة. */
                      className={`group flex min-h-11 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-full transition sm:min-w-0 sm:justify-start sm:px-1 ${
                        !open ? "cursor-not-allowed opacity-50" : selected ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <span className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-fine font-black transition ${
                        done ? "border-teal bg-teal text-on-teal"
                          : selected ? "border-gold bg-gold/15 text-gold-ink shadow-[0_0_0_3px_rgba(250,188,5,0.15)]"
                          : "border-white/15 bg-surface text-muted-foreground"
                      }`}>
                        {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : !open ? <Lock className="h-3 w-3" aria-hidden="true" /> : i + 1}
                        {/* ① تعديلٌ في اليد لا يُكتم لتوفير سطر — ولا لتوفير صفّ */}
                        {dirty[s.key] && (
                          <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-gold" aria-hidden="true" />
                        )}
                        {/* ② وملاحظةُ الإدارة علامةٌ في الركن المقابل — فلا تختلط
                            بعلامة «لم يُحفظ» الذهبيّة ولا تغطّيها */}
                        {noted && (
                          <span data-noted className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-red-400" aria-hidden="true" />
                        )}
                      </span>
                      {/* والاسمُ للنشطة من عرض اللوح فما فوق، ولكلّها ساكنا من ١٢٨٠
                          (قِيس: على ١٠٢٤ يكبّر الإطارُ المتنَ ١٫٣ فتفيض السادسة) — ولغيرها عند التحويم وعند تركيز لوحة
                          المفاتيح، فمن يتنقّل بالمفتاح يقرأ ما يقرؤه صاحبُ الفأرة.
                          وعلى الهاتف لا اسمَ في الصفّ: ستُّ دوائرَ متساويةٌ، والاسمُ
                          في سطرٍ تحتها — فقد رُكّب على جارته حين وُضع بينها. */}
                      <span
                        aria-hidden="true"
                        className={`overflow-hidden whitespace-nowrap text-read font-bold transition-[max-width] duration-200 ${
                          selected
                            ? "max-w-0 text-foreground sm:max-w-[11rem]"
                            : `max-w-0 text-muted-foreground sm:group-hover:max-w-[11rem] sm:group-focus-visible:max-w-[11rem] ${compact ? "" : "xl:max-w-[11rem]"}`
                        }`}
                      >
                        {s.label}
                      </span>
                    </button>
                    {/* والخطُّ بين درجتين يمتلئ حين تتمّ التي قبله — فيُقرأ
                        السلّمُ طريقا يُقطع لا أزرارا متجاورة */}
                    {i < STAGES.length - 1 && (
                      <span aria-hidden="true" className={`mx-0.5 h-0.5 min-w-1 flex-1 rounded-full sm:mx-1 sm:min-w-2 ${done ? "bg-teal" : "bg-white/10"}`} />
                    )}
                  </li>
                );
              })}
            </ol>

            {/* وعلى الهاتف يُقال موضعُ الخطوة سطرا تحت الدوائر — فالدائرةُ وحدَها
                رقمٌ لا يقول أين هو */}
            <p className="w-full text-read font-black text-foreground sm:hidden">
              الخطوة {stepNo} من {STAGES.length}
              <span className="font-bold text-muted-foreground"> · {here?.label}</span>
            </p>

            {/* ═══ الذهبيُّ الوحيد — «احفظ وتابِع» ═══

                يحفظ الخطوةَ ثمّ ينتقل إن تمّت، ويقول ما ينقص إن لم تتمّ.
                وفي الدرجة الأخيرة يصير «أرسِلها للاعتماد». والمعتمَدةُ تحمل
                شارتَها مكانَه — ما لم يتغيّر فيها شيءٌ يُحفظ. */}
            {approved && !Object.values(dirty).some(Boolean) && atApproval ? (
              <span className="stage-seal inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 text-read font-black text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> معتمَدة
              </span>
            ) : (
              <Button
                tone="primary"
                type="button"
                className="w-full shrink-0 sm:w-auto"
                loading={busy}
                disabled={busy || (atApproval && (locked || approved))}
                onClick={() => void (atApproval ? submitNow() : saveAndContinue())}
              >
                {atApproval
                  ? <><Send className="h-4 w-4" aria-hidden="true" /> {locked ? "بانتظار قرار الإدارة" : "أرسِلها للاعتماد"}</>
                  : <>{locked ? "التالي" : "احفظ وتابِع"} <ArrowLeft className="h-4 w-4" aria-hidden="true" /></>}
              </Button>
            )}
          </div>

          {/* سطرُ الحقائق: اسمُ الشعبة وما حولها. ويسقط بالضمور — فالمضمورُ
              يجيب «أين أنا» لا «ما شعبتي». */}
          {!compact && (
            <p className="mt-1 text-read leading-6 text-muted-foreground">
              <b className="font-black text-foreground">{ws.cohort.title}</b>
              {" "}· {doneCount} من {gated.length} · {ws.course.titleAr} · {ws.learners.length} التحقوا
              {" "}· {ws.sessions.filter((x) => !x.placeholder && x.status !== "cancelled").length} لقاء
              {approved ? <> · <span className="font-bold text-emerald-300">معتمَدة</span></> : <> · {st.label}</>}
            </p>
          )}

          {/* ② وملاحظةُ الإدارة تبقى لاصقةً: يقرؤها وهو ينزل ويصعد يصحّح.
              والعامّةُ بنصّها، وملاحظاتُ الخطوات أسماءُ خطواتها — كلٌّ زرٌّ
              يفتح خطوتَه، ونصُّها في رأسها هناك (٣ب). */}
          <ReviewNotesBanner notes={reviewNotes} current={stage} onOpen={openStage} />

          {/* وما ينقص الخطوةَ كي تتمّ — بعد «احفظ وتابِع» التي لم تنقل. لاصقٌ
              كالملاحظة: يقرؤه وهو ينزل إلى الحقل الذي يصحّحه. */}
          {gaps && gaps.length > 0 && (
            <Inset tone="warn" className="mt-2" role="alert">
              <p className="text-read font-black text-gold-ink">لم تتمّ «{here?.label}» بعد — ينقصها:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-read leading-7 text-foreground">
                {gaps.map((g) => <li key={g}>{g}</li>)}
              </ul>
            </Inset>
          )}

          {/* وتعديلٌ لم يُحفظ عند «أرسِلها» — ثلاثةُ خياراتٍ بأثر كلٍّ، والقرارُ له */}
          {unsavedAsk && (
            <Inset tone="warn" className="mt-2" role="alertdialog" aria-label="في يدك تعديلٌ لم يُحفظ">
              <p className="text-read font-black text-gold-ink">
                في يدك تعديلٌ لم يُحفظ: {STAGES.filter((x) => dirty[x.key]).map((x) => `«${x.label}»`).join("، ")}
              </p>
              <p className="mt-1 text-read leading-6 text-foreground">
                الإرسالُ يرسل المحفوظ وحدَه. اختر:
              </p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-read leading-6 text-muted-foreground">
                <li><b className="text-foreground">احفظ وأرسِل</b> — يُحفظ تعديلُك ثمّ تُرسَل به؛ وإن ردّ الحفظَ خطأٌ قيل لك ولم يُرسَل شيء.</li>
                <li><b className="text-foreground">أرسِل دون تعديلي</b> — يُرسَل المحفوظُ كما هو، ويُطرح تعديلُك.</li>
                <li><b className="text-foreground">ارجع إليه</b> — لا يُرسَل شيء، وتعود إلى خطوته لتراجعه.</li>
              </ul>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button tone="confirm" size="sm" disabled={busy} onClick={() => void saveThenSend()}>احفظ وأرسِل</Button>
                <Button tone="secondary" size="sm" disabled={busy} onClick={() => void sendSaved()}>أرسِل دون تعديلي</Button>
                <Button tone="secondary" size="sm" disabled={busy} onClick={backToEdit}>ارجع إليه</Button>
              </div>
            </Inset>
          )}
        </div>

        {/* ═══ الخيطُ: حلقةُ التقدّم صارت الحدَّ السفليَّ نفسَه ═══

            كانت `ProgressRing` مربّعا من ٧٦ بكسلا في رأسٍ لاصق. وصارت خيطا
            من بكسلَين **مطلقَ الموضع على حافّة الشريط** — فلا يضيف إلى
            ارتفاعه شيئا، ويجلس فوق الحدِّ الذي ترسمه `Bar` مباشرةً. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5">
          <span className="stage-fill block h-full bg-teal" style={{ width: `${ready}%` }} />
        </span>
      </Bar>

      {/* ═══ وذهب الطوران (٣٠ سبتمبر ٢٠٢٦) ═══

          كان هنا لسانان: «التجهيز» و«مركز التواصل». وقرارُ صاحب المنصّة: «انقل
          مركزَ التواصل إلى صفحة طلبتي.. لا داعيَ له هنا في تجهيز الشعبة». فصارت
          الشعبةُ تجهيزا وحدَه، والمخاطبةُ في «طلبتي» حيث المتعلّمون أنفسُهم
          (`MyLearners.tsx`). */}

      {/* ═══ ملاحظةُ الإدارة على هذه الخطوة — في رأسها (٣ب) ═══

          كانت الملاحظةُ نصّا واحدا في رأس الشاشة، فينزل المدرّبُ إلى خطوةٍ وقد
          غاب عنه ما قيل فيها. فصار لكلّ خطوةٍ ملاحظتُها، تُقرأ حيث يُعدَّل. */}
      {stage !== "approval" && <StageReviewNote stage={stage} text={reviewNotes[stage]} />}

      {locked && stage !== "approval" && (
        <Inset tone="accent" className="mb-4 flex items-start gap-2 text-read leading-6">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          خطّتك بانتظار الاعتماد — لا تُعدَّل حتّى يصل القرار. ولو أردت تعديلها الآن، اطلب من الإدارة ردَّها إليك.
        </Inset>
      )}

      {/* ═══ وذهبت لافتةُ الفصل (٢٧ سبتمبر ٢٠٢٦) ═══

          كانت فوق المتن كلِّه: «هذه الشعبةُ معتمَدةٌ لفصل كذا — ولقاءاتُك
          داخلَ أشهره» أو «لم تُفتَح بعد — تسمّي الإدارةُ فصلَها». وصارت المدّةُ
          للمدرّب يحدّدها في الخطوة الأولى، فحدودُه تُقال حيث يكتبها وحيث
          يجدول داخلها (خطوة «اللقاءات») — لا لافتةً عن قرارٍ ليس قرارَه. */}
      {/* ─────────── ① المعلومات الأساسيّة ───────────

          كانت لوحةً تُفتح بقلمٍ من اسم الشعبة (ق٧ · ١٧ سبتمبر ٢٠٢٦)، وفيها
          الاسمُ والنبذةُ وسطرٌ يقول إنّ السعرَ والسعةَ بيد الإدارة. وصارت
          الدرجةَ الأولى وفيها قرارُها الأكبر — مدّةُ الشعبة — بلا سعر: «ولا
          داعيَ لوجود السعر هناك، وأهمُّها موعدُ الشعبة كاملا من — إلى»
          (صاحب المنصّة، ٢٧ سبتمبر ٢٠٢٦). */}
      {stage === "identity" && (
        <Panel as="section">
          <StageIntro stage="identity" />
          <div className="mt-5 grid gap-5">
            <StaffField wide label="اسم الشعبة" hint="ما يراه المتعلّم في الكتالوج وفي شهادته. يأتيك باسم الدورة ورقمِ الشعبة — «اسمُ الدورة — شعبة ١» — ولك أن تزيد عليه ما يميّزها: «… — شعبة ١ · مساء الأحد».">
              <input value={identity.title} onChange={(e) => setIdentity({ title: e.target.value })} disabled={locked} className={controlCls} />
            </StaffField>
            {/* وصفُ الشعبة موضعُه هنا لا في «المحاور»: هو تعريفُ الشعبة
                نفسِها، وكان في خطوةٍ اسمُها «المحاور» فلا يجده من يبحث عنه. */}
            <StaffField wide label="نبذةٌ عن الشعبة" hint="سطران يقرؤهما المتعلّم قبل أن يدفع. قل ما سيخرج به، لا ما ستشرحه.">
              <textarea rows={2} value={content.summaryAr ?? ""} onChange={(e) => setContent({ ...content, summaryAr: e.target.value })} disabled={locked} className={areaCls} />
            </StaffField>

            {/* ═══ المدّةُ — من متى إلى متى ═══

                «لأنّها هي الفترةُ المخصّصة للّقاءات المباشرة ومدّةُ رؤية
                المتعلّمين موارده». ولقاءاتُه كلُّها داخلها، والقاعدةُ في
                `application/trainer/cohort-period.ts` يقرؤها الخادمُ معها. */}
            <div className="grid gap-5 sm:grid-cols-2">
              <StaffField label="تبدأ الشعبة" hint="أوّلُ يومٍ فيها: تُفتح فيه موارده للمتعلّمين، ولقاءاتُك من يومه فما بعده.">
                <input
                  type="date" dir="ltr"
                  value={content.startsOn ?? ""}
                  min={today}
                  onChange={(e) => setContent({ ...content, startsOn: e.target.value || null })}
                  disabled={locked}
                  aria-label="تاريخُ بدء الشعبة"
                  className={`${controlCls} text-left`}
                />
              </StaffField>
              <StaffField label="وتنتهي" hint="آخرُ يومٍ فيها: آخرُ لقاءاتك فيه أو قبله.">
                <input
                  type="date" dir="ltr"
                  value={content.endsOn ?? ""}
                  min={content.startsOn || today}
                  onChange={(e) => setContent({ ...content, endsOn: e.target.value || null })}
                  disabled={locked}
                  aria-label="تاريخُ انتهاء الشعبة"
                  className={`${controlCls} text-left`}
                />
              </StaffField>
            </div>
            {(() => {
              /* ما يقوله التاريخان — مدّتُهما، أو ما يمنعهما — قبل أن يُحفظا */
              if (!content.startsOn && !content.endsOn) {
                return <p className="text-read leading-6 text-muted-foreground">لم تُحدَّد المدّةُ بعد — ولا تُفتح جدولةُ اللقاءات حتّى تُحدَّد.</p>;
              }
              const problem = periodProblem(content, { today, approvedStart: ws.cohort.publicPeriod?.startsOn ?? null });
              if (problem) return <p className="text-read font-bold leading-6 text-gold-ink">{problem}</p>;
              const days = periodDays({ startsOn: content.startsOn!, endsOn: content.endsOn! });
              const weeks = Math.round(days / 7);
              return (
                <p className="text-read leading-6 text-muted-foreground">
                  مدّتُها <b className="text-foreground">{days} يوما</b>
                  {weeks >= 1 && <> — نحو {weeks === 1 ? "أسبوع" : weeks === 2 ? "أسبوعين" : `${weeks} أسابيع`}</>}.
                  {" "}وتصير حدودَ الشعبة المعلَنة حين تُعتمَد خطّتُك، وجدولتُك داخلها تُفتح لحظةَ الحفظ.
                </p>
              );
            })()}
            {/* والمعلَنُ للمسجَّلين الآن يُقال إن افترق عمّا يكتبه — فلا يظنّ
                أنّ ما كتبه وصل الناسَ قبل أن يُعتمَد */}
            {ws.cohort.publicPeriod && (ws.cohort.publicPeriod.startsOn !== content.startsOn || ws.cohort.publicPeriod.endsOn !== content.endsOn) && (
              <Inset className="text-read leading-6 text-muted-foreground">
                المعلَنُ للمسجَّلين الآن: من <b className="text-foreground">{cohortDayAr(ws.cohort.publicPeriod.startsOn)}</b> إلى{" "}
                <b className="text-foreground">{cohortDayAr(ws.cohort.publicPeriod.endsOn)}</b> — ويتبدّل بمدّتك حين تعتمد الإدارةُ خطّتك.
              </Inset>
            )}
          </div>
        </Panel>
      )}

      {/* ─────────── ② المحاور ومواعيدها ───────────

          «وبعدها المحاورُ ومواعيدُها التي يجب أن تكون ضمن كلّ فترة الشعبة»
          (صاحب المنصّة، ٢٧ سبتمبر ٢٠٢٦). فالمحاورُ تُعرض داخلَ مواعيدها:
          بطاقةٌ لكلّ موعدٍ بتاريخيه، وفيها محورُه أو محوراه المتجاوران. وبين
          محورين في موعدٍ واحد «افصِلهما»، وبين موعدين «اجمعهما» ما بقيت
          المواعيدُ أربعةً فأكثر. والقاعدةُ في `application/trainer/axis-timeline.ts`. */}
      {stage === "modules" && (() => {
        const moduleCard = (m: PlanModule, i: number) => {
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
                      onClick={() => moveAxis(i, -1)}
                    ><ChevronUp className="h-4 w-4" aria-hidden="true" /></Button>
                    <Button tone="ghost" size="sm" disabled={locked || i === content.modules.length - 1}
                      aria-label={`انقل «${m.titleAr || `المحور ${i + 1}`}» إلى أسفل`}
                      onClick={() => moveAxis(i, 1)}
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
        };
        const problems = slotProblems(slots, moduleIds, planPeriod);
        return (
        <Panel as="section">
          <StageIntro stage="modules" />
          {content.modules.length === 0 && (
            <Inset tone="warn" className="mt-4 text-read leading-6 text-gold-ink">لا محاورَ لهذه الدورة في الكتالوج بعد — أضف محورا أدناه وابدأ منه.</Inset>
          )}
          <p className="mt-4 text-read text-muted-foreground">
            {countAr(content.modules.length, MODULE_FORMS)}
            {slotsOn && <> على {slots.length} مواعيد</>}
            {planPeriod && <> · من {dayLabelAr(planPeriod.startsOn)} إلى {dayLabelAr(planPeriod.endsOn)}</>}
            {" "}· اضغط العنوانَ لتفتحه
          </p>
          {/* ما يمنع المواعيدَ يُقال وهو يرتّبها — بالقاعدة التي يحكم بها الخادم */}
          {slotsOn && problems.length > 0 && (
            <Inset tone="warn" className="mt-3 text-read leading-6 text-gold-ink">
              <ul className="list-inside list-disc space-y-0.5">{problems.map((x) => <li key={x}>{x}</li>)}</ul>
            </Inset>
          )}
          {!slotsOn && (
            <Inset className="mt-3 flex flex-wrap items-center gap-3 text-read leading-6 text-muted-foreground">
              <span className="min-w-0 flex-1">
                {planPeriod
                  ? "لم تُوزَّع المحاورُ على مواعيدها بعد — رتّبها أسبوعيّةً من تاريخ البدء، ثمّ عدّلها كما تشاء."
                  : "حدّد مدّةَ الشعبة في «المعلومات الأساسيّة» أوّلا — فالمواعيدُ داخلها."}
              </span>
              {planPeriod && (
                <Button tone="secondary" size="sm" disabled={locked || content.modules.length === 0}
                  onClick={() => setSlots(defaultSlots(moduleIds, planPeriod))}>
                  رتّب المواعيد
                </Button>
              )}
            </Inset>
          )}

          {slotsOn ? (
            <ol className="mt-3 space-y-3">
              {slots.map((slot, si) => (
                <li key={`${si}-${slot.moduleIds[0] ?? "empty"}`} className="grid gap-2">
                  <Card tone="default" className="grid gap-3">
                    <p className="text-read font-black text-teal-light-ink">
                      الموعد {si + 1} <span className="font-bold text-foreground">· {axesLabelAr(slot.moduleIds, axisNo)}</span>
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <StaffField label="يبدأ" hint="أوّلُ يومٍ فيه: تُفتح فيه كرّاستُه ومادّتُه النظريّة.">
                        <input type="date" dir="ltr" value={slot.startsOn} disabled={locked}
                          min={planPeriod?.startsOn} max={planPeriod?.endsOn}
                          aria-label={`بدايةُ الموعد ${si + 1}`}
                          onChange={(e) => e.target.value && setSlots(slots.map((x, j) => (j === si ? { ...x, startsOn: e.target.value } : x)))}
                          className={`${controlCls} text-left`} />
                      </StaffField>
                      <StaffField label="وينتهي" hint="آخرُ يومٍ فيه — وهو آخرُ موعدٍ لتسليم مهامّه ما لم تحدّد غيرَه.">
                        <input type="date" dir="ltr" value={slot.endsOn} disabled={locked}
                          min={slot.startsOn} max={planPeriod?.endsOn}
                          aria-label={`نهايةُ الموعد ${si + 1}`}
                          onChange={(e) => e.target.value && setSlots(slots.map((x, j) => (j === si ? { ...x, endsOn: e.target.value } : x)))}
                          className={`${controlCls} text-left`} />
                      </StaffField>
                    </div>
                    <ol className="space-y-3">
                      {slot.moduleIds.map((id, j) => {
                        const i = moduleIds.indexOf(id);
                        const m = content.modules[i];
                        if (!m) return null;
                        return (
                          <Fragment key={id}>
                            {moduleCard(m, i)}
                            {/* الفصلُ بين محورين في موعدٍ واحد — يقسم أيّامَه بقدرهما */}
                            {j < slot.moduleIds.length - 1 && (
                              <li className="flex justify-center">
                                <Button tone="ghost" size="sm" disabled={locked}
                                  aria-label={`افصِل المحور ${axisNo.get(id)} عن المحور ${axisNo.get(slot.moduleIds[j + 1])}`}
                                  onClick={() => setSlots(splitSlot(slots, si, j + 1))}>
                                  افصِلهما في موعدين
                                </Button>
                              </li>
                            )}
                          </Fragment>
                        );
                      })}
                    </ol>
                  </Card>
                  {/* والجمعُ بين موعدين متجاورين — ما بقيت المواعيدُ فوق الحدّ */}
                  {si < slots.length - 1 && (
                    <div className="flex justify-center">
                      <Button tone="ghost" size="sm" disabled={locked || !canMerge(slots, si, moduleIds.length)}
                        title={canMerge(slots, si, moduleIds.length) ? undefined : "المواعيدُ أربعةٌ على الأقلّ — لا يُجمع دونها"}
                        onClick={() => setSlots(mergeSlots(slots, si))}>
                        اجمع الموعدين {si + 1} و{si + 2}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <ol className="mt-3 space-y-3">
              {content.modules.map((m, i) => moduleCard(m, i))}
            </ol>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {/* المعرّفُ من أكبرِ ما أُعطي لا من الطول — فلا يرث محورٌ جديدٌ
                معرّفَ محذوف. الشرحُ في `application/trainer/plan-modules`.
                والجديدُ يلحق آخرَ موعد، وللمدرّب أن يفصله. */}
            <Button tone="secondary" disabled={locked} onClick={() => {
              const moduleId = nextTrainerModuleId(ws.course.id, content.modules);
              setContent({ ...content, modules: [...content.modules, { moduleId, titleAr: "" }], slots: slotsOn ? appendToSlots(slots, moduleId) : content.slots });
              setOpenModule(moduleId);
            }}>+ محور</Button>
            {slotsOn && planPeriod && (
              <Button tone="ghost" disabled={locked} onClick={() => setPendingReflow(true)}>
                أعِد توزيعَ المواعيد
              </Button>
            )}
            {/* وزرُّ «احفظ المحاور» صار زرَّ الشريط «احفظ وتابِع» — واحدٌ يحفظ
                ويتقدّم، لا اثنان يُحفظ بأحدهما ويُظنّ الآخر (٢٧ سبتمبر ٢٠٢٦) */}
          </div>
        </Panel>
        );
      })()}

      {/* ─────────── ③ الكرّاسة ───────────

          كانت لكلّ موعدٍ كرّاسة (٢٧ سبتمبر ٢٠٢٦). ثمّ قرارُ صاحب المنصّة (٣٠
          سبتمبر ٢٠٢٦): «اجعل الكرّاسةَ واحدةً فقط وليس لكلّ محور، على أن تكون
          كاملةً لكلّ المحاور، وأن يتأكّد أن تكون سهلةً على الطالب يتبعها محورا
          محورا». فصارت واحدةً — ملفٌّ يُرفع أو رابطٌ يُلصَق، ولا يجتمعان —
          ومعها خريطتُها: لكلّ محورٍ أين يبدأ فيها. والخريطةُ إلزاميّة، وبها
          يصير «يتبعها محورا محورا» شرطا يُفحص لا نصيحة. والحكمُ عليها
          `cohortWorkbookProblems` نفسُها التي يحكم بها الخادم. */}
      {stage === "workbooks" && (
        <Panel as="section">
          <StageIntro stage="workbooks" />
          {slotWorkbooks > 0 && !workbookDone(wb) && (
            <Inset tone="accent" className="mt-4 text-read leading-6">
              كانت لمواعيدك {slotWorkbooks === 1 ? "كرّاسةٌ" : `${slotWorkbooks} كرّاسات`} منفصلة. اجمعها في كرّاسةٍ واحدةٍ بترتيب المحاور وضعها هنا — والمنفصلةُ لا تُعرض بعد إرسال خطّتك.
            </Inset>
          )}
          <Card tone={workbookDone(wb) ? "default" : "accent"} className="mt-4 grid gap-3">
            <StaffField label="اسمُ الكرّاسة (اختياريّ)" hint="ما يراه المتعلّم — «كرّاسةُ الدورة». وإن تركته سُمّيت «كرّاسةُ الدورة».">
              <input value={wb?.title ?? ""} disabled={locked} maxLength={200}
                aria-label="اسمُ الكرّاسة"
                onChange={(e) => setWorkbook({ title: e.target.value || null })}
                className={controlCls} />
            </StaffField>
            {(wb?.bodyFileKey ?? "").trim() ? (
              <ModuleBodyUpload
                cohortId={ws.cohort.id}
                purpose="plan_resource"
                refId="workbook-cohort"
                value={wb ?? {}}
                onChange={(next) => setWorkbook(next)}
                disabled={locked}
                label="ارفع الكرّاسة"
                hint="ملفٌّ واحدٌ فيه المحاورُ كلُّها بترتيبها. PDF وصورةٌ يُقرآن في الصفحة، وWord وشرائحُ تُنزَّل."
              />
            ) : (
              <div className="grid gap-2">
                <StaffField label="رابطُ الكرّاسة" hint="رابطٌ يبدأ بـ https:// — أو ارفع ملفّا بدلا منه.">
                  <input dir="ltr" value={wb?.url ?? ""} disabled={locked} placeholder="https://…"
                    aria-label="رابطُ الكرّاسة"
                    onChange={(e) => setWorkbook({ url: e.target.value || null })}
                    className={`${controlCls} text-left`} />
                </StaffField>
                {!(wb?.url ?? "").trim() && (
                  <ModuleBodyUpload
                    cohortId={ws.cohort.id}
                    purpose="plan_resource"
                    refId="workbook-cohort"
                    value={wb ?? {}}
                    onChange={(next) => setWorkbook({ ...next, url: null })}
                    disabled={locked}
                    label="أو ارفع ملفّا"
                    hint="ملفٌّ واحدٌ فيه المحاورُ كلُّها بترتيبها. PDF وصورةٌ يُقرآن في الصفحة، وWord وشرائحُ تُنزَّل."
                  />
                )}
              </div>
            )}
            {!workbookDone(wb) && <p className="text-read font-bold text-gold-ink">بلا كرّاسةٍ بعد — ملفٌّ أو رابط.</p>}
          </Card>

          <div className="mt-5">
            <p className="text-read font-black">أين يبدأ كلُّ محورٍ في الكرّاسة؟</p>
            <p className="mt-0.5 text-read leading-6 text-muted-foreground">
              يراه المتعلّمُ بجانب كلّ محورٍ في رحلته، فيفتح الكرّاسةَ على موضعه — «ص ٥» أو «ص ٥–١٢» أو «القسم الثاني».
            </p>
            {moduleIds.length === 0 ? (
              <Inset className="mt-3 text-read leading-6 text-muted-foreground">
                اكتب محاورك في «المحاور ومواعيدها» أوّلا — ثمّ ارجع إلى هنا.
              </Inset>
            ) : (
              <ol className="mt-3 grid gap-2">
                {content.modules.map((m, i) => {
                  const where = workbookWhere(wb, m.moduleId) ?? "";
                  const current = (wb?.parts ?? []).find((x) => x.moduleId === m.moduleId)?.whereAr ?? "";
                  return (
                    <li key={m.moduleId} className="grid items-center gap-2 sm:grid-cols-[1fr_14rem]">
                      <span className="text-read leading-6">
                        <span className="font-black text-teal-light-ink tabular-nums">المحور {i + 1}</span>
                        <span className="text-foreground"> · {m.titleAr || "بلا عنوانٍ بعد"}</span>
                      </span>
                      <input value={current} disabled={locked} maxLength={WORKBOOK_WHERE_MAX}
                        aria-label={`أين يبدأ المحور ${i + 1} في الكرّاسة`}
                        placeholder="ص ٥"
                        onChange={(e) => setWhere(m.moduleId, e.target.value)}
                        className={`${controlCls} ${where ? "" : "border-gold/50"}`} />
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </Panel>
      )}

      {/* ─────────── ④ اللقاءات المباشرة ─────────── */}
      {stage === "sessions" && (
        <div className="space-y-5">
          <Panel as="section">
            <StageIntro stage="sessions" />
            {/* حدودُه تُقال حيث يجدول داخلها — لا في لافتةٍ فوق المتن كلِّه */}
            {ws.cohort.period && (
              <p className="mt-2 text-read leading-6 text-muted-foreground">
                مدّةُ شعبتك: من <b className="text-foreground">{cohortDayAr(ws.cohort.period.startsOn)}</b> إلى{" "}
                <b className="text-foreground">{cohortDayAr(ws.cohort.period.endsOn)}</b> — وتغييرُها من «المعلومات الأساسيّة».
              </p>
            )}
            {/* ═══ والمبدئيُّ يُقال سطرا لا يُسرد لقاءات (٢٧ سبتمبر ٢٠٢٦) ═══
                «امنحه أن يضيفها بنفسه لا ينقلها، لأنّ ما هو موجودٌ مثالٌ فقط».
                فلا يُسرد المثالُ بأزرار نقل — يُقال ما هو ومتى يذهب. */}
            {ws.sessions.some((x) => x.placeholder) && (
              <Inset className="mt-3 text-read leading-6 text-muted-foreground">
                فُتحت الشعبةُ للتسجيل بـ{ws.sessions.filter((x) => x.placeholder).length} مواعيدَ مبدئيّةٍ وضعتها الإدارة — مثالٌ يراه
                من يسجّل، <b className="text-foreground">لا لقاءاتٌ لك</b>: لا تُنقل ولا تُحسب في عددك. أضِف لقاءاتِك بنفسك، ويُرفع
                المثالُ كلُّه حين تعتمد الإدارةُ أوّلَها.
              </Inset>
            )}
          </Panel>

          {/* ═══ بطاقةٌ لكلّ موعد — والمسجَّلُ مع المباشر (٢٧ سبتمبر ٢٠٢٦) ═══

              «اللقاءاتُ المباشرة التي يحدّدها المدرّبُ بفترة كلّ محور بحسب
              ربطه لأيّ محاور»، و«لا بأس أن جمعت بين اللقاءات المسجّلة
              واللقاءات المباشرة في واحدة لأنّهم نفسُ الأثر». والشعبةُ التي
              اعتُمدت قبل المواعيد تجدول كما كانت. */}
          {slotsOn ? (() => {
            const mine = ws.sessions.filter((x) => !x.placeholder && x.status !== "cancelled");
            const slotOf = (x: { moduleIds?: string[] }) => slotIndexOf(slots, (x.moduleIds ?? [])[0] ?? "");
            const loose = mine.filter((x) => slotOf(x) === -1);
            const recordedRows = content.resources.map((r, i) => ({ r, i })).filter(({ r }) => resourceCategory(r) === "recorded");
            const looseRecorded = recordedRows.filter(({ r }) => slotIndexOf(slots, r.moduleId ?? "") === -1);
            return (
              <>
                <ol className="space-y-4">
                  {slots.map((slot, si) => (
                    <SlotSessions
                      key={`${si}-${slot.moduleIds[0] ?? "empty"}`}
                      cohortId={ws.cohort.id}
                      slot={slot}
                      index={si}
                      axisNo={axisNo}
                      sessions={mine.filter((x) => slotOf(x) === si)}
                      recorded={recordedRows.filter(({ r }) => slotIndexOf(slots, r.moduleId ?? "") === si).map(({ r, i }) => ({ row: r, i }))}
                      locked={locked}
                      approvedOnce={ws.approvedOnce ?? false}
                      onDone={() => void load()}
                      onAddRecorded={(row) => setContent({
                        ...content,
                        resources: [...content.resources, { ...row, title: row.title, category: "recorded", kind: kindForCategory("recorded", false) }],
                      })}
                      onPatchRecorded={(i, patch) => patchResource(i, patch)}
                      onRemoveRecorded={(i) => setContent({ ...content, resources: content.resources.filter((_, j) => j !== i) })}
                    />
                  ))}
                </ol>
                {/* ما جُدول قبل المحاور أو رُبط بمحورٍ حُذف — يُربط هنا ولا يضيع */}
                {(loose.length > 0 || looseRecorded.length > 0) && (
                  <Card tone="accent" className="grid gap-3">
                    <p className="text-read font-black text-foreground">لم تُربط بمحورٍ بعد</p>
                    <p className="text-read leading-6 text-muted-foreground">
                      كلُّ لقاءٍ لمحورٍ أو محورين، وكلُّ جلسةٍ مسجّلةٍ لمحورها — اختر لكلٍّ محورَه، فينتقل إلى بطاقة موعده.
                      وما انعقد منها لا يمنع الإرسال: ربطُه يحسبه لمحوره.
                    </p>
                    <ul className="grid gap-2">
                      {loose.map((x) => (
                        <Inset as="li" key={x.id} className="flex flex-wrap items-center gap-3">
                          <span className="min-w-0 flex-1 text-read">
                            <b className="text-foreground">{x.title}</b>
                            <span className="text-muted-foreground"> · {fmtDateTimeAr(x.startsAt)}{new Date(x.endsAt ?? x.startsAt).getTime() < Date.now() ? " · انعقد" : ""}</span>
                          </span>
                          <select defaultValue="" disabled={locked || busy} aria-label={`محورُ «${x.title}»`}
                            onChange={(e) => e.target.value && void act(
                              () => apiPatch(`/api/trainer/sessions/${x.id}/axes`, { moduleIds: [e.target.value] }),
                              `رُبط «${x.title}» بمحوره`,
                            )}
                            className={`${controlCls} w-auto [&>option]:bg-surface`}>
                            <option value="">اختر محورا</option>
                            {content.modules.map((m, k) => <option key={m.moduleId} value={m.moduleId}>المحور {k + 1} — {m.titleAr || "بلا عنوان"}</option>)}
                          </select>
                        </Inset>
                      ))}
                      {looseRecorded.map(({ r, i }) => (
                        <Inset as="li" key={`r${i}`} className="flex flex-wrap items-center gap-3">
                          <span className="min-w-0 flex-1 text-read">
                            <Film className="me-1 inline h-4 w-4 text-teal-light-ink" aria-hidden="true" />
                            <b className="text-foreground">{r.title || "جلسةٌ مسجّلة"}</b>
                          </span>
                          <select value="" disabled={locked} aria-label={`محورُ الجلسة المسجّلة «${r.title}»`}
                            onChange={(e) => {
                              const mid = e.target.value;
                              const slot = slots[slotIndexOf(slots, mid)];
                              if (!mid || !slot) return;
                              /* وتُفتح أوّلَ يومِ موعد محورها ما لم يكن لها وقتٌ داخله */
                              const inside = r.opensAt && zonedDay(r.opensAt) >= slot.startsOn && zonedDay(r.opensAt) <= slot.endsOn;
                              patchResource(i, { moduleId: mid, opensAt: inside ? r.opensAt : zonedInstant(slot.startsOn, [8, 0, 0, 0]).toISOString() });
                            }}
                            className={`${controlCls} w-auto [&>option]:bg-surface`}>
                            <option value="">اختر محورا</option>
                            {content.modules.map((m, k) => <option key={m.moduleId} value={m.moduleId}>المحور {k + 1} — {m.titleAr || "بلا عنوان"}</option>)}
                          </select>
                        </Inset>
                      ))}
                    </ul>
                  </Card>
                )}
              </>
            );
          })() : (
            /* الجدولةُ بيده داخلَ مدّة شعبته، والاعتمادُ بيد الإدارة */
            <TrainerSchedule
              cohortId={ws.cohort.id}
              onDone={() => void load()}
              minSessions={Math.max(1, content.modules.length)}
              haveSessions={ws.sessions.filter((x) => !x.placeholder && x.status !== "cancelled").length}
            />
          )}

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
      {stage === "assignments" && (() => {
        const isProject = taskTab === "project";
        const shownTasks = ws.assessments.filter((a) => (a.type === "project") === isProject);
        const tabDone = (key: string) => ws.checklist.find((c) => c.key === key)?.done ?? false;
        const tabLabel = (t: TaskTab) => (
          <span className="inline-flex items-center gap-2">
            {TASK_TABS[t].label}
            {tabDone(TASK_TABS[t].key)
              ? <Check className="h-3.5 w-3.5 text-teal-light-ink" aria-label="تمّ" />
              : <span className="h-2 w-2 rounded-full bg-gold" aria-label="لم يتمّ بعد" />}
          </span>
        );
        return (
        <div className="space-y-5">
        <Panel as="section">
          <StageIntro stage="assignments" />
          <TabBar
            ariaLabel="أقسامُ المهامّ والمصادر"
            className="mt-4"
            items={(Object.keys(TASK_TABS) as TaskTab[]).map((t) => ({ id: t, label: tabLabel(t) }))}
            value={taskTab}
            onChange={(t) => { cancelEdit(); setTaskTab(t); }}
          />
          <TaskTabGuide tab={taskTab} />
        </Panel>

        {taskTab !== "resources" && (
        <Panel as="section">
          <h3 className="flex items-center gap-2 text-sm font-black">
            {isProject ? <GraduationCap className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> : <ClipboardCheck className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />}
            {TASK_TABS[taskTab].label}
          </h3>
          {shownTasks.length === 0 ? (
            <p className="mt-3 text-read font-bold text-gold-ink">
              {isProject ? "لا مشروعَ تخرّجٍ بعد — وهو إلزاميٌّ للاعتماد." : "لا مهمّةَ عمليّةً بعد — وما تؤلّفه أدناه يظهر هنا."}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {shownTasks.map((a) => {
                /* ما ينتظر الإدارةَ فيها بعد اعتماد خطّته، وما طلبه — بالقاعدة التي يحكم بها الخادم (٣ج-٣) */
                const review = taskReview(a, ws.approvedOnce ?? false);
                const asked = changeLines(taskValues(a), readTaskChange(a.pendingChange), taskFmt);
                return (
                <Inset as="li" key={a.id} className={editingId === a.id ? "ring-1 ring-teal/50" : undefined}>
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`text-read font-bold text-foreground${review === "remove" ? " line-through" : ""}`}>{a.title}</p>
                      {/* التعليماتُ تُرى في القائمة: من يراجع تكاليفَه قبل الإرسال
                          يقرأ ما سيقرؤه المتعلّم، لا عنوانا وحدَه. */}
                      {a.briefAr
                        ? <p className="mt-1 whitespace-pre-line text-read leading-6 text-muted-foreground">{a.briefAr}</p>
                        : <p className="mt-1 text-read text-gold-ink">بلا تعليمات — المتعلّم يرى العنوانَ وحدَه</p>}
                      <p className="mt-1 text-read text-muted-foreground">
                        {a.moduleId && axisNo.has(a.moduleId) && <>المحور {axisNo.get(a.moduleId)} · </>}
                        {ASSESSMENT_TYPES[a.type] ?? a.type} · من {a.maxScore}
                        {a.dueAt && <> · يُسلَّم قبل {fmtDateTimeAr(a.dueAt)}</>}
                        {" · "}سلّم {a.submissions}
                      </p>
                      {slotsOn && (!a.moduleId || !axisNo.has(a.moduleId)) && (
                        <p className="mt-1 text-read font-bold text-gold-ink">غيرُ مربوطةٍ بمحور — عدّلها واختر محورَها، فمنه متى تُفتح للمتعلّم.</p>
                      )}
                      {TASK_REVIEW_TRAINER_AR[review] && (
                        <p className="mt-1.5">
                          <Chip tone={review === "declined" ? "danger" : "warn"}>{TASK_REVIEW_TRAINER_AR[review]}</Chip>
                        </p>
                      )}
                      {review === "declined" && a.reviewerNote && (
                        <p className="mt-1 whitespace-pre-line text-read leading-6 text-foreground">{a.reviewerNote}</p>
                      )}
                      {asked.length > 0 && (
                        <dl className="mt-1.5 space-y-0.5 text-read leading-6" aria-label="ما طلبتَ تعديلَه">
                          {asked.map((l) => (
                            <div key={l.field} className="flex flex-wrap gap-x-1.5">
                              <dt className="font-bold text-foreground">{l.label}:</dt>
                              <dd className="text-muted-foreground"><s>{l.before}</s> ← <span className="text-foreground">{l.after}</span></dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      {/* والسحبُ تحت ما يسحبه — لا زرّا ثالثا في صفّ الأفعال يعصر النصَّ على الهاتف */}
                      {review === "edit" && (
                        <Button tone="ghost" size="sm" className="mt-1" disabled={busy} onClick={() => withdrawChange(a)}>تراجَع عن التعديل</Button>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {review === "remove" ? (
                        <Button tone="ghost" size="sm" disabled={busy} onClick={() => withdrawChange(a)}>تراجَع عن الحذف</Button>
                      ) : (
                        <>
                          <Button tone="ghost" size="sm" disabled={busy} onClick={() => editAssessment(a)}>عدّل</Button>
                          {/* ما سُلّم فيه لا يُحذف — والسببُ يُقال قبل النقر لا بعده */}
                          <Button
                            tone="ghost" size="sm"
                            disabled={busy || a.submissions > 0}
                            title={a.submissions > 0 ? "سلّم فيه متعلّمون — أغلِقه بدل حذفه" : undefined}
                            onClick={() => setPendingDelete(a)}
                          >احذف</Button>
                        </>
                      )}
                    </div>
                  </div>
                </Inset>
                );
              })}
            </ul>
          )}

          {/* ── نموذجٌ واحدٌ: يؤلّف تكليفا أو يعدّل واحدا قائما — وينسدل ── */}
          <div className="mt-5 border-t border-white/10 pt-4">
            {/* وبعد الاعتماد يُقال قبل الإضافة لا بعدها: لا يصل المسجَّلين شيءٌ حتّى
                تعتمده الإدارة (٣ج-٣) */}
            {ws.approvedOnce && (
              <p className="mb-3 text-read leading-6 text-muted-foreground">
                خطّتُك معتمَدة — فما تضيفه هنا أو تعدّله أو تحذفه يصل الإدارةَ أوّلا، ويبقى المسجّلون على المعتمَد حتّى تعتمده.
              </p>
            )}
            {!taskFormOpen ? (
              <Button tone="secondary" disabled={locked}
                onClick={() => { setTaskForm({ ...blankTask, type: isProject ? "project" : "assignment" }); setTaskFormOpen(true); }}>
                {isProject ? "+ مشروعُ التخرّج" : "+ مهمّةٌ عمليّة"}
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
                {editingId ? "تعديلُ المهمّة" : isProject ? "مشروعُ التخرّج" : "مهمّةٌ عمليّةٌ جديدة"}
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
                <span className="mt-0.5 mb-2 block text-read leading-6 text-muted-foreground">نموذجٌ يملؤه، أو مرجعٌ يقرؤه قبل التسليم. اختر نوعَه أوّلا — فيظهر ما يوازيه: رفعُ الملفّ، أو خانةُ الرابط.</span>
                {/* ═══ النوعُ أوّلا، ثمّ ما يوازيه (٣٠ سبتمبر ٢٠٢٦) ═══

                    شكوى صاحب المنصّة: «عندما يختار ملفّا لا تظهر خانةُ رفع الملف…
                    يجب بعد أن يختار ملفّا أو فيديو يظهر له ما يوازيه». فالنوعُ
                    يُختار أوّلا: «ملفّ» يُظهر الرفعَ وحدَه، وما سواه يُظهر الرابطَ
                    بتلميحٍ يناسبه. ولا يجتمع رابطٌ وملفّ في مرفقٍ واحد. */}
                <ul className="space-y-2">
                  {taskAttachments.map((att, i) => {
                    const patch = (next: Partial<PlanResource>) =>
                      setTaskAttachments(taskAttachments.map((x, j) => (j === i ? { ...x, ...next } : x)));
                    const kind = resourceKind(att.kind);
                    const isFile = kind === "file";
                    /* ولا يُقيَّد ملفُّ المرفق للحذف: المهمّةُ تُحفظ وحدَها لا مع الخطّة،
                       ومن أزال مرفقا ثمّ ألغى التعديلَ بقي المرفقُ في المهمّة المحفوظة —
                       فحذفُ ملفّه مع حفظ الخطّة التالي يتركه مرفقا مكسورا. */
                    const setKind = (k: string) => {
                      patch(k === "file"
                        ? { kind: k, url: "" }
                        : { kind: k, bodyFileKey: null, bodyFileName: null, bodyFileMime: null });
                    };
                    return (
                      <Card as="li" key={i} className="grid gap-2">
                        <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
                          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label={`نوع المرفق ${i + 1}`} className={`${controlCls} [&>option]:bg-surface`}>
                            {RESOURCE_KINDS.map((k) => (<option key={k} value={k}>{RESOURCE_META[k].label}</option>))}
                          </select>
                          <input value={att.title} onChange={(e) => patch({ title: e.target.value })} placeholder="اسم المرفق — «نموذجُ التسليم»" aria-label={`اسم المرفق ${i + 1}`} className={controlCls} />
                          <Button tone="ghost" size="sm" onClick={() => setTaskAttachments(taskAttachments.filter((_, j) => j !== i))}>أزل</Button>
                        </div>
                        {isFile ? (
                          <ModuleBodyUpload
                            cohortId={ws.cohort.id}
                            purpose="plan_resource"
                            refId={`task-att-${editingId ?? "new"}-${i}`}
                            value={att}
                            onChange={(next) => patch({ ...next, url: "" })}
                            disabled={locked}
                            label="ارفع الملفّ"
                            hint="PDF وصورةٌ يُقرآن في الصفحة، وWord وشرائحُ وجداولُ تُنزَّل."
                          />
                        ) : (
                          <StaffField label={ATTACHMENT_LINK_HINT[kind].label} hint={ATTACHMENT_LINK_HINT[kind].hint}>
                            <input dir="ltr" value={att.url ?? ""} onChange={(e) => patch({ url: e.target.value })} placeholder="https://…" aria-label={`رابط المرفق ${i + 1}`} className={`${controlCls} text-left`} />
                          </StaffField>
                        )}
                      </Card>
                    );
                  })}
                </ul>
                <Button tone="ghost" size="sm" className="mt-2" onClick={() => setTaskAttachments([...taskAttachments, { title: "", url: "", kind: "file" }])}>+ مرفق</Button>
              </div>
              {/* ═══ محورُ المهمّة — منه متى تُفتح وآخرُ موعدها (٢٧ سبتمبر ٢٠٢٦) ═══
                  «المهامُّ… تُربط بالمحاور لتظهر للمتعلّم بعد انتهاء كلّ جلسةٍ
                  مباشرةٍ أو مسجّلة». وآخرُ موعدها آخرُ يومٍ في موعد محورها ما لم
                  يحدّد غيرَه — يُملأ حين يُختار المحور، وله أن يغيّره. */}
              {slotsOn && (
                <label className="block">
                  <span className="block text-read font-bold text-foreground">المحور</span>
                  <span className="mt-0.5 mb-2 block text-read leading-6 text-muted-foreground">تُفتح للمتعلّم بعد انتهاء أوّل لقاءٍ لمحورها، وآخرُ موعدها آخرُ يومٍ في موعده ما لم تحدّد غيرَه.</span>
                  <select aria-label="محور المهمّة" value={taskForm.moduleId}
                    onChange={(e) => {
                      const mid = e.target.value;
                      const before = slots[slotIndexOf(slots, taskForm.moduleId)];
                      const after = slots[slotIndexOf(slots, mid)];
                      /* ما ملأه المحورُ السابقُ يتبع الجديد — وما كتبه بيده يبقى */
                      const auto = !taskForm.dueAt || (before && taskForm.dueAt === before.endsOn);
                      setTaskForm({ ...taskForm, moduleId: mid, dueAt: auto ? (after?.endsOn ?? "") : taskForm.dueAt });
                    }}
                    className={`${controlCls} [&>option]:bg-surface`}>
                    <option value="">اختر محورا</option>
                    {content.modules.map((m, k) => <option key={m.moduleId} value={m.moduleId}>المحور {k + 1} — {m.titleAr || "بلا عنوان"}</option>)}
                  </select>
                </label>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                {/* ولسانُ المشروع نوعُه مشروعٌ لا يُختار — ولسانُ المهامّ واجبٌ أو اختبار */}
                {isProject ? (
                  <div className="block">
                    <span className="block text-read font-bold text-foreground">النوع</span>
                    <span className="mt-0.5 mb-2 block text-read leading-6 text-muted-foreground">يُحتسب في إكمال الدورة، ويُسلَّم في آخرها.</span>
                    <p className={`${controlCls} flex items-center`}>مشروعُ تخرّج</p>
                  </div>
                ) : (
                <label className="block">
                  <span className="block text-read font-bold text-foreground">النوع</span>
                    <span className="mt-0.5 mb-2 block text-read leading-6 text-muted-foreground">«واجب» يُسلَّم مرّة، و«اختبار» له درجة.</span>
                  <select aria-label="نوع المهمّة" value={taskForm.type} onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value })} className={`${controlCls} [&>option]:bg-surface`}>
                    {Object.entries(ASSESSMENT_TYPES).filter(([k]) => k !== "project").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                )}
                <label className="block">
                  <span className="block text-read font-bold text-foreground">الدرجة العظمى</span>
                    <span className="mt-0.5 mb-2 block text-read leading-6 text-muted-foreground">عليها تُحسب نسبتُه. لا تُخفَض بعد رصد درجةٍ أعلى منها.</span>
                  <input type="number" min={1} dir="ltr" aria-label="الدرجة العظمى" value={taskForm.maxScore}
                    onChange={(e) => setTaskForm({ ...taskForm, maxScore: Math.max(1, Number(e.target.value) || 1) })}
                    className={`${controlCls} text-left`} />
                </label>
                <label className="block">
                  <span className="block text-read font-bold text-foreground">آخر موعد</span>
                    <span className="mt-0.5 mb-2 block text-read leading-6 text-muted-foreground">حتّى آخر ذلك اليوم بتوقيت الشعبة. وبعده يُقبل المتأخّرُ ويُعلَّم، ويظهر في «من يحتاج تدخّلك» إن لم يسلّم.</span>
                  <input type="date" dir="ltr" aria-label="آخر موعد للتسليم" value={taskForm.dueAt}
                    onChange={(e) => setTaskForm({ ...taskForm, dueAt: e.target.value })} className={`${controlCls} text-left`} />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button tone="confirm" disabled={busy || taskForm.title.trim().length < 3 || (slotsOn && !taskForm.moduleId)} onClick={saveAssessment}>
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
        )}

        {/* ═══ والمصادرُ هنا مع المهامّ (٢٧ سبتمبر ٢٠٢٦) ═══

            «وبعدها المهامُّ والواجباتُ وغيرُها، والتي تُربط بالمحاور». فذهبت
            خطوةُ «المصادر» على حدة: المسجَّلُ منها صار جلساتٍ في «اللقاءات»
            بمحاورها، والكتبُ والروابطُ هنا — كلٌّ بمحوره. وشعبةٌ اعتُمدت قبل
            المواعيد تبقى أصنافُها الثلاثةُ هنا كما كانت. وصارت لسانا ثانيا
            (٣٠ سبتمبر ٢٠٢٦). */}
        {taskTab === "resources" && (
        <Panel as="section">
          <h3 className="flex items-center gap-2 text-sm font-black">
            <FileText className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> المصادر
          </h3>
          <p className="mt-1.5 text-read leading-7 text-muted-foreground">
            ما يحتاجه المتعلّمُ خارجَ اللقاء: كرّاسةٌ أو مقالٌ أو فيديو.
            {slotsOn ? " واربط كلَّ مصدرٍ بمحوره فيُفتح بعد لقائه — أو اجعله قراءةً مسبقةً تُفتح مع الكرّاسة." : " تُفتح له مع أوّل يوم."}
          </p>
          <div className="mt-4 space-y-5">
            {resourceCats.map((cat) => {
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
                      /* ═══ والنوعُ يُعاد اشتقاقُه مع كلّ تعديل ═══

                         كان يُكتب مرّةً عند إنشاء الصفّ (`kindForCategory(cat,
                         false)` أي «كتاب») ولا يُعاد. فمن رفع ملفًّا في خانة
                         الكتب بقي نوعُه «كتابا» مدى الحياة — يراه المتعلّمُ
                         كتابا وهو مستند. وعطبٌ **صامت**: لا يسقط شيء، بل
                         يُعرض اسمٌ خاطئٌ لا يُكذّبه شيء. */
                      const patch = (next: Partial<PlanResource>) =>
                        setContent({
                          ...content,
                          resources: content.resources.map((x, j) => {
                            if (j !== i) return x;
                            const merged = { ...x, ...next };
                            return { ...merged, kind: kindForCategory(resourceCategory(merged), Boolean((merged.bodyFileKey ?? "").trim())) };
                          }),
                        });
                      const hasFile = Boolean((r.bodyFileKey ?? "").trim());
                      return (
                        <Card as="li" key={i} className="grid gap-3">
                          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                            <input value={r.title} onChange={(e) => patch({ title: e.target.value })} disabled={locked} placeholder={meta.titlePlaceholder} aria-label={`اسم المصدر ${i + 1}`} className={controlCls} />
                            {/* ═══ مصدرٌ واحدٌ لا حقلان ═══

                                كان لخانة الكتب حقلُ رفعٍ **وحقلُ رابطٍ تحته**،
                                فيملؤهما مدرّبٌ معا ولا شيءَ يقول أيُّهما يصل
                                المتعلّم. فصار المعروضُ ما اختاره عند الإضافة:
                                المرفوعُ حيث رُفع، والمُلصَقُ حيث لُصق. */}
                            {cat === "reading" && hasFile ? (
                              <ModuleBodyUpload
                                cohortId={ws.cohort.id}
                                purpose="plan_resource"
                                refId={`r${i}`}
                                value={r}
                                onChange={(next) => patch(next)}
                                disabled={locked}
                                label="ارفع الملفّ"
                                hint="PDF وصورةٌ يُقرآن في الصفحة، وWord وشرائحُ وجداولُ تُنزَّل."
                              />
                            ) : (
                              <input dir="ltr" value={r.url ?? ""} onChange={(e) => patch({ url: e.target.value })} disabled={locked} placeholder="https://…" aria-label={`رابط المصدر ${i + 1}`} className={`${controlCls} text-left`} />
                            )}
                            {/* والإزالةُ تُقيّد ملفَّها ليُحذف بعد الحفظ */}
                            <Button tone="ghost" size="sm" disabled={locked}
                              onClick={() => {
                                const key = (r.bodyFileKey ?? "").trim();
                                if (key) setOrphans((o) => [...o, key]);
                                setContent({ ...content, resources: content.resources.filter((_, j) => j !== i) });
                              }}>أزل</Button>
                          </div>
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
                          {/* ═══ ومحورُه ومتى يُفتح (٢٧ سبتمبر ٢٠٢٦) ═══

                              «وبعدها المهامُّ والواجباتُ وغيرُها، والتي تُربط
                              بالمحاور لتظهر للمتعلّم بعد انتهاء كلّ جلسة». فالمصدرُ
                              المربوطُ يُفتح بعد أوّل لقاءٍ لمحوره، والمسبقُ منه مع
                              كرّاسة موعده، والذي بلا محورٍ للشعبة كلِّها مع أوّل يوم. */}
                          {slotsOn && cat !== "recorded" && (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <StaffField label="محورُه" hint="يُفتح للمتعلّم بعد انتهاء أوّل لقاءٍ لمحوره. و«للشعبة كلّها» يُفتح مع أوّل يومٍ فيها.">
                                <select value={r.moduleId ?? ""} onChange={(e) => patch({ moduleId: e.target.value || null, ...(e.target.value ? {} : { preReading: null }) })}
                                  disabled={locked} aria-label={`محورُ المصدر ${i + 1}`} className={`${controlCls} [&>option]:bg-surface`}>
                                  <option value="">للشعبة كلّها</option>
                                  {content.modules.map((m, k) => <option key={m.moduleId} value={m.moduleId}>المحور {k + 1} — {m.titleAr || "بلا عنوان"}</option>)}
                                </select>
                              </StaffField>
                              {r.moduleId && (
                                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 self-end text-read leading-6">
                                  <input type="checkbox" checked={Boolean(r.preReading)} disabled={locked}
                                    onChange={(e) => patch({ preReading: e.target.checked || null })}
                                    className="h-4 w-4 shrink-0 accent-teal" />
                                  قراءةٌ مسبقة — يُفتح مع كرّاسة الموعد، قبل اللقاء
                                </label>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </ul>

                  {/* ═══ المسوّدة — خارجَ الخطّة حتّى تكتمل ═══

                      ومصدرُها يُختار **قبل ظهور أيّ حقل**: في «كتبٌ وملفّات»
                      زرّان، وفي غيرها الرابطُ وحدَه فلا سؤال. فالحالةُ
                      الخاطئةُ (ملفٌّ ورابطٌ معا) لا يمكن التعبيرُ عنها بدل
                      أن تُشرَح بجملةٍ تحت الحقلَين. */}
                  {draft?.category === cat && (
                    <Card tone="accent" className="mt-3 grid gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-read font-black text-foreground">{meta.addLabel.replace("+ ", "")} — جديد</p>
                        <Button tone="ghost" size="sm" icon={X} aria-label="أغلِق المسوّدة" onClick={cancelDraft}>أغلِق</Button>
                      </div>

                      {draft.source === null ? (
                        <>
                          <p className="text-read leading-6 text-muted-foreground">من أين يأتي هذا المصدر؟ اختر واحدا — ولا يجتمع ملفٌّ ورابطٌ في صفٍّ واحد.</p>
                          <div className="flex flex-wrap gap-2">
                            <Button tone="secondary" size="sm" onClick={() => setDraft({ ...draft, source: "file" })}>ارفع ملفّا</Button>
                            <Button tone="secondary" size="sm" onClick={() => setDraft({ ...draft, source: "url" })}>أضِف رابطَ كتاب</Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <input value={draft.row.title}
                            onChange={(e) => setDraft({ ...draft, row: { ...draft.row, title: e.target.value } })}
                            placeholder={meta.titlePlaceholder} aria-label="اسمُ المصدر الجديد" className={controlCls} />
                          {draft.source === "file" ? (
                            <ModuleBodyUpload
                              cohortId={ws.cohort.id}
                              purpose="plan_resource"
                              refId={`draft-${cat}`}
                              value={draft.row}
                              onChange={(next) => setDraft({ ...draft, row: { ...draft.row, ...next } })}
                              label="ارفع الملفّ"
                              hint="PDF وصورةٌ يُقرآن في الصفحة، وWord وشرائحُ وجداولُ تُنزَّل."
                            />
                          ) : (
                            <input dir="ltr" value={draft.row.url ?? ""}
                              onChange={(e) => setDraft({ ...draft, row: { ...draft.row, url: e.target.value } })}
                              placeholder="https://…" aria-label="رابطُ المصدر الجديد" className={`${controlCls} text-left`} />
                          )}
                          <input value={draft.row.noteAr ?? ""} maxLength={500}
                            onChange={(e) => setDraft({ ...draft, row: { ...draft.row, noteAr: e.target.value } })}
                            placeholder={meta.notePlaceholder} aria-label="وصفُ المصدر الجديد" className={controlCls} />
                          <div className="flex flex-wrap gap-2">
                            <Button tone="confirm" size="sm"
                              disabled={!draft.row.title.trim() || !resourceHasSource(draft.row)}
                              onClick={() => {
                                const row = draft.row;
                                setContent({
                                  ...content,
                                  resources: [...content.resources, {
                                    ...row,
                                    category: cat,
                                    kind: kindForCategory(cat, Boolean((row.bodyFileKey ?? "").trim())),
                                  }],
                                });
                                setDraft(null);
                              }}>أضِفْه</Button>
                            <Button tone="ghost" size="sm" onClick={cancelDraft}>ألغِ</Button>
                          </div>
                        </>
                      )}
                    </Card>
                  )}

                  <Button
                    tone="secondary" size="sm" className="mt-3" disabled={locked || draft !== null}
                    onClick={() => setDraft({
                      category: cat,
                      /* والخانتان الأخريان رابطٌ وحدَه — فلا يُسأل عمّا لا خيارَ فيه */
                      source: cat === "reading" ? null : "url",
                      row: { title: "", url: "", category: cat, kind: kindForCategory(cat, false) },
                    })}
                  >
                    {meta.addLabel}
                  </Button>
                </section>
              );
            })}
          </div>
          {/* وحفظُها بزرّ الشريط «احفظ وتابِع» (٢٧ سبتمبر ٢٠٢٦). والمرفوعُ لا
              يُشترط له رابط: شرطُ `https://` كان يمنع حفظَ مصدرٍ ملفُّه في
              المخزن — فيُرفع ثمّ لا يُحفظ (`resourceHasSource` في `saveProblems`). */}
        </Panel>
        )}

        {/* ما سُلّم وما ينتظر — انتقلت من «التشغيل» (ع-١). من كتب المهمّةَ
            يرى تحتها من استجاب لها، بالمقام الصحيح لا بعدد قائمة الانتظار. */}
        {taskTab !== "resources" && <CohortSubmissions cohortId={ws.cohort.id} only={isProject ? "project" : "practical"} />}
        </div>
        );
      })()}

      {pendingModule && (
        <ConfirmAction
          titleAr="حذفُ المحور"
          confirmLabelAr="احذفه من خطّتي"
          onCancel={() => setPendingModule(null)}
          onConfirm={() => {
            setContent({
              ...content,
              modules: content.modules.filter((_, j) => j !== pendingModule.index),
              /* ويخرج من موعده، ويسقط الموعدُ إن فرغ — فلا تتحرّك تواريخُ غيره */
              slots: slotsOn ? dropFromSlots(slots, pendingModule.module.moduleId) : content.slots,
            });
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

      {pendingReflow && planPeriod && (
        <ConfirmAction
          titleAr="إعادةُ توزيع المواعيد"
          confirmLabelAr="أعِد توزيعَها"
          onCancel={() => setPendingReflow(false)}
          onConfirm={() => {
            /* والكرّاسةُ تتبع أوّلَ محاور موعدها — فلا يضيع ما رُفع لأجل ترتيبٍ جديد */
            const next = defaultSlots(moduleIds, planPeriod).map((x) => ({
              ...x, workbook: slots.find((o) => o.moduleIds[0] === x.moduleIds[0])?.workbook ?? null,
            }));
            setSlots(next);
            setPendingReflow(false);
          }}
        >
          <p className="text-read leading-7">
            تُرتَّب المواعيدُ من جديدٍ أسبوعيّةً من تاريخ البدء، وتذهب تواريخُك وما جمعتَ وفصلتَ منها.
            ولا يقع شيءٌ حتّى تحفظ.
          </p>
        </ConfirmAction>
      )}

      {pendingDelete && (
        <ConfirmAction
          titleAr="حذفُ المهمّة"
          confirmLabelAr={ws.approvedOnce && pendingDelete.status === "published" ? "اطلب حذفها" : "احذفه"}
          busy={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => { const a = pendingDelete; setPendingDelete(null); void deleteAssessment(a); }}
        >
          <p className="text-read leading-7">
            {ws.approvedOnce && pendingDelete.status === "published"
              ? <>يُرسَل طلبُ حذف «{pendingDelete.title}» إلى الإدارة، ويبقى عند المسجّلين حتّى تعتمده. ولا تسليمَ فيه، فلا عملَ لأحدٍ يضيع.</>
              : <>يُحذف «{pendingDelete.title}» من الشعبة فلا يراه المسجّلون بعد الآن. ولا تسليمَ فيه، فلا عملَ لأحدٍ يضيع.</>}
          </p>
        </ConfirmAction>
      )}

      {/* ─────────── ⑥ الاعتماد ─────────── */}
      {stage === "approval" && (
        <Panel as="section" tone={st.tone}>
          <StageIntro stage="approval" />
          <p className="mt-2 text-read leading-7 text-foreground">
            بإرسالك تقرّ أنّك راجعتَ كلَّ ما في الشعبة ووافقتَ عليه: اسمَها ومدّتَها، ومحاورَها ومواعيدَها وتطبيقَها العمليّ، وكرّاساتِها، ولقاءاتِها المباشرة وجلساتِها المسجّلة، ومهامَّها ومصادرَها. ثمّ يعتمدها المديرُ الأكاديميُّ أو المديرُ الأعلى — ويصلك القرارُ هنا وبالبريد.
          </p>
          {ws.plan?.submittedAt && <p className="mt-2 text-read text-muted-foreground">آخرُ إرسال: {fmtDateTimeAr(ws.plan.submittedAt)}{ws.plan.reviewedAt ? ` · آخرُ قرار: ${fmtDateTimeAr(ws.plan.reviewedAt)}` : ""}</p>}
          {/* ═══ ومتى يدخلها متعلّموه — يُقال قبل الإرسال (٣ج) ═══

              «التسجيلُ يُفتح بعد الاعتماد، ويُغلق يومَ البدء، والالتحاقُ المتأخّرُ
              حتّى الموعد الثاني». والتاريخُ من مواعيده بالقاعدة نفسِها التي يكتبه
              بها الاعتمادُ (`joinClosesAt`) — فلا يقرأ هنا تاريخا غيرَ ما سيُكتب. */}
          {/* ═══ وعلمُ الشعبة كما هو (٣ أكتوبر ٢٠٢٦) ═══
              كان «تُفتح الشعبةُ للتسجيل حين تُعتمَد» ثمّ «فُتحت باعتمادها» لكلّ شعبة —
              وشعبةُ الإعداد يُعتمَد خطُّها ولا يُرفع علمُها: تفتحها الإدارةُ بقرارٍ
              منفصل. فالجملةُ من حالها (`registration-state.ts`). */}
          {planPeriod && (() => {
            const line = trainerRegistrationLine({
              registrationOpen: ws.cohort.readOnly.registrationOpen ?? true,
              /* المعتمَدةُ مرّةً تبقى تقبل المسجَّلين وإن رُوجعت بعدها (٣ج-٣) */
              awaitingPlan: !approved && !ws.approvedOnce,
              joinClosesAt: joinClosesAt(planPeriod, content.slots),
            }, new Date());
            return (
              <p className="mt-2 text-read leading-6 text-muted-foreground">
                {line.lead}{line.date && <b className="text-foreground">{line.date}</b>}{line.tail}
              </p>
            );
          })()}
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
          {/* ═══ المنهجُ كما سيُعتمَد (المرحلة ٣) ═══

              «صفحةٌ توضح كلَّ ما كتبه بالترتيب… وكأنّها منهجٌ متكاملٌ لدورته من
              الألف إلى الياء، يقرؤه فتلهمه أيَّ تعديلات فيعود للتعديل بالمراحل
              السابقة» (صاحب المنصّة). فهي قبل الموافقة لا بعدها: يقرأ ثمّ يُقرّ.
              وهي الصفحةُ نفسُها التي يقرؤها المعتمِد — فلا يُعتمَد غيرُ ما رآه —
              وفي كلّ قسمٍ «عدّل» يعيده إلى خطوته. */}
          {/* ═══ وما غيّرتَه عن المعتمَد — ما يقرؤه المعتمِدُ أوّلا (٣ج-٤) ═══
              المراجعةُ تُقرأ بما تغيّر فيها لا بالمنهج كلِّه — والسطورُ هنا من
              القاعدة نفسِها التي يقرأ بها المعتمِد، على ما في يدك الآن. */}
          {ws.approvedPlan && (
            <div className="mt-5" role="region" aria-label="ما غيّرتَه عن المعتمَد">
              <p className="text-read font-black text-foreground">ما غيّرتَه عن الخطّة المعتمَدة — وهو أوّلُ ما يقرؤه المعتمِد</p>
              <div className="mt-2">
                <PlanDiffList
                  sections={planDiff(ws.approvedPlan.content, content, { date: cohortDayAr })}
                  emptyText="لم تغيّر في الخطّة نفسِها شيئا بعد — ونقلُ اللقاءات وتعديلُ المهامّ يُعتمَد وحدَه، أمّا ربطُ لقاءٍ بمحاوره فيسري فورا بلا اعتماد."
                />
              </div>
            </div>
          )}
          <div className="mt-5">
            <p className="text-read font-black text-foreground">منهجُ شعبتك كما سيقرؤه المعتمِد — ثمّ متعلّموك بالترتيب</p>
            <div className="mt-2">
              <CurriculumReview
                view={curriculumView({
                  title: identity.title.trim() || ws.cohort.title,
                  period: planPeriod,
                  content,
                  sessions: ws.sessions,
                  assessments: ws.assessments,
                  approvedOnce: ws.approvedOnce,
                })}
                onEdit={(s) => openStage(s)}
              />
            </div>
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-read leading-6">
            <input id="plan-confirm" type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} disabled={locked || approved} className="mt-1 h-4 w-4 accent-teal" />
            <span>أوافق على كلّ ما في هذه الشعبة — مواعيدَها ومحاورَها وكرّاساتِها ولقاءاتِها وتسجيلاتِها ومهامَّها ومصادرَها — وأتحمّل تقديمَها كما هي.</span>
          </label>
          {/* والإرسالُ بزرّ الشريط نفسِه — «أرسِلها للاعتماد» في هذه الدرجة: ذهبيٌّ
              واحدٌ يتبدّل اسمُه، لا ذهبيّان يتنازعان العين. */}
          {!approved && !locked && (
            <p className="mt-3 text-read leading-6 text-muted-foreground">
              أكّد، ثمّ اضغط <b className="text-foreground">«أرسِلها للاعتماد»</b> في الشريط أعلاه.
            </p>
          )}
        </Panel>
      )}

    </TrainerLayout>
  );
}
