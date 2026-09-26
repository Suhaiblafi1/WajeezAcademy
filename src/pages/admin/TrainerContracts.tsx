/* قسمُ العقود — يُركَّب العقدُ هنا ويُعايَن قبل أن يراه أحد.

   ── ولمَ شاشةٌ لا لسانٌ في ملفّ المتقدّم ──

   كان العقدُ طيّةً مطويّةً داخل لوح المتقدّم: تُفتح، فيُكتب فيها عنوانٌ،
   فيُنشأ صفّ. وثمنُ ذلك أنّ **من ينتظر عقدا لا يظهر في أيّ موضع**: من قُبل
   قبولا مشروطا منذ أسبوعين ولم يُرسَل له شيءٌ لا يعرف به أحدٌ حتّى يسأل هو.
   فالشاشةُ هنا تُري ما صُنع **ومن ينتظر**، وهما نصفان لا نصفٌ واحد.

   ── والمعاينةُ قبل التركيب، لا بعده ──

   المتنُ يُجمَّد عند التركيب ولا يُعدَّل بعده. فلو لم تُعايَن الوثيقةُ قبلَه
   لكان أوّلُ قارئٍ لها هو المدرّب. والمعاينةُ تعمل ولو نقصت هويّةُ الأكاديميّة
   — فيرى الموظّفُ مواضعَ النقص في سياقها قبل أن يُطلب منه سدُّها.

   ── والأجرُ يُقرأ ولا يُكتب ──

   `trainer.contract.manage` يركّب ويرسل، و`trainer.compensation.manage` تضبط
   الرقم. فما يظهر هنا من أتعابٍ مقروءٌ لا محرَّر: من يتعاقد يرى ما سيُوقَّع
   عليه، ولا يملك تغييرَه من شاشته. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Ban, Download, FilePlus2, FileSignature, FileText, Handshake, IdCard, MessageSquareReply, Printer, RefreshCw, Send, Trash2, Undo2, UserMinus, X } from "lucide-react";
import ConfirmAction from "@/components/ConfirmAction";
import { apiDelete, apiGet, apiPost, permissionMessage } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";
import { RULE_TYPE_AR } from "@/application/trainer/compensation-labels";
/* وطورُ الشرط من موضعه الواحد لا مشتقًّا هنا — ورأسُ `conditional-offer.ts`
   يقول إنّ هذه التسمياتَ لـ«صفّ الطابور» كذلك، ولم تكن تصله. */
import { conditionPhase, CONDITION_PHASE_LABELS_AR } from "@/application/trainer/conditional-offer";
import type { Readiness } from "@/application/trainer/readiness";
import {
  CONTRACT_DOCUMENT_KINDS, DEFAULT_REQUIRED_DOCUMENTS, type RequiredDocument,
} from "@/application/trainer/contract-documents";
import {
  ASSIGNMENT_OFFER_RESPONSE_DAYS, COURSE_PREP_DEFAULT_DAYS, COURSE_PREP_MIN_DAYS,
} from "@/application/trainer/notice-periods";
import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { staffControlCls as inputCls, staffAreaCls as areaCls } from "@/components/FormKit";
import ListToolbar from "@/components/admin/ListToolbar";
import { paginate } from "@/application/admin/paginate";
import { matchesQuery } from "@/application/text/search-ar";
import AdminLayout from "./AdminLayout";
import { parseContractDoc } from '@/application/trainer/contract-sections'
import ContractDocument from '@/components/ContractDocument'
import { nameMatch } from '@/application/trainer/contract-names'
import { isUntouchableContract } from '@/application/trainer/contract-untouchable'

const STATUS_AR: Record<string, string> = {
  draft: "مسودّة مجمَّدة", sent: "أُرسل — بانتظار التوقيع", revoked: "ملغًى",
  signed: "وقّعه صاحبُه — ينتظر اعتمادك", expired: "منتهٍ", terminated: "مفسوخ",
  declined: "اعتُذر عنه", countersigned: "نافذٌ — اعتمدته الأكاديميّة",
};

const OFFER_STATUS_AR: Record<string, string> = {
  offered: "ينتظر جوابَه", accepted: "قبِله", declined: "اعتذر عنه",
  lapsed: "انقضت مهلتُه", withdrawn: "سُحب",
};

interface CandidateRow { id: string; reference: string; fullName: string; email: string; status: string }

interface ContractRow {
  id: string; title: string; status: string; kind: string; revision: number;
  bodyVersion: string | null; bodyHash: string | null; signerEmail: string | null;
  compensationType: string | null; compensationRate: string | null; currency: string;
  gatesActivation: boolean; sentAt: string | null; signedAt: string | null;
  revokedAt: string | null; revokeReasonAr: string | null; createdAt: string;
  signerLegalName: string | null; declinedAt: string | null; declineReasonAr: string | null;
  countersignedAt: string | null; academySignatoryName: string | null;
  academySignatoryTitle: string | null; countersignNoteAr: string | null;
  nameCorrectionAr: string | null; nameCorrectionAt: string | null;
  amendmentRequestAr: string | null; amendmentRequestedAt: string | null;
  amendmentReplyAr: string | null; amendmentRepliedAt: string | null;
  conditionDeadlineAt: string | null; conditionPausedAt: string | null;
  conditionExtendedAt: string | null; conditionMetAt: string | null;
  orientationAt: string | null;
  documents: { id: string; kind: string; originalName: string; mime: string; uploadedAt: string }[];
  qualifiedSnapshot: { courseId: string; titleAr: string }[] | null;
  profile: { id: string; legalNameAr: string | null; application: { id: string; reference: string; fullName: string; email: string; status: string } | null } | null;
}

/* ═══ الاسمان في صفٍّ واحد (٢٦ سبتمبر ٢٠٢٦) ═══

   بلاغُ صاحب المنصّة: «اسم الطرف الثاني يجب أن يكون مطابقا للهوية». وأوّلُ
   ما يلزم لذلك أن يكون الاسمان **منظورَين معا**: الشاشةُ كانت تعرض اسمَ
   الحساب وحدَه، فلا يُرى فرقٌ ولو كان قائما.

   و`documentNameAr` هو المطبوعُ في الوثيقة: `legalNameAr` إن كان قد صُحّح،
   وإلّا فاسمُ الحساب — وهو ترتيبُ `contractPrefill` و`composeContract`
   نفسُه، فما تعرضه الشاشةُ هو ما طُبع لا تقديرٌ لما طُبع. */
const namesOf = (c: ContractRow) => ({
  documentNameAr: c.profile?.legalNameAr ?? c.profile?.application?.fullName ?? null,
  signedNameAr: c.signerLegalName,
});
const docNameOf = (c: ContractRow) => namesOf(c).documentNameAr ?? "—";

/** ما يمسّه الإغلاقُ — كما يقرؤه الخادمُ من المواضع التي يمسّها الرحيلُ فعلا */
interface Impact {
  isLive: boolean; liveCohorts: number; enrolledLearners: number;
  openOffers: number; unpaidPayouts: number; owedByCurrency: Record<string, number>;
}

/** أفي هذا الأثرِ ما يُوقِف القارئَ؟ — فنافذةٌ تقول «لا شيءَ سيُمَسّ» أنفعُ من
 *  نافذةٍ تعدّد أربعةَ أصفار. */
const impactBites = (i: Impact) =>
  i.liveCohorts > 0 || i.enrolledLearners > 0 || i.openOffers > 0 || i.unpaidPayouts > 0;

/** تنزيلُ المتن كما بُصم — نصّا لا صورةً له.
 *
 *  والاسمُ يُنقّى ممّا لا يقبله نظامُ ملفّات: عنوانُ العقد يحمل نقطتَين
 *  وشرطاتٍ، وويندوز يرفض بعضَها فيسقط التنزيلُ صامتا. */
