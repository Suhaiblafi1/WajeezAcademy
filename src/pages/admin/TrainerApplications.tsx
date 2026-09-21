import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { toast, toastError } from "@/components/Toast";
import {
  ArrowDownWideNarrow, ArrowUpNarrowWide,
  CalendarCheck, CalendarX2, CheckCircle2, ChevronDown, ChevronLeft, ClipboardList, FileText, History,
  KeyRound, Loader2, MailCheck, MoreVertical, RefreshCw, RotateCcw, Send, ServerOff,
  SlidersHorizontal, Star, Trash2, UserPlus, XCircle,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import ListToolbar from "@/components/admin/ListToolbar";
import WorkHeader from "@/components/admin/WorkHeader";
import BulkBar from "@/components/admin/BulkBar";
import { bulkMessage, runBulk } from "@/application/admin/bulk";
import { matchesQuery } from "@/application/text/search-ar";
import { INTERVIEW_OUTCOMES, outcomeLabelAr } from "@/application/trainer/interview-outcome";
import { STATUS_LABELS } from "@/application/trainer/application-status";
import { bookingLabel, facetsOf, resultKey, verdictBadges, RESULT_CONTESTED, RESULT_NONE, type ReviewVerdict } from "@/application/trainer/queue-labels";
import { staffAreaCls, staffControlCls, staffSelectCls } from "@/components/FormKit";
import { paginate } from "@/application/admin/paginate";
import { SORT_OPTIONS, sortApplications, type SortDir, type SortKey } from "@/application/trainer/application-sort";
import type { SyncTrust } from "@/application/trainer/interview-sync-trust";
import FlowSteps from "@/components/FlowSteps";
import { apiGet, apiPost, apiDelete, ApiError } from "@/services/api";
import { useSearchParams } from "react-router";
import { useRealSession } from "@/services/session";
import { useAutoRefresh } from "@/services/useAutoRefresh";
import { TrainerDetailOps, TrainerChangeRequests, type TrainerSummary } from "./TrainerOps";
import ApplicationDossier, { type Dossier } from "./ApplicationDossier";
import ProposalsEditor from "./ProposalsEditor";
import { teachableCountAr } from "@/application/trainer/teachable-proposals";
import InterviewSheet from "./InterviewSheet";
import ReviewerLinks from "./ReviewerLinks";
import { canRemindToBook, yearsLabel } from "@/application/trainer/application-options";
import { mailBatchOutcomeAr, mailOutcomeAr } from "@/application/notifications/delivery";
import { MAIL_LINK_WINDOW_AR } from "@/application/links/mail-link-window";
import { fmtDateTime } from "@/application/text/format-ar";
import ConfirmAction from "@/components/ConfirmAction";
import { BAR_ACTIONS, BULK_ACTIONS, DECISIONS, recommendedFor, type Decision } from "@/application/trainer/decisions";
import type { Readiness } from "@/application/trainer/readiness";
import PreparationSteps, {
  type PrepContract, type PrepProposal, type PrepQualification, type PrepRule,
} from "./PreparationSteps";
import { PURGEABLE_STATUSES } from "@/application/trainer/purgeable";

import { Panel, Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import TabBar from "@/components/ui/TabBar";
import { RUBRIC_AXES } from "@/application/trainer/rubric";
/* الحالاتُ التي يقبل الخادمُ حذفَها — تُقرأ من مصدرها لا تُكتب هنا.
   ونسخةٌ ثانيةٌ تنحرف يوما فيَعِد الزرُّ بما يرفضه الخادم. */
const PURGEABLE: string[] = [...PURGEABLE_STATUSES];

/** من يُذكَّر بالحجز — المِحَكُّ من الوحدة المشتركة، وهو نفسُه الذي يحرس
    المسار في الخادم. ولا يُعاد كتابتُه هنا: نسختان تنحرفان. */
const canRemind = (a: { status: string; interviewsCount: number }): boolean =>
  canRemindToBook({ status: a.status, liveInterviews: a.interviewsCount });

/* ═══ نتيجةُ اللقاء في الصفّ — بلونها لا بلونٍ واحد ═══

   «يجتاز أو لا يجتاز» هو ما يُقرَّر عليه، فيُقرأ بالعين قبل النصّ: الأخضرُ
   اجتاز، والأحمرُ لم يجتز، والذهبيُّ معلَّق، والهادئُ لم يحضر — وهو خبرٌ عن
   موعدٍ لم يقع لا حكمٌ على صاحبه. والأسماءُ من `interview-outcome.ts`
   وحدَها، فلا تُكتب هنا ثانية. */
const OUTCOME_TONE: Record<string, string> = {
  passed: "border-emerald-400/40 text-emerald-300",
  failed: "border-red-400/40 text-red-300",
  hold: "border-gold/40 text-gold-ink",
  no_show: "border-white/20 text-muted-foreground",
};

/* ═══ ومصدرُ النتيجة يُكتب حين يكون لها منازع (٢١ سبتمبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «نتيجةُ التقييم… إذا كانت مطابقةً [للمسجَّلة] وإن
   كانت مختلفةً نُظهر الاثنين. هذا سيكون لنا دليلٌ أنّ المقابلة تمّت وهذه
   نتيجتُها».

   فحين تُعرض واحدةٌ لا يُكتب مصدرُها: لا منازعَ لها، والبادئةُ ضجيجٌ في
   كلّ صفّ. وحين تُعرض اثنتان **يلزم** أن يُعرف أيُّهما قولُ مُجرِي المقابلة
   وأيُّهما قولُ القارئ في رابطه — وإلّا قُرئ صفٌّ يقول شيئين متناقضين بلا
   قائل. */
const VERDICT_SOURCE_AR: Record<string, string> = {
  recorded: "المسجَّل",
  review: "التقييم",
};

/* ═══ وصدرُ ليبل الموعد — كلمةٌ لكلّ حال ═══

   و«مضى موعدُه — بلا نتيجة» لا تُقال إلّا حين لا قولَ لنا فيه أصلا: شكا
   صاحبُ المنصّة (٢١ سبتمبر ٢٠٢٦) أنّ صفّا يحمل «بلا نتيجة» وإلى جانبه
   شارةُ «يجتاز» — «ونحن وضعنا نتيجتَه وهي ظاهرة». والحكمُ في
   `queue-labels.ts`، وهذه ألفاظُه. */
/* ═══ وحالان ليستا في معجم النتائج — وهما مرشِّحان لا نتيجتان ═══

   «بلا نتيجة» غيابُ قولٍ لا قول، و«مختلَفٌ عليه» قولان لا واحد. وكلاهما
   يُرشَّح به فيلزمه لفظٌ — ولا يُقحمان في `INTERVIEW_OUTCOMES`: ذاك ما
   يقبله الخادمُ ويُكتب في العمود، وهذان محسوبان في الشاشة. */
const RESULT_LABEL_AR: Record<string, string> = {
  [RESULT_NONE]: "بلا نتيجة",
  [RESULT_CONTESTED]: "مختلَفٌ عليه",
};

const BOOKING_LEAD_AR: Record<string, string> = {
  upcoming: "موعدُه",
  held: "جرى لقاؤه",
  overdue: "مضى موعدُه — بلا نتيجة",
};

/* ═══ وليبلُ الموعد — أربعةُ أحوالٍ بثلاث نبرات ═══

   «موعدُه القادم» خبرٌ هادئ: لا عملَ تحته حتّى يحين. و«مضى ولم تُسجَّل
   نتيجتُه» ذهبيٌّ لأنّه **عملٌ علينا نحن** — لقاءٌ جرى وينتظر من يكتب قولَه
   فيه، وهو ما يُبقي الطلبَ واقفا بصمت. و«لم يحجز» هادئٌ كذلك: هو خبرٌ عن
   موعدٍ لم يُحجَز لا حكمٌ على صاحبه، وزرُّ التذكير في قائمة الصفّ هو عملُه. */
const BOOKING_TONE: Record<string, string> = {
  upcoming: "border-white/20 text-muted-foreground",
  /* و«جرى لقاؤه» هادئٌ كالقادم: خبرٌ عن موعدٍ وقع، وقولُنا فيه في شارته */
  held: "border-white/20 text-muted-foreground",
  overdue: "border-gold/40 text-gold-ink",
  unbooked: "border-white/15 text-muted-foreground/80",
};

/* «١ طلبٌ» و«٢ طلبان» و«٣ طلبات» و«١١ طلبا» — والعددُ يُقرأ لا يُحسب */
const APP_FORMS = { one: "طلبٌ", two: "طلبان", few: "طلبات", many: "طلبا" };

/* أقسامُ الملفّ كما تُقرأ لا كما تُخزَّن. والمعرّفاتُ هي نفسُها الموضوعةُ على
   الأقسام هنا وفي `TrainerOps`، ومن قفز إلى قسمٍ مطويٍّ فتحه القسمُ نفسُه. */
const DOSSIER_SECTIONS: { id: string; label: string }[] = [
  { id: "sec-profile", label: "المتقدّم وملفّه" },
  { id: "sec-docs", label: "الوثائق" },
  { id: "sec-history", label: "سجلّ الحالة" },
  { id: "sec-questions", label: "أسئلةُ المقابلة" },
  { id: "sec-interviews", label: "المقابلات" },
  { id: "sec-contract", label: "العقد والتوقيع" },
  { id: "sec-rubric", label: "الروبرك والقرار" },
];



/* ═══ قائمةُ أفعالِ الصفّ — فعلٌ من الطابور بلا فتحِ ملفّ ═══

   طلبها صاحبُ المنصّة (٢٠ سبتمبر ٢٠٢٦): «ضع أيقونةَ أكشن ينسدل فيها: اعتمد،
   اطلب منه تحديد موعد للمقابلة، ذكّره أن يكمل التقديم إذا كان مسوّدة…».

   وما فيها **يتبع حالةَ الطلب** لا يُعرض كلُّه مطفأً: قائمةٌ من ستّةِ أفعالٍ
   أربعتُها رماديّةٌ تُعلّم القارئَ ألّا يقرأها. فمن كان مسوّدةً رأى «ذكّره
   بإكمال طلبه» ولم يرَ «اعتمِدْه»، ومن رُدّ رأى «تراجَعْ عن الرفض» وحدَه.

   والإغلاقُ بمستمعٍ على المستند لا بستارةٍ `fixed`: عرفُ `StaffAccountMenu`
   نفسُه، ومكتوبٌ هناك لماذا (`backdrop-filter` يحبس `fixed` في حاملها). */
interface RowAction {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "danger";
  run: () => void;
}

function RowActions({ items, label }: { items: RowAction[]; label: string }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="relative shrink-0">
      {/* زرٌّ من سلّم النظام لا صيغةٌ مكتوبةٌ بيدها — وكذلك لوحُ القائمة
          تحته: `design-system.test.ts` يعدّ ما كُتب بيده ويحدُّه. */}
      <Button
        tone="ghost" size="sm" icon={MoreVertical}
        aria-haspopup="menu" aria-expanded={open}
        aria-label={`إجراءات ${label}`}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <Inset
          role="menu" tone="solid"
          className="absolute left-0 z-30 mt-1 w-64 p-1 shadow-xl"
        >
          {items.map((it) => (
            <button
              key={it.key} role="menuitem" type="button"
              onClick={() => { setOpen(false); it.run(); }}
              className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-right text-read font-bold transition ${
                it.tone === "danger" ? "text-red-300 hover:bg-red-500/10" : "text-foreground hover:bg-white/5"
              }`}
            >
              <it.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {it.label}
            </button>
          ))}
        </Inset>
      )}
    </div>
  );
}

/** تبويبا الملفّ: من هو، وماذا يُدرّس — لا شاشةٌ واحدة تُقرأ عمودا طويلا */
/* و«التجهيز» ثالثُها منذ ٢٠ سبتمبر ٢٠٢٦: الأتعابُ والدوراتُ والعقدُ في
   موضعٍ واحدٍ داخل ملفّ صاحبها — لا في ثلاث شاشاتٍ يُجمَع منها. */
type DetailTab = "dossier" | "courses" | "prep";

interface AppRow {
  id: string; reference: string; status: string; fullName: string; email: string;
  country: string | null; jobTitle: string | null; domainYears: string | null; trainingYears: string | null;
  specialties: string[]; createdAt: string; emailVerified: boolean; phase2Done: boolean;
  documentsCount: number; reviewsCount: number; interviewsCount: number;
  /** نتيجةُ آخر لقاءٍ غيرِ ملغى — `null` لمن لم يُقابَل أو لم تُسجَّل نتيجتُه */
  interviewOutcome: string | null;
  /** قراراتُ روابط التقييم بأسماء قائليها — أحدثُها أوّلا */
  reviewVerdicts: ReviewVerdict[];
  /** موعدُه المعلَّق — أقربُ قادمٍ بلا نتيجة، وإلّا فآخرُ ماضٍ ينتظر تسجيلَها */
  pendingInterviewAt: string | null;
  /** موعدُ آخر لقاءٍ قائمٍ له مهما كان حالُه — يُرتَّب به، ولا يُعرض */
  interviewAt: string | null;
  /** لحظةُ آخر حركةٍ في الطلب — تُحسب بها شارةُ العمر */
  waitingSince: string;
}

interface AppDetail extends Record<string, unknown> {
  id: string; reference: string; status: string; fullName: string; email: string;
  /** طلباتُ صاحبه السابقة — ومآلُ كلٍّ منها وملاحظتُه الداخليّة */
  priorApplications?: {
    reference: string; status: string; createdAt: string;
    decidedAt: string | null; noteAr: string | null;
  }[];
  jobTitle: string | null; country: string | null;
  motivation: string | null; bio: string | null; linkedinUrl: string | null;
  documents: { id: string; kind: string; originalName: string; storageKey: string }[];
  documentUrls: Record<string, string>;
  reviews: {
    id: string; scores: Record<string, number>; overallNote: string | null; createdAt: string;
    /** فارغٌ في المراجعات القديمة التي سبقت الروابط — وتُعرض «من داخل الإدارة» */
    reviewerName?: string | null; verdict?: string | null; coursesNote?: string | null; updatedAt?: string;
    /* الاتفاقُ الماليُّ إن ذُكر — نصّا لا رقما، ولا يقع به عقدٌ ولا دفعة */
    feeExpectationAr?: string | null; feeProposalAr?: string | null;
  }[];
  interviews: { id: string; scheduledAt: string; outcome: string | null; canceledAt: string | null }[];
  statusHistory: { fromStatus: string | null; toStatus: string; note: string | null; createdAt: string }[];
  profile: {
    id: string; userId: string | null;
    /* ما تقرؤه شاشةُ التجهيز — يصحب الملفَّ فلا تُطلب ثلاثةُ نداءاتٍ أخرى */
    courseProposals?: PrepProposal[];
    contracts?: PrepContract[];
    qualifications?: PrepQualification[];
  } | null;
  /** جاهزيّتُه للقبول الكامل — تُحسب في الخادم وتُقرأ هنا، فلا يَعِد زرٌّ بما يُردّ */
  readiness?: Readiness;
  /** القاعدةُ السارية كما حسبها `activeRule` — ولا تُستنتَج في المتصفّح */
  activeCompensationRule?: PrepRule | null;
  /** حسابُ المتقدّم — يُنشأ مع القسم الأوّل */
  userId: string | null;
  /** وقتُ التقديم — يُرسله الخادمُ دائما، ويُقرأ في ترويسة المطبوع */
  createdAt: string;
  /** فقرةُ الطلبات التي سبقت السجلّات (أ-٣) — تبقى تُقرأ وتُربط */
  teachableOther: string | null;
  /** سجلّاتُ ما يقترحه: عنوانٌ ولمن هو — تُربط واحدةً تلو الأخرى */
  teachableProposals?: unknown;
  summary?: TrainerSummary;
}

/* لوحُ الملخّص وتبويبُ الدورات.

   قرارُ صاحب المنصّة: «أضف لوحةَ ملخّص على ملفّ المدرب تعرض: الدورات المحالة
   له، تقييمات الطلبة له، شعبه الحالية، وأقرب جلسة قادمة».

   وأرقامُه من الخادم لا من الشاشة (`getApplication#summary`): من يبتّ في حالةٍ
   ينظر إلى أثرها — من له ثلاثُ شعبٍ جارية ليس كمن لا شعبةَ له، والقرارُ فيهما
   ليس واحدا. وحسابُها هنا يعني رقمين لشيءٍ واحد. */
function TrainerCoursesTab({ summary }: { summary?: TrainerSummary }) {
  if (!summary) {
    return (
      <Panel as="article" className="text-xs leading-6 text-muted-foreground">
        لا ملفَّ مدرّبٍ بعد — الملفُّ يُنشأ مع «القبول المشروط»، وقبله لا دورات ولا شعب.
      </Panel>
    );
  }
  const stat = (label: string, value: string) => (
    <Card className="bg-paper/20 p-3.5">
      <p className="text-read font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-black tabular-nums text-foreground">{value}</p>
    </Card>
  );
  return (
    <div className="space-y-4">
      <Panel as="article">
        <h4 className="flex items-center gap-2 text-sm font-black">
          <Star className="h-4 w-4 text-teal-light-ink" /> ملخّص المدرّب
        </h4>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-4">
          {stat("دورات مؤهَّل لها", String(summary.qualifiedCourses.length))}
          {stat("شعبٌ حاليّة", String(summary.cohorts.length))}
          {stat("متعلّمون", String(summary.cohorts.reduce((n, c) => n + c.enrolled, 0)))}
          {/* لا يُعرض صفرٌ مكان «لا تقييم بعد» — الصفرُ حكمٌ والغيابُ ليس حكما */}
          {stat("تقييم الطلبة", summary.ratingCount > 0 && summary.rating !== null
            ? `${summary.rating.toFixed(1)} · ${summary.ratingCount}`
            : "—")}
        </div>
        {summary.nextSession && (
          <Inset as="p" tone="accent" className="mt-3 px-3.5 py-2.5 text-read leading-6 text-teal-light-ink">
            أقرب جلسة: <b>{summary.nextSession.title}</b> — شعبة «{summary.nextSession.cohortTitle}» ·{" "}
            {fmtDateTime(new Date(summary.nextSession.startsAt))}
          </Inset>
        )}
      </Panel>

      <Panel as="article">
        <h4 className="text-sm font-black">الدورات المؤهَّل لها</h4>
        {summary.qualifiedCourses.length === 0 ? (
          <p className="mt-3 text-read leading-6 text-muted-foreground">
            لا دورة بعد. التأهيل يُطلب من الشعبة التي يُراد إسنادُه إليها، وموافقةُ المدير الأكاديميّ
            تؤهّله وتُسنده في فعلٍ واحد.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {summary.qualifiedCourses.map((c) => (
              <li key={c.courseId} className="rounded-full border border-teal/35 bg-teal/[0.08] px-3 py-1 text-fine font-bold text-teal-light-ink">
                {c.titleAr}
              </li>
            ))}
          </ul>
        )}
        {summary.pendingQualifications > 0 && (
          <p className="mt-3 text-read text-gold-ink">
            وله {summary.pendingQualifications} طلبُ تأهيلٍ بانتظار القرار.
          </p>
        )}
      </Panel>

      <Panel as="article">
        <h4 className="text-sm font-black">شعبُه الحاليّة</h4>
        {/* «المُسنَدُ له فعليّا» يُقرأ من كائن الشعبة لا من ملفّ المدرّب:
            مصدرُ الإسناد هناك، وقراءتُه من هنا تُنشئ مصدرا ثانيا يشيخ. */}
        {summary.cohorts.length === 0 ? (
          <p className="mt-3 text-read text-muted-foreground">لا شعبة مُسنَدة إليه الآن.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {summary.cohorts.map((c) => (
              <Inset as="li" key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-foreground">{c.title}</span>
                  <span className="text-fine text-muted-foreground">
                    {c.courseTitle} · {c.role === "lead" ? "رئيسي" : "مساعد"} · {c.enrolled} متعلّم
                  </span>
                </span>
                <span className="shrink-0 text-fine text-muted-foreground">
                  {c.startsAt ? fmtDateTime(new Date(c.startsAt)) : "بلا موعد"}
                </span>
              </Inset>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/** إدارة طلبات انضمام المدربين — API حقيقي: مراجعة بشرية، قرارات، عقد، دعوة آمنة */
export default function TrainerApplications() {
  /* `?app=<id>` — الملفُّ المفتوحُ موضعٌ في التاريخ لا حالةٌ في الذاكرة.
     تفصيلُه عند `openDetail` أسفلُ. */
  const [searchParams, setSearchParams] = useSearchParams();
  const openApp = searchParams.get("app");
  const [apps, setApps] = useState<AppRow[]>([]);
  const [filter, setFilter] = useState("");
  /* ومرشِّحُ النتيجة — بُعدٌ ثانٍ لا بديلٌ عن الأوّل: «واحدٌ للّيبل الرئيسيّ
     وهو نشط أو مرفوض، والثاني لنتيجة التقييم». ويجتمعان بالواو لا بالأو. */
  const [resultFilter, setResultFilter] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(50);
  /* والافتراضُ هو ما كان قبل الخيار: أقدمُ أوّلا — صاحبُه أطولُ انتظارا */
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  /* أيَثِقُ الطابورُ بما يعرفه عن الحجز؟ — `null` حتّى يُقرأ الجواب */
  const [syncTrust, setSyncTrust] = useState<SyncTrust | null>(null);
  /* التحديدُ يبقى عبر الصفحات والبحث — والشريطُ يقول على كم يقع، فلا يُنفَّذ
     على صفٍّ غاب عن العين بلا علمِ صاحب القرار. */
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState("");
  /* رفضٌ أو انتظارٌ على دفعةٍ: كلاهما يصل صاحبَ الطلب، فسببُه يُكتب أوّلا —
     ووجهةُ السبب تختلف بينهما، ومكتوبٌ عند النافذة أدناه كيف. */
  const [bulkDecision, setBulkDecision] = useState<{ action: string; labelAr: string } | null>(null);
  /* قرارٌ على صفٍّ واحدٍ من قائمة أفعاله — والسببُ يُكتب في نافذته لا في
     خانةٍ عامّة، كما في نظيرَيه داخل الملفّ. */
  const [rowDecision, setRowDecision] = useState<{ app: AppRow; action: "reject" | "undo_reject" } | null>(null);
  /* ═══ مرشِّحُ «لم يحجز موعدا» ═══

     الطابورُ يعرض عددَ المقابلات في كلّ صفّ، ومن أراد من لم يحجز عدَّ الأصفارَ
     بعينه في عشرات الصفوف. وهم بعينهم من يُذكَّر — فصار سؤالا يُضغط.

     وهو في الشاشة لا في الخادم: الحالةُ تُرشَّح هناك، وهذا يعمل على ما وصل
     فيُقرأ أثرُه فورا بلا نداءٍ ثانٍ. */
  const [onlyUnbooked, setOnlyUnbooked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [selected, setSelected] = useState<AppDetail | null>(null);
  const [note, setNote] = useState("");
  /* خانةُ «ما الذي نريده منه» — منفصلةٌ عن ملاحظة المراجع: تلك تُكتب لنا،
     وهذه تصل المتقدّمَ بنصّها في رسالةٍ وفي صفحة حالته. وخلطُهما يُرسل إليه
     ما كُتب عنه. */
  const [askNote, setAskNote] = useState("");
  const [askOpen, setAskOpen] = useState(false);
  /* نافذةُ التراجع عن الرفض — مفتوحةٌ أو لا. والسببُ يُكتب فيها لا في خانة
     الملاحظة: يسافر إلى المتقدّم بنصّه، والخادمُ يشترطه (٤٢٢ دونه). */
  const [undoOpen, setUndoOpen] = useState(false);
  /* ═══ حوارُ تجاوز بوّابة التجهيز — للمدير الأعلى وحدَه ═══

     ولا يُخفى الزرُّ عمّن لا يملك التجاوز: إخفاؤه يترك من ضغط لا يعرف لمَ
     اختفى. فهو ظاهرٌ معطَّلٌ، وتحته سطرٌ يقول ما ينقص — ومن ملك التجاوزَ
     فُتح له هذا الحوارُ بسببٍ يُكتب. */
  const [overrideOpen, setOverrideOpen] = useState(false);
  /* الوثيقةُ المفتوحةُ داخل الشاشة — لا لسانٌ ثانٍ يُفقِد المراجعُ موضعَه */
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  /* الاقتراحُ الذي يُربط الآن — معرّفُ طلبه وترتيبُه ونصُّه، لا كائنُ الطلب */
  /* والحذفُ مطويٌّ افتراضا — ليس عملا يوميّا، ولا يُجاور أزرارَ القرار */
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<DetailTab>("dossier");
  const { user } = useRealSession();
  /* المحوُ للمدير الأعلى وحدَه — ومن لا يملك حبّتَه لا يرى البابَ أصلا */
  const canPurge = user?.permissions?.includes("trainer.applications.purge") ?? false;
  const [purging, setPurging] = useState<AppDetail | null>(null);
  /* رابط الدعوة بعد إنشائها — يُعرض للمسؤول ليسلّمه حين لا يصل البريد */
  const [invite, setInvite] = useState<{ url: string; delivery: string } | null>(null);
  const [mode, setMode] = useState<"apps" | "changes">("apps");
  /* ═══ وما بقي من الألسنة — ولماذا خرج الآخران ═══

     ═══ «التأهيل والإسناد» خرج إلى شاشته (٢١ سبتمبر ٢٠٢٦) ═══

     سأل صاحبُ المنصّة: «لماذا التأهيل والإسناد موجود هنا؟». وقد كان
     محروسا بـ`trainer.qualify` فلا يُردّ من يراه — غير أنّ الحراسةَ
     عالجت الردَّ ولم تعالج **الموضع**: هذه شاشةُ من لم يصر مدرّبا بعد،
     وتلك سلسلةُ من صار. فصار له بابُه في «المدرّبون — التشغيل»
     (`/admin/trainer-run`) بين أخواته: الإسنادُ والمساراتُ والرحيل.

     وهو عرفُ «أتعاب المدرّبين» نفسُه: نقلُ البابِ لا توسيعُ المفتاح.

     ═══ وما بقي: لسانٌ لا يدخله شيء ═══

     سأل صاحبُ المنصّة (٢١ سبتمبر ٢٠٢٦): «لماذا يوجد لسانا التأهيل والإسناد
     واقتراحات التعديل؟ هل نصل إليهما من حساب كلّ مدرّب؟ فلماذا هما هنا
     إذًا؟». وتحت السؤال عطبان:

     ① **لسانٌ يُعرض لمن يُردّ عند أوّل نقرة.** بابُ هذه الشاشة
        `trainer.applications.view`، ونداءَا «التأهيل والإسناد» كلاهما
        (`/trainers/ops` و`/qualification-requests`) يشترطان
        `trainer.qualify`. فالمنسّقُ الأكاديميُّ ومديرُ العمليّات يريانه
        ويُردّان عند التحميل نفسِه. وهو العطبُ الذي خرجت له «أتعاب
        المدربين» إلى شاشتها، فلا يُعاد من باب آخر.

     ② **ولسانٌ لا يدخله شيء.** «اقتراحات تعديل الدورات» طابورُ قرارٍ
        بلا بريد: مسالكُ الإرسال من جانب المدرّب حُذفت (٨ سبتمبر ٢٠٢٦)
        وقناةُ اسم الدورة أُغلقت بقراره (١٧ سبتمبر). فهو فارغٌ أبدا، وكان
        يقول لقارئه «تصل من بوابة المدرب ← اقتراحاتي» — وذاك بابٌ لا وجودَ
        له.

     **ولا يُحذف مسارُه**: قد يبقى في القاعدة اقتراحٌ أُرسل قبل حذف الباب
     ولم يُبتَّ فيه (هجرةُ الإغلاق لم تمسّ إلّا `course_title_edit`)، وحذفُ
     شاشته يتركه بلا من يراه. فاللسانُ يُطوى ولا يختفي: لا يُعرض إلّا إذا
     كان فيه ما ينتظر، وعددُه مكتوبٌ عليه. */
  const canReviewChanges = user?.permissions?.includes("trainer.change.review") ?? false;
  const [openChanges, setOpenChanges] = useState(0);

  /* ═══ الطابورُ كلُّه يُجلَب مرّةً، ثمّ يُرشَّح هنا (٢١ سبتمبر ٢٠٢٦) ═══

     كان يُجلَب مرشَّحا بالحالة من الخادم، فالشاشةُ لا ترى إلّا ما رُشِّح —
     ولا تستطيع أن تقول «كم نشطا؟» وهي ترى المرفوضين وحدَهم. وعدُّ الشارات
     يحتاج أن يُرى الطابورُ كلُّه، ومرشِّحُ النتيجة محسوبٌ من الصفّ لا عمودٌ
     يُستعلَم عنه.

     فنداءٌ واحدٌ بلا حالة، والترشيحُ والعدُّ من المصفوفة نفسِها: لا يفترق
     عددٌ على شارةٍ عن الصفوف التي تفتحها، ولا يُنتظَر نداءٌ عند كلّ نقرة.

     وحدُّه معروف: الصفوفُ تُجلَب كلُّها، وهي مئاتٌ اليومَ. فإن بلغت آلافا
     لزم ترقيمٌ في الخادم — ويُقاس قبل أن يُبنى. */
  const load = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setOffline(null); }
    try {
      setApps(await apiGet<AppRow[]>("/api/admin/trainer-applications"));
    } catch (err) {
      if (!silent) setOffline(err instanceof ApiError ? err.message : "الخادم غير متصل — شغّل واجهة API أولا");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  /* ولا يُسقِط فشلُ هذا الطابورَ: هو خبرٌ عن الطابور لا الطابور */
  useEffect(() => {
    void apiGet<SyncTrust>("/api/admin/trainer-applications/interview-sync")
      .then(setSyncTrust)
      .catch(() => setSyncTrust(null));
  }, []);
  /* وعددُ ما ينتظر في طابور الاقتراحات — ولا يُنادى من لا يملك بابَه، فنداءٌ
     يُردّ ٤٠٣ في كلّ فتحةِ شاشةٍ ضجيجٌ في السجلّ لا خبرٌ فيه. ولا يُسقِط
     فشلُه الطابورَ: هو خبرٌ عن لسانٍ آخر. */
  useEffect(() => {
    if (!canReviewChanges) { setOpenChanges(0); return; }
    void apiGet<{ open: number }>("/api/admin/trainer-change-requests/open-count")
      .then((r) => setOpenChanges(r.open))
      .catch(() => setOpenChanges(0));
  }, [canReviewChanges]);
  /* نبض صامت كل دقيقة — طلبات الترشح الجديدة تظهر دون تحديث يدوي */
  const silentReload = useCallback(() => { void load(true); }, [load]);
  useAutoRefresh(silentReload, 60_000);

  /* ═══ الملفُّ المفتوحُ يسكن العنوانَ لا الحالةَ وحدَها (٢٠ سبتمبر ٢٠٢٦) ═══

     شكا صاحبُ المنصّة: «أدخل ملفَّ طلبِ مدرّبٍ فأستصعب العودةَ للقائمة —
     الرجوعُ بالمتصفّح يأخذني لرئيسيّة الإدارة، والنقرُ على «طلبات المدربين»
     لا يعمل، فلا يبقى إلّا أن أصعد للأعلى».

     وعلّتُهما واحدة: `openDetail` كانت تكتب في `useState` ولا تمسّ العنوان.
     فالملفُّ ليس موضعا في التاريخ — والرجوعُ يغادر الشاشةَ كلَّها لأنّ
     آخرَ موضعٍ سُجّل هو ما قبلها. والنقرُ على اسم الشاشة في الشريط يذهب
     إلى `/admin/trainers` وهو العنوانُ الذي نحن فيه، فلا يتغيّر شيءٌ ولا
     تُمسح الحالة — فيبدو الزرُّ ميّتا وهو سليم.

     فصار الملفُّ `?app=<id>`: الرجوعُ يمحوه فتعود القائمة، والنقرُ على
     اسم الشاشة يذهب إلى العنوان بلا مُعامِل فتعود كذلك، والرابطُ يُنسخ
     إلى زميلٍ فيفتح عنده ما تفتحه أنت، والتحديثُ لا يضيّع الموضع.

     و«افتحْ» غيرُ «أعِدْ قراءتَه»: الأولى تنقل — تكتب في العنوان ويتبعها
     الجلبُ — والثانيةُ تجلب وحدَها بعد فعلٍ غيّر الملفَّ ومعرّفُه هو هو. */
  const openDetail = (id: string) => {
    setSearchParams((prev: URLSearchParams) => {
      const next = new URLSearchParams(prev);
      next.set("app", id);
      return next;
    });
  };

  const closeDetail = () => {
    setSearchParams((prev: URLSearchParams) => {
      const next = new URLSearchParams(prev);
      next.delete("app");
      return next;
    });
  };

  const loadDetail = useCallback(async (id: string) => {
    try {
      const detail = await apiGet<AppDetail>(`/api/admin/trainer-applications/${id}`);
      setSelected(detail);
      setNote("");
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "تعذر فتح الطلب");
      /* وما لا يُفتح لا يبقى في العنوان: معرّفٌ محذوفٌ أو لا صلاحيّةَ عليه
         يُبقي الشاشةَ فارغةً كلَّما رجع إليها صاحبُها. */
      setSearchParams((prev: URLSearchParams) => {
        const next = new URLSearchParams(prev);
        next.delete("app");
        return next;
      });
    }
  }, [setSearchParams]);

  /* والعنوانُ هو المصدر: منه يُجلب الملفُّ، وبمحوه يُغلَق. فلا موضعَ ثانٍ
     للحقيقة يفترق عن الأوّل. */
  useEffect(() => {
    if (!openApp) { setSelected(null); return; }
    if (selected?.id !== openApp) void loadDetail(openApp);
  }, [openApp, selected?.id, loadDetail]);

  /* ═══ والخبرُ يتبع الجواب لا النيّة ═══

     كان `doneMsg` نصّا ثابتا يُعرض بعد كلّ فعلٍ نجح نداؤه. ومسالكُ البريد
     تردّ حالَ رسالتها (`emailDelivery`)، فكانت تُرمى: تُعرض «أُرسل» ولو ردّ
     الخادمُ أنّ شيئا لم يخرج. فصار المُنادي يستطيع أن يقرأ الجوابَ ويصوغ
     الخبرَ منه — و`mailOutcomeAr` تكتب الجملةَ فلا تُعاد صياغتُها في كلّ
     زرّ. ونبرةُ الخبر تتبع `ok`: ما لم يخرج لا يُعرض أخضرَ. */
  const act = async (
    fn: () => Promise<unknown>,
    doneMsg: string | ((result: unknown) => { ar: string; ok: boolean }),
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await fn();
      const said = typeof doneMsg === "string" ? { ar: doneMsg, ok: true } : doneMsg(result);
      if (said.ok) toast(said.ar); else toastError(said.ar);
      if (selected) await loadDetail(selected.id);
      await load();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : "تعذر تنفيذ الإجراء");
    } finally {
      setBusy(false);
    }
  };

  /* المحوُ: رفضٌ أوّلا إن لزم، ثمّ حذفٌ بالمرجع. والجوابُ يُقال كما هو —
     كم ملفّا مُحي من القرص، وهل ذهب الحساب أم بقي ولماذا. */
  const purgeApplication = async (target: AppDetail, reasonAr: string) => {
    setBusy(true);
    try {
      if (!PURGEABLE.includes(target.status)) {
        await apiPost(`/api/admin/trainer-applications/${target.id}/decision`, {
          action: "reject", note: reasonAr,
        });
      }
      const r = await apiDelete<{
        deletedDocuments: number; unremovedFiles: string[];
        deletedAccount: boolean; keptAccountReason: string | null;
      }>(`/api/admin/trainer-applications/${encodeURIComponent(target.reference)}`, { reasonAr });

      const parts = [`حُذف ${target.reference}`];
      if (r.deletedDocuments > 0) parts.push(`و${r.deletedDocuments} وثيقة`);
      if (r.deletedAccount) parts.push("وحسابُه");
      else if (r.keptAccountReason) parts.push(`وبقي حسابُه — ${r.keptAccountReason}`);
      toast(parts.join(" "));
      /* وما لم يُمحَ يُقال صريحا: «تمّ» لا تُقال عن نصفِ فعل */
      if (r.unremovedFiles.length > 0) {
        toastError(`بقي ${r.unremovedFiles.length} ملفّا على القرص لم يُمحَ — راجِعها يدويّا`);
      }
      /* ويُمحى المُعامِلُ لا المعروضُ وحدَه: لو بقي `?app=` بعد المحو لَأعاد
         الأثرُ جلبَ طلبٍ لم يعد له وجود، فيُقرأ «تعذّر فتح الطلب» أحمرَ فوق
         حذفٍ نجح. */
      closeDetail();
      await load();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر الحذف");
    } finally {
      setBusy(false);
    }
  };

  /* ═══ الألسنةُ المعروضة — وما لا يُعرض لا يُقصَد ═══

     «الطلبات» لا شرطَ لها: بابُ الشاشة هو بابُها. و«التأهيل والإسناد»
     بـ`trainer.qualify` — وهي ما يشترطه نداءاه كلاهما، فلا يُعرض لسانٌ
     يُردّ عند تحميله. و«اقتراحات تعديل الدورات» بوجود ما ينتظر فيه، وعددُه
     مكتوبٌ عليه: طابورٌ يُعرض فارغا أبدا يزاحم عينَ من يفرز. */
  const tabs = ([
    { key: "apps", label: "الطلبات", show: true },
    { key: "changes", label: `اقتراحات تعديل الدورات (${openChanges})`, show: openChanges > 0 },
  ] as const).filter((t) => t.show);

  /* ومن كان في لسانٍ ثمّ لم يعد يُعرض يعود إلى «الطلبات» — ولا يُترك أمام
     شاشةٍ بيضاء: اللسانُ المرسومُ والمحتوى المعروضُ يقرآن هذه لا `mode`. */
  const shown: "apps" | "changes" = tabs.some((t) => t.key === mode) ? mode : "apps";

  /* ما ينتظر الفرزَ الأوّليَّ: `submitted` وحدَها — وهي الخطوةُ التي يقول
     شريطُ المسار فيها «أنت هنا». وما بعدها بيد اللجنة الأكاديميّة، فعدُّه
     في الرأس يَعِد بعملٍ ليس لصاحب هذه الشاشة.

     والأقدمُ أوّلا: صاحبُه أطولُ انتظارا، وترتيبُ الخادم ليس مضمونا. */
  const triage = apps
    .filter((a) => a.status === "submitted")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  /* ═══ الشاراتُ تُبنى ممّا في الطابور لا من قائمةٍ مكتوبة (٢١ سبتمبر ٢٠٢٦) ═══

     شكا صاحبُ المنصّة: «أشعر أنّ الفرزَ معقّد… اجعلْ ليبلاتِ الفرز الرئيسيّة
     تخرج ممّا استعملناه فعلا: إن كان عندنا نشطٌ فضعْه في الأعلى، وإن كان
     مرفوضٌ فضعْه، وهكذا».

     وكانت أربعا مكتوبةً بيدها لا تتبدّل — فبقيت «موقوف» بلا شارةٍ وهي في
     الطابور، وبقيت شارةٌ تُعرض لحالةٍ لا أحدَ فيها. فصارت تُحسب: ما وُجد
     عُرض بعدده، وما خلا لم يُعرض أصلا.

     وترتيبُها ترتيبُ `STATUS_LABELS` — دورةُ حياة الطلب — لا الأكثرَ عددا:
     شارةٌ تقفز من موضعها كلّما تبدّل رقمٌ تُفقد اليدَ موضعَها. */
  const statusFacets = facetsOf(Object.keys(STATUS_LABELS), apps, (a) => a.status);

  /* والنتيجةُ بُعدٌ ثانٍ: «هو نشطٌ وتقييمُنا يقول اجتاز — وهما شيئان» */
  const resultFacets = facetsOf(
    [...INTERVIEW_OUTCOMES.map((o) => o.key), RESULT_CONTESTED, RESULT_NONE], apps, resultKey,
  );

  /* الترشيحُ كلُّه هنا على ما وصل — والبُعدان يجتمعان بالواو.

     وترتيبُ الحالة يقرأ `STATUS_LABELS` نفسَه: هو مكتوبٌ بدورة الحياة
     أصلا، ونسخُ ترتيبِه في معجمٍ ثانٍ يعني معجمَين يفترقان عند أوّل
     حالةٍ تُضاف. */
  const view = paginate(
    sortApplications(
      apps
        .filter((a) => !filter || a.status === filter)
        .filter((a) => !resultFilter || resultKey(a) === resultFilter)
        .filter((a) => !onlyUnbooked || canRemind(a))
        .filter((a) => matchesQuery(q, [a.fullName, a.email, a.reference, a.jobTitle, ...a.specialties])),
      sortKey, sortDir, Object.keys(STATUS_LABELS),
    ),
    /* ═══ وخمسون في الصفحة لا عشرون (٢٠ سبتمبر ٢٠٢٦) ═══

       «زد عدد المتقدّمين في الصفحة الواحدة». وقد أمكن: الصفُّ صار أربعَ
       حقائقَ في سطرٍ واحد بعد أن كان أربعةَ أسطر، فخمسون منه أقصرُ ممّا
       كان عشرون. ولا يُرفع أكثر: الترشيحُ والبحثُ فوقَه هما ما يُقصّر
       الطابورَ حقّا، لا صفحةٌ تُمرَّر بلا نهاية. */
    page, size);

  const toggleSel = (id: string) => setSel((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  /* لا يُعرض إلّا ما يصلح للمحدَّد **كلِّه**: إجراءٌ يصلح لبعضه يُنتج إخفاقا
     جزئيّا لا سببَ له إلّا أنّا عرضناه. */
  const selectedRows = apps.filter((a) => sel.has(a.id));
  const commonActions = selectedRows.length === 0 ? [] :
    DECISIONS.filter((d) => BULK_ACTIONS.includes(d.action) && selectedRows.every((a) => d.from.includes(a.status)));

  /* السببُ يأتي من نافذة التأكيد لا من حوار متصفّح — و**لا يُقرأ من حالة
     الصفحة**: `note` أعلاه هو نصُّ مراجعةِ طلبٍ واحدٍ في نموذجٍ آخر، وخلطُه
     بالقرار الجماعيّ يُرسل ملاحظةَ مراجعٍ إلى عشراتٍ لم تُكتب لهم. */
  /* ومن يصلح للتذكير: من يُقبل حجزُه ولم يحجز. وهو شرطُ الخادم نفسُه
     (`remindToBookInterview`) — ولو افترقا لعرضت الشاشةُ زرّا يردّه ٤٠٩. */
  const remindable = selectedRows.length > 0 && selectedRows.every(canRemind);

  /* ═══ ما يُعرض في قائمة أفعال الصفّ ═══

     الشرطُ من `DECISIONS` نفسِها لا من قائمةٍ ثانيةٍ تُكتب هنا: خريطةُ
     الانتقالات في الخادم تُقابَل بها، فلو كُتبت مرّتين ظهر فعلٌ يردّه ٤٠٩.
     وكذلك التذكيرُ: `canRemind` هي مِحَكُّ الخادم بعينه. */
  const allows = (action: string, status: string) =>
    DECISIONS.some((d) => d.action === action && d.from.includes(status));

  const rowActions = (a: AppRow): RowAction[] => {
    const items: RowAction[] = [
      { key: "open", label: "افتح الملفّ", icon: FileText, run: () => void openDetail(a.id) },
    ];
    if (allows("approve", a.status)) {
      items.push({
        key: "approve", label: "اعتمِدْه مدرّبا — بنقرة", icon: CheckCircle2,
        run: () => void act(
          () => apiPost(`/api/admin/trainer-applications/${a.id}/decision`, { action: "approve" }),
          "اعتُمد مدرّبا — وأُعلم بذلك",
        ),
      });
    }
    /* والتذكيرُ بالحجز لمن يُقبل حجزُه ولم يحجز — وخبرُه يتبع حالَ بريده */
    if (canRemind(a)) {
      items.push({
        key: "remind-booking", label: "اطلب منه تحديدَ موعد المقابلة", icon: CalendarCheck,
        run: () => void act(
          () => apiPost<{ emailDelivery?: string }>(`/api/admin/trainer-applications/${a.id}/booking-reminder`, {}),
          (result) => mailOutcomeAr(
            "أُرسل إليه طلبُ تحديد الموعد",
            (result as { emailDelivery?: string } | null)?.emailDelivery,
          ),
        ),
      });
    }
    /* وتذكيرُ المسوّدة للمسوّدة وحدَها — والخادمُ يشترطها (٤٠٩ دونها) */
    if (a.status === "draft") {
      items.push({
        key: "remind-draft", label: "ذكّره بإكمال طلبه", icon: Send,
        run: () => void act(
          () => apiPost<{ emailDelivery?: string }>(`/api/admin/trainer-applications/${a.id}/draft-reminder`, {}),
          (result) => mailOutcomeAr(
            "أُرسل إليه تذكيرٌ بإكمال طلبه",
            (result as { emailDelivery?: string } | null)?.emailDelivery,
          ),
        ),
      });
    }
    if (allows("reject", a.status)) {
      items.push({
        key: "reject", label: "رفض بلطف", icon: XCircle, tone: "danger",
        run: () => setRowDecision({ app: a, action: "reject" }),
      });
    }
    if (allows("undo_reject", a.status)) {
      items.push({
        key: "undo-reject", label: "تراجَعْ عن الرفض", icon: RotateCcw,
        run: () => setRowDecision({ app: a, action: "undo_reject" }),
      });
    }
    return items;
  };

  const bulkRemind = async () => {
    if (busy || sel.size === 0) return;
    setBusy(true); setBulkProgress("");
    /* حالُ بريد كلّ رسالةٍ يُجمع — فدفعةٌ «نُفّذت» وبريدُها لم يخرج خبرٌ كاذب */
    const deliveries: (string | null)[] = [];
    const outcome = await runBulk(
      [...sel],
      async (id) => {
        const r = await apiPost<{ emailDelivery?: string }>(`/api/admin/trainer-applications/${id}/booking-reminder`, {});
        deliveries.push(r.emailDelivery ?? null);
      },
      (done, total) => setBulkProgress(`${done} من ${total}`),
    );
    setBulkProgress("");
    setSel(new Set(outcome.failed.map((f) => f.id)));
    const said = mailBatchOutcomeAr(bulkMessage(outcome, "أُرسل التذكير"), deliveries);
    if (said.ok) toast(said.ar); else toastError(said.ar);
    setBusy(false);
    await load();
  };

  const bulkDecide = async (action: string, labelAr: string, decisionNote?: string) => {
    if (busy || sel.size === 0) return;
    setBusy(true); setBulkProgress("");
    const outcome = await runBulk(
      [...sel],
      (id) => apiPost(`/api/admin/trainer-applications/${id}/decision`, { action, note: decisionNote }),
      (done, total) => setBulkProgress(`${done} من ${total}`),
    );
    setBulkProgress("");
    setSel(new Set(outcome.failed.map((f) => f.id)));
    toast(bulkMessage(outcome, `نُفّذ «${labelAr}»`));
    setBusy(false);
    await load();
  };

  if (offline) {
    return (
      <AdminLayout title="طلبات انضمام المدربين">
        <Panel className="grid place-items-center py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا يمكن الوصول للبيانات</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
          <Button tone="secondary" onClick={() => void load()} className="mt-5">
            <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
          </Button>
        </Panel>
      </AdminLayout>
    );
  }

  /* ── عرض التفاصيل ── */
  if (selected) {
    const a = selected;
    /* وترتيبُها ترتيبُ `DECISIONS` — أي ترتيبُ رحلة الطلب. ولا يُعاد فرزُها
       هنا: فرزٌ ثانٍ في الشاشة يجعل موضعَ الزرّ يُبدَّل في موضعَين. */
    const available = DECISIONS.filter((d) => d.from.includes(a.status));
    /* واحدٌ ذهبيٌّ لا ثلاثة — أوّلُ ما يُوجد من قائمة الأولويّة في هذه الحالة */
    const recommended = recommendedFor(a.status);
    /* والشريطُ صفٌّ لا عمود، فيأخذ ما يسعه من المتاح بترتيبه نفسِه */
    const barActions = available.filter((d) => BAR_ACTIONS.includes(d.action));
    /* نبرةُ القرار تُترجَم إلى سلّم النظام: الرئيسُ ذهبيّ، والتحذيرُ بديلٌ
       متاح، وما لا يُتراجَع عنه أحمر. */
    /* والتراجعُ لا يُنفَّذ من الزرّ رأسا: سببُه يسافر إلى المتقدّم، فيُكتب في
       نافذةٍ تقول ذلك ويُقرأ قبل أن يُرسَل — لا في خانةِ ملاحظةٍ تُكتب لنا. */
    /* ─────────── بوّابةُ التجهيز في الشاشة ───────────

       الخادمُ يمنع، وهذه تقول قبل الضغط. والمصدرُ واحدٌ — `readiness` المحسوبةُ
       في الخادم — فلا يَعِد زرٌّ أخضرُ بما يردّه ٤٠٩. */
    const ready = a.readiness?.ready ?? true;
    const missingAr = a.readiness?.blockersAr ?? [];
    const canOverride = user?.roles?.includes("super_admin") ?? false;
    const gatedByPrep = (action: string) => (action === "approve" || action === "activate") && !ready;

    const decisionClick = (d: Decision, decisionNote?: string) =>
      d.action === "undo_reject"
        ? setUndoOpen(true)
        : gatedByPrep(d.action)
          ? setOverrideOpen(true)
          : void act(
            () => apiPost(`/api/admin/trainer-applications/${a.id}/decision`, { action: d.action, note: decisionNote || undefined }),
            "نُفذ القرار وسُجل في الأثر",
          );
    const decisionButton = (d: Decision) => (
      <Button
        key={d.action} disabled={busy || (gatedByPrep(d.action) && !canOverride)}
        title={gatedByPrep(d.action) ? `لا يُعتمَد قبل التجهيز — ${missingAr.join(" · ")}` : undefined}
        /* الذهبيُّ للموصى به وحدَه، وما عداه بديلٌ متاحٌ بحدّه — والأحمرُ
           يبقى أحمرَ: ما لا يُتراجَع عنه لا يُساوى ببديلٍ عاديّ. */
        tone={d.tone === "danger" ? "danger" : d.action === recommended ? "primary" : "secondary"}
        icon={d.tone === "danger" ? XCircle : d.action === "undo_reject" ? RotateCcw : d.action === "request_demo" ? CalendarCheck : CheckCircle2}
        onClick={() => decisionClick(d, note)}
        className="w-full"
      >
        {d.label}
      </Button>
    );
    /* زرُّ القرار في الشريط اللاصق: أضيقُ وبلا عرضٍ كامل، فالشريطُ صفٌّ لا عمود */
    const barButton = (d: Decision) => (
      <Button
        key={`bar-${d.action}`} disabled={busy || (gatedByPrep(d.action) && !canOverride)}
        title={gatedByPrep(d.action) ? `لا يُعتمَد قبل التجهيز — ${missingAr.join(" · ")}` : undefined}
        tone={d.tone === "danger" ? "danger" : d.action === recommended ? "primary" : "secondary"}
        icon={d.tone === "danger" ? XCircle : d.action === "undo_reject" ? RotateCcw : d.action === "request_demo" ? CalendarCheck : CheckCircle2}
        onClick={() => decisionClick(d, askNote || note)}
      >
        {d.label}
      </Button>
    );
    return (
      <AdminLayout title={`الطلب ${a.reference}`}>
        {/* ودربُ الوصول مكتوبٌ لا زرٌّ وحدَه: من دخل ملفّا بعد ملفٍّ نسي من
            أين جاء، و«كل الطلبات» تقول الوجهةَ ولا تقول الموضع. */}
        <nav aria-label="مسارُ الوصول" className="mb-4 flex flex-wrap items-center gap-1.5 text-fine">
          <Button tone="ghost" icon={ChevronLeft} onClick={closeDetail}
            className="text-teal-light-ink hover:text-teal-ink">
            طلبات المدربين
          </Button>
          <span aria-hidden className="text-muted-foreground/50">›</span>
          <span className="font-bold text-muted-foreground">{a.fullName}</span>
        </nav>

        {/* ═══ شريطُ القرار — لاصقٌ أعلى الشاشة ═══

            كان القرارُ في عمودٍ جانبيٍّ أسفلَ الروبرك، فمن قرأ الملفَّ كلَّه
            (وهو طويل) يصعد يبحث عن الأزرار أو ينزل. وقرارُ صاحب المنصّة أن
            يكون الفعلُ في متناول اليد دائما.

            وسقالةُ الطباعة رُفعت من هذه الشاشة (١٤ سبتمبر ٢٠٢٦): لا زرَّ
            يطبعها بعد أن صار لكلّ قارئٍ رابطُه. */}
        <Card className="sticky top-0 z-20 -mx-1 mb-4 bg-paper/95 !px-4 !py-3 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{a.fullName}</p>
              <p className="truncate font-mono text-read text-muted-foreground" dir="ltr">{a.reference}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {available.length === 0
                ? <span className="text-read text-muted-foreground">لا إجراءات متاحة في هذه الحالة.</span>
                : barActions.map((d) => barButton(d))}
              {/* ⑦ «اطلب معلومات إضافية» يفتح خانةً تقول ما المطلوب — وكانت
                  تُرسَل بلا سؤالٍ أصلا، فيقرأ المتقدّمُ اسمَ حالةٍ لا طلبا. */}
              {available.some((d) => d.action === "request_info") && (
                <Button tone="secondary" disabled={busy} icon={FileText} onClick={() => setAskOpen((v) => !v)}>
                  اطلب معلومات إضافية
                </Button>
              )}
            </div>
          </div>

          {/* ═══ ولا يُعطَّل زرٌّ في صمت ═══

              الزرُّ المعطَّلُ بلا سببٍ يجعل من ضغطه يظنّ الشاشةَ معطوبة. فسطرٌ
              تحته يقول ما ينقص بنصّه، وبابُه إلى «التجهيز» حيث يُعمل — لا إلى
              شاشةٍ أخرى يُبحث فيها عن اسمه. */}
          {!ready && available.some((d) => d.action === "approve" || d.action === "activate") && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
              <span className="text-read leading-6 text-amber-200/90">
                لا يُعتمَد اعتمادا كاملا قبل أن يتمّ تجهيزُه — <b>{missingAr.join(" · ")}</b>
              </span>
              <Button tone="secondary" size="sm" onClick={() => setTab("prep")}>
                افتحْ «التجهيز»
              </Button>
              {canOverride && (
                <span className="text-fine leading-5 text-muted-foreground">
                  ولك — وحدَك — أن تتجاوزها بسببٍ يبقى مكتوبا.
                </span>
              )}
            </div>
          )}

          {askOpen && (
            <div className="mt-3 border-t border-white/10 pt-3">
              <label htmlFor="ask-note" className="text-read font-bold text-muted-foreground">
                ما الذي تريده منه؟ يصله بنصّه في رسالةٍ وفي صفحة حالته.
              </label>
              <textarea
                id="ask-note" rows={3} value={askNote} onChange={(e) => setAskNote(e.target.value)}
                placeholder="مثال: نحتاج شهادة اعتمادك من الوكالة التونسية، وفيديو تدريبي واحد لا يقلّ عن عشر دقائق."
                className={`${staffAreaCls} mt-2`}
              />
              <div className="mt-2 flex items-center gap-2">
                <Button
                  tone="secondary" disabled={busy || askNote.trim().length < 10}
                  onClick={() => void act(
                    () => apiPost(`/api/admin/trainer-applications/${a.id}/decision`, { action: "request_info", note: askNote.trim() }),
                    "أُرسل الطلب إليه — ونصُّه في صفحة حالته",
                  ).then(() => { setAskNote(""); setAskOpen(false); })}
                >
                  أرسل الطلب إليه
                </Button>
                <span className="text-read text-muted-foreground">
                  {askNote.trim().length < 10 ? "اكتب ما تريده — عشرةُ أحرفٍ على الأقلّ." : "يصله بريدٌ بنصّه، ويبقى طلبه مفتوحا للتعديل."}
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* ═══ ترويسةُ المطبوع ذهبت مع زرّ الطباعة (١٤ سبتمبر ٢٠٢٦) ═══

            كانت تُرسَم لمطبوعٍ يُتداول في لجنة: عنوانٌ ورقمُ طلبٍ وتاريخُ
            طباعةٍ وسطرُ خصوصيّة. والمطبوعُ نفسُه ذهب — صار لكلّ قارئٍ رابطُه
            باسمه (المرحلةُ الثالثة). فترويسةٌ لا يقرؤها أحدٌ ليست حيادا: هي
            شيفرةٌ تُصان ويُظنّ أنّها تعمل.

            وطباعةُ المتصفّح تبقى عاملةً على **الصفحة المشتركة** لمن أراد
            ورقةً في الغرفة — وهي مقصودةٌ في التصميم. */}

        {/* ═══ الروبرك أسفلَ الملفّ لا في جانبه ═══

            كان عمودا ثالثا يقتطع ثلثَ العرض، فيُقرأ ملفُّ المتقدّم في ثلثَين:
            صفوفُ التسمية/القيمة تنكسر، وشبكةُ الكتل تصير عمودا واحدا، وشريطُ
            الحقائق يزدحم. وقرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦): «لا تجعل
            الروبرك في يسار الصفحة وإنّما أسفلها لتتّسع المساحة».

            والقراءةُ تسبق الحكمَ في العمل نفسِه: يُقرأ الملفُّ كاملا ثمّ
            يُعطى الدرجات. فترتيبُ الصفحة صار ترتيبَ الفعل. */}
        <div className="space-y-5">
          <div className="space-y-4">
            {/* تبويبان لا عمودٌ طويل.

                قرارُ صاحب المنصّة: «أعد بناء الصفحة كتبويبين: (أ) الملفّ
                والمعلومات — بيانات المتقدّم والمقابلة والدرس التجريبيّ
                والمراجع. (ب) الدورات — الدورات المرشَّح لها».

                وسببُه ظاهرٌ في الشاشة: من يبتّ يقرأ سبعةَ صناديق متتالية
                ليجد ما يخصّ سؤاله، وأكثرُها لا يخصّه. */}
            {/* وكان المختارُ **ذهبيّا صمّاء** إلى جانب أزرار القرار الذهبيّة
                في الشاشة نفسِها — ذهبيّان يتنازعان العين. */}
            <TabBar
              ariaLabel="أقسام الملفّ"
              value={tab}
              onChange={setTab}
              items={[
                { id: "dossier", label: "الملفّ والمعلومات" },
                { id: "prep", label: "التجهيز" },
                { id: "courses", label: "الدورات والشعب" },
              ]}
            />

            {/* ═══ فهرسُ الأقسام — شريطٌ لا عمود ═══

                قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦): تمريرةٌ واحدةٌ بفهرسٍ على
                التبويبات — فمن يبتّ في طلبٍ يقرؤه كلَّه.

                ⚠ وكُتب أوّلا عمودا لاصقا في جانب الصفحة، فوقع عطبان معا:
                سرق عرضا من الملفّ نفسِه، **وطفا شفّافا فوق الروبرك فتداخل
                النصّان** — وهو ما تحذّر منه نغمةُ `solid` في سلّم الأسطح
                بالحرف: «ما يطفو فوق غيره لا يجوز أن يكون شفّافا». فصار شريطا
                أفقيّا صلبا: لا عرضَ يُسرق، ولا شيءَ تحته ليُقرأ من خلاله.

                ولا يُطبع: أداةُ تنقّلٍ لا محتوى. */}
            {tab === "dossier" && (
              <nav aria-label="أقسام الملفّ" className="sticky top-20 z-10">
                <Panel as="section" tone="solid" className="!px-3 !py-2">
                  <ul className="flex flex-wrap items-center gap-1">
                    {DOSSIER_SECTIONS.map((sc) => (
                      <li key={sc.id}>
                        <a href={`#${sc.id}`}
                          className="block rounded-lg px-2.5 py-1 text-read leading-6 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground">
                          {sc.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </nav>
            )}

            {tab === "prep" ? (
              <PreparationSteps
                applicationId={a.id}
                profileId={a.profile?.id ?? null}
                readiness={a.readiness}
                activeRule={a.activeCompensationRule ?? null}
                proposals={a.profile?.courseProposals ?? []}
                contracts={a.profile?.contracts ?? []}
                qualifications={a.profile?.qualifications ?? []}
                permissions={user?.permissions ?? []}
                onChanged={() => loadDetail(a.id)}
              />
            ) : tab === "courses" ? (
              <TrainerCoursesTab summary={a.summary} />
            ) : (
            <>
            <Panel as="article" id="sec-profile" className="scroll-mt-28">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black">{a.fullName}</h3>
                  <p className="mt-1 text-read text-muted-foreground">
                    {a.jobTitle ?? "—"} · {a.country ?? "—"}
                    {(() => {
                      const labels: Record<string, string> = { employed: "موظف", own_business: "عمل خاص", full_time_training: "متفرغ للتدريب" };
                      const emp = labels[(a as Record<string, unknown>).employmentStatus as string];
                      return emp ? ` · ${emp}` : "";
                    })()}
                  </p>
                  <p className="mt-1 text-read text-muted-foreground" dir="ltr">{a.email}</p>
                </div>
                <span className="rounded-full border border-teal/40 px-3 py-1 text-fine font-bold text-teal-light-ink">
                  {STATUS_LABELS[a.status] ?? a.status}
                </span>
              </div>
              {/* ═══ شريطُ الحقائق — خمسةُ أرقامٍ قبل أيّ نثر ═══

                  خبرتُه وعددُ دوراته ووثائقه كانت مبثوثةً في صفوفٍ نصّيّةٍ
                  داخلَ كتلٍ مختلفة، فمن أراد حكما سريعا («أيستحقّ وقتَ
                  مقابلة؟») قرأ الملفَّ كلَّه ليجمعها بنفسه. ولوحاتُ التوظيف
                  التي نُظر فيها (Juicebox) تضع هذه الأرقامَ فوقَ كلّ شيء.

                  والأرقامُ هنا محسوبةٌ من المعروض لا مخزَّنة — فلا تبلى. */}
              {(() => {
                const d = a as unknown as Dossier;
                const facts: { label: string; value: string }[] = [
                  { label: "خبرةُ المجال", value: yearsLabel(d.domainYears) },
                  { label: "خبرةُ التدريب", value: yearsLabel(d.trainingYears) },
                  { label: "دوراتٌ يصلح لها", value: teachableCountAr(d) },
                  { label: "وثائقُ رفعها", value: String(a.documents.length) },
                  { label: "مقابلاتٌ جرت", value: String(a.interviews.filter((iv) => !iv.canceledAt).length) },
                ];
                return (
                  <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {facts.map((f) => (
                      <Inset key={f.label} className="px-3 py-2">
                        <dt className="text-read leading-5 text-muted-foreground">{f.label}</dt>
                        <dd className="mt-0.5 text-sm font-black leading-6 text-foreground">{f.value}</dd>
                      </Inset>
                    ))}
                  </dl>
                );
              })()}
              {a.bio && <p className="mt-4 text-read leading-6 text-foreground">{a.bio}</p>}
              {a.motivation && (
                <Inset as="p" className="mt-3 text-read leading-6 text-foreground">
                  <span className="font-bold text-muted-foreground">لماذا وجيز؟ </span>{a.motivation}
                </Inset>
              )}

              {/* الملفّ كاملا — كان المراجع يقرّر على نصف الطلب.

                  الخادمُ يُرسل كلَّ ما ملأه المتقدّم؛ الشاشةُ وحدها كانت
                  تُسقط الهاتفَ وحالتَه المهنيّة وخبرةَ التدريب والدوراتِ
                  التي يستطيع تدريسها وتوفّرَه وموافقتَه على الدرس
                  التجريبيّ ولغاتِ تدريبه ونمطَه. */}
              <div className="mt-5">
                <ApplicationDossier a={a as unknown as Dossier} />
              </div>

              {/* ما كتبه بقلمه لا يبقى ملاحظةً تُقرأ مرّةً — يصير بندا في طابور.
                  والزرُّ هنا لا داخلَ `ApplicationDossier`: تلك تعرضها صفحةُ
                  المراجعة الخارجيّةُ أيضا لمن لا حسابَ له. */}
              <ProposalsEditor
                applicationId={a.id}
                raw={a.teachableProposals}
                teachableOther={a.teachableOther}
                onSaved={() => loadDetail(a.id)}
              />
            </Panel>

            {/* الوثائق الخاصة */}
            <Panel as="article">
              <h4 id="sec-docs" className="flex scroll-mt-28 items-center gap-2 text-sm font-black"><FileText className="h-4 w-4 text-teal-light-ink" /> الوثائق — روابط موقعة تنتهي خلال دقائق</h4>
              {a.documents.length === 0 ? (
                <p className="mt-3 text-read text-muted-foreground">لم يرفع المرشح وثائق بعد.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {a.documents.map((d) => {
                    const url = a.documentUrls[d.storageKey];
                    const isOpen = openDoc === d.id;
                    return (
                      <li key={d.id}>
                        {/* تُفتح في مكانها لا في لسانٍ ثانٍ: المراجعُ يقارن السيرةَ
                            بما كُتب في الملفّ، وفتحُها خارجا يُفقده الاثنين معا. */}
                        <button
                          type="button" aria-expanded={isOpen}
                          onClick={() => setOpenDoc(isOpen ? null : d.id)}
                          className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-paper/20 p-3 text-right text-xs text-foreground transition hover:border-teal/40"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-teal-light-ink" />
                          <span className="font-bold">{d.kind}</span>
                          <span dir="ltr" className="min-w-0 flex-1 truncate text-muted-foreground">{d.originalName}</span>
                          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                        {isOpen && (
                          <div className="mt-2 overflow-hidden rounded-xl bg-white/5">
                            <iframe
                              src={url} title={d.originalName}
                              style={{ border: "none" }}
                              className="block h-[70vh] w-full bg-white"
                            />
                            {/* ومخرجٌ لمن لا يعرض متصفّحُه النوع — لا يُترك بلا طريق */}
                            <a href={url} target="_blank" rel="noreferrer"
                              className="block px-3 py-2 text-fine text-teal-light-ink underline decoration-dotted underline-offset-4">
                              افتحها في تبويبٍ جديد إن لم تُعرَض هنا
                            </a>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            {/* ═══ تقدّم سابقا — فلا يُراجَع من جديدٍ بلا ذاكرة ═══

                بحذف مدّة الستّة أشهر صار المردودُ يتقدّم في الغد. ولولا هذا
                اللوح لفتح المراجعُ طلبا يبدو أوّلَ طلبٍ لصاحبه، وقد رُدّ قبله
                لسببٍ مكتوبٍ عندنا — فيُعيد القراءةَ كلَّها ليصل إلى ما وصل
                إليه غيرُه. والملاحظةُ داخليّةٌ لم تصل صاحبَها، وهذا موضعُها. */}
            {(a.priorApplications?.length ?? 0) > 0 && (
              <Panel as="article" id="sec-prior">
                <h4 className="flex items-center gap-2 text-sm font-black">
                  <History className="h-4 w-4 text-gold-ink" /> تقدّم سابقا ({a.priorApplications!.length})
                </h4>
                <ol className="mt-3 space-y-2">
                  {a.priorApplications!.map((p) => (
                    <li key={p.reference} className="text-read leading-6 text-muted-foreground">
                      <span className="font-mono text-foreground" dir="ltr">{p.reference}</span>
                      {" — "}
                      <b className="text-foreground">{STATUS_LABELS[p.status] ?? p.status}</b>
                      {p.decidedAt && <> في {fmtDateTime(new Date(p.decidedAt))}</>}
                      {/* السببُ كما كُتب — لا يُختصر ولا يُعاد صوغُه */}
                      {p.noteAr && <span className="mt-1 block whitespace-pre-line text-foreground">«{p.noteAr}»</span>}
                    </li>
                  ))}
                </ol>
              </Panel>
            )}

            {/* سجل الحالات — ويُطبع بطلب صاحب المنصّة (١٣ سبتمبر ٢٠٢٦) بعد أن
                قُطع: من يجلس إلى المتقدّم يحتاج أن يعرف متى قدّم وأين وقف. */}
            <Panel as="article">
              <h4 id="sec-history" className="flex scroll-mt-28 items-center gap-2 text-sm font-black"><ClipboardList className="h-4 w-4 text-teal-light-ink" /> سجل الحالة</h4>
              <ol className="mt-3 space-y-2">
                {a.statusHistory.map((h, i) => (
                  <li key={i} className="flex items-center gap-2 text-read text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                    <b className="text-foreground">{STATUS_LABELS[h.toStatus] ?? h.toStatus}</b>
                    {h.note && <span>— {h.note}</span>}
                    <span className="mr-auto text-muted-foreground/50">{fmtDateTime(new Date(h.createdAt))}</span>
                  </li>
                ))}
              </ol>
            </Panel>

            {/* ورقةُ المقابلة: ما يُسأل وما يُملأ — تُقرأ على الشاشة وتُطبع */}
            <InterviewSheet a={a as unknown as Dossier} />

            {/* عمليات متقدمة: مقابلات، ديمو، مراجع، عقود */}
            <TrainerDetailOps app={a} onAction={act} />

            {/* ═══ والحذفُ في الذيل، مطويّا ═══

                كان في صدر الشاشة لوحا أحمرَ يراه كلُّ من فتح طلبا. وقال
                صاحبُ المنصّة (١٤ سبتمبر ٢٠٢٦): «وضعتَ مكانَ الحذف بمكانٍ
                رئيسيٍّ غيرِ مريح — اجعل الحذفَ في مكانٍ آخر لأنّه ليس عملا
                يوميّا».

                وهو صوابٌ أبعدُ من الراحة: زرٌّ لا يُنقر في تسعٍ وتسعين من
                مئةٍ يجاور أزرارَ القرار يُنقر يوما بالخطأ. فصار مطويّا في
                الذيل مع العمليّات — من قصده وجده، ومن لم يقصده لم يره. */}
            {canPurge && (
              <Panel as="article" className="border-red-500/20">
                <button type="button" aria-expanded={purgeOpen}
                  onClick={() => setPurgeOpen((v) => !v)}
                  className="flex w-full cursor-pointer items-center gap-2 text-right text-sm font-black text-red-300">
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span className="flex-1">حذفٌ نهائيّ لهذا الطلب</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${purgeOpen ? "rotate-180" : ""}`} />
                </button>
                {purgeOpen && (
                  <div className="mt-3">
                    <p className="text-read leading-6 text-muted-foreground">
                      يذهب الطلبُ ووثائقُه ومقابلاتُه وتقييماتُه وروابطُ قُرّائه، ولا يُستردّ.
                      ويبقى في سجلّ التدقيق: من حذف، ومتى، ولماذا.
                    </p>
                    {a.profile && (
                      <p className="mt-2 text-read leading-6 text-gold-ink">
                        وله ملفُّ مدرّبٍ — يذهب معه: تأهيلاتُه وإسنادُه وشعبُه ورموزُ إحالته وقواعدُ مستحقّاته.
                      </p>
                    )}
                    <Button tone="danger" icon={Trash2} type="button" disabled={busy}
                      onClick={() => setPurging(a)} className="mt-3">
                      احذفه نهائيّا
                    </Button>
                  </div>
                )}
              </Panel>
            )}
            </>
            )}
          </div>

          {/* روابطُ القُرّاء — قبل الحكم، فمنها يأتي ما يُحكَم به */}
          <div className="mt-4">
            <ReviewerLinks applicationId={a.id} />
          </div>

          {/* والحكمُ في الذيل، عريضا: الروبركُ والقرارُ جنبا إلى جنبٍ على الشاشات
              الواسعة بدل عمودٍ واحدٍ طويلٍ يُمرَّر فيه. */}
          {/* ولا يُطبعان: حقلا إدخالٍ لا محتوى ملفّ. وإخفاءُ المربّعات وحدَها
              كان يترك أسماءَ المحاور معلّقةً بلا درجات — عنوانٌ بلا شيءٍ تحته،
              وهو العطبُ الذي أُصلح في الأقسام المطويّة نفسِه. */}
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            {/* ═══ الروبركُ صار عرضا لا نموذجا (١٣ سبتمبر ٢٠٢٦) ═══

                قرارُ صاحب المنصّة: التقييمُ يُملأ في الصفحة المشتركة التي
                يفتحها كلُّ قارئٍ برابطه باسمه. فنموذجُ الإدخال هنا كان
                **الموضعَ الثاني** لشيءٍ واحد — ومن ملأ ههنا وملأ زميلُه هناك
                لم يُعرف أيُّهما التقييم.

                فذهب النموذجُ وبقيت المقارنة: وهي وحدَها ما لا يُغني عنه
                الرابط، إذ لا يرى قارئٌ رأيَ زميله قبل أن يكتب رأيَه. */}
            <Panel as="article">
              <h4 id="sec-rubric" className="scroll-mt-28 text-sm font-black">التقييمات — {a.reviews.length}</h4>
              {a.reviews.length === 0 ? (
                <p className="mt-2 text-read leading-6 text-muted-foreground">
                  لا تقييمَ بعد. أنشئ رابطا باسم قارئٍ من «روابطُ القُرّاء» أعلاه، وما يكتبه يظهر هنا.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {a.reviews.map((r) => (
                    <Inset key={r.id}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-read font-bold">
                          {r.reviewerName ?? "مراجعٌ من داخل الإدارة"}
                        </span>
                        {r.verdict && (
                          /* والنبرةُ من جدول الصفّ نفسِه، واللفظُ من معجمه —
                             فلا يقرأ فاتحُ الملفّ لفظا غيرَ الذي في الطابور. */
                          <span className={`rounded-full border px-2 py-0.5 text-read ${
                            OUTCOME_TONE[r.verdict] ?? "border-white/20 text-muted-foreground"
                          }`}>
                            {outcomeLabelAr(r.verdict)}
                          </span>
                        )}
                      </div>

                      {/* المحاورُ المقيَّمةُ وحدَها — و«لم يُقيَّم» تُقال ولا تُترك فراغا */}
                      <dl className="mt-2 space-y-1">
                        {RUBRIC_AXES.map((x) => (
                          <div key={x.key} className="flex items-baseline justify-between gap-3">
                            <dt className="text-read text-muted-foreground">{x.label}</dt>
                            <dd className="shrink-0 text-read font-bold">
                              {typeof r.scores?.[x.key] === "number"
                                ? `${r.scores[x.key]} / 5`
                                : <span className="font-normal text-muted-foreground">لم يُقيَّم</span>}
                            </dd>
                          </div>
                        ))}
                      </dl>

                      {r.overallNote && (
                        <p className="mt-2 whitespace-pre-line text-read leading-6">{r.overallNote}</p>
                      )}
                      {r.coursesNote && (
                        <p className="mt-2 whitespace-pre-line text-read leading-6 text-gold-ink">
                          على دوراته: {r.coursesNote}
                        </p>
                      )}
                      {/* المالُ يُعرض حيث يُقرَّر — ومن قرأ حكمَ القارئ ولم يرَ
                          ما دار في الحديث عن المبلغ قرّر على نصف الصورة.
                          ولا يقع به عقدٌ: العقدُ في موضعه من الشاشة. */}
                      {(r.feeExpectationAr || r.feeProposalAr) && (
                        <dl className="mt-2 space-y-0.5 text-read leading-6">
                          {r.feeExpectationAr && (
                            <div className="flex flex-wrap gap-x-2">
                              <dt className="font-bold text-muted-foreground">يتوقّع</dt>
                              <dd className="min-w-0">{r.feeExpectationAr}</dd>
                            </div>
                          )}
                          {r.feeProposalAr && (
                            <div className="flex flex-wrap gap-x-2">
                              <dt className="font-bold text-muted-foreground">ونقترح</dt>
                              <dd className="min-w-0">{r.feeProposalAr}</dd>
                            </div>
                          )}
                        </dl>
                      )}
                      <p className="mt-2 text-read text-muted-foreground">
                        {fmtDateTime(new Date(r.updatedAt ?? r.createdAt))}
                      </p>
                    </Inset>
                  ))}
                </div>
              )}
            </Panel>

            <Panel as="article">
              <h4 className="text-sm font-black">القرار — بشري بالكامل</h4>
              {/* ═══ عمودٌ واحدٌ بترتيب الرحلة — لا رئيسٌ ومطويّة (٢١ سبتمبر ٢٠٢٦) ═══

                  «رتّب هذه الأوامرَ لتكون أسهلَ وأفضلَ من هذا الترتيب العشوائيّ
                  والتقسيم الذي لا داعيَ له».

                  وكان التقسيمُ يَعِد بما لا يفي: «خطواتٌ تفصيليّة — اختياريّة»
                  تحتها «بدء المراجعة»، وهي أوّلُ الطريق لا حاشيةٌ فيه. ومن قرأ
                  «اختياريّة» فوقها لم يفتحها أصلا — فالطلبُ العالقُ في منتصف
                  السلسلة لا يجد ما يُكمله إلّا بنقرةٍ على مطويّةٍ تقول إنّها
                  لا تلزمه.

                  فذهبت المطويّةُ وذهب معها «رئيسٌ» و«تفصيليّ»: ما يصلح للحالة
                  يُعرض كلُّه، مرتَّبا برحلة الطلب، والموصى به وحدَه ذهبيّ. */}
              <div className="mt-3 space-y-2">
                {available.length === 0 && <p className="text-read text-muted-foreground">لا إجراءات متاحة في هذه الحالة.</p>}
                {available.map((d) => (
                  <div key={d.action} className="space-y-1">
                    {decisionButton(d)}
                    {/* وأثرُ الفعل تحت زرّه لا تحت المجموعة: سطرٌ عامٌّ تحت
                        ثلاثة أزرارٍ لا يُعرف أيَّها يصف. */}
                    {d.noteAr && (
                      <p className="px-2 text-center text-read leading-5 text-muted-foreground">{d.noteAr}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* للمتقدّم حسابٌ منذ تقديمه: التفعيلُ يربطه — فلا زرَّ دعوةٍ له */}
              {a.status === "onboarding" && !a.profile?.userId && a.userId && (
                <Inset as="p" tone="accent" className="mt-3 text-read leading-6 text-foreground">
                  للمتقدّم حسابٌ منذ تقديمه — «فعّله مدرّبا نشطا» يربط حسابه بملفّه ويفتح له بوّابة المدربين مباشرة.
                </Inset>
              )}
              {a.status === "onboarding" && !a.profile?.userId && !a.userId && (
                <Button tone="confirm" disabled={busy}
                  onClick={() => void act(async () => {
                    /* الرابط يُعرض للمسؤول دائما لا في التطوير وحده: كان يُحجب في
                       الإنتاج انتظارا لقناة بريد لا وجود لها، فتُنشأ الدعوة ولا
                       يملك رمزَها أحد — أي أن الحساب لا يُفتح أبدا. البريد يُرسل
                       الآن، وهذه نسخة تُسلَّم باليد حين لا تصل الرسالة. */
                    const r = await apiPost<{ expiresAt: string; acceptUrl: string; emailDelivery: string; invitationToken: string }>(
                      `/api/admin/trainer-applications/${a.id}/invitations`,
                    );
                    setInvite({ url: r.acceptUrl, delivery: r.emailDelivery });
                  }, "أُنشئت الدعوة الآمنة")} className="mt-3 w-full text-teal-light-ink">
                  <KeyRound className="h-3.5 w-3.5" /> أرسل دعوة إنشاء الحساب
                </Button>
              )}
              {invite && a.status === "onboarding" && !a.profile?.userId && !a.userId && (
                <Inset tone="accent" className="mt-3">
                  <p className="text-read font-black text-teal-light-ink">
                    {invite.delivery === "sent"
                      ? "أُرسلت الدعوة إلى بريد المدرب — وهذه نسخة الرابط إن لم تصله"
                      : invite.delivery === "not_configured"
                        ? "قناة البريد غير مفعّلة — سلّم هذا الرابط للمدرب بنفسك"
                        : "تعذّر إرسال البريد — سلّم هذا الرابط للمدرب بنفسك"}
                  </p>
                  <code dir="ltr" className="mt-2 block overflow-x-auto whitespace-nowrap rounded-lg bg-paper/40 p-2 font-mono text-fine text-foreground">
                    {invite.url}
                  </code>
                  <p className="mt-1.5 text-read text-muted-foreground">يُستخدم مرّةً واحدة، وصالحٌ {MAIL_LINK_WINDOW_AR}.</p>
                </Inset>
              )}
              {a.profile?.userId && (
                <p className="mt-3 flex items-center justify-center gap-1.5 text-read font-bold text-teal-light-ink">
                  <MailCheck className="h-3.5 w-3.5" /> الحساب مُنشأ ومرتبط بالملف
                </p>
              )}
            </Panel>
          </div>

        </div>

        {/* ═══ حوارُ التراجع — السببُ يُقرأ قبل أن يُرسَل ═══

            النافذةُ تقول صراحةً أين يذهب المكتوب: إلى بريد المتقدّم بنصّه.
            وهي الموضعُ الوحيدُ في هذا المسار الذي يسافر فيه ما يكتبه
            المراجعُ — فلو كُتب في خانة الملاحظة العامّة لَخُلط بما يُكتب
            لعينِ مراجعٍ آخر. والحدُّ عشرةُ أحرفٍ كحدِّ الخادم، فلا يُردّ
            الزرُّ بـ٤٢٢ بعد أن قُبل في الشاشة. */}
        {/* ═══ تجاوزُ بوّابة التجهيز — بابٌ ضيّقٌ بسببٍ يبقى ═══

            قرارُ ٦ سبتمبر جعل الاعتمادَ نقرةً واحدة، وقرارُ ٢٠ سبتمبر يفحص
            الثلاثَ قبلها. ويجتمعان في هذا الباب: يمرّ منه المديرُ الأعلى
            وحدَه، بسببٍ يُكتب في سجلّ الأثر وفي سجلّ حالة الطلب معا — فمن
            سأل بعد شهرٍ «لمَ صار هذا نشطا بلا عقد؟» وجد الجوابَ في الموضعَين
            اللذَين يُنظَر فيهما. */}
        {overrideOpen && (
          <ConfirmAction
            titleAr={`اعتمادُ «${a.fullName}» قبل أن يتمّ تجهيزُه`}
            confirmLabelAr="تجاوزْ واعتمِدْه"
            tone="danger"
            busy={busy}
            reason={{ labelAr: "لمَ يُعتمَد ناقصَ التجهيز؟ — يبقى في الأثر وفي سجلّ حالته", minLength: 20 }}
            onCancel={() => setOverrideOpen(false)}
            onConfirm={(reason) => {
              if (!reason) return;
              setOverrideOpen(false);
              void act(
                () => apiPost(`/api/admin/trainer-applications/${a.id}/decision`, {
                  action: "approve", note: note || undefined, overrideReasonAr: reason,
                }),
                "اعتُمد — وسُجّل التجاوزُ بسببه",
              );
            }}
          >
            <p className="text-read leading-6">
              لم تتمّ بعدُ: <b>{missingAr.join(" · ")}</b>
            </p>
            <p className="mt-2 text-read leading-6 text-muted-foreground">
              وأثرُ التجاوز ليس شكليّا: بلا اتّفاقٍ ماليٍّ ساريا لا يُولَّد كشفُ مستحقّاتٍ
              أصلا، فتبقى «مستحقّاتي» عنده صفرا. وبلا دورةٍ مؤهَّلٍ لها يفتح بوّابتَه على
              فراغ. وبلا عقدٍ موقَّعٍ لا وثيقةَ تحكم ما بيننا.
            </p>
            <p className="mt-2 text-read leading-6 text-muted-foreground">
              وله أن يُعتمَد الآن ويُستكمَل تجهيزُه بعدها — لكنّ أحدا لن يتذكّر أنّه ناقص
              ما لم يُكتب هنا.
            </p>
          </ConfirmAction>
        )}

        {undoOpen && (
          <ConfirmAction
            titleAr={`التراجعُ عن رفض «${a.fullName}»`}
            confirmLabelAr="تراجَعْ وأبلِغه"
            tone="default"
            busy={busy}
            reason={{ labelAr: "لماذا نتراجع؟ — يصل المتقدّمَ بنصّه في رسالته", minLength: 10 }}
            onCancel={() => setUndoOpen(false)}
            onConfirm={(reason) => {
              if (!reason) return;
              setUndoOpen(false);
              void act(
                () => apiPost<{ emailDelivery?: string }>(
                  `/api/admin/trainer-applications/${a.id}/decision`, { action: "undo_reject", note: reason }),
                /* والخبرُ يتبع الجواب: «وصله السببُ» لا تُقال إن لم يخرج
                   البريد — فمن نُقض ردُّه ولم يبلغه شيءٌ يبقى على خبره الأوّل،
                   ومن قرّر يجب أن يعلم ذلك ليُبلغه بنفسه. */
                (result) => mailOutcomeAr(
                  "رُفع الرفضُ — عاد الطلبُ إلى المراجعة، ووصل السببُ صاحبَه",
                  (result as { emailDelivery?: string } | null)?.emailDelivery,
                ),
              );
            }}
          >
            <p className="text-read leading-6">
              يعود الطلب <b dir="ltr">{a.reference}</b> إلى «قيد المراجعة» بملفّه ومستنداته كما هي،
              ويصل <b>{a.email}</b> بريدٌ يقول إنّنا عُدنا في قرارنا — وفيه سببُك بنصّه.
            </p>
            <p className="mt-2 text-read leading-6 text-muted-foreground">
              ولا يعود إلى الحالة التي رُدّ منها: يُقرأ طلبُه من أوّل الطابور، والقرارُ بعده جديد.
            </p>
          </ConfirmAction>
        )}

      {/* ═══ حوارُ المحو — يُكتب فيه رقمُ الطلب بالحرف وسببٌ يبقى ═══

            و«ارفضه ثمّ احذفه» لمن كان قيدَ النظر: الحذفُ لا يقع إلّا على منتهٍ
            (`PURGEABLE_STATUSES`)، وطلباتُ التجربة تسكن كلَّ الحالات. فبدل أن
            يُقال «ارفضه أوّلا ثمّ عُد» يقع الأمران بنقرةٍ واحدة — وكلاهما في
            الأثر بسببه، فلا ينتقل شيءٌ في الخفاء. */}
        {purging && (
          <ConfirmAction
            titleAr={`حذفُ الطلب ${purging.reference} نهائيّا`}
            confirmLabelAr={PURGEABLE.includes(purging.status) ? "احذفه نهائيّا" : "ارفضه ثمّ احذفه نهائيّا"}
            busy={busy}
            typing={{ expected: purging.reference, labelAr: "اكتب رقمَ الطلب بالحرف" }}
            reason={{ labelAr: "سببُ الحذف — يبقى في الأثر بعد أن يذهب الطلب", minLength: 5 }}
            onCancel={() => setPurging(null)}
            onConfirm={(reason) => {
              /* `reason` اختياريٌّ في نوع المكوّن وحاضرٌ هنا بحكم `reason={{…}}`.
                 ولا يُمرَّر فارغا بدلا منه: الخادمُ يشترطه، فيصير الردُّ خطأً
                 غامضا بدل زرٍّ لا يعمل. */
              if (!reason) return;
              const target = purging;
              setPurging(null);
              void purgeApplication(target, reason);
            }}
          >
            <p className="text-read leading-6">
              يذهب <b>{purging.fullName}</b> ومعه {purging.documents.length} وثيقة
              {" "}و{purging.reviews.length} تقييما و{purging.interviews.length} مقابلة
              {" "}و{purging.statusHistory.length} انتقالَ حالة — ولا رجعة.
            </p>
            {!PURGEABLE.includes(purging.status) && (
              <p className="mt-2 text-read leading-6 text-gold-ink">
                وهو قيدُ النظر الآن («{STATUS_LABELS[purging.status] ?? purging.status}»)، فيُرفض أوّلا ثمّ يُحذف.
              </p>
            )}
            <p className="mt-2 text-read leading-6 text-muted-foreground">
              وحسابُه يُحذف معه إن لم يكن له غيرُ هذا الطلب — وإن كان له تسجيلٌ أو شراءٌ بقي، ويُقال لك.
            </p>
          </ConfirmAction>
        )}

      </AdminLayout>
    );
  }

  /* ── القائمة ── */
  return (
    <AdminLayout title="طلبات انضمام المدربين">
      <FlowSteps steps={[
        { label: "تقديم الطلب", actor: "المدرب" },
        { label: "فرز أولي", actor: "أنت هنا" },
        { label: "مقابلة", actor: "اللجنة الأكاديمية" },
        { label: "درس تجريبي وتقييمه", actor: "اللجنة الأكاديمية" },
        { label: "اعتماد أو اعتذار", actor: "أنت — ويُبلَّغ تلقائياً" },
      ]} />
      {/* ── العملُ قبل الألسنة ──

          كانت الشاشةُ تفتح بأربعة ألسنةٍ ثمّ قائمةٍ طويلة، وما ينتظر الفرزَ
          الأوّليَّ مبثوثٌ فيها لا يُعرف عددُه إلّا بالعدّ. فصار جملةً في
          الرأس وزرًّا يفتح أقدمَها — والأقدمُ أوّلا لأنّ صاحبَه أطولُ انتظارا.

          ولا يُعرض الرأسُ إلّا بلا ترشيحِ حالة: المحمَّلُ حينَها الطابورُ
          كلُّه. ومع ترشيحٍ يكون المحمَّلُ حالةً واحدةً، فعددٌ يُحسب منه
          يسمّي طابورا ليس هو. */}
      {/* ═══ وخبرٌ لا يصل من يحتاجه ليس خبرا (٢٠ سبتمبر ٢٠٢٦) ═══

          سقطت مزامنةُ Calendly بـ«ردّ 401» فبقي كلُّ ملفٍّ يقول «المقابلات
          (0)»، ولم تظهر أزرارُ النتيجة قطّ، ولم تُكتب شارةٌ في صفّ، وصدق
          «لم يحجز موعدا» على الجميع. والعطبُ **كان مكتوبا** في «صحّة
          النظام» بنصّه وسببه ودوائه — غير أنّ تلك الشاشةَ خلف
          `settings.manage`، ومن يقرأ الطابورَ لا يملكها. فبحث صاحبُ
          المنصّة عن العلّة في سبع شكاوى قبل أن تُوجد.

          فهو هنا، حيث يقع العملُ الذي يتعطّل. */}
      {shown === "apps" && syncTrust && !syncTrust.trusted && (
        <Card tone="warn" className="mb-4 flex flex-wrap items-start gap-2 !py-3">
          <ServerOff className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <div className="min-w-0 flex-1">
            <p className="text-read font-bold">مواعيدُ المقابلات لا تصل الآن</p>
            <p className="mt-1 text-read text-muted-foreground">{syncTrust.reasonAr}</p>
            <p className="mt-1 text-read text-muted-foreground">
              وما دامت ساقطةً فلا صفَّ مقابلةٍ يُنشأ، ولا نتيجةَ تُسجَّل، ولا شارةَ تظهر في الصفّ.
              وتُسجَّل اللقاءاتُ الواقعةُ يدويّا من ملفّ صاحبها حتّى تعود.
            </p>
          </div>
        </Card>
      )}

      {shown === "apps" && filter === "" && (
        <WorkHeader
          loading={loading}
          icon={ClipboardList}
          count={triage.length}
          forms={APP_FORMS}
          waitingAr="تنتظر الفرزَ الأوّليّ"
          stats={[`${apps.length} في الطابور كلِّه`, `${apps.filter((a) => a.interviewsCount > 0).length} أُجريت مقابلتُه`]}
          actionAr="ابدأ بأقدمها"
          onAction={() => { if (triage[0]) void openDetail(triage[0].id); }}
          doneAr="لا طلبَ ينتظر الفرزَ الأوّليّ — وما يصل منها يظهر هنا فورا."
        />
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {/* ولا يُرسَم شريطُ ألسنةٍ للسانٍ واحد: زرٌّ مختارٌ أبدا لا يُنقَر
            ولا يُبدّل شيئا هو إطارٌ حول عنوانٍ لا لسان. فمن لم يبقَ له
            غيرُ «الطلبات» رأى الطلباتِ بلا شريطٍ فوقها. */}
        {tabs.length > 1 && (
          <div className="flex rounded-full border border-white/15 p-1">
            {tabs.map((t) => (
              /* الفيروزيُّ للسان المختار لا الذهبيّ: الذهبيُّ فعلُ الصفحة
                 الأوّل (زرُّ الرأس)، ولسانٌ ذهبيٌّ إلى جانبه ذهبيّان
                 يتنازعان العين — وهو ما استقرّ عليه لسانُ الشعبة قبله. */
              <Button key={t.key} tone={shown === t.key ? "confirm" : "ghost"} onClick={() => setMode(t.key)}>
                {t.label}
              </Button>
            ))}
          </div>
        )}
        {/* ═══ ما يُستعمل ظاهرٌ، وما دونه يُطوى — ولا يختفي عاملٌ بصمت ═══

            قال صاحبُ المنصّة (٢٠ سبتمبر ٢٠٢٦): «مرشِّحاتُ المدربين كثيرةٌ
            ولا أستخدمها كلَّها — اجعل الرئيسيّةَ منها في الشاشة والباقيَ
            في أخرى».

            والحالةُ والترتيبُ يبقيان: بهما يُفرز الطابورُ في كلّ جلسة.
            وما دونهما خلف «مرشّحاتٌ أخرى» — **وعددُ العاملِ منها مكتوبٌ
            على الطيّة**، فلا يُقرأ طابورٌ منقوصٌ ويُظنّ تامّا. وذاك هو
            خطرُ الطيّ كلِّه: مرشِّحٌ يعمل ولا يُرى. */}
        {shown === "apps" && (
          <>
            {/* ═══ صفّا ترشيحٍ لا صفٌّ واحد (٢١ سبتمبر ٢٠٢٦) ═══

                «أحتاج ترشيحَين: واحدٌ للّيبل الرئيسيّ وهو نشط أو مرفوض أو
                غيرُه، والثاني لنتيجة التقييم» — فالمتقدّمُ قد يكون نشطا
                وتقييمُنا يقول «غير مناسب»، وهما بُعدان لا بُعدٌ واحد.

                وكلُّ شارةٍ تُبنى ممّا في الطابور فعلا وعليها عددُه: ما خلا
                لم يُعرض، وما وُجد عُرض. فلا «موقوف» في الطابور بلا شارة،
                ولا شارةٌ تُنقَر فتُخرج لا شيء.

                والصفّان يجتمعان بالواو: «نشط» ثمّ «غير مناسب» نقرتان تُخرجان
                من هو نشطٌ ولم يُوصَ به — وهو السؤالُ الذي لم يكن له باب. */}
            <div className="flex w-full flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="ml-1 text-fine text-muted-foreground">الحالة</span>
                {statusFacets.map((f) => (
                  <Button key={f.key}
                    size="sm"
                    tone={filter === f.key ? "confirm" : "secondary"}
                    aria-pressed={filter === f.key}
                    onClick={() => { setFilter(filter === f.key ? "" : f.key); setPage(1); }}>
                    {STATUS_LABELS[f.key] ?? f.key}
                    <span className="mr-1 font-mono opacity-70">{f.n}</span>
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="ml-1 text-fine text-muted-foreground">نتيجةُ التقييم</span>
                {resultFacets.map((f) => (
                  <Button key={f.key}
                    size="sm"
                    tone={resultFilter === f.key ? "confirm" : "secondary"}
                    aria-pressed={resultFilter === f.key}
                    onClick={() => { setResultFilter(resultFilter === f.key ? "" : f.key); setPage(1); }}>
                    {RESULT_LABEL_AR[f.key] ?? outcomeLabelAr(f.key)}
                    <span className="mr-1 font-mono opacity-70">{f.n}</span>
                  </Button>
                ))}
              </div>
            </div>

            <select
              value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} aria-label="رشّح بالحالة"
              className={staffSelectCls}
            >
              <option value="">كل الحالات</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>

            <select
              value={sortKey} onChange={(e) => { setSortKey(e.target.value as SortKey); setPage(1); }}
              aria-label="رتّبْ بـ"
              className={staffSelectCls}
            >
              {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>رتّبْ بـ{o.labelAr}</option>)}
            </select>
            {/* والاتّجاهُ زرٌّ لا خيارٌ ثالثٌ في قائمة: حالتان تُقلَبان بنقرة */}
            <Button tone="ghost"
              aria-label={sortDir === "asc" ? "الترتيبُ صاعد — اقلِبْه نازلا" : "الترتيبُ نازل — اقلِبْه صاعدا"}
              onClick={() => { setSortDir((d) => (d === "asc" ? "desc" : "asc")); setPage(1); }}>
              {sortDir === "asc"
                ? <><ArrowUpNarrowWide className="h-3.5 w-3.5" /> تصاعديّا</>
                : <><ArrowDownWideNarrow className="h-3.5 w-3.5" /> تنازليّا</>}
            </Button>

            <details className="group">
              <summary className={`${staffControlCls} flex cursor-pointer list-none items-center gap-1.5 !w-auto text-muted-foreground transition hover:text-foreground`}>
                <SlidersHorizontal className="h-3.5 w-3.5" />
                مرشّحاتٌ أخرى
                {onlyUnbooked && (
                  <span className="rounded-full bg-teal/25 px-1.5 font-mono text-fine text-teal-light-ink">1</span>
                )}
              </summary>
              <Inset className="mt-2 flex flex-wrap items-center gap-2">
                {/* سؤالٌ يُضغط بدل عدِّ الأصفار في عمود «مقابلة» */}
                {/* ═══ ولا يُعرض عددٌ واثقٌ لا يُعرف ═══

                    «لم يحجز موعدا» يُحسب ممّا وصلنا من حجوز. فإن سقطت
                    المزامنةُ صدق على الجميع — ويُقرأ رقمٌ كبيرٌ يُفهَم
                    إهمالا من المتقدّمين وهو عطبٌ عندنا. فحين لا يُوثَق
                    يُعرض «؟» لا رقم: الفراغُ أصدقُ من يقينٍ كاذب. */}
                <Button tone={onlyUnbooked ? "confirm" : "ghost"}
                  aria-pressed={onlyUnbooked}
                  onClick={() => { setOnlyUnbooked((v) => !v); setPage(1); }}>
                  <CalendarCheck className="h-3.5 w-3.5" /> لم يحجز موعدا
                  <span className="mr-1 font-mono">
                    {syncTrust && !syncTrust.trusted ? "؟" : apps.filter(canRemind).length}
                  </span>
                </Button>
                <Button tone="secondary" onClick={() => void load()}>
                  <RefreshCw className="h-3.5 w-3.5" /> تحديث
                </Button>
              </Inset>
            </details>
          </>
        )}
      </div>

      {shown === "changes" && <TrainerChangeRequests />}
      {/* ونُقلت «مستحقات المدربين» إلى شاشتها (`/admin/trainer-compensation`):
          بابُ هذه الشاشة `trainer.applications.view` والأتعابُ محروسةٌ
          بـ`trainer.compensation.manage`، ولا تلتقيان إلّا في `super_admin`.
          فكانت الماليةُ تُردّ على الباب، والمديرُ الأكاديميُّ يبلغ اللسانَ
          ويُردّ عند أوّل فعل. */}
      {shown === "apps" && (loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>
      ) : apps.length === 0 ? (
        <Panel className="grid place-items-center py-20 text-center">
          <UserPlus className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا طلبات بهذه الحالة</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">
            طلبات نموذج «انضم مدربا» تصل هنا مباشرة عبر قاعدة البيانات فور إرسالها.
          </p>
        </Panel>
      ) : (
        <div className="space-y-3">
          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={view} unit="طلبا"
            size={size} onSize={setSize}
            placeholder="ابحث باسمٍ أو بريدٍ أو رقمِ طلبٍ أو تخصّص…" />
          <BulkBar count={sel.size} busy={busy} progress={bulkProgress} onClear={() => setSel(new Set())}>
            {/* التذكيرُ أوّلا: هو الأكثرُ وقوعا في هذا الطابور، وليس قرارا
                يُتراجَع عنه — رسالةٌ تُرسَل لمن ننتظره وهو ينتظرنا. */}
            {remindable && (
              <Button size="sm" tone="secondary" onClick={() => void bulkRemind()}>
                <CalendarCheck className="h-3.5 w-3.5" /> ذكّرهم بحجز الموعد — على {sel.size}
              </Button>
            )}
            {commonActions.length === 0 ? (
              <span className="text-fine text-muted-foreground">
                لا إجراءَ يصلح للمحدَّد كلِّه — الحالاتُ مختلفة، فاختر ما يتّحد حالُه.
              </span>
            ) : commonActions.map((d) => (
              /* فعلٌ جماعيٌّ في شريطِه لا فعلُ الصفحة — وكان ممتلئا بالذهبيّ
                 مكتوبا بيده، أي رئيسيٌّ ثانٍ إلى جانب زرِّ الرأس. */
              <Button key={d.action} size="sm" tone={d.tone === "danger" ? "danger" : "confirm"}
                onClick={() => (d.action === "reject" || d.action === "waitlist"
                  ? setBulkDecision({ action: d.action, labelAr: d.label })
                  : void bulkDecide(d.action, d.label))}>
                {d.label} — على {sel.size}
              </Button>
            ))}
          </BulkBar>
          {view.total === 0 && (
            <Panel as="p" className="py-16 text-center text-sm text-muted-foreground">
              لا طلب يطابق «{q.trim()}».
            </Panel>
          )}
          {view.rows.map((a) => (
            <Card tone={sel.has(a.id) ? "warn" : "accent"} key={a.id} className={`flex flex-wrap items-center gap-3 transition ${sel.has(a.id) ? "" : "hover:border-teal/40"}`}>
              {/* المربّعُ خارج الزرّ لا داخله: زرٌّ في زرّ لا يصحّ، ونقرةٌ
                  على التحديد كانت تفتح الملفّ. */}
              {/* الوسمُ حولَه هو الهدف: مربّعٌ بستّةَ عشرَ بكسلا يُخطئه الإصبع،
                  والوسمُ يمنحه ٣٢×٣٢ بلا أن يُكبَّر المربّعُ نفسُه. */}
              <label className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center">
                <input type="checkbox" checked={sel.has(a.id)} onChange={() => toggleSel(a.id)}
                  aria-label={`حدّد طلب ${a.fullName}`} className="h-4 w-4 shrink-0 cursor-pointer accent-gold" />
              </label>
            {/* ═══ أربعُ حقائقَ لا أربعةُ أسطر (٢٠ سبتمبر ٢٠٢٦) ═══

                شكا صاحبُ المنصّة: «المعلومات كثيرة — أحتاج فقط الاسم والرقم
                والحالة، وأيضا نتيجة المقابلة». وكان الصفُّ يقول التخصّصاتِ
                وسنواتِ الخبرة والمسمّى، ثمّ يعدّ الوثائقَ والتقييماتِ
                والمقابلات، ثمّ عمرَ الانتظار — أربعةَ أسطرٍ يُقرأ منها
                سطرٌ ويُمرَّر الباقي. **وما يُقرَّر عليه لم يكن فيها**:
                نتيجةُ اللقاء كانت خلفَ فتحةِ ملفّ.

                فما بقي هو ما يُفرز به: من هو، وبأيّ رقم، وأين وقف، وماذا
                قلنا فيه بعد لقائه. وما ذهب لم يُحذف — الملفُّ يفتحه كلَّه
                بنقرة، وعمرُ الانتظار مقولٌ في ترويسة الطابور وفي ملخّص
                الصباح. */}
            <button
              onClick={() => void openDetail(a.id)}
              className="flex flex-1 cursor-pointer flex-wrap items-center justify-between gap-3 text-right"
            >
              <p className="font-black">
                {a.fullName} <span className="mr-2 font-mono text-fine text-muted-foreground" dir="ltr">{a.reference}</span>
              </p>
              <span className="flex flex-wrap items-center gap-2">
                {/* ═══ ولا شارةَ عمرٍ هنا — حُذفت نهائيّا (٢٠ سبتمبر ٢٠٢٦) ═══

                    عُرضت أوّلا على كلّ صفّ، ثمّ على المتأخّر وحدَه حين شُكي
                    من ازدحام الصفّ، ثمّ قال صاحبُ المنصّة: «شارة العمر
                    احذفها نهائيّا من الصفّ». فذهبت كلُّها.

                    والعطبُ الذي وُضعت له — أن يشيخ الطلبُ بصمت — بابُه غيرُ
                    الصفّ: الترتيبُ يضع الأقدمَ أوّلا، وملخّصُ الصباح ينادي
                    على من طال وقوفُه. و`queue-age.ts` باقٍ بدالّته
                    ومحكوماتِه إن أُريد في موضعٍ آخر. */}
                {/* ═══ ليبلُ الموعد — أوّلُ ما يُقرأ في الصفّ (٢١ سبتمبر ٢٠٢٦) ═══

                    «للأشخاص الذين حجزوا موعدا ضعْ في الليبل موعدَ مقابلتهم
                    القادمة، وإن لم يحجز فيكون الليبلُ أنّه لم يحجز موعدا
                    بعد». وترتيبُه أوّلا ترتيبٌ زمنيّ: الموعدُ ثمّ نتيجتُه
                    ثمّ أين وقف الطلبُ بعدهما — تُقرأ الثلاثُ من اليمين
                    فتُروى القصّةُ على وجهها.

                    والحكمُ في `queue-labels.ts` لا هنا: من يُقال له «لم
                    يحجز»، ومتى لا يُقال لأنّ المزامنةَ لا تُوثَق. */}
                {(() => {
                  const booking = bookingLabel(a, { trusted: !syncTrust || syncTrust.trusted, now: new Date() });
                  if (!booking) return null;
                  return (
                    <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-fine font-bold ${BOOKING_TONE[booking.kind]}`}>
                      {booking.kind === "unbooked"
                        ? <><CalendarX2 className="h-3.5 w-3.5" aria-hidden="true" /> لم يحجز موعدا بعد</>
                        : <>
                            <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            {BOOKING_LEAD_AR[booking.kind]} {fmtDateTime(booking.at)}
                          </>}
                    </span>
                  );
                })()}
                {/* ونتيجةُ اللقاء قبل الحالة: الحالةُ تقول أين وقف، وهذه
                    تقول ماذا قلنا فيه — وهي الأحدثُ خبرا. ولا شارةَ لمن لم
                    يُقابَل: فراغٌ أصدقُ من «بلا نتيجة» في كلّ صفّ.

                    ── واثنتان حين تختلفان ──

                    المسجَّلةُ من بطاقة الموعد، والتقييمُ من رابط القارئ.
                    فإن اتّفقا فواحدةٌ بلا بادئةٍ تقول من قالها، وإن اختلفا
                    فكلتاهما بمصدرها واسمِ قائلها.

                    ── ومعجمٌ واحدٌ لا اثنان (٢١ سبتمبر ٢٠٢٦) ──

                    كان `VERDICT_AR` هنا يقول «يجتاز» وما يقابله في قسم
                    المقابلة يقول «ناجح» — لفظان لحقيقةٍ واحدة، وهو ما شُكي
                    منه: «لا أريد شيئين». وقد صار قرارُ الرابط مربوطا بمقابلةٍ
                    بعينها ويُكتب في عمودها، فلم يبقَ ما يبرّر لفظا ثانيا —
                    فذهب المعجمُ وبقي `outcomeLabelAr` وحدَه. */}
                {verdictBadges(a).map((b, _i, all) => (
                  <span key={`${b.source}-${b.key}`}
                    className={`rounded-full border px-3 py-1 text-fine font-bold ${
                      OUTCOME_TONE[b.key] ?? "border-white/20 text-muted-foreground"
                    }`}>
                    {all.length > 1 && (
                      <span className="ml-1 font-normal opacity-70">{VERDICT_SOURCE_AR[b.source]}:</span>
                    )}
                    {outcomeLabelAr(b.key)}
                    {/* واسمُ القائل حين يختلف القرّاء — قولان بلا قائلَين
                        تناقضٌ يُقرأ ولا يُعرف من يُسأل عنه. */}
                    {b.byAr && <span className="mr-1 font-normal opacity-70">— {b.byAr}</span>}
                  </span>
                ))}
                <span className="rounded-full border border-teal/40 px-3 py-1 text-fine font-bold text-teal-light-ink">
                  {STATUS_LABELS[a.status] ?? a.status}
                </span>
              </span>
            </button>
            <RowActions label={a.fullName} items={rowActions(a)} />
            </Card>
          ))}
        </div>
      ))}

      {/* ═══ قرارُ صفٍّ واحدٍ من قائمته — بسببه المكتوب قبل وقوعه ═══

          والنصّان يفترقان بافتراق وجهة السبب: سببُ الرفض يبقى عندنا (قرارُ
          ١٨ سبتمبر)، وسببُ التراجع يسافر إلى صاحبه بنصّه (قرارُ ١٩ سبتمبر).
          فلا تُكتب جملةٌ واحدةٌ لهما. */}
      {rowDecision && (
        <ConfirmAction
          titleAr={rowDecision.action === "reject"
            ? `رفضُ طلب «${rowDecision.app.fullName}»`
            : `التراجعُ عن رفض «${rowDecision.app.fullName}»`}
          confirmLabelAr={rowDecision.action === "reject" ? "ارفضه بلطف" : "تراجَعْ وأبلِغه"}
          tone={rowDecision.action === "reject" ? "danger" : "default"}
          busy={busy}
          reason={rowDecision.action === "reject"
            ? { labelAr: "السببُ — للأثر الداخليّ، ولا يصل المتقدّم", minLength: 5 }
            : { labelAr: "لماذا نتراجع؟ — يصل المتقدّمَ بنصّه في رسالته", minLength: 10 }}
          onCancel={() => setRowDecision(null)}
          onConfirm={(reason) => {
            if (!reason) return;
            const target = rowDecision;
            setRowDecision(null);
            void act(
              () => apiPost<{ emailDelivery?: string }>(
                `/api/admin/trainer-applications/${target.app.id}/decision`,
                { action: target.action, note: reason },
              ),
              target.action === "reject"
                ? "رُدَّ الطلبُ — وأُعلم صاحبُه، وسببُك في الأثر"
                : (result) => mailOutcomeAr(
                  "رُفع الرفضُ — عاد الطلبُ إلى المراجعة، ووصل السببُ صاحبَه",
                  (result as { emailDelivery?: string } | null)?.emailDelivery,
                ),
            );
          }}
        >
          <p className="text-read leading-6">
            الطلب <b dir="ltr">{rowDecision.app.reference}</b> — {rowDecision.app.fullName}.
          </p>
          <p className="mt-2 text-read leading-6 text-muted-foreground">
            {rowDecision.action === "reject"
              ? "يصله بريدُ اعتذارٍ من المنصّة، وسببُك يبقى في الأثر عندنا ولا يُرسَل — فاكتبه لمن يراجع الطلبَ بعدك."
              : "يعود الطلبُ إلى «قيد المراجعة» بملفّه ومستنداته، ويصله بريدٌ يقول إنّنا عُدنا في قرارنا — وفيه سببُك بنصّه."}
          </p>
        </ConfirmAction>
      )}

      {bulkDecision && (
        <ConfirmAction
          titleAr={`«${bulkDecision.labelAr}» على ${sel.size} طلبَ انضمام`}
          confirmLabelAr={`${bulkDecision.labelAr} — على ${sel.size}`}
          busy={busy}
          reason={{
            /* ═══ ولا يُوعَد بما لا يقع ═══

               كان السطرُ واحدا: «يصل صاحبَ كلّ طلبٍ كما تكتبه». وصار سببُ
               الرفض لا يُرسَل (قرارُ صاحب المنصّة، ١٨ سبتمبر ٢٠٢٦)، فبقاءُ
               الوعد يجعل المراجعَ يكتب للمتقدّم نصًّا لا يقرؤه أحدٌ غيرُنا —
               أو يكتم ما كان سيكتبه للأثر. */
            labelAr: bulkDecision.action === "reject"
              ? "السببُ — للأثر الداخليّ، ولا يصل المتقدّم"
              : "السببُ — يصل صاحبَ كلّ طلبٍ كما تكتبه، ويبقى في الأثر",
            minLength: 5,
          }}
          onCancel={() => setBulkDecision(null)}
          onConfirm={(reason) => {
            const target = bulkDecision;
            setBulkDecision(null);
            void bulkDecide(target.action, target.labelAr, reason);
          }}
        >
          <p>
            يُطبَّق القرارُ على المحدَّد كلِّه، ويُخبَر أصحابُه برسالةٍ من المنصّة.{" "}
            {bulkDecision.action === "reject"
              ? "وسببُك يبقى في الأثر عندنا ولا يُرسَل — فاكتبه لمن يراجع الطلبَ بعدك."
              : "والسببُ واحدٌ للجميع ويصلهم بنصّه — فاكتبه عامّا يصلح لكلّ من يقرؤه."}
          </p>
        </ConfirmAction>
      )}
    </AdminLayout>
  );
}