function downloadBodyAr(doc: { title: string; body: string }) {
  const url = URL.createObjectURL(new Blob([doc.body], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/** وقائعُ الشرط كما يقرؤها `conditional-offer.ts` — تُشتقّ من الصفّ مرّةً
    واحدةً، فلا يُعاد تركيبُ الكائن في كلّ موضعٍ يُسأل فيه عن الطور. */
const conditionFactsOf = (c: ContractRow) => ({
  orientationAt: c.orientationAt,
  conditionDeadlineAt: c.conditionDeadlineAt,
  conditionPausedAt: c.conditionPausedAt,
  conditionExtendedAt: c.conditionExtendedAt,
  conditionMetAt: c.conditionMetAt,
});

interface Prefill {
  applicationId: string; reference: string; fullName: string; email: string;
  legalNameAr: string; legalNameSource: "verified" | "account";
  applicationStatus: string; gatesActivation: boolean;
  courses: { courseId: string; titleAr: string }[];
  compensation: { ruleId: string; type: string; rate: string; currency: string; minSeats: number | null; referralRate: string | null } | null;
  feeNotes: { reviewerName: string | null; expectation: string | null; proposal: string | null }[];
  missingLegal: string[];
}

interface OfferRow {
  id: string; status: string; courseId: string; courseTitleAr: string;
  cohortId: string | null; cohort: { id: string; title: string; startsAt: string | null } | null;
  sessionsCount: number | null; startsAt: string | null; feeNoteAr: string | null; noteAr: string | null;
  expiresAt: string; offeredAt: string; respondedAt: string | null;
  declineReasonAr: string | null; withdrawReasonAr: string | null;
  prepDays: number; prepDueAt: string | null; prepConfirmedAt: string | null; prepLapsedAt: string | null;
  profile: { id: string; application: { id: string; fullName: string; email: string } | null } | null;
}

interface OfferOptionCohort {
  id: string; title: string; startsAt: string | null; status: string; hasLead: boolean; mine: boolean;
}
interface OfferOptionCourse {
  courseId: string; titleAr: string; alreadyOpen: boolean; alreadyAccepted: boolean;
  cohorts: OfferOptionCohort[];
}
interface OfferOption {
  profileId: string; fullName: string; email: string; reference: string;
  contract: { id: string; title: string; countersignedAt: string | null } | null;
  courses: OfferOptionCourse[];
}

export default function TrainerContracts() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [missingLegal, setMissingLegal] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [openFor, setOpenFor] = useState<CandidateRow | null>(null);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [title, setTitle] = useState("");
  /* ═══ اسمُ الطرف الثاني يُحرَّر قبل أن يُجمَّد المتن (٢٦ سبتمبر ٢٠٢٦) ═══

     بلاغُ صاحب المنصّة: «الطرف الثاني كاسم يجب أن يكون مطابقا للهويّة…
     لأنّ الاسم الموجود هنا هو ما أُخذ من حسابه وغالبا ليس اسما ثلاثيّا».
     وهذا الحقلُ هو الموضعُ الوحيدُ الذي يُصحَّح فيه بلا ثمن: بعد التجميد
     يصير التصحيحُ عقدا بديلا. */
  const [legalNameAr, setLegalNameAr] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [docs, setDocs] = useState<RequiredDocument[]>(DEFAULT_REQUIRED_DOCUMENTS);
  const [hoursNoteAr, setHoursNoteAr] = useState("");
  /* الأتعابُ وجلسةُ التهيئة في هذه الشاشة — لا شاشةَ ثانية */
  const [feeRate, setFeeRate] = useState("");
  const [feeReferralRate, setFeeReferralRate] = useState("");
  const [feeMinSeats, setFeeMinSeats] = useState("");
  const [orientationAt, setOrientationAt] = useState("");
  const [orientationUrl, setOrientationUrl] = useState("");
  const [waivedAr, setWaivedAr] = useState("");
  const [preview, setPreview] = useState("");
  const [shownBody, setShownBody] = useState<{ title: string; body: string } | null>(null);
  /* الرابطُ يُعرض للموظّف بعد الإرسال — كما في الدعوة الآمنة: قناةُ البريد
     قد تتعثّر، ومن يملك الصلاحيّةَ يحتاج نسخةً يسلّمها بيده. ولا يُخزَّن
     الرمزُ في القاعدة، فهذه فرصتُه الوحيدة. */
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  /* ═══ الاعتمادُ ملحوظتُه معه ═══

     الاعتمادُ مطابقةُ اسمٍ بوثيقة، والملحوظةُ محلُّ ما طابقه المعتمِد — أو
     تفويضِه الخطّيِّ إن لم يكن هو المفوَّضَ في السجلّ. فحقلٌ إلى جانب الزرّ
     لا `window.prompt`: نصٌّ يُقرأ بعد سنةٍ لا يُكتب في صندوقٍ بسطر. */
  const [signOff, setSignOff] = useState<{ id: string; noteAr: string } | null>(null);
  /* ونافذةُ «أعِدْها بملاحظات» مستقلّةٌ عن نافذة الاعتماد: قرارانِ متضادّان،
     وحقلٌ واحدٌ لهما يجعل ملاحظةَ الإعادة تُرسَل في خانة مطابقةِ الهويّة. */
  const [sendBack, setSendBack] = useState<{ id: string; notesAr: string } | null>(null);
  /* والحذفُ لا رجعةَ فيه، فلا يقع بنقرةٍ واحدة — ولا بـ`window.confirm`
     الذي يملك المتصفّحُ كتمَه فيردّ `false` صامتا (رأسُ `ConfirmAction`). */
  const [deleting, setDeleting] = useState<ContractRow | null>(null);
  /* واسمُ التصحيح بعد رفض التوقيع: المدرّبُ لم يقترح شيئا هنا — الموظّفُ
     يقرؤه من وثيقة هويّته التي بين يديه، فيكتبه. */
  const [fixName, setFixName] = useState<{ id: string; nameAr: string } | null>(null);
  const [replying, setReplying] = useState<{ id: string; replyAr: string } | null>(null);
  /* ═══ الإغلاقُ يقول أثرَه قبل أن يقع (٢٦ سبتمبر ٢٠٢٦) ═══

     بلاغُ صاحب المنصّة: «والنظام يجب أن يحذّرني إذا كان للإلغاء أثر». وكان
     السببُ يُطلَب بـ`window.prompt` بلا رقمٍ ولا سياق: سطرٌ واحدٌ يسأل «لماذا»
     ولا يقول «وهذا ما سيمسّه».

     و`impact === null` ليس صفرا: هو «لم تُقرأ الأرقامُ بعد». فالنافذةُ لا
     تُفتح إلّا بها (`closeWith` تقرأ ثمّ تفتح)، ولو تعثّرت القراءةُ لم
     تُفتَح — فلا يقع إغلاقٌ على أرقامٍ مجهولةٍ تُقرأ صفرا. */
  const [closing, setClosing] = useState<
    { row: ContractRow; mode: "revoke" | "depart"; impact: Impact } | null
  >(null);
  /* ═══ وبقيّةُ `window.prompt` في هذه الشاشة ═══

     بقي منه بابان بعد نافذة الإغلاق، ونصُّهما **يصل المدرّبَ حرفا بحرف**:
     «ما الذي لم يطابق؟» في رفض التوقيع، و«سببُ السحب» في سحب العرض. وحوارُ
     المتصفّح أسوأُ ما يُكتب فيه ما يُقرأ بعد سنة: سطرٌ واحدٌ لا يُنسَّق ولا
     يُراجَع، **ويملك المتصفّحُ كتمَه** — فمن ضغط «امنع هذا الموقع من إظهار
     الحوارات» صار الزرُّ عنده لا يفعل شيئا ولا يقول لماذا (رأسُ
     `ConfirmAction`).

     وحالةٌ واحدةٌ للبابَين لا نافذتان: السؤالُ واحدٌ — سببٌ مكتوبٌ يُشترَط
     ثمّ يُرسَل. والفرقُ في المسار وحدَه، فيُحمَل معه. */
  const [asking, setAsking] = useState<{
    titleAr: string; confirmLabelAr: string; labelAr: string;
    whatAr: string; okAr: string; rowId?: string;
    post: (reasonAr: string) => Promise<void>;
  } | null>(null);

  /* ═══ العروضُ في هذه الشاشة لا في شاشةٍ ثالثة ═══

     العرضُ فرعٌ عن عقدٍ نافذ: من يتابع العقودَ يتابع ما بُني عليها، ومن
     فصلهما شاشتين فتح إحداهما ونسي الأخرى. */
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [offerOptions, setOfferOptions] = useState<OfferOption[]>([]);
  const [offerFor, setOfferFor] = useState<OfferOption | null>(null);
  const [offerCourseId, setOfferCourseId] = useState("");
  const [offerCohortId, setOfferCohortId] = useState("");
  const [offerFeeAr, setOfferFeeAr] = useState("");
  const [offerNoteAr, setOfferNoteAr] = useState("");
  const [offerSessions, setOfferSessions] = useState("");
  const [offerPrepDays, setOfferPrepDays] = useState(String(COURSE_PREP_DEFAULT_DAYS));
  const [offerResponseDays, setOfferResponseDays] = useState(String(ASSIGNMENT_OFFER_RESPONSE_DAYS));

  /* ═══ والقائمتان تُبحثان وتُرقَّمان ═══

     كلتاهما تجمع الناسَ كلَّهم لا واحدا بعينه، فتنمو بنموّ العمل: من أراد
     عقدَ فلانٍ بعد عامٍ مرّره بعينه. والبحثُ بـ`matchesQuery` لا بمطابقةٍ
     حرفيّة — فهي تطبّع الهمزةَ والتاءَ المربوطة، والاسمُ يُكتب بوجهين. */
  const [contractQ, setContractQ] = useState("");
  const [contractPage, setContractPage] = useState(1);
  const [offerQ, setOfferQ] = useState("");
  const [offerPage, setOfferPage] = useState(1);

  /* ═══ وسمُ الطباعة ═══

     القاعدةُ في `@media print` معلَّقةٌ عليه، فلا تُعدَّل طباعةُ شاشةٍ أخرى
     بشيءٍ منها. ويُرفَع بإغلاق النافذة لا بعد الطباعة: `window.print` تحبس
     الخيطَ في متصفّحاتٍ وتعود فورا في أخرى، فمن رفعه بعدها رفعه قبل أن
     تُرسَم الورقةُ في بعضها. */
  useEffect(() => {
    if (!shownBody) return;
    document.body.setAttribute("data-printing", "contract-body");
    return () => document.body.removeAttribute("data-printing");
  }, [shownBody]);

  const contractView = useMemo(() => paginate(
    contracts.filter((c) => matchesQuery(contractQ, [
      c.title, c.profile?.application?.fullName, c.profile?.application?.email,
      c.profile?.application?.reference, c.signerLegalName, STATUS_AR[c.status] ?? c.status,
    ])),
    contractPage, 10,
  ), [contracts, contractQ, contractPage]);

  const offerView = useMemo(() => paginate(
    offers.filter((o) => matchesQuery(offerQ, [
      o.courseTitleAr, o.cohort?.title, o.profile?.application?.fullName,
      o.profile?.application?.email, OFFER_STATUS_AR[o.status] ?? o.status,
    ])),
    offerPage, 10,
  ), [offers, offerQ, offerPage]);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ contracts: ContractRow[]; candidates: CandidateRow[]; missingLegal: string[] }>(
        "/api/admin/trainer-contracts",
      );
      setContracts(d.contracts); setCandidates(d.candidates); setMissingLegal(d.missingLegal);
    } catch (e) { setErr(permissionMessage(e, "تعذّر تحميل العقود")); }
    /* والعروضُ خلف صلاحيّةٍ أخرى (`trainer.assign`): من يملك العقودَ ولا
       يملكها يرى شاشتَه كاملةً بلا قسمِ العروض، لا نصفَ شاشةٍ بخطإٍ أحمر. */
    try {
      const [o, opts] = await Promise.all([
        apiGet<OfferRow[]>("/api/admin/trainer-offers"),
        apiGet<OfferOption[]>("/api/admin/trainer-offers/options"),
      ]);
      setOffers(o); setOfferOptions(opts);
    } catch { setOffers([]); setOfferOptions([]); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openComposer = async (c: CandidateRow) => {
    setErr(""); setNote(""); setPreview("");
    try {
      const p = await apiGet<Prefill>(`/api/admin/trainer-applications/${c.id}/contract-prefill`);
      setPrefill(p); setOpenFor(c);
      setLegalNameAr(p.legalNameAr);
      setTitle(`اتفاقية تقديم خدمات تدريبية — ${p.legalNameAr}`);
      setPicked(new Set(p.courses.map((x) => x.courseId)));
      setDocs(DEFAULT_REQUIRED_DOCUMENTS);
      setHoursNoteAr(""); setWaivedAr("");
      /* وتُملأ خاناتُ الأتعاب بالقاعدة القائمة إن كانت — فالموظّفُ يعدّل
         رقما قائما لا يكتبه من فراغٍ فينسى أحدَها. */
      setFeeRate(p.compensation?.rate ?? "");
      setFeeReferralRate(p.compensation?.referralRate ?? "");
      setFeeMinSeats(p.compensation?.minSeats != null ? String(p.compensation.minSeats) : "");
      setOrientationAt(""); setOrientationUrl("");
    } catch (e) { setErr(permissionMessage(e, "تعذّر تجهيز الشاشة")); }
  };

  const composeBody = useMemo(() => {
    const rate = Number(feeRate);
    const referral = feeReferralRate.trim() === "" ? null : Number(feeReferralRate);
    /* ولا تُرسَل قاعدةٌ إلّا إن كُتب سعرٌ صالح: الخانةُ الفارغةُ تعني «اتركِ
       القاعدةَ القائمةَ كما هي»، لا «اجعلها صفرا». */
    const compensation = feeRate.trim() !== "" && Number.isFinite(rate) && rate > 0
      ? {
          type: "per_seat" as const,
          rate,
          minSeats: feeMinSeats.trim() === "" ? undefined : Number(feeMinSeats),
          referralRate: referral !== null && Number.isFinite(referral) && referral > 0 ? referral : null,
        }
      : null;
    return {
      title,
      trainerLegalNameAr: legalNameAr.trim() || null,
      courseIds: [...picked],
      requiredDocuments: docs,
      hoursNoteAr: hoursNoteAr.trim() || null,
      rateWaivedReasonAr: waivedAr.trim() || null,
      compensation,
      orientationAt: orientationAt.trim() === "" ? null : new Date(orientationAt).toISOString(),
      orientationUrl: orientationUrl.trim() || null,
    };
  }, [title, legalNameAr, picked, docs, hoursNoteAr, waivedAr, feeRate, feeReferralRate, feeMinSeats,
      orientationAt, orientationUrl]);

  /* ═══ وخطأُ الصفّ يُرسَم في الصفّ (٢٦ سبتمبر ٢٠٢٦) ═══

     بلاغُ صاحب المنصّة: «عندما أقوم بتوقيع الاتفاقية منّي كأدمن لا يتمّ
     التوقيع ولا يتغيّر شيءٌ بالصفحة». وقد كان الخادمُ يردّ برسالةٍ مفصَّلةٍ
     تقول لماذا — لكنّها تُرسَم في رأس الصفحة، والقائمةُ عشرةُ عقودٍ في كلّ
     صفحة، وموضعُ الضغط قد يكون تحت الرأس بشاشتَين. فمن ضغط لم يرَ شيئا.

     فمن ضغط زرّا في صفٍّ يقرأ جوابَه في ذلك الصفّ. والرأسُ يبقى لما يخصّ
     الصفحةَ كلَّها — تعذُّرُ التحميل، وتركيبُ عقدٍ جديد. */
  const [rowErr, setRowErr] = useState<{ id: string; text: string } | null>(null);

  /* و`fn` لها أن تردّ نصَّ نجاحها: فعلٌ واحدٌ يقع أثرُه على وجهَين — يُختَم
     عرضٌ فيُفتح حسابٌ، أو يُوثَّق بندٌ على نشطٍ فلا تُمسّ حالتُه — لا يُقال
     عنه نصٌّ واحدٌ يصدق في إحداهما. وما لم تردّ شيئا فنصُّ `ok`. */
  const run = async (fn: () => Promise<void | string>, ok: string, rowId?: string) => {
    setBusy(true); setErr(""); setNote(""); setRowErr(null);
    try {
      const said = await fn();
      setNote(typeof said === "string" ? said : ok);
    } catch (e) {
      const text = permissionMessage(e, "تعذّر الإجراء");
      if (rowId) setRowErr({ id: rowId, text }); else setErr(text);
    }
    finally { setBusy(false); }
  };

  /** يقرأ أثرَ الإغلاق ثمّ يفتح النافذة — ولا يفتحها إن لم يُقرأ.
   *
   *  ولا `run` هنا: هذه قراءةٌ لا إجراء، و«تمّ» فوق نافذةٍ تسأل «أمتأكّد؟»
   *  تقول إنّ شيئا وقع ولم يقع شيء. */
  const closeWith = async (row: ContractRow, mode: "revoke" | "depart") => {
    setBusy(true); setErr(""); setNote(""); setRowErr(null);
    try {
      setClosing({ row, mode, impact: await apiGet<Impact>(`/api/admin/trainer-contracts/${row.id}/impact`) });
    } catch (e) {
      setRowErr({ id: row.id, text: permissionMessage(e, "تعذّرت قراءةُ أثر الإغلاق — ولا يُغلَق على غير علم") });
    }
    finally { setBusy(false); }
  };

  const toggleDoc = (kind: string, labelAr: string) => {
    setDocs((cur) => cur.some((d) => d.kind === kind)
      ? cur.filter((d) => d.kind !== kind)
      : [...cur, { kind, labelAr, required: true }]);
  };

  return (
    <AdminLayout title="عقودُ المدرّبين">
      {missingLegal.length > 0 && (
        <Panel tone="warn" className="mb-5 p-4">
          <h2 className="mb-1 font-bold">هويّةُ الأكاديميّة القانونيّة غيرُ مكتملة</h2>
          <p className="text-sm">
            لا يُركَّب عقدٌ بطرفٍ أوّلَ ناقص. الناقص: <b>{missingLegal.join(" · ")}</b>.
            {" "}يُستكمَل في <code>src/data/academy-legal.ts</code>. والمعاينةُ تعمل قبل ذلك.
          </p>
        </Panel>
      )}

      {err && <Panel tone="danger" className="mb-4 p-3 text-sm" role="alert">{err}</Panel>}
      {note && <Panel tone="positive" className="mb-4 p-3 text-sm" role="status">{note}</Panel>}

      {/* ═══ من ينتظر عقدا ═══ */}
      <Card className="mb-6 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-black">
          <FileSignature size={18} aria-hidden="true" /> من ينتظر عقدا ({candidates.length})
        </h2>
        {candidates.length === 0
          ? <p className="text-sm opacity-70">لا أحد — كلُّ من قُبل له عقدٌ قائم.</p>
          : (
            <ul className="space-y-2">
              {candidates.map((c) => (
                <li key={c.id}>
                  <Inset className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <span>
                      <b>{c.fullName}</b>
                      <span className="opacity-70"> — {c.reference} · {c.email}</span>
                    </span>
                    <Button size="sm" tone="primary" onClick={() => void openComposer(c)}>
                      ركّبْ عقدا
                    </Button>
                  </Inset>
                </li>
              ))}
            </ul>
          )}
      </Card>

      {/* ═══ شاشةُ التركيب ═══ */}
      {openFor && prefill && (
        <Card className="mb-6 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black">تركيبُ عقدٍ لـ{prefill.fullName}</h2>
            <Button size="sm" onClick={() => { setOpenFor(null); setPrefill(null); setPreview(""); }}>
              أغلِقْ
            </Button>
          </div>

          <Panel tone={prefill.gatesActivation ? "default" : "warn"} className="mb-4 p-3 text-sm">
            {prefill.gatesActivation
              ? "هذا العقدُ يحبس التفعيل: يُنقل الطلبُ إلى «عقد قيد التوقيع»، ولا يُفتح حسابُه حتّى يُعتمَد توقيعُه."
              : "المدرّبُ نشطٌ أصلا — فهذا العقدُ توثيقٌ على ملفٍّ حيّ، ولا تُمسُّ حالةُ طلبه ولا وصولُه إلى بوّابته."}
          </Panel>

          {/* ═══ واسمُ الطرف الثاني أوّلُ ما يُملأ ═══

              فهو أوّلُ ما يُطابَق بوثيقة الهويّة، وآخرُ ما يُمكن تصحيحُه بلا
              ثمن: ما دخل المتنَ دخل بصمتَه، وتصحيحُه بعد الإرسال عقدٌ بديل. */}
          <label className="mb-1 block text-sm font-bold" htmlFor="legal-name">
            اسمُ الطرف الثاني — كما في وثيقة هويّته
          </label>
          <input id="legal-name" value={legalNameAr} maxLength={120}
            onChange={(e) => setLegalNameAr(e.target.value)}
            className={`${inputCls} w-full`} />
          <p className="mb-4 mt-1 text-read leading-6 text-muted-foreground">
            {prefill.legalNameSource === "account"
              ? "وهذا ما وصلنا من حسابه — وغالبا ليس اسما ثلاثيّا ولا يطابق جوازَه. طابِقْه بوثيقته قبل التركيب: ما يُطبَع هنا يصير اسمَ الطرف الثاني في الوثيقة، ويوقّع هو باسمه القانونيّ تحته."
              : "وهذا اسمُه القانونيُّ المثبَّتُ في ملفّه — يُطبَع طرفا ثانيا، ولك تعديلُه إن تغيّرت وثيقتُه."}
          </p>

          <label className="mb-1 block text-sm font-bold" htmlFor="contract-title">عنوانُ العقد</label>
          <input id="contract-title" value={title} onChange={(e) => setTitle(e.target.value)}
            className={`${inputCls} mb-4 w-full`} />

          {/* الأجر — مقروءٌ لا محرَّر */}
          <h3 className="mb-1 text-sm font-bold">الأتعاب (الملحق ب)</h3>
          {prefill.compensation ? (
            <Inset className="mb-4 p-3 text-sm">
              {RULE_TYPE_AR[prefill.compensation.type] ?? prefill.compensation.type}
              {" — "}<b>{prefill.compensation.rate} {prefill.compensation.currency}</b>
              {prefill.compensation.minSeats ? ` · حدٌّ أدنى ${prefill.compensation.minSeats} مقعدا` : ""}
              {prefill.compensation.referralRate ? ` · مقعدُ الإحالة ${prefill.compensation.referralRate}` : ""}
              <span className="block opacity-70">تُضبط من «أتعاب المدربين» — وتُقرأ هنا ولا تُحرَّر.</span>
            </Inset>
          ) : (
            <Panel tone="warn" className="mb-4 p-3 text-sm">
              <p className="mb-2">لا قاعدةَ أتعابٍ لهذا المدرّب. تضبطها الماليّةُ من «أتعاب المدربين»، أو يُكتب سببُ الإرسال بلا أجرٍ متّفقٍ عليه:</p>
              <label className="sr-only" htmlFor="waived">سببُ الإرسال بلا أجر</label>
              <input id="waived" value={waivedAr} onChange={(e) => setWaivedAr(e.target.value)}
                placeholder="يُحدَّد قبل أوّل إسناد باتفاقٍ مكتوب" className={`${inputCls} w-full`} />
            </Panel>
          )}

          {prefill.feeNotes.length > 0 && (
            <Inset className="mb-4 p-3 text-sm">
              <b>ما قيل في المقابلة عن الأجر</b> — استئناسا، ولا يُحتسب منه شيء:
              <ul className="mt-1 list-inside list-disc opacity-80">
                {prefill.feeNotes.map((f, i) => (
                  <li key={i}>{f.reviewerName ?? "قارئ"}: {f.expectation ?? "—"} / {f.proposal ?? "—"}</li>
                ))}
              </ul>
            </Inset>
          )}

          {/* الدورات — الملحق أ */}
          <h3 className="mb-1 text-sm font-bold">الدوراتُ المؤهَّل لها (الملحق أ)</h3>
          {prefill.courses.length === 0 ? (
            <Panel tone="warn" className="mb-4 p-3 text-sm">
              لا دورةَ مؤهَّلٌ لها بعد. يُؤهَّل من «طلبات المدربين» أوّلا، وإلّا خرج الملحقُ (أ) خاليا —
              والبندُ الثاني هو صلبُ هذا العقد.
            </Panel>
          ) : (
            <Inset className="mb-4 p-3">
              <ul className="space-y-1 text-sm">
                {prefill.courses.map((c) => (
                  <li key={c.courseId}>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={picked.has(c.courseId)}
                        onChange={() => setPicked((s) => {
                          const n = new Set(s);
                          if (n.has(c.courseId)) n.delete(c.courseId); else n.add(c.courseId);
                          return n;
                        })} />
                      <span>{c.titleAr}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-read opacity-70">
                إدراجُ الدورة تأهيلٌ لا إسناد — والبندُ 2-3 يقول ذلك صراحةً للمدرّب.
              </p>
            </Inset>
          )}

          {/* الوثائق — الملحق ج */}
          <h3 className="mb-1 text-sm font-bold">الوثائقُ المطلوبةُ منه (الملحق ج)</h3>
          <Inset className="mb-4 p-3">
            <ul className="space-y-1 text-sm">
              {CONTRACT_DOCUMENT_KINDS.map((k) => (
                <li key={k.key}>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={docs.some((d) => d.kind === k.key)}
                      onChange={() => toggleDoc(k.key, k.labelAr)} />
                    <span>
                      {k.labelAr}
                      <span className="block text-xs opacity-60">{k.hintAr}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-read opacity-70">
              وثيقةُ هويّةٍ واحدةٌ على الأقلّ — البند 15 يُقرّ باسمه القانونيّ، ولا إقرارَ بلا ما يقابله.
            </p>
          </Inset>

          {/* ═══ الأتعاب — تُضبَط هنا ثمّ يُركَّب العقد ═══ */}
          <Inset className="mb-4">
            <h4 className="mb-1 font-black">الأتعاب</h4>
            <p className="mb-3 text-read opacity-70">
              تُضبَط هنا ثمّ يُركَّب العقد — فلا شاشةَ ثانية. والكتابةُ تمرّ
              بمسلك قاعدة الأتعاب نفسِه، فيبقى كاتبُ القاعدة واحدا. واتركِ
              الخاناتِ كما هي إن لم ترد تغييرَ القاعدة القائمة.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-sm font-bold">سعرُ المقعد عبر رابطه</span>
                <input inputMode="decimal" value={feeReferralRate}
                  onChange={(e) => setFeeReferralRate(e.target.value)}
                  className={`${areaCls} w-full`} placeholder="45" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">سعرُ المقعد العامّ</span>
                <input inputMode="decimal" value={feeRate}
                  onChange={(e) => setFeeRate(e.target.value)}
                  className={`${areaCls} w-full`} placeholder="30" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">الحدُّ الأدنى للمقاعد</span>
                <input inputMode="numeric" value={feeMinSeats}
                  onChange={(e) => setFeeMinSeats(e.target.value)}
                  className={`${areaCls} w-full`} placeholder="8" />
              </label>
            </div>
          </Inset>

          {/* ═══ جلسةُ التهيئة — ومنها تبدأ المهلة ═══ */}
          <Inset className="mb-4">
            <h4 className="mb-1 font-black">جلسةُ التهيئة</h4>
            <p className="mb-3 text-read opacity-70">
              ومن تاريخها تبدأ مهلتُه: سبعةُ أيّام. واتركْه فارغا إن لم يُعرَف
              بعد — فيُرسَل العرضُ بلا مهلة، ولا يوسمه العاملُ متأخّرا، ويُكتب
              التاريخُ لاحقا فيصله خبرُه وتبدأ.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-bold">تاريخُها ووقتُها</span>
                <input type="datetime-local" value={orientationAt}
                  onChange={(e) => setOrientationAt(e.target.value)}
                  className={`${areaCls} w-full`} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">رابطُ الحضور</span>
                <input type="url" value={orientationUrl}
                  onChange={(e) => setOrientationUrl(e.target.value)}
                  className={`${areaCls} w-full`} placeholder="https://" dir="ltr" />
              </label>
            </div>
          </Inset>

          <label className="mb-1 block text-sm font-bold" htmlFor="hours-note">
            حجمُ العمل المتوقَّع — استرشاديٌّ لا يُحتسب (اختياريّ)
          </label>
          <textarea id="hours-note" value={hoursNoteAr} onChange={(e) => setHoursNoteAr(e.target.value)}
            rows={2} className={`${areaCls} mb-4 w-full`}
            placeholder="مثلا: نحو 20 ساعة تدريبيّة في الفصل، بحسب ما يُسنَد" />

          <div className="flex flex-wrap gap-2">
            <Button tone="secondary" icon={FileText} loading={busy}
              onClick={() => void run(async () => {
                const r = await apiPost<{ bodyAr: string }>(
                  `/api/admin/trainer-applications/${prefill.applicationId}/contract-preview`, composeBody);
                setPreview(r.bodyAr);
              }, "عُرضت المعاينة")}>
              عايِنِ المتنَ كما يراه
            </Button>
            <Button tone="confirm" icon={FileSignature} loading={busy}
              disabled={title.trim().length < 3}
              onClick={() => void run(async () => {
                await apiPost(`/api/admin/trainer-applications/${prefill.applicationId}/contracts/compose`, composeBody);
                setOpenFor(null); setPrefill(null); setPreview("");
                await load();
              }, "رُكّب العقدُ وجُمّد متنُه")}>
              ركّبْ وجمّدِ المتن
            </Button>
          </div>

          {preview && (
            <section className="mt-4">
              <h3 className="mb-2 text-sm font-bold">المعاينة</h3>
              {/* وتُراجَع بالشكل الذي تُوقَّع به — فلا يُجاز متنٌ رآه الموظّفُ
                  في صورةٍ غيرِ التي يراها المدرّبُ قبل أن يوقّع. */}
              <div dir="rtl" className="max-h-[28rem] overflow-auto rounded-lg">
                <ContractDocument doc={parseContractDoc(preview)} />
              </div>
            </section>
          )}
        </Card>
      )}

      {/* ═══ العقودُ المركَّبة ═══ */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">العقود ({contracts.length})</h2>
          <Button size="sm" icon={RefreshCw} onClick={() => void load()}>حدِّثْ</Button>
        </div>
        {contracts.length > 0 && (
          <ListToolbar q={contractQ} onQ={setContractQ} onPage={setContractPage}
            view={contractView} unit="عقدا"
            placeholder="ابحث باسم المدرّب أو بريده أو مرجعه أو حالة عقده…" />
        )}
        {contracts.length === 0
          ? <p className="text-sm opacity-70">لا عقودَ بعد.</p>
          : contractView.rows.length === 0
            ? <p className="text-sm opacity-70">لا عقدَ يطابق بحثَك.</p>
            : (
            <ul className="space-y-2">
              {contractView.rows.map((c) => (
                <li key={c.id}>
                  <Inset className="p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <b>{docNameOf(c)}</b>
                        <span className="opacity-70">
                          {" "}— {STATUS_AR[c.status] ?? c.status}
                          {c.bodyVersion ? ` · صياغة ${c.bodyVersion}` : " · بلا متن (البابُ القديم)"}
                          {" · "}{fmtDateTime(c.createdAt)}
                        </span>
                      </span>
                      <span className="flex flex-wrap gap-2">
                        {c.status === "draft" && c.bodyHash && (
                          <Button size="sm" tone="confirm" icon={Send}
                            onClick={() => void run(async () => {
                              const r = await apiPost<{ signingUrl: string }>(
                                `/api/admin/trainer-contracts/${c.id}/send`, {});
                              setLink({ id: c.id, url: r.signingUrl });
                              await load();
                            }, "أُرسل العقدُ — والرابطُ أدناه")}>
                            أرسِلْه للتوقيع
                          </Button>
                        )}
                        {c.status === "sent" && (
                          <Button size="sm" icon={RefreshCw}
                            onClick={() => void run(async () => {
                              const r = await apiPost<{ signingUrl: string }>(
                                `/api/admin/trainer-contracts/${c.id}/resend`, {});
                              setLink({ id: c.id, url: r.signingUrl });
                              await load();
                            }, "جُدِّد الرابطُ — والقديمُ بطل")}>
                            جدِّدِ الرابط
                          </Button>
                        )}
                        {c.bodyHash && (
                          <Button size="sm" icon={FileText}
                            onClick={() => void run(async () => {
                              const full = await apiGet<{ bodyAr: string | null }>(`/api/admin/trainer-contracts/${c.id}/body`);
                              setShownBody({ title: c.title, body: full.bodyAr ?? "" });
                            }, "عُرض المتن")}>
                            المتن
                          </Button>
                        )}
                        {/* والموقوفُ على طلب تعديلٍ يُلغى أيضا: هو الطريقُ إلى
                            «أُلغي وأُرسل مصحَّحا» — وهو أحدُ الجوابَين المكتوبَين في الخادم. */}
                        {(c.status === "draft" || c.status === "sent" || c.status === "amendment_requested") && (
                          <Button size="sm" tone="danger" icon={Ban} loading={busy}
                            onClick={() => void closeWith(c, "revoke")}>
                            ألغِ
                          </Button>
                        )}
                        {/* ═══ والنافذُ يُفسَخ من صفّه — بالطريق المحروس (٢٦ سبتمبر ٢٠٢٦) ═══

                            كان الزرُّ الوحيدُ على النافذ هو «اعتمِدْ»، وهو مضغوطٌ
                            أصلا: فلا مخرجَ من عقدٍ نافذٍ في هذه الشاشة أبدا. ومن
                            أراد إنهاءَه ذهب إلى شاشةِ الرحيل إن عرفها.

                            والزرُّ يمشي في `trainer-departures` لا في مسارٍ ثانٍ
                            يفسخ العقدَ وحدَه: الرحيلُ يفسخ العقدَ **ويفتح صفّا
                            لكلّ متعلّمٍ ويسحب العروضَ المعلَّقة**. ومن فسخ العقدَ
                            وحدَه ترك شعبا بلا مدرّبٍ وعروضا تنتظر جوابَ راحل. */}
                        {c.status === "countersigned" && c.profile?.id && (
                          <Button size="sm" tone="danger" icon={UserMinus} loading={busy}
                            onClick={() => void closeWith(c, "depart")}>
                            أنهِ تعاقدَه
                          </Button>
                        )}
                        {/* ═══ الحذف — وما مسَّه توقيعٌ لا زرَّ له، ويُقال لماذا ═══

                            والشرطُ **هو** `isUntouchableContract` لا صورةٌ منه: كان
                            منسوخا هنا بقائمةِ حالاتٍ مكتوبةٍ باليد، ونسختان من حكمٍ
                            تفترقان يوما فيُخفي أحدُهما زرّا يسمح به الآخر. والحكمُ
                            في الخادم كما كان: هذا يمنع زرّا يُرَدّ، وذاك يمنع الفعلَ
                            نفسَه. ومن اكتفى بإخفاء الزرّ حذف بـ`curl`.

                            وغيابُ الزرّ صامتا هو ما شكا منه صاحبُ المنصّة (٢٦
                            سبتمبر ٢٠٢٦): «العقد الملغى لم يظهر لي زرّ تحميل أو
                            حذف». والملغى الذي كان بين يديه **موقَّعا** رُفض
                            توقيعُه — فالمنعُ صوابٌ والصمتُ خطأ. فيُقال السببُ
                            وتُذكر النسخةُ التي يملكها بدلَه. */}
                        {isUntouchableContract(c)
                          ? (
                            <span className="self-center text-xs opacity-70">
                              مسَّه توقيعٌ — فلا يُحذَف، وتُطبَع نسختُه وتُنزَّل
                            </span>
                          )
                          : (
                            <Button size="sm" tone="danger" icon={Trash2}
                              onClick={() => setDeleting(c)}>
                              احذِفْ
                            </Button>
                          )}
                      </span>
                    </div>
                    {/* ═══ الاسمان معا — وما وراء التنبيه ═══

                        `differs` لا تقول «مزوَّر»: تقول إنّ ثَمَّ ما يُنظَر فيه.
                        والنظرُ مقابلةُ وثيقة الهويّة بعين الموظّف — ولذلك يُذكَر
                        المخرجُ معه: من كان الموقَّعُ به هو الصحيحَ رَدَّ التوقيعَ،
                        فيُركَّب بديلٌ باسمه. */}
                    {nameMatch(namesOf(c)) !== "unsigned" && (
                      <Panel tone={nameMatch(namesOf(c)) === "differs" ? "warn" : "positive"}
                        className="mt-2 p-2 text-read leading-6">
                        <span className="opacity-70">في الوثيقة:</span> <b>{docNameOf(c)}</b>
                        <span className="opacity-40">{"  ×  "}</span>
                        <span className="opacity-70">وقّع به:</span> <b>{c.signerLegalName ?? "—"}</b>
                        {nameMatch(namesOf(c)) === "differs"
                          ? (
                            <span className="block opacity-80">
                              الاسمان مختلفان — قابِلْهما بوثيقة هويّته قبل الاعتماد. فإن كان
                              الموقَّعُ به هو الصحيحَ فاردُدِ التوقيعَ، ويُركَّب بديلٌ باسمه.
                            </span>
                          )
                          : <span className="opacity-70">{" — مطابق"}</span>}
                      </Panel>
                    )}
                    {link?.id === c.id && (
                      <Panel tone="positive" className="mt-2 p-2">
                        <p className="mb-1 text-read">رابطُ التوقيع — انسخْه الآن، فلا يُعرض ثانية:</p>
                        <code className="block break-all">{link.url}</code>
                      </Panel>
                    )}
                    {/* ═══ ورفضُ التوقيع وعدٌ يُوفى بنقرة (٢٦ سبتمبر ٢٠٢٦) ═══

                        بريدُ الرفض يقول لصاحبه: «ويصلك عقدٌ جديدٌ برابطٍ جديدٍ
                        بعد تصحيحه». وكان لا يُنشأ شيء: الصفُّ يُغلَق، ورمزُه
                        ميّتٌ منذ التوقيع، ولا صفَّ مسودّةٍ ينتظر. فمن رُفض
                        توقيعُه يبقى بلا بابٍ إلى الأبد، والوعدُ مكتوبٌ في
                        بريده. فهذا هو البابُ الذي وُعد به. */}
                    {c.status === "revoked" && (c.revokeReasonAr ?? "").startsWith("رُفض التوقيع") && (
                      <Panel tone="warn" className="mt-2 p-3">
                        <p className="mb-1 font-black">رُفض توقيعُه — ووُعِد بعقدٍ مصحَّح</p>
                        <p className="text-read leading-6 opacity-80">
                          وقّع باسم <b>{c.signerLegalName ?? "—"}</b>، والوثيقةُ تسمّيه{" "}
                          <b>{docNameOf(c)}</b>. اكتبِ اسمَه كما في
                          وثيقة هويّته، فيُركَّب بديلٌ به ويُرسَل إليه برابطٍ جديد — وبنودُه
                          وأتعابُه كما هي.
                        </p>
                        {rowErr?.id === c.id && (
                          <Panel tone="danger" className="mt-2 p-3 text-read" role="alert">{rowErr.text}</Panel>
                        )}
                        <div className="mt-3 grid gap-2">
                          <input
                            className={inputCls} maxLength={120}
                            placeholder="الاسمُ الكاملُ كما في الهويّة أو جواز السفر"
                            value={fixName?.id === c.id ? fixName.nameAr : ""}
                            onChange={(e) => setFixName({ id: c.id, nameAr: e.target.value })}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button tone="confirm" icon={FilePlus2} loading={busy}
                              disabled={(fixName?.id !== c.id) || fixName.nameAr.trim().length < 4}
                              onClick={() => void run(async () => {
                                await apiPost(`/api/admin/trainer-contracts/${c.id}/name-reissue`,
                                  { legalNameAr: fixName!.nameAr.trim() });
                                setFixName(null);
                                await load();
                              }, "رُكِّب البديلُ باسمه الصحيحِ ووصلَه برابطٍ جديد", c.id)}>
                              صحّحِ الاسمَ وأعِدْ إرساله
                            </Button>
                          </div>
                        </div>
                      </Panel>
                    )}
                    {c.revokeReasonAr && (
                      <p className="mt-1 text-read opacity-70">سببُ الإلغاء: {c.revokeReasonAr}</p>
                    )}
                    {c.declineReasonAr && (
                      <p className="mt-1 text-read opacity-70">سببُ الاعتذار: {c.declineReasonAr}</p>
                    )}

                    {/* ═══ طلبُ التعديل — يُقرأ ويُجاب ═══

                        كان يصل ويُحفَظ ويُشعِر، ولا شيءَ يردّه: فيرى الموظّفُ
                        الحالةَ وحدَها ولا يدري ما المطلوب، فيقف العقدُ أبدا.

                        والجوابان مكتوبان في الخادم منذ كُتِب: إمّا يُرَدّ عليه فيبقى
                        العرضُ، وإمّا يُلغى ويُرسَل مصحَّحا (زرُّ «ألغِ» أعلاه). */}
                    {/* ═══ تصحيحُ الاسم جوابُه نقرةٌ لا صندوقُ نصّ (٢٦ سبتمبر ٢٠٢٦) ═══

                        الوقوفُ واحدٌ في الحالة، والجوابُ مختلف: طلبُ التعديل
                        يُجاب بنعم أو لا، وتصحيحُ الاسم لا يُجاب إلّا بفعلٍ —
                        وثيقةٌ تسمّي غيرَه لا تُوقَّع، ولا رأيَ لنا في اسمه.
                        فيُعرَض ما قاله وزرٌّ واحدٌ يُنفّذه. */}
                    {c.status === "amendment_requested" && c.nameCorrectionAr && (
                      <Panel tone="warn" className="mt-2 p-3">
                        <p className="mb-1 font-black">يقول إنّ اسمَه في هويّته غيرُ المكتوب — والتوقيعُ واقف</p>
                        {c.nameCorrectionAt && (
                          <p className="text-read opacity-70">{fmtDateTime(c.nameCorrectionAt)}</p>
                        )}
                        <p className="mt-2 leading-7">
                          المكتوبُ في الوثيقة: <b>{docNameOf(c)}</b>
                          {" · "}وما يقوله هو: <b>{c.nameCorrectionAr}</b>
                        </p>
                        <p className="mt-2 text-read leading-6 opacity-80">
                          طابِقْه بوثيقة هويّته، ثمّ أعِدْ بنقرةٍ: يُلغى هذا العرضُ ويُركَّب
                          بديلٌ باسمه الصحيح ويُرسَل إليه برابطٍ جديد — وبنودُه وأتعابُه
                          كما هي، لا يتغيّر إلّا الاسم. ويُحفَظ في ملفّه فلا يُسأل عنه ثانية.
                        </p>
                        {rowErr?.id === c.id && (
                          <Panel tone="danger" className="mt-2 p-3 text-read" role="alert">{rowErr.text}</Panel>
                        )}
                        <Button className="mt-3" tone="confirm" icon={FilePlus2} loading={busy}
                          onClick={() => void run(async () => {
                            await apiPost(`/api/admin/trainer-contracts/${c.id}/name-reissue`, {});
                            await load();
                          }, "أُعيد العقدُ مصحَّحا باسمه، ووصلَه برابطٍ جديد", c.id)}>
                          طابقتُ هويّتَه — أعِدْه مصحَّحا
                        </Button>
                      </Panel>
                    )}

                    {c.status === "amendment_requested" && !c.nameCorrectionAr && (
                      <Panel tone="warn" className="mt-2 p-3">
                        <p className="mb-1 font-black">طلب تعديلا — والتوقيعُ واقفٌ حتّى تجيبَه</p>
                        {c.amendmentRequestedAt && (
                          <p className="text-read opacity-70">{fmtDateTime(c.amendmentRequestedAt)}</p>
                        )}
                        <p className="mt-2 whitespace-pre-wrap leading-7">{c.amendmentRequestAr}</p>
                        {/* ═══ والجوابانِ يُقالان هنا لا في تعليقٍ يقرؤه المبرمج ═══

                            الجوابُ الثاني مبنيٌّ وزرُّه قائمٌ (زرُّ «ألغِ» في صفّ
                            الأفعال أعلاه)، وتعليقُ الشيفرة يشير إليه — **والموظّفُ
                            لا يقرأ التعليقات**. فمن قرأ الطلبَ في هذا اللوح رأى
                            جوابا واحدا، وهو المصيدةُ نفسُها التي وُجدت في إعادة
                            الموادّ: قرارٌ مبنيٌّ لا يُرى عند موضع القرار.

                            ولا يُكرَّر زرُّ الإلغاء هنا: فعلٌ لا رجعةَ فيه لا
                            يُنسَخ في موضعَين من شاشةٍ واحدة. فيُسمّى ويُدَلّ عليه. */}
                        <p className="mt-3 text-read leading-6 opacity-80">
                          اكتبْ جوابَك ثمّ اخترْ ما يترتّب عليه: <b>يبقى العرضُ كما هو</b> فيعود
                          إليه برابطٍ جديدٍ ليوقّعه أو يعتذر؛ أو <b>تقبل تعديلَه</b> فيُغلَق هذا
                          العرضُ ويصله أنّ عقدا مصحَّحا يُعَدّ له، ثمّ تركّبه من «عقدٌ جديد» أعلاه.
                          وفي الحالين يصله جوابُك بحرفه. ولا يُعدَّل متنُ عرضٍ أُرسل: هو مجمَّدٌ
                          مهشَّش، فالتصحيحُ عرضٌ جديدٌ لا كتابةٌ فوق القائم.
                        </p>
                        {replying?.id === c.id ? (
                          <div className="mt-3">
                            <textarea
                              value={replying.replyAr}
                              onChange={(e) => setReplying({ id: c.id, replyAr: e.target.value })}
                              rows={3}
                              placeholder="ردُّك — يقرؤه وهو أمام زرّ التوقيع"
                              className={`${areaCls} w-full`}
                            />
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button size="sm" tone="confirm" icon={MessageSquareReply}
                                disabled={replying.replyAr.trim().length < 5}
                                /* ═══ والرابطُ الجديدُ لا يُهدَر ═══

                                   الردُّ يسكّ رمزا جديدا، و`tokenHash` عمودٌ فريدٌ
                                   يُكتب فوقَ القديم — **فرابطُ المدرّب القديمُ
                                   يموت في هذه اللحظة**. والخادمُ يُعيد الجديدَ
                                   للموظّف لعلّةٍ مكتوبةٍ في رأسه: «فقناةُ البريد
                                   قد تتعثّر، ومن يملك الصلاحيّةَ يحتاج نسخةً
                                   يسلّمها بيده».

                                   وكان هذا الموضعُ **يُهمله** — خلافا لـ«أرسِلْه»
                                   و«جدِّدِ الرابط» وكلاهما يعرضه. فإن تعثّر البريدُ
                                   هنا مات رابطُ المدرّب ولا نسخةَ عند أحد، ولا شيءَ
                                   يقول للموظّف إنّ الرابطَ تبدّل أصلا. */
                                onClick={() => void run(async () => {
                                  const r = await apiPost<{ signingUrl: string }>(
                                    `/api/admin/trainer-contracts/${c.id}/amendment-reply`,
                                    { replyAr: replying.replyAr.trim() });
                                  setLink({ id: c.id, url: r.signingUrl });
                                  setReplying(null);
                                  await load();
                                }, "وصلَه جوابُك — وجُدِّد رابطُ التوقيع، والقديمُ بطل", c.id)}>
                                أرسِلْ الردّ — يبقى العرضُ كما هو
                              </Button>
                              {/* ═══ والجوابُ الثاني صار زرّا يُرى (٢٦ سبتمبر ٢٠٢٦) ═══

                                  بلاغُ صاحب المنصّة: «وإذا أردت أن أردّ عليه بأنّنا
                                  سنعدّل العقد ونرسل لك عقدا جديدا لا يوجد زرٌّ لهذا
                                  الأمر». وكان البابُ موجودا بمعناه لا باسمه: يُلغى
                                  بزرّ «ألغِ» ثمّ يُركَّب غيرُه — وهو ما لا يخطر لمن
                                  يقرأ طلبَ تعديلٍ في لوحه، فضلا عن أنّ الإلغاءَ كان
                                  لا يرسل شيئا وسببُه لا يقول إنّ طلبَه قُبل. */}
                              <Button size="sm" tone="confirm" icon={FilePlus2}
                                disabled={replying.replyAr.trim().length < 5}
                                onClick={() => void run(async () => {
                                  await apiPost(
                                    `/api/admin/trainer-contracts/${c.id}/amendment-reissue`,
                                    { replyAr: replying.replyAr.trim() });
                                  setReplying(null);
                                  await load();
                                }, "وصلَه أنّ عقدا مصحَّحا يُعَدّ له — ركّبْه الآن من «عقدٌ جديد»", c.id)}>
                                قبِلتُ التعديل — سأرسل عقدا مصحَّحا
                              </Button>
                              <Button size="sm" tone="ghost" onClick={() => setReplying(null)}>صرفُ النظر</Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" tone="confirm" icon={MessageSquareReply} className="mt-3"
                            onClick={() => setReplying({ id: c.id, replyAr: "" })}>
                            رُدَّ عليه
                          </Button>
                        )}
                      </Panel>
                    )}
                    {c.amendmentReplyAr && c.status !== "amendment_requested" && (
                      <p className="mt-1 text-read opacity-70">
                        ردُّنا على طلب التعديل: {c.amendmentReplyAr}
                      </p>
                    )}

                    {/* ═══ وقّعه صاحبُه — والاعتمادُ مطابقةُ اسمٍ بوثيقة ═══

                        فالوثائقُ تُفتح هنا قبل الزرّ، لا يُضغط الزرُّ على ثقة.
                        ورابطُ كلٍّ منها موقَّتٌ لعشر دقائق، وكلُّ فتحةٍ تُكتب
                        في الأثر باسم من فتح. */}
                    {c.status === "signed" && (
                      <Panel tone="warn" className="mt-3 p-3">
                        <p className="text-read leading-7">
                          وقّع باسم <b>{c.signerLegalName ?? "—"}</b>
                          {c.signedAt ? ` بتاريخ ${fmtDateTime(c.signedAt)}` : ""}. طابِقِ الاسمَ
                          بوثيقة هويّته قبل الاعتماد — فبالاعتماد ينفذ العقدُ
                          {c.gatesActivation
                            ? " ويصير مدرّبا نشطا، وتُفتح بوّابتُه، ويصله العقدُ مختوما منّا"
                            : ", ولا تُمسّ حالتُه فهو نشطٌ أصلا"}.
                        </p>
                        {rowErr?.id === c.id && (
                          <Panel tone="danger" className="mt-2 p-3 text-read" role="alert">
                            {rowErr.text}
                          </Panel>
                        )}
                        {c.documents.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {c.documents.map((d) => (
                              <Button key={d.id} size="sm" icon={IdCard}
                                onClick={() => void run(async () => {
                                  const r = await apiGet<{ url: string }>(
                                    `/api/admin/trainer-contracts/${c.id}/documents/${d.id}/url`);
                                  window.open(r.url, "_blank", "noopener,noreferrer");
                                }, "فُتحت الوثيقة — والفتحةُ مكتوبةٌ في الأثر")}>
                                {CONTRACT_DOCUMENT_KINDS.find((k) => k.key === d.kind)?.labelAr ?? d.kind}
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-read opacity-70">لا وثيقةَ مرفوعةٌ مع هذا العقد.</p>
                        )}

                        {/* ═══ والقرارُ الثالث: «أعِدِ الموادَّ بملاحظات» ═══

                            كان للموظّف على العرض الموقَّع جوابانِ يبلغهما:
                            **اعتمِدْ**، أو **ارفضِ التوقيع**. والثاني عن
                            مطابقة الهويّة لا عن الموادّ — فمن رأى موادَّ
                            ناقصةً لم يجد ما يقوله.

                            و`returnMaterialsWithNotes` مبنيّةٌ منذ بُني الطورُ
                            المشروط، ولها مسارٌ محروس: تستأنف المهلةَ مضافا
                            إليها **مدّةُ التجميد بالضبط**، وتُرسل ملاحظاتَه
                            إليه نصّا، وتكتب فعلَها في الأثر. ولا شاشةَ كانت
                            تنادِيها.

                            والعاملان يتخطّيان المجمَّد، فلا تذكيرَ ولا وسمَ
                            تأخّر. فمن جمّد موادَّه بقي معلَّقا أبدا — ولا
                            مخرجَ إلّا اعتمادُ ما لم يُعتمَد، أو إلغاءُ عقدٍ
                            وقّعه. وهذا هو المخرجُ الثالثُ الصحيح. */}
                        {c.gatesActivation
                          && conditionPhase(conditionFactsOf(c)) !== "none"
                          && conditionPhase(conditionFactsOf(c)) !== "met" ? (
                          <Inset className="mt-3 px-4 py-3">
                            <p className="text-read font-black text-foreground">
                              {CONDITION_PHASE_LABELS_AR[conditionPhase(conditionFactsOf(c))]}
                            </p>
                            {c.conditionPausedAt ? (
                              <>
                                <p className="mt-1 text-read leading-6 text-muted-foreground">
                                  أعلن اكتمالَ موادّه في {fmtDateTime(c.conditionPausedAt)}، ومهلتُه
                                  مجمّدةٌ حتّى يصله جوابُك. وبالإعادةِ تُستأنف مضافا إليها مدّةُ
                                  التجميد بالضبط — فوقتُ مراجعتك لا يُحسب عليه.
                                </p>
                                {sendBack?.id === c.id ? (
                                  <div className="mt-3 grid gap-2">
                                    {/* ولا نصٌّ مقترَحٌ يُملأ سلفا: هذا السطرُ يصل المدرّبَ
                                        بحرفه، وعبارةٌ عامّةٌ تُرسَل كما هي توقف حلقةَ
                                        «يعدّل ويقدّم ثانيةً» عند أوّل دورة. فيُعرَض شكلُ
                                        الملاحظة النافعة مثالا لا قيمة. */}
                                    <textarea
                                      className={areaCls} rows={3} maxLength={4000}
                                      placeholder="ما ينقص بعينه — مثال: «ينقص محورُ التقويم في الوحدة الثالثة، ومدّةُ الجلسة الثانية غيرُ مبيّنة»"
                                      value={sendBack.notesAr}
                                      onChange={(e) => setSendBack({ id: c.id, notesAr: e.target.value })}
                                    />
                                    <p className="text-read text-muted-foreground">
                                      يصله هذا النصُّ بحرفه — فاكتبْه له لا لنا.
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      <Button tone="confirm" icon={Undo2} loading={busy}
                                        disabled={sendBack.notesAr.trim().length < 5}
                                        onClick={() => void run(async () => {
                                          await apiPost(
                                            `/api/admin/trainer-contracts/${c.id}/return-materials`,
                                            { notesAr: sendBack.notesAr.trim() });
                                          setSendBack(null);
                                          await load();
                                        }, "أُعيدت موادُّه بملاحظاتك — واستأنفت مهلتُه", c.id)}>
                                        أعِدْها وأبلِغْه
                                      </Button>
                                      <Button tone="ghost" onClick={() => setSendBack(null)}>تراجعْ</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <Button className="mt-3" icon={Undo2}
                                    onClick={() => setSendBack({ id: c.id, notesAr: "" })}>
                                    أعِدِ الموادَّ بملاحظات
                                  </Button>
                                )}
                              </>
                            ) : (
                              /* ولا زرَّ يُعرَض معطَّلا بلا سبب: الموادُّ ليست عندك بعد،
                                 فيُقال ذلك بدل زرٍّ يُنقَر فيُردّ من الخادم. */
                              <p className="mt-1 text-read leading-6 text-muted-foreground">
                                ولم يُعلن اكتمالَ موادّه بعد، فلا شيءَ يُعاد إليه اليوم. وحين
                                يُعلنه تتجمّد مهلتُه ويظهر هنا زرُّ الإعادة بملاحظاتك.
                              </p>
                            )}
                          </Inset>
                        ) : null}

                        {signOff?.id === c.id ? (
                          <div className="mt-3 grid gap-2">
                            <textarea
                              className={areaCls} rows={2} maxLength={500}
                              placeholder="ما طابقتَه بالوثيقة — أو تفويضُك الخطّيُّ إن لم تكن المفوَّضَ في السجلّ"
                              value={signOff.noteAr}
                              onChange={(e) => setSignOff({ id: c.id, noteAr: e.target.value })}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button tone="confirm" icon={BadgeCheck} loading={busy}
                                /* ═══ والحسابُ يُفتح من هنا (٢٦ سبتمبر ٢٠٢٦) ═══

                                   قرارُ صاحب المنصّة، ناسخا قرارَ ٢٠ سبتمبر: العرضُ
                                   المشروطُ يُختَم بهذا الزرّ ويصير صاحبُه نشطا في
                                   اللحظة نفسِها. وعلّةُ النسخ في `countersignContract`.

                                   وما ينقص من تجهيزه يردّه الخادمُ برسالةٍ تعدّده —
                                   وتُرسَم في هذا الصفّ لا في رأس الصفحة (`rowErr`). */
                                onClick={() => void run(async () => {
                                  const r = await apiPost<{ readiness?: Readiness; activated?: boolean }>(
                                    `/api/admin/trainer-contracts/${c.id}/countersign`,
                                    { noteAr: signOff.noteAr.trim() || null });
                                  setSignOff(null);
                                  await load();
                                  const left = r.readiness?.blockersAr ?? [];
                                  return r.activated
                                    ? "خُتم العقدُ وصار مدرّبا نشطا — فُتحت بوّابتُه ووصله العقدُ مختوما"
                                    : left.length === 0
                                      ? "اعتُمد العقدُ ونفَذ — ولم تُمسّ حالتُه، فهو نشطٌ أصلا"
                                      : `نفَذ العقدُ. وبقي قبل اعتماده مدرّبا: ${left.join(" · ")}`;
                                }, "اعتُمد العقدُ ونفَذ", c.id)}>
                                {c.gatesActivation ? "اعتمِدْ وفعِّلْ" : "اعتمِدِ التوقيع"}
                              </Button>
                              <Button tone="ghost" onClick={() => setSignOff(null)}>تراجعْ</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button tone="confirm" icon={BadgeCheck}
                              onClick={() => setSignOff({ id: c.id, noteAr: "" })}>
                              {c.gatesActivation ? "طابقتُ الاسمَ — اعتمِدْ وفعِّلْ" : "طابقتُ الاسمَ — اعتمِدْ"}
                            </Button>
                            {/* ورفضُ التوقيع يُغلق العقدَ ولا يمحو دليلَه: من وقّع
                                باسمٍ غيرِ اسمه وقّع وثيقةً تسمّي طرفا آخر، ولا
                                تُصحَّح تسميةُ طرفٍ بتعديل حقل — يُركَّب عقدٌ جديد. */}
                            <Button tone="danger" icon={X}
                              onClick={() => setAsking({
                                titleAr: `رفضُ توقيعِ «${c.title}»`,
                                confirmLabelAr: "ارفضِ التوقيعَ وأبلغْه",
                                labelAr: "ما الذي لم يطابق؟ — يصل صاحبَه بنصّه",
                                whatAr: "يُغلَق هذا العقدُ ولا يُحذَف: دليلُ توقيعه يبقى. ويصل المدرّبَ ما لم"
                                  + " يطابق ووعدٌ بعقدٍ مصحَّحٍ برابطٍ جديد — ويُوفى بنقرةٍ من صفّه بعد ذلك."
                                  + " وتُعاد مهمّةُ التوقيع في قائمته إلى «لم تُنجَز».",
                                okAr: "رُفض التوقيعُ ووصل صاحبَه",
                                rowId: c.id,
                                post: (reasonAr) =>
                                  apiPost(`/api/admin/trainer-contracts/${c.id}/reject-signature`, { reasonAr }),
                              })}>
                              لم يطابق — ارفضْ
                            </Button>
                          </div>
                        )}
                      </Panel>
                    )}

                    {c.status === "countersigned" && (
                      <p className="mt-1 text-read opacity-70">
                        اعتُمد {c.countersignedAt ? fmtDateTime(c.countersignedAt) : ""} عن الأكاديميّة
                        {c.academySignatoryName ? ` — ${c.academySignatoryName}` : ""}
                        {c.academySignatoryTitle ? ` (${c.academySignatoryTitle})` : ""}
                        {c.countersignNoteAr ? ` · ${c.countersignNoteAr}` : ""}
                      </p>
                    )}
                    {/* ═══ الملحق (أ) يُطوى — قرارُ صاحب المنصّة (٢٤ سبتمبر) ═══

                        كان الصفُّ يسكب عناوينَ الدورات كلَّها — أربعًا وثلاثين عنوانا
                        في عقدٍ واحد — فتصير القائمةُ جدارا لا تُميَّز فيه عقدةٌ من عقدة.
                        والعددُ هو ما يُقرأ في قائمة، والعناوينُ تُطلب لمن أرادها. */}
                    {c.qualifiedSnapshot && c.qualifiedSnapshot.length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-read opacity-70 hover:opacity-100">
                          الملحق (أ): {c.qualifiedSnapshot.length} دورةً مؤهّلا لها
                        </summary>
                        <p className="mt-1 text-read leading-6 opacity-70">
                          {c.qualifiedSnapshot.map((q) => q.titleAr).join(" · ")}
                        </p>
                      </details>
                    )}
                  </Inset>
                </li>
              ))}
            </ul>
          )}
      </Card>

      {/* ═══════════ عروضُ الإسناد ═══════════

          «ويحقّ للإدارة إسنادُ دورةٍ واحدةٍ أو لا دورةَ أو كافّةَ الدورات
          لهذا الشخص، لكي لا يُلزِمَنا في عقدٍ ثابت». فالتأهيلُ في الملحق (أ)
          بابٌ لا التزام، والعرضُ هو ما يُفتح منه — ويُقبَل أو يُردّ. */}
      {offerOptions.length > 0 && (
        <Card className="mt-6 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black">عروضُ الإسناد ({offers.length})</h2>
            {offerFor && <Button size="sm" tone="ghost" onClick={() => setOfferFor(null)}>أغلِقِ النموذج</Button>}
          </div>

          <p className="mb-3 text-read leading-7 opacity-70">
            العرضُ دعوةٌ لا توجيه: يقبلها المدرّبُ أو يعتذر عنها، ولا يُكتب
            إسنادٌ ولا يُنشَر اسمُه ولا يدخل كشفَ مستحقّاتٍ قبل قبوله. ومهلةُ
            الردّ {ASSIGNMENT_OFFER_RESPONSE_DAYS} أيّام، وأجلُ الإعداد بعد
            القبول {COURSE_PREP_DEFAULT_DAYS} أيّام ({COURSE_PREP_MIN_DAYS} حدّا أدنى).
          </p>

          {!offerFor && (
            <div className="flex flex-wrap gap-2">
              {offerOptions.map((o) => (
                <Button key={o.profileId} size="sm" icon={Handshake}
                  onClick={() => {
                    setOfferFor(o); setOfferCourseId(""); setOfferCohortId("");
                    setOfferFeeAr(""); setOfferNoteAr(""); setOfferSessions("");
                    setOfferPrepDays(String(COURSE_PREP_DEFAULT_DAYS));
                    setOfferResponseDays(String(ASSIGNMENT_OFFER_RESPONSE_DAYS));
                  }}>
                  {o.fullName}{o.contract ? "" : " (بلا عقدٍ نافذ)"}
                </Button>
              ))}
            </div>
          )}

          {offerFor && (
            <Inset className="grid gap-3 p-3">
              <p className="text-read">
                <b>{offerFor.fullName}</b> — {offerFor.reference}
                {offerFor.contract
                  ? ` · عقدُه النافذ: ${offerFor.contract.title}`
                  : " · لا عقدَ نافذٌ في القاعدة (مدرّبٌ سبق هذه المرحلة)"}
              </p>

              <label className="grid gap-1 text-read">
                <span className="font-bold">الدورةُ — من مؤهّلاته وحدها</span>
                <select className={inputCls} value={offerCourseId}
                  onChange={(e) => { setOfferCourseId(e.target.value); setOfferCohortId(""); }}>
                  <option value="">اختر دورة…</option>
                  {offerFor.courses.map((c) => (
                    <option key={c.courseId} value={c.courseId}>
                      {c.titleAr}
                      {c.alreadyOpen ? " — عرضٌ مفتوحٌ عنده" : c.alreadyAccepted ? " — قبِلها" : ""}
                    </option>
                  ))}
                </select>
              </label>

              {offerCourseId && (
                <label className="grid gap-1 text-read">
                  <span className="font-bold">الشعبة — وتُترك فارغةً إن لم تُجدوَل بعد</span>
                  <select className={inputCls} value={offerCohortId}
                    onChange={(e) => setOfferCohortId(e.target.value)}>
                    <option value="">بلا شعبةٍ بعد — الدورةُ وحدها</option>
                    {(offerFor.courses.find((c) => c.courseId === offerCourseId)?.cohorts ?? []).map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.title}{h.startsAt ? ` — ${fmtDateTime(h.startsAt)}` : ""}
                        {h.mine ? " (هو مدرّبُها)" : h.hasLead ? " (لها قائدٌ)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="grid gap-1 text-read">
                <span className="font-bold">الأجرُ نصّا — يقرؤه إنسان</span>
                <input className={inputCls} maxLength={500} value={offerFeeAr}
                  placeholder="مثلا: ٢٥ دولارا لكلّ متعلّم، وبحدٍّ أدنى ٨ مقاعد"
                  onChange={(e) => setOfferFeeAr(e.target.value)} />
              </label>

              <label className="grid gap-1 text-read">
                <span className="font-bold">ملحوظةٌ له — لا تلزم</span>
                <textarea className={areaCls} rows={2} maxLength={1000} value={offerNoteAr}
                  onChange={(e) => setOfferNoteAr(e.target.value)} />
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1 text-read">
                  <span className="font-bold">عددُ الجلسات</span>
                  <input className={inputCls} inputMode="numeric" value={offerSessions}
                    onChange={(e) => setOfferSessions(e.target.value.replace(/\D/g, ""))} />
                </label>
                <label className="grid gap-1 text-read">
                  <span className="font-bold">مهلةُ الردّ (أيّام)</span>
                  <input className={inputCls} inputMode="numeric" value={offerResponseDays}
                    onChange={(e) => setOfferResponseDays(e.target.value.replace(/\D/g, ""))} />
                </label>
                <label className="grid gap-1 text-read">
                  <span className="font-bold">أجلُ الإعداد (أيّام)</span>
                  <input className={inputCls} inputMode="numeric" value={offerPrepDays}
                    onChange={(e) => setOfferPrepDays(e.target.value.replace(/\D/g, ""))} />
                </label>
              </div>

              <div>
                <Button tone="confirm" icon={Handshake} loading={busy} disabled={!offerCourseId}
                  onClick={() => void run(async () => {
                    await apiPost("/api/admin/trainer-offers", {
                      profileId: offerFor.profileId,
                      courseId: offerCourseId,
                      cohortId: offerCohortId || null,
                      sessionsCount: offerSessions ? Number(offerSessions) : null,
                      feeNoteAr: offerFeeAr.trim() || null,
                      noteAr: offerNoteAr.trim() || null,
                      prepDays: offerPrepDays ? Number(offerPrepDays) : null,
                      responseDays: offerResponseDays ? Number(offerResponseDays) : null,
                    });
                    setOfferFor(null);
                    await load();
                  }, "أُرسل العرضُ — وينتظر جوابَه")}>
                  اعرِضْها عليه
                </Button>
              </div>
            </Inset>
          )}

          {offers.length > 0 && (
            <div className="mt-4">
              <ListToolbar q={offerQ} onQ={setOfferQ} onPage={setOfferPage}
                view={offerView} unit="عرضا"
                placeholder="ابحث باسم المدرّب أو دورته أو شعبته أو حال عرضه…" />
            </div>
          )}
          {offerView.rows.length > 0 && (
            <ul className="mt-2 space-y-2">
              {offerView.rows.map((o) => (
                <li key={o.id}>
                  <Inset className="p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <b>{o.profile?.application?.fullName ?? "—"}</b>
                        <span className="opacity-70">
                          {" "}— {o.courseTitleAr}
                          {o.cohort ? ` · شعبةُ «${o.cohort.title}»` : " · بلا شعبة"}
                          {" · "}{OFFER_STATUS_AR[o.status] ?? o.status}
                        </span>
                      </span>
                      {o.status === "offered" && (
                        <Button size="sm" tone="danger" icon={Ban}
                          onClick={() => setAsking({
                            titleAr: `سحبُ عرضِ «${o.courseTitleAr}»`,
                            confirmLabelAr: "اسحبِ العرضَ وأبلغْه",
                            labelAr: "سببُ السحب — يصل صاحبَه بنصّه",
                            whatAr: "يُسحب هذا العرضُ فلا يعود قابلا للجواب، ويصل المدرّبَ أنّه سُحب وبِمَ.",
                            okAr: "سُحب العرضُ ووصل صاحبَه",
                            post: (reasonAr) => apiPost(`/api/admin/trainer-offers/${o.id}/withdraw`, { reasonAr }),
                          })}>
                          اسحبْه
                        </Button>
                      )}
                    </div>
                    {o.status === "offered" && (
                      <p className="mt-1 text-read opacity-70">مهلةُ الردّ تنتهي {fmtDateTime(o.expiresAt)}</p>
                    )}
                    {o.status === "accepted" && o.prepDueAt && (
                      <p className="mt-1 text-read opacity-70">
                        {o.prepConfirmedAt
                          ? `أقرّ بجاهزيّته ${fmtDateTime(o.prepConfirmedAt)}`
                          : `أجلُ إعداده ينتهي ${fmtDateTime(o.prepDueAt)}`}
                        {!o.prepConfirmedAt && o.prepLapsedAt
                          ? " — وقد انقضى بلا إقرار، والإسنادُ قائمٌ كما هو" : ""}
                      </p>
                    )}
                    {o.declineReasonAr && (
                      <p className="mt-1 text-read opacity-70">سببُ اعتذاره: {o.declineReasonAr}</p>
                    )}
                    {o.withdrawReasonAr && (
                      <p className="mt-1 text-read opacity-70">سببُ السحب: {o.withdrawReasonAr}</p>
                    )}
                  </Inset>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ═══ نسخةٌ تُحمَل لا تُقرأ على الشاشة وحدَها (٢٦ سبتمبر ٢٠٢٦) ═══

          بلاغُ صاحب المنصّة: «العقد الملغى لم يظهر لي زرّ تحميل أو حذف». والمتنُ
          كان يُعرض ولا يُخرَج: من طُلب منه العقدُ في ملفٍّ ورقيٍّ أو بريدٍ لم
          يجد بابا.

          وبابان لا واحد، لأنّهما شيئان:
          · **الطباعة** صورةٌ للقراءة — ورقةٌ أو PDF بنَسَق الوثيقة نفسِه.
          · **تنزيلُ المتن** هو الحروفُ التي بُصمت (`bodyHash`) حرفا بحرف. فمن
            أراد أن يقابل بصمةً يقابلها بهذا لا بصورةٍ معادِ رسمُها.

          والمطبوعُ هو المعروضُ نفسُه لا رسمٌ ثانٍ له: وثيقةٌ تُرسم مرّتين
          تفترقان يوما، وأخطرُ افتراقٍ في الدنيا افتراقُ الورقةِ عن الشاشة. */}
      {shownBody && (
        <Card className="mt-6 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black">{shownBody.title}</h2>
            <span className="flex flex-wrap gap-2">
              <Button size="sm" icon={Printer} onClick={() => window.print()}>
                اطبعْه أو احفظْه PDF
              </Button>
              <Button size="sm" icon={Download} onClick={() => downloadBodyAr(shownBody)}>
                نزّلِ المتن
              </Button>
              <Button size="sm" onClick={() => setShownBody(null)}>أغلِقْ</Button>
            </span>
          </div>
          {/* والمعرّفُ مفتاحُ الطباعة: قاعدةُ `@media print` تُخفي كلَّ ما ليس
              هذا ولا جدّا له، فتخرج الوثيقةُ وحدَها بلا شريطٍ ولا قائمة. */}
          <div id="contract-sheet" dir="rtl" className="max-h-[32rem] overflow-auto rounded-lg">
            <ContractDocument doc={parseContractDoc(shownBody.body)} />
          </div>
        </Card>
      )}

      {/* والسببُ الذي يصل إنسانا يُكتب في نافذةٍ تُقرأ، لا في سطر متصفّح */}
      {asking && (
        <ConfirmAction
          titleAr={asking.titleAr}
          confirmLabelAr={asking.confirmLabelAr}
          busy={busy}
          reason={{ labelAr: asking.labelAr, minLength: 5 }}
          onCancel={() => setAsking(null)}
          onConfirm={(reasonText) => void run(async () => {
            await asking.post(reasonText ?? "");
            setAsking(null);
            await load();
          }, asking.okAr, asking.rowId)}
        >
          <p className="text-read leading-7">{asking.whatAr}</p>
        </ConfirmAction>
      )}

      {/* ═══ الإغلاقُ على أرقامٍ لا على تقدير (٢٦ سبتمبر ٢٠٢٦) ═══

          نافذةٌ واحدةٌ لبابَين، لأنّ السؤالَ واحد: **ما سيمسّه هذا؟** والفرقُ
          بينهما في الجواب لا في السؤال:
          · `revoke` يُغلِق عرضا لم يُوقَّع — فالأرقامُ سياقٌ يُطمئن أو يُوقِف.
          · `depart` يفسخ نافذا — فهي عواقبُ تقع بالنقرة.

          ولذلك يختلف نصُّ السبب: سببُ الإلغاء **يصل المدرّبَ بحرفه** (رسالةُ
          `notifyContractRevoked`)، وسببُ الرحيل يُكتب في ملفّه ولا يُنقل إليه —
          رسالةُ الرحيل تقول إنّ التعاقد انتهى ولا تنقل سببَه. ومن وعد بما لا
          يُرسَل صنع شكوى المرحلة السادسة نفسَها. */}
      {closing && (
        <ConfirmAction
          titleAr={closing.mode === "revoke"
            ? `إلغاءُ «${closing.row.title}»`
            : `إنهاءُ تعاقدِ ${docNameOf(closing.row)}`}
          confirmLabelAr={closing.mode === "revoke" ? "ألغِ العقد" : "أنهِ التعاقدَ وافتحْ ملفَّ الرحيل"}
          busy={busy}
          reason={{
            labelAr: closing.mode === "revoke"
              ? "سببُ الإلغاء — يصل المدرّبَ بنصّه، ويُقرأ في السجلّ بعد سنة"
              : "سببُ الرحيل — يُكتب في ملفّه ويُقرأ بعد سنة (ولا يُنقل إليه في رسالته)",
            minLength: 5,
          }}
          onCancel={() => setClosing(null)}
          onConfirm={(reasonText) => void run(async () => {
            if (closing.mode === "revoke") {
              await apiPost(`/api/admin/trainer-contracts/${closing.row.id}/revoke`, { reasonAr: reasonText });
            } else {
              await apiPost(`/api/admin/trainer-departures`,
                { profileId: closing.row.profile!.id, reasonAr: reasonText });
            }
            setClosing(null);
            await load();
          }, closing.mode === "revoke"
            ? "أُلغي العقدُ ووصلَه سببُه"
            : "انتهى التعاقدُ وفُتح ملفُّ الرحيل — ولكلّ متعلّمٍ صفٌّ يُختار")}
        >
          <p className="text-read leading-7">
            {closing.mode === "revoke"
              ? "يُغلَق هذا العقدُ ولا يُحذَف: يبقى في القائمة بحالة «ملغًى» وسببُه معه، ويبطل رابطُ توقيعه. ويصل المدرّبَ أنّه أُلغي وبِمَ."
              : "يُفسَخ هذا العقدُ للمستقبل، ويُفتح ملفُّ رحيلٍ يُعرَض فيه على كلّ متعلّمٍ صفُّه، وتُسحب العروضُ التي تنتظر جوابَه. ولا يمحو ذلك ما كان: نسختُه ودليلُ توقيعه يبقيان، وما استحقّه عن عملٍ أدّاه يبقى مستحقّا له."}
          </p>
          {impactBites(closing.impact)
            ? (
              <Inset className="mt-3 p-3 text-read leading-7">
                <p className="mb-1 font-black">
                  {closing.mode === "depart" ? "وهذا ما سيُمَسّ:" : "ولهذا المدرّبِ اليومَ ما يلي — فانظرْ فيه قبل الإغلاق:"}
                </p>
                <ul className="list-inside list-disc">
                  {closing.impact.liveCohorts > 0 && (
                    <li>شعبٌ حيّةٌ يدرّسها: <b>{closing.impact.liveCohorts}</b></li>
                  )}
                  {closing.impact.enrolledLearners > 0 && (
                    <li>متعلّمون مسجَّلون فيها: <b>{closing.impact.enrolledLearners}</b></li>
                  )}
                  {closing.impact.openOffers > 0 && (
                    <li>عروضُ إسنادٍ تنتظر جوابَه: <b>{closing.impact.openOffers}</b></li>
                  )}
                  {closing.impact.unpaidPayouts > 0 && (
                    <li>
                      مستحقّاتٌ لم تُصرَف: <b>{closing.impact.unpaidPayouts}</b>
                      {" — "}
                      {Object.entries(closing.impact.owedByCurrency)
                        .map(([cur, amount]) => `${amount} ${cur}`).join(" · ")}
                    </li>
                  )}
                </ul>
                {closing.mode === "revoke" && (
                  <p className="mt-2 opacity-80">
                    وهذه قائمةٌ بعقدٍ آخر — إلغاءُ هذا العرضِ لا يمسّها. وإنّما تُقرأ
                    لتعرفَ أنّ للرجلِ عملا قائما قبل أن تُغلِق بابَه.
                  </p>
                )}
              </Inset>
            )
            : (
              <Inset className="mt-3 p-3 text-read leading-7">
                لا شعبَ حيّةً لهذا المدرّب، ولا متعلّمين، ولا عرضا ينتظر جوابَه، ولا
                مستحقّا لم يُصرَف. فلا شيءَ سيُمَسّ غيرَ هذا العقد.
              </Inset>
            )}
        </ConfirmAction>
      )}

      {/* ═══ الحذفُ يقول ماذا سيحدث بالضبط — ولا يطال موقَّعا ═══ */}
      {deleting && (
        <ConfirmAction
          titleAr={`حذفُ «${deleting.title}»`}
          confirmLabelAr="احذِفْ"
          onCancel={() => setDeleting(null)}
          onConfirm={() => void run(async () => {
            await apiDelete(`/api/admin/trainer-contracts/${deleting.id}`);
            setDeleting(null);
            await load();
          }, "حُذِف العقد")}
        >
          <p className="leading-7">
            يُمحى الصفُّ ولا يُستعاد: متنُه وبصمتُه وحالتُه ومرفقاتُه. ويبقى في
            سجلّ الأثر من حذفه ومتى، وعنوانُه وحالتُه يومَ حُذف.
          </p>
          <p className="mt-2 leading-7">
            وهذا العقدُ لم يمسّه توقيع — والموقَّعُ لا يُحذف أصلا، فهو دليلٌ
            يُحتَجّ به للمدرّب وعليه.
          </p>
        </ConfirmAction>
      )}

    </AdminLayout>
  );
}
